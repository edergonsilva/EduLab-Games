from pathlib import Path

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
