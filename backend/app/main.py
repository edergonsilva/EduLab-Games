from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import admin, catalog, games, health, import_edugame, rooms
from app.services.storage import initialize_storage


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_storage()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Plataforma de jogos educativos para laboratórios de informática escolares.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=settings.storage_dir / "static", check_dir=False), name="static")

app.include_router(health.router, tags=["health"])
app.include_router(catalog.router, prefix="/api/catalog", tags=["catalog"])
app.include_router(games.router, prefix="/api/games", tags=["games"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(import_edugame.router, prefix="/api/import", tags=["import"])
