# Como rodar e testar localmente

## Pré-requisitos

- Docker + Docker Compose
- Linux Mint (alvo principal do MVP local)
- opcional para desenvolvimento sem Docker: Python 3.11+ e Node 20+

## 1. Configurar a senha do admin

Na raiz do projeto, crie um arquivo `.env` com pelo menos:

```bash
echo "ADMIN_PASSWORD=minha-senha-segura" > .env
```

Se não criar o arquivo, a senha padrão será `edulab@admin`.

## 2. Subir os containers

```bash
docker compose up --build
```

URLs principais:

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

## 3. Onde ficam os dados persistidos

### Sem Docker
- SQLite: `backend/data_storage/edulab.sqlite3`
- pacotes `.edugame`: `backend/data_storage/packages/`
- assets e thumbnails importados: `backend/data_storage/static/imported/`

### Com Docker
Tudo fica no volume `edulab-data`, montado em `/app/data_storage` no container do backend.

## 4. Smoke test manual sugerido (Prioridade 3)

1. **Subir containers**
   - `docker compose up --build`
2. **Abrir painel do professor**
   - `http://localhost:3000/professor`
3. **Criar sala**
   - preencher nome da atividade
   - opcional: filtrar por ano/disciplina
   - selecionar jogo com modo `sala_codigo`
   - clicar em `Criar Sala`
4. **Selecionar jogo da sala**
   - na lista de salas, confirmar/ajustar o jogo
   - clicar em `Salvar jogo`
5. **Iniciar atividade**
   - clicar em `Iniciar atividade` e validar status `active`
6. **Abrir entrada por código em outro navegador**
   - `http://localhost:3000/entrar-sala`
7. **Informar código da sala**
   - preencher código + nome do aluno e entrar
8. **Validar estado de espera ou abertura do jogo**
   - se a sala estiver `waiting`, a tela mostra espera amigável
   - se estiver `active`, o botão `Entrar no jogo da sala` abre o runner correto
9. **Validar contexto enviado ao jogo**
   - no runner, conferir logs no console com `platform_context`
   - validar presença de `mode`, `origin` e dados da sala (`room_code`, `room_id`, `room_name`)

## 5. Desenvolvimento sem Docker

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O Vite faz proxy de `/api` e `/health` para `http://localhost:8000`.

## 6. Rotas úteis para teste manual

- `GET /health`
- `GET /api/games`
- `GET /api/admin/games`
- `POST /api/import/edugame`
- `PATCH /api/admin/games/{game_id}/{version}`
- `POST /api/rooms`
- `GET /api/rooms`
- `GET /api/rooms/{code}`

## 7. Rede local

Depois de subir o sistema no computador servidor, descubra o IP local:

```bash
ip addr show | grep 'inet '
```

Os demais computadores do laboratório podem acessar:

```text
http://IP-DO-SERVIDOR:3000
```
