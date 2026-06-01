import json
from pathlib import Path
from fastapi import APIRouter
from app.models.catalog import Grade, Subject

router = APIRouter()
_data = Path("app/data")


def _load(filename: str):
    with open(_data / filename, encoding="utf-8") as f:
        return json.load(f)


@router.get("/grades", response_model=list[Grade])
async def list_grades():
    """Retorna os anos escolares disponíveis (1º ao 9º ano)."""
    return _load("grades.json")


@router.get("/subjects", response_model=list[Subject])
async def list_subjects():
    """Retorna as disciplinas disponíveis no catálogo."""
    return _load("subjects.json")
