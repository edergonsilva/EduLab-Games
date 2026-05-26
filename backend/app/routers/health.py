from fastapi import APIRouter
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
    }


@router.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "description": "Plataforma de jogos educativos para laboratórios de informática escolares.",
        "credits": "Ederson Gonçalves da Silva",
        "docs": "/docs",
    }
