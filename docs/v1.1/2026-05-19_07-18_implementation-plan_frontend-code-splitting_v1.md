# Implementation Plan v1 - Frontend Code Splitting

**Date:** 2026-05-19
**Status:** Proposed
**Scope:** `src/main.js` modularization with no intended behavior change
**Primary goal:** Reduce `src/main.js` from a 3,985-line feature bundle into stable, testable ES modules while preserving the browser-first v1.1 app behavior.

## Purpose

`src/main.js` has grown into the central runtime for the entire frontend: state, DOM references, API helpers, routing/view selection, tree rendering, AI search, settings, course import, archive workflow, media library settings, wiki UI, and general utilities.

The file still works, but its size makes future changes risky because:

- unrelated features share implicit globals;
- event listener setup is spread across a long file;
- render helpers and feature workflows are interleaved;
- low-risk edits require scanning thousands of lines;
- future AI/file-ingestion changes can accidentally disturb archive/wiki/search behavior.

This plan splits the frontend into ES modules in small, reviewable, no-behavior-change phases. `src/main.js` should become the composition root that wires modules together.

## Non-Goals

- Do not introduce React, Svelte, Vue, or a new frontend framework.
- Do not add TypeScript in this phase.
- Do not redesign the UI.
- Do not change API contracts.
- Do not change CSS selectors or DOM IDs unless a bug forces it.
- Do not refactor backend routes as part of this phase.
- Do not rewrite feature logic while moving it.

## Success Criteria

- The app still launches in browser-first mode with `npm run dev:server`.
- `npm run build` succeeds.
- Existing user workflows still work:
  - browse tree loads;
  - search works;
  - AI answer flow streams;
  - AI citations/source buttons open the right in-app records;
  - `Import Doc` imports `.md`, `.markdown`, and `.txt`;
  - `Paste Link` opens and validates the Teachable course URL modal;
  - Settings can save an API key, refresh models, and run semantic index jobs;
  - transcript detail and video controls still work;
  - archive workflow panel still opens and streams progress;
  - wiki navigation and rebuild controls still work.
- No new global browser variables are introduced except intentionally exposed debug hooks, if any.
- `src/main.js` is reduced to orchestration/bootstrap code.
- Each extraction commit is understandable on its own.

## Current Frontend Shape

Current `src/main.js` sections:

```text
State and API helpers
DOM references
Theme toggle
Version badge
Resizable sidebar
Init/load data
File-explorer tree sidebar
AI search and Markdown rendering
Settings modal and semantic index controls
Notion bar
Render functions
Transcript detail and video player
View management
General event listeners
Utilities
Teachable course management
Paste Link and Import Doc
ffmpeg banner
Archive videos modal handler
Media library settings and first-run splash
Wiki tab, wiki ingest, and wiki rebuild
```

The code is already an ES module because `src/index.html` loads it with:

```html
<script type="module" src="./main.js"></script>
```

That means this phase can use native `import` / `export` without changing the build system.

## Target Module Layout

Create a new `src/app/` folder:

```text
src/
  main.js
  app/
    api.js
    dom.js
    state.js
    types.js
    utils/
      escape.js
      format.js
      storage.js
      timestamps.js
    features/
      ai-search.js
      archive-videos.js
      course-import.js
      data-loaders.js
      media-library.js
      settings.js
      sidebar-resize.js
      theme.js
      transcript-detail.js
      tree.js
      view.js
      wiki.js
```

`types.js` is optional JSDoc-only documentation. It should not create runtime complexity. It can define shared shapes for state, source records, course records, AI sources, semantic status, transcript detail, and wiki entities.

## Architectural Rules

### 1. `main.js` is the composition root

`main.js` should:

- import modules;
- call initialization functions;
- define the top-level `init()` sequence;
- own only cross-feature orchestration that cannot live cleanly elsewhere.

It should not own feature rendering details after the split.

### 2. Shared dependencies are explicit

Feature modules should receive dependencies explicitly:

```js
setupSettingsListeners({ state, el, api });
```

Prefer this over importing a hidden singleton everywhere during later phases. Early phases may import `state`, `el`, and `api` directly to keep the move mechanical, but the end state should make feature dependencies obvious.

### 3. Avoid circular imports

Allowed dependency direction:

```text
main.js
  -> features/*
  -> state/dom/api/utils

features/*
  -> state/dom/api/utils

utils/*
  -> no app feature modules
```

Avoid:

```text
features/tree.js -> features/transcript-detail.js -> features/tree.js
```

When two features need to talk, pass callbacks from `main.js` or create a tiny coordinator module.

### 4. Move before improving

