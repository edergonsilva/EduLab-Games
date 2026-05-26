# EduLab Games — Backend

Este é o backend da plataforma **EduLab Games**, construído com **Python + FastAPI**.

## Requisitos
- Python 3.11+
- pip

## Instalação local

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

A API estará disponível em `http://localhost:8000`.  
Documentação interativa: `http://localhost:8000/docs`

## Variáveis de ambiente (`.env`)

Crie um arquivo `.env` na pasta `backend/` com:

```env
ADMIN_PASSWORD=troque-aqui
```

## Estrutura

```
app/
├── main.py          # Entrypoint FastAPI
├── config.py        # Configurações e variáveis de ambiente
├── routers/         # Rotas da API
│   ├── health.py
│   ├── catalog.py
│   ├── games.py
│   ├── rooms.py
│   ├── admin.py
│   └── import_edugame.py
├── models/          # Schemas Pydantic
├── services/        # Lógica de negócio
└── data/            # Dados estáticos JSON
```
