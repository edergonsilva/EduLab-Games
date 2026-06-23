"""Room and activity management router."""

import secrets
import string
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, Session

from app.database import Base, get_db

router = APIRouter(prefix="/rooms", tags=["rooms"])


# ---------------------------------------------------------------------------
# Models (defined here to keep the module self-contained)
# ---------------------------------------------------------------------------


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    game_slug: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="waiting", nullable=False)
    created_at: Mapped[str] = mapped_column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class RoomCreate(BaseModel):
    name: str
    game_slug: str | None = None


class RoomResponse(BaseModel):
    id: int
    code: str
    name: str
    game_slug: str | None
    status: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[RoomResponse])
def list_rooms(db: Session = Depends(get_db)):
    return db.query(Room).order_by(Room.id.desc()).all()


@router.post("/", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    code = _generate_code()
    room = Room(name=payload.name, game_slug=payload.game_slug, code=code)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.get("/{code}", response_model=RoomResponse)
def get_room(code: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.code == code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{code}' not found")
    return room


@router.patch("/{code}/status", response_model=RoomResponse)
def update_room_status(code: str, new_status: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.code == code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{code}' not found")
    room.status = new_status
    db.commit()
    db.refresh(room)
    return room
