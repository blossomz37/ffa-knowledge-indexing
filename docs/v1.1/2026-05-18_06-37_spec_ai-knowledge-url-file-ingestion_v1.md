# Spec v1 - AI Knowledge, URL Extraction, and File Attachments

**Date:** 2026-05-18  
**Status:** Implemented baseline  
**Related private plan:** `implementation-plan_universal-ingestion-semantic-search_v1.md` (stored locally under ignored `docs/private/`)

## Purpose

TranscriptDB's AI module was upgraded from "answer from transcript full-text search" to a broader local knowledge assistant. It can now retrieve from:

1. Legacy summit transcript chunks.
2. Teachable course lecture chunks.
3. Loose Markdown or text documents imported into a global reference library.

The AI answer flow now uses hybrid retrieval: SQLite FTS5 for lexical matches, cached embeddings for semantic matches, and a ranked merge of both. Answers stream from OpenRouter and include source metadata that the UI can render as in-app links.

This spec captures the implemented baseline for the enhanced AI knowledge layer, Teachable URL ingestion, and local file attachment/import behavior.

## User-Facing Capabilities

### AI Knowledge Enhancement

The user can ask natural-language questions in AI mode. The app retrieves relevant context from transcripts, courses, and imported documents, sends those excerpts to the selected OpenRouter chat model, and streams an answer.

The answer should:

- Use only retrieved local excerpts.
- Cite sources with `[Source N](source:N)` where possible.
- Show a source list below the answer.
- Let the user click a source or inline citation to open the source inside the app.
- Render common Markdown formatting instead of exposing raw Markdown syntax.

### URL Extraction / Link-Based Import

The Add Course panel includes a `Paste Link` button. It opens a modal where the user can paste a Teachable course URL, then submit it to the existing course scrape pipeline.

Current implemented scope:

- Accepts URLs matching `https://*.teachable.com/courses/...`.
- Calls the existing `/api/courses/scrape` endpoint.
- Streams scrape progress through the existing progress panel.
- Refreshes course lists and stats after success.

Important limitation:

- The modal copy says "course or lecture link", but the current validator only accepts Teachable course URLs. Lecture URL support should be treated as future work unless the validator and scraper dispatch are extended.

### File Attachment / Document Import

The Add Course panel includes an `Import Doc` button beside `Paste Link`. It opens the native file picker and accepts:

- `.md`
- `.markdown`
- `.txt`

The imported file is not attached to a specific course. It becomes a global AI-searchable reference document.

After import:

- The server chunks the document.
- Chunks are inserted into `library_document_chunks`.
- FTS rows are populated through triggers.
- Semantic status is refreshed.
- The user is told to run `Index docs` to embed the new document quickly.

## Data Model

### `library_documents`

Global reference documents imported from local files or default project docs.

```sql
CREATE TABLE IF NOT EXISTS library_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  description TEXT,
  source_url TEXT,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Notes:

- Imported UI files use a synthetic path: `upload://<filename>`.
- Default project docs use absolute local paths.
- `content_hash` prevents unnecessary re-chunking when a document has not changed.

### `library_document_chunks`

Chunked document text for FTS and AI retrieval.

```sql
CREATE TABLE IF NOT EXISTS library_document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE
);
```

### `library_document_chunks_fts`

FTS5 index for imported/global documents.

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS library_document_chunks_fts USING fts5(
  content,
  content='library_document_chunks',
  content_rowid='id',
  tokenize='porter unicode61'
);
```

Triggers keep the FTS table in sync on insert, delete, and update.

### `semantic_embeddings`

Embedding cache shared by all searchable content types.

```sql
CREATE TABLE IF NOT EXISTS semantic_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL CHECK(content_type IN ('transcript','course','document')),
  chunk_id INTEGER NOT NULL,
  model TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  embedding_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(content_type, chunk_id, model)
);
```

The `document` content type was added so imported files participate in the same embedding cache as transcripts and course chunks.

## Metadata Extraction

Imported Markdown supports lightweight metadata extraction.

Frontmatter keys:

- `title`
- `description`
- `source_url`
- `notion_link`

If no title is found in frontmatter, the importer uses the first Markdown H1. If no H1 exists, it falls back to the filename.

Example:

```md
---
title: Progressive Disclosure for AI Skills
description: Practical guide for layered AI instructions.
source_url: https://example.com/source
---

