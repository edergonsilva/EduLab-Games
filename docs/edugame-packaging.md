# Empacotamento oficial `.edugame`

## O que é um `.edugame`?

Um arquivo `.edugame` é um **ZIP padronizado** com extensão `.edugame`.

- não é um formato binário proprietário diferente de ZIP;
- a extensão `.edugame` identifica o pacote como compatível com o EduLab Games;
- o empacotador oficial automatiza e valida esse processo.

## Estrutura mínima esperada

```text
meu-jogo/
├── manifest.json
├── index.html                  # ou outro arquivo definido em entry_point
└── assets/                     # opcional
```

Obrigatório:

1. `manifest.json`
2. `entry_point` no manifesto apontando para um arquivo existente dentro do pacote

## Empacotador oficial

Script oficial no repositório principal:

```text
tools/package_edugame.py
```

### Uso básico

```bash
python tools/package_edugame.py <diretorio-do-jogo>
```

Por padrão, a saída vai para `<diretorio-do-jogo>/dist/`.

### Opções úteis

```bash
# Validar somente (sem gerar pacote)
python tools/package_edugame.py <diretorio-do-jogo> --validate-only

# Definir diretório de saída
python tools/package_edugame.py <diretorio-do-jogo> --output-dir dist

# Definir nome final
python tools/package_edugame.py <diretorio-do-jogo> --output-name meu-jogo-v1.edugame
```

## Como o backend resolve o `entry_point`

No import (`POST /api/import/edugame`), o backend:

1. lê o `manifest.json`;
2. valida se `entry_point` existe dentro do pacote;
3. extrai os arquivos preservando caminhos relativos;
4. monta a URL de execução usando esse arquivo:
   - jogo nativo da plataforma (seed): `/static/games/{game_id}/{entry_point}`
   - importado: `/static/imported/{game_slug}/{version_slug}/{entry_point}`

## Fluxo completo (autor → plataforma)

1. **Criar** pasta do jogo com `manifest.json`, `entry_point` e assets.
2. **Empacotar** com `tools/package_edugame.py`.
3. **Validar** opcionalmente com `--validate-only`.
4. **Importar** no painel admin (`/admin`) via upload do `.edugame`.
5. **Publicar/testar** no painel admin.
6. **Executar** no runner (`/jogar/:gameId`) pelo catálogo, admin ou fluxo de sala.

## Exemplo reutilizável

Use `examples/quiz-basico` como referência mínima de jogo empacotável:

```bash
python tools/package_edugame.py examples/quiz-basico --output-dir dist
```

Depois importe o arquivo gerado em `dist/` (ex.: `gen_quiz_basico_001-1.0.0.edugame`) no painel admin.
