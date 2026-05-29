from typing import Any, Literal, Optional
import time

from pydantic import BaseModel, Field


class Activity(BaseModel):
    id: str
    room_id: Optional[str] = None
    room_code: Optional[str] = None
    game_id: str
    game_name: Optional[str] = None
    origin: Literal["solo", "room", "admin-test"]
    status: Literal["created", "waiting", "active", "finished", "aborted"] = "created"
    title: Optional[str] = None
    grade: Optional[int] = None
    subject: Optional[str] = None
    created_at: float = 0.0
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    updated_at: float = 0.0
    last_event_at: Optional[float] = None
    event_count: int = 0
    game_started: bool = False
    game_finished: bool = False
    last_score: Optional[float] = None

    def model_post_init(self, __context) -> None:
        now = time.time()
        if self.created_at == 0.0:
            self.created_at = now
        if self.updated_at == 0.0:
            self.updated_at = now


class ActivityEvent(BaseModel):
    id: str
    activity_id: str
    room_id: Optional[str] = None
    room_code: Optional[str] = None
    game_id: str
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: float = 0.0

    def model_post_init(self, __context) -> None:
        if self.created_at == 0.0:
            self.created_at = time.time()


class EnsureActivityRequest(BaseModel):
    activity_id: Optional[str] = None
    room_id: Optional[str] = None
    room_code: Optional[str] = None
    game_id: str
    origin: Literal["solo", "room", "admin-test"] = "solo"
    title: Optional[str] = None
    grade: Optional[int] = None
    subject: Optional[str] = None


class RecordActivityEventRequest(BaseModel):
    event_type: Literal["game_started", "question_answered", "score_updated", "game_finished", "pause", "runner_opened"]
    payload: dict[str, Any] = Field(default_factory=dict)


class ActivityDetail(Activity):
    recent_events: list[ActivityEvent] = Field(default_factory=list)
