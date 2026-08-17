"""
WSGI entry point for Vercel Python Serverless Functions.

Vercel expects a module-level `app` attribute that is a WSGI-compatible
application object. This file re-exports the Flask app from the main
application factory.

For local development, use `python api/index.py` instead.
"""

import os
import sys

# Ensure the project root is importable
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from api.index import app  # noqa: E402

# Vercel looks for `app` at module level
