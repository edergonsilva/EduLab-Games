# 🎮 EduLab Games

**Plataforma de jogos educativos para laboratórios de informática escolares.**

> Desenvolvida por **Ederson Gonçalves da Silva**  
> Visual inspirado nas cores da bandeira de Itajaí (amarelo & roxo)

---

## ✨ O que é o EduLab Games?

EduLab Games é uma plataforma *local-first* que transforma o laboratório de informática
da escola em um ambiente de aprendizagem interativo e gamificado. Professores criam salas
com código (estilo Kahoot), alunos acessam pelo navegador, e jogos educativos são
distribuídos como módulos `.edugame` importáveis.

## 🏫 Disciplinas (MVP)

| Disciplina | | Disciplina |
|---|---|---|
| 🔢 Matemática | | 📖 Língua Portuguesa |
| 🌎 Língua Estrangeira - Inglês | | 📜 História |
| 🗺️ Geografia | | 🔬 Ciências |
| 🎨 Artes | | ✨ Ensino Religioso |
| ⚽ Educação Física | | 🚀 Projeto Integrador |
| 🎵 Musicalização | | |

## 🕹️ Modos de Jogo

- 🎯 **Solo** — jogo individual
- ⚔️ **Duelo Local** — 2 jogadores no mesmo computador
- 🌐 **Sala por Código** — múltiplos computadores via código único

## 🚀 Como Rodar

### Com Docker (recomendado)

```bash
git clone https://github.com/edergonsilva/EduLab-Games.git
cd EduLab-Games

# Configurar senha do admin (opcional)
echo "ADMIN_PASSWORD=minha-senha" > .env

# Subir os serviços
docker compose up --build
```

| Serviço | URL |
|---------|-----|
| 🌐 Plataforma | http://localhost:3000 |
| 🔧 API Backend | http://localhost:8000 |
| 📖 Docs da API | http://localhost:8000/docs |

Consulte [`docs/how-to-run.md`](docs/how-to-run.md) para mais detalhes,
incluindo modo de desenvolvimento local.

## 📦 Módulos de Jogo (.edugame)

Os jogos são empacotados como arquivos `.edugame` (ZIP renomeado) com manifesto JSON.
Veja o exemplo em [`examples/quiz-basico/`](examples/quiz-basico/) e a especificação
completa em [`docs/edugame-spec.md`](docs/edugame-spec.md).

```json
{
  "id": "mat_contas_001",
  "name": "Contas Básicas",
  "version": "1.0.0",
  "developer": "Seu Nome",
  "mode": ["solo"],
  "school_grades": [1, 2, 3],
  "subject": "matematica",
  "entry_point": "index.html",
  "api_version": "1.0"
}
```

## 📁 Estrutura do Repositório

```
EduLab-Games/
├── backend/           # API Python/FastAPI
│   ├── app/
│   │   ├── routers/   # Rotas da API
│   │   ├── models/    # Schemas Pydantic
│   │   ├── services/  # Lógica de negócio
│   │   └── data/      # Dados estáticos (anos, disciplinas, jogos)
│   └── Dockerfile
├── frontend/          # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/     # Telas da aplicação
│   │   ├── components/# Componentes reutilizáveis
│   │   └── services/  # Chamadas à API
│   └── Dockerfile
├── docs/              # Documentação técnica
│   ├── architecture.md
│   ├── edugame-spec.md
│   └── how-to-run.md
├── examples/          # Exemplos de módulos .edugame
│   └── quiz-basico/
└── docker-compose.yml
```

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| [Arquitetura](docs/architecture.md) | Visão geral do sistema |
| [Como Rodar](docs/how-to-run.md) | Instruções de instalação |
| [Spec .edugame](docs/edugame-spec.md) | Padrão de módulos de jogo |

## 🗺️ Roadmap (pós-MVP)

- [ ] WebSocket para salas em tempo real
- [ ] Painel do professor com acompanhamento ao vivo
- [ ] Autenticação JWT para admin/professor
- [ ] Importação de alunos via PDF (Secretaria de Itajaí)
- [ ] Banco de dados SQLite persistente
- [ ] Motor de jogos: arrastar e soltar, desafio de contas
- [ ] Sincronização remota de jogos publicados

---

<p align="center">
  Desenvolvido com 💜 por <strong>Ederson Gonçalves da Silva</strong><br>
  para as escolas municipais de Itajaí e região 🌟
</p>
