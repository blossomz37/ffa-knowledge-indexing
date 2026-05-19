# Universal Ingestion + Semantic Search Plan v1

Internal implementation notes for making TranscriptDB reliable as a general URL-ingestion, indexing, semantic-search, and AI-Q&A app while preserving the current design aesthetic and Teachable-specific behavior.

## Current State

TranscriptDB has three main ingestion/search surfaces:

- Legacy JSON transcript import into `sources`, `transcripts`, `chunks`, and `chunks_fts`.
- Teachable course scraping into `courses`, `course_sections`, `course_lectures`, `course_chunks`, and `course_chunks_fts`.
- OpenRouter-backed AI answer generation that retrieves context with FTS5 and streams a chat completion.

The Teachable scraper has useful hardening already: headful Chrome, persistent Puppeteer profile, student-view URL normalization, lecture deduplication, per-video transcript segmentation, and conservative preservation of existing chunks when refresh extraction returns no text.

The reliability problem is architectural: scraping, progress reporting, persistence, and extraction are tightly coupled to one `scrapeCourse()` path. There is no general job model, no persistent scrape log, no source/provider abstraction, no document-level ingestion table, and no semantic vector layer.

## Gaps Against Desired Behavior

### Paste One Link Or Many

Current paste-link UI accepts one Teachable course/lecture URL and rejects anything else. It calls `/api/courses/scrape`, which assumes Teachable auth and Teachable course structure.

Needed:

- Multiline URL input.
- URL classifier before scraping.
- One ingestion job containing many URL attempts.
- Per-URL status: pending, inspecting, scrapeable, skipped, failed, ingested.

### Determine What Can Be Scraped

Current code treats invalid/non-Teachable URLs as errors.

Needed:

- Provider detector:
  - `teachable-course`
  - `teachable-lecture`
  - `notion-page`
  - `generic-web-page`
  - `unsupported`
- Probe phase that opens each URL and records:
  - final URL after redirects
  - title
  - detected provider
  - auth/permission status
  - text length available
  - links/resources discovered
  - extraction strategy used

### Persistent Logging

Current scrape progress is transient SSE text in the sidebar. Archive failures have a persistent table, but scraping does not.

Needed tables:

- `ingest_jobs`: one row per paste/run.
- `ingest_job_items`: one row per URL.
- `ingest_events`: append-only timestamped event log.
- Store counts: bytes, characters, words, chunks, skipped links, errors.

### Leave Browser Open

Current scraping launches headful Chrome but closes it after the scrape. This is good for automation but not for inspectability.

Needed:

- Scrape option: `keepBrowserOpen`.
- Job-level browser/session manager.
- When enabled, do not close the browser on job completion; log that the browser is left open for inspection.
- Manual close/cleanup endpoint later if needed.

### Better Indexing

Current lexical search uses two separate FTS5 tables, merges results in app code, and duplicates search logic across normal search and AI retrieval.

Needed:

- Unified `documents` + `document_chunks` layer spanning imported transcripts, Teachable chunks, Notion pages, and generic web pages.
- Existing course/lecture tables can remain domain-specific metadata; search should hit the unified chunk layer.
- One FTS index over all chunk text with source metadata attached.
- Rebuild command/endpoint for FTS consistency checks.

### Semantic Search

There is no embedding table or vector search today.

Practical local-first option:

- Add `chunk_embeddings` with one row per `document_chunk`.
- Store embedding provider, model, dimension, and vector bytes/JSON.
- Start with brute-force cosine search in Node over SQLite rows. This is acceptable for a moderate personal library and avoids native vector-extension packaging risk.
- Add hybrid retrieval: lexical FTS candidates + semantic candidates, then reciprocal-rank fusion.

Provider options:

- OpenAI embeddings if the app moves toward OpenAI API keys.
- OpenRouter-compatible embedding provider only if the selected provider supports embeddings.
- Local embedding model later if packaging size/performance is acceptable.

### More Robust AI Chat

Current AI chat uses a simple stop-word FTS query, silently falls back to weak context, and tells the model to answer from general knowledge when no context is found. That undermines reliability.

Needed:

- Shared retrieval service used by search and chat.
- Hybrid retrieval with citations and source IDs.
- Refuse or ask for a narrower query when context is empty.
- Emit retrieval diagnostics to the UI: number of chunks searched, lexical hits, semantic hits, final chunks used.
- Timeout/retry handling similar to `wiki.js`.
- Model capability guardrails: selected model, context window, max output, streaming support.

## Proposed Data Model

Add without removing existing Teachable tables:

```sql
CREATE TABLE IF NOT EXISTS ingest_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  input_text TEXT NOT NULL,
  keep_browser_open INTEGER NOT NULL DEFAULT 0,
  total_urls INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ingest_job_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  input_url TEXT NOT NULL,
  final_url TEXT,
  provider TEXT,
  title TEXT,
  status TEXT NOT NULL,
  text_chars INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (job_id) REFERENCES ingest_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingest_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  item_id INTEGER,
  ts TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  FOREIGN KEY (job_id) REFERENCES ingest_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES ingest_job_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  url TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_type, source_ref)
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_estimate INTEGER,
  metadata_json TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(
  content,
  content='document_chunks',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TABLE IF NOT EXISTS chunk_embeddings (
  chunk_id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  embedding_json TEXT NOT NULL,
  embedded_at TEXT NOT NULL,
  FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE
);
```

## Provider Architecture

Create `server/ingest/`:

- `jobs.js`: job creation, event logging, SSE streaming.
- `providers/index.js`: provider detection and dispatch.
- `providers/teachable.js`: wraps the existing Teachable scraper instead of duplicating it.
- `providers/notion.js`: extracts public Notion pages via browser DOM text first; API integration can come later.
- `providers/generic-web.js`: browser-based readable text extraction from standard pages.
- `documents.js`: normalized document/chunk writes.
- `retrieval.js`: lexical, semantic, and hybrid retrieval for both search and AI chat.
- `embeddings.js`: embedding queue and provider calls.

## Implementation Sequence

1. Add persistent ingest job/event tables and a small event logger.
2. Replace single-link Teachable paste modal with multiline "Add Links" flow, but keep the existing Teachable picker intact.
3. Add `/api/ingest/jobs` SSE endpoint for URL classification and Teachable dispatch first.
4. Add `keepBrowserOpen` support to scraper browser lifecycle.
5. Normalize Teachable course chunks into `documents` / `document_chunks` while leaving existing course UI untouched.
6. Move `/api/search` to unified document FTS, then preserve old result rendering metadata.
7. Add embeddings and a backfill endpoint.
8. Replace AI chat retrieval with hybrid retrieval and visible diagnostics.
9. Add Notion and generic web providers.
10. Add job-history/log UI in the sidebar or settings panel.

## First Safe Slice

The safest first implementation is job/event logging plus multiline URL intake that still only dispatches Teachable URLs. That gives the app the user-visible behavior shape without risking generic scraping, semantic migrations, or AI-chat changes in the same patch.

Acceptance criteria for slice 1:

- User can paste multiple URLs.
- Each URL gets a visible log line.
- Unsupported URLs are marked unsupported instead of crashing the run.
- Teachable URLs continue to scrape through the existing code path.
- Final job summary reports succeeded, failed, skipped, lectures scraped, and chunks currently present.
- Existing Teachable picker still works.

