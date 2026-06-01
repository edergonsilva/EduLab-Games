from typing import Literal, Optional
import time

from pydantic import BaseModel


ParticipantSource = Literal["manual", "anonymous", "teacher-test", "runner-event"]
ParticipantStatus = Literal["joined", "active", "finished", "left"]
RosterMatchStatus = Literal["unmatched", "pending", "matched"]


class Participant(BaseModel):
    id: str
    room_id: Optional[str] = None
    room_code: Optional[str] = None
    activity_id: Optional[str] = None
    display_name: str
    source: ParticipantSource = "manual"
    status: ParticipantStatus = "joined"
    joined_at: float = 0.0
    last_seen_at: float = 0.0
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    last_score: Optional[float] = None
    roster_student_id: Optional[str] = None
    roster_match_status: RosterMatchStatus = "unmatched"

    def model_post_init(self, __context) -> None:
        now = time.time()
        if self.joined_at == 0.0:
            self.joined_at = now
        if self.last_seen_at == 0.0:
            self.last_seen_at = now
