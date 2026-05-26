# Especificação do Módulo .edugame

## O que é um módulo .edugame?

Um pacote `.edugame` é um arquivo **ZIP renomeado** que contém um jogo educativo
completo, pronto para ser importado na plataforma EduLab Games.

```
meu_jogo_v1.edugame   ←── na prática é um ZIP
```

## Estrutura do pacote

```
meu_jogo_v1.edugame
├── manifest.json        ← OBRIGATÓRIO — metadados do jogo
├── index.html           ← OBRIGATÓRIO — ponto de entrada HTML5
├── assets/              ← opcional — imagens, sons, fontes
│   ├── bg.png
│   ├── icon.png
│   └── sounds/
│       └── correct.mp3
├── preview/
│   └── cover.png        ← opcional — capa exibida no catálogo
└── README.md            ← opcional — documentação do módulo
```

## manifest.json — Referência completa

```json
{
  "id":                         "mat_contas_basicas_001",
  "name":                       "Contas Básicas",
  "version":                    "1.0.0",
  "developer":                  "Nome do Desenvolvedor",
  "credits":                    "Desenvolvido por Nome do Desenvolvedor",
  "school_grades":              [1, 2, 3],
  "subject":                    "matematica",
  "tags":                       ["adição", "subtração", "raciocínio"],
  "mode":                       ["solo"],
  "min_players":                1,
  "max_players":                1,
  "session_required":           false,
  "supports_teacher_panel":     true,
  "supports_ranking":           true,
  "estimated_duration_minutes": 10,
  "entry_point":                "index.html",
  "thumbnail":                  "preview/cover.png",
  "description":                "Jogo de contas básicas com pontuação e feedback visual.",
  "status":                     "test",
  "api_version":                "1.0"
}
```

## Descrição dos campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | ✅ | Identificador único. Use padrão `{disciplina}_{nome}_{número}`. |
| `name` | string | ✅ | Nome exibido na plataforma. |
| `version` | string | ✅ | Versão semântica (ex: `1.0.0`). |
| `developer` | string | ✅ | Nome do desenvolvedor/autor do jogo. |
| `credits` | string | ❌ | Texto de créditos exibido dentro do jogo. |
| `school_grades` | int[] | ✅ | Anos escolares compatíveis. Ex: `[1,2,3]` para 1º–3º ano. |
| `subject` | string\|null | ✅ | ID da disciplina (ver `/api/catalog/subjects`). `null` = todas. |
| `tags` | string[] | ❌ | Palavras-chave para busca. |
| `mode` | string[] | ✅ | Modos de jogo suportados (ver abaixo). |
| `min_players` | int | ❌ | Mínimo de jogadores. Padrão: `1`. |
| `max_players` | int | ❌ | Máximo de jogadores. Padrão: `1`. |
| `session_required` | bool | ❌ | Se `true`, o jogo requer um código de sala. |
| `supports_teacher_panel` | bool | ❌ | Se `true`, emite eventos para o painel do professor. |
| `supports_ranking` | bool | ❌ | Se `true`, a plataforma pode exibir ranking. |
| `estimated_duration_minutes` | int | ❌ | Duração estimada em minutos. |
| `entry_point` | string | ✅ | Arquivo HTML de entrada dentro do pacote. |
| `thumbnail` | string | ❌ | Caminho da imagem de capa dentro do pacote. |
| `description` | string | ❌ | Descrição curta exibida no catálogo. |
| `status` | string | ❌ | `draft` \| `test` \| `published` \| `archived`. A plataforma ignora e força `test` no import. |
| `api_version` | string | ✅ | Versão da API da plataforma. Use `"1.0"`. |

## Modos de jogo (`mode`)

| Valor | Descrição |
|-------|-----------|
| `solo` | Jogo individual. Sem código de sala. |
| `duelo_local` | 2 jogadores no mesmo computador, alternando turnos ou simultâneo. |
| `sala_codigo` | Múltiplos computadores. Requer criação de sala pelo professor. |

Um jogo pode suportar múltiplos modos: `["solo", "sala_codigo"]`.

## Comunicação com a plataforma

O jogo HTML5 deve se comunicar com a plataforma via `window.postMessage`.

### Eventos emitidos pelo jogo (→ plataforma)

```js
// Jogo iniciou
window.parent.postMessage({ type: 'game_started', gameId: 'meu_jogo' }, '*')

// Jogador respondeu uma questão
window.parent.postMessage({
  type: 'question_answered',
  player: 'Maria',
  correct: true,
  score: 100
}, '*')

// Pontuação atualizada
window.parent.postMessage({
  type: 'score_updated',
  player: 'Maria',
  score: 250
}, '*')

// Jogo encerrou
window.parent.postMessage({
  type: 'game_finished',
  results: [{ player: 'Maria', score: 250, correct: 8, wrong: 2 }]
}, '*')
```

### Eventos recebidos pela plataforma (→ jogo)

```js
window.addEventListener('message', (event) => {
  const { type, payload } = event.data
  if (type === 'start_game')   { /* iniciar lógica do jogo */ }
  if (type === 'pause_game')   { /* pausar */ }
  if (type === 'resume_game')  { /* retomar */ }
  if (type === 'end_game')     { /* encerrar */ }
})
```

## Fluxo de publicação

```
1. Desenvolvedor empacota o jogo como .edugame
2. Admin faz upload via painel → POST /api/import/edugame
3. Sistema valida manifest + arquivos obrigatórios
4. Jogo entra com status "test"
5. Admin testa o jogo no ambiente local
6. Admin muda status para "published"
7. Jogo aparece no catálogo para alunos e professores
```

## Status possíveis

| Status | Descrição |
|--------|-----------|
| `draft` | Em desenvolvimento. Não visível. |
| `test` | Importado, aguardando testes. Visível apenas para admin. |
| `published` | Publicado. Visível no catálogo para alunos e professores. |
| `archived` | Arquivado. Não visível. |

## Exemplo mínimo

Veja o exemplo completo em `examples/quiz-basico/`.

Para empacotar:
```bash
cd examples/quiz-basico
zip -r quiz-basico-v1.edugame .
mv quiz-basico-v1.edugame quiz-basico-v1.edugame
```
