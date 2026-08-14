"""
SecureShare - End-to-End Encrypted File Sharing API & WebRTC Signaling Server
Main application entry point & factory.

Responsibilities:
- Builds the Flask app with centralized JSON error handling.
- Starts a single persistent background cleanup thread (not one per upload).
- Registers REST routes and Socket.IO signaling handlers.
"""

import os
import sys
import threading

# Ensure the project root is importable when running `python api/index.py`
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

# pyrefly: ignore [missing-import]
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO

from api.config import (
    SECRET_KEY, DB_PATH, UPLOAD_DIR, DEFAULT_PORT,
    CORS_EXPOSE_HEADERS, MAX_FILE_SIZE, CLEANUP_INTERVAL_SECONDS
)
from api.database import DatabaseManager
from api.storage import StorageManager
from api.errors import ApiError
from api.rate_limit import RateLimiter
from api.services.transfer_service import TransferService
from api.services.cleanup_service import CleanupService
from api.routes.file_routes import file_bp, init_file_routes
from api.routes.signaling import register_signaling_handlers


def _register_error_handlers(app):
    """Centralized JSON error handling for the whole app."""

    @app.errorhandler(ApiError)
    def handle_api_error(err: ApiError):
        response = jsonify(err.to_dict())
        response.status_code = err.status_code
        if getattr(err, "headers", None):
            response.headers.update(err.headers)
        return response

    @app.errorhandler(404)
    def handle_not_found(_):
        return jsonify({"detail": "Endpoint not found"}), 404

    @app.errorhandler(413)
    def handle_payload_too_large(_):
        return jsonify({"detail": "Upload exceeds the maximum allowed size"}), 413

    @app.errorhandler(429)
    def handle_rate_limited(_):
        return jsonify({"detail": "Too many requests. Please try again shortly."}), 429

    @app.errorhandler(500)
    def handle_server_error(_):
        return jsonify({"detail": "Internal server error"}), 500


def _start_cleanup_thread(cleanup_service: CleanupService):
    """One daemon thread that runs cleanup passes on an interval."""
    def loop():
        while True:
            threading.Event().wait(CLEANUP_INTERVAL_SECONDS)
            cleanup_service.run()

    thread = threading.Thread(target=loop, daemon=True, name="cleanup-thread")
    thread.start()
    return thread


def create_app():
    """Application factory for Flask + SocketIO."""
    app = Flask(__name__)
    app.config['SECRET_KEY'] = SECRET_KEY
    app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE + 1024 * 1024  # 2 GB + multipart overhead

    # CORS configuration
    CORS(
        app,
        resources={r"/*": {"origins": "*"}},
        supports_credentials=True,
        expose_headers=CORS_EXPOSE_HEADERS
    )

    # SocketIO setup
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="threading",
        logger=False,
        engineio_logger=False
    )

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

    # Register SocketIO signaling handlers
    register_signaling_handlers(socketio)

    # Security headers middleware
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    # Centralized error handling
    _register_error_handlers(app)

    # Persistent background cleanup (single thread, not per-request)
    _start_cleanup_thread(cleanup_service)

    return app, socketio


app, socketio = create_app()

if __name__ == "__main__":
    print(f"Starting FileShare Flask + SocketIO Server on port {DEFAULT_PORT}...")
    socketio.run(app, host="0.0.0.0", port=DEFAULT_PORT, debug=False, allow_unsafe_werkzeug=True)
