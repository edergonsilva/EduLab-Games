from datetime import datetime

from sqlalchemy import String, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Game(Base):
    """Represents a game imported from a .edugame package."""

    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Stable identifier derived from manifest.json (e.g. "edulab-matematica-cdu-2ano")
    slug: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)

    # Human-readable title from manifest
    title: Mapped[str] = mapped_column(String, nullable=False)

    # Semantic version string from manifest (e.g. "1.0.0")
    version: Mapped[str] = mapped_column(String, nullable=False)

    # Optional metadata from manifest
    description: Mapped[str] = mapped_column(String, nullable=True)
    author: Mapped[str] = mapped_column(String, nullable=True)
    grade: Mapped[str] = mapped_column(String, nullable=True)
    subject: Mapped[str] = mapped_column(String, nullable=True)
    thumbnail: Mapped[str] = mapped_column(String, nullable=True)

    # Relative URL path to the game's index.html, e.g. /static/imported/{slug}/{version}/
    entry_url: Mapped[str] = mapped_column(String, nullable=False)

    # Filesystem path (relative to repo root) where the game was extracted
    extracted_path: Mapped[str] = mapped_column(String, nullable=False)

    # Filesystem path (relative to repo root) of the original .edugame package file
    package_path: Mapped[str] = mapped_column(String, nullable=False)

    imported_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
