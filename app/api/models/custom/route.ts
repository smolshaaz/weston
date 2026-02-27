import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id, name, provider } = await req.json();

    if (!id || !name || !provider) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO custom_models (id, name, provider, created_at)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, name, provider, Date.now());

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error saving custom model:", error);
    return NextResponse.json({ error: "Failed to save model" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing required model id" }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`DELETE FROM custom_models WHERE id = ?`);
    stmt.run(id);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error deleting custom model:", error);
    return NextResponse.json({ error: "Failed to delete model" }, { status: 500 });
  }
}
