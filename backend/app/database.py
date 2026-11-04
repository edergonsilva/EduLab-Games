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
