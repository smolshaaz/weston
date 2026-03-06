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
  seq?: number;
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
 * Performs a keyword search using SQL LIKE matching.
 * Extracts important keywords from the query and finds chunks containing them.
 */
function keywordSearch(
  db: ReturnType<typeof getDb>,
  chatId: string,
  query: string,
  limit: number = 10
): Array<{
  id: string;
  source_id: string;
  source_name: string;
  kind: string;
  text: string;
  page_start: number | null;
  page_end: number | null;
  seq: number;
}> {
  // Extract meaningful keywords: strip common stop words and short words
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no",
    "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "but", "and", "or", "if", "while", "about", "what",
    "which", "who", "whom", "this", "that", "these", "those", "am", "it",
    "its", "my", "your", "his", "her", "our", "their", "me", "him", "them",
    "i", "you", "he", "she", "we", "they",
  ]);

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) return [];

  // Build a query that matches chunks containing ANY of the keywords
  const conditions = keywords.map(() => "LOWER(c.text) LIKE ?").join(" OR ");
  const params = keywords.map((kw) => `%${kw}%`);

  const stmt = db.prepare(`
    SELECT 
      c.id,
      c.source_id,
      s.name as source_name,
      s.kind,
      c.text,
      c.page_start,
      c.page_end,
      c.seq
    FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE s.chat_id = ? AND s.status = 'indexed' AND s.is_active = 1
      AND (${conditions})
    LIMIT ?
  `);

  return stmt.all(chatId, ...params, limit) as any[];
}

/**
 * Fetches neighboring chunks (the chunk before and after each hit)
 * to provide more context around each retrieved result.
 */
function expandWithNeighbors(
  db: ReturnType<typeof getDb>,
  hitChunkIds: string[],
  chatId: string
): Array<{
  id: string;
  source_id: string;
  source_name: string;
  kind: string;
  text: string;
  page_start: number | null;
  page_end: number | null;
  seq: number;
}> {
  if (hitChunkIds.length === 0) return [];

  // For each hit chunk, find its source_id and seq, then grab seq-1 and seq+1
  const neighborStmt = db.prepare(`
    SELECT 
      c.id,
      c.source_id,
      s.name as source_name,
      s.kind,
      c.text,
      c.page_start,
      c.page_end,
      c.seq
    FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE c.source_id = ? AND c.seq = ?
      AND s.chat_id = ? AND s.status = 'indexed' AND s.is_active = 1
  `);

  const hitInfoStmt = db.prepare(`
    SELECT source_id, seq FROM chunks WHERE id = ?
  `);

  const neighbors: Array<any> = [];
  const alreadySeen = new Set(hitChunkIds);

  for (const chunkId of hitChunkIds) {
    const info = hitInfoStmt.get(chunkId) as { source_id: string; seq: number } | undefined;
    if (!info) continue;

    // Fetch previous chunk (seq - 1)
    const prev = neighborStmt.get(info.source_id, info.seq - 1, chatId) as any;
    if (prev && !alreadySeen.has(prev.id)) {
      neighbors.push(prev);
      alreadySeen.add(prev.id);
    }

    // Fetch next chunk (seq + 1)
    const next = neighborStmt.get(info.source_id, info.seq + 1, chatId) as any;
    if (next && !alreadySeen.has(next.id)) {
      neighbors.push(next);
      alreadySeen.add(next.id);
    }
  }

  return neighbors;
}

/**
 * Retrieves the most relevant chunks for a given query and chat session.
 * Uses a hybrid approach:
 *   1. Semantic vector search (primary)
 *   2. Keyword search (supplementary)
 *   3. Neighboring chunk expansion (context enrichment)
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

  // 4. SEMANTIC SEARCH — Query vector database (SQLite-vec)
  const queryBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);
  
  const semanticStmt = db.prepare(`
    SELECT 
      c.id,
      c.source_id,
      s.name as source_name,
      s.kind,
      c.text,
      c.page_start,
      c.page_end,
      c.seq,
      v.distance
    FROM vec_chunks v
    JOIN chunks c ON v.rowid = c.rowid
    JOIN sources s ON c.source_id = s.id
    WHERE s.chat_id = ? AND s.status = 'indexed' AND s.is_active = 1
      AND v.embedding MATCH ?
      AND k = ?
    ORDER BY v.distance ASC
  `);

  const semanticRows = semanticStmt.all(chatId, queryBuffer, k) as Array<{
    id: string;
    source_id: string;
    source_name: string;
    kind: string;
    text: string;
    page_start: number | null;
    page_end: number | null;
    seq: number;
    distance: number;
  }>;

  // 5. KEYWORD SEARCH — Find chunks containing important query terms
  const keywordRows = keywordSearch(db, chatId, query, 8);

  // 6. MERGE results — semantic results come first (higher priority),
  //    then keyword-only results that weren't already found by semantic search
  const seenIds = new Set(semanticRows.map((r) => r.id));
  const mergedIds = [...semanticRows.map((r) => r.id)];
  
  for (const kr of keywordRows) {
    if (!seenIds.has(kr.id)) {
      seenIds.add(kr.id);
      mergedIds.push(kr.id);
    }
  }

  // 7. NEIGHBOR EXPANSION — For every hit, also grab the chunk before and after
  const neighborRows = expandWithNeighbors(db, mergedIds, chatId);

  // Add neighbor IDs to the seen set
  for (const nr of neighborRows) {
    if (!seenIds.has(nr.id)) {
      seenIds.add(nr.id);
    }
  }

  // 8. BUILD final result — combine all chunks, deduplicate, and sort by
  //    source + sequence number so context flows naturally
  const allChunksMap = new Map<string, RetrievedChunk>();

  // Add semantic results with their distances
  for (const r of semanticRows) {
    allChunksMap.set(r.id, {
      id: r.id,
      sourceId: r.source_id,
      sourceName: r.source_name,
      kind: r.kind,
      text: r.text,
      pageStart: r.page_start || undefined,
      pageEnd: r.page_end || undefined,
      distance: r.distance,
      seq: r.seq,
    });
  }

  // Add keyword results (with a synthetic high distance since they weren't vector-matched)
  for (const r of keywordRows) {
    if (!allChunksMap.has(r.id)) {
      allChunksMap.set(r.id, {
        id: r.id,
        sourceId: r.source_id,
        sourceName: r.source_name,
        kind: r.kind,
        text: r.text,
        pageStart: r.page_start || undefined,
        pageEnd: r.page_end || undefined,
        distance: 0.99, // keyword-only results get a high distance
        seq: r.seq,
      });
    }
  }

  // Add neighbor results
  for (const r of neighborRows) {
    if (!allChunksMap.has(r.id)) {
      allChunksMap.set(r.id, {
        id: r.id,
        sourceId: r.source_id,
        sourceName: r.source_name,
        kind: r.kind,
        text: r.text,
        pageStart: r.page_start || undefined,
        pageEnd: r.page_end || undefined,
        distance: 0.95, // neighbor chunks get a moderate distance
        seq: r.seq,
      });
    }
  }

  // Sort by source, then by sequence number within source
  // This ensures chunks from the same document appear in reading order
  const results = Array.from(allChunksMap.values()).sort((a, b) => {
    if (a.sourceName !== b.sourceName) return a.sourceName.localeCompare(b.sourceName);
    return (a.seq ?? 0) - (b.seq ?? 0);
  });

  return results;
}