Each extraction should first be a direct move:

- copy function exactly;
- export/import it;
- adjust only references required by module boundaries;
- run verification;
- commit.

Behavior changes belong in later commits.

### 5. Keep DOM contracts stable

Do not rename IDs or classes while splitting. `dom.js` should centralize the existing `el` map so missing IDs are easier to find.

## Phase Plan

## Phase 0 - Baseline and Safety Harness

### Tasks

1. Confirm clean working tree.
2. Run baseline checks:

```bash
npm run build
```

3. Start browser-first app:

```bash
npm run dev:server
```

4. Smoke test in browser:
   - load `http://127.0.0.1:3001`;
   - confirm stats render;
   - expand the browse tree;
   - run a basic search;
   - open Settings;
   - open Add Course panel;
   - open an existing transcript/lecture detail if local data exists.

5. Capture current known limitations so regressions are not confused with existing behavior.

### Commit

No commit required unless the phase adds a script or doc.

### Exit Criteria

- Build passes.
- Browser app loads.
- Known local data behavior is understood.

## Phase 1 - Extract Foundation Modules

### Target Files

```text
src/app/state.js
src/app/api.js
src/app/dom.js
src/app/utils/escape.js
src/app/utils/format.js
src/app/utils/storage.js
src/main.js
```

### Move

From `src/main.js`:

- `state` -> `state.js`
- `api()` -> `api.js`
- `fetchLectureVideos()` -> `api.js`
- `el` -> `dom.js`
- `escapeHtml()` -> `utils/escape.js`
- `safeSnippet()` -> `utils/escape.js`
- `escapeRegex()` -> `utils/escape.js`
- `formatPrice()` -> `utils/format.js`
- `formatBytes()` -> `utils/format.js`
- sidebar storage constants/helpers only if immediately needed by `sidebar-resize.js`, otherwise defer.

### Notes

- `dom.js` can export `el` as the same object currently in `main.js`.
- Keep `api()` behavior identical, including error parsing.
- Avoid changing call sites except for imports.

### Verification

```bash
npm run build
```

Smoke:

- app loads;
- no console error about missing `state`, `el`, `api`, `escapeHtml`, or `formatBytes`;
- search and settings still open.

### Commit

`Refactor frontend foundation modules`

## Phase 2 - Extract Theme, Version Badge, Sidebar Resize, and View

### Target Files

```text
src/app/features/theme.js
src/app/features/sidebar-resize.js
src/app/features/view.js
src/main.js
```

### Move

From `src/main.js`:

- theme constants and `initTheme()`, `applyTheme()` -> `theme.js`
- version badge setup -> either `theme.js` is wrong; prefer `view.js` or `version-badge.js` if the code is large enough;
- `SIDEBAR_MIN`, `SIDEBAR_MAX`, `restoreSidebarWidth()`, `attachSidebarResize()` -> `sidebar-resize.js`
- `switchView()` and `goBack()` -> `view.js`

### Notes

- Theme currently runs early to avoid visible theme flash. Preserve that behavior.
- If `initTheme()` must run before the rest of init, keep that call near the top of `main.js`.

### Verification

```bash
npm run build
```

Smoke:

- theme toggle works;
- sidebar resize persists;
- back button/view switching still works;
- version badge still renders.

### Commit

`Refactor shell UI modules`

## Phase 3 - Extract Markdown and AI Source Rendering

### Target Files

```text
src/app/features/ai-sources.js
src/app/markdown.js
src/app/features/ai-search.js
src/main.js
```

### Move

From AI Search section:

- `aiSourceTarget()` -> `ai-sources.js`
- `renderAiSources()` -> `ai-sources.js`
- `bindAiCitationLinks()` -> `ai-sources.js`
- `renderMarkdown()` -> `markdown.js`
- `hideAiAnswer()` may remain with AI search or move with AI rendering.

### Notes

This phase is important because Markdown rendering and clickable citations were recently fixed. Keep the behavior exact.

The renderer must continue to:

- escape raw HTML first;
- render H1-H4;
- render ordered/unordered lists;
- render inline code and fenced code;
- convert `[Source N](source:N)` into in-app buttons;
- tolerate malformed forms like `Source 7, 12*`.

### Verification

```bash
npm run build
```

Smoke:

- ask an AI question if API key/local data are available;
- confirm answer Markdown renders as HTML;
- confirm source list appears;
- confirm citation/source click opens target.

If AI cannot be run locally, create a temporary dev-only browser console check by importing `renderMarkdown()` in a small scratch test or run a Node-compatible unit-style check if the function has no DOM dependency. Remove scratch code before commit.

