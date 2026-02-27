import Database from "better-sqlite3";
import * as path from "node:path";
import * as fs from "node:fs";
import os from "node:os";

import { WESTON_DIR } from "@/lib/constants";

const DB_PATH = path.join(WESTON_DIR, "weston.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  // Ensure directory exists
  if (!fs.existsSync(WESTON_DIR)) fs.mkdirSync(WESTON_DIR, { recursive: true });

  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrency
  db.exec("PRAGMA journal_mode=WAL;");

  // Load sqlite-vec extension
  // Note: We resolve the native extension path manually using process.cwd()
  // because Next.js Turbopack alters __dirname and performs static analysis on
  // require() / require.resolve(), breaking sqlite-vec's internal path resolution.
  const vecExtPath = path.join(
    process.cwd(),
    "node_modules",
    "sqlite-vec-darwin-arm64",
    "vec0"
  );
  db.loadExtension(vecExtPath);

  // Create tables if they don't exist

  // 1️⃣ sources
  // Stores metadata about each uploaded file (PDF, txt, md)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,              -- unique id (uuid)
      chat_id TEXT NOT NULL,            -- which chat this source belongs to
      name TEXT NOT NULL,               -- filename
      kind TEXT NOT NULL,               -- 'pdf' | 'txt' | 'md'
      status TEXT NOT NULL,             -- 'pending' | 'indexing' | 'indexed' | 'failed'
      progress INTEGER DEFAULT 0,       -- percentage 0-100 indicating ingestion completion
      bytes INTEGER NOT NULL,           -- file size
      is_active INTEGER DEFAULT 1,      -- 1 = attached/enabled, 0 = detached/disabled
      word_count INTEGER DEFAULT 0,     -- total words in source
      tokens INTEGER DEFAULT 0,         -- estimated token count
      created_at INTEGER NOT NULL,      -- unix ms
      updated_at INTEGER NOT NULL       -- unix ms
    ) WITHOUT ROWID;
  `);

  // 2️⃣ chunks
  // Stores the actual text chunks extracted from sources
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,              -- unique id (uuid)
      source_id TEXT NOT NULL,          -- FK to sources.id
      seq INTEGER NOT NULL,             -- chunk sequence number
      text TEXT NOT NULL,               -- the actual text content
      page_start INTEGER,               -- for PDFs: start page
      page_end INTEGER,                 -- for PDFs: end page
      metadata TEXT,                    -- JSON: headings, etc.
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );
  `);

  // 3️⃣ embeddings
  // Stores vector embeddings for each chunk
  db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      chunk_id TEXT PRIMARY KEY,        -- FK to chunks.id (1:1)
      embedding BLOB NOT NULL,          -- 1536-dim float32 vector (for text-embedding-3-small)
      FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
    );
  `);

  // 4️⃣ chat_sessions
  // Stores chat metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,              -- unique id (uuid)
      title TEXT NOT NULL,              -- chat title
      created_at INTEGER NOT NULL,      -- unix ms
      updated_at INTEGER NOT NULL,      -- unix ms
      attached_sources TEXT NOT NULL    -- JSON array of source IDs
    ) WITHOUT ROWID;
  `);

  // 5️⃣ messages
  // Stores chat messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,              -- unique id (uuid)
      chat_id TEXT NOT NULL,            -- FK to chat_sessions.id
      role TEXT NOT NULL,               -- 'user' | 'assistant' | 'system'
      content TEXT NOT NULL,            -- message text
      citations TEXT,                   -- JSON array of {chunkId, text, page}
      created_at INTEGER NOT NULL,      -- unix ms
      FOREIGN KEY (chat_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);

  // 6️⃣ custom_models
  // Stores user-added custom models from OpenRouter
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);

  // Create virtual table for vector search
  // This is sqlite-vec's magic: it creates an index for fast similarity search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
      embedding float[1536] distance_metric=cosine
    );
  `);

  // Create indexes for performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sources_chat_id ON sources(chat_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_source_id ON chunks(source_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);`);

  // Migration: add progress column if it doesn't exist
  try {
    db.exec(`ALTER TABLE sources ADD COLUMN progress INTEGER DEFAULT 0`);
  } catch (err) {}

  try {
    db.exec(`ALTER TABLE sources ADD COLUMN is_active INTEGER DEFAULT 1`);
  } catch (err) {}

  try {
    db.exec(`ALTER TABLE sources ADD COLUMN word_count INTEGER DEFAULT 0`);
  } catch (err) {}

  try {
    db.exec(`ALTER TABLE sources ADD COLUMN tokens INTEGER DEFAULT 0`);
  } catch (err) {}

  // Add trigger to automatically delete from vec_chunks when chunks are deleted
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_delete_vec_chunks
    AFTER DELETE ON chunks
    BEGIN
      DELETE FROM vec_chunks WHERE rowid = OLD.rowid;
    END;
  `);

  // Clean up any orphaned vec_chunks rows from previous failed cascade deletes
  db.exec(`
    DELETE FROM vec_chunks 
    WHERE rowid NOT IN (SELECT rowid FROM chunks);
  `);

  return db;
}

// Helper to close DB (called on SIGINT)
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;