# Progressive Disclosure for AI Skills
```

The source URL is stored on `library_documents.source_url`. The current UI opens imported documents inside the app; external source URL display is available for future UI expansion.

## Document Chunking

Documents are chunked on heading and paragraph boundaries.

Rules:

- Strip frontmatter before chunking.
- Split before H1-H3 headings and on blank paragraphs.
- Accumulate blocks up to approximately 450 words.
- Preserve Markdown text inside the chunk so headings and structure remain useful to the AI.
- Reject empty documents.
- Reject UI imports larger than 5 MB.

## API Contract

### Import a Document

`POST /api/library/documents/import`

Request:

```json
{
  "filename": "progressive_disclosure_guide.md",
  "content": "# Progressive Disclosure..."
}
```

Response:

```json
{
  "id": 12,
  "title": "Progressive Disclosure for AI Skills",
  "chunks": 8,
  "changed": true,
  "filename": "progressive_disclosure_guide.md"
}
```

Errors:

- `400` for empty or unchunkable documents.
- `413` for files over 5 MB.
- `500` for unexpected import failures.

### View an Imported Document

`GET /api/library/documents/:id`

Returns document metadata, reconstructed content, and chunks. The client uses this to open document sources from AI citations.

### Semantic Status

`GET /api/ai/semantic/status`

Returns:

- active embedding model
- total searchable chunks
- fresh indexed chunks
- missing chunks
- stale chunks

### Build Semantic Index

`POST /api/ai/semantic/reindex`

Streams Server-Sent Events while missing or stale chunks are embedded through OpenRouter. The endpoint supports scoped indexing so the user does not need to embed the entire course library before getting useful AI behavior.

Request scopes:

```json
{ "scope": "documents" }
```

Embeds only imported/global library documents. This is the fastest path and is the recommended default after attaching Markdown or text files.

```json
{ "scope": "current-course", "courses": [11] }
```

Embeds only the selected course. The UI sends the currently active course ID from Browse.

```json
{ "scope": "all" }
```

Embeds the full local library: transcripts, courses, and documents. This can take a long time for a large Teachable archive.

SSE events include scope metadata:

```json
{
  "type": "progress",
  "scope": "current-course",
  "scopeLabel": "Current course",
  "model": "openai/text-embedding-3-small",
  "totalChunks": 11158,
  "indexedChunks": 195,
  "missingChunks": 10963,
  "staleChunks": 0,
  "indexed": 32
}
```

Requirements:

- OpenRouter API key must be configured.
- Embedding model comes from settings, environment, or the default embedding model.
- `current-course` requires at least one course ID.

Reliability behavior:

- Embedding requests use timeout and retry handling for transient OpenRouter/network failures.
- If the client disconnects, the server stops the job cleanly instead of leaving the UI in a permanently disabled state.
- Completed chunks are cached, so a later scoped/full job resumes from what is already indexed.

## Retrieval Flow

When the user asks an AI question:

1. Extract useful query terms from the question.
2. Query transcript FTS if transcript filters allow it.
3. Query course FTS if course filters allow it.
4. Query document FTS only when no course/source/type scope is active.
5. Combine lexical candidates and cap the set.
6. Embed lexical candidates immediately if needed so the current answer benefits from fresh embeddings.
7. Retrieve semantic candidates from cached embeddings by cosine similarity.
8. Merge lexical and semantic candidates with hybrid scoring.
9. Send the final context set to the chat model.
10. Stream the answer and source list to the client.

Hybrid score:

- Semantic score weight: `0.65`
- Lexical score weight: `0.35`

Final context cap:

- 14 chunks.

Semantic retrieval ignores stale embeddings by comparing each cached `text_hash` to the current chunk text.

## Source and Citation Contract

The server sends a `context` SSE event before answer text:

```json
{
  "type": "context",
  "chunks": 14,
  "sources": [
    {
      "number": 1,
      "type": "course",
      "id": 116,
      "title": "116 Class 2 - Building Sequences for Beginners",
      "subtitle": "Course title",
      "timestamp": "",
      "chunks": 1
    }
  ]
}
```

Client target mapping:

- `transcript` -> transcript detail id.
- `course` -> `clec-<lecture_id>`.
- `document` -> `doc-<document_id>`.

The prompt asks the model to cite in this exact form:

```md
[Source 3](source:3)
```

The client renderer also tolerates common malformed forms such as `Source 3`, `Sources 3 and 4`, and `Source 7, 12*`, converting known source numbers into clickable in-app citation buttons.

## Markdown Preview Contract

AI answers are rendered through the local `renderMarkdown()` function. Supported output:

- H1-H4 headings.
- Paragraphs.
- Ordered and unordered lists.
- Bold and italic text.
- Inline code.
- Fenced code blocks.
- Blockquotes.
- Horizontal rules.
- Clickable source citations.

The renderer escapes raw HTML before applying supported formatting. It is intentionally a limited Markdown renderer, not a full Markdown engine.

## UI Contract

### Add Course Panel

The source/add panel contains:

- Teachable course picker.
- `Paste Link` button.
- `Import Doc` button.
- Hidden file input for `.md`, `.markdown`, and `.txt`.
- Force refresh checkbox for Teachable scraping.
- Shared progress panel.

### AI Settings

AI settings include:

- OpenRouter API key.
- Chat model picker.
- Semantic index status.
- `Index docs` button.
- `Index current course` button.
- `Build full index` button.

The semantic index buttons run the same SSE reindex endpoint with different scopes:

- `Index docs` sends `{ "scope": "documents" }`.
- `Index current course` sends `{ "scope": "current-course", "courses": [activeCourseId] }`.
- `Build full index` sends `{ "scope": "all" }`.

The UI disables all index buttons while one job is active, shows a scope-specific running label, and updates progress text from SSE status/progress/done events.

### AI Answer Card

The answer card contains:

- AI answer body.
- Rendered Markdown.
- Source list.
- Clickable inline citations.
- Footer showing context chunk count and token usage when available.

## Defaults and Automatic Sync

The server can sync default library documents at boot from `DEFAULT_LIBRARY_DOCUMENTS`. This is used for project-level reference docs that should be searchable without the user manually attaching them.

Document imports are FTS-searchable immediately after import. They are semantically searchable only after:

- The document index is built with `Index docs`,
- A broader semantic index is built, or
- The document appears in lexical candidates for an AI answer and gets embedded opportunistically during that answer.

## Security and Locality

- Imported file content is stored in the local SQLite database.
- The original file is not uploaded directly to OpenRouter.
- Retrieved excerpts are sent to OpenRouter only when the user asks an AI question.
- Only selected final context chunks are sent, not the full local library.
- OpenRouter API keys remain in local settings and are masked in the UI.

## Known Limitations

1. Paste Link currently validates course URLs only, despite modal copy mentioning lecture links.
2. Imported documents are global references and cannot yet be attached to a specific course.
3. There is no document management screen yet for listing, deleting, or editing imported documents.
4. Imported document source URLs are stored but not prominently rendered in the document detail UI.
5. Semantic search is brute-force over cached SQLite embeddings, which is acceptable for the current library size but may need a vector extension or external index later.
6. No background worker automatically embeds all new imports immediately; the user must run `Index docs`, `Index current course`, `Build full index`, or rely on opportunistic embedding during AI answers.

## Future Extensions

Recommended next steps:

1. Add explicit lecture URL support to `Paste Link`.
2. Add generic web-page extraction for non-Teachable URLs.
3. Add per-course document attachments with a join table such as `course_documents`.
4. Add a Library/Documents management view.
5. Show `source_url` / `notion_link` in imported document detail.
6. Add automatic semantic indexing after successful document import, guarded by API-key availability.
7. Add retrieval diagnostics to the UI: lexical hits, semantic hits, stale embeddings skipped, and final hybrid score.
8. Promote semantic indexing to a durable background job with resumable server-side state and UI polling.
