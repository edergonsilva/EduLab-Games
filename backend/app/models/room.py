from typing import List, Literal, Optional
import time

from pydantic import BaseModel, Field


class Room(BaseModel):
    id: str
    code: str
    name: str
    grade: Optional[int] = None
    subject: Optional[str] = None
    selected_game_id: Optional[str] = None
    current_activity_id: Optional[str] = None
    status: Literal["waiting", "active", "finished"] = "waiting"
    players: List[str] = Field(default_factory=list)
    created_at: float = 0.0
    updated_at: float = 0.0
    started_at: Optional[float] = None
    finished_at: Optional[float] = None

    def model_post_init(self, __context) -> None:
        now = time.time()
        if self.created_at == 0.0:
            self.created_at = now
        if self.updated_at == 0.0:
            self.updated_at = now


class CreateRoomRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=120)
    grade: Optional[int] = None
    subject: Optional[str] = None
    game_id: Optional[str] = None


class JoinRoomRequest(BaseModel):
    player_name: str


class UpdateRoomRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=120)
    grade: Optional[int] = None
    subject: Optional[str] = None
    game_id: Optional[str] = None


class StartRoomRequest(BaseModel):
    game_id: Optional[str] = None
