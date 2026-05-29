from typing import List, Optional, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class GameManifest(BaseModel):
    id: str
    name: str
    version: str
    developer: str
    credits: str
    school_grades: List[int]
    subject: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
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
    source: Literal["seed", "imported"] = "seed"

    @field_validator("thumbnail", mode="before")
    @classmethod
    def normalize_thumbnail(cls, value: Optional[str]):
        return value or None

    @model_validator(mode="after")
    def normalize_catalog_flags(self):
        has_room_mode = "sala_codigo" in self.mode
        has_direct_mode = any(mode != "sala_codigo" for mode in self.mode)

        if not has_room_mode:
            self.session_required = False
        elif not has_direct_mode:
            self.session_required = True

        return self
