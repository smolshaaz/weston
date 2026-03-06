import { NextResponse } from "next/server";

import { readSettings, writeSettings } from "@/lib/fs";
import type { ProviderConfig, ProviderId } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body: Partial<ProviderConfig> & { id?: ProviderId } = await req.json();

  const id = body.id;
  const apiKey = body.apiKey;

  if (!id || !apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing provider id or apiKey" },
      { status: 400 }
    );
  }

  const settings = readSettings();
  const idx = settings.providers.findIndex((p) => p.id === id);

  const provider: ProviderConfig = {
    id,
    apiKey,
    enabled: body.enabled ?? true,
  };

  if (idx >= 0) {
    settings.providers[idx] = provider;
  } else {
    settings.providers.push(provider);
  }

  writeSettings(settings);

  return NextResponse.json({ ok: true });
}

/** Remove a provider entirely */
export async function DELETE(req: Request) {
  const { id }: { id: ProviderId } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const settings = readSettings();
  settings.providers = settings.providers.filter((p) => p.id !== id);
  writeSettings(settings);

  return NextResponse.json({ ok: true });
}

/** Update only the API key for an existing provider */
export async function PATCH(req: Request) {
  const { id, apiKey }: { id: ProviderId; apiKey: string } = await req.json();
  if (!id || !apiKey) return NextResponse.json({ ok: false, error: "Missing id or apiKey" }, { status: 400 });

  const settings = readSettings();
  const provider = settings.providers.find((p) => p.id === id);
  if (!provider) return NextResponse.json({ ok: false, error: "Provider not found" }, { status: 404 });

  provider.apiKey = apiKey;
  writeSettings(settings);

  return NextResponse.json({ ok: true });
}