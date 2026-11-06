"""EduLab Games — FastAPI backend entry point."""

from pathlib import Path
import logging

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse

from app.config import CORS_ORIGINS, SESSION_COOKIE_SECURE, STATIC_IMPORTED_DIR, STATIC_IMPORTED_URL
from app.database import Base, SessionLocal, engine, migrate_schema
from app.routers import auth, games, rooms
from app.realtime import sio
import socketio

# Ensure all model classes are imported before creating tables
from app.models import Activity, ActivityEvent, Game, Participant, Room, Teacher  # noqa: F401
from app.security import (
    GAME_ACCESS_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    get_teacher_from_token,
    validate_game_access_token,
)

# Create database tables
Base.metadata.create_all(bind=engine)
migrate_schema()

# Ensure static directories exist
STATIC_IMPORTED_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="EduLab Games API",
    description="Platform for managing and running educational .edugame packages",
    version="1.0.0",
)

logger = logging.getLogger(__name__)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request, exc: RequestValidationError):
    field_names = {
        "email": "e-mail",
        "password": "senha",
        "name": "nome",
        "school_name": "escola",
        "game_slug": "jogo",
        "display_name": "nome do aluno",
        "code": "código da sala",
        "title": "título",
        "grade": "ano escolar",
        "subject": "disciplina",
        "file": "arquivo",
        "is_public": "visibilidade",
    }
    error_messages = {
        "missing": "é obrigatório",
        "string_too_short": "tem poucos caracteres",
        "string_too_long": "excede o limite de caracteres",
        "int_parsing": "deve ser um número inteiro",
        "float_parsing": "deve ser um número",
        "bool_parsing": "tem um valor inválido",
        "json_invalid": "contém JSON inválido",
    }
    details = []
    for error in exc.errors():
        field = str(error.get("loc", ())[-1]) if error.get("loc") else "campo"
        label = field_names.get(field, field.replace("_", " "))
        message = error_messages.get(error.get("type"), "tem um valor inválido")
        details.append(f"O campo {label} {message}.")
    return JSONResponse(
        status_code=422,
        content={"detail": "Confira os dados informados.", "errors": details},
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(request, exc: StarletteHTTPException):
    default_messages = {
        "Not Found": "A página ou recurso solicitado não foi encontrado.",
        "Method Not Allowed": "Esta operação não está disponível neste endereço.",
        "Internal Server Error": "Ocorreu um erro interno. Tente novamente mais tarde.",
    }
    detail = default_messages.get(str(exc.detail), exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request, exc: Exception):
    logger.error("Unexpected application error", exc_info=(type(exc), exc, exc.__traceback__))
    return JSONResponse(
        status_code=500,
        content={"detail": "Ocorreu um erro interno. Tente novamente mais tarde."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def protect_private_game_files(request, call_next):
    static_prefix = f"{STATIC_IMPORTED_URL.rstrip('/')}/"
    if not request.url.path.startswith(static_prefix):
        return await call_next(request)

    path_parts = request.url.path[len(static_prefix):].split("/", 2)
    if len(path_parts) < 2:
        return await call_next(request)
    slug, version = path_parts[:2]

    with SessionLocal() as db:
        game = db.query(Game).filter(Game.slug == slug, Game.version == version).first()
        if not game or game.is_public:
            return await call_next(request)

        teacher = get_teacher_from_token(request.cookies.get(SESSION_COOKIE_NAME), db)
        if teacher and teacher.id == game.teacher_id:
            return await call_next(request)

        access_token = (
            request.query_params.get("access_token")
            or request.cookies.get(GAME_ACCESS_COOKIE_NAME)
        )
        if not validate_game_access_token(access_token, game.slug, db):
            return JSONResponse({"detail": "Jogo privado."}, status_code=404)

        response = await call_next(request)
        response.set_cookie(
            key=GAME_ACCESS_COOKIE_NAME,
            value=access_token,
            max_age=8 * 60 * 60,
            httponly=True,
            secure=SESSION_COOKIE_SECURE,
            samesite="lax",
            path=f"{static_prefix}{slug}/{version}/",
        )
        return response

# Serve extracted game static files
app.mount(
    STATIC_IMPORTED_URL,
    StaticFiles(directory=str(STATIC_IMPORTED_DIR)),
    name="imported_games",
)

# API routes
app.include_router(games.router, prefix="/api")
app.include_router(rooms.router, prefix="/api")
app.include_router(auth.router, prefix="/api")

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


@app.get("/health")
def health():
    return {"status": "ok"}
