# .edugame Package Specification

A `.edugame` file is a standard ZIP archive with a specific internal structure
that allows EduLab Games to import, extract, and serve the game as a
standalone web application.

---

## Internal structure

```
my-game.edugame  (ZIP)
├── manifest.json       ← required
├── index.html          ← required (game entry point)
├── styles.css          ← recommended
├── script.js           ← recommended
└── assets/             ← optional sub-directory for images, sounds, etc.
    ├── logo.png
    └── sound.mp3
```

### manifest.json

| Field         | Type   | Required | Description                                              |
|---------------|--------|----------|----------------------------------------------------------|
| `slug`        | string | ✅        | Stable, URL-safe identifier.  Must match `[a-z0-9-]+`.  |
| `title`       | string | ✅        | Human-readable game title.                               |
| `version`     | string | ✅        | Semantic version string, e.g. `"1.0.0"`.                |
| `description` | string | —        | Short description shown in the catalog.                  |
| `author`      | string | —        | Creator / institution.                                   |
| `grade`       | string | —        | Target school grade, e.g. `"2ano"`.                     |
| `subject`     | string | —        | Subject area, e.g. `"matematica"`.                      |
| `thumbnail`   | string | —        | Relative path to a cover image, e.g. `"assets/thumb.png"`. |

Example:

```json
{
  "slug": "edulab-matematica-cdu-2ano",
  "title": "Jogo CDU — Matemática 2º Ano",
  "version": "1.0.0",
  "description": "Exercício de centena, dezena e unidade",
  "author": "EduLab Team",
  "grade": "2ano",
  "subject": "matematica",
  "thumbnail": "assets/thumb.png"
}
```

### index.html

The game entry point.  It **must** reference its assets with **relative paths**,
because the platform serves files from a versioned sub-directory:

```
/static/imported/{slug}/{version}/
```

Correct:
```html
<link rel="stylesheet" href="styles.css">
<script src="script.js"></script>
<img src="assets/logo.png">
```

Incorrect (absolute paths break when served from a sub-directory):
```html
<link rel="stylesheet" href="/styles.css">
```

---

## Versioning and the `slug` identifier

The `slug` is the **stable identity** of a game.  The platform stores one
active version of each slug at a time.  The `version` field is used to
namespace the extracted files on disk:

```
data/static/imported/{slug}/{version}/
```

If you need to maintain multiple concurrent versions of a game, use distinct
slugs (e.g. `meu-jogo-v1`, `meu-jogo-v2`).

---

## Reimportation — clean replacement

When a `.edugame` file whose `slug` already exists in the catalog is imported,
the platform performs a **clean replacement**:

1. Locate the previous game record by `slug`.
2. **Remove** the extracted static directory (`data/static/imported/{slug}/{old-version}/`).
3. **Remove** the previous `.edugame` package file (`data/packages/{slug}.edugame`).
4. **Delete** the database row.
5. Save the new package, extract it, and insert a new database row.

**Why this matters:**  Without this step, if you reimport a game that moved
`styles.css` to `assets/styles.css`, the old top-level `styles.css` would
still be on disk and could be served, making the new version appear broken.

**Isolation guarantee:**  Only the game matching the exact incoming `slug` is
removed.  Games with different slugs are never affected.

The API response for a reimport includes `"replaced": true` and a human-readable
message confirming the cleanup.

---

## Security

The import endpoint guards against **path-traversal** attacks: any entry in the
ZIP whose resolved path falls outside the extraction directory is silently
skipped and logged as a warning.
