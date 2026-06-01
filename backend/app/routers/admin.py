import secrets
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel

from app.config import settings
from app.models.game import GameManifest
from app.services.storage import list_games, update_imported_game_status

router = APIRouter()
security = HTTPBasic()
ALLOWED_STATUSES = {"test", "published", "archived"}


class LoginRequest(BaseModel):
    password: str


class UpdateGameStatusRequest(BaseModel):
    status: Literal["test", "published", "archived"]


def _verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    correct_password = secrets.compare_digest(
        credentials.password.encode(), settings.admin_password.encode()
    )
    if not correct_password:
        raise HTTPException(status_code=401, detail="Senha inválida.", headers={"WWW-Authenticate": "Basic"})
    return credentials


@router.post("/login")
async def admin_login(body: LoginRequest):
    """
    Verifica a senha do administrador (sem sessão persistente no MVP).
    Retorna confirmação simples para habilitar o painel no frontend.
    """
    if not secrets.compare_digest(body.password.encode(), settings.admin_password.encode()):
        raise HTTPException(status_code=401, detail="Senha inválida.")
    return {"ok": True, "message": "Acesso liberado."}


@router.get("/status")
async def admin_status():
    """Endpoint de status do painel administrativo."""
    return {
        "panel": "EduLab Games Admin",
        "database": str(settings.database_path),
        "storage": str(settings.storage_dir),
    }


@router.get("/games", response_model=list[GameManifest])
async def admin_games(status: Optional[str] = Query(None)):
    if status is not None and status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido.")
    return list_games(status=status)


@router.patch("/games/{game_id}/{version}", response_model=GameManifest)
async def set_game_status(game_id: str, version: str, body: UpdateGameStatusRequest):
    game = update_imported_game_status(game_id, version, body.status)
    if game is None:
        raise HTTPException(status_code=404, detail="Jogo importado não encontrado.")
    return game
