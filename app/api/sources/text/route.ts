import { NextResponse } from "next/server";

import { ingestText } from "@/lib/ingest";
import { ensureSession } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { chatId, title, text } = await req.json();

  // Auto-create chat session if it doesn't exist yet
  if (chatId) ensureSession(chatId);

  if (!chatId || !title || !text) {
    return NextResponse.json(
      { ok: false, error: "Missing chatId, title, or text" },
      { status: 400 }
    );
  }

  try {
    // Start ingestion in the background so the request responds immediately
    Promise.resolve().then(async () => {
      try {
        await ingestText(chatId, title, text);
      } catch (err) {
        console.error("Background text ingestion failed", err);
      }
    });

    return NextResponse.json({ 
      ok: true, 
      result: { status: "pending", name: title + ".txt" } 
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Text ingestion failed",
      },
      { status: 500 }
    );
  }
}