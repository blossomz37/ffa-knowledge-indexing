# AGENTS.md

Authoritative, agent-facing notes for working in this repo. Internal only — not user docs. The current user-facing v1.1 note is `README_v1.1.md`; the original v1.0 README is preserved as `README_1.0.md`. `CLAUDE.md` intentionally just points here.

## What this is

**TranscriptDB v1.1 / FFA Knowledge Indexing** — Carlo's browser-first fork of the original TranscriptDB app. It gives Future Fiction Academy a searchable, full-text and semantic database of summit transcripts, Teachable course lectures, and imported Markdown/text reference documents, with optional OpenRouter AI Q&A and a local video archive.

The stack is still vanilla JS frontend, Express + better-sqlite3 (FTS5) backend, Puppeteer scraping, ffmpeg video download, and Electron packaging support. For this fork, day-to-day use and development should prefer the browser app; Electron is secondary and can hit native-module rebuild friction.

## Branch & remote policy — READ FIRST

- `origin` = `https://github.com/wmiles81/ffa-transcript-db.git` — **not Carlo's repo.** Carlo has push access but this is wmiles81's project.
- Carlo's v1.1 fork target is `https://github.com/blossomz37/ffa-knowledge-indexing`. Do not assume it is configured as a remote; check `git remote -v`.
- **Never commit or push to `origin/main`.** Carlo's changes are personal/experimental unless explicitly stated otherwise.
- Always work on a local branch (`carlo/<topic>`). Confirm with `git branch --show-current` before committing.
- A bare `git push` should fail (no upstream) — that's the intended safety net. Do not set an upstream or push unless Carlo explicitly asks. If he does, prefer a personal fork over pushing branches to `origin`.
- Commit messages end with the `Co-Authored-By: Claude Opus 4.7` trailer (per global git habits). Commit per logical unit; don't batch unrelated changes.

## Run & build

| Task | Command |
|---|---|
| Dev (API only) | `npm start` → API on :3001 |
| Dev browser-first API | `npm run dev:server` → API/web app on :3001, then open `http://127.0.0.1:3001` |
| Dev (API + Vite HMR) | `npm run dev` → :3001 + :5173 |
| Dev Vite client only | `npm run dev:client` |
| Dev Electron | `npm run dev:electron` |
| Build frontend | `npm run build` (stamps version, then `vite build` → `dist/`) |
| Mac DMG | `npm run dist:electron:mac` → `_dist/` |
| Win / Linux / all | `dist:electron:win` / `:linux` / `:all` |
| Zip bundle | `npm run dist` → `_dist/ffa-transcript-db-v$npm_package_version.zip` |
| Import transcripts | put JSON in `data/`, then `npm run import` |
| Archive videos (CLI) | `npm run archive-videos -- <courseId>` |

`DATA_DIR` env var overrides where the DB/settings live. `ffmpeg` must be on PATH for archiving.

