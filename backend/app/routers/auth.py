import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import SESSION_COOKIE_SECURE
from app.database import get_db
from app.models import Teacher
from app.schemas import TeacherLogin, TeacherRegister, TeacherResponse
from app.security import (
    SESSION_COOKIE_NAME,
    SESSION_DURATION,
    create_session_token,
    get_current_teacher,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


def _set_session(response: Response, teacher: Teacher) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=create_session_token(teacher),
        max_age=int(SESSION_DURATION.total_seconds()),
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


@router.post("/register", response_model=TeacherResponse, status_code=status.HTTP_201_CREATED)
def register_teacher(
    payload: TeacherRegister,
    response: Response,
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Informe um e-mail válido.")
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Informe seu nome.")
    if db.query(Teacher).filter(Teacher.email == email).first():
        raise HTTPException(status_code=409, detail="Já existe uma conta com este e-mail.")

    teacher = Teacher(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        school_name=payload.school_name.strip() if payload.school_name else None,
    )
    db.add(teacher)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Já existe uma conta com este e-mail.") from None
    db.refresh(teacher)
    _set_session(response, teacher)
    return teacher


@router.post("/login", response_model=TeacherResponse)
def login_teacher(
    payload: TeacherLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    teacher = db.query(Teacher).filter(Teacher.email == payload.email.strip().lower()).first()
    if not teacher or not verify_password(payload.password, teacher.password_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    _set_session(response, teacher)
    return teacher


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_teacher(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
    )


@router.get("/me", response_model=TeacherResponse)
def get_teacher_session(teacher: Teacher = Depends(get_current_teacher)):
    return teacher