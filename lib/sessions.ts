import getDb from "@/lib/db";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * List all chat sessions, most recent first.
 */
export function listSessions(): ChatSession[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC`
    )
    .all() as { id: string; title: string; created_at: number; updated_at: number }[];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Create a new chat session.
 */
export function createSession(id: string, title: string): ChatSession {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO chat_sessions (id, title, created_at, updated_at, attached_sources) VALUES (?, ?, ?, ?, '[]')`
  ).run(id, title, now, now);

  return { id, title, createdAt: now, updatedAt: now };
}

/**
 * Ensure a session exists for the given chatId.
 * If it doesn't exist, create one with a default title.
 * Returns true if a new session was created.
 */
export function ensureSession(chatId: string, title?: string): boolean {
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM chat_sessions WHERE id = ?`)
    .get(chatId);

  if (existing) return false;

  createSession(chatId, title || "New chat");
  return true;
}

/**
 * Update the title of a chat session.
 */
export function renameSession(id: string, title: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?`
  ).run(title, Date.now(), id);
}

/**
 * Touch the updated_at timestamp of a session (called on activity).
 */
export function touchSession(chatId: string): void {
  const db = getDb();
  db.prepare(`UPDATE chat_sessions SET updated_at = ? WHERE id = ?`).run(
    Date.now(),
    chatId
  );
}

/**
 * Delete a chat session and all associated data.
 */
export function deleteSession(id: string): void {
  const db = getDb();
  // Delete sources, chunks, embeddings first (cascade might handle, but be explicit)
  const sourceIds = db
    .prepare(`SELECT id FROM sources WHERE chat_id = ?`)
    .all(id) as { id: string }[];

  for (const s of sourceIds) {
    db.prepare(`DELETE FROM chunks WHERE source_id = ?`).run(s.id);
    db.prepare(`DELETE FROM embeddings WHERE chunk_id IN (SELECT id FROM chunks WHERE source_id = ?)`).run(s.id);
  }
  db.prepare(`DELETE FROM sources WHERE chat_id = ?`).run(id);
  db.prepare(`DELETE FROM messages WHERE chat_id = ?`).run(id);
  db.prepare(`DELETE FROM chat_sessions WHERE id = ?`).run(id);
}
