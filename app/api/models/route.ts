import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDb();
    const customModels = db.prepare(`SELECT id, name, provider FROM custom_models ORDER BY created_at ASC`).all() as any[];
    return NextResponse.json({ models: customModels || [] });
  } catch (error: any) {
    console.error("Error fetching models:", error);
    return NextResponse.json({ models: [] });
  }
}
