import json
import secrets
import sqlite3
import string
import time
from contextlib import contextmanager
from pathlib import Path
import shutil
import zipfile
from uuid import uuid4

from app.config import settings
from app.models.activity import Activity, ActivityEvent
from app.models.game import GameManifest
from app.models.participant import Participant
from app.models.room import Room


STATIC_DIR = settings.storage_dir / "static"
IMPORTED_STATIC_DIR = STATIC_DIR / "imported"
PACKAGES_DIR = settings.storage_dir / "packages"
SEED_GAMES_PATH = settings.data_dir / "games.json"
SEED_GAMES_SOURCE_DIR = settings.data_dir / "seed_games"
SEED_GAMES_STATIC_DIR = STATIC_DIR / "games"
ACTIVITY_ID_PREFIX = "activity_"
ACTIVITY_EVENT_ID_PREFIX = "event_"
PARTICIPANT_ID_PREFIX = "participant_"
MAX_PARTICIPANT_DISPLAY_NAME_LENGTH = 60


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


def _sync_seed_games_to_static() -> None:
    """Copy/sync seed game HTML files from data dir to the served static dir."""
    if not SEED_GAMES_SOURCE_DIR.exists():
        return
    SEED_GAMES_STATIC_DIR.mkdir(parents=True, exist_ok=True)
    for game_dir in SEED_GAMES_SOURCE_DIR.iterdir():
        if game_dir.is_dir():
            target = SEED_GAMES_STATIC_DIR / game_dir.name
            target.mkdir(parents=True, exist_ok=True)
            shutil.copytree(game_dir, target, dirs_exist_ok=True)


