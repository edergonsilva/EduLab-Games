"""EduLab Games — FastAPI backend entry point."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import STATIC_IMPORTED_DIR, STATIC_IMPORTED_URL
from app.database import Base, engine
from app.routers import games, rooms

# Ensure all model classes are imported before creating tables
from app.models import Game  # noqa: F401
from app.routers.rooms import Room  # noqa: F401

# Create database tables
Base.metadata.create_all(bind=engine)

# Ensure static directories exist
STATIC_IMPORTED_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="EduLab Games API",
    description="Platform for managing and running educational .edugame packages",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve extracted game static files
app.mount(
    STATIC_IMPORTED_URL,
    StaticFiles(directory=str(STATIC_IMPORTED_DIR)),
    name="imported_games",
)

# API routes
app.include_router(games.router, prefix="/api")
app.include_router(rooms.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
