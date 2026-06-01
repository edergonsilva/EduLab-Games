# Packaging .edugame files

This guide explains how to create a `.edugame` package from a game directory
using the official packager.

---

## Prerequisites

- Python 3.10 or higher (no extra dependencies needed for the tool itself)
- A game directory with the structure described in [`edugame-spec.md`](edugame-spec.md)

---

## Quick start

```bash
# Validate the game directory without creating a file
python tools/package_edugame.py path/to/my-game/ --validate-only

# Package to dist/ (auto-generated filename: {slug}-{version}.edugame)
python tools/package_edugame.py path/to/my-game/

# Custom output directory
python tools/package_edugame.py path/to/my-game/ --output-dir releases/

# Custom filename
python tools/package_edugame.py path/to/my-game/ --output-name my-game.edugame
```

---

## Example: minimal game layout

```
my-game/
├── manifest.json
├── index.html
├── styles.css
└── script.js
```

`manifest.json`:
```json
{
  "slug": "meu-jogo-exemplo",
  "title": "Meu Jogo Exemplo",
  "version": "1.0.0",
  "description": "Um jogo de exemplo",
  "author": "Você"
}
```

Run:
```bash
python tools/package_edugame.py my-game/
# → dist/meu-jogo-exemplo-1-0-0.edugame
```

---

## Incrementing the version

Update `version` in `manifest.json` before packaging:

```json
{
  "slug": "meu-jogo-exemplo",
  "version": "1.1.0",
  ...
}
```

Then reimport via the platform UI or API.  The platform will automatically
**remove all artefacts from the previous version** before extracting the new
one — see [reimportation](edugame-spec.md#reimportation--clean-replacement).

---

## Important: use relative asset paths

Your `index.html` **must** reference CSS, JS, and images using **relative paths**:

```html
<!-- Correct -->
<link rel="stylesheet" href="styles.css">
<script src="script.js"></script>
<img src="assets/logo.png">

<!-- Wrong — will 404 after import -->
<link rel="stylesheet" href="/styles.css">
```

The platform serves your game from:
```
/static/imported/{slug}/{version}/
```

Absolute paths break because they resolve from the server root, not from your
game's sub-directory.

---

## CI/CD integration

```yaml
# .github/workflows/package.yml
- name: Package game
  run: python tools/package_edugame.py game/ --output-dir dist/

- name: Upload artefact
  uses: actions/upload-artifact@v4
  with:
    name: edugame-package
    path: dist/*.edugame
```
