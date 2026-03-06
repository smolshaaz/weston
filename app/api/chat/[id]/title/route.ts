import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";

import { readSettings } from "@/lib/fs";
import { renameSession } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const { id: chatId } = resolvedParams;

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "Missing prompt" }, { status: 400 });
    }

    // 1. Initialize Provider Model
    const settings = readSettings();
    const modelRef = settings.defaultModel;

    let model;

    // Check if the provider requires an API key
    const isLocalProvider = modelRef.provider === "ollama" || modelRef.provider === "default";
    const activeProvider = settings.providers.find((p) => p.id === modelRef.provider);

    if (!isLocalProvider && !activeProvider?.apiKey) {
      return NextResponse.json({ ok: false, error: "No API key found for default provider" }, { status: 400 });
    }

    // Resolve "default" to an actual model ID
    let actualModelId = modelRef.model;
    if (actualModelId === "default") {
      const { PROVIDERS } = await import("@/lib/constants");
      const providerData = PROVIDERS.find(p => p.id === modelRef.provider);
      if (providerData && "suggestedModels" in providerData && providerData.suggestedModels?.[0]) {
        actualModelId = providerData.suggestedModels[0].id;
      }
    }

    if (modelRef.provider === "openai" || modelRef.provider === "moonshot") {
      let baseURL;
      switch (modelRef.provider) {
        case "moonshot": baseURL = "https://api.moonshot.cn/v1"; break;
        default: baseURL = undefined; // standard openai
      }
      
      const openai = createOpenAI({
        apiKey: activeProvider?.apiKey || "",
        ...(baseURL ? { baseURL } : {})
      });
      model = openai(actualModelId);
    } else if (modelRef.provider === "anthropic") {
      const anthropic = createAnthropic({ apiKey: activeProvider?.apiKey || "" });
      model = anthropic(actualModelId);
    } else if (modelRef.provider === "google") {
      const google = createGoogleGenerativeAI({ apiKey: activeProvider?.apiKey || "" });
      model = google(actualModelId);
    } else if (modelRef.provider === "openrouter") {
      const openai = createOpenAI({
        apiKey: activeProvider?.apiKey || "",
        baseURL: "https://openrouter.ai/api/v1",
      });
      model = openai(actualModelId);
    } else if (modelRef.provider === "ollama") {
      const openai = createOpenAI({
        apiKey: "ollama",
        baseURL: "http://localhost:11434/v1",
      });
      model = openai(actualModelId);
    } else {
      // standard fallback
      const openai = createOpenAI({ apiKey: activeProvider?.apiKey || "" });
      model = openai(actualModelId);
    }

    // 2. Generate a very short title
    let newTitle = "";
    try {
      const { text } = await generateText({
        model,
        system: "You are a helpful assistant that generates extremely short titles for chat conversations. Provide a 3-5 word title that summarizes the core topic of the user's prompt. Do NOT use quotes, punctuation, or conversational filler at the beginning or end. Just the title.",
        prompt: prompt,
      });
      newTitle = text.trim().replace(/^["'](.*)["']$/, '$1'); // Strip quotes
    } catch (llmError) {
      console.warn("LLM title generation failed, falling back to heuristic:", llmError);
      
      // Fallback: Drop common conversational filler, then take first 4-5 words
      const stopwords = new Set([
        "i", "would", "love", "like", "to", "know", "what", "is", "the", "who", "where", "why", "how", "tell", "me", "about", 
        "of", "a", "an", "for", "and", "or", "but", "in", "on", "at", "by", "with", 
        "can", "you", "please", "explain", "briefly", "detail", "some", "more", "things", "stuff", "want", "learn", "give", "show"
      ]);
      
      const rawWords = prompt.trim().split(/\s+/);
      const cleanedWords = rawWords.map((w: string) => w.replace(/[^a-zA-Z0-9]/g, ''));
      const meaningfulWords = cleanedWords.filter((w: string) => w.length > 0 && !stopwords.has(w.toLowerCase()));
      
      if (meaningfulWords.length > 0) {
        // Capitalize first letter of each word
        const titleWords = meaningfulWords.slice(0, 4).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        newTitle = titleWords.join(" ") + (meaningfulWords.length > 4 ? "..." : "");
      } else {
        // If entirely stopwords (e.g., "tell me about it"), just use original words
        newTitle = rawWords.slice(0, 4).join(" ") + (rawWords.length > 4 ? "..." : "");
      }
    }

    // 3. Save to database
    renameSession(chatId, newTitle);

    return NextResponse.json({ ok: true, title: newTitle });
  } catch (err) {
    console.error("Failed to generate title:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
