import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import getDb from "@/lib/db";
import { WESTON_DIR } from "@/lib/constants";
import { reingestTextSource } from "@/lib/ingest";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;

  if (!id) {
    return new Response("Missing source ID", { status: 400 });
  }

  try {
    const db = getDb();
    
    const source = db.prepare("SELECT name, kind FROM sources WHERE id = ?").get(id) as { name: string, kind: string } | undefined;

    if (!source) {
      return new Response("Source not found", { status: 404 });
    }

    const filePath = path.join(WESTON_DIR, "uploads", `${id}.${source.kind}`);
    
    let fileBuffer: Buffer | null = null;
    let isReconstructedText = false;
    
    try {
      await fs.access(filePath);
      fileBuffer = await fs.readFile(filePath);
    } catch {
      // Missing physical file. This normally 404s, but to prevent old files
      // (uploaded before persistent storage was built) from erroring out,
      // we can reconstruct raw text string from the DB chunks.
      const chunks = db.prepare("SELECT text FROM chunks WHERE source_id = ? ORDER BY seq ASC").all(id) as { text: string }[];
      
      if (chunks.length === 0) {
        return new Response("File not found on disk and no chunks exist in DB.", { status: 404 });
      }

      fileBuffer = Buffer.from(chunks.map(c => c.text).join(""));
      isReconstructedText = true;
    }

    // Determine content type
    let contentType = "application/octet-stream";
    if (!isReconstructedText && source.kind === "pdf") contentType = "application/pdf";
    else if (source.kind === "txt" || isReconstructedText) contentType = "text/plain";
    else if (source.kind === "md") contentType = "text/markdown";

    return new Response(fileBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${source.name}"`,
      },
    });

  } catch (err) {
    console.error("Error serving file:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function PUT(
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
    
    if (typeof body.content !== "string") {
      return NextResponse.json({ ok: false, error: "Missing or invalid content string" }, { status: 400 });
    }

    // Start reingestion in the background
    Promise.resolve().then(async () => {
      try {
        await reingestTextSource(id, body.content);
      } catch (err) {
        console.error("Background reingestion failed", err);
      }
    });

    // Assume UI handles the polling status via the existing polling effect
    return NextResponse.json({ ok: true, status: "pending" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to update source" },
      { status: 500 }
    );
  }
}