### Commit

`Refactor AI markdown rendering`

## Phase 4 - Extract Settings and Semantic Index Controls

### Target Files

```text
src/app/features/settings.js
src/main.js
```

### Move

From Settings Modal section:

- `openSettings()`
- `closeSettings()`
- `saveApiKey()`
- `fetchModels()`
- `formatSemanticStatus()`
- `loadSemanticStatus()`
- `setSemanticIndexButtonsDisabled()`
- `semanticIndexRequestForScope()`
- `semanticIndexRunningLabel()`
- `buildSemanticIndex()`
- `renderModelList()`
- `setupSettingsListeners()`

### Notes

Settings touches AI state, model selection, and semantic indexing. Keep event streams intact.

`buildSemanticIndex()` should preserve:

- scoped requests for `documents`, `current-course`, and `all`;
- UI disabled state during active jobs;
- SSE progress rendering;
- clean reset on error or completion.

### Verification

```bash
npm run build
```

Smoke:

- open Settings;
- model search/list still works;
- semantic status loads;
- index buttons have correct labels;
- if safe, start `Index docs` and confirm progress events render.

### Commit

`Refactor settings module`

## Phase 5 - Extract Browse Tree Model and Tree UI

### Target Files

```text
src/app/features/tree.js
src/app/features/tree-model.js
src/main.js
```

### Move

Pure/model helpers to `tree-model.js`:

- `TAG_ORDER`
- `TAG_LABELS`
- `extractTagFromTitle()`
- `stripTagPrefix()`
- `displayCourseTitle()`
- `buildCourseTreeRoots()`
- `buildUnassignedSourcesRoots()`
- `groupLecturesByClassNumber()`
- `makeLectureNode()`
- `transcriptLabel()`

Tree UI/data helpers to `tree.js`:

- `restoreExpanded()`
- `persistExpanded()`
- `ensureCourseTreeLoaded()`
- `ensureSourceLecturesLoaded()`
- `ensureLectureTranscriptsLoaded()`
- `ensureCourseOrphanTranscriptsLoaded()`
- `renderTreeNode()`
- `renderChildren()`
- `renderTree()`
- `renderUnassignedSourcesTree()`
- `toggleNode()`
- `selectTreeNode()`
- `expandToActive()`
- `initTree()`
- `clearTreeCache()`

### Notes

Tree code is high-risk because it updates shared state and routes into transcript/course/detail views. Keep callbacks explicit where it needs to call loaders from other modules.

Recommended dependency injection:

```js
initTree({
  state,
  el,
  api,
  loadSources,
  loadTranscripts,
  loadTranscriptDetail,
  updateNotionBar,
  switchView
});
```

### Verification

```bash
npm run build
```

Smoke:

- tag groups render;
- courses expand;
- sections/class groups expand;
- lecture node opens detail;
- transcript child opens detail;
- unassigned transcripts section still behaves.

### Commit

`Refactor browse tree module`

## Phase 6 - Extract Data Loaders, Search, and Core Render Functions

### Target Files

```text
src/app/features/data-loaders.js
src/app/features/search.js
src/app/features/render-results.js
src/main.js
```

### Move

Data loaders:

- `loadStats()`
- `loadSources()`
- `loadLectures()`
- `loadTranscripts()`
- `loadTranscriptDetail()`

Search:

- `doSearch()`
- search input event setup, if not kept in `main.js`

Render:

- `renderLectureList()`
- `renderTranscriptGrid()`
- `renderSearchResults()`

### Notes

This phase may expose awkward coupling between loaders, tree state, and render functions. Do not solve that with a large rewrite. Use dependency injection and leave cleanup for a later refactor.

### Verification

```bash
npm run build
```

Smoke:

- stats load;
- sidebar data loads;
- browse grid loads;
- transcript search works;
- opening search result works;
- active filters still apply.

### Commit

`Refactor frontend data and search modules`

## Phase 7 - Extract Transcript Detail and Video Player

### Target Files

```text
src/app/features/transcript-detail.js
src/app/features/video-player.js
src/main.js
```

### Move

From detail rendering:

- `renderTranscriptDetail()` initially to `transcript-detail.js`
- video-specific sub-blocks into `video-player.js` only after the first extraction is stable.

### Notes

This is one of the most fragile sections because it mixes:

- transcript text rendering;
- timestamps;
- archived video lookup;
- multi-video tabs;
- playback speed persistence;
- auto-sequence;
- rescrape transcript;
- reorder videos;
- Notion URL save.

Split in two commits:

1. move `renderTranscriptDetail()` as-is;
2. extract video-specific helpers from within that module.

