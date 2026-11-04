"""Room, activity, participant and progress management router."""

from datetime import UTC, datetime
import json
import secrets
import string
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Activity, ActivityEvent, Game, Participant, Room, Teacher
from app.security import create_game_access_token, get_current_teacher
from app.schemas import (
    ActivityEventCreate,
    ActivityEventResponse,
    ActivityResponse,
    ActivityStartRequest,
    JoinRoomRequest,
    JoinRoomResponse,
    ParticipantResponse,
    RoomCreate,
    RoomDashboardResponse,
    RoomHistoryResponse,
    RoomResponse,
    RunnerContextResponse,
)

router = APIRouter(prefix="/rooms", tags=["rooms"])


def _generate_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _get_room_or_404(code: str, db: Session) -> Room:
    room = db.query(Room).filter(Room.code == code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"A sala '{code}' não foi encontrada.")
    return room


def _get_owned_room_or_404(code: str, teacher_id: int, db: Session) -> Room:
    room = (
        db.query(Room)
        .filter(Room.code == code.upper(), Room.teacher_id == teacher_id)
        .first()
    )
    if not room:
        raise HTTPException(status_code=404, detail=f"A sala '{code}' não foi encontrada.")
    return room


def _get_owned_activity_or_404(activity_id: int, teacher_id: int, db: Session) -> Activity:
    activity = (
        db.query(Activity)
        .join(Room, Room.id == Activity.room_id)
        .filter(Activity.id == activity_id, Room.teacher_id == teacher_id)
        .first()
    )
    if not activity:
        raise HTTPException(status_code=404, detail=f"A atividade '{activity_id}' não foi encontrada.")
    return activity


def _get_latest_activity(room_id: int, db: Session) -> Activity | None:
    return (
        db.query(Activity)
        .filter(Activity.room_id == room_id)
        .order_by(Activity.started_at.desc(), Activity.id.desc())
        .first()
    )


def _get_active_activity(room_id: int, db: Session) -> Activity | None:
    return (
        db.query(Activity)
        .filter(Activity.room_id == room_id, Activity.status == "active")
        .order_by(Activity.started_at.desc(), Activity.id.desc())
        .first()
    )


def _participant_summary(participants: list[Participant]) -> dict[str, int]:
    summary = {"joined": 0, "active": 0, "finished": 0, "left": 0, "total": len(participants)}
    for participant in participants:
        summary[participant.status] = summary.get(participant.status, 0) + 1
    return summary


def _room_payload(room: Room, db: Session) -> dict[str, Any]:
    activity = _get_latest_activity(room.id, db)
    participants: list[Participant] = []
    if activity:
        participants = (
            db.query(Participant)
            .filter(Participant.activity_id == activity.id)
            .order_by(Participant.joined_at.asc(), Participant.id.asc())
            .all()
        )

    return {
        "id": room.id,
        "code": room.code,
        "name": room.name,
        "game_slug": room.game_slug,
        "status": room.status,
        "created_at": room.created_at,
        "current_activity": activity,
        "participant_summary": _participant_summary(participants),
    }


def _normalise_source(display_name: str | None, source: str | None) -> str:
    if not display_name:
        return "anonymous"
    if source and source.strip():
        return source.strip()
    return "manual"


def _resolve_game_or_404(slug: str, db: Session) -> Game:
    game = db.query(Game).filter(Game.slug == slug).first()
    if not game:
        raise HTTPException(status_code=404, detail=f"O jogo '{slug}' não foi encontrado.")
    return game


def _resolve_accessible_game_or_404(slug: str, teacher_id: int, db: Session) -> Game:
    game = db.query(Game).filter(
        Game.slug == slug,
        or_(Game.is_public.is_(True), Game.teacher_id == teacher_id),
    ).first()
    if not game:
        raise HTTPException(status_code=404, detail=f"O jogo '{slug}' não foi encontrado.")
    return game


def _resolve_participant(activity_id: int, payload: ActivityEventCreate, db: Session) -> Participant | None:
    nested_payload = payload.payload or {}
    participant_id = payload.participant_id or nested_payload.get("participant_id")
    if participant_id is not None:
        participant = (
            db.query(Participant)
            .filter(Participant.id == participant_id, Participant.activity_id == activity_id)
            .first()
        )
        if not participant:
            raise HTTPException(
                status_code=404,
                detail=f"O participante '{participant_id}' não foi encontrado nesta atividade.",
            )
        return participant

    display_name = payload.display_name or nested_payload.get("display_name")
    if display_name:
        return (
            db.query(Participant)
            .filter(
                Participant.activity_id == activity_id,
                Participant.display_name == str(display_name).strip(),
            )
            .order_by(Participant.id.desc())
            .first()
        )

    return None


