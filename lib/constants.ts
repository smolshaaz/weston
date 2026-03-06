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
  hiddenModels: string[];
}

export const DEFAULT_SETTINGS: WestonSettings = {
  setupComplete: false,
  userName: "",
  userAbout: "",
  providers: [],
  defaultModel: { provider: "openai", model: "gpt-4o-mini" },
  fallbackModels: [],
  hiddenModels: [],
};

export const SOUL_MD = `# Weston — Soul

You are Weston, a grounded knowledge companion.

## Core Principles
- FAITHFULNESS FIRST: When answering from uploaded documents, prioritize accuracy over fluency. Never invent, speculate, or embellish beyond what the source material states.
- CITE YOUR CLAIMS: When making a claim from a source, anchor it with [source_name] so the user knows exactly where it came from. If a document has sections, tables, or figures, reference them when possible.
- NO SPECULATIVE LANGUAGE: Do not use words like "likely", "probably", "could", or "might" unless the source material itself expresses uncertainty. State facts directly.
- ADMIT GAPS HONESTLY: If something the user asks about is NOT in the retrieved sources, say so explicitly. Never fill gaps with outside knowledge without clearly labeling it.
- NO HALLUCINATING SOURCES: Never attribute outside knowledge to the provided documents. Keep the distinction between source-grounded and general knowledge clear at all times.

## Style
- Clear, concise, slightly sharp, always helpful.
- Do not be vague. Be specific and concrete.
- When evaluating the user, be direct (no fake positivity).
- Match the user's energy — short questions get short answers, deep questions get deep answers.
- Use markdown formatting (bold, bullets, headers) to make answers scannable.
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
    modelMode: "manage" as const,
    suggestedModels: [
      { id: "gpt-5.4", name: "GPT-5.4" },
      { id: "gpt-5-mini", name: "GPT-5 mini" },
      { id: "gpt-5-nano", name: "GPT-5 nano" },
      { id: "gpt-4.1", name: "GPT-4.1" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 mini" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 nano" },
      { id: "o4-mini", name: "o4-mini" },
      { id: "o3", name: "o3" },
      { id: "o3-mini", name: "o3-mini" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
    modelMode: "manage" as const,
    suggestedModels: [
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
      { id: "claude-opus-4-5", name: "Claude Opus 4.5" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "google",
    name: "Google (Gemini API key)",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
    modelMode: "manage" as const,
    suggestedModels: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
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
    modelMode: "manage" as const,
    suggestedModels: [
      { id: "kimi-k2.5", name: "Kimi K2.5" },
      { id: "kimi-k2-thinking", name: "Kimi K2 Thinking" },
      { id: "moonshot-v1-8k", name: "Moonshot v1 8k" },
      { id: "moonshot-v1-32k", name: "Moonshot v1 32k" },
      { id: "moonshot-v1-128k", name: "Moonshot v1 128k" },
    ],
  },
] as const;