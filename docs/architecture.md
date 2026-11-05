# EduLab Games — Architecture

## Overview

EduLab Games is a **local-first** platform for running educational `.edugame` games
in school computer labs.  It has a clear client–server separation:

```
┌──────────────────────────────────┐
│          Browser (React)         │
│  - Game library / catalog        │
│  - Import UI (.edugame upload)   │
│  - In-browser game runner        │
└──────────────┬───────────────────┘
               │ HTTP (REST JSON) + Socket.IO room events
┌──────────────▼───────────────────┐
│      FastAPI backend (Python)    │
│  - /api/games  — catalog CRUD    │
│  - /api/games/import  — import   │
│  - /api/rooms  — room lifecycle  │
│  - /socket.io — authenticated updates │
│  - /static/imported/…  — assets  │
│  - SQLite (SQLAlchemy)           │
└──────────────────────────────────┘
```

## Ports

| Service   | Default port | Dev command                     |
|-----------|-------------|----------------------------------|
| Backend   | 8000        | `uvicorn app.main:app --reload`  |
| Frontend  | 5173 (dev)  | `npm run dev`                    |
| Frontend  | 3000 (prod) | `docker compose up`              |

## Data directories

All runtime data lives under `data/` in the repository root (created on first
run):

| Path                             | Contents                                      |
|----------------------------------|-----------------------------------------------|
| `data/edulab.db`                 | SQLite database                               |
| `data/packages/`                 | Original `.edugame` archive files             |
| `data/static/imported/{slug}/{version}/` | Extracted game assets (served as static files) |

## Component responsibilities

### Backend (`backend/`)

- **`app/config.py`** — paths and settings
- **`app/database.py`** — SQLAlchemy engine + session factory
- **`app/models.py`** — `Game`, `Room`, `Activity`, `Participant`, and event models
- **`app/schemas.py`** — Pydantic request/response schemas
- **`app/routers/games.py`** — game catalog + `.edugame` import (clean reimportation)
- **`app/routers/rooms.py`** — room management for classroom sessions
- **`app/realtime.py`** — authenticated room-scoped Socket.IO channels
- **`app/main.py`** — FastAPI application, CORS, static files, and Socket.IO ASGI mount

### Frontend (`frontend/src/`)

- **`api/games.ts`** — typed API client
- **`components/GameImport.tsx`** — drag-and-drop import widget
- **`components/GameCatalog.tsx`** — game card grid
- **`pages/LibraryPage.tsx`** — main library page
- **`pages/JoinRoomPage.tsx`**, **`LobbyPage.tsx`**, and **`RunnerPage.tsx`** — participant entry, waiting, and iframe runtime

## Classroom lifecycle

The backend owns the room state: `waiting -> active -> finished`. A room is
created with one waiting activity and its selected game. Existing business
rules allow late joins while active; all participants are bound to a signed,
HttpOnly session cookie. Socket.IO only notifies authorized room members after
database commits; REST remains the state source and reconnect fallback.

Scores and progress are client-reported by games, validated for shape and
bounds, and stored with the participant/activity. They are not cryptographic
proof of correct play. The runner supports the legacy `activity_event`,
`activity_result`, `edulab.activity.event`, and `edulab.activity.result` messages
as well as the optional `window.EduLabSDK` protocol.

### Tools (`tools/`)

- **`tools/package_edugame.py`** — official `.edugame` packager CLI

## Clean reimportation

See [`docs/edugame-packaging.md`](edugame-packaging.md#reimportation) for the
full description of the clean reimportation strategy.

In short: when a `.edugame` file whose `slug` is already in the database is
imported again, the platform **removes all on-disk artifacts and the database
row of the previous game before extracting the new package**.  This prevents
stale CSS/JS from being served after an update.
