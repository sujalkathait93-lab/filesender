"""
FileShare - End-to-End Encrypted File Sharing API & WebRTC Signaling Server
Main application entry point & factory.

Responsibilities:
- Builds the Flask app with centralized JSON error handling.
- Starts a single persistent background cleanup thread (not one per upload).
- Registers REST routes and Socket.IO signaling handlers.
"""

import logging
import os
import sys
import threading

# Ensure the project root is importable when running `python api/index.py`
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

# pyrefly: ignore [missing-import]
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO

from api.config import (
    SECRET_KEY, DB_PATH, UPLOAD_DIR, DEFAULT_PORT, HOST,
    CORS_EXPOSE_HEADERS, MAX_FILE_SIZE, CLEANUP_INTERVAL_SECONDS,
    FRONTEND_ORIGIN, CORS_ORIGINS, IS_PRODUCTION, is_vercel
)

logger = logging.getLogger("fileshare.app")
from api.database import DatabaseManager
from api.storage import StorageManager
from api.errors import ApiError
from api.rate_limit import RateLimiter
from api.services.transfer_service import TransferService
from api.services.cleanup_service import CleanupService
from api.routes.file_routes import file_bp, init_file_routes
from api.routes.signaling import register_signaling_handlers


def _register_error_handlers(app):
    """Centralized JSON error handling for the whole app with SPA fallback."""

    @app.errorhandler(ApiError)
    def handle_api_error(err: ApiError):
        response = jsonify(err.to_dict())
        response.status_code = err.status_code
        if getattr(err, "headers", None):
            response.headers.update(err.headers)
        return response

    @app.errorhandler(404)
    def handle_not_found(_):
        dist_dir = os.path.join(_PROJECT_ROOT, "frontend", "dist")
        if os.path.isdir(dist_dir) and not request.path.startswith("/api"):
            rel_path = request.path.lstrip("/")
            target = os.path.join(dist_dir, rel_path)
            if rel_path and os.path.isfile(target):
                return send_from_directory(dist_dir, rel_path)
            index_path = os.path.join(dist_dir, "index.html")
            if os.path.isfile(index_path):
                return send_from_directory(dist_dir, "index.html")
        return jsonify({"error": "Endpoint not found", "code": "not_found", "status": 404, "detail": "Endpoint not found"}), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(_):
        message = "Method not allowed. Ensure the correct HTTP method is used."
        return jsonify({"error": message, "code": "method_not_allowed", "status": 405, "detail": message}), 405

    @app.errorhandler(413)
    def handle_payload_too_large(_):
        message = "Upload exceeds the maximum allowed size"
        return jsonify({"error": message, "code": "payload_too_large", "status": 413, "detail": message}), 413

    @app.errorhandler(429)
    def handle_rate_limited(_):
        message = "Too many requests. Please try again shortly."
        return jsonify({"error": message, "code": "rate_limited", "status": 429, "detail": message}), 429

    @app.errorhandler(500)
    def handle_server_error(_):
        message = "Internal server error"
        return jsonify({"error": message, "code": "internal_error", "status": 500, "detail": message}), 500


def _start_cleanup_thread(cleanup_service: CleanupService):
    """One daemon thread that runs cleanup passes on an interval."""
    def loop():
        while True:
            threading.Event().wait(CLEANUP_INTERVAL_SECONDS)
            cleanup_service.run()

    thread = threading.Thread(target=loop, daemon=True, name="cleanup-thread")
    thread.start()
    return thread


class VercelPathMiddleware:
    """WSGI middleware to resolve original request paths rewritten by Vercel."""
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched = environ.get("HTTP_X_MATCHED_PATH") or environ.get("HTTP_X_VERCEL_PATH")
        if matched and environ.get("PATH_INFO") in ("/api/index.py", "/api/index", "/index.py", "/api", "/api/"):
            if "?" in matched:
                matched = matched.split("?")[0]
            environ["PATH_INFO"] = matched
        return self.wsgi_app(environ, start_response)


def create_app():
    """Application factory for Flask + SocketIO."""
    app = Flask(__name__)
    app.wsgi_app = VercelPathMiddleware(app.wsgi_app)
    app.config['SECRET_KEY'] = SECRET_KEY
    app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE + 64 * 1024 * 1024  # 1 GB + encryption & multipart overhead

    cors_origins = CORS_ORIGINS
    allow_credentials = CORS_ORIGINS != "*"
    CORS(
        app,
        resources={r"/*": {"origins": cors_origins}},
        supports_credentials=allow_credentials,
        expose_headers=CORS_EXPOSE_HEADERS
    )

    # SocketIO setup (local development only; serverless skips WebSockets)
    socketio = None
    if not is_vercel:
        try:
            socketio = SocketIO(
                app,
                cors_allowed_origins=cors_origins,
                async_mode="threading",
                logger=False,
                engineio_logger=False
            )
            register_signaling_handlers(socketio)
        except Exception as e:
            logger.warning("SocketIO init skipped: %s", e)

    # Initialize infrastructure layers
    db_manager = DatabaseManager(DB_PATH)
    storage_manager = StorageManager(UPLOAD_DIR)

    # Initialize domain services (Dependency Injection)
    transfer_service = TransferService(db_manager, storage_manager)
    cleanup_service = CleanupService(db_manager, storage_manager)
    rate_limiter = RateLimiter()

    # Register HTTP routes blueprint and inject dependencies
    init_file_routes(transfer_service, rate_limiter)
    app.register_blueprint(file_bp)

    # Security headers middleware
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        # CSP: allow the SPA to load its own scripts/styles/images, Vercel insights, and connect to the API/WS
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' wss: ws: https://vitals.vercel-insights.com; "
            "frame-ancestors 'none'; "
            "base-uri 'none'"
        )
        # HSTS: enforce HTTPS (Vercel always terminates TLS)
        if is_vercel:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response

    # Centralized error handling
    _register_error_handlers(app)

    # Persistent background cleanup — skip on Vercel (serverless has no persistent threads)
    if not is_vercel:
        _start_cleanup_thread(cleanup_service)
    else:
        logger.info("Vercel detected — skipping cleanup thread (serverless)")

    return app, socketio


_bootstrap = create_app()
app = _bootstrap[0]
socketio = _bootstrap[1]

if __name__ == "__main__":
    logger.info("Starting FileShare Flask + SocketIO Server on %s:%s", HOST, DEFAULT_PORT)
    if socketio:
        socketio.run(app, host=HOST, port=DEFAULT_PORT, debug=not IS_PRODUCTION)
    else:
        app.run(host=HOST, port=DEFAULT_PORT, debug=not IS_PRODUCTION)
