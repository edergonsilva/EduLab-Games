import json
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.game import GameManifest

router = APIRouter()
_data = Path("app/data")


def _load_games() -> list[dict]:
    with open(_data / "games.json", encoding="utf-8") as f:
        return json.load(f)


@router.get("", response_model=list[GameManifest])
async def list_games(
    subject: Optional[str] = Query(None, description="Filtrar por disciplina"),
    grade: Optional[int] = Query(None, description="Filtrar por ano escolar"),
    mode: Optional[str] = Query(None, description="Filtrar por modo de jogo"),
    status: Optional[str] = Query("published", description="Status do jogo"),
):
    """Retorna o catálogo de jogos, com filtros opcionais."""
    games = _load_games()

    if status:
        games = [g for g in games if g.get("status") == status]
    if subject:
        games = [g for g in games if g.get("subject") == subject or g.get("subject") is None]
    if grade is not None:
        games = [g for g in games if grade in g.get("school_grades", [])]
    if mode:
        games = [g for g in games if mode in g.get("mode", [])]

    return games


@router.get("/{game_id}", response_model=GameManifest)
async def get_game(game_id: str):
    """Retorna os detalhes de um jogo pelo ID."""
    games = _load_games()
    for g in games:
        if g["id"] == game_id:
            return g
    raise HTTPException(status_code=404, detail="Jogo não encontrado.")