def _event_payload(event: ActivityEvent) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if event.payload_json:
        payload = json.loads(event.payload_json)
    return {
        "id": event.id,
        "room_id": event.room_id,
        "activity_id": event.activity_id,
        "participant_id": event.participant_id,
        "event_type": event.event_type,
        "score": event.score,
        "status": event.status,
        "payload": payload,
        "created_at": event.created_at,
    }


@router.get("/", response_model=list[RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    rooms = db.query(Room).filter(Room.teacher_id == teacher.id).order_by(Room.id.desc()).all()
    return [_room_payload(room, db) for room in rooms]


@router.post("/", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: RoomCreate,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    if payload.game_slug:
        _resolve_accessible_game_or_404(payload.game_slug, teacher.id, db)

    code = _generate_code()
    while db.query(Room).filter(Room.code == code).first():
        code = _generate_code()

    room = Room(name=payload.name, game_slug=payload.game_slug, code=code, teacher_id=teacher.id)
    db.add(room)
    db.commit()
    db.refresh(room)
    return _room_payload(room, db)


@router.post("/{code}/activities/start", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def start_activity(
    code: str,
    payload: ActivityStartRequest,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)
    game_slug = payload.game_slug or room.game_slug
    if not game_slug:
        raise HTTPException(status_code=422, detail="Selecione um jogo antes de iniciar a atividade.")

    _resolve_accessible_game_or_404(game_slug, teacher.id, db)

    current = _get_active_activity(room.id, db)
    now = datetime.now(UTC)
    if current:
        current.status = "finished"
        current.ended_at = now

    activity = Activity(room_id=room.id, game_slug=game_slug, status="active")
    room.game_slug = game_slug
    room.status = "active"
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.post("/activities/{activity_id}/finish", response_model=ActivityResponse)
def finish_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    activity = _get_owned_activity_or_404(activity_id, teacher.id, db)

    activity.status = "finished"
    activity.ended_at = datetime.now(UTC)
    room = db.query(Room).filter(Room.id == activity.room_id).first()
    if room:
        room.status = "waiting"
    db.commit()
    db.refresh(activity)
    return activity


@router.get("/{code}/dashboard", response_model=RoomDashboardResponse)
def get_room_dashboard(
    code: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)
    activity = _get_latest_activity(room.id, db)
    game = None
    participants: list[Participant] = []
    recent_events: list[dict[str, Any]] = []
    if activity:
        participants = (
            db.query(Participant)
            .filter(Participant.activity_id == activity.id)
            .order_by(Participant.joined_at.asc(), Participant.id.asc())
            .all()
        )
        recent_events = [
            _event_payload(event)
            for event in (
                db.query(ActivityEvent)
                .filter(ActivityEvent.activity_id == activity.id)
                .order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
                .limit(20)
                .all()
            )
        ]
        game = db.query(Game).filter(Game.slug == activity.game_slug).first()

    return {
        "room": _room_payload(room, db),
        "activity": activity,
        "game": game,
        "participants": participants,
        "recent_events": recent_events,
        "participant_summary": _participant_summary(participants),
    }


@router.get("/{code}/history", response_model=RoomHistoryResponse)
def get_room_history(
    code: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)
    activities = (
        db.query(Activity)
        .filter(Activity.room_id == room.id)
        .order_by(Activity.started_at.desc(), Activity.id.desc())
        .all()
    )
    history = []
    for activity in activities:
        participants = (
            db.query(Participant)
            .filter(Participant.activity_id == activity.id)
            .order_by(Participant.joined_at.asc(), Participant.id.asc())
            .all()
        )
        events = (
            db.query(ActivityEvent)
            .filter(ActivityEvent.activity_id == activity.id)
            .order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
            .all()
        )
        history.append({
            "activity": activity,
            "game": db.query(Game).filter(Game.slug == activity.game_slug).first(),
            "participants": participants,
            "events": [_event_payload(event) for event in events],
        })

    return {"room": _room_payload(room, db), "activities": history}


@router.get("/activities/{activity_id}/participants", response_model=list[ParticipantResponse])
def list_activity_participants(
    activity_id: int,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    _get_owned_activity_or_404(activity_id, teacher.id, db)
    return (
        db.query(Participant)
        .filter(Participant.activity_id == activity_id)
        .order_by(Participant.joined_at.asc(), Participant.id.asc())
        .all()
    )


@router.post("/{code}/join", response_model=JoinRoomResponse, status_code=status.HTTP_201_CREATED)
def join_room(code: str, payload: JoinRoomRequest, db: Session = Depends(get_db)):
    room = _get_room_or_404(code, db)
    activity = _get_active_activity(room.id, db)
    if not activity:
        raise HTTPException(
            status_code=409,
            detail="Esta sala não tem uma atividade em andamento. Peça ao professor para iniciar uma.",
        )

    game = _resolve_game_or_404(activity.game_slug, db)
    display_name = (payload.display_name or "").strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="Informe seu nome ou apelido para entrar na sala.")

    existing_participant = (
        db.query(Participant)
        .filter(
            Participant.activity_id == activity.id,
            func.lower(Participant.display_name) == display_name.lower(),
        )
        .first()
    )
    if existing_participant:
        raise HTTPException(status_code=409, detail="Este nome já entrou nesta atividade. Cada aluno pode jogar uma vez.")

    participant = Participant(
        room_id=room.id,
        activity_id=activity.id,
        display_name=display_name,
        source=_normalise_source(payload.display_name, payload.source),
        status="joined",
        last_seen_at=datetime.now(UTC),
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)

    room.status = "active"
    db.commit()
    db.refresh(room)

    message = (
        f"Participante '{participant.display_name}' vinculado à atividade {activity.id} da sala {room.code}."
    )
    if participant.source == "anonymous":
        message += " A entrada foi registrada sem identificação."

    return {
        "room": _room_payload(room, db),
        "activity": activity,
        "participant": participant,
        "game": game,
        "runner_url": (
            f"/runner?participant_id={participant.id}"
            f"&access_token={create_game_access_token(participant, game.slug)}"
        ),
        "message": message,
    }


@router.post(
    "/activities/{activity_id}/events",
    response_model=ActivityEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_activity_event(activity_id: int, payload: ActivityEventCreate, db: Session = Depends(get_db)):
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail=f"A atividade '{activity_id}' não foi encontrada.")
    if activity.status != "active":
        raise HTTPException(status_code=409, detail="Esta atividade já foi encerrada.")

    participant = _resolve_participant(activity_id, payload, db)
    now = datetime.now(UTC)
    event_status = payload.status
    event_type = payload.event_type.strip().lower()

    if participant:
        if participant.status == "finished":
            raise HTTPException(status_code=409, detail="Sua jogada já foi concluída.")
        participant.last_seen_at = now
        if payload.score is not None:
            participant.last_score = payload.score

        if event_status:
            participant.status = event_status
        elif event_type in {"runner_opened", "launch", "start", "started", "game_loaded", "progress"}:
            participant.status = "active"
        elif event_type in {"finish", "finished", "complete", "completed", "result"}:
            participant.status = "finished"
            participant.finished_at = now
        elif event_type in {"leave", "left"}:
            participant.status = "left"

        event_status = participant.status

    event = ActivityEvent(
        room_id=activity.room_id,
        activity_id=activity.id,
        participant_id=participant.id if participant else None,
        event_type=payload.event_type,
        score=payload.score,
        status=event_status,
        payload_json=json.dumps(payload.payload or {}, ensure_ascii=False),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _event_payload(event)


@router.get("/participants/{participant_id}/context", response_model=RunnerContextResponse)
def get_runner_context(participant_id: int, db: Session = Depends(get_db)):
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail=f"O participante '{participant_id}' não foi encontrado.")

    activity = db.query(Activity).filter(Activity.id == participant.activity_id).first()
    room = db.query(Room).filter(Room.id == participant.room_id).first()
    if not activity or not room:
        raise HTTPException(status_code=404, detail="Não foi possível localizar todos os dados desta participação.")
    if activity.status != "active" or participant.status != "joined":
        raise HTTPException(status_code=409, detail="Esta jogada já foi iniciada ou concluída e não pode ser aberta novamente.")

    game = _resolve_game_or_404(activity.game_slug, db)
    return {
        "schema_version": "1.3",
        "room": _room_payload(room, db),
        "activity": activity,
        "participant": participant,
        "game": game,
        "context": {
            "room_code": room.code,
            "room_id": room.id,
            "mode": "room",
            "origin": "edulab-games",
            "grade": game.grade,
            "subject": game.subject,
        },
    }


@router.get("/{code}", response_model=RoomResponse)
def get_room(
    code: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)
    return _room_payload(room, db)


@router.patch("/{code}/status", response_model=RoomResponse)
def update_room_status(
    code: str,
    new_status: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)
    room.status = new_status
    db.commit()
    db.refresh(room)
    return _room_payload(room, db)
