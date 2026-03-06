import getDb from "@/lib/db";

export interface DBMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: any; // not deeply modeled yet
  createdAt: number;
}

/**
 * Fetch all messages for a given chat session, sorted by creation time.
 */
export function getMessagesForChat(chatId: string): DBMessage[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, chat_id, role, content, citations, created_at
       FROM messages
       WHERE chat_id = ?
       ORDER BY created_at ASC`
    )
    .all(chatId) as any[];

  return rows.map((r) => ({
    id: r.id,
    chatId: r.chat_id,
    role: r.role,
    content: r.content,
    citations: r.citations ? JSON.parse(r.citations) : null,
    createdAt: r.created_at,
  }));
}

/**
 * Insert a new message into the database.
 */
export function insertMessage({
  id,
  chatId,
  role,
  content,
  citations = null,
  createdAt,
}: {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: any;
  createdAt?: number;
}) {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO messages (id, chat_id, role, content, citations, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    chatId,
    role,
    content,
    citations ? JSON.stringify(citations) : null,
    createdAt ?? Date.now()
  );
}

/**
 * Update the content of an existing message.
 */
export function updateMessageContent(id: string, content: string) {
  const db = getDb();
  db.prepare(
    `UPDATE messages SET content = ? WHERE id = ?`
  ).run(content, id);
}

export function deleteMessage(id: string) {
  const db = getDb();
  db.prepare(`DELETE FROM messages WHERE id = ?`).run(id);
}

/**
 * Deletes only empty assistant message placeholders (pre-inserted rows that were
 * never filled because the stream failed or was regenerated).
 * This is safe — it never touches non-empty/completed messages regardless of
 * whether the AI SDK still has them in memory.
 */
export function purgeEmptyAssistantMessages(chatId: string) {
  const db = getDb();
  db.prepare(
    `DELETE FROM messages WHERE chat_id = ? AND role = 'assistant' AND (content IS NULL OR content = '')`
  ).run(chatId);
}

