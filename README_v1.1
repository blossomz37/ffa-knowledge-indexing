# TranscriptDB v1.1 Notes

The original v1.0 README is preserved at [README_1.0.md](README_1.0.md).

This v1.1 line is a fork of the original TranscriptDB app:

- v1.0 upstream: https://github.com/wmiles81/ffa-transcript-db
- v1.1 fork: https://github.com/blossomz37/ffa-knowledge-indexing

## What Changed in v1.1

v1.1 shifts the working workflow toward the browser app instead of the Electron wrapper. Electron can still exist in the codebase, but day-to-day use and development are easier through Chrome, especially when native modules need to be rebuilt for different Node/Electron versions.

The main v1.1 feature set turns TranscriptDB into a broader local knowledge assistant:

- AI answers now use hybrid retrieval: SQLite FTS plus cached semantic embeddings.
- Imported Markdown and text documents can become global AI-searchable reference material.
- The Add Course panel has both `Paste Link` and `Import Doc` actions.
- AI answers render Markdown instead of showing raw Markdown syntax.
- AI citations and source lists are clickable in the app.
- Semantic indexing can be scoped to docs, the current course, or the full library.

## Browser-First Launch

Install dependencies once:

```bash
npm install
```

Run the app in browser mode:

```bash
npm run dev:server
```

Then open:

```text
http://127.0.0.1:3001
```

For Vite hot reload during frontend development:

```bash
npm run dev
```

That starts the API server on port `3001` and the Vite client on port `5173`.

## AI Setup

1. Open Settings.
2. Add an OpenRouter API key.
3. Refresh and select a chat model.
4. Use the Semantic Index controls:
   - `Index docs` for imported/global documents.
   - `Index current course` for the active course.
   - `Build full index` for everything.

`Index docs` is the fastest useful option after importing a Markdown or text file. A full index can take a long time on a large Teachable archive.

## Importing Knowledge

Use `Import Doc` to add local reference files:

- `.md`
- `.markdown`
- `.txt`

Imported files are stored in the local SQLite database as global reference documents. They are not attached to a specific course in the current implementation.

Use `Paste Link` to submit Teachable course URLs to the scrape pipeline.

## AI Sources

When AI answers use retrieved context, the answer card should show:

- Rendered Markdown headings/lists instead of raw Markdown.
- Inline clickable citations such as `Source 3`.
- A source list below the answer.
- Links that open transcript, course lecture, or imported document sources inside the app.

## Current Limitations

- `Paste Link` currently accepts Teachable course URLs, not arbitrary lecture URLs.
- Imported documents are global references; course-specific document attachment is future work.
- Imported documents are FTS-searchable immediately, but semantic search needs `Index docs`, `Index current course`, `Build full index`, or opportunistic embedding during an AI answer.
- External `source_url` metadata can be stored for imported documents, but the UI primarily opens the local in-app document view.

## v1.1 Spec

The implementation spec is here:

[docs/v1.1/2026-05-18_06-37_spec_ai-knowledge-url-file-ingestion_v1.md](docs/v1.1/2026-05-18_06-37_spec_ai-knowledge-url-file-ingestion_v1.md)
