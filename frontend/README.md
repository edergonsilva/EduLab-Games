# Frontend do EduLab Games

Aplicação web React + Vite + TypeScript responsável pelas telas de aluno, professor e admin.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Fluxos principais já conectados

- seleção de ano e disciplina
- catálogo de jogos publicado
- fallback visual quando thumbnail não existe
- painel do professor consumindo criação/listagem de salas
- painel admin com login simples, upload de `.edugame` e publicação básica

## Desenvolvimento local

Por padrão o Vite sobe em `http://localhost:5173` e faz proxy para o backend em `http://localhost:8000` nas rotas:

- `/api`
- `/health`

## Arquivos principais

- `src/pages/Games.tsx` — catálogo de jogos
- `src/pages/Teacher.tsx` — criação e listagem de salas
- `src/pages/Admin.tsx` — login, upload e gestão básica dos jogos
- `src/services/api.ts` — cliente HTTP do frontend
