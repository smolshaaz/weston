import { NextResponse } from "next/server";

import getDb from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return NextResponse.json(
      { ok: false, error: "Missing chatId" },
      { status: 400 }
    );
  }

  const db = getDb();

  const rows = db
    .prepare(
      `
      SELECT id, name, kind, status, progress, is_active, word_count, tokens
      FROM sources
      WHERE chat_id = ?
      ORDER BY created_at DESC
    `
    )
    .all(chatId) as Array<{
    id: string;
    name: string;
    kind: string;
    status: string;
    progress: number;
    is_active: number;
    word_count: number;
    tokens: number;
  }>;

  const sources = rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as "pdf" | "txt" | "md",
    status: r.status as "indexed" | "indexing" | "failed" | "pending",
    progress: r.progress || 0,
    isActive: r.is_active === 1,
    wordCount: r.word_count || 0,
    tokens: r.tokens || 0,
  }));

  return NextResponse.json({ ok: true, sources });
}