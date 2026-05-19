# Agent Handoff - Frontend Code Splitting

**Date:** 2026-05-19
**Repo:** `/Users/carlo/Github/ffa-transcript-db-wmiles-81/ffa-transcript-db`
**Branch:** `carlo/readme-version-fixes`
**Current status:** Clean working tree at handoff creation

## Read First

Start with:

1. [AGENTS.md](../../AGENTS.md)
2. [README_v1.1.md](../../README_v1.1.md)
3. [2026-05-19_07-18_implementation-plan_frontend-code-splitting_v1.md](2026-05-19_07-18_implementation-plan_frontend-code-splitting_v1.md)
4. [2026-05-18_06-37_spec_ai-knowledge-url-file-ingestion_v1.md](2026-05-18_06-37_spec_ai-knowledge-url-file-ingestion_v1.md)

`AGENTS.md` is authoritative for repo rules. Do not push unless Carlo explicitly asks. The current v1.1 user-facing note is `README_v1.1.md`; the original v1.0 README is preserved at `README_1.0.md`.

## Current Repo State

Recent commits:

```text
b05ffce Add frontend code splitting plan
7bf1bbc Update agent repo notes
68de8cc Update README v1.1
3124dd8 Organize docs by version
7c30601 Split README versions
bd8f66b Move screenshots into docs
ca373e8 Update .gitignore
e89645b Add AI feature screenshots
```

## Fork Baseline

Carlo created the public v1.1 fork:

```text
https://github.com/blossomz37/ffa-knowledge-indexing
```

Local remote name:

```text
fork
```

The intended public baseline is `fork/main`. This baseline was created before starting the frontend code-splitting implementation so the fork has a stable checkpoint for all v1.1 AI knowledge, document import, docs, screenshots, README, and handoff work.

Do not push to `origin`. If future work should be published, push explicit refs to `fork`, for example:

```bash
git push fork HEAD:main
```

Important layout:

```text
README_v1.1.md              Current v1.1 user-facing notes
README_1.0.md               Preserved original README
docs/v1/                    Timestamped historical v1 plans/session logs
docs/v1.1/                  v1.1 specs and implementation plans
docs/private/               Ignored Carlo-local private docs; do not commit
docs/screenshots/           Screenshot proof artifacts
src/main.js                 Current large frontend bundle, 3,985 lines
```

## Project Direction

This fork is now browser-first. Electron still exists, but do not prioritize Electron unless Carlo asks. If native module rebuild issues appear, get browser mode working first.

Run browser-first:

```bash
npm run dev:server
```

Open:

```text
http://127.0.0.1:3001
```

For frontend HMR:

```bash
npm run dev
```

## What Changed in v1.1

The key v1.1 work is AI knowledge expansion:

- Hybrid AI retrieval uses SQLite FTS plus cached semantic embeddings.
- Imported `.md`, `.markdown`, and `.txt` files become global searchable reference documents.
- Add Course panel has `Paste Link` and `Import Doc`.
- AI answers render Markdown instead of raw Markdown.
- AI citations/source lists are clickable inside the app.
- Semantic index can be scoped to docs, current course, or full library.

Implementation spec:

[2026-05-18_06-37_spec_ai-knowledge-url-file-ingestion_v1.md](2026-05-18_06-37_spec_ai-knowledge-url-file-ingestion_v1.md)

## Next Task

Implement the frontend code-splitting plan:

[2026-05-19_07-18_implementation-plan_frontend-code-splitting_v1.md](2026-05-19_07-18_implementation-plan_frontend-code-splitting_v1.md)

The plan is intentionally conservative. It is a no-behavior-change refactor of `src/main.js` into ES modules.

## Recommended First Implementation Batch

Begin with Phase 0 and Phase 1 only.

Phase 0:

1. Confirm clean working tree.
2. Run:

```bash
npm run build
```

3. Start:

```bash
npm run dev:server
```

4. Smoke test browser app at `http://127.0.0.1:3001`.

Phase 1 target files:

```text
src/app/state.js
src/app/api.js
src/app/dom.js
src/app/utils/escape.js
src/app/utils/format.js
src/main.js
```

Move only:

- `state`
- `api()`
- `fetchLectureVideos()`
- `el`
- `escapeHtml()`
- `safeSnippet()`
- `escapeRegex()`
- `formatPrice()`
- `formatBytes()`

Do not improve logic during this move. Keep the diff mechanical.

Commit message:

```text
Refactor frontend foundation modules

Co-Authored-By: Claude Opus 4.7
```

## Safety Rules

- One extraction phase per commit.
- Run `npm run build` and `git diff --check` before every commit.
- Prefer browser smoke testing over Electron testing unless Carlo asks for Electron.
- Do not add a framework or TypeScript during this phase.
- Do not rename DOM IDs/classes while code splitting.
- Avoid circular imports.
- Keep `src/main.js` as the composition root.
- Pass dependencies explicitly when reasonable: `{ state, el, api }`.
- If a module move exposes awkward coupling, preserve behavior first and document cleanup later.

## Risk Areas

Highest-risk sections in `src/main.js`:

- Browse tree and transcript detail navigation.
- AI Markdown/citation rendering.
- Semantic index SSE progress.
- Course import and `Paste Link` / `Import Doc`.
- Archive videos SSE workflow.
- Wiki ingest/rebuild flows.

Defer these until after foundation extraction is stable.

## Validation Checklist

After each phase:

```bash
npm run build
git diff --check
```

Browser smoke:

- page loads without console startup errors;
- stats/header render;
- Browse tree renders;
- search input works;
- Settings opens;
- Add Course panel opens;
- touched feature still works.

For AI-specific phases, verify:

- Markdown headings/lists render;
- clickable source list appears;
- inline `Source N` citations open the source;
- malformed citation forms still become clickable where possible.

## Do Not Touch Unless Asked

- `docs/private/`
- runtime database/data in `data/`
- Electron packaging/signing flow
- root README layout decisions
- upstream `origin/main`

## Known Caveat

The package `dist` script may still assume a root `README.md`. Do not fix this during code splitting unless a build/package task requires it. If it becomes a blocker, document the packaging-layout issue separately and ask Carlo before changing the README layout again.
