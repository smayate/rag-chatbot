# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Setup:**
```bash
uv sync                          # Install dependencies (uses uv package manager)
cp .env.example .env             # Create env file, then add ANTHROPIC_API_KEY
```

**Run:**
```bash
./run.sh                         # Start the server (recommended)
# or manually:
cd backend && uv run uvicorn app:app --reload --port 8000
```

Access at http://localhost:8000 (UI) and http://localhost:8000/docs (API docs).

**Windows:** Use Git Bash to run shell commands.

There are no tests in this codebase.

## Architecture

This is a **RAG (Retrieval-Augmented Generation) chatbot** for querying course materials, built with FastAPI + ChromaDB + Claude AI.

**Stack:** Python 3.13, FastAPI, ChromaDB (vector DB), sentence-transformers (embeddings), Anthropic Claude API (`claude-sonnet-4-20250514`), vanilla JS frontend.

**Package manager:** `uv` — use `uv run` to execute Python commands, `uv sync` to install deps.

### Query Pipeline

```
User query → POST /api/query
  → RAGSystem.query()
  → Build prompt with session conversation history (SessionManager)
  → Claude API call (1st) with search_course_content tool definition
  → If stop_reason == "tool_use": Claude invokes search_course_content
      → CourseSearchTool → VectorStore.search()
          → _resolve_course_name() via course_catalog (semantic match)
          → course_content.query() with metadata filters
      → Results sent back in 2nd Claude API call
  → Claude synthesizes final answer from retrieved chunks
  → Return answer + source attribution to frontend
```

The two-step Claude call only happens when Claude decides to search. For general knowledge questions, it answers directly without calling the tool.

### Backend Modules (`backend/`)

| File | Role |
|------|------|
| `app.py` | FastAPI app; endpoints: `POST /api/query`, `GET /api/courses`; auto-loads docs on startup |
| `rag_system.py` | Orchestrator — coordinates all components, drives the query pipeline |
| `config.py` | All settings from `.env`; key values: `CHUNK_SIZE=800`, `CHUNK_OVERLAP=100`, `MAX_RESULTS=5`, `MAX_HISTORY=2` |
| `document_processor.py` | Parses course `.txt` files → `CourseChunk` objects with metadata; sentence-based chunking |
| `vector_store.py` | ChromaDB wrapper with two collections: `course_catalog` (titles/metadata) and `course_content` (text chunks) |
| `ai_generator.py` | Claude API integration; handles tool-calling loop; temperature=0, max_tokens=800 |
| `search_tools.py` | `CourseSearchTool` + `ToolManager`; defines the `search_course_content` tool schema Claude uses |
| `session_manager.py` | In-memory conversation history keyed by session ID; resets on server restart |
| `models.py` | Pydantic models: `Course`, `Lesson`, `CourseChunk` |

### VectorStore Collections

Two ChromaDB collections are maintained:
- **`course_catalog`** — one document per course (title text); used by `_resolve_course_name()` to fuzzy-match partial course names Claude passes to the tool
- **`course_content`** — one document per chunk; metadata fields `course_title`, `lesson_number`, `chunk_index` enable filtered search

Course title is used as the ChromaDB document ID, so re-indexing the same course is a no-op (duplicate IDs are skipped).

### Course Document Format (`docs/*.txt`)

```
Course Title: <title>
Course Link: <url>
Course Instructor: <name>

Lesson 0: <title>
Lesson Link: <url>
<lesson content>

Lesson 1: <title>
...
```

### Frontend (`frontend/`)

Single-page app served statically by FastAPI. `script.js` manages session creation, sends queries to `/api/query`, and renders Markdown responses via Marked.js.

## Key Configuration (`.env`)

```
ANTHROPIC_API_KEY=<required>
# All other config has defaults in config.py
```

## Managing Course Data

**Add a new course:** Drop a `.txt` file into `docs/` using the format above and restart the server. On startup `app.py` calls `add_course_folder()` which skips already-indexed courses.

**Reset the vector DB:** Delete the `./chroma_db/` directory and restart. All courses in `docs/` will be re-indexed from scratch.

**Session state** is in-memory only — all conversation history is lost on server restart.
