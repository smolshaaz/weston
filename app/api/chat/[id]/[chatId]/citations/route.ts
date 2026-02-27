import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const { searchParams } = new URL(req.url);
    const sourceName = searchParams.get("sourceName");

    if (!chatId || !sourceName) {
      return NextResponse.json(
        { ok: false, error: "Missing chatId or sourceName" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Find the most recent assistant message for this chat that has citations
    const msg = db
      .prepare(
        `SELECT citations 
         FROM messages 
         WHERE chat_id = ? AND role = 'assistant' AND citations IS NOT NULL
         ORDER BY created_at DESC 
         LIMIT 1`
      )
      .get(chatId) as { citations: string } | undefined;

    if (!msg || !msg.citations) {
      return NextResponse.json({ ok: true, snippets: [] });
    }

    const allCitations: any[] = JSON.parse(msg.citations);

    // Filter chunks by the exact source name provided in the badge
    const matchedChunks = allCitations.filter(
      (c) => c.sourceName === sourceName
    );

    const snippets = matchedChunks.map((c) => ({
      text: c.text,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      distance: c.distance,
    }));

    return NextResponse.json({ ok: true, snippets });
  } catch (err) {
    console.error("Failed to fetch citations:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
