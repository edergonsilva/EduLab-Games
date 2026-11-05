"""Room, activity, participant and progress management router."""

from datetime import UTC, datetime
import json
import secrets
import string
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import SESSION_COOKIE_SECURE
from app.models import Activity, ActivityEvent, Game, Participant, Room, Teacher
from app.rate_limit import allow_request
from app.realtime import broadcast_room_event
from app.security import (
    GAME_ACCESS_DURATION,
    GAME_ACCESS_COOKIE_NAME,
    PARTICIPANT_SESSION_COOKIE_NAME,
    SESSION_DURATION,
    create_game_access_token,
    create_participant_session_token,
    get_current_participant,
    get_current_teacher,
)
from app.schemas import (
    ActivityEventCreate,
    ActivityEventResponse,
    ActivityResponse,
    ActivityStartRequest,
    JoinRoomRequest,
    JoinRoomResponse,
    ParticipantResponse,
    ProgressPayload,
    RoomCreate,
    RoomDashboardResponse,
    RoomHistoryResponse,
    RoomResponse,
    RunnerContextResponse,
)

router = APIRouter(prefix="/rooms", tags=["rooms"])


def _generate_code(length: int = 6) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
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


def _get_lobby_activity(room_id: int, db: Session) -> Activity | None:
    return (
        db.query(Activity)
        .filter(Activity.room_id == room_id, Activity.status == "waiting")
        .order_by(Activity.started_at.desc(), Activity.id.desc())
        .first()
    )


def _get_joinable_activity(room_id: int, db: Session) -> Activity | None:
    return (
        db.query(Activity)
        .filter(Activity.room_id == room_id, Activity.status.in_(["waiting", "active"]))
        .order_by(Activity.started_at.desc(), Activity.id.desc())
        .first()
    )


def _participant_summary(participants: list[Participant]) -> dict[str, int]:
    summary = {"waiting": 0, "playing": 0, "completed": 0, "total": len(participants)}
    for participant in participants:
        summary[participant.status] = summary.get(participant.status, 0) + 1
    return summary


def _ordered_participants_for_activity(activity_id: int, db: Session) -> list[Participant]:
    return (
        db.query(Participant)
        .filter(Participant.activity_id == activity_id)
        .order_by(
            Participant.last_score.is_(None),
            Participant.last_score.desc(),
            Participant.joined_at.asc(),
            Participant.id.asc(),
        )
        .all()
    )


