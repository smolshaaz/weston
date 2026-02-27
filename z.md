# Project Weston - Current State & Architecture

## Overview
Weston is a high-performance, local-first AI chat application built with **Next.js 16** and **SQLite**. It features a robust RAG (Retrieval-Augmented Generation) pipeline and dynamic model management.

## What has been built so far:

### 1. Project Infrastructure & CLI
- **CLI Flow**: `weston` command to launch the browser UI.
- **Local Persistence**: All data is stored in `~/.weston/weston.db`.
- **Onboarding & Shell**: Complete onboarding flow, sidebar, and chat UI shell.

### 2. Retrieval-Augmented Generation (RAG) - Ingestion Phase (Complete)
- **File Ingestion**: Fully functional pipeline for PDF, TXT, and Markdown files.
- **Vector DB**: `sqlite-vec` integration complete. We store 1536-dimensional embeddings for fast semantic search.
- **Ingestion UI**: Real-time progress indicators and source management are implemented.

### 3. Model & Provider Management
- **OpenRouter Integration**: Primary AI provider is active.
- **Custom Model Registry**: Users can add any OpenRouter model. These are persisted in SQLite and available in the UI.
- **Settings UI**: Refactored to a full-width view for managing API keys and model preferences.

### 4. Database Architecture (SQLite)
The schema is fully established and optimized with:
- `sources`, `chunks`, `embeddings`, `chat_sessions`, `messages`, `custom_models`, and `vec_chunks`.

### 5. RAG & Chat Engine (✅ COMPLETE)
- **Core RAG Loop**: The `/api/chat` route now performs vector searches, builds context-aware prompts, and streams responses.
- **Citation System**: Inline citations (e.g., `[file.pdf]`) are automatically rendered as interactive components.
- **Persistent Memory**: Chat history and user identity files are integrated into every prompt.

## Current Roadmap / What's Next (Exactly Left):

### 1. Advanced Chat UX
- [ ] **Citation Snip**: Click on a citation badge to see the specific text chunk it refers to.
- [ ] **"Show Evidence"**: A toggle to reveal the full context provided to the LLM for any given answer.

### 2. Sources Management (UX)
- [ ] **Attachment Selector**: Ability to select/unselect specific documents to be used for a particular chat session.
- [ ] **Source Analytics**: Word and page counts for indexed documents.
- [ ] **Maintenance**: Re-index and manual refresh for existing sources.

### 3. Personalization & Settings
- [ ] **Personalization Tab**: Set Weston's tone, user name, and behavior presets (Professional, Direct, Warm).
- [ ] **Provider Logic**: Reorder fallback models and advanced model chaining.

### 4. Memory Intelligence
- [ ] **Auto-Summarization**: System updates `summary.md` and `context.md` every N messages.
- [ ] **Cross-Chat Retrieval**: Ability for Weston to recall information discussed in other sessions.
- [ ] **Global Memory**: Automated mechanism to update the global `soul.md` and `identity.md` based on long-term interaction.

### 5. Study Mode
- [ ] **Interactive Learning**: Weston asks follow-up questions to test the user's knowledge.
- [ ] **Evaluation Engine**: Binary assessment (Correct/Wrong) of user answers against document facts.

### 6. Production & Stability
- [ ] **Error Edge Cases**: API rate limiting, key invalidation, and vector DB failure handling.
- [ ] **Production Build**: Optimization for `weston start` (npm distribution readiness).


---

## Purpose of .js and .mjs files in the root directory

The various `test-*.js` and `test-*.mjs` files in your root directory are **standalone development/debugging scripts**.

### Why they are there:
They were created to test specific logic in isolation during development, which is often faster than debugging within the full Next.js environment.

### Specific Usecases:
- **`test-openrouter.js`**: Verified API connectivity and chat completions with OpenRouter.
- **`test-models.js`**: Debugged the model listing and registration logic.
- **`test-api.js`**: Tested internal API endpoints.
- **`test-raw.js` / `test-raw.mjs`**: Used to verify raw network requests or file system operations.
- **`test-local.js`**: Likely used for testing local database operations or environment configurations.

### Configuration Files:
- **`eslint.config.mjs`**: Configures code linting rules.
- **`postcss.config.mjs`**: Configures CSS processing (Tailwind).

**Verdict**: These files were definitely for testing/development. You can safely move them to a `tests/scripts` folder or delete them if you feel the features they verify are stable.
