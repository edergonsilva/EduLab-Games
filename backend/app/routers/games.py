"""Games router — handles catalog listing, single-game lookup, and .edugame import.

## Reimportation behaviour
When a `.edugame` package whose ``slug`` already exists in the database is
imported again, the platform performs a **clean replacement**:

1. The extracted static files of the previous game are removed from disk.
2. The previous ``.edugame`` package file is removed from disk.
3. The database row for the old game is deleted.
4. The new package is then saved, extracted, and recorded — exactly as if it
   were being imported for the first time.

This ensures that no stale CSS/JS/assets from the old package can be served
after a reimport, and that the resulting state is deterministic regardless of
how many times the same game has been imported.

Only the game matching the exact ``slug`` from the uploaded manifest is
removed.  Games with different slugs are never touched.
"""

import io
import logging
import shutil
import zipfile
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import PACKAGES_DIR, STATIC_IMPORTED_DIR, STATIC_IMPORTED_URL
from app.database import get_db
from app.models import Game
from app.schemas import GameResponse, ImportResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/games", tags=["games"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_REQUIRED_MANIFEST_FIELDS = ("slug", "title", "version")


def _parse_manifest(zip_bytes: bytes) -> dict:
    """Extract and validate manifest.json from raw .edugame ZIP bytes."""
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            if "manifest.json" not in zf.namelist():
                raise ValueError("manifest.json not found in .edugame package")
            import json

            manifest = json.loads(zf.read("manifest.json"))
    except zipfile.BadZipFile as exc:
        raise ValueError(f"Uploaded file is not a valid ZIP/edugame: {exc}") from exc

    for field in _REQUIRED_MANIFEST_FIELDS:
        if not manifest.get(field):
            raise ValueError(f"manifest.json is missing required field: '{field}'")

    # Normalise slug to a filesystem-safe identifier
    manifest["slug"] = _normalise_slug(str(manifest["slug"]))
    return manifest


def _normalise_slug(raw: str) -> str:
    """Return a lowercase, hyphenated slug stripped of unsafe path characters."""
    import re

    slug = raw.lower().strip()
    # Replace any character that is not alphanumeric or hyphen with a hyphen
    slug = re.sub(r"[^a-z0-9\-]", "-", slug)
    # Collapse multiple consecutive hyphens
    slug = re.sub(r"-{2,}", "-", slug)
    return slug.strip("-")


def _remove_game_artifacts(game: Game) -> None:
    """Delete all on-disk artifacts associated with *game*.

    Removes:
    * The directory containing the extracted static files.
    * The ``.edugame`` package file.

    Both paths are stored in the database row and are scoped to the specific
    game — no other game's files are touched.
    """
    extracted = Path(game.extracted_path)
    if extracted.exists():
        logger.info("Removing extracted game directory: %s", extracted)
        shutil.rmtree(extracted, ignore_errors=False)
    else:
        logger.warning("Extracted directory not found (already removed?): %s", extracted)

    package = Path(game.package_path)
    if package.exists():
        logger.info("Removing package file: %s", package)
        package.unlink()
    else:
        logger.warning("Package file not found (already removed?): %s", package)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[GameResponse])
def list_games(db: Session = Depends(get_db)):
    """Return all imported games."""
    return db.query(Game).order_by(Game.title).all()


@router.get("/{slug}", response_model=GameResponse)
def get_game(slug: str, db: Session = Depends(get_db)):
    """Return a single game by slug."""
    game = db.query(Game).filter(Game.slug == slug).first()
    if not game:
        raise HTTPException(status_code=404, detail=f"Game '{slug}' not found")
    return game


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_game(slug: str, db: Session = Depends(get_db)):
    """Remove a game and all its on-disk artifacts."""
    game = db.query(Game).filter(Game.slug == slug).first()
    if not game:
        raise HTTPException(status_code=404, detail=f"Game '{slug}' not found")

    _remove_game_artifacts(game)
    db.delete(game)
    db.commit()


@router.post("/import", response_model=ImportResult, status_code=status.HTTP_201_CREATED)
def import_game(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import a ``.edugame`` package.

    If a game with the same slug already exists the previous game's extracted
    files and package file are **removed from disk** and its database record is
    deleted before the new package is saved.  This guarantees a clean
    replacement with no leftover artifacts from the old version.
    """
    if not file.filename or not file.filename.endswith(".edugame"):
        raise HTTPException(
            status_code=400,
            detail="Only .edugame files are accepted",
        )

    zip_bytes = file.file.read()

    # -- Validate and read manifest ------------------------------------------
    try:
        manifest = _parse_manifest(zip_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    slug = manifest["slug"]
    version = manifest["version"]

    # -- Clean up previous installation (if any) -----------------------------
    existing_game = db.query(Game).filter(Game.slug == slug).first()
    replaced = existing_game is not None

    if replaced:
        logger.info(
            "Game '%s' already exists (version %s). Removing previous artifacts "
            "before importing new package.",
            slug,
            existing_game.version,
        )
        _remove_game_artifacts(existing_game)
        db.delete(existing_game)
        db.flush()  # ensure the row is gone before we insert the new one

    # -- Persist package file ------------------------------------------------
    PACKAGES_DIR.mkdir(parents=True, exist_ok=True)
    package_path = PACKAGES_DIR / f"{slug}.edugame"
    package_path.write_bytes(zip_bytes)
    logger.info("Saved package file: %s", package_path)

    # -- Extract static files ------------------------------------------------
    extract_dir = STATIC_IMPORTED_DIR / slug / version
    extract_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        # Extract every member, skipping unsafe paths (path traversal guard)
        for member in zf.infolist():
            member_path = extract_dir / member.filename
            # Resolve to ensure the target stays inside extract_dir
            try:
                member_path.resolve().relative_to(extract_dir.resolve())
            except ValueError:
                logger.warning("Skipping unsafe path in package: %s", member.filename)
                continue
            if member.is_dir():
                member_path.mkdir(parents=True, exist_ok=True)
            else:
                member_path.parent.mkdir(parents=True, exist_ok=True)
                member_path.write_bytes(zf.read(member.filename))

    logger.info("Extracted game to: %s", extract_dir)

    # -- Build entry URL and save to database --------------------------------
    entry_url = f"{STATIC_IMPORTED_URL}/{slug}/{version}/index.html"

    game = Game(
        slug=slug,
        title=manifest["title"],
        version=version,
        description=manifest.get("description"),
        author=manifest.get("author"),
        grade=manifest.get("grade"),
        subject=manifest.get("subject"),
        thumbnail=manifest.get("thumbnail"),
        entry_url=entry_url,
        extracted_path=str(extract_dir),
        package_path=str(package_path),
    )
    db.add(game)
    db.commit()
    db.refresh(game)

    if replaced:
        message = (
            f"Game '{slug}' v{version} imported. "
            "Previous version's artifacts were removed before import."
        )
    else:
        message = f"Game '{slug}' v{version} imported successfully."

    logger.info(message)
    return ImportResult(game=game, replaced=replaced, message=message)
