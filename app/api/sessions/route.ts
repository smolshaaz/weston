import { NextResponse } from "next/server";
import { listSessions, createSession, deleteSession } from "@/lib/sessions";

export const runtime = "nodejs";

/**
 * GET /api/sessions — list all chat sessions
 */
export async function GET() {
  try {
    const sessions = listSessions();
    return NextResponse.json({ ok: true, sessions });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to list sessions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions — create a new chat session
 * Body: { id: string, title?: string }
 */
export async function POST(req: Request) {
  try {
    const { id, title } = await req.json();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing session id" },
        { status: 400 }
      );
    }

    // Use ensureSession instead of createSession to avoid SQLite UNIQUE constraint failed errors
    const { ensureSession } = await import("@/lib/sessions");
    ensureSession(id, title || "New chat");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to create session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions — delete a chat session
 * Body: { id: string }
 */
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing session id" },
        { status: 400 }
      );
    }

    deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to delete session" },
      { status: 500 }
    );
  }
}
