import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { readSettings, writeSettings } from "@/lib/fs";

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

    // If it was previously hidden, unhide it
    const settings = readSettings();
    const key = `${provider}::${id}`;
    if (settings.hiddenModels?.includes(key)) {
      settings.hiddenModels = settings.hiddenModels.filter((h) => h !== key);
      writeSettings(settings);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error saving custom model:", error);
    return NextResponse.json({ error: "Failed to save model" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id, provider } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing required model id" }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(`DELETE FROM custom_models WHERE id = ?`);
    stmt.run(id);

    // Also try to hide it if it was a default model
    if (provider) {
      const settings = readSettings();
      const key = `${provider}::${id}`;
      // Initialize if missing
      if (!settings.hiddenModels) settings.hiddenModels = [];
      if (!settings.hiddenModels.includes(key)) {
        settings.hiddenModels.push(key);
        writeSettings(settings);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error deleting custom model:", error);
    return NextResponse.json({ error: "Failed to delete model" }, { status: 500 });
  }
}
