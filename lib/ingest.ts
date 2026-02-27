import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { PDFParse } from "pdf-parse";
import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import getDb from "@/lib/db";
import { readSettings } from "@/lib/fs";
import { WESTON_DIR, type ProviderId } from "@/lib/constants";

// Configuration
const CHUNK_SIZE = 1500; // characters per chunk (increased for better context)
const CHUNK_OVERLAP = 300; // overlap between chunks

export interface IngestResult {
  sourceId: string;
  chunks: number;
  status: "success" | "failed";
  error?: string;
}

/**
 * Main entry point: ingest a file from disk
 */
export async function ingestFile(
  chatId: string,
  filePath: string,
  originalName: string
): Promise<IngestResult> {
  const db = getDb();

  const stat = await fs.stat(filePath);
  const ext = path.extname(originalName).toLowerCase();
  const kind = ext === ".pdf" ? "pdf" : ext === ".txt" ? "txt" : "md";

  // Create source record
  const sourceId = `src_${crypto.randomUUID()}`;
  const now = Date.now();

  db.prepare(
    `
    INSERT INTO sources (id, chat_id, name, kind, status, progress, bytes, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)
  `
  ).run(sourceId, chatId, originalName, kind, stat.size, now, now);

  try {
    // Extract text
    const buffer = await fs.readFile(filePath);
    let text: string;

    if (kind === "pdf") {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      text = data.text;
    } else {
      text = buffer.toString("utf-8");
    }

    if (!text.trim()) {
      throw new Error("No text extracted from file");
    }
    
    // Process analytics
    const words = text.match(/\b\w+\b/g);
    const wordCount = words ? words.length : 0;
    const tokens = Math.ceil(wordCount * 1.3);
    
    // Save to permanent uploads directory
    const uploadsDir = path.join(WESTON_DIR, "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Also save a raw text version for txt/md just in case, but keep PDF original
    const targetFile = path.join(uploadsDir, `${sourceId}.${kind}`);
    await fs.copyFile(filePath, targetFile);

    // Chunk text
    const chunks = chunkText(text);

    await processAndEmbedText(db, sourceId, chunks, wordCount, tokens);

    return {
      sourceId,
      chunks: chunks.length,
      status: "success",
    };
  } catch (err) {
    // Update source status to failed
    db.prepare(
      `
      UPDATE sources
      SET status = 'failed', updated_at = ?
      WHERE id = ?
    `
    ).run(Date.now(), sourceId);

    return {
      sourceId,
      chunks: 0,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Ingest raw text (from "Add Text" modal)
 */
export async function ingestText(
  chatId: string,
  title: string,
  text: string
): Promise<IngestResult> {
  // Write to a temp file and reuse ingestFile
  const tmpDir = path.join(WESTON_DIR, "tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  const tmpFile = path.join(tmpDir, `${crypto.randomUUID()}.txt`);
  await fs.writeFile(tmpFile, text, "utf-8");

  try {
    const result = await ingestFile(chatId, tmpFile, `${title}.txt`);
    await fs.unlink(tmpFile);
    return result;
  } catch (err) {
    await fs.unlink(tmpFile).catch(() => {});
    throw err;
  }
}

/**
 * Shared logic to process chunk text and embed it into the database
 */
async function processAndEmbedText(
  db: ReturnType<typeof getDb>,
  sourceId: string,
  chunks: ReturnType<typeof chunkText>,
  wordCount: number,
  tokens: number
) {
  const settings = readSettings();
  const embeddingProvider = settings.providers.find((p) => p.enabled);
  if (!embeddingProvider) {
    throw new Error("No provider configured for embeddings");
  }

  const BATCH_SIZE = 100;
  
  for (let currentBatchIdx = 0; currentBatchIdx < chunks.length; currentBatchIdx += BATCH_SIZE) {
    const batchChunks = chunks.slice(currentBatchIdx, currentBatchIdx + BATCH_SIZE);
    const batchTexts = batchChunks.map(c => c.text);
    
    const progress = Math.round((currentBatchIdx / chunks.length) * 100);
    db.prepare("UPDATE sources SET status = 'indexing', progress = ?, updated_at = ? WHERE id = ?")
      .run(progress, Date.now(), sourceId);
    
    const embeddings = await generateEmbeddings(
      embeddingProvider.id,
      embeddingProvider.apiKey,
      batchTexts
    );
    
    for (let j = 0; j < batchChunks.length; j++) {
      const chunk = batchChunks[j];
      const embedding = embeddings[j];
      const overallIndex = currentBatchIdx + j;
      const chunkId = `chk_${crypto.randomUUID()}`;

      const chunkInsert = db.prepare(`
        INSERT INTO chunks (id, source_id, seq, text, page_start, page_end, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        chunkId,
        sourceId,
        overallIndex,
        chunk.text,
        chunk.pageStart,
        chunk.pageEnd,
        JSON.stringify(chunk.metadata)
      );

      const chunkRowId = chunkInsert.lastInsertRowid;

      db.prepare(`
        INSERT INTO embeddings (chunk_id, embedding)
        VALUES (?, ?)
      `).run(chunkId, Buffer.from(new Float32Array(embedding).buffer));

      db.prepare(`
        INSERT INTO vec_chunks (rowid, embedding)
        VALUES (?, ?)
      `).run(BigInt(chunkRowId), Buffer.from(new Float32Array(embedding).buffer));
    }
  }

  db.prepare(`
    UPDATE sources
    SET status = 'indexed', progress = 100, updated_at = ?, word_count = ?, tokens = ?
    WHERE id = ?
  `).run(Date.now(), wordCount, tokens, sourceId);
}

/**
 * Reingest an existing source with updated text content
 */
export async function reingestTextSource(
  sourceId: string,
  newText: string
): Promise<IngestResult> {
  const db = getDb();
  const now = Date.now();

  try {
    const source = db.prepare("SELECT kind FROM sources WHERE id = ?").get(sourceId) as { kind: string };
    if (!source || (source.kind !== 'txt' && source.kind !== 'md')) {
      throw new Error(`Cannot reingest source ${sourceId}: Invalid kind or not found`);
    }

    // Delete existing chunks (cascades to embeddings and triggers delete in vec_chunks)
    db.prepare("DELETE FROM chunks WHERE source_id = ?").run(sourceId);

    // Write new text to disk
    const targetFile = path.join(WESTON_DIR, "uploads", `${sourceId}.${source.kind}`);
    await fs.writeFile(targetFile, newText, "utf-8");

    // Process analytics
    const words = newText.match(/\b\w+\b/g);
    const wordCount = words ? words.length : 0;
    const tokens = Math.ceil(wordCount * 1.3);

    // Update source size and initial status
    const stat = await fs.stat(targetFile);
    db.prepare("UPDATE sources SET status = 'pending', progress = 0, bytes = ?, updated_at = ? WHERE id = ?")
      .run(stat.size, now, sourceId);

    // Chunk text
    const chunks = chunkText(newText);
    await processAndEmbedText(db, sourceId, chunks, wordCount, tokens);

    return {
      sourceId,
      chunks: chunks.length,
      status: "success",
    };
  } catch (err) {
    db.prepare("UPDATE sources SET status = 'failed', updated_at = ? WHERE id = ?").run(now, sourceId);
    return {
      sourceId,
      chunks: 0,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Split text into overlapping chunks
 */
function chunkText(text: string): Array<{
  text: string;
  pageStart?: number;
  pageEnd?: number;
  metadata: Record<string, unknown>;
}> {
  const chunks: Array<{
    text: string;
    pageStart?: number;
    pageEnd?: number;
    metadata: Record<string, unknown>;
  }> = [];

  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + CHUNK_SIZE, text.length);
    const chunkText = text.slice(i, end);

    chunks.push({
      text: chunkText,
      pageStart: undefined, // TODO: parse page numbers from PDF
      pageEnd: undefined,
      metadata: {},
    });

    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

/**
 * Generate batched embeddings using user's provider
 */
async function generateEmbeddings(
  providerId: ProviderId,
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  let provider;
  let modelId: string;

  switch (providerId) {
    case "openai":
      provider = createOpenAI({ apiKey });
      modelId = "text-embedding-3-small";
      break;
    case "openrouter":
      provider = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      modelId = "openai/text-embedding-3-small";
      break;
    case "moonshot":
      provider = createOpenAI({
        apiKey,
        baseURL: "https://api.moonshot.cn/v1",
      });
      modelId = "moonshot-v1-embedding";
      break;
    default:
      throw new Error(
        `Provider "${providerId}" does not support embeddings. ` +
        `Please configure an OpenAI or OpenRouter provider for document ingestion.`
      );
  }

  const { embeddings } = await embedMany({
    model: provider.embedding(modelId),
    values: texts,
  });

  return embeddings;
}

/**
 * Delete a source and all its chunks/embeddings
 */
export async function deleteSource(sourceId: string) {
  const db = getDb();
  
  // First, get the 'kind' to know the file extension to delete
  const source = db.prepare("SELECT kind FROM sources WHERE id = ?").get(sourceId) as { kind: string } | undefined;
  
  db.prepare("DELETE FROM sources WHERE id = ?").run(sourceId);
  // Chunks and embeddings are auto-deleted via ON DELETE CASCADE and triggers
  
  // Delete the saved file from disk
  if (source) {
    const fileToDelete = path.join(WESTON_DIR, "uploads", `${sourceId}.${source.kind}`);
    await fs.unlink(fileToDelete).catch(() => {});
  }
}

/**
 * Duplicates an existing source file into a new chat session.
 * Used exclusively for the branch-off feature.
 */
export async function duplicateSource(
  sourceId: string,
  newChatId: string
): Promise<IngestResult> {
  const db = getDb();
  
  const source = db.prepare("SELECT name, kind FROM sources WHERE id = ?").get(sourceId) as { name: string, kind: string } | undefined;
  if (!source) {
    throw new Error(`Source ${sourceId} not found`);
  }

  // Define original file path
  const originalFilePath = path.join(WESTON_DIR, "uploads", `${sourceId}.${source.kind}`);
  
  try {
    await fs.access(originalFilePath);
  } catch (err) {
    throw new Error(`Physical file for source ${sourceId} is missing and cannot be branched.`);
  }

  // Create a temporary copy to feed into standard ingestFile
  const tmpDir = path.join(WESTON_DIR, "tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  
  const tmpFile = path.join(tmpDir, `${crypto.randomUUID()}.${source.kind}`);
  await fs.copyFile(originalFilePath, tmpFile);

  try {
    const result = await ingestFile(newChatId, tmpFile, source.name);
    await fs.unlink(tmpFile).catch(() => {});
    return result;
  } catch (err) {
    await fs.unlink(tmpFile).catch(() => {});
    throw err;
  }
}