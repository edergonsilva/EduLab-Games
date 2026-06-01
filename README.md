# 🎮 EduLab Games

Plataforma local-first de jogos educativos para laboratórios de informática escolares.

> Desenvolvida por **Ederson Gonçalves da Silva**  
> Visual inspirado nas cores da bandeira de Itajaí (amarelo & roxo)

## O que já é possível testar nesta versão (Prioridade 5)

- **execução real de jogos** — catálogo abre jogos num runner iframe completo
- 3 jogos seed funcionais: Quiz de Múltipla Escolha, Arrastar e Soltar, Desafio de Contas
- importação e execução de jogos `.edugame` importados pelo admin
- comunicação shell ↔ jogo via `window.postMessage` com contexto inicial da plataforma
- painel admin com publicação/despublicação e botão de teste direto
- catálogo com jogos base + jogos importados persistidos em SQLite
- fluxo de sala por código funcional com criação, seleção de jogo e início de atividade pelo professor
- entrada de aluno por código com identificação mínima (nome/apelido opcional) e fallback anônimo
- atividades/sessões persistidas com status, timestamps e vínculo com sala/jogo
- registro persistente de eventos do runner/jogo (`game_started`, `question_answered`, `score_updated`, `game_finished`)
- participantes persistidos por sala/atividade com status, última atividade e última pontuação
- histórico/resultado por participante no painel do professor

## Serviços

| Serviço | URL padrão |
|---------|------------|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

## Persistência local

Os dados do MVP local ficam em `backend/data_storage/` quando executado sem Docker.

Arquivos principais:
- banco SQLite: `backend/data_storage/edulab.sqlite3`
- pacotes enviados: `backend/data_storage/packages/`
- assets/thumbnails extraídos: `backend/data_storage/static/imported/`
- jogos seed servidos: `backend/data_storage/static/games/`

Com Docker, esse conteúdo fica no volume `edulab-data` montado em `/app/data_storage` dentro do container do backend.

## Subindo com Docker (recomendado)

```bash
git clone https://github.com/edergonsilva/EduLab-Games.git
cd EduLab-Games
cp .env.example .env 2>/dev/null || true
# ou crie manualmente e defina a senha do admin
# echo "ADMIN_PASSWORD=minha-senha" > .env

docker compose up --build
```

Senha padrão do admin, caso nenhuma variável seja definida: `edulab@admin`

## Fluxo de teste completo (end-to-end)

### 1. Subir a plataforma
```bash
docker compose up --build
```

### 2. Validar que está no ar
```
http://localhost:8000/health
```

### 3. Abrir o catálogo e testar um jogo seed
1. Acesse `http://localhost:3000`
2. Escolha qualquer ano escolar
3. Escolha uma disciplina (ou **Todos**)
4. Clique em **Jogar Agora ▶** em qualquer jogo
5. O runner abre em tela cheia com o jogo no iframe
6. Jogue normalmente — os eventos aparecem no log expansível ao final da página

### 4. Importar um jogo `.edugame`
1. Acesse `http://localhost:3000/admin`
2. Faça login com a senha do admin (`edulab@admin` por padrão)
3. Na seção **Importar Jogo**, selecione um arquivo `.edugame`
4. Clique em **Importar pacote** — o feedback de sucesso aparece no painel
5. O jogo importado aparece na lista com status **test**

### 5. Publicar o jogo importado
- Na lista de jogos do admin, clique em **Publicar** no jogo importado
- O status muda para **published**

### 6. Testar o jogo importado pelo admin
- Clique em **▶ Testar** no card do jogo — abre o runner diretamente
- Ou volte ao catálogo, selecione o ano/disciplina correto e clique em **Jogar Agora**

### 7. Fluxo sala por código com participantes (Prioridade 5)
1. Acesse `http://localhost:3000/professor`
2. Crie uma sala (nome + ano/disciplina opcional + jogo com modo `sala_codigo`)
3. Na lista de salas, confirme status e clique em **Iniciar atividade**
4. Em outro navegador, acesse `http://localhost:3000/entrar-sala`
5. Informe o código e nome/apelido (opcional) do aluno
6. Se a sala estiver em `waiting`, a tela mostra estado de espera amigável
7. Ao ficar `active`, o aluno pode clicar em **Entrar no jogo da sala**

### 8. Validar os eventos/contexto no runner
- No runner (`/jogar/:gameId`), ao jogar, o painel **🔍 Eventos do jogo** (expansível) mostra os eventos recebidos via `postMessage`:
  - `game_started`
  - `question_answered` com resultado e pontuação
  - `score_updated`
  - `game_finished` com resultado final
- O runner envia contexto inicial (`platform_context`) com:
  - `mode`, `origin`
  - `room_code`, `room_id`, `room_name` (quando aplicável)
  - `participant.id`, `participant.display_name`, `participant.source` (quando aplicável)
  - `grade`, `subject` (quando aplicável)
  - `activity.id`, `activity.status`, `activity.origin`

### 9. Validar histórico, participantes e persistência da Prioridade 5
1. Após iniciar a atividade e jogar alguns segundos, volte para `http://localhost:3000/professor`
2. Confira o bloco **🕘 Histórico recente de atividades**
3. Valide:
   - status da atividade
   - jogo associado
   - horário de início/fim
   - quantidade de eventos
   - última pontuação conhecida
   - participantes com status (`joined`, `active`, `finished`) e score individual
4. Em `http://localhost:3000/admin`, confira a seção **🧾 Histórico recente de atividades**
5. Opcionalmente, abra `http://localhost:8000/docs` e consulte:
   - `GET /api/activities`
   - `GET /api/activities/{activity_id}`
   - `GET /api/activities/{activity_id}/participants`
   - `GET /api/activities/participants/list`
   - `POST /api/activities/ensure`
   - `POST /api/activities/{activity_id}/events`

## Conceitos da Prioridade 5

- **Sala**: agrupador pedagógico por código, criado pelo professor, com jogo selecionado e estado de turma (`waiting`, `active`, `finished`).
- **Atividade / sessão**: registro persistido de uma execução pedagógica vinculada a um jogo e, quando aplicável, a uma sala. Guarda origem, status, timestamps e resumo do uso.
- **Execução do jogo**: abertura concreta do runner/iframe por professor ou aluno usando o contexto de uma atividade. Uma execução envia eventos para a atividade atual; no futuro isso permite acompanhamento quase em tempo real sem trocar o modelo base.
- **Participante**: entrada de aluno/dispositivo na sala/atividade. É separado da futura lista oficial de alunos (roster) e guarda identificação mínima, status e resultado da participação.

## Geração de pacote `.edugame` de exemplo

```bash
cd examples/quiz-basico
zip -r quiz-basico-v1.edugame .
```

O arquivo gerado pode ser importado pelo painel admin.

## Catálogo e modos de jogo

- 🎯 **Solo** — jogo individual
- ⚔️ **Duelo Local** — 2 jogadores no mesmo computador
- 🌐 **Sala por Código** — partida via código de sala

## Documentação

- [`docs/how-to-run.md`](docs/how-to-run.md) — passo a passo local com Docker e smoke test
- [`docs/architecture.md`](docs/architecture.md) — visão geral da arquitetura atual
- [`docs/edugame-spec.md`](docs/edugame-spec.md) — formato dos pacotes `.edugame`
- [`frontend/README.md`](frontend/README.md) — frontend React/Vite do EduLab Games
- [`backend/README.md`](backend/README.md) — backend FastAPI do EduLab Games
