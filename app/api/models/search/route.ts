import { NextResponse } from "next/server";
import { readSettings } from "@/lib/fs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = readSettings();
    const openrouterProvider = settings.providers.find((p) => p.id === "openrouter");
    const apiKey = openrouterProvider?.apiKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key is missing from settings." },
        { status: 401 }
      );
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ models: data.data });
  } catch (error: any) {
    console.error("Error fetching OpenRouter models:", error);
    return NextResponse.json(
      { error: "Failed to load OpenRouter models." },
      { status: 500 }
    );
  }
}
