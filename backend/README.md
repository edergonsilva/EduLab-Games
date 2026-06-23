# EduLab Games — Backend

FastAPI backend for the EduLab Games platform.

## Running

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API documentation: http://localhost:8000/docs

## Tests

```bash
python -m pytest tests/ -v
```

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/games/` | List all imported games |
| GET | `/api/games/{slug}` | Get a single game |
| POST | `/api/games/import` | Import a `.edugame` package |
| DELETE | `/api/games/{slug}` | Delete a game and its artifacts |
| GET | `/api/rooms/` | List rooms |
| POST | `/api/rooms/` | Create a room |
| GET | `/api/rooms/{code}` | Get a room by code |

## Reimportation behaviour

`POST /api/games/import` performs a **clean replacement** when the uploaded
package has the same `slug` as an existing game:

1. Old extracted static files are deleted from disk.
2. Old `.edugame` package file is deleted from disk.
3. Old database row is deleted.
4. New package is saved, extracted, and inserted.

The response includes `"replaced": true` when a previous game was removed.
