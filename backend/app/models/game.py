from pydantic import BaseModel
from typing import List, Optional


class GameManifest(BaseModel):
    id: str
    name: str
    version: str
    developer: str
    credits: str
    school_grades: List[int]
    subject: Optional[str] = None
    tags: List[str] = []
    mode: List[str]
    min_players: int = 1
    max_players: int = 1
    session_required: bool = False
    supports_teacher_panel: bool = False
    supports_ranking: bool = False
    estimated_duration_minutes: int = 10
    entry_point: Optional[str] = None
    thumbnail: Optional[str] = None
    description: Optional[str] = None
    status: str = "test"
    api_version: str = "1.0"