def initialize_storage() -> None:
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    IMPORTED_STATIC_DIR.mkdir(parents=True, exist_ok=True)
    PACKAGES_DIR.mkdir(parents=True, exist_ok=True)
    _sync_seed_games_to_static()

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
                id TEXT NOT NULL,
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                grade INTEGER,
                subject TEXT,
                selected_game_id TEXT,
                status TEXT NOT NULL,
                players_json TEXT NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                started_at REAL,
                finished_at REAL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS activities (
                id TEXT PRIMARY KEY,
                room_id TEXT,
                room_code TEXT,
                game_id TEXT NOT NULL,
                origin TEXT NOT NULL,
                status TEXT NOT NULL,
                title TEXT,
                grade INTEGER,
                subject TEXT,
                created_at REAL NOT NULL,
                started_at REAL,
                finished_at REAL,
                updated_at REAL NOT NULL,
                last_event_at REAL,
                event_count INTEGER NOT NULL DEFAULT 0,
                game_started INTEGER NOT NULL DEFAULT 0,
                game_finished INTEGER NOT NULL DEFAULT 0,
                last_score REAL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS activity_events (
                id TEXT PRIMARY KEY,
                activity_id TEXT NOT NULL,
                room_id TEXT,
                room_code TEXT,
                game_id TEXT NOT NULL,
                participant_id TEXT,
                participant_display_name TEXT,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS participants (
                id TEXT PRIMARY KEY,
                room_id TEXT,
                room_code TEXT,
                activity_id TEXT,
                display_name TEXT NOT NULL,
                source TEXT NOT NULL,
                status TEXT NOT NULL,
                joined_at REAL NOT NULL,
                last_seen_at REAL NOT NULL,
                started_at REAL,
                finished_at REAL,
                last_score REAL,
                roster_student_id TEXT,
                roster_match_status TEXT NOT NULL DEFAULT 'unmatched'
            )
            """
        )
        _ensure_rooms_schema(connection)
        _ensure_activities_schema(connection)
        _ensure_activity_events_schema(connection)
        _ensure_participants_schema(connection)


def _ensure_rooms_schema(connection: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(rooms)").fetchall()
    }
    alter_statements = {
        "id": "ALTER TABLE rooms ADD COLUMN id TEXT",
        "name": "ALTER TABLE rooms ADD COLUMN name TEXT",
        "grade": "ALTER TABLE rooms ADD COLUMN grade INTEGER",
        "subject": "ALTER TABLE rooms ADD COLUMN subject TEXT",
        "selected_game_id": "ALTER TABLE rooms ADD COLUMN selected_game_id TEXT",
        "current_activity_id": "ALTER TABLE rooms ADD COLUMN current_activity_id TEXT",
        "updated_at": "ALTER TABLE rooms ADD COLUMN updated_at REAL",
        "started_at": "ALTER TABLE rooms ADD COLUMN started_at REAL",
        "finished_at": "ALTER TABLE rooms ADD COLUMN finished_at REAL",
    }
    for column_name, statement in alter_statements.items():
        if column_name not in columns:
            connection.execute(statement)

    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(rooms)").fetchall()
    }
    now = time.time()
    if "id" in columns:
        connection.execute("UPDATE rooms SET id = COALESCE(id, code) WHERE id IS NULL OR id = ''")
    if "name" in columns:
        connection.execute("UPDATE rooms SET name = COALESCE(name, 'Sala ' || code) WHERE name IS NULL OR name = ''")
    if "updated_at" in columns:
        connection.execute(
            "UPDATE rooms SET updated_at = COALESCE(updated_at, created_at, ?) WHERE updated_at IS NULL OR updated_at = 0",
            (now,),
        )


def _ensure_activities_schema(connection: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(activities)").fetchall()
    }
    alter_statements = {
        "game_name": "ALTER TABLE activities ADD COLUMN game_name TEXT",
        "last_event_at": "ALTER TABLE activities ADD COLUMN last_event_at REAL",
        "event_count": "ALTER TABLE activities ADD COLUMN event_count INTEGER NOT NULL DEFAULT 0",
        "game_started": "ALTER TABLE activities ADD COLUMN game_started INTEGER NOT NULL DEFAULT 0",
        "game_finished": "ALTER TABLE activities ADD COLUMN game_finished INTEGER NOT NULL DEFAULT 0",
        "last_score": "ALTER TABLE activities ADD COLUMN last_score REAL",
    }
    for column_name, statement in alter_statements.items():
        if column_name not in columns:
            connection.execute(statement)


def _ensure_activity_events_schema(connection: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(activity_events)").fetchall()
    }
    alter_statements = {
        "participant_id": "ALTER TABLE activity_events ADD COLUMN participant_id TEXT",
        "participant_display_name": "ALTER TABLE activity_events ADD COLUMN participant_display_name TEXT",
    }
    for column_name, statement in alter_statements.items():
        if column_name not in columns:
            connection.execute(statement)


def _ensure_participants_schema(connection: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(participants)").fetchall()
    }
    alter_statements = {
        "room_id": "ALTER TABLE participants ADD COLUMN room_id TEXT",
        "room_code": "ALTER TABLE participants ADD COLUMN room_code TEXT",
        "activity_id": "ALTER TABLE participants ADD COLUMN activity_id TEXT",
        "display_name": "ALTER TABLE participants ADD COLUMN display_name TEXT",
        "source": "ALTER TABLE participants ADD COLUMN source TEXT",
        "status": "ALTER TABLE participants ADD COLUMN status TEXT",
        "joined_at": "ALTER TABLE participants ADD COLUMN joined_at REAL",
        "last_seen_at": "ALTER TABLE participants ADD COLUMN last_seen_at REAL",
        "started_at": "ALTER TABLE participants ADD COLUMN started_at REAL",
        "finished_at": "ALTER TABLE participants ADD COLUMN finished_at REAL",
        "last_score": "ALTER TABLE participants ADD COLUMN last_score REAL",
        "roster_student_id": "ALTER TABLE participants ADD COLUMN roster_student_id TEXT",
        "roster_match_status": "ALTER TABLE participants ADD COLUMN roster_match_status TEXT",
    }
    for column_name, statement in alter_statements.items():
        if column_name not in columns:
            connection.execute(statement)

    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(participants)").fetchall()
    }
    now = time.time()
    if "display_name" in columns:
        connection.execute(
            "UPDATE participants SET display_name = COALESCE(NULLIF(display_name, ''), 'Participante')"
        )
    if "source" in columns:
        connection.execute("UPDATE participants SET source = COALESCE(NULLIF(source, ''), 'manual')")
    if "status" in columns:
        connection.execute("UPDATE participants SET status = COALESCE(NULLIF(status, ''), 'joined')")
    if "joined_at" in columns:
        connection.execute("UPDATE participants SET joined_at = COALESCE(joined_at, ?)", (now,))
    if "last_seen_at" in columns:
        connection.execute("UPDATE participants SET last_seen_at = COALESCE(last_seen_at, joined_at, ?)", (now,))
    if "roster_match_status" in columns:
        connection.execute(
            "UPDATE participants SET roster_match_status = COALESCE(NULLIF(roster_match_status, ''), 'unmatched')"
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
    games = []
    for game_data in payload:
        game = GameManifest(**game_data, source="seed")
        if game.entry_point:
            game = game.model_copy(update={
                "play_url": f"/static/games/{game.id}/{game.entry_point}"
            })
        games.append(game)
    return games


def list_imported_games() -> list[GameManifest]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT manifest_json, status, thumbnail_url, extracted_dir FROM imported_games ORDER BY updated_at DESC"
        ).fetchall()

    games: list[GameManifest] = []
    for row in rows:
        manifest_payload = json.loads(row["manifest_json"])
        manifest_payload["status"] = row["status"]
        manifest_payload["thumbnail"] = row["thumbnail_url"]
        manifest_payload["source"] = "imported"

        # Compute play_url from extracted_dir relative to STATIC_DIR
        entry_point = manifest_payload.get("entry_point")
        if entry_point and row["extracted_dir"]:
            try:
                rel = Path(row["extracted_dir"]).relative_to(STATIC_DIR)
                manifest_payload["play_url"] = f"/static/{rel.as_posix()}/{entry_point}"
            except ValueError:
                pass

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

    play_url = None
    if manifest.entry_point:
        play_url = f"/static/imported/{game_slug}/{version_slug}/{manifest.entry_point}"

    manifest = manifest.model_copy(update={
        "status": "test",
        "thumbnail": (
            f"/static/imported/{game_slug}/{version_slug}/{thumbnail_path}" if thumbnail_path else None
        ),
        "source": "imported",
        "play_url": play_url,
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


def create_room(*, name: str, grade: int | None = None, subject: str | None = None, game_id: str | None = None) -> Room:
    code = _generate_room_code()
    while get_room(code) is not None:
        code = _generate_room_code()

    room = Room(
        id=f"room_{uuid4().hex}",
        code=code,
        name=name.strip(),
        grade=grade,
        subject=subject,
        selected_game_id=game_id,
        created_at=time.time(),
    )
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO rooms (
                id, code, name, grade, subject, selected_game_id, current_activity_id, status,
                players_json, created_at, updated_at, started_at, finished_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                room.id,
                room.code,
                room.name,
                room.grade,
                room.subject,
                room.selected_game_id,
                room.current_activity_id,
                room.status,
                json.dumps(room.players),
                room.created_at,
                room.updated_at,
                room.started_at,
                room.finished_at,
            ),
        )
    return room


def _room_from_row(row: sqlite3.Row) -> Room:
    return Room(
        id=row["id"] or f"room_{row['code']}",
        code=row["code"],
        name=row["name"] or f"Sala {row['code']}",
        grade=row["grade"],
        subject=row["subject"],
        selected_game_id=row["selected_game_id"],
        current_activity_id=row["current_activity_id"] if "current_activity_id" in row else None,
        status=row["status"],
        players=json.loads(row["players_json"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"] or row["created_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
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
    room.updated_at = time.time()
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE rooms SET
                name = ?,
                grade = ?,
                subject = ?,
                selected_game_id = ?,
                current_activity_id = ?,
                status = ?,
                players_json = ?,
                updated_at = ?,
                started_at = ?,
                finished_at = ?
            WHERE code = ?
            """,
            (
                room.name,
                room.grade,
                room.subject,
                room.selected_game_id,
                room.current_activity_id,
                room.status,
                json.dumps(room.players),
                room.updated_at,
                room.started_at,
                room.finished_at,
                room.code,
            ),
        )
    return room


def _participant_from_row(row: sqlite3.Row) -> Participant:
    return Participant(
        id=row["id"],
        room_id=row["room_id"],
        room_code=row["room_code"],
        activity_id=row["activity_id"],
        display_name=row["display_name"] or "Participante",
        source=row["source"] or "manual",
        status=row["status"] or "joined",
        joined_at=row["joined_at"],
        last_seen_at=row["last_seen_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        last_score=row["last_score"],
        roster_student_id=row["roster_student_id"] if "roster_student_id" in row.keys() else None,
        roster_match_status=row["roster_match_status"] if "roster_match_status" in row.keys() else "unmatched",
    )


def _normalize_participant_display_name(display_name: str | None) -> tuple[str, str]:
    normalized = (display_name or "").strip()
    if normalized:
        return normalized[:MAX_PARTICIPANT_DISPLAY_NAME_LENGTH], "manual"
    return f"Anônimo-{secrets.token_hex(2)}", "anonymous"


def list_participants(
    *,
    room_code: str | None = None,
    activity_id: str | None = None,
    limit: int = 200,
) -> list[Participant]:
    where_clauses: list[str] = []
    params: list[str | int] = []
    if room_code:
        where_clauses.append("room_code = ?")
        params.append(room_code)
    if activity_id:
        where_clauses.append("activity_id = ?")
        params.append(activity_id)
    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT * FROM participants
            {where_sql}
            ORDER BY joined_at ASC
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()
    return [_participant_from_row(row) for row in rows]


def get_participant(participant_id: str) -> Participant | None:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM participants WHERE id = ?", (participant_id,)).fetchone()
    if row is None:
        return None
    return _participant_from_row(row)


def save_participant(participant: Participant) -> Participant:
    participant.last_seen_at = time.time()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO participants (
                id, room_id, room_code, activity_id, display_name, source, status, joined_at,
                last_seen_at, started_at, finished_at, last_score, roster_student_id, roster_match_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                room_id = excluded.room_id,
                room_code = excluded.room_code,
                activity_id = excluded.activity_id,
                display_name = excluded.display_name,
                source = excluded.source,
                status = excluded.status,
                joined_at = excluded.joined_at,
                last_seen_at = excluded.last_seen_at,
                started_at = excluded.started_at,
                finished_at = excluded.finished_at,
                last_score = excluded.last_score,
                roster_student_id = excluded.roster_student_id,
                roster_match_status = excluded.roster_match_status
            """,
            (
                participant.id,
                participant.room_id,
                participant.room_code,
                participant.activity_id,
                participant.display_name,
                participant.source,
                participant.status,
                participant.joined_at,
                participant.last_seen_at,
                participant.started_at,
                participant.finished_at,
                participant.last_score,
                participant.roster_student_id,
                participant.roster_match_status,
            ),
        )
    return participant


def create_or_update_participant(
    *,
    room: Room,
    display_name: str | None,
    source: str = "manual",
    activity_id: str | None = None,
) -> Participant:
    normalized_name, normalized_source = _normalize_participant_display_name(display_name)
    resolved_source = source or normalized_source
    timestamp = time.time()
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT * FROM participants
            WHERE room_code = ?
              AND display_name = ?
              AND (activity_id = ? OR (? IS NULL AND activity_id IS NULL))
            ORDER BY last_seen_at DESC
            LIMIT 1
            """,
            (room.code, normalized_name, activity_id, activity_id),
        ).fetchone()

    if row is not None:
        participant = _participant_from_row(row)
        participant.last_seen_at = timestamp
        participant.status = "joined" if participant.status == "left" else participant.status
        participant.source = resolved_source if participant.source == "anonymous" else participant.source
        if activity_id and not participant.activity_id:
            participant.activity_id = activity_id
        return save_participant(participant)

    participant = Participant(
        id=f"{PARTICIPANT_ID_PREFIX}{uuid4().hex}",
        room_id=room.id,
        room_code=room.code,
        activity_id=activity_id,
        display_name=normalized_name,
        source=resolved_source,
        status="joined",
        joined_at=timestamp,
        last_seen_at=timestamp,
    )
    return save_participant(participant)


def attach_room_participants_to_activity(room_code: str, activity_id: str) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE participants
            SET activity_id = ?,
                status = CASE WHEN status = 'left' THEN status ELSE 'joined' END
            WHERE room_code = ?
              AND activity_id IS NULL
            """,
            (activity_id, room_code),
        )


def update_participant_progress(
    participant_id: str,
    *,
    activity_id: str | None,
    event_type: str,
    payload: dict | None = None,
    fallback_display_name: str | None = None,
    fallback_source: str | None = None,
) -> Participant | None:
    participant = get_participant(participant_id)
    timestamp = time.time()
    if participant is None:
        if not activity_id:
            return None
        activity = get_activity(activity_id)
        if activity is None:
            return None
        normalized_name, normalized_source = _normalize_participant_display_name(fallback_display_name)
        participant = Participant(
            id=participant_id,
            room_id=activity.room_id,
            room_code=activity.room_code,
            activity_id=activity_id,
            display_name=normalized_name,
            source=fallback_source or normalized_source or "runner-event",
            status="joined",
            joined_at=timestamp,
            last_seen_at=timestamp,
        )

    if activity_id and not participant.activity_id:
        participant.activity_id = activity_id
    participant.last_seen_at = timestamp
    if fallback_display_name and participant.display_name.startswith("Anônimo-"):
        participant.display_name = fallback_display_name.strip()[:MAX_PARTICIPANT_DISPLAY_NAME_LENGTH]
    if fallback_source:
        participant.source = fallback_source

    payload = payload or {}
    if event_type in {"game_started", "question_answered", "score_updated", "game_finished"}:
        participant.status = "active"
        if participant.started_at is None:
            participant.started_at = timestamp

    score = payload.get("score")
    if isinstance(score, (int, float)):
        participant.last_score = float(score)

    if event_type == "game_finished":
        participant.status = "finished"
        participant.finished_at = timestamp

    return save_participant(participant)


def _activity_from_row(row: sqlite3.Row) -> Activity:
    game_name = row["game_name"] if "game_name" in row else None
    return Activity(
        id=row["id"],
        room_id=row["room_id"],
        room_code=row["room_code"],
        game_id=row["game_id"],
        game_name=game_name,
        origin=row["origin"],
        status=row["status"],
        title=row["title"],
        grade=row["grade"],
        subject=row["subject"],
        created_at=row["created_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        updated_at=row["updated_at"],
        last_event_at=row["last_event_at"] if "last_event_at" in row else None,
        event_count=row["event_count"] if "event_count" in row else 0,
        game_started=bool(row["game_started"]) if "game_started" in row else False,
        game_finished=bool(row["game_finished"]) if "game_finished" in row else False,
        last_score=row["last_score"] if "last_score" in row else None,
    )


def _activity_event_from_row(row: sqlite3.Row) -> ActivityEvent:
    return ActivityEvent(
        id=row["id"],
        activity_id=row["activity_id"],
        room_id=row["room_id"],
        room_code=row["room_code"],
        game_id=row["game_id"],
        participant_id=row["participant_id"] if "participant_id" in row.keys() else None,
        participant_display_name=row["participant_display_name"] if "participant_display_name" in row.keys() else None,
        event_type=row["event_type"],
        payload=json.loads(row["payload_json"]),
        created_at=row["created_at"],
    )


def create_activity(
    *,
    game_id: str,
    origin: str,
    room_id: str | None = None,
    room_code: str | None = None,
    title: str | None = None,
    grade: int | None = None,
    subject: str | None = None,
    status: str = "created",
    started_at: float | None = None,
    finished_at: float | None = None,
) -> Activity:
    timestamp = time.time()
    game = get_game(game_id, status=None)
    activity = Activity(
        id=f"{ACTIVITY_ID_PREFIX}{uuid4().hex}",
        room_id=room_id,
        room_code=room_code,
        game_id=game_id,
        game_name=game.name if game else None,
        origin=origin,
        status=status,
        title=title,
        grade=grade,
        subject=subject,
        created_at=timestamp,
        started_at=started_at,
        finished_at=finished_at,
        updated_at=timestamp,
    )
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO activities (
                id, room_id, room_code, game_id, game_name, origin, status, title, grade, subject,
                created_at, started_at, finished_at, updated_at, last_event_at, event_count,
                game_started, game_finished, last_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                activity.id,
                activity.room_id,
                activity.room_code,
                activity.game_id,
                activity.game_name,
                activity.origin,
                activity.status,
                activity.title,
                activity.grade,
                activity.subject,
                activity.created_at,
                activity.started_at,
                activity.finished_at,
                activity.updated_at,
                activity.last_event_at,
                activity.event_count,
                int(activity.game_started),
                int(activity.game_finished),
                activity.last_score,
            ),
        )
    return activity


def get_activity(activity_id: str) -> Activity | None:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
    if row is None:
        return None
    return _activity_from_row(row)


def get_room_current_activity(room_code: str) -> Activity | None:
    room = get_room(room_code)
    if room is None or not room.current_activity_id:
        return None
    return get_activity(room.current_activity_id)


def list_activities(limit: int = 30) -> list[Activity]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM activities ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [_activity_from_row(row) for row in rows]


def list_activity_events(activity_id: str, limit: int = 25) -> list[ActivityEvent]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM activity_events
            WHERE activity_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (activity_id, limit),
        ).fetchall()
    return [_activity_event_from_row(row) for row in rows]


def list_activity_participants(activity_id: str, limit: int = 200) -> list[Participant]:
    return list_participants(activity_id=activity_id, limit=limit)


def save_activity(activity: Activity) -> Activity:
    activity.updated_at = time.time()
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE activities SET
                room_id = ?,
                room_code = ?,
                game_id = ?,
                game_name = ?,
                origin = ?,
                status = ?,
                title = ?,
                grade = ?,
                subject = ?,
                started_at = ?,
                finished_at = ?,
                updated_at = ?,
                last_event_at = ?,
                event_count = ?,
                game_started = ?,
                game_finished = ?,
                last_score = ?
            WHERE id = ?
            """,
            (
                activity.room_id,
                activity.room_code,
                activity.game_id,
                activity.game_name,
                activity.origin,
                activity.status,
                activity.title,
                activity.grade,
                activity.subject,
                activity.started_at,
                activity.finished_at,
                activity.updated_at,
                activity.last_event_at,
                activity.event_count,
                int(activity.game_started),
                int(activity.game_finished),
                activity.last_score,
                activity.id,
            ),
        )
    return activity


def ensure_activity(
    *,
    activity_id: str | None,
    game_id: str,
    origin: str,
    room_id: str | None = None,
    room_code: str | None = None,
    title: str | None = None,
    grade: int | None = None,
    subject: str | None = None,
) -> Activity:
    if activity_id:
        existing = get_activity(activity_id)
        if existing is not None:
            return existing

    if origin == "room" and room_code:
        room = get_room(room_code)
        if room is not None and room.current_activity_id:
            existing = get_activity(room.current_activity_id)
            if existing is not None:
                attach_room_participants_to_activity(room.code, existing.id)
                return existing
        status = "active" if room and room.status == "active" else "waiting"
        activity = create_activity(
            game_id=game_id,
            origin=origin,
            room_id=room.id if room else room_id,
            room_code=room.code if room else room_code,
            title=title or (room.name if room else None),
            grade=room.grade if room else grade,
            subject=room.subject if room else subject,
            status=status,
            started_at=room.started_at if room and room.status == "active" else None,
            finished_at=room.finished_at if room and room.status == "finished" else None,
        )
        if room is not None:
            room.current_activity_id = activity.id
            save_room(room)
            attach_room_participants_to_activity(room.code, activity.id)
        return activity

    return create_activity(
        game_id=game_id,
        origin=origin,
        room_id=room_id,
        room_code=room_code,
        title=title,
        grade=grade,
        subject=subject,
        status="created",
    )


def finish_activity(activity_id: str, *, status: str = "finished", finished_at: float | None = None) -> Activity | None:
    activity = get_activity(activity_id)
    if activity is None:
        return None
    activity.status = status
    activity.finished_at = finished_at if finished_at is not None else time.time()
    activity.game_finished = activity.game_finished or status == "finished"
    return save_activity(activity)


def record_activity_event(
    activity_id: str,
    *,
    event_type: str,
    payload: dict | None = None,
    participant_id: str | None = None,
    display_name: str | None = None,
    source: str | None = None,
) -> Activity | None:
    activity = get_activity(activity_id)
    if activity is None:
        return None

    timestamp = time.time()
    participant = None
    if participant_id:
        participant = update_participant_progress(
            participant_id,
            activity_id=activity.id,
            event_type=event_type,
            payload=payload,
            fallback_display_name=display_name,
            fallback_source=source,
        )
    event = ActivityEvent(
        id=f"{ACTIVITY_EVENT_ID_PREFIX}{uuid4().hex}",
        activity_id=activity.id,
        room_id=activity.room_id,
        room_code=activity.room_code,
        game_id=activity.game_id,
        participant_id=participant.id if participant else participant_id,
        participant_display_name=participant.display_name if participant else display_name,
        event_type=event_type,
        payload=payload or {},
        created_at=timestamp,
    )

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO activity_events (
                id, activity_id, room_id, room_code, game_id, participant_id, participant_display_name,
                event_type, payload_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.id,
                event.activity_id,
                event.room_id,
                event.room_code,
                event.game_id,
                event.participant_id,
                event.participant_display_name,
                event.event_type,
                json.dumps(event.payload),
                event.created_at,
            ),
        )

    activity.event_count += 1
    activity.last_event_at = timestamp
    if event_type == "game_started":
        activity.game_started = True
        activity.status = "active"
        if activity.started_at is None:
            activity.started_at = timestamp
    elif event_type in {"question_answered", "score_updated", "game_finished"}:
        score = event.payload.get("score")
        if isinstance(score, (int, float)):
            activity.last_score = float(score)
        if activity.status == "created":
            activity.status = "active"
            activity.started_at = activity.started_at or timestamp
        if event_type != "game_finished":
            return save_activity(activity)

    if event_type == "game_finished":
        activity.game_finished = True
        activity.status = "finished"
        activity.finished_at = activity.finished_at or timestamp

    return save_activity(activity)
