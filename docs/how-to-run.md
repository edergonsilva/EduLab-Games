# How to run EduLab Games

## Using Docker (recommended)

```bash
# Clone the repository
git clone https://github.com/edergonsilva/EduLab-Games.git
cd EduLab-Games

# Build and start all services
docker compose up --build
```

| Service  | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:3000 |
| Backend  | http://localhost:8000 |
| API docs | http://localhost:8000/docs |

Data is persisted in the `./data/` directory on your host machine.

---

## Running locally (development)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # starts on http://localhost:5173
```

The Vite dev server proxies `/api` and `/static` to the backend on port 8000.

---

## Running tests

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

---

## Importing your first game

1. Open the platform in your browser.
2. Click the import area or drag a `.edugame` file onto it.
3. The game will appear in the library with a **▶ Jogar** button.

### Reimporting a game

If you upload a `.edugame` with the same `slug` as an existing game:
- The previous extracted files and package are **automatically removed**.
- The new package is extracted cleanly.
- The library shows the updated version.

This means you never have stale CSS/JS from an old version being served after
an update.

---

## Packaging a game

See [`docs/edugame-packaging.md`](edugame-packaging.md) for the full guide.

Quick reference:
```bash
python tools/package_edugame.py path/to/game/ --validate-only  # validate
python tools/package_edugame.py path/to/game/                   # create package
```
