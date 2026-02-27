import { NextResponse } from "next/server";
import crypto from "node:crypto";
import getDb from "@/lib/db";
import { duplicateSource } from "@/lib/ingest";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const { id: originalChatId } = resolvedParams;

  try {
    const { targetMessageId } = await req.json();

    if (!targetMessageId) {
      return NextResponse.json({ ok: false, error: "Missing target message ID" }, { status: 400 });
    }

    const db = getDb();
    
    // Verify original chat exists
    const oldSession = db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(originalChatId) as any;
    if (!oldSession) {
      return NextResponse.json({ ok: false, error: "Original chat not found" }, { status: 404 });
    }

    // 1. Create New Chat Session
    const newChatId = `chat_${crypto.randomUUID()}`;
    const now = Date.now();
    
    // Generate a title indicating it's a branch
    let newTitle = oldSession.title;
    if (!newTitle.includes("(Branched)")) {
      newTitle = `${newTitle} (Branched)`;
    }

    db.prepare(`
      INSERT INTO chat_sessions (id, title, created_at, updated_at, attached_sources)
      VALUES (?, ?, ?, ?, '[]')
    `).run(newChatId, newTitle, now, now);

    // 2. Clone messages up to targetMessageId
    // First, find the created_at timestamp of the target message
    const targetMsg = db.prepare("SELECT created_at FROM messages WHERE id = ? AND chat_id = ?").get(targetMessageId, originalChatId) as { created_at: number } | undefined;
    
    if (!targetMsg) {
      return NextResponse.json({ ok: false, error: "Target message not found in this chat" }, { status: 404 });
    }

    // Fetch all messages up to that timestamp
    const messagesToClone = db.prepare(
      "SELECT id, role, content, citations, created_at FROM messages WHERE chat_id = ? AND created_at <= ? ORDER BY created_at ASC"
    ).all(originalChatId, targetMsg.created_at) as any[];

    // Insert them sequentially into the new chat
    const insertMsgStmt = db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, citations, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Use a transaction for bulk insert
    db.transaction(() => {
      for (const msg of messagesToClone) {
        // Create new IDs to avoid any DB collisions
        const newMsgId = `msg_${crypto.randomUUID()}`;
        insertMsgStmt.run(
          newMsgId,
          newChatId,
          msg.role,
          msg.content,
          msg.citations,
          msg.created_at
        );
      }
    })();

    // 3. Clone active sources
    // Only clone active sources so the user isn't forced to re-curate their context
    const activeSources = db.prepare(
      "SELECT id FROM sources WHERE chat_id = ? AND is_active = 1"
    ).all(originalChatId) as { id: string }[];

    // Background process to duplicate files and re-ingest
    Promise.resolve().then(async () => {
      for (const source of activeSources) {
        try {
          await duplicateSource(source.id, newChatId);
        } catch (err) {
          console.error(`Failed to duplicate source ${source.id} to new chat ${newChatId}`, err);
        }
      }
    });

    return NextResponse.json({ 
      ok: true, 
      newChatId,
      messageCount: messagesToClone.length 
    });

  } catch (err) {
    console.error("Error branching chat:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error branching chat" },
      { status: 500 }
    );
  }
}
