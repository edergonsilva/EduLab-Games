import json
import secrets
import sqlite3
import string
import time
from contextlib import contextmanager
from pathlib import Path
import shutil
import zipfile

from app.config import settings
from app.models.game import GameManifest
from app.models.room import Room


STATIC_DIR = settings.storage_dir / "static"
IMPORTED_STATIC_DIR = STATIC_DIR / "imported"
PACKAGES_DIR = settings.storage_dir / "packages"
SEED_GAMES_PATH = settings.data_dir / "games.json"


@contextmanager
def get_connection():
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.database_path)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize_storage() -> None:
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    IMPORTED_STATIC_DIR.mkdir(parents=True, exist_ok=True)
    PACKAGES_DIR.mkdir(parents=True, exist_ok=True)

    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS imported_games (
                game_id TEXT NOT NULL,
                version TEXT NOT NULL,
                manifest_json TEXT NOT NULL,
                status TEXT NOT NULL,
                package_path TEXT NOT NULL,
                extracted_dir TEXT NOT NULL,
                thumbnail_url TEXT,
                imported_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                PRIMARY KEY (game_id, version)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS rooms (
                code TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                status TEXT NOT NULL,
                players_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )


def _safe_slug(value: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in value)


def _extract_zip_safely(archive: zipfile.ZipFile, destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    destination_root = destination.resolve()

    for member in archive.infolist():
        member_path = destination / member.filename
        resolved = member_path.resolve()
        if destination_root not in resolved.parents and resolved != destination_root:
            raise ValueError("Pacote .edugame contém caminhos inseguros.")

        if member.is_dir():
            resolved.mkdir(parents=True, exist_ok=True)
            continue

        resolved.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(member) as source, resolved.open("wb") as target:
            shutil.copyfileobj(source, target)


def load_seed_games() -> list[GameManifest]:
    with SEED_GAMES_PATH.open(encoding="utf-8") as file:
        payload = json.load(file)
    return [GameManifest(**game, source="seed") for game in payload]


def list_imported_games() -> list[GameManifest]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT manifest_json, status, thumbnail_url FROM imported_games ORDER BY updated_at DESC"
        ).fetchall()

    games: list[GameManifest] = []
    for row in rows:
        manifest_payload = json.loads(row["manifest_json"])
        manifest_payload["status"] = row["status"]
        manifest_payload["thumbnail"] = row["thumbnail_url"]
        manifest_payload["source"] = "imported"
        games.append(GameManifest(**manifest_payload))
    return games


def list_games(
    *,
    subject: str | None = None,
    grade: int | None = None,
    mode: str | None = None,
    status: str | None = "published",
) -> list[GameManifest]:
    games = [*load_seed_games(), *list_imported_games()]

    if status:
        games = [game for game in games if game.status == status]
    if subject:
        games = [game for game in games if game.subject in {None, subject}]
    if grade is not None:
        games = [game for game in games if grade in game.school_grades]
    if mode:
        games = [game for game in games if mode in game.mode]

    return sorted(games, key=lambda game: (game.source != "seed", game.name.lower(), game.version))


def get_game(game_id: str, version: str | None = None, *, status: str | None = None) -> GameManifest | None:
    games = list_games(status=status)
    matches = [game for game in games if game.id == game_id and (version is None or game.version == version)]
    if not matches:
        return None
    return matches[-1]


def save_imported_game(manifest: GameManifest, package_bytes: bytes, archive: zipfile.ZipFile) -> tuple[GameManifest, bool]:
    timestamp = time.time()
    game_slug = _safe_slug(manifest.id)
    version_slug = _safe_slug(manifest.version)
    extracted_dir = IMPORTED_STATIC_DIR / game_slug / version_slug
    package_path = PACKAGES_DIR / f"{game_slug}-{version_slug}.edugame"

    thumbnail_path = manifest.thumbnail
    if thumbnail_path and thumbnail_path not in archive.namelist():
        thumbnail_path = None
    if not thumbnail_path and "preview/cover.png" in archive.namelist():
        thumbnail_path = "preview/cover.png"

    manifest = manifest.model_copy(update={
        "status": "test",
        "thumbnail": (
            f"/static/imported/{game_slug}/{version_slug}/{thumbnail_path}" if thumbnail_path else None
        ),
        "source": "imported",
    })

    package_path.write_bytes(package_bytes)
    _extract_zip_safely(archive, extracted_dir)

    with get_connection() as connection:
        existing = connection.execute(
            "SELECT 1 FROM imported_games WHERE game_id = ? AND version = ?",
            (manifest.id, manifest.version),
        ).fetchone()
        connection.execute(
            """
            INSERT INTO imported_games (
                game_id, version, manifest_json, status, package_path, extracted_dir,
                thumbnail_url, imported_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(game_id, version) DO UPDATE SET
                manifest_json = excluded.manifest_json,
                status = excluded.status,
                package_path = excluded.package_path,
                extracted_dir = excluded.extracted_dir,
                thumbnail_url = excluded.thumbnail_url,
                updated_at = excluded.updated_at
            """,
            (
                manifest.id,
                manifest.version,
                manifest.model_dump_json(),
                manifest.status,
                str(package_path),
                str(extracted_dir),
                manifest.thumbnail,
                timestamp,
                timestamp,
            ),
        )

    return manifest, existing is None


def update_imported_game_status(game_id: str, version: str, status: str) -> GameManifest | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT manifest_json, thumbnail_url FROM imported_games WHERE game_id = ? AND version = ?",
            (game_id, version),
        ).fetchone()
        if row is None:
            return None

        manifest_payload = json.loads(row["manifest_json"])
        manifest_payload["status"] = status
        manifest_payload["thumbnail"] = row["thumbnail_url"]
        manifest_payload["source"] = "imported"
        manifest = GameManifest(**manifest_payload)

        connection.execute(
            "UPDATE imported_games SET status = ?, updated_at = ? WHERE game_id = ? AND version = ?",
            (status, time.time(), game_id, version),
        )

    return manifest


def _generate_room_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


def create_room(game_id: str) -> Room:
    code = _generate_room_code()
    while get_room(code) is not None:
        code = _generate_room_code()

    room = Room(code=code, game_id=game_id, created_at=time.time())
    with get_connection() as connection:
        connection.execute(
            "INSERT INTO rooms (code, game_id, status, players_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (room.code, room.game_id, room.status, json.dumps(room.players), room.created_at),
        )
    return room


def _room_from_row(row: sqlite3.Row) -> Room:
    return Room(
        code=row["code"],
        game_id=row["game_id"],
        status=row["status"],
        players=json.loads(row["players_json"]),
        created_at=row["created_at"],
    )


def get_room(code: str) -> Room | None:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM rooms WHERE code = ?", (code,)).fetchone()
    if row is None:
        return None
    return _room_from_row(row)


def list_rooms() -> list[Room]:
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM rooms ORDER BY created_at DESC").fetchall()
    return [_room_from_row(row) for row in rows]


def save_room(room: Room) -> Room:
    with get_connection() as connection:
        connection.execute(
            "UPDATE rooms SET status = ?, players_json = ? WHERE code = ?",
            (room.status, json.dumps(room.players), room.code),
        )
    return room
