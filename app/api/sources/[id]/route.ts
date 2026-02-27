import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing source ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ ok: false, error: "Missing or invalid isActive boolean" }, { status: 400 });
    }

    const db = getDb();
    const activeInt = body.isActive ? 1 : 0;

    const result = db.prepare(`
      UPDATE sources 
      SET is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(activeInt, Date.now(), id);

    if (result.changes === 0) {
      return NextResponse.json({ ok: false, error: "Source not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to toggle source" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Support for both Next.js 14 and 15 dynamic route parameter formats
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing source ID" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    
    // Deleting from sources will cascade to chunks and embeddings based on the schema
    db.prepare('DELETE FROM sources WHERE id = ?').run(id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to delete source",
      },
      { status: 500 }
    );
  }
}
