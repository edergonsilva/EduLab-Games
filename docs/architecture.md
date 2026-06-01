# Arquitetura — EduLab Games

## Visão geral

O EduLab Games é uma plataforma local-first composta por:

- **backend FastAPI** para catálogo, importação, salas, atividades, participantes e painel admin
- **frontend React/Vite** para os fluxos web
- **SQLite + armazenamento em disco** para persistência mínima do MVP local

```text
Frontend (porta 3000/5173)
        ↓ HTTP
Backend FastAPI (porta 8000)
        ├── SQLite (jogos importados, salas, atividades, participantes e eventos)
        └── storage local (pacotes .edugame e assets extraídos)
```

## Backend

### Rotas principais

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | health check |
| GET | `/api/catalog/grades` | anos escolares |
| GET | `/api/catalog/subjects` | disciplinas |
| GET | `/api/games` | catálogo combinado (seed + importados publicados) com `play_url` |
| GET | `/api/games/{id}` | detalhes de um jogo, incluindo `play_url` |
| POST | `/api/import/edugame` | valida e importa pacote `.edugame` |
| GET | `/api/import/edugame/spec` | resumo da spec `.edugame` |
| GET | `/api/admin/games` | listagem administrativa de jogos |
| PATCH | `/api/admin/games/{game_id}/{version}` | altera status de jogo importado |
| POST | `/api/rooms` | cria sala persistida |
| GET | `/api/rooms` | lista salas persistidas |
| GET | `/api/rooms/{code}` | consulta sala |
| POST | `/api/rooms/{code}/join` | entra em sala |
| GET | `/api/activities` | lista atividades/sessões recentes |
| GET | `/api/activities/{id}` | detalha atividade com eventos recentes |
| GET | `/api/activities/{id}/participants` | resultados por participante da atividade |
| GET | `/api/activities/participants/list` | listagem de participantes (filtro por sala/atividade) |
| POST | `/api/activities/ensure` | obtém/cria atividade usada pelo runner |
| POST | `/api/activities/{id}/events` | persiste evento recebido do jogo |
| GET | `/static/games/{game_id}/…` | arquivos dos jogos seed |
| GET | `/static/imported/{slug}/{ver}/…` | arquivos dos jogos importados |

### Persistência do MVP

- **JSON estático** para anos, disciplinas e jogos seed/base
- **SQLite** para jogos importados, salas, atividades, participantes e eventos
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
| `/jogar/:gameId` | **runner/player do jogo** (iframe + postMessage) |
| `/entrar-sala` | entrada por código |
| `/professor` | criação/listagem de salas |
| `/admin` | login, upload e publicação básica |

## Runner de jogos (`/jogar/:gameId`)

Ao clicar em **Jogar Agora** no catálogo, o frontend navega para `/jogar/:gameId`.

O runner:
1. busca metadados do jogo em `GET /api/games/{gameId}`
2. resolve `play_url` retornada pelo backend
3. carrega o jogo num `<iframe sandbox>`
4. garante/recupera uma atividade persistida via backend
5. envia contexto inicial via `postMessage` com `context` + `activity` + `participant` (quando aplicável)
6. encaminha eventos relevantes do jogo para `POST /api/activities/{id}/events`
7. exibe log de eventos (expansível) para diagnóstico local
8. escuta eventos do jogo:
   - `game_started`
   - `question_answered`
   - `score_updated`
   - `game_finished`

## Sala × atividade × execução

- **Sala**: espaço pedagógico com código de acesso e estado da turma.
- **Atividade**: sessão persistida vinculada ao jogo e, opcionalmente, à sala; guarda ciclo de vida, timestamps e resumo.
- **Execução**: abertura concreta do runner/iframe por um usuário usando o contexto de uma atividade existente.

## Participante × roster de alunos

- **Participant**: representa uma entrada real (aluno/dispositivo) em sala/atividade com identificação mínima, status e score.
- **Student roster (futuro)**: lista oficial de alunos importada pela escola. O modelo atual já separa `participant` de `roster_student_id` para permitir matching posterior sem quebrar o fluxo atual.

## URLs de jogos

| Origem | URL do jogo |
|--------|-------------|
| Seed | `/static/games/{game_id}/{entry_point}` |
| Importado | `/static/imported/{game_slug}/{version_slug}/{entry_point}` |

Os arquivos estáticos dos jogos seed ficam em `backend/app/data/seed_games/` e são sincronizados para `data_storage/static/games/` na inicialização do backend.

## Limites atuais do MVP

- sem WebSocket em tempo real
- sem parser completo de PDF
- autenticação admin ainda é senha simples sem sessão persistente
- sem multiplayer em tempo real (reservado para fase posterior)
