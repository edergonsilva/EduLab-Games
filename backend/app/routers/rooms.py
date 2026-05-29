from fastapi import APIRouter, HTTPException

from app.models.room import CreateRoomRequest, JoinRoomRequest, Room
from app.services.storage import create_room as create_persistent_room
from app.services.storage import get_game, get_room, list_rooms as list_persistent_rooms, save_room

router = APIRouter()


@router.post("", response_model=Room, status_code=201)
async def create_room(body: CreateRoomRequest):
    """Cria uma nova sala de jogo e retorna o código de acesso."""
    game = get_game(body.game_id, status="published")
    if game is None:
        raise HTTPException(status_code=404, detail="Jogo não encontrado ou não publicado.")
    if "sala_codigo" not in game.mode:
        raise HTTPException(status_code=400, detail="Este jogo não suporta salas por código.")
    return create_persistent_room(body.game_id)


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
    if room.status != "waiting":
        raise HTTPException(status_code=400, detail="A sala já está em andamento ou encerrada.")
    if body.player_name not in room.players:
        room.players.append(body.player_name)
        save_room(room)
    return room


@router.post("/{code}/start", response_model=Room)
async def start_room(code: str):
    """Inicia a partida de uma sala."""
    room = get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    room.status = "active"
    return save_room(room)


@router.post("/{code}/finish", response_model=Room)
async def finish_room(code: str):
    """Encerra a partida de uma sala."""
    room = get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    room.status = "finished"
    return save_room(room)


@router.get("", response_model=list[Room])
async def list_rooms():
    """Lista todas as salas criadas (uso administrativo/local)."""
    return list_persistent_rooms()
