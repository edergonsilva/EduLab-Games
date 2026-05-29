# 🎮 EduLab Games

Plataforma local-first de jogos educativos para laboratórios de informática escolares.

> Desenvolvida por **Ederson Gonçalves da Silva**  
> Visual inspirado nas cores da bandeira de Itajaí (amarelo & roxo)

## O que já é possível testar neste bootstrap

- catálogo com jogos base + jogos importados persistidos em SQLite
- painel admin com login por senha local, upload real de `.edugame` e publicação básica
- salas persistidas localmente para teste do fluxo professor/aluno
- backend FastAPI + frontend React/Vite prontos para Docker em Linux Mint

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

## Roteiro rápido de smoke test manual

1. subir os containers com `docker compose up --build`
2. validar `http://localhost:8000/health`
3. abrir `http://localhost:3000`
4. acessar **Professor** e criar uma sala
5. acessar **Entrar na Sala** e consultar o código criado
6. acessar **Admin** e fazer login
7. importar um `.edugame`
8. opcionalmente publicar o jogo importado no painel admin
9. voltar ao catálogo e confirmar se o jogo publicado aparece na listagem

## Catálogo e modos de jogo

- 🎯 **Solo** — jogo individual
- ⚔️ **Duelo Local** — 2 jogadores no mesmo computador
- 🌐 **Sala por Código** — partida via código de sala

Jogos podem combinar modos. Quando um jogo suporta `solo` e `sala_codigo`, o catálogo mostra as duas ações; `session_required` só é tratado como obrigatório quando o jogo funciona **apenas** com sala.

## Documentação

- [`docs/how-to-run.md`](docs/how-to-run.md) — passo a passo local com Docker e smoke test
- [`docs/architecture.md`](docs/architecture.md) — visão geral da arquitetura atual
- [`docs/edugame-spec.md`](docs/edugame-spec.md) — formato dos pacotes `.edugame`
- [`frontend/README.md`](frontend/README.md) — frontend React/Vite do EduLab Games
- [`backend/README.md`](backend/README.md) — backend FastAPI do EduLab Games
