"""
FileShare API Errors
Centralized exception types mapped to HTTP responses by the global error handler.

Each error carries an HTTP status code and a user-facing detail message,
so routes can raise instead of returning inline JSON.
"""


class ApiError(Exception):
    """Base API error. Raise from any route or service layer."""

    status_code = 400
    detail = "Bad request"

    def __init__(self, detail=None, status_code=None):
        if detail is not None:
            self.detail = detail
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.detail)

    def to_dict(self):
        return {"detail": self.detail}


class ForbiddenError(ApiError):
    status_code = 403
    detail = "Not allowed"


class NotFoundError(ApiError):
    status_code = 404
    detail = "Resource not found"


class ConflictError(ApiError):
    status_code = 409
    detail = "Resource conflict"


class GoneError(ApiError):
    status_code = 410
    detail = "Resource has been deleted"


class ValidationError(ApiError):
    status_code = 400
    detail = "Invalid request data"


class PayloadTooLargeError(ApiError):
    status_code = 413
    detail = "Payload too large"


class RateLimitError(ApiError):
    status_code = 429
    detail = "Too many requests. Please try again shortly."

    def __init__(self, detail=None, headers=None):
        super().__init__(detail, 429)
        self.headers = headers or {}
