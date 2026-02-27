import { NextResponse } from "next/server";
import { renameSession } from "@/lib/sessions";

export const runtime = "nodejs";

/**
 * POST /api/sessions/rename — rename a chat session
 * Body: { id: string, title: string }
 */
export async function POST(req: Request) {
  try {
    const { id, title } = await req.json();

    if (!id || !title) {
      return NextResponse.json(
        { ok: false, error: "Missing session id or title" },
        { status: 400 }
      );
    }

    renameSession(id, title);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to rename session" },
      { status: 500 }
    );
  }
}
