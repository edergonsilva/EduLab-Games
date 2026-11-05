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
├── banner.png          ← optional catalog cover (recommended: 1280 x 560)
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
| `thumbnail`   | string | —        | Relative path to a catalog cover, e.g. `"banner.png"`. |

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
  "thumbnail": "banner.png"
}
```

For consistent game cards, use a PNG banner with a 16:7 aspect ratio (1280 x
560 pixels or larger). Keep the main subject centered so `object-fit: cover`
does not crop important details on smaller cards. The image is optional for
older packages; the library displays a fallback when a cover is missing.

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

## Activity scores

The platform does not infer a score from a game's screen. A game must send score
updates to its parent window for the teacher dashboard to record them. Send
progress updates whenever the score changes:

```js
window.parent.postMessage({
  type: 'activity_event',
  event_type: 'progress',
  score: currentScore,
}, '*')
```

When the student completes the game, send a final result:

```js
window.parent.postMessage({
  type: 'activity_result',
  score: finalScore,
}, '*')
```

`score` must be a number. The runner stores each event, updates the participant's
latest score, and marks the participant complete when it receives
`activity_result`. Games that do not implement these messages can still run, but
their scores and completion state will not appear in the competition dashboard.

New games may use the optional global `window.EduLabSDK`, loaded with
`<script src="/edulab-sdk.js"></script>`. The SDK exposes `score(number)`,
`progress({ current, total })`, `completed({ score, metadata })`,
`error({ message })`, `on(name, callback)`, `isEmbedded()`, `isStarted()`, and
`isFinished()`. It uses a session nonce and validates messages from the parent.
The runner continues to accept the legacy `activity_event`, `activity_result`,
`edulab.activity.event`, and `edulab.activity.result` messages.

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
