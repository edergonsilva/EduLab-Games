from pydantic import BaseModel
from typing import List, Optional
import time


class Room(BaseModel):
    code: str
    game_id: str
    status: str = "waiting"  # waiting | active | finished
    players: List[str] = []
    created_at: float = 0.0

    def model_post_init(self, __context) -> None:
        if self.created_at == 0.0:
            self.created_at = time.time()


class CreateRoomRequest(BaseModel):
    game_id: str


class JoinRoomRequest(BaseModel):
    code: str
    player_name: str
