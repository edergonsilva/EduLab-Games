import logging
import time

from fastapi import APIRouter, HTTPException

from app.models.room import CreateRoomRequest, JoinRoomRequest, JoinRoomResponse, Room, StartRoomRequest, UpdateRoomRequest
from app.services.storage import attach_room_participants_to_activity, create_activity, create_or_update_participant, create_room as create_persistent_room
from app.services.storage import finish_activity, get_game, get_room, list_rooms as list_persistent_rooms
from app.services.storage import record_activity_event, save_room

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=Room, status_code=201)
async def create_room(body: CreateRoomRequest):
    """Cria uma nova sala e retorna o código de acesso."""
    if body.game_id:
        game = get_game(body.game_id, status="published")
        if game is None:
            raise HTTPException(status_code=404, detail="Jogo não encontrado ou não publicado.")
        if "sala_codigo" not in game.mode:
            raise HTTPException(status_code=400, detail="Este jogo não suporta salas por código.")

    return create_persistent_room(
        name=body.name,
        grade=body.grade,
        subject=body.subject,
        game_id=body.game_id,
    )


@router.get("/{code}", response_model=Room)
async def get_room_route(code: str):
    """Retorna os dados de uma sala pelo código."""
    room = get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    return room


@router.post("/{code}/join", response_model=JoinRoomResponse)
async def join_room(code: str, body: JoinRoomRequest):
    """Adiciona um jogador a uma sala existente."""
    room = get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    if room.status == "finished":
        raise HTTPException(status_code=400, detail="Esta sala já foi encerrada.")
    participant = create_or_update_participant(
        room=room,
        display_name=body.player_name,
        source=body.source,
        activity_id=room.current_activity_id,
    )
    if participant.display_name not in room.players:
        room.players.append(participant.display_name)
    room = save_room(room)
    if room.current_activity_id:
        updated_activity = record_activity_event(
            room.current_activity_id,
            event_type="room_joined",
            participant_id=participant.id,
            display_name=participant.display_name,
            source=participant.source,
            payload={"player_name": participant.display_name, "source": "room_join"},
        )
        if updated_activity is None:
            logger.warning("Failed to record room_joined for activity %s", room.current_activity_id)
    return JoinRoomResponse(room=room, participant=participant)


@router.patch("/{code}", response_model=Room)
async def update_room(code: str, body: UpdateRoomRequest):
    room = get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")

    if body.name is not None:
        room.name = body.name
    if body.grade is not None:
        room.grade = body.grade
    if body.subject is not None:
        room.subject = body.subject
    if body.game_id is not None:
        game = get_game(body.game_id, status="published")
        if game is None:
            raise HTTPException(status_code=404, detail="Jogo não encontrado ou não publicado.")
        if "sala_codigo" not in game.mode:
            raise HTTPException(status_code=400, detail="Este jogo não suporta salas por código.")
        room.selected_game_id = body.game_id
    return save_room(room)


@router.post("/{code}/start", response_model=Room)
async def start_room(code: str, body: StartRoomRequest = StartRoomRequest()):
    """Inicia a partida de uma sala."""
    room = get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")

    game_id = body.game_id or room.selected_game_id
    if not game_id:
        raise HTTPException(status_code=400, detail="Selecione um jogo para iniciar a atividade.")

    game = get_game(game_id, status="published")
    if game is None:
        raise HTTPException(status_code=404, detail="Jogo não encontrado ou não publicado.")
    if "sala_codigo" not in game.mode:
        raise HTTPException(status_code=400, detail="Este jogo não suporta salas por código.")

    room.selected_game_id = game_id
    room.status = "active"
    room.started_at = room.started_at if room.started_at is not None else time.time()
    room.finished_at = None
    activity = create_activity(
        game_id=game_id,
        origin="room",
        room_id=room.id,
        room_code=room.code,
        title=room.name,
        grade=room.grade,
        subject=room.subject,
        status="active",
        started_at=room.started_at,
    )
    room.current_activity_id = activity.id
    room = save_room(room)
    attach_room_participants_to_activity(room.code, activity.id)
    return room


@router.post("/{code}/finish", response_model=Room)
async def finish_room(code: str):
    """Encerra a partida de uma sala."""
    room = get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    room.status = "finished"
    room.finished_at = time.time()
    if room.current_activity_id:
        finish_activity(room.current_activity_id, finished_at=room.finished_at)
    return save_room(room)


@router.get("", response_model=list[Room])
async def list_rooms():
    """Lista todas as salas criadas (uso administrativo/local)."""
    return list_persistent_rooms()
