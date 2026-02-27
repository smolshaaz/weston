import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/sessions/[id] — fetch a single chat session
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  try {
    const db = getDb();
    const session = db
      .prepare("SELECT id, title, created_at, updated_at FROM chat_sessions WHERE id = ?")
      .get(id) as any;

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
