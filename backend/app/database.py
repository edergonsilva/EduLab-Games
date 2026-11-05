from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import DATABASE_URL

# Ensure the data directory exists before SQLite tries to create the file
_db_path = DATABASE_URL.replace("sqlite:///", "")
Path(_db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_schema():
    """Apply small additive migrations for existing SQLite installations."""
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as connection:
        for table_name in ("rooms", "games"):
            columns = {
                row[1]
                for row in connection.exec_driver_sql(f"PRAGMA table_info({table_name})")
            }
            if "teacher_id" not in columns:
                connection.exec_driver_sql(
                    f"ALTER TABLE {table_name} ADD COLUMN teacher_id INTEGER REFERENCES teachers(id)"
                )
            if table_name == "games" and "is_public" not in columns:
                connection.exec_driver_sql(
                    "ALTER TABLE games ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT 1"
                )
            if table_name == "rooms":
                if "started_at" not in columns:
                    connection.exec_driver_sql("ALTER TABLE rooms ADD COLUMN started_at DATETIME")
                if "finished_at" not in columns:
                    connection.exec_driver_sql("ALTER TABLE rooms ADD COLUMN finished_at DATETIME")

        activity_columns = {
            row[1]: row
            for row in connection.exec_driver_sql("PRAGMA table_info(activities)")
        }
        game_slug_column = activity_columns.get("game_slug")
        if game_slug_column and game_slug_column[3]:
            connection.exec_driver_sql(
                "CREATE TABLE activities_new ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "room_id INTEGER NOT NULL REFERENCES rooms(id), "
                "game_slug VARCHAR, "
                "status VARCHAR NOT NULL, "
                "started_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, "
                "ended_at DATETIME)"
            )
            connection.exec_driver_sql(
                "INSERT INTO activities_new (id, room_id, game_slug, status, started_at, ended_at) "
                "SELECT id, room_id, game_slug, status, started_at, ended_at FROM activities"
            )
            connection.exec_driver_sql("DROP TABLE activities")
            connection.exec_driver_sql("ALTER TABLE activities_new RENAME TO activities")
            connection.exec_driver_sql("CREATE INDEX ix_activities_id ON activities (id)")
            connection.exec_driver_sql(
                "CREATE INDEX ix_activities_room_id ON activities (room_id)"
            )

        connection.exec_driver_sql(
            "UPDATE activities SET status = 'waiting' WHERE status = 'lobby'"
        )
        participant_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(participants)")
        }
        if "status" in participant_columns:
            connection.exec_driver_sql(
                "UPDATE participants SET status = CASE status "
                "WHEN 'joined' THEN 'waiting' WHEN 'active' THEN 'playing' "
                "WHEN 'finished' THEN 'completed' WHEN 'left' THEN 'disconnected' "
                "ELSE status END"
            )
            if "connection_status" not in participant_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE participants ADD COLUMN connection_status "
                    "VARCHAR NOT NULL DEFAULT 'connected'"
                )
            if "progress_current" not in participant_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE participants ADD COLUMN progress_current FLOAT"
                )
            if "progress_total" not in participant_columns:
                connection.exec_driver_sql(
                    "ALTER TABLE participants ADD COLUMN progress_total FLOAT"
                )
            connection.exec_driver_sql(
                "UPDATE participants SET connection_status = 'disconnected'"
            )
