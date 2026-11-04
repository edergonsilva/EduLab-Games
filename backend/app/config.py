from pathlib import Path
import os
import secrets

# Base data directory (sibling to backend/ at repo root, or relative to CWD)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Where .edugame package files are stored
PACKAGES_DIR = BASE_DIR / "data" / "packages"

# Where extracted game files are served as static content
STATIC_IMPORTED_DIR = BASE_DIR / "data" / "static" / "imported"

# SQLite database path
DATABASE_URL = f"sqlite:///{BASE_DIR / 'data' / 'edulab.db'}"

# URL prefix used to serve imported game static files
STATIC_IMPORTED_URL = "/static/imported"

# Set EDULAB_SESSION_SECRET in deployed environments to keep sessions stable
# across process restarts and multiple workers.
SESSION_SECRET_KEY = os.getenv("EDULAB_SESSION_SECRET") or secrets.token_urlsafe(32)
SESSION_COOKIE_SECURE = os.getenv("EDULAB_COOKIE_SECURE", "false").lower() == "true"
CORS_ORIGINS = [
	origin.strip()
	for origin in os.getenv(
		"EDULAB_ALLOWED_ORIGINS",
		"http://localhost:3000,http://localhost:5173,http://localhost:5174,"
		"http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174",
	).split(",")
	if origin.strip()
]
