from http.cookies import SimpleCookie
from datetime import UTC, datetime
from typing import Any

import socketio

from app.config import CORS_ORIGINS
from app.database import SessionLocal
from app.models import Participant, Room
from app.security import (
    PARTICIPANT_SESSION_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    get_participant_from_session_token,
    get_teacher_from_token,
)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=CORS_ORIGINS,
    logger=False,
    engineio_logger=False,
)
_participant_sids: dict[int, set[str]] = {}


def _cookie_values(environ: dict[str, Any]) -> dict[str, str]:
    raw_cookie = environ.get("HTTP_COOKIE", "")
    scope = environ.get("asgi.scope", {})
    for key, value in scope.get("headers", []):
        if key.lower() == b"cookie":
            raw_cookie = value.decode("latin-1")
            break
    cookies = SimpleCookie()
    cookies.load(raw_cookie)
    return {key: morsel.value for key, morsel in cookies.items()}


def room_channel(room_id: int) -> str:
    return f"classroom:{room_id}"


async def broadcast_room_event(room_id: int, event_name: str, payload: dict[str, Any]) -> None:
    await sio.emit(event_name, payload, room=room_channel(room_id))


@sio.event
async def connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None = None):
    cookies = _cookie_values(environ)
    db = SessionLocal()
    try:
        teacher = get_teacher_from_token(cookies.get(SESSION_COOKIE_NAME), db)
        if teacher:
            await sio.save_session(sid, {"role": "teacher", "teacher_id": teacher.id})
            return True

        participant = get_participant_from_session_token(
            cookies.get(PARTICIPANT_SESSION_COOKIE_NAME), db
        )
        if participant:
            await sio.save_session(
                sid,
                {"role": "participant", "participant_id": participant.id},
            )
            return True
        return False
    finally:
        db.close()


@sio.on("room.join")
async def join_room_channel(sid: str, payload: dict[str, Any] | None = None):
    code = str((payload or {}).get("room_code", "")).strip().upper()
    if not code:
        return {"ok": False, "error": "Código da sala inválido."}

    session = await sio.get_session(sid)
    db = SessionLocal()
    try:
        room = db.query(Room).filter(Room.code == code).first()
        if not room:
            return {"ok": False, "error": "Sala não encontrada."}

        if session.get("role") == "teacher":
            if room.teacher_id != session.get("teacher_id"):
                return {"ok": False, "error": "Você não tem acesso a esta sala."}
        elif session.get("role") == "participant":
            participant = db.get(Participant, session.get("participant_id"))
            if not participant or participant.room_id != room.id:
                return {"ok": False, "error": "Esta participação não pertence à sala."}
            if participant.connection_status != "connected":
                participant.connection_status = "connected"
                db.commit()
                await sio.emit(
                    "participant.updated",
                    {"participant_id": participant.id, "connection_status": "connected"},
                    room=room_channel(room.id),
                )
            _participant_sids.setdefault(participant.id, set()).add(sid)
        else:
            return {"ok": False, "error": "Sessão sem permissão para esta sala."}

        await sio.enter_room(sid, room_channel(room.id))
        await sio.save_session(sid, {**session, "room_id": room.id})
        return {"ok": True, "room_code": room.code, "status": room.status}
    finally:
        db.close()


@sio.on("room.leave")
async def leave_room_channel(sid: str, payload: dict[str, Any] | None = None):
    session = await sio.get_session(sid)
    room_id = session.get("room_id")
    if room_id is None:
        return {"ok": True}
    await sio.leave_room(sid, room_channel(room_id))
    await sio.save_session(sid, {key: value for key, value in session.items() if key != "room_id"})
    participant_id = session.get("participant_id")
    if participant_id is not None:
        _participant_sids.get(participant_id, set()).discard(sid)
    return {"ok": True}


@sio.event
async def disconnect(sid: str, reason: str | None = None):
    session = await sio.get_session(sid)
    participant_id = session.get("participant_id")
    if participant_id is None:
        return

    active_sids = _participant_sids.get(participant_id, set())
    active_sids.discard(sid)
    if active_sids:
        return
    _participant_sids.pop(participant_id, None)

    db = SessionLocal()
    try:
        participant = db.get(Participant, participant_id)
        if not participant or participant.connection_status == "disconnected":
            return
        participant.connection_status = "disconnected"
        participant.last_seen_at = datetime.now(UTC)
        db.commit()
        await broadcast_room_event(
            participant.room_id,
            "participant.disconnected",
            {"participant_id": participant.id, "connection_status": "disconnected"},
        )
    finally:
        db.close()