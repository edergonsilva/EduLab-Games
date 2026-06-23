#!/usr/bin/env python3
"""EduLab Games — official .edugame packager.

A .edugame file is a ZIP archive that must contain at least:
  - manifest.json   (required metadata)
  - index.html      (game entry point)

Usage examples
--------------
Validate only (no output file):
    python tools/package_edugame.py path/to/game/ --validate-only

Package with auto-generated name (<slug>-<version>.edugame in ./dist/):
    python tools/package_edugame.py path/to/game/

Custom output directory:
    python tools/package_edugame.py path/to/game/ --output-dir releases/

Custom output filename:
    python tools/package_edugame.py path/to/game/ --output-name my-game.edugame

manifest.json schema
---------------------
Required fields:
    slug      str   Stable identifier, e.g. "edulab-matematica-cdu-2ano"
    title     str   Human-readable title
    version   str   Semantic version, e.g. "1.0.0"

Optional fields:
    description  str
    author       str
    grade        str   Target school grade, e.g. "2ano"
    subject      str   Subject area, e.g. "matematica"
    thumbnail    str   Relative path to a cover image within the package
"""

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

REQUIRED_MANIFEST_FIELDS = ("slug", "title", "version")

# Characters NOT allowed in a slug
_UNSAFE_SLUG = re.compile(r"[^a-z0-9\-]")
_MULTI_HYPHEN = re.compile(r"-{2,}")


def _validate_manifest(manifest: dict) -> list[str]:
    """Return a list of validation error strings (empty == valid)."""
    errors: list[str] = []
    for field in REQUIRED_MANIFEST_FIELDS:
        if not manifest.get(field):
            errors.append(f"manifest.json: missing required field '{field}'")
    slug = manifest.get("slug", "")
    if slug and (_UNSAFE_SLUG.sub("", slug.lower()) != slug.lower()):
        errors.append(
            f"manifest.json: slug '{slug}' contains invalid characters "
            "(only lowercase letters, digits and hyphens are allowed)"
        )
    return errors


def _collect_files(game_dir: Path) -> list[Path]:
    """Return all regular files under game_dir, recursively."""
    return sorted(p for p in game_dir.rglob("*") if p.is_file())


def package_game(
    game_dir: Path,
    output_dir: Path | None = None,
    output_name: str | None = None,
    validate_only: bool = False,
) -> Path | None:
    """Package a game directory into a .edugame file.

    Parameters
    ----------
    game_dir:
        Directory containing manifest.json, index.html, and all game assets.
    output_dir:
        Destination directory for the .edugame file.  Defaults to ``dist/``
        relative to the current working directory.
    output_name:
        Override the auto-generated filename.
    validate_only:
        If True, validate but do not write any output file.

    Returns
    -------
    Path to the created .edugame file, or None when validate_only is True.
    """
    game_dir = game_dir.resolve()
    if not game_dir.is_dir():
        print(f"ERROR: '{game_dir}' is not a directory", file=sys.stderr)
        sys.exit(1)

    # -- Load manifest -------------------------------------------------------
    manifest_path = game_dir / "manifest.json"
    if not manifest_path.exists():
        print("ERROR: manifest.json not found", file=sys.stderr)
        sys.exit(1)

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR: manifest.json is not valid JSON: {exc}", file=sys.stderr)
        sys.exit(1)

    errors = _validate_manifest(manifest)

    # -- Check index.html ----------------------------------------------------
    if not (game_dir / "index.html").exists():
        errors.append("index.html not found in game directory")

    if errors:
        for err in errors:
            print(f"  ✗ {err}", file=sys.stderr)
        print("\nValidation FAILED.", file=sys.stderr)
        sys.exit(1)

    slug = manifest["slug"]
    version = manifest["version"]
    print(f"✓ manifest.json valid  ({slug} v{version})")

    if validate_only:
        print("Validation OK. No output file written (--validate-only).")
        return None

    # -- Build output path ---------------------------------------------------
    if output_dir is None:
        output_dir = Path.cwd() / "dist"
    output_dir.mkdir(parents=True, exist_ok=True)

    if output_name is None:
        safe_version = version.replace(".", "-")
        output_name = f"{slug}-{safe_version}.edugame"

    output_path = output_dir / output_name

    # -- Write ZIP -----------------------------------------------------------
    files = _collect_files(game_dir)
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in files:
            arcname = file_path.relative_to(game_dir)
            zf.write(file_path, arcname)
            print(f"  + {arcname}")

    size_kb = output_path.stat().st_size / 1024
    print(f"\n✓ Package created: {output_path}  ({size_kb:.1f} KB, {len(files)} files)")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Package a game directory into a .edugame file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("game_dir", type=Path, help="Path to the game directory")
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate manifest.json and index.html without writing output",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Destination directory for the .edugame file (default: dist/)",
    )
    parser.add_argument(
        "--output-name",
        default=None,
        help="Override the auto-generated output filename",
    )
    args = parser.parse_args()
    package_game(
        game_dir=args.game_dir,
        output_dir=args.output_dir,
        output_name=args.output_name,
        validate_only=args.validate_only,
    )


if __name__ == "__main__":
    main()