Browser-first note: if Electron and `npm run dev:server` disagree about `better-sqlite3-multiple-ciphers` native module versions, prioritize getting browser mode running unless Carlo explicitly asks for Electron packaging/debugging.

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
docs/v1/                   Timestamped v1 plans/session logs (historical context)
docs/v1.1/                 v1.1 implementation specs
docs/private/              Carlo-local private docs; ignored, do not commit
docs/screenshots/          QA/proof screenshots for AI/source/markdown/browser behavior
README_1.0.md              Preserved original README
README_v1.1.md             Current v1.1 user-facing notes
CHANGELOG.md               Keep-a-Changelog format
```

## Conventions & gotchas

- **Single source of version truth = `package.json` (`version`).** Electron builder artifact names and the package build version derive from it. When bumping app version, update `package.json` and any versioned README/changelog references that still mention downloadable artifacts.
- **README layout is intentionally versioned.** Do not recreate a root `README.md` just because older scripts/docs mention it. Current docs are `README_v1.1.md` and `README_1.0.md`. If packaging still needs a root README, ask Carlo before changing the layout or update the packaging script deliberately.
- **Known drift to watch:** README files and `CHANGELOG.md` have historically lagged `package.json` (stamp-version auto-bumps the patch on every build). The `dist` script may still encode assumptions from the old root-README layout. CHANGELOG is manually maintained and can lag.
- **v1.1 AI knowledge features:** Hybrid retrieval combines FTS and cached embeddings. Imported `.md`, `.markdown`, and `.txt` files become global library documents; use Settings → Semantic Index → `Index docs`, `Index current course`, or `Build full index` to build embeddings. `Index docs` is the fast path after importing documents.
- **AI citations:** The model should cite as `[Source N](source:N)`. The client renders Markdown and tolerates malformed source references, converting known source numbers into clickable in-app citation buttons.
- **Paste/import scope:** `Paste Link` currently supports Teachable course URLs. `Import Doc` supports local Markdown/text documents as global references, not course-specific attachments.
- **Puppeteer Chromium bundling (verified by real packaged-build test):** `scripts/stage-puppeteer.mjs` copies the single Chromium build that the installed `puppeteer` pins (`puppeteer.executablePath()` → host-platform build only) into project-relative `.puppeteer-bundle/chrome` (gitignored). The `dist:electron:*` scripts run it via `npm run stage-puppeteer` before `electron-builder`. `electron-builder.yml` references it with a **relative** `from: .puppeteer-bundle/chrome` — do NOT switch this to an absolute or `${env.HOME}` path: electron-builder treats macro-expanded `from:` as project-relative and mangles it to `<proj>//Users/...`. At runtime `electron/main.cjs` sets `PUPPETEER_CACHE_DIR` to `Resources/puppeteer-cache` when `app.isPackaged`, so `scraper.js`'s plain `puppeteer.launch()` finds the bundled Chrome with no end-user install. Confirmed: packaged `puppeteer.executablePath()` resolves to the bundled binary and it exists. Caveat: a macOS build only stages mac_arm; working win/linux bundles need `npx puppeteer browsers install chrome` for those platforms plus a richer staging script.
- **Don't copy the whole `~/.cache/puppeteer/chrome`** into the bundle — multiple cached versions bloated the `.app` to ~3 GB and broke `hdiutil` DMG creation (`resize ... Invalid argument`). Stage exactly one build.
- **Gitignored:** `data/` (runtime DB, cookies, settings), `dist/` (built frontend), `_dist/` (packaged builds), `.puppeteer-bundle/` (staged Chromium), `docs/private/` (Carlo-local private docs). Never expect or commit these.
- **Mac builds are NOT signed on Carlo's machine** — `electron-builder.yml` sets `identity: WILLIAM MILES (76R466YDPC)`, which isn't in Carlo's keychain, so signing is *skipped* (build log: "skipped macOS application code signing"). README says "signed but not notarized"; for Carlo-produced builds it's neither. `notarize: false` is intentional.
- Cookies (`data/cookies.json`) are Teachable session credentials — never commit, never echo, never include in any bundle.

## App data locations (for debugging)

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/ffa-transcript-db/` |
| Windows | `%APPDATA%\ffa-transcript-db\` |
| Linux | `~/.config/ffa-transcript-db/` |

Media library (archived videos) is a user-chosen folder, separate from app data, changeable in Settings without touching the DB.

## Where to look for context

- `README_v1.1.md` — current user-facing notes for this fork.
- `README_1.0.md` — original v1.0 README preserved for comparison.
- `CHANGELOG.md` — what shipped per version, in detail, though it may lag.
- `docs/v1/` — timestamped v1 plans/session logs.
- `docs/v1.1/` — current v1.1 specs, especially AI knowledge / URL / file ingestion behavior.
- `docs/private/` — Carlo-local private notes, intentionally ignored. Do not quote, commit, or rely on these for public docs unless Carlo explicitly asks.
