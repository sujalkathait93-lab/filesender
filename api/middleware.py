"""
FileShare Middleware & Security Headers
Primary Responsibility: Request path rewriting for hosting environments and HTTP security headers.
"""

from api.config import IS_VERCEL, is_vercel


class VercelPathMiddleware:
    """WSGI middleware to resolve original request paths rewritten by Vercel."""

    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched = environ.get("HTTP_X_MATCHED_PATH") or environ.get("HTTP_X_VERCEL_PATH")
        if matched and environ.get("PATH_INFO") in (
            "/api/index.py",
            "/api/index",
            "/index.py",
            "/api",
            "/api/",
        ):
            if "?" in matched:
                matched = matched.split("?")[0]
            environ["PATH_INFO"] = matched
        return self.wsgi_app(environ, start_response)


def apply_security_headers(response):
    """Attach standard web application security headers to an outgoing response."""
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
