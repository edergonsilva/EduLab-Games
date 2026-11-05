import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import SESSION_SECRET_KEY
from app.database import get_db
from app.models import Teacher
from app.models import Activity, Participant, Teacher

SESSION_COOKIE_NAME = "edulab_teacher_session"
SESSION_ALGORITHM = "HS256"
SESSION_DURATION = timedelta(days=7)
GAME_ACCESS_DURATION = timedelta(hours=8)
GAME_ACCESS_COOKIE_NAME = "edulab_game_access"
PARTICIPANT_SESSION_COOKIE_NAME = "edulab_participant_session"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, digest_hex = stored_hash.split("$", maxsplit=1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def create_session_token(teacher: Teacher) -> str:
    expires_at = datetime.now(UTC) + SESSION_DURATION
    return jwt.encode(
        {"sub": str(teacher.id), "exp": expires_at},
        SESSION_SECRET_KEY,
        algorithm=SESSION_ALGORITHM,
    )


def get_teacher_from_token(token: str | None, db: Session) -> Teacher | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SESSION_SECRET_KEY, algorithms=[SESSION_ALGORITHM])
        teacher_id = int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError):
        return None
    return db.get(Teacher, teacher_id)


def create_game_access_token(participant: Participant, game_slug: str) -> str:
    expires_at = datetime.now(UTC) + GAME_ACCESS_DURATION
    return jwt.encode(
        {
            "typ": "game_access",
            "sub": str(participant.id),
            "activity_id": participant.activity_id,
            "game_slug": game_slug,
            "exp": expires_at,
        },
        SESSION_SECRET_KEY,
        algorithm=SESSION_ALGORITHM,
    )


def create_participant_session_token(participant: Participant) -> str:
    expires_at = datetime.now(UTC) + GAME_ACCESS_DURATION
    return jwt.encode(
        {
            "typ": "participant_session",
            "sub": str(participant.id),
            "activity_id": participant.activity_id,
            "exp": expires_at,
        },
        SESSION_SECRET_KEY,
        algorithm=SESSION_ALGORITHM,
    )


def validate_game_access_token(token: str | None, game_slug: str, db: Session) -> bool:
    if not token:
        return False
    try:
        payload = jwt.decode(token, SESSION_SECRET_KEY, algorithms=[SESSION_ALGORITHM])
        if payload.get("typ") != "game_access" or payload.get("game_slug") != game_slug:
            return False
        participant_id = int(payload["sub"])
        activity_id = int(payload["activity_id"])
    except (JWTError, KeyError, TypeError, ValueError):
        return False

    participant = db.query(Participant).filter(
        Participant.id == participant_id,
        Participant.activity_id == activity_id,
    ).first()
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not participant or not activity or activity.game_slug != game_slug:
        return False
    from app.models import Room

    room = db.get(Room, activity.room_id)
    return bool(room and room.status == "active" and participant.status != "completed")


def get_current_participant(
    request: Request,
    db: Session = Depends(get_db),
) -> Participant:
    token = request.cookies.get(PARTICIPANT_SESSION_COOKIE_NAME)
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Entre na sala para continuar.",
    )
    if not token:
        raise unauthorized

    participant = get_participant_from_session_token(token, db)
    if not participant:
        raise unauthorized
    return participant


def get_participant_from_session_token(token: str | None, db: Session) -> Participant | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SESSION_SECRET_KEY, algorithms=[SESSION_ALGORITHM])
        if payload.get("typ") != "participant_session":
            return None
        participant_id = int(payload["sub"])
        activity_id = int(payload["activity_id"])
    except (JWTError, KeyError, TypeError, ValueError):
        return None
    return db.query(Participant).filter(
        Participant.id == participant_id,
        Participant.activity_id == activity_id,
    ).first()


def get_current_teacher(
    request: Request,
    db: Session = Depends(get_db),
) -> Teacher:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Entre na sua conta de professor para continuar.",
    )
    if not token:
        raise unauthorized

    try:
        payload = jwt.decode(token, SESSION_SECRET_KEY, algorithms=[SESSION_ALGORITHM])
        teacher_id = int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError):
        raise unauthorized from None

    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise unauthorized
    return teacher


def get_optional_teacher(
    request: Request,
    db: Session = Depends(get_db),
) -> Teacher | None:
    return get_teacher_from_token(request.cookies.get(SESSION_COOKIE_NAME), db)