### Verification

```bash
npm run build
```

Smoke:

- transcript detail opens;
- search highlights still work;
- speaker names and URLs render;
- timestamp links remain clickable;
- archived video player appears where available;
- playback speed persists;
- multi-video tabs still switch transcript chunks;
- rescrape/reorder buttons still call the right endpoints.

### Commit

`Refactor transcript detail module`

Optional second commit:

`Refactor video player helpers`

## Phase 8 - Extract Course Import, Paste Link, Auth, and Delete Flows

### Target Files

```text
src/app/features/course-import.js
src/app/features/course-list.js
src/main.js
```

### Move

From Teachable Course Management:

- `loadCourses()`
- `checkAuth()`
- `updateAuthUI()`
- `renderCourseList()`
- `showDeleteModal()`
- `getSelectedCourseIds()`
- source/course delete handlers
- source/session dropdown handlers
- `startScrape()`
- `openCourseLinkModal()`
- `closeCourseLinkModal()`
- `isValidTeachableCourseLink()`
- `importLibraryDocument()`
- `setupCourseListeners()`

### Notes

This module owns the v1.1 ingestion surface. Preserve:

- `Paste Link` course URL validation;
- `Import Doc` file type check;
- 5 MB server-side import limit behavior;
- post-import message telling the user to run `Index docs`;
- scrape progress behavior.

### Verification

```bash
npm run build
```

Smoke:

- login button reflects auth state;
- Add Course panel opens/closes;
- course picker loads if authenticated;
- `Paste Link` modal opens and validates;
- `Import Doc` opens file picker;
- delete modal still works.

### Commit

`Refactor course import module`

## Phase 9 - Extract Archive Videos and ffmpeg Banner

### Target Files

```text
src/app/features/ffmpeg.js
src/app/features/archive-videos.js
src/main.js
```

### Move

- `checkFfmpegAvailability()` -> `ffmpeg.js`
- `startArchive()` -> `archive-videos.js`
- archive panel event wiring -> `archive-videos.js`

### Notes

Archive is a long-running SSE workflow. Preserve:

- scope-sensitive archive behavior;
- Shift-click force behavior;
- cancel behavior;
- progress panel rendering;
- Done summary;
- partial success reporting.

### Verification

```bash
npm run build
```

Smoke:

- ffmpeg banner renders correctly;
- archive button appears for course scope;
- archive panel opens;
- cancel closes/aborts.

Avoid triggering large downloads unless Carlo explicitly wants a real archive test.

### Commit

`Refactor archive video module`

## Phase 10 - Extract Media Library Settings and First-Run Splash

### Target Files

```text
src/app/features/media-library.js
src/main.js
```

### Move

- `renderMediaLibraryInfo()`
- `loadMediaLibrarySettings()`
- `saveMediaLibrarySettings()`
- `pickMediaLibraryFolder()`
- `attachMediaLibrarySettingsHandlers()`
- `showFirstRunSplashIfNeeded()`
- `attachSplashHandlers()`

### Notes

Browser mode has a folder-picker limitation. Preserve the current fallback behavior where the user can type a path.

### Verification

```bash
npm run build
```

Smoke:

- Settings media library section loads;
- browser-mode folder picker message remains correct;
- splash behavior remains unchanged for first-run state.

### Commit

`Refactor media library module`

## Phase 11 - Extract Wiki

### Target Files

```text
src/app/features/wiki.js
src/main.js
```

### Move

From Phase 5 wiki section:

- `WIKI_KIND_LABELS`
- `loadWikiKindCounts()`
- `openWikiKind()`
- `highlightWikiNav()`
- `renderWikiList()`
- `openWikiEntity()`
- `renderWikiEntity()`
- `runWikiLint()`
- `showWikiLintReport()`
- `runWikiIngestPending()`
- `setupWikiIngestPanel()`
- `setupWikiListeners()`
- `populateWikiRebuildScope()`
- `startWikiRebuild()`
- `handleRebuildEvent()`
- `setupWikiSettingsListeners()`

### Notes

Wiki is feature-dense but mostly contained. It can move late after shared API/state/view behavior is stable.

Preserve:

- wiki nav counts;
- entity list/detail views;
- source links into lectures;
- lint flow;
- ingest pending SSE panel;
- rebuild scope and progress.

### Verification

```bash
npm run build
```

Smoke:

- wiki nav counts load;
- author/technique/tool/debate lists open;
- entity detail opens;
- source link opens lecture;
- lint/rebuild buttons still render and call endpoints when safe.

### Commit

`Refactor wiki module`

## Phase 12 - Shrink and Stabilize `main.js`

