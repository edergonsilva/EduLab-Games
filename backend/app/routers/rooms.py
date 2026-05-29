import random
import string
import time
from fastapi import APIRouter, HTTPException
from app.models.room import Room, CreateRoomRequest, JoinRoomRequest

router = APIRouter()

# Armazenamento em memória para o MVP — substituir por banco persistente futuramente
_rooms: dict[str, Room] = {}


def _generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


@router.post("", response_model=Room, status_code=201)
async def create_room(body: CreateRoomRequest):
    """Cria uma nova sala de jogo e retorna o código de acesso."""
    code = _generate_code()
    while code in _rooms:
        code = _generate_code()

    room = Room(code=code, game_id=body.game_id, created_at=time.time())
    _rooms[code] = room
    return room


@router.get("/{code}", response_model=Room)
async def get_room(code: str):
    """Retorna os dados de uma sala pelo código."""
    room = _rooms.get(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    return room


@router.post("/{code}/join")
async def join_room(code: str, body: JoinRoomRequest):
    """Adiciona um jogador a uma sala existente."""
    room = _rooms.get(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    if room.status != "waiting":
        raise HTTPException(status_code=400, detail="A sala já está em andamento ou encerrada.")
    if body.player_name not in room.players:
        room.players.append(body.player_name)
    return room


@router.post("/{code}/start")
async def start_room(code: str):
    """Inicia a partida de uma sala."""
    room = _rooms.get(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    room.status = "active"
    return room


@router.post("/{code}/finish")
async def finish_room(code: str):
    """Encerra a partida de uma sala."""
    room = _rooms.get(code)
    if not room:
        raise HTTPException(status_code=404, detail="Sala não encontrada.")
    room.status = "finished"
    return room


@router.get("")
async def list_rooms():
    """Lista todas as salas ativas (uso administrativo)."""
    return list(_rooms.values())
