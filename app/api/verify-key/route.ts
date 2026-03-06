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

  if (!provider || !apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing provider or apiKey" },
      { status: 400 }
    );
  }

  // For manage-mode providers that don't pick a model at connect time,
  // verify the key by pinging the provider's models-list endpoint.
  if (!model) {
    try {
      let listUrl = "";
      const headers: Record<string, string> = {};

      switch (provider) {
        case "openai":
          listUrl = "https://api.openai.com/v1/models";
          headers["Authorization"] = `Bearer ${apiKey}`;
          break;
        case "anthropic":
          listUrl = "https://api.anthropic.com/v1/models";
          headers["x-api-key"] = apiKey;
          headers["anthropic-version"] = "2023-06-01";
          break;
        case "google":
          listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
          break;
        case "moonshot":
          // Moonshot's /v1/models endpoint rejects auth; trust the key and validate
          // it for real on first message instead.
          return NextResponse.json({ ok: true });
        default:
          // Unknown provider with no model — just trust it
          return NextResponse.json({ ok: true });
      }

      const res = await fetch(listUrl, { headers });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        let errorMsg = `API key rejected (HTTP ${res.status})`;
        try {
          const json = JSON.parse(bodyText);
          // OpenAI / Moonshot / OpenRouter: { error: { message } }
          // Anthropic: { error: { message } }
          // Google: { error: { message } }
          errorMsg = json?.error?.message ?? json?.message ?? errorMsg;
        } catch {}
        return NextResponse.json({ ok: false, error: errorMsg }, { status: 401 });
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Key verification failed";
      return NextResponse.json({ ok: false, error: message }, { status: 401 });
    }
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