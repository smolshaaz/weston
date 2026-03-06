import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/chat/[id]/branches
 * Returns a map of messageId → array of { id, title } for all sessions
 * that were branched from a specific message in this chat.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id: chatId } = await Promise.resolve(params);

  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, title, parent_message_id
      FROM chat_sessions
      WHERE parent_id = ? AND parent_message_id IS NOT NULL
      ORDER BY created_at ASC
    `).all(chatId) as { id: string; title: string; parent_message_id: string }[];

    // Group by parent_message_id
    const map: Record<string, { id: string; title: string }[]> = {};
    for (const row of rows) {
      if (!map[row.parent_message_id]) map[row.parent_message_id] = [];
      map[row.parent_message_id].push({ id: row.id, title: row.title });
    }

    return NextResponse.json({ ok: true, branches: map });
  } catch (err) {
    console.error("branches fetch error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
