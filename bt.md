Good. Let’s zoom out properly.

You now have:

✅ CLI flow (`weston` → browser opens)  
✅ Local persistence (`~/.weston/`)  
✅ Settings page skeleton  
✅ Onboarding flow  
✅ Sidebar + Chat UI shell  
✅ Sources view  
✅ Provider verification endpoint  
✅ Database & Source Ingestion  
✅ Retrieval Engine (RAG Core)  
✅ Chat Engine (Streaming, Memory, Prompting)  

Now here’s what’s **left**, grouped properly so we don’t drift.

---

# 🔴 Core Functionality (Must Exist for Weston to Be Real)

## 1️⃣ Database & Source Ingestion (Day 2 proper)
- Initialize SQLite DB (`~/.weston/weston.db`)
- Create tables:
  - `sources`
  - `chunks`
  - `embeddings`
  - `chat_sessions`
  - `messages`
- Implement:
  - PDF upload endpoint
  - `.txt` / `.md` ingestion
  - Chunking with overlap
  - Embedding generation
  - Storing vectors
- Show real source indexing status in UI

---

## 2️⃣ Retrieval Engine (RAG Core)
- Vector similarity search
- MMR (Maximal Marginal Relevance)
- Optional hybrid search (later)
- Citation formatting
- Strict mode enforcement
- Refusal logic if no evidence

---

## 3️⃣ Chat Engine
- Streaming responses
- Build prompt:
  - soul.md
  - identity.md
  - global.md
  - chat summary
  - retrieved chunks
- Store messages in DB
- Attach chats to selected sources
- Per-chat model override
- Fallback model chain

---

# 🟡 Product Completion (UI + Experience)

## 4️⃣ Chat UX Completion
- Message rendering component
- Markdown rendering
- Citation chips
- Click citation → show snippet
- Message streaming animation
- “Show evidence” toggle

---

## 5️⃣ Sources UX Completion
- File upload modal
- Add text modal
- Source attachment selector per chat
- Delete source
- Re-index source
- Word/page count
- Index progress indicator

---

## 6️⃣ Settings Completion
You requested this properly:

### API Keys Tab
- Add provider
- Remove provider
- Set primary
- Reorder fallbacks
- Mask keys
- Verify again

### Personalization Tab
- What Weston calls user
- What user calls Weston
- Tone preference
- Strict default
- Study mode default
- Behavior presets (Professional / Direct / Warm)

---

# 🟢 Intelligence Layer

## 7️⃣ Study Mode
- Ask follow-up question
- Evaluate answer against source
- Binary evaluation (correct / partial / wrong)
- Extract key concepts for memory
- Track repetition frequency

---

## 8️⃣ Memory System
- summary.md auto-update every N messages
- context.md extraction
- embed chat history
- cross-chat retrieval
- global.md update mechanism

---

# 🔵 Stability & UX Polish

## 9️⃣ Port Auto-detection polish
✅ already handled

## 🔟 Error Handling
- API key invalid
- Model unavailable
- Rate limit
- Embedding failure
- PDF parse failure
- Vector DB failure

---

# 🟣 Packaging / Distribution

## 11️⃣ Production Mode
- `weston start` → production build
- `weston dev`
- Proper bin config
- npm publish readiness

---

# ⚫ Optional / Later

- Google OAuth
- OpenCode provider
- OCR for scanned PDFs
- Hybrid search
- Reranker
- Desktop packaging (Tauri)
- Plugin system

---

# 🎯 MVP (v1) Critical Path

To call Weston "usable" v1, it strictly needs:

1. **Upload source** ✅ (Complete)
2. **Ask question & Get cited answer** ✅ (Complete)
   - **Vector Search Engine**: Implemented in `/lib/retrieve.ts`.
   - **Chat Logic Endpoint**: `/api/chat` orchestrates RAG and provides streaming.
   - **Streaming UI**: Integrated with `ai` SDK and supports citation rendering.
3. **Remember context** ✅ (Complete)
   - Persistent message history in SQLite is correctly loaded and passed to LLM.

Everything else is power-ups.