### Target

`src/main.js` should contain:

- imports;
- early theme initialization;
- `init()` sequence;
- top-level event/module setup calls;
- any intentionally shared orchestration callbacks.

Example shape:

```js
import { state } from './app/state.js';
import { el } from './app/dom.js';
import { api } from './app/api.js';
import { initTheme } from './app/features/theme.js';
import { attachSidebarResize } from './app/features/sidebar-resize.js';
import { initTree } from './app/features/tree.js';
import { setupSettingsListeners } from './app/features/settings.js';

initTheme({ state, el });
attachSidebarResize({ el });

async function init() {
  setupSettingsListeners({ state, el, api });
  await loadAiSettings({ state, el, api });
  await loadStats({ state, el, api });
  await loadSources({ state, el, api });
  await initTree({ state, el, api });
}

init().catch((err) => {
  console.error('App init failed', err);
});
```

### Verification

```bash
npm run build
```

Full smoke test:

- browser app loads;
- no console startup errors;
- search works;
- browse tree works;
- settings works;
- AI settings/status works;
- Add Course panel works;
- `Paste Link` modal works;
- `Import Doc` works;
- transcript detail works;
- wiki tab works.

### Commit

`Refactor frontend bootstrap`

## Optional Phase 13 - Add Lightweight Frontend Test Harness

Only after the mechanical split is stable.

### Option A - Pure Function Tests

Add tests for:

- `renderMarkdown()`
- source citation parsing;
- `extractTagFromTitle()`
- `displayCourseTitle()`
- `groupLecturesByClassNumber()`
- Teachable course URL validation.

### Option B - Browser Smoke Script

Add a Playwright smoke test that:

- opens `http://127.0.0.1:3001`;
- checks header/stats area exists;
- opens Settings;
- opens Add Course panel;
- verifies `Paste Link` and `Import Doc` controls exist;
- types a search query.

### Commit

`Add frontend smoke checks`

## Risk Register

| Risk | Why it matters | Mitigation |
|---|---|---|
| Circular imports | ES modules can initialize partially and produce undefined bindings | Keep dependency direction strict; pass callbacks from `main.js` |
| Hidden global coupling | Moved functions may depend on variables not obvious at extraction time | Extract one section at a time; run build after each move |
| Event listener duplication | Re-running setup can bind handlers twice | Keep setup functions called once from `main.js`; avoid setup inside render functions unless already existing behavior |
| AI citation regression | Recent work fixed clickable malformed citations | Extract Markdown/source rendering early and smoke test carefully |
| Tree/detail navigation regression | Tree selection touches many shared state fields | Move tree as a complete module and inject callbacks |
| Archive download side effects | Real archive tests can trigger long downloads | Smoke panel behavior only unless a real archive test is requested |
| Browser/Electron divergence | Electron native modules have been fragile locally | Use browser-first validation unless Electron work is explicitly requested |
| Root README assumptions | Packaging script may still reference `README.md` | Do not change packaging in this phase; document separately if build fails due README layout |

## Commit Strategy

Use small commits per phase. Recommended message pattern:

```text
Refactor frontend foundation modules
Refactor shell UI modules
Refactor AI markdown rendering
Refactor settings module
Refactor browse tree module
Refactor frontend data and search modules
Refactor transcript detail module
Refactor course import module
Refactor archive video module
Refactor media library module
Refactor wiki module
Refactor frontend bootstrap
```

Every commit should include the repo-required trailer:

```text
Co-Authored-By: Claude Opus 4.7
```

## Verification Checklist Per Phase

Run:

```bash
npm run build
git diff --check
```

Then browser smoke:

```bash
npm run dev:server
```

Open:

```text
http://127.0.0.1:3001
```

Check the feature touched by the phase plus one unrelated feature. This catches accidental shared-state breakage.

## Recommended First Implementation Batch

Start with the lowest-risk foundation work:

1. `state.js`
2. `api.js`
3. `dom.js`
4. `utils/escape.js`
5. `utils/format.js`
6. `features/theme.js`
7. `features/sidebar-resize.js`

Stop after that batch and verify. This gives immediate structure without disturbing the feature-heavy tree/AI/archive/wiki sections.

## Future Follow-Up After Code Splitting

Once modules are stable, consider:

- adding JSDoc payload typedefs;
- adding pure-function tests for Markdown and tree grouping;
- adding a browser smoke test;
- moving large CSS sections into feature-labeled blocks or separate CSS files if Vite import behavior is acceptable;
- documenting frontend module ownership in `AGENTS.md`.

These should be separate phases, not mixed into the mechanical split.
