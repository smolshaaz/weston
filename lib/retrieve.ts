import { embed } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import getDb from "@/lib/db";
import { readSettings } from "@/lib/fs";
import { type ProviderId } from "@/lib/constants";

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  sourceName: string;
  kind: string;
  text: string;
  pageStart?: number;
  pageEnd?: number;
  distance: number;
}

/**
 * Generate embedding for a search query using the exact same logic as ingestion
 */
async function generateQueryEmbedding(
  providerId: ProviderId,
  apiKey: string,
  text: string
): Promise<number[]> {
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
        `Provider "${providerId}" does not support embeddings.`
      );
  }

  const { embedding } = await embed({
    model: provider.embedding(modelId),
    value: text,
  });

  return embedding;
}

/**
 * Retrieves the most relevant chunks for a given query and chat session
 */
export async function retrieveContext(
  chatId: string,
  query: string,
  k: number = 15
): Promise<RetrievedChunk[]> {
  const db = getDb();
  
  // 1. Check if the chat has any indexed AND active sources
  const sourceCount = db.prepare("SELECT COUNT(*) as count FROM sources WHERE chat_id = ? AND status = 'indexed' AND is_active = 1").get(chatId) as { count: number };
  if (sourceCount.count === 0) {
    return []; // No active sources to search
  }

  // 2. Get embedding model config
  const settings = readSettings();
  const embeddingProvider = settings.providers.find((p) => p.enabled);
  if (!embeddingProvider) {
    throw new Error("No provider configured for generating search embeddings");
  }

  // 3. Generate embedding for the search query
  const queryEmbedding = await generateQueryEmbedding(
    embeddingProvider.id,
    embeddingProvider.apiKey,
    query
  );

  // 4. Query vector database (SQLite-vec)
  // We use a subquery to filter by chat_id from the sources table, 
  // joining chunks and vec_chunks to find the closest distances.
  const queryBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);
  
  const stmt = db.prepare(`
    SELECT 
      c.id,
      c.source_id,
      s.name as source_name,
      s.kind,
      c.text,
      c.page_start,
      c.page_end,
      v.distance
    FROM vec_chunks v
    JOIN chunks c ON v.rowid = c.rowid
    JOIN sources s ON c.source_id = s.id
    WHERE s.chat_id = ? AND s.status = 'indexed' AND s.is_active = 1
      AND v.embedding MATCH ?
      AND k = ?
    ORDER BY v.distance ASC
  `);

  const rows = stmt.all(chatId, queryBuffer, k) as Array<{
    id: string;
    source_id: string;
    source_name: string;
    kind: string;
    text: string;
    page_start: number | null;
    page_end: number | null;
    distance: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    sourceName: r.source_name,
    kind: r.kind,
    text: r.text,
    pageStart: r.page_start || undefined,
    pageEnd: r.page_end || undefined,
    distance: r.distance,
  }));
}
