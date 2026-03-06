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
    if (!activeProvider?.apiKey && modelRef.provider !== "ollama") {
      console.warn("Summarization aborted: No API key for default provider.");
      return;
    }

    let model;
    const apiKey = activeProvider?.apiKey || "";

    let actualModelId = modelRef.model === "default" && settings.defaultModel ? settings.defaultModel.model : modelRef.model;
    if (actualModelId === "default") {
      const { PROVIDERS } = await import("@/lib/constants");
      const providerData = PROVIDERS.find(p => p.id === modelRef.provider);
      if (providerData && "suggestedModels" in providerData && providerData.suggestedModels?.[0]) {
        actualModelId = providerData.suggestedModels[0].id;
      }
    }

    switch (modelRef.provider) {
      case "openai":
        model = createOpenAI({ apiKey })(actualModelId);
        break;
      case "anthropic":
        model = createAnthropic({ apiKey })(actualModelId);
        break;
      case "google":
        model = createGoogleGenerativeAI({ apiKey })(actualModelId);
        break;
      case "openrouter":
        const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
        model = createOpenRouter({ apiKey })(actualModelId);
        break;
      case "moonshot":
        model = createOpenAI({
          apiKey,
          baseURL: "https://api.moonshot.cn/v1",
        }).chat(actualModelId);
        break;
      default:
        console.warn(`Summarization aborted: Unsupported provider ${modelRef.provider}`);
        return;
    }

    // Format transcript for the summarizer
    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const systemPrompt = `You are a conversation memory compressor for an AI assistant called Weston.

Your job is to read the conversation transcript below and produce a tightly compressed summary of ONLY the actionable context worth remembering if this conversation were to continue tomorrow.

INCLUDE:
- User's goals for this conversation
- Decisions that were made
- Constraints or requirements the user specified
- Preferences the user expressed about approach or style
- Unresolved tasks or open questions
- Established facts that are critical to continuing the work
- Next steps that were agreed upon

EXCLUDE:
- Greetings, pleasantries, filler, and small talk
- Repetition of the same point
- Generic world knowledge that any AI already knows
- The AI's own reasoning process
- Anything that would be obvious from re-reading the chat

OUTPUT FORMAT:
- Concise bullet points, each starting with a dash (-)
- Write in third person (e.g., "User is building X", "We decided to use Y")
- If the conversation contains NO actionable context worth remembering, output exactly: NO_FACTS
- Maximum 15 bullet points. Prioritize the most important context.
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
    if (!activeProvider?.apiKey && modelRef.provider !== "ollama") {
      modelRef = settings.defaultModel;
    }

    let model;
    const apiKey = activeProvider?.apiKey || "";

    let actualModelId = modelRef.model === "default" && settings.defaultModel ? settings.defaultModel.model : modelRef.model;
    if (actualModelId === "default") {
      const { PROVIDERS } = await import("@/lib/constants");
      const providerData = PROVIDERS.find(p => p.id === modelRef.provider);
      if (providerData && "suggestedModels" in providerData && providerData.suggestedModels?.[0]) {
        actualModelId = providerData.suggestedModels[0].id;
      }
    }

    switch (modelRef.provider) {
      case "openai":
        model = createOpenAI({ apiKey })(actualModelId);
        break;
      case "anthropic":
        model = createAnthropic({ apiKey })(actualModelId);
        break;
      case "google":
        model = createGoogleGenerativeAI({ apiKey })(actualModelId);
        break;
      case "openrouter":
        const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
        model = createOpenRouter({ apiKey })(actualModelId);
        break;
      case "moonshot":
        model = createOpenAI({
          apiKey,
          baseURL: "https://api.moonshot.cn/v1",
        }).chat(actualModelId);
        break;
      default:
        return;
    }

    const systemPrompt = `You are an identity extraction engine for an AI assistant called Weston.

Your job is to read the user's messages and extract ONLY explicit, durable facts the user has directly stated about themselves.

EXTRACT:
- Identity traits (e.g., "I am a software developer", "I'm 25")
- Stable preferences (e.g., "I prefer short answers", "I like dark mode")
- Personal details (e.g., "My dog's name is Rex", "I live in Berlin")
- Environment/setup details (e.g., "I use a MacBook", "I code in TypeScript")
- Durable goals explicitly stated (e.g., "I'm building a startup", "I want to learn Rust")

DO NOT EXTRACT:
- Questions the user asked
- Guesses, speculation, or hypotheticals
- Facts about the world, technology, or other people
- Anything the AI assistant said (only extract from USER messages)
- Implied facts not explicitly stated
- Temporary or one-off statements (e.g., "I'm tired today")

OUTPUT FORMAT:
- Each fact as a short bullet point starting with "- User" (e.g., "- User is a React developer")
- If there are NO explicit identity facts in these messages, output exactly: NO_FACTS
- Do not output anything else. No explanations, no preamble.
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
