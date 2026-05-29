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

## 4. Smoke test manual sugerido

1. **Subir containers**
   - `docker compose up --build`
2. **Validar health**
   - abrir `http://localhost:8000/health`
3. **Abrir frontend**
   - abrir `http://localhost:3000`
4. **Criar sala**
   - ir em `Professor`
   - escolher um jogo com `sala_codigo`
   - criar a sala e anotar o código
5. **Entrar em sala**
   - abrir `Entrar na Sala`
   - informar o código criado
6. **Logar no admin**
   - abrir `Admin`
   - usar a senha configurada
7. **Importar `.edugame`**
   - enviar um pacote válido
   - confirmar feedback de sucesso
   - verificar que o jogo aparece com status `test`
8. **Publicar o jogo importado** (opcional, mas recomendado)
   - clicar em `Publicar` no painel admin
   - voltar ao catálogo e confirmar se o jogo aparece para os alunos
9. **Reiniciar o backend**
   - parar/subir novamente os serviços
   - confirmar que jogos importados e salas ainda aparecem

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
