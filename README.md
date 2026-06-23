# EduLab Games

Plataforma gamificada educacional para laboratórios de informática.

---

## Quick start

```bash
git clone https://github.com/edergonsilva/EduLab-Games.git
cd EduLab-Games
docker compose up --build
```

Open **http://localhost:3000** in your browser.

| Service  | URL                               |
|----------|-----------------------------------|
| Frontend | http://localhost:3000             |
| API      | http://localhost:8000/api/        |
| API docs | http://localhost:8000/docs        |

---

## Features

- 📦 Import `.edugame` packages through the browser UI or REST API
- 🔄 **Clean reimportation** — uploading a game with an existing slug automatically removes all artifacts (extracted files, package, database record) before importing the new version
- 🎮 In-browser game runner via static file serving
- 🏫 Room management for classroom sessions

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/how-to-run.md`](docs/how-to-run.md) | Local development & Docker setup |
| [`docs/architecture.md`](docs/architecture.md) | System architecture overview |
| [`docs/edugame-spec.md`](docs/edugame-spec.md) | `.edugame` package format specification |
| [`docs/edugame-packaging.md`](docs/edugame-packaging.md) | How to package and publish a game |

---

## Packaging a game

```bash
# Validate
python tools/package_edugame.py path/to/game/ --validate-only

# Package
python tools/package_edugame.py path/to/game/
# → dist/{slug}-{version}.edugame
```

---

## Backend commands

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend commands

```bash
cd frontend
npm install
npm run dev     # dev server on http://localhost:5173
npm run build   # production build
```

## Tests

```bash
cd backend && python -m pytest tests/ -v
```
