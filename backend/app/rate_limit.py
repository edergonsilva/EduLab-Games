from collections import defaultdict, deque
from threading import Lock
from time import monotonic

_requests: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def allow_request(key: str, limit: int, window_seconds: int) -> bool:
    now = monotonic()
    cutoff = now - window_seconds
    with _lock:
        attempts = _requests[key]
        while attempts and attempts[0] <= cutoff:
            attempts.popleft()
        if len(attempts) >= limit:
            return False
        attempts.append(now)
        return True