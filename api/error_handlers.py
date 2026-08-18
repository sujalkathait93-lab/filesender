"""
FileShare Error Handlers
Primary Responsibility: Centralized JSON error handling and SPA fallback routing.
"""

import os
# pyrefly: ignore [missing-import]
from flask import jsonify, request, send_from_directory

from api.errors import ApiError


def register_error_handlers(app, project_root: str):
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
        dist_dir = os.path.join(project_root, "frontend", "dist")
        if os.path.isdir(dist_dir) and not request.path.startswith("/api"):
            rel_path = request.path.lstrip("/")
            target = os.path.join(dist_dir, rel_path)
            if rel_path and os.path.isfile(target):
                return send_from_directory(dist_dir, rel_path)
            index_path = os.path.join(dist_dir, "index.html")
            if os.path.isfile(index_path):
                return send_from_directory(dist_dir, "index.html")
        return jsonify({
            "error": "Endpoint not found",
            "code": "not_found",
            "status": 404,
            "detail": "Endpoint not found"
        }), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(_):
        message = "Method not allowed. Ensure the correct HTTP method is used."
        return jsonify({
            "error": message,
            "code": "method_not_allowed",
            "status": 405,
            "detail": message
        }), 405

    @app.errorhandler(413)
    def handle_payload_too_large(_):
        message = "Upload exceeds the maximum allowed size"
        return jsonify({
            "error": message,
            "code": "payload_too_large",
            "status": 413,
            "detail": message
        }), 413

    @app.errorhandler(429)
    def handle_rate_limited(_):
        message = "Too many requests. Please try again shortly."
        return jsonify({
            "error": message,
            "code": "rate_limited",
            "status": 429,
            "detail": message
        }), 429

    @app.errorhandler(500)
    def handle_server_error(_):
        message = "Internal server error"
        return jsonify({
            "error": message,
            "code": "internal_error",
            "status": 500,
            "detail": message
        }), 500
