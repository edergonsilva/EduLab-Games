from pydantic import BaseModel
from typing import Optional


class Grade(BaseModel):
    id: int
    label: str
    short: str


class Subject(BaseModel):
    id: str
    label: str
    icon: str
    color: str
