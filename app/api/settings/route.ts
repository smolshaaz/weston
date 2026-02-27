import { NextResponse } from "next/server";

import { readSettings, writeIdentityMd, writeSettings } from "@/lib/fs";
import type { WestonSettings } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  const settings = readSettings();

  // Never send real API keys to the client.
  const safe = {
    ...settings,
    providers: settings.providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? `${p.apiKey.slice(0, 6)}...${p.apiKey.slice(-4)}` : "",
    })),
  };

  return NextResponse.json(safe);
}

export async function POST(req: Request) {
  const body: Partial<WestonSettings> = await req.json();
  const current = readSettings();

  // Only allow updating non-secret fields here. Provider keys are handled
  // by /api/settings/providers.
  const updated: WestonSettings = {
    ...current,
    setupComplete: body.setupComplete ?? current.setupComplete,
    userName: body.userName ?? current.userName,
    userAbout: body.userAbout ?? current.userAbout,
    defaultModel: body.defaultModel ?? current.defaultModel,
    fallbackModels: body.fallbackModels ?? current.fallbackModels,
    providers: current.providers,
  };

  writeSettings(updated);

  if (body.userName !== undefined || body.userAbout !== undefined) {
    const rawContent = `# User Identity\n\n## Name\n${updated.userName || "Unknown"}\n\n## About\n${updated.userAbout || ""}\n\n## Notes\n(Updated over time.)\n`;
    writeIdentityMd(rawContent);
  }

  return NextResponse.json({ ok: true });
}