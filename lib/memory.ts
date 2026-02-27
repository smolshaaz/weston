import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { readSettings, writeChatMemoryMd } from "@/lib/fs";
import { getMessagesForChat } from "@/lib/messages";
import type { ProviderId } from "@/lib/constants";
import getDb from "@/lib/db";

/**
 * Automatically summarizes a chat session if it has grown too long.
 * Generates a concise summary and saves it to the chat's memory folder.
 */
export async function summarizeChat(chatId: string) {
  try {
    const messages = getMessagesForChat(chatId);
    
    // Only summarize if we have a meaningful amount of messages (e.g., > 6)
    // and we haven't summarized very recently to save tokens.
    // As a simple heuristic for MVP, we'll summarize every 8 messages.
    if (messages.length < 8 || messages.length % 8 !== 0) {
      return;
    }

    const settings = readSettings();
    let modelRef = settings.defaultModel;

    // Use default model for summarization, fallback if needed
    const activeProvider = settings.providers.find((p) => p.id === modelRef.provider);
    if (!activeProvider?.apiKey && modelRef.provider !== "ollama" && modelRef.provider !== "default") {
      console.warn("Summarization aborted: No API key for default provider.");
      return;
    }

    let model;
    const apiKey = activeProvider?.apiKey || "";

    switch (modelRef.provider) {
      case "openai":
        model = createOpenAI({ apiKey })(modelRef.model);
        break;
      case "anthropic":
        model = createAnthropic({ apiKey })(modelRef.model);
        break;
      case "google":
        model = createGoogleGenerativeAI({ apiKey })(modelRef.model);
        break;
      case "openrouter":
        const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
        model = createOpenRouter({ apiKey })(modelRef.model);
        break;
      case "moonshot":
        model = createOpenAI({
          apiKey,
          baseURL: "https://api.moonshot.cn/v1",
          compatibility: "compatible",
        } as any)(modelRef.model);
        break;
      default:
        console.warn(`Summarization aborted: Unsupported provider ${modelRef.provider}`);
        return;
    }

    // Format transcript for the summarizer
    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const systemPrompt = `
You are a memory compressor for an AI assistant.
Your job is to read the attached conversation transcript and produce a highly condensed, bulleted summary of the established facts, context, and user goals.
Do NOT summarize pleasantries. Focus ONLY on actionable context that the AI should remember if it were to continue this exact conversation tomorrow.
Write the summary as a direct reference guide (e.g., "User is trying to build X", "We decided to use Y framework").
`;

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `TRANSCRIPT:\n${transcript}`,
      temperature: 0.1,
      maxOutputTokens: 1000,
    });

    if (text) {
      // Save it as summary.md in the chat's specific memory folder
      writeChatMemoryMd(chatId, "summary.md", text.trim());
      console.log(`[Memory Base] Generated new background summary for chat ${chatId}`);

      // Now, ingest this summary into the vector DB so it can be retrieved across other chats
      try {
        const { ingestText, deleteSource } = await import("@/lib/ingest");
        const summaryTitle = `Memory Summary ${chatId}`;
        const summaryFileName = `${summaryTitle}.txt`;
        
        // Delete older memory summaries for this chat to prevent duplicates
        const db = getDb();
        const oldSources = db.prepare(`SELECT id FROM sources WHERE chat_id = ? AND name = ?`).all(chatId, summaryFileName) as { id: string }[];
        
        for (const s of oldSources) {
          await deleteSource(s.id);
        }

        await ingestText(chatId, summaryTitle, text.trim());
        console.log(`[Memory Base] Embedded summary into vec_chunks for cross-chat retrieval.`);
      } catch (ingestErr) {
        console.error(`[Memory Base] Failed to embed summary for ${chatId}:`, ingestErr);
      }
    }

  } catch (err) {
    console.error(`[Memory Base] Failed to summarize chat ${chatId}:`, err);
  }
}

/**
 * Extracts explicit user facts from the most recent messages and appends them to the global identity file.
 */
export async function extractUserFacts(chatId: string) {
  try {
    const messages = getMessagesForChat(chatId);
    
    // Only process the last few user messages to find new facts
    const recentUserMessages = messages
      .filter(m => m.role === "user")
      .slice(-3); // Check the last 3 user messages

    if (recentUserMessages.length === 0) return;

    const transcript = recentUserMessages.map(m => m.content).join("\n");

    const settings = readSettings();
    let modelRef = settings.defaultModel;

    const activeProvider = settings.providers.find((p) => p.id === modelRef.provider);
    if (!activeProvider?.apiKey && modelRef.provider !== "ollama" && modelRef.provider !== "default") {
      return;
    }

    let model;
    const apiKey = activeProvider?.apiKey || "";

    switch (modelRef.provider) {
      case "openai":
        model = createOpenAI({ apiKey })(modelRef.model);
        break;
      case "anthropic":
        model = createAnthropic({ apiKey })(modelRef.model);
        break;
      case "google":
        model = createGoogleGenerativeAI({ apiKey })(modelRef.model);
        break;
      case "openrouter":
        const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
        model = createOpenRouter({ apiKey })(modelRef.model);
        break;
      case "moonshot":
        model = createOpenAI({
          apiKey,
          baseURL: "https://api.moonshot.cn/v1",
          compatibility: "compatible",
        } as any)(modelRef.model);
        break;
      default:
        return;
    }

    const systemPrompt = `
You are an identity extraction engine.
Read the user's messages and extract ONLY explicit facts they state about themselves (e.g., "I am a developer", "My dog's name is Rex", "I prefer short answers").
Do NOT extract questions, musings, or facts about the world. ONLY extract facts about the user's identity, preferences, or environment.
If you find a fact, summarize it into a short, concise bullet point (e.g., "- User is a React developer").
If there are NO explicit facts about the user in these messages, you MUST output the exact string "NO_FACTS" and nothing else.
`;

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `USER MESSAGES:\n${transcript}`,
      temperature: 0.1,
      maxOutputTokens: 200,
    });

    const factText = text?.trim();

    if (factText && factText !== "NO_FACTS" && factText.length > 5) {
      const { readIdentityMd, writeIdentityMd } = await import("@/lib/fs");
      const currentIdentity = readIdentityMd();
      const newIdentity = `${currentIdentity.trim()}\n${factText}\n`;
      writeIdentityMd(newIdentity);
      console.log(`[Memory Base] Extracted new user fact: ${factText}`);
    }

  } catch (err) {
    console.error(`[Memory Base] Failed to extract facts for ${chatId}:`, err);
  }
}
