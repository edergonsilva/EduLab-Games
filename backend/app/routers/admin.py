from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
import secrets
from app.config import settings

router = APIRouter()
security = HTTPBasic()


class LoginRequest(BaseModel):
    password: str


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
    Retorna token simples para uso no frontend.
    PLACEHOLDER: implementar JWT ou sessão real futuramente.
    """
    if not secrets.compare_digest(body.password.encode(), settings.admin_password.encode()):
        raise HTTPException(status_code=401, detail="Senha inválida.")
    return {"ok": True, "message": "Acesso liberado."}


@router.get("/status")
async def admin_status():
    """Endpoint de status do painel administrativo."""
    return {
        "panel": "EduLab Games Admin",
        "note": "Autenticação completa será implementada em versão futura.",
    }
