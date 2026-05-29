from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.game import GameManifest
from app.services.storage import get_game, list_games

router = APIRouter()


@router.get("", response_model=list[GameManifest])
async def list_games_route(
    subject: Optional[str] = Query(None, description="Filtrar por disciplina"),
    grade: Optional[int] = Query(None, description="Filtrar por ano escolar"),
    mode: Optional[str] = Query(None, description="Filtrar por modo de jogo"),
    status: Optional[str] = Query("published", description="Status do jogo"),
):
    """Retorna o catálogo de jogos, combinando jogos base e jogos importados."""
    return list_games(subject=subject, grade=grade, mode=mode, status=status)


@router.get("/{game_id}", response_model=GameManifest)
async def get_game_route(game_id: str, version: Optional[str] = Query(None)):
    """Retorna os detalhes de um jogo pelo ID."""
    game = get_game(game_id, version=version, status=None)
    if game:
        return game
    raise HTTPException(status_code=404, detail="Jogo não encontrado.")