def _room_payload(room: Room, db: Session) -> dict[str, Any]:
    activity = _get_latest_activity(room.id, db)
    participants: list[Participant] = []
    if activity:
        participants = _ordered_participants_for_activity(activity.id, db)

    return {
        "id": room.id,
        "code": room.code,
        "name": room.name,
        "game_slug": room.game_slug,
        "status": room.status,
        "created_at": room.created_at,
        "started_at": room.started_at,
        "finished_at": room.finished_at,
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
    db.flush()
    db.add(Activity(room_id=room.id, game_slug=payload.game_slug, status="waiting"))
    db.commit()
    db.refresh(room)
    return _room_payload(room, db)


@router.post("/{code}/activities/open", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def open_activity(
    code: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)
    if room.status != "waiting":
        raise HTTPException(status_code=409, detail="Esta sala não está aguardando participantes.")
    current = _get_latest_activity(room.id, db)
    if current is None:
        current = Activity(room_id=room.id, game_slug=room.game_slug, status="waiting")
        db.add(current)
    db.commit()
    db.refresh(current)
    return current


@router.post("/{code}/activities/start", response_model=ActivityResponse)
def start_activity(
    code: str,
    payload: ActivityStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)
    if room.status != "waiting":
        raise HTTPException(status_code=409, detail="Esta sala já foi iniciada ou encerrada.")
    game_slug = payload.game_slug or room.game_slug
    if not game_slug:
        raise HTTPException(status_code=422, detail="Selecione um jogo antes de iniciar a atividade.")

    _resolve_accessible_game_or_404(game_slug, teacher.id, db)

    current = _get_latest_activity(room.id, db)
    now = datetime.now(UTC)
    if current is None:
        current = Activity(room_id=room.id, game_slug=game_slug, status="waiting")
        db.add(current)
        db.flush()

    if current.status != "waiting":
        raise HTTPException(status_code=409, detail="A atividade não está aguardando para iniciar.")

    current.game_slug = game_slug
    current.status = "active"
    current.started_at = now
    current.ended_at = None
    activity = current
    room.started_at = now
    room.finished_at = None
    room.status = "active"
    room.game_slug = game_slug
    db.commit()
    db.refresh(activity)
    background_tasks.add_task(
        broadcast_room_event,
        room.id,
        "room.updated",
        {"room_code": room.code, "status": room.status, "activity_id": activity.id},
    )
    background_tasks.add_task(
        broadcast_room_event,
        room.id,
        "activity.started",
        {"room_code": room.code, "activity_id": activity.id, "game_slug": activity.game_slug},
    )
    return activity


@router.post("/activities/{activity_id}/finish", response_model=ActivityResponse)
def finish_activity(
    activity_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    activity = _get_owned_activity_or_404(activity_id, teacher.id, db)
    room = db.query(Room).filter(Room.id == activity.room_id).first()
    if not room or room.status != "active" or activity.status != "active":
        raise HTTPException(status_code=409, detail="Esta sala não está ativa.")

    activity.status = "finished"
    now = datetime.now(UTC)
    activity.ended_at = now
    room.status = "finished"
    room.finished_at = now
    db.commit()
    db.refresh(activity)
    background_tasks.add_task(
        broadcast_room_event,
        room.id,
        "room.updated",
        {"room_code": room.code, "status": room.status, "activity_id": activity.id},
    )
    background_tasks.add_task(
        broadcast_room_event,
        room.id,
        "activity.finished",
        {"room_code": room.code, "activity_id": activity.id},
    )
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
        participants = _ordered_participants_for_activity(activity.id, db)
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


@router.get("/{code}/lobby")
def get_room_lobby(
    code: str,
    db: Session = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
):
    room = _get_room_or_404(code, db)
    if participant.room_id != room.id:
        raise HTTPException(status_code=404, detail="A participação não foi encontrada nesta sala.")
    activity = _get_joinable_activity(room.id, db) or _get_latest_activity(room.id, db)
    if not activity:
        raise HTTPException(status_code=404, detail=f"A sala '{code}' ainda não abriu uma atividade.")

    participants = _ordered_participants_for_activity(activity.id, db)
    game = db.query(Game).filter(Game.slug == activity.game_slug).first() if activity.game_slug else None

    return {
        "room": _room_payload(room, db),
        "activity": activity,
        "game": game,
        "participants": participants,
        "participant_count": len(participants),
        "current_participant_id": participant.id,
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
    return _ordered_participants_for_activity(activity_id, db)


@router.post("/{code}/join", response_model=JoinRoomResponse, status_code=status.HTTP_201_CREATED)
def join_room(
    code: str,
    payload: JoinRoomRequest,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if not allow_request(f"join:{client_ip}", limit=120, window_seconds=60):
        raise HTTPException(status_code=429, detail="Muitas tentativas de entrada. Aguarde um minuto e tente novamente.")

    room = _get_room_or_404(code, db)
    display_name = (payload.display_name or "").strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="Informe seu nome ou apelido para entrar na sala.")
    if room.status == "finished":
        raise HTTPException(status_code=409, detail="Esta sala já foi encerrada.")
    activity = _get_joinable_activity(room.id, db)
    if not activity or activity.status not in {"waiting", "active"}:
        raise HTTPException(
            status_code=409,
            detail="Esta sala não tem uma atividade em andamento. Peça ao professor para iniciar uma.",
        )

    game = _resolve_game_or_404(activity.game_slug, db) if activity.game_slug else None
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
        status="waiting",
        connection_status="disconnected",
        last_seen_at=datetime.now(UTC),
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    response.set_cookie(
        key=PARTICIPANT_SESSION_COOKIE_NAME,
        value=create_participant_session_token(participant),
        max_age=int(GAME_ACCESS_DURATION.total_seconds()),
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    message = (
        f"Participante '{participant.display_name}' vinculado à atividade {activity.id} da sala {room.code}."
    )
    if participant.source == "anonymous":
        message += " A entrada foi registrada sem identificação."

    runner_url = None
    if activity.status == "active" and game:
        runner_url = "/runner"
        message += " A atividade já começou."
    elif activity.status == "waiting":
        message += " A sala está aberta e aguarda o professor começar a atividade."

    background_tasks.add_task(
        broadcast_room_event,
        room.id,
        "participant.joined",
        {
            "room_code": room.code,
            "participant": {
                "id": participant.id,
                "display_name": participant.display_name,
                "status": participant.status,
                "connection_status": participant.connection_status,
            },
        },
    )

    return {
        "room": _room_payload(room, db),
        "activity": activity,
        "participant": participant,
        "game": game,
        "runner_url": runner_url,
        "message": message,
    }


@router.post(
    "/activities/{activity_id}/events",
    response_model=ActivityEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_activity_event(
    activity_id: int,
    payload: ActivityEventCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
):
    if not allow_request(f"events:{participant.id}", limit=180, window_seconds=60):
        raise HTTPException(status_code=429, detail="Muitos eventos enviados. Aguarde um momento e tente novamente.")

    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail=f"A atividade '{activity_id}' não foi encontrada.")
    room = db.query(Room).filter(Room.id == activity.room_id).first()
    if not room or room.status != "active" or activity.status != "active":
        raise HTTPException(status_code=409, detail="Esta atividade já foi encerrada.")
    if participant.activity_id != activity_id or participant.room_id != room.id:
        raise HTTPException(status_code=404, detail="Esta participação não pertence à atividade.")

    now = datetime.now(UTC)
    event_type = payload.event_type.strip().lower()
    completion_types = {"finish", "finished", "complete", "completed", "result", "activity_result"}
    if participant.status == "completed":
        if event_type in completion_types:
            previous_completion = (
                db.query(ActivityEvent)
                .filter(
                    ActivityEvent.participant_id == participant.id,
                    ActivityEvent.event_type == "completed",
                )
                .order_by(ActivityEvent.id.desc())
                .first()
            )
            if previous_completion:
                return _event_payload(previous_completion)
        raise HTTPException(status_code=409, detail="Sua jogada já foi concluída.")

    participant.last_seen_at = now
    if payload.progress is not None:
        participant.progress_current = payload.progress.current
        participant.progress_total = payload.progress.total
    if payload.score is not None:
        participant.last_score = payload.score
    if event_type in {"runner_opened", "launch", "start", "started", "game_loaded", "progress", "score"}:
        participant.status = "playing"
    elif event_type in completion_types:
        participant.status = "completed"
        participant.finished_at = now

    if participant.status == "completed":
        event_type = "completed"

    event = ActivityEvent(
        room_id=activity.room_id,
        activity_id=activity.id,
        participant_id=participant.id,
        event_type=event_type,
        score=payload.score,
        status=participant.status,
        payload_json=json.dumps(payload.payload or {}, ensure_ascii=False),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    event_response = _event_payload(event)
    background_tasks.add_task(
        broadcast_room_event,
        room.id,
        "activity.progress" if payload.progress is not None else "activity.score" if payload.score is not None else "participant.updated",
        {
            "room_code": room.code,
            "participant_id": participant.id,
            "display_name": participant.display_name,
            "status": participant.status,
            "score": participant.last_score,
            "event_type": event.event_type,
        },
    )
    if participant.status == "completed":
        background_tasks.add_task(
            broadcast_room_event,
            room.id,
            "activity.completed",
            {"room_code": room.code, "participant_id": participant.id},
        )
    return event_response


def _runner_context_payload(
    participant: Participant,
    response: Response,
    db: Session,
):
    activity = db.query(Activity).filter(Activity.id == participant.activity_id).first()
    room = db.query(Room).filter(Room.id == participant.room_id).first()
    if not activity or not room:
        raise HTTPException(status_code=404, detail="Não foi possível localizar todos os dados desta participação.")
    if activity.status != "active" or room.status != "active" or participant.status == "completed":
        raise HTTPException(status_code=409, detail="Esta atividade não está disponível para esta participação.")

    game = _resolve_game_or_404(activity.game_slug, db)
    response.set_cookie(
        key=GAME_ACCESS_COOKIE_NAME,
        value=create_game_access_token(participant, game.slug),
        max_age=int(GAME_ACCESS_DURATION.total_seconds()),
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path=f"/static/imported/{game.slug}/{game.version}/",
    )
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


@router.get("/participants/me/context", response_model=RunnerContextResponse)
def get_my_runner_context(
    response: Response,
    db: Session = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
):
    return _runner_context_payload(participant, response, db)


@router.get("/participants/{participant_id}/context", response_model=RunnerContextResponse)
def get_runner_context(
    participant_id: int,
    response: Response,
    db: Session = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
):
    if participant.id != participant_id:
        raise HTTPException(status_code=404, detail="A participação não foi encontrada.")
    return _runner_context_payload(participant, response, db)


@router.get("/{code}", response_model=RoomResponse)
def get_room(
    code: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)
    return _room_payload(room, db)


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    code: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)

    activities = db.query(Activity).filter(Activity.room_id == room.id).all()
    for activity in activities:
        events = db.query(ActivityEvent).filter(ActivityEvent.activity_id == activity.id).all()
        for event in events:
            db.delete(event)
        participants = db.query(Participant).filter(Participant.activity_id == activity.id).all()
        for participant in participants:
            db.delete(participant)
        db.delete(activity)

    db.delete(room)
    db.commit()


@router.patch("/{code}/status", response_model=RoomResponse)
def update_room_status(
    code: str,
    new_status: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = _get_owned_room_or_404(code, teacher.id, db)
    if new_status != room.status:
        raise HTTPException(
            status_code=409,
            detail="O estado da sala só pode mudar ao iniciar ou encerrar a atividade.",
        )
    return _room_payload(room, db)
