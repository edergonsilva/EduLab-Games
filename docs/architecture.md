# Arquitetura — EduLab Games

## Visão Geral

O **EduLab Games** é uma plataforma *local-first* de jogos educativos para laboratórios
de informática escolares. A arquitetura é dividida em dois componentes principais que se
comunicam via HTTP/REST.

```
┌─────────────────────────────────────────────────┐
│                  Rede Local (Escola)             │
│                                                  │
│  ┌──────────────┐       ┌──────────────────┐    │
│  │   Frontend   │◄─────►│    Backend       │    │
│  │  React/Vite  │  API  │  Python/FastAPI  │    │
│  │  porta 3000  │       │  porta 8000      │    │
│  └──────────────┘       └──────┬───────────┘    │
│                                │                 │
│                         ┌──────▼──────┐          │
│                         │  Dados      │          │
│                         │  JSON/SQLite│          │
│                         └─────────────┘          │
└─────────────────────────────────────────────────┘
         ▲                       ▲
         │                       │
    Navegador               Administrador
    dos alunos              (via painel web)
```

## Componentes

### Backend (`backend/`)
- **Linguagem:** Python 3.11+
- **Framework:** FastAPI
- **Armazenamento MVP:** Arquivos JSON estáticos + memória (salas/sessões)
- **Armazenamento futuro:** SQLite → PostgreSQL conforme escala

**Rotas principais:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/` | Metadados da plataforma |
| GET | `/api/catalog/grades` | Anos escolares |
| GET | `/api/catalog/subjects` | Disciplinas |
| GET | `/api/games` | Catálogo de jogos |
| GET | `/api/games/{id}` | Detalhes de um jogo |
| POST | `/api/rooms` | Criar sala |
| GET | `/api/rooms/{code}` | Obter sala |
| POST | `/api/rooms/{code}/join` | Entrar na sala |
| POST | `/api/rooms/{code}/start` | Iniciar partida |
| POST | `/api/admin/login` | Login do administrador |
| POST | `/api/import/edugame` | Importar módulo .edugame |
| GET | `/api/import/edugame/spec` | Especificação .edugame |

### Frontend (`frontend/`)
- **Framework:** React 19 + TypeScript
- **Build:** Vite
- **Roteamento:** React Router v7
- **Requisições:** TanStack Query + Axios
- **Estilo:** CSS puro com variáveis de tema (sem framework externo)

**Rotas do frontend:**
| Rota | Tela |
|------|------|
| `/` | Tela inicial — escolha do ano escolar |
| `/disciplinas/:grade` | Escolha de disciplina |
| `/jogos/:grade/:subject` | Catálogo de jogos |
| `/entrar-sala` | Entrar por código de sala |
| `/professor` | Painel do professor |
| `/admin` | Painel administrativo |
| `/sobre` | Sobre / Créditos |

## Perfis de Usuário

| Perfil | Autenticação | Acesso |
|--------|-------------|--------|
| Aluno | Nenhuma | Jogo solo, duelo local, sala por código |
| Professor | Nenhuma (MVP) | Criar sala, acompanhar partidas |
| Administrador | Senha única local | Importar/publicar jogos, gerenciar turmas |

## Fluxo Principal — Aluno

```
Tela Inicial
    │
    ▼
Escolha do Ano (1º–9º)
    │
    ▼
Escolha da Disciplina
    │
    ▼
Catálogo de Jogos
    │
    ├─► Jogo Solo / Duelo Local → iniciar diretamente
    └─► Sala por Código → entrar com código → aguardar professor
```

## Infraestrutura Local

O sistema é desenhado para rodar em um único computador/servidor do laboratório.
Os alunos acessam via navegador na rede local (sem necessidade de internet).

```
Servidor da Escola
├── Docker Compose
│   ├── edulab-backend  (porta 8000)
│   └── edulab-frontend (porta 3000)
└── Volume persistente (edulab-data)
```

## Planos Futuros

- WebSocket para salas em tempo real
- Autenticação JWT para admin/professor
- SQLite persistente com migrações
- Sincronização remota de jogos publicados
- Painel de analytics pedagógico
- Importação de alunos via PDF
