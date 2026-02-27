# Progress Summary: Weston RAG Implementation

## Project Objective
We are building **Weston**, a local RAG (Retrieval-Augmented Generation) application. The goal is to allow users to upload documents (PDFs, text, markdown), index them into a local SQLite vector database, and chat with an AI that cites those documents as sources.

## What has been accomplished so far:

### 1. Core RAG Pipeline
- **Vector Search Engine**: Implemented `lib/retrieve.ts` which uses `sqlite-vec` to perform cosine similarity search on document embeddings stored in SQLite.
- **Chat API**: Created `app/api/chat/route.ts` which:
    - Parses user queries.
    - Retrieves the top 5 most relevant context chunks from the vector DB.
    - Injects this context into a system prompt.
    - Streams a cited response back using the Vercel AI SDK.
- **Source Ingestion**: Built a background ingestion system (`lib/ingest.ts`) that chunks text, generates embeddings, and stores them in the DB.

### 2. Chat Session Persistence
  // Vercel AI SDK Chat Hook — id isolates messages per chat session
  const { messages, sendMessage } = useChat({
    id: chatId,
    api: "/api/chat",
    body: { chatId, model: selectedModel },
  } as any);
- **Database Schema**: Leveraged the `chat_sessions` and `messages` tables in SQLite to store history.
- **Session API**: Built `/api/sessions` for listing, creating, and deleting chats.
- **Auto-Session Management**:
    - Users are auto-redirected to unique chat IDs (e.g., `/chat?chat=chat-123`).
    - Sessions are auto-created in the DB upon any activity (sending a message or uploading a source).
- **Persistent Sidebar**: Rewritten to fetch real data from the DB, support polling for updates, and handle Rename/Delete actions.

### 3. UI/UX Improvements
- **Integrated `useChat`**: Wired the frontend to the streaming API.
- **Manual State Management**: Adapted to recent Vercel AI SDK changes (handling `UIMessage` parts manually).
- **Session Isolation**: Fixed bugs where messages were bleeding between different chat windows.

## Current Progress
- **Fixed RAG Crash**: Resolved "Invalid Prompt" and "Body already read" errors by properly mapping messages and merging JSON parses.
- **Session Isolation**: Refactored the UI to use a `key={chatId}` pattern, ensuring that chat history and local state are completely fresh for each chat session.
- **Functional Sidebar**: Rename and Delete actions are now fully operational and persist to the database.

