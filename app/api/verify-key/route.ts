import { NextResponse } from "next/server";

import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

import type { ProviderId } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const {
    provider,
    apiKey,
    model,
  }: { provider: ProviderId; apiKey: string; model: string } = await req.json();

  if (!provider || !apiKey || !model) {
    return NextResponse.json(
      { ok: false, error: "Missing provider, apiKey, or model" },
      { status: 400 }
    );
  }

  try {
    let aiModel: ReturnType<ReturnType<typeof createOpenAI>>;

    switch (provider) {
      case "openai": {
        aiModel = createOpenAI({ apiKey })(model);
        break;
      }
      case "anthropic": {
        aiModel = createAnthropic({ apiKey })(model);
        break;
      }
      case "google": {
        aiModel = createGoogleGenerativeAI({ apiKey })(model);
        break;
      }
      case "openrouter": {
        aiModel = createOpenAI({
          apiKey,
          baseURL: "https://openrouter.ai/api/v1",
        })(model);
        break;
      }
      case "moonshot": {
        aiModel = createOpenAI({
          apiKey,
          baseURL: "https://api.moonshot.cn/v1",
        })(model);
        break;
      }
      default: {
        return NextResponse.json(
          { ok: false, error: "Unknown provider" },
          { status: 400 }
        );
      }
    }

    await generateText({
      model: aiModel,
      prompt: "Reply with the single word: ready",
      maxTokens: 5,
    } as Parameters<typeof generateText>[0]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Key verification failed";

    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}