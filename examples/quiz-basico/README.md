# Quiz Básico — Módulo .edugame de Exemplo

Este módulo é um exemplo de jogo de **Quiz de Múltipla Escolha** para a plataforma
**EduLab Games**. Ele demonstra o padrão de empacotamento `.edugame` e a comunicação
com a plataforma via `window.postMessage`.

## Estrutura

```
quiz-basico/
├── manifest.json    ← metadados do jogo
├── index.html       ← jogo completo (HTML5 + CSS + JS inline)
├── preview/
│   └── cover.png    ← imagem de capa (gerar ou substituir)
└── README.md        ← este arquivo
```

## Como empacotar

```bash
cd examples/quiz-basico
zip -r ../../quiz-basico-v1.edugame manifest.json index.html preview/ README.md
```

## Como importar na plataforma

1. Acesse o **Painel Administrativo** (`/admin`)
2. Faça login com a senha de administrador
3. Vá em **Importar Jogo (.edugame)**
4. Selecione o arquivo `quiz-basico-v1.edugame`
5. O jogo será importado com status **teste**
6. Teste o jogo e depois publique

## Customizar as perguntas

Edite o array `QUESTIONS` no arquivo `index.html`:

```js
const QUESTIONS = [
  {
    question: "Sua pergunta aqui?",
    options: ["Opção A", "Opção B", "Opção C", "Opção D"],
    correct: 0,  // índice da resposta correta (0 = A, 1 = B, ...)
  },
  // ...
]
```

## Comunicação com a plataforma

Este módulo emite os seguintes eventos via `window.postMessage`:

| Evento | Quando |
|--------|--------|
| `game_started` | Ao carregar o jogo |
| `question_answered` | Ao responder uma pergunta |
| `game_finished` | Ao finalizar todas as perguntas |

Consulte `docs/edugame-spec.md` para a referência completa.
