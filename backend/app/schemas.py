from datetime import datetime
from typing import Any, Optional

import json

from pydantic import BaseModel, Field, field_validator, model_validator


class GameBase(BaseModel):
    teacher_id: int | None = None
    is_public: bool = False
    slug: str
    title: str
    version: str
    description: Optional[str] = None
    author: Optional[str] = None
    grade: Optional[str] = None
    subject: Optional[str] = None
    thumbnail: Optional[str] = None
    entry_url: str


class TeacherRegister(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=256)
    school_name: str | None = Field(default=None, max_length=160)


class TeacherLogin(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class TeacherResponse(BaseModel):
    id: int
    name: str
    email: str
    school_name: str | None = None

    model_config = {"from_attributes": True}


class GameCreate(GameBase):
    extracted_path: str
    package_path: str


class GameMetadataUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    grade: str | None = Field(default=None, max_length=100)
    subject: str | None = Field(default=None, max_length=100)
    is_public: bool | None = None


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
    game_slug: Optional[str] = None
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
    connection_status: str = "disconnected"
    last_score: Optional[float] = None
    progress_current: Optional[float] = None
    progress_total: Optional[float] = None
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


class ProgressPayload(BaseModel):
    current: float = Field(ge=0, le=1_000_000_000)
    total: float = Field(gt=0, le=1_000_000_000)

    @model_validator(mode="after")
    def current_must_not_exceed_total(self):
        if self.current > self.total:
            raise ValueError("O progresso atual não pode exceder o total.")
        return self


class RoomResponse(BaseModel):
    id: int
    code: str
    name: str
    game_slug: Optional[str] = None
    status: str
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    current_activity: Optional[ActivityResponse] = None
    participant_summary: Optional[dict[str, int]] = None

    model_config = {"from_attributes": True}


class RoomCreate(BaseModel):
    name: str
    game_slug: str


class ActivityStartRequest(BaseModel):
    game_slug: str | None = None


class JoinRoomRequest(BaseModel):
    display_name: str | None = None
    source: str | None = None


class JoinRoomResponse(BaseModel):
    room: RoomResponse
    activity: ActivityResponse
    participant: ParticipantResponse
    game: GameResponse | None = None
    runner_url: str | None = None
    message: str


class ActivityEventCreate(BaseModel):
    event_type: str = Field(min_length=1, max_length=40)
    score: float | None = Field(default=None, ge=0, le=1_000_000_000)
    progress: ProgressPayload | None = None
    payload: dict[str, Any] | None = None

    @field_validator("payload")
    @classmethod
    def payload_must_be_small(cls, value: dict[str, Any] | None):
        if value is not None and len(json.dumps(value, ensure_ascii=False)) > 8192:
            raise ValueError("O evento excede o tamanho permitido.")
        return value


class RoomDashboardResponse(BaseModel):
    room: RoomResponse
    activity: Optional[ActivityResponse] = None
    game: Optional[GameResponse] = None
    participants: list[ParticipantResponse] = Field(default_factory=list)
    recent_events: list[ActivityEventResponse] = Field(default_factory=list)
    participant_summary: dict[str, int] = Field(default_factory=dict)


class RoomHistoryActivity(BaseModel):
    activity: ActivityResponse
    game: GameResponse | None = None
    participants: list[ParticipantResponse] = Field(default_factory=list)
    events: list[ActivityEventResponse] = Field(default_factory=list)


class RoomHistoryResponse(BaseModel):
    room: RoomResponse
    activities: list[RoomHistoryActivity] = Field(default_factory=list)


class RunnerContextResponse(BaseModel):
    schema_version: str
    room: RoomResponse
    activity: ActivityResponse
    participant: ParticipantResponse
    game: GameResponse
    context: dict[str, Any]
