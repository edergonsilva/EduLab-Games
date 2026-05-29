# Backend do EduLab Games

API FastAPI responsável por catálogo, importação `.edugame`, salas e painel admin.

## Rodando localmente

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Persistência local

- banco SQLite: `data_storage/edulab.sqlite3`
- pacotes importados: `data_storage/packages/`
- assets/thumbnails extraídos: `data_storage/static/imported/`

## Rotas mais úteis

- `GET /health`
- `GET /api/games`
- `GET /api/admin/games`
- `POST /api/import/edugame`
- `PATCH /api/admin/games/{game_id}/{version}`
- `POST /api/rooms`
- `GET /api/rooms`

## Observações do MVP

- anos, disciplinas e jogos seed continuam em JSON
- jogos importados e salas agora persistem em SQLite
- thumbnails importadas são servidas em `/static/imported/...`
