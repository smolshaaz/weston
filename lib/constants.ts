import os from "node:os";
import path from "node:path";

export const WESTON_DIR = path.join(os.homedir(), ".weston");

export type ProviderId =
  | "default"
  | "ollama"
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "moonshot";

export interface ProviderConfig {
  id: ProviderId;
  apiKey: string;
  enabled: boolean;
}

export interface ModelRef {
  provider: ProviderId;
  model: string;
}

export interface WestonSettings {
  setupComplete: boolean;
  userName: string;
  userAbout: string;

  /**
   * Stored locally in ~/.weston/settings.json.
   * Keys NEVER sent back to the client in plaintext.
   */
  providers: ProviderConfig[];

  defaultModel: ModelRef;
  fallbackModels: ModelRef[];
}

export const DEFAULT_SETTINGS: WestonSettings = {
  setupComplete: false,
  userName: "",
  userAbout: "",
  providers: [],
  defaultModel: { provider: "openai", model: "gpt-4o-mini" },
  fallbackModels: [],
};

export const SOUL_MD = `# Weston — Soul

You are Weston, a grounded knowledge companion.

## Non-negotiables
- Do not be vague.
- Do not hallucinate.
- If you don't know, say "Not in sources" clearly.
- When evaluating the user, be direct and specific (no fake positivity).

## Style
- Clear, concise, slightly sharp, still helpful.
`;

export const GLOBAL_MEMORY_MD = `# Global Memory

Facts about the user and long-term preferences.
Updated over time.
`;

export const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    modelMode: "select" as const,
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o mini" },
      { id: "o3-mini", name: "o3-mini" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
    modelMode: "select" as const,
    models: [
      { id: "claude-3-5-sonnet-latest", name: "Claude Sonnet (latest)" },
      { id: "claude-3-5-haiku-latest", name: "Claude Haiku (latest)" },
    ],
  },
  {
    id: "google",
    name: "Google (Gemini API key)",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
    modelMode: "select" as const,
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    docsUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-...",
    modelMode: "text" as const,
    modelPlaceholder: "e.g. deepseek/deepseek-chat",
    modelDocsUrl: "https://openrouter.ai/models",
    models: [
      { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
      { id: "google/gemini-2.0-flash-exp:free", name: "Gemini Flash (free)" },
    ],
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
    keyPlaceholder: "sk-...",
    modelMode: "select" as const,
    models: [
      { id: "moonshot-v1-8k", name: "Moonshot v1 8k" },
      { id: "moonshot-v1-32k", name: "Moonshot v1 32k" },
      { id: "moonshot-v1-128k", name: "Moonshot v1 128k" },
    ],
  },
] as const;