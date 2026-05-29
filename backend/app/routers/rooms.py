import time

from fastapi import APIRouter, HTTPException

from app.models.room import CreateRoomRequest, JoinRoomRequest, Room, StartRoomRequest, UpdateRoomRequest
from app.services.storage import create_room as create_persistent_room
from app.services.storage import get_game, get_room, list_rooms as list_persistent_rooms, save_room

router = APIRouter()


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


@router.post("/{code}/join", response_model=Room)
async def join_room(code: str, body: JoinRoomRequest):
    """Adiciona um jogador a uma sala existente."""
    room = get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    if room.status == "finished":
        raise HTTPException(status_code=400, detail="Esta sala já foi encerrada.")
    if body.player_name not in room.players:
        room.players.append(body.player_name)
    return save_room(room)


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
    return save_room(room)


@router.post("/{code}/finish", response_model=Room)
async def finish_room(code: str):
    """Encerra a partida de uma sala."""
    room = get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    room.status = "finished"
    room.finished_at = time.time()
    return save_room(room)


@router.get("", response_model=list[Room])
async def list_rooms():
    """Lista todas as salas criadas (uso administrativo/local)."""
    return list_persistent_rooms()
