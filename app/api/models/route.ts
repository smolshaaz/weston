import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { readSettings } from "@/lib/fs";
import { PROVIDERS } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDb();
    const customModels = db.prepare(`SELECT id, name, provider FROM custom_models ORDER BY created_at ASC`).all() as any[];
    
    // Inject default models for configured providers
    const settings = readSettings();
    const enabledProviders = new Set(settings.providers.filter((p) => p.enabled && p.apiKey).map((p) => p.id));
    
    // Some providers like openrouter are pure custom, others have suggested defaults
    const defaultModels: any[] = [];
    for (const p of PROVIDERS) {
      if (enabledProviders.has(p.id) && "suggestedModels" in p && p.suggestedModels) {
        for (const sm of p.suggestedModels) {
          defaultModels.push({ id: sm.id, name: sm.name, provider: p.id });
        }
      }
    }

    // Merge and deduplicate (custom models override defaults if ids match)
    const seen = new Set<string>();
    const merged: any[] = [];
    
    for (const cm of customModels) {
      const key = `${cm.provider}::${cm.id}`;
      seen.add(key);
      merged.push(cm);
    }
    
    for (const dm of defaultModels) {
      const key = `${dm.provider}::${dm.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(dm);
      }
    }

    // Filter out hidden models
    const hiddenSet = new Set(settings.hiddenModels || []);
    const finalModels = merged.filter((m) => !hiddenSet.has(`${m.provider}::${m.id}`));

    return NextResponse.json({ models: finalModels });
  } catch (error: any) {
    console.error("Error fetching models:", error);
    return NextResponse.json({ models: [] });
  }
}
