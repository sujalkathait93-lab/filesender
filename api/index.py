"""
FileShare - End-to-End Encrypted File Sharing API & WebRTC Signaling Server
Main application entry point & factory.

Primary Responsibility: Flask & Socket.IO application bootstrapping, dependency injection, and server lifecycle.
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
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO

from api.config import (
    SECRET_KEY, DB_PATH, UPLOAD_DIR, DEFAULT_PORT, HOST,
    CORS_EXPOSE_HEADERS, MAX_FILE_SIZE, CLEANUP_INTERVAL_SECONDS,
    CORS_ORIGINS, IS_PRODUCTION, is_vercel
)
from api.database import DatabaseManager
from api.storage import StorageManager
from api.rate_limit import RateLimiter
from api.services.transfer_service import TransferService
from api.services.cleanup_service import CleanupService
from api.routes.file_routes import file_bp, init_file_routes
from api.routes.signaling import register_signaling_handlers
from api.middleware import VercelPathMiddleware, apply_security_headers
from api.error_handlers import register_error_handlers

logger = logging.getLogger("fileshare.app")


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
    app.after_request(apply_security_headers)

    # Centralized error handling & SPA fallback
    register_error_handlers(app, _PROJECT_ROOT)

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
