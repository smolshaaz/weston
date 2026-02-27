import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SETTINGS,
  GLOBAL_MEMORY_MD,
  SOUL_MD,
  WESTON_DIR,
  type WestonSettings,
} from "./constants";

const SETTINGS_PATH = path.join(WESTON_DIR, "settings.json");
const SOUL_PATH = path.join(WESTON_DIR, "soul.md");
const IDENTITY_PATH = path.join(WESTON_DIR, "identity.md");

const MEMORY_DIR = path.join(WESTON_DIR, "memory");
const GLOBAL_MEMORY_PATH = path.join(MEMORY_DIR, "global.md");

const CHATS_DIR = path.join(WESTON_DIR, "chats");

function atomicWriteJson(filePath: string, data: unknown) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

export function initWestonDir() {
  const dirs = [WESTON_DIR, MEMORY_DIR, CHATS_DIR];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(SOUL_PATH)) {
    fs.writeFileSync(SOUL_PATH, SOUL_MD, "utf-8");
  }

  if (!fs.existsSync(IDENTITY_PATH)) {
    fs.writeFileSync(
      IDENTITY_PATH,
      "# User Identity\n\nNot set up yet.\n",
      "utf-8"
    );
  }

  if (!fs.existsSync(GLOBAL_MEMORY_PATH)) {
    fs.writeFileSync(GLOBAL_MEMORY_PATH, GLOBAL_MEMORY_MD, "utf-8");
  }

  if (!fs.existsSync(SETTINGS_PATH)) {
    atomicWriteJson(SETTINGS_PATH, DEFAULT_SETTINGS);
  }
}

export function readSettings(): WestonSettings {
  initWestonDir();

  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<WestonSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: WestonSettings) {
  initWestonDir();
  atomicWriteJson(SETTINGS_PATH, settings);
}

export function writeIdentityMd(content: string) {
  initWestonDir();
  fs.writeFileSync(IDENTITY_PATH, content, "utf-8");
}

export function readSoulMd() {
  initWestonDir();
  return fs.readFileSync(SOUL_PATH, "utf-8");
}

export function writeSoulMd(content: string) {
  initWestonDir();
  fs.writeFileSync(SOUL_PATH, content, "utf-8");
}

export function readIdentityMd() {
  initWestonDir();
  return fs.readFileSync(IDENTITY_PATH, "utf-8");
}

export function readGlobalMemoryMd() {
  initWestonDir();
  return fs.readFileSync(GLOBAL_MEMORY_PATH, "utf-8");
}

export function readChatMemoryMd(chatId: string): string {
  initWestonDir();
  const chatDir = path.join(CHATS_DIR, chatId);
  if (!fs.existsSync(chatDir)) return "";

  const files = fs.readdirSync(chatDir).filter(f => f.endsWith(".md"));
  let content = "";
  for (const file of files) {
    const fileContent = fs.readFileSync(path.join(chatDir, file), "utf-8");
    content += `\n## CHAT MEMORY [${file}]\n${fileContent}\n`;
  }
  return content;
}

export function writeChatMemoryMd(chatId: string, filename: string, content: string) {
  initWestonDir();
  const chatDir = path.join(CHATS_DIR, chatId);
  if (!fs.existsSync(chatDir)) {
    fs.mkdirSync(chatDir, { recursive: true });
  }
  fs.writeFileSync(path.join(chatDir, filename), content, "utf-8");
}
