# Arquitetura — EduLab Games

## Visão geral

O EduLab Games é uma plataforma local-first composta por:

- **backend FastAPI** para catálogo, importação, salas e painel admin
- **frontend React/Vite** para os fluxos web
- **SQLite + armazenamento em disco** para persistência mínima do MVP local

```text
Frontend (porta 3000/5173)
        ↓ HTTP
Backend FastAPI (porta 8000)
        ├── SQLite (jogos importados e salas)
        └── storage local (pacotes .edugame e assets extraídos)
```

## Backend

### Rotas principais

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | health check |
| GET | `/api/catalog/grades` | anos escolares |
| GET | `/api/catalog/subjects` | disciplinas |
| GET | `/api/games` | catálogo combinado (seed + importados publicados) |
| GET | `/api/games/{id}` | detalhes de um jogo |
| POST | `/api/import/edugame` | valida e importa pacote `.edugame` |
| GET | `/api/import/edugame/spec` | resumo da spec `.edugame` |
| GET | `/api/admin/games` | listagem administrativa de jogos |
| PATCH | `/api/admin/games/{game_id}/{version}` | altera status de jogo importado |
| POST | `/api/rooms` | cria sala persistida |
| GET | `/api/rooms` | lista salas persistidas |
| GET | `/api/rooms/{code}` | consulta sala |
| POST | `/api/rooms/{code}/join` | entra em sala |

### Persistência do MVP

- **JSON estático** para anos, disciplinas e jogos seed/base
- **SQLite** para jogos importados e salas
- **filesystem local** para pacotes `.edugame` e thumbnails/assets extraídos

Local padrão sem Docker:
- `backend/data_storage/edulab.sqlite3`
- `backend/data_storage/packages/`
- `backend/data_storage/static/imported/`

### Catálogo de jogos

O backend combina:

1. jogos seed/base de `backend/app/data/games.json`
2. jogos importados persistidos no SQLite

Filtros mantidos:
- disciplina
- ano
- modo
- status

## Frontend

Rotas principais:

| Rota | Tela |
|------|------|
| `/` | seleção de ano |
| `/disciplinas/:grade` | seleção de disciplina |
| `/jogos/:grade/:subject` | catálogo |
| `/entrar-sala` | entrada por código |
| `/professor` | criação/listagem de salas |
| `/admin` | login, upload e publicação básica |

## Limites atuais do bootstrap

- sem WebSocket em tempo real
- sem parser completo de PDF
- autenticação admin ainda é senha simples sem sessão persistente
- execução real do jogo HTML5 ainda está fora do escopo desta etapa
