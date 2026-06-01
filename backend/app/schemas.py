from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class GameBase(BaseModel):
    slug: str
    title: str
    version: str
    description: Optional[str] = None
    author: Optional[str] = None
    grade: Optional[str] = None
    subject: Optional[str] = None
    thumbnail: Optional[str] = None
    entry_url: str


class GameCreate(GameBase):
    extracted_path: str
    package_path: str


class GameResponse(GameBase):
    id: int
    extracted_path: str
    package_path: str
    imported_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ImportResult(BaseModel):
    game: GameResponse
    replaced: bool  # True if a previous version was removed before this import
    message: str
