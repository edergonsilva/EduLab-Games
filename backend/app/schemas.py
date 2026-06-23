from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


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
    replaced: bool
    message: str


class ActivityResponse(BaseModel):
    id: int
    room_id: int
    game_slug: str
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ParticipantResponse(BaseModel):
    id: int
    room_id: int
    activity_id: int
    display_name: str
    source: str
    status: str
    last_score: Optional[float] = None
    joined_at: datetime
    last_seen_at: datetime
    finished_at: Optional[datetime] = None
    roster_student_id: Optional[str] = None
    roster_match_status: Optional[str] = None

    model_config = {"from_attributes": True}


class ActivityEventResponse(BaseModel):
    id: int
    room_id: int
    activity_id: int
    participant_id: Optional[int] = None
    event_type: str
    score: Optional[float] = None
    status: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class RoomResponse(BaseModel):
    id: int
    code: str
    name: str
    game_slug: Optional[str] = None
    status: str
    created_at: datetime
    current_activity: Optional[ActivityResponse] = None
    participant_summary: Optional[dict[str, int]] = None

    model_config = {"from_attributes": True}


class RoomCreate(BaseModel):
    name: str
    game_slug: str | None = None


class ActivityStartRequest(BaseModel):
    game_slug: str | None = None


class JoinRoomRequest(BaseModel):
    display_name: str | None = None
    source: str | None = None


class JoinRoomResponse(BaseModel):
    room: RoomResponse
    activity: ActivityResponse
    participant: ParticipantResponse
    game: GameResponse
    runner_url: str
    message: str


class ActivityEventCreate(BaseModel):
    participant_id: int | None = None
    display_name: str | None = None
    event_type: str
    score: float | None = None
    status: str | None = None
    payload: dict[str, Any] | None = None


class RoomDashboardResponse(BaseModel):
    room: RoomResponse
    activity: Optional[ActivityResponse] = None
    game: Optional[GameResponse] = None
    participants: list[ParticipantResponse] = Field(default_factory=list)
    recent_events: list[ActivityEventResponse] = Field(default_factory=list)
    participant_summary: dict[str, int] = Field(default_factory=dict)


class RunnerContextResponse(BaseModel):
    schema_version: str
    room: RoomResponse
    activity: ActivityResponse
    participant: ParticipantResponse
    game: GameResponse
    context: dict[str, Any]
