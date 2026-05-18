# AGENTS.md

Authoritative, agent-facing notes for working in this repo. Internal only — not user docs (that's `README.md`). `CLAUDE.md` intentionally just points here.

## What this is

**TranscriptDB** — an Electron desktop app that gives Future Fiction Academy a searchable, full-text database of summit transcripts and Teachable course lectures, with optional OpenRouter AI Q&A and a local video archive. Vanilla JS frontend, Express + better-sqlite3 (FTS5) backend, Puppeteer scraping, ffmpeg video download.

## Branch & remote policy — READ FIRST

- `origin` = `https://github.com/wmiles81/ffa-transcript-db.git` — **not Carlo's repo.** Carlo has push access but this is wmiles81's project.
- **Never commit or push to `origin/main`.** Carlo's changes are personal/experimental unless explicitly stated otherwise.
- Always work on a local branch (`carlo/<topic>`). Confirm with `git branch --show-current` before committing.
- A bare `git push` should fail (no upstream) — that's the intended safety net. Do not set an upstream or push unless Carlo explicitly asks. If he does, prefer a personal fork over pushing branches to `origin`.
- Commit messages end with the `Co-Authored-By: Claude Opus 4.7` trailer (per global git habits). Commit per logical unit; don't batch unrelated changes.

## Run & build

| Task | Command |
|---|---|
| Dev (API only) | `npm start` → API on :3001 |
| Dev (API + Vite HMR) | `npm run dev` → :3001 + :5173 |
| Dev Electron | `npm run dev:electron` |
| Build frontend | `npm run build` (stamps version, then `vite build` → `dist/`) |
| Mac DMG | `npm run dist:electron:mac` → `_dist/` |
| Win / Linux / all | `dist:electron:win` / `:linux` / `:all` |
| Zip bundle | `npm run dist` → `_dist/ffa-transcript-db-v$npm_package_version.zip` |
| Import transcripts | put JSON in `data/`, then `npm run import` |
| Archive videos (CLI) | `npm run archive-videos -- <courseId>` |

`DATA_DIR` env var overrides where the DB/settings live. `ffmpeg` must be on PATH for archiving.

## Architecture map

```
electron/main.cjs          Electron main process (window, IPC, lifecycle)
scripts/stamp-version.mjs  Writes package.json version into the build (runs in `npm run build`)
server/
  server.js                Express API (:3001) — all /api routes
  db.js                    SQLite + FTS5 schema, migrations
  import.js                JSON transcript importer (npm run import)
  scraper.js               Teachable scraper (Puppeteer)
  archive-orchestrator.js  Drives multi-lecture archive runs, SSE progress
  archive-videos.js        CLI entry for archiving
  media-downloader.js      ffmpeg / m3u8 download, truncation detection
  media-providers.js       Hotmart token extraction, per-frame attribution
  media-library.js         Media-library path resolution
  wiki.js                  LLM entity extraction (Authors/Techniques/Tools/Debates)
src/                       Frontend: index.html, main.js, style.css, help.html
docs/                      Feature/implementation plans + session logs (historical context)
CHANGELOG.md               Keep-a-Changelog format
```

## Conventions & gotchas

- **Single source of version truth = `package.json` (`version`).** The DMG/exe/AppImage names electron-builder produces, the README download instructions, and the `dist` zip name all derive from it. When bumping version, update `package.json`, then keep README filenames in sync.
- **Known drift to watch:** README and `CHANGELOG.md` have historically lagged `package.json`. As of last edit `package.json` = `2.3.6`; CHANGELOG top entry is `2.3.0`. The README filenames were realigned to `2.3.6` and the `dist` script is now version-agnostic (`$npm_package_version`) — don't reintroduce hardcoded versions.
- **`electron-builder.yml` hardcodes `/Users/wmiles49/.cache/puppeteer/chrome`** as the bundled-Chromium source for all three platforms. That path only exists on wmiles49's machine — Mac/Win/Linux `extraResources` will fail or ship no Chromium when built elsewhere. Flag this before attempting a release build on Carlo's machine.
- **Gitignored:** `data/` (runtime DB, cookies, settings), `dist/` (built frontend), `_dist/` (packaged builds). Never expect or commit these.
- **Mac builds are signed (`WILLIAM MILES`) but not notarized** — first-launch Gatekeeper warning is expected and documented in the README. `notarize: false` is intentional for now.
- Cookies (`data/cookies.json`) are Teachable session credentials — never commit, never echo, never include in any bundle.

## App data locations (for debugging)

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/ffa-transcript-db/` |
| Windows | `%APPDATA%\ffa-transcript-db\` |
| Linux | `~/.config/ffa-transcript-db/` |

Media library (archived videos) is a user-chosen folder, separate from app data, changeable in Settings without touching the DB.

## Where to look for context

- `CHANGELOG.md` — what shipped per version, in detail.
- `docs/` — feature plans (`feature-plan_*`), implementation plans, and dated session logs. Good for "why was this built this way" before large changes.
