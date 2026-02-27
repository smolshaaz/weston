import { NextResponse } from "next/server";

import { ingestFile } from "@/lib/ingest";
import { ensureSession } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const chatId = formData.get("chatId") as string | null;

  // Auto-create chat session if it doesn't exist yet
  if (chatId) ensureSession(chatId);

  if (!file || !chatId) {
    return NextResponse.json(
      { ok: false, error: "Missing file or chatId" },
      { status: 400 }
    );
  }

  try {
    // Write uploaded file to temp location
    const tmpDir = "/tmp/weston-uploads";
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(tmpDir, { recursive: true });

    const tmpPath = `${tmpDir}/${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tmpPath, buffer);

    // Start ingestion in the background so the request responds immediately
    Promise.resolve().then(async () => {
      try {
        await ingestFile(chatId, tmpPath, file.name);
      } catch (err) {
        console.error("Background ingestion failed", err);
      } finally {
        // Clean up temp file
        const { unlink } = await import("node:fs/promises");
        await unlink(tmpPath).catch(() => {});
      }
    });

    return NextResponse.json({ 
      ok: true, 
      result: { status: "pending", name: file.name } 
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}