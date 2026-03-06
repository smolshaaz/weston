# Weston

A private, local AI companion that runs entirely on your machine. Upload documents, chat with any AI model, and build long-term memory — all without sending your data to a third-party server.

## What Is Weston?

Weston is a **local-first RAG (Retrieval-Augmented Generation) chat application**. You bring your own API keys, upload your own documents, and everything stays on your hard drive.

**Core features:**
- 📄 **Document Q&A** — Upload PDFs, text, and markdown files. Weston chunks, embeds, and retrieves from them so the AI answers grounded in your actual documents.
- 🧠 **Long-Term Memory** — Weston automatically remembers your preferences, identity, and conversation context across sessions.
- 🔀 **Multi-Model** — Switch between OpenAI, Anthropic, Google Gemini, OpenRouter (thousands of models), and Moonshot mid-conversation.
- 🔒 **100% Local** — Your chats, documents, and API keys never leave your computer. Everything is stored in `~/.weston/`.
- 🎯 **3 Chat Modes** — Normal (general Q&A), Exam (strict source-only study mode), and Learn (Socratic tutoring mode).

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or newer
- An API key from at least one AI provider (see [Getting API Keys](#getting-api-keys) below)

### Install

```bash
npm install -g weston-ai
```

That's it. The app will automatically build during installation. Once it finishes:

```bash
weston flow
```

### Install from Source (for developers)

```bash
git clone https://github.com/smolshaaz/weston.git
cd weston
npm install
npm run build
npm link
```

### Running Weston

Once installed, you can start Weston from **anywhere** in your terminal:

```bash
weston flow
```

This will:
1. Start the server in the background
2. Open your browser to the app
3. Free up your terminal immediately

When you're done:

```bash
weston stop
```

### All CLI Commands

| Command | Description |
|---|---|
| `weston flow` | Start the server in the background and open the browser |
| `weston stop` | Stop the background server |
| `weston status` | Check if the server is currently running |
| `weston logs` | View live server logs (press `Ctrl+C` to exit) |
| `weston wipe` | Delete all chats, sources, and memory (keeps API keys) |

---

## Getting API Keys

You need at least **one** API key to use Weston. Go to **Settings → API Providers** in the app to enter your key.

### OpenAI
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-...`)
4. Paste it into Weston's Settings under **OpenAI**

### Anthropic (Claude)
1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Click **"Create Key"**
3. Copy the key (starts with `sk-ant-...`)
4. Paste it into Weston's Settings under **Anthropic**

### Google (Gemini)
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **"Create API key"**
3. Copy the key (starts with `AIza...`)
4. Paste it into Weston's Settings under **Google**

> **💡 Tip:** Google offers a generous free tier for Gemini models. This is the easiest way to get started without spending money.

### OpenRouter
1. Go to [openrouter.ai/keys](https://openrouter.ai/keys)
2. Create an account and generate an API key (starts with `sk-or-...`)
3. Paste it into Weston's Settings under **OpenRouter**

> **💡 Tip:** OpenRouter gives you access to **thousands of models** from all providers through a single API key, including many free models.

### Moonshot (Kimi)
1. Go to [platform.moonshot.cn/console/api-keys](https://platform.moonshot.cn/console/api-keys)
2. Create an API key
3. Paste it into Weston's Settings under **Moonshot (Kimi)**

---

## Adding & Managing Models

After connecting a provider, go to **Settings → Manage Models** to add the models you want to use.

### Suggested Models (Quick Add)

Weston shows suggested models for each provider that you can add with one click. Here are some popular ones:

| Provider | Model ID | Display Name |
|---|---|---|
| OpenAI | `gpt-5.4` | GPT-5.4 |
| OpenAI | `gpt-5-mini` | GPT-5 mini |
| OpenAI | `gpt-4.1` | GPT-4.1 |
| OpenAI | `o4-mini` | o4-mini |
| Anthropic | `claude-sonnet-4-6` | Claude Sonnet 4.6 |
| Anthropic | `claude-opus-4-6` | Claude Opus 4.6 |
| Anthropic | `claude-haiku-4-5` | Claude Haiku 4.5 |
| Google | `gemini-3.1-pro` | Gemini 3.1 Pro |
| Google | `gemini-3-flash` | Gemini 3 Flash |
| Google | `gemini-2.5-flash` | Gemini 2.5 Flash |
| Google | `gemini-2.5-pro` | Gemini 2.5 Pro |

### Manually Adding a Model

You can type in **any model ID** that your provider supports, even if it's not in the suggested list.

**How to find the correct model ID:**

The model ID is the **exact technical string** the API expects — not the marketing name. For example:

| You want to use... | Type this exact model ID |
|---|---|
| Gemini 3.1 Pro | `gemini-3.1-pro` |
| Gemini 2.5 Flash | `gemini-2.5-flash` |
| GPT-5.4 | `gpt-5.4` |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| DeepSeek Chat (via OpenRouter) | `deepseek/deepseek-chat` |

**Where to find model IDs:**

| Provider | Model list URL |
|---|---|
| OpenAI | [platform.openai.com/docs/models](https://platform.openai.com/docs/models) |
| Anthropic | [docs.anthropic.com/en/docs/about-claude/models](https://docs.anthropic.com/en/docs/about-claude/models) |
| Google | [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) |
| OpenRouter | [openrouter.ai/models](https://openrouter.ai/models) |

> **⚠️ Important:** Google frequently rotates experimental models (those with `-exp-` in the name). If you get a 404 error, your model may have been retired. Check the link above for current model IDs.

---

## Chat Modes

Switch modes using the dropdown in the chat input bar.

| Mode | Purpose | Uses Outside Knowledge? |
|---|---|---|
| **Normal** | General document Q&A with fallback to general knowledge | Yes (clearly labeled) |
| **Exam** | Strict source-only answers optimized for studying and revision | No |
| **Learn** | Socratic tutoring — asks what you think before explaining | No |

---

## How It Works

1. **Upload** — Drop a PDF, text, or markdown file into the chat or the Sources panel.
2. **Chunk & Embed** — Weston splits the document into small chunks and creates vector embeddings using your provider's embedding model.
3. **Retrieve** — When you ask a question, Weston runs a hybrid search (semantic + keyword) to find the most relevant chunks, then expands each hit with its neighboring chunks for better context.
4. **Generate** — The retrieved chunks are injected into the AI's system prompt along with your question, producing a grounded, cited answer.

All data is stored locally in `~/.weston/`:
- `weston.db` — SQLite database with all chats, messages, sources, chunks, and vector embeddings
- `settings.json` — Your API keys and preferences
- `soul.md`— Weston's personality configuration
- `memory/` — Long-term conversation memory
- `chats/` — Per-chat memory files

---

## Development

If you want to modify Weston's code:

```bash
# Run in development mode (hot-reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** SQLite (better-sqlite3) with sqlite-vec for vector search
- **Styling:** Tailwind CSS v4
- **UI Components:** Radix UI (shadcn/ui)


