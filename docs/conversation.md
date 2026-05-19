**CARLO:** Let's implement semantic search so that the AI module can answer questions more intelligently.

**CODEX:** 

1. I’ll first map the existing AI/Q&A and search paths, then I’ll make the smallest change that gives the AI endpoint semantic context without disturbing the existing FTS behavior. I’ll also verify the branch before committing, since this repo has a strict origin/main policy.

2. I found the AI endpoint already does RAG, but its retrieval is lexical FTS only. I’m going to inspect the surrounding schema and request flow next so semantic search can share the same local SQLite/OpenRouter setup instead of adding a separate service.

3. OpenRouter now has an official embeddings endpoint, so I’ll use that rather than inventing a local embedding dependency. The implementation will cache embeddings in SQLite, backfill missing chunks on demand, then blend vector similarity with the existing FTS results for /api/ai/ask.

4. There are unrelated in-progress edits in server/server.js, src/main.js, and package files, so I’ll keep my patch narrowly around AI retrieval/schema/docs and leave those existing changes intact.  

5. I’m also going to avoid a new npm dependency: cosine similarity is simple enough here and SQLite can store the cached vectors.

6. I’m about to edit the database schema and AI server code. The new table will only cache derived embeddings, keyed by chunk id, chunk type, model, and a content hash, so stale vectors can be ignored or replaced without changing transcript/course data.

7. I’m adding a small Settings control to build the semantic index explicitly. Without that, semantic search would only improve after chunks happened to be embedded during individual AI questions, which is too opaque for a local desktop app

8. The server and settings UI are wired now. I’m updating the user-facing help so the feature is discoverable and the cost behavior is clear: chat answers use the selected model, semantic indexing uses an embedding model and caches vectors locally.

9. I’m at the verification pass now. I’m using syntax checks and a temporary database initialization instead of npm run build, because this repo’s build script stamps the version and would create unrelated package metadata churn.

10. The syntax checks passed. The temporary DB initialization is blocked by the local native SQLite module being compiled for a different Node ABI than the node currently on PATH, so I’m checking the project’s intended runtime before deciding whether to rebuild anything.


11. The JavaScript syntax and whitespace checks are clean. I’m doing one frontend-only Vite build to catch renderer/module issues without running the repo’s version-stamping build script.

12. The native DB module is built for Node ABI 128, which matches Node 22; the shell has Node 24 on PATH. I’m trying the same DB smoke test through a Node 22 runner so we can validate the migration without rebuilding local dependencies.

13. The worktree already had unrelated edits, including in server/server.js, src/main.js, and src/index.html. I’m going to avoid a broad commit that captures those; I’ll either leave this uncommitted with a clear note, or stage only my hunks if that can be done without pulling in the existing changes.

---

Implemented semantic search for the AI path.

What changed:
- Added a semantic_embeddings SQLite cache table in server/db.js (line 263).
- Added OpenRouter embedding support, cosine scoring, semantic index status/reindex endpoints, and hybrid FTS + semantic retrieval for /api/ai/ask in server/server.js (line 521) and server/server.js (line 920).
- Added a Settings → Semantic Index → Build index control in src/index.html (line 296) and frontend SSE handling in src/main.js (line 1293).
- Updated README/help copy so the behavior and embedding cost are visible.

Verification:
- node --check server/server.js passed.
- node --check server/db.js passed.
- node --check src/main.js passed.
- git diff --check passed.
- npx vite build --outDir /tmp/ffa-transcript-db-semantic-dist --emptyOutDir passed.
- DB runtime smoke test was blocked because local better-sqlite3-multiple-ciphers was built for ABI 128, while PATH has Node 24 ABI 137 and npx node@22 had ABI 127.

I did not commit because the worktree already had unrelated edits, including mixed changes in server/server.js, src/main.js, and src/index.html; staging whole files would capture work I did not make.

OpenRouter reference checked: official embeddings endpoint and model listing docs:
https://openrouter.ai/docs/api/api-reference/embeddings/create-embeddings
https://openrouter.ai/docs/api/api-reference/embeddings/list-embeddings-models


