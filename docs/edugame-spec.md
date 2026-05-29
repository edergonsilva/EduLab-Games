# Especificação do módulo `.edugame`

## Visão geral

Um `.edugame` é um arquivo ZIP renomeado contendo um jogo HTML5 e seu manifesto.

```text
meu_jogo_v1.edugame
```

## Estrutura esperada

```text
meu_jogo_v1.edugame
├── manifest.json
├── index.html
├── assets/              # opcional
├── preview/             # opcional
│   └── cover.png        # opcional
└── README.md            # opcional
```

## Manifesto de exemplo

```json
{
  "id": "mat_contas_basicas_001",
  "name": "Contas Básicas",
  "version": "1.0.0",
  "developer": "Nome do Desenvolvedor",
  "credits": "Desenvolvido por Nome do Desenvolvedor",
  "school_grades": [1, 2, 3],
  "subject": "matematica",
  "tags": ["adição", "subtração"],
  "mode": ["solo"],
  "min_players": 1,
  "max_players": 1,
  "session_required": false,
  "supports_teacher_panel": false,
  "supports_ranking": false,
  "estimated_duration_minutes": 10,
  "entry_point": "index.html",
  "thumbnail": "preview/cover.png",
  "description": "Jogo de contas básicas.",
  "api_version": "1.0"
}
```

## Campos do manifesto

| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| `id` | string | ✅ | identificador do jogo |
| `name` | string | ✅ | nome exibido |
| `version` | string | ✅ | versão semântica |
| `developer` | string | ✅ | autor/desenvolvedor |
| `credits` | string | ❌ | créditos exibidos |
| `school_grades` | int[] | ✅ | anos compatíveis |
| `subject` | string\|null | ✅ | disciplina ou `null` para geral |
| `tags` | string[] | ❌ | palavras-chave |
| `mode` | string[] | ✅ | `solo`, `duelo_local`, `sala_codigo` |
| `min_players` | int | ❌ | padrão `1` |
| `max_players` | int | ❌ | padrão `1` |
| `session_required` | bool | ❌ | use `true` apenas se o jogo funcionar **somente** via `sala_codigo` |
| `supports_teacher_panel` | bool | ❌ | reservado para integração futura |
| `supports_ranking` | bool | ❌ | reservado para integração futura |
| `estimated_duration_minutes` | int | ❌ | duração estimada |
| `entry_point` | string | ✅ | arquivo HTML existente no pacote |
| `thumbnail` | string | ❌ | imagem opcional; se não existir, o catálogo usa fallback visual |
| `description` | string | ❌ | descrição curta |
| `status` | string | ❌ | ignorado no import atual; o backend salva sempre como `test` |
| `api_version` | string | ✅ | versão da API da plataforma |

## Regras práticas do MVP local

- o backend valida `manifest.json`, `index.html` e `entry_point`
- o pacote importado é salvo localmente
- os arquivos são extraídos para um diretório controlado pelo backend
- o jogo é persistido em SQLite com status inicial `test`
- se um jogo com o mesmo `id` + `version` for importado novamente, o registro é atualizado em vez de duplicado
- se `thumbnail` não existir, o jogo continua válido e o frontend mostra um placeholder

## Fluxo atual de publicação

1. o admin importa um `.edugame`
2. o backend valida e salva o pacote
3. o jogo entra em `test`
4. o admin pode publicar no painel mínimo atual
5. jogos `published` aparecem no catálogo principal

## Contrato shell ↔ jogo (runner)

### Evento inicial enviado pela plataforma

Assim que o iframe carrega, o runner envia:

```json
{
  "type": "platform_context",
  "schema_version": "1.1",
  "game": {
    "id": "meu_jogo",
    "name": "Meu Jogo",
    "subject": "matematica",
    "grades": [2, 3]
  },
  "activity": {
    "id": "activity_xxx",
    "status": "active",
    "origin": "room"
  },
  "context": {
    "mode": "solo",
    "origin": "catalog",
    "room_code": "123456",
    "room_id": "room_xxx",
    "room_name": "Turma de hoje",
    "grade": 2,
    "subject": "matematica"
  }
}
```

Campos de sala são opcionais e só aparecem em fluxos de sala por código.

### Eventos esperados do jogo para a plataforma

Eventos já suportados no MVP:

- `game_started`
- `question_answered`
- `score_updated`
- `game_finished`

Eventos opcionais para evolução:

- `ready`
- `request_state`
- `pause`

Também é aceito o formato envelope:

```json
{ "type": "edulab_event", "event": "ready" }
```

Quando o jogo envia `ready` ou `request_state`, o runner responde com:

```json
{ "type": "platform_state", "score": 10, "started": true, "finished": false }
```

### Encaminhamento shell ↔ backend

Na Prioridade 4, o shell também:

1. garante uma atividade persistida via `POST /api/activities/ensure`
2. recebe o `postMessage` do jogo
3. valida minimamente o tipo de evento
4. encaminha o evento para `POST /api/activities/{activity_id}/events`
5. o backend grava `timestamp`, `activity_id`, `room_id`/`room_code`, `game_id`, `event_type` e `payload`

Limites atuais:

- sem WebSocket ou sincronização completa em tempo real
- sem identificação individual avançada por aluno autenticado
- histórico resumido por atividade, ainda sem analytics sofisticados

## Empacotando um exemplo

```bash
cd examples/quiz-basico
zip -r quiz-basico-v1.edugame .
```

O arquivo gerado já pode ser usado no painel admin.
