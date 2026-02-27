import { streamText, UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { readSettings } from "@/lib/fs";
import { SOUL_MD, type ProviderId } from "@/lib/constants";
import { retrieveContext } from "@/lib/retrieve";
import { ensureSession, touchSession } from "@/lib/sessions";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow longer responses

// Convert standard AI SDK messages to string format for context
function getMessagesText(messages: UIMessage[]): string {
  return messages.map((m) => {
    // @ts-ignore
    const textChunk = m.parts?.filter((p) => p.type === 'text').map((p) => p.text).join('\n') || m.content || "";
    return `${m.role.toUpperCase()}: ${textChunk}`;
  }).join("\n\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages;
    
    console.log("RECEIVED MESSAGES:", JSON.stringify(messages, null, 2));

    const requestedModel = body.model;
    const chatId = body.chatId || body.id || "chat-1";

    // Auto-create chat session if it doesn't exist, and update its timestamp
    ensureSession(chatId);
    touchSession(chatId);

    if (!messages || messages.length === 0) {
      return new Response("Missing messages", { status: 400 });
    }

    const latestMessage = messages[messages.length - 1];

    if (latestMessage.role !== "user") {
      return new Response("Last message must be from user", { status: 400 });
    }

    // @ts-ignore
    const query = latestMessage.parts?.filter((p) => p.type === 'text').map((p) => p.text).join('\n') || latestMessage.content || "";

    // 1. Retrieve Context from Vector DB
    const retrievedChunks = await retrieveContext(chatId, query);

    const chatMode = body.chatMode || "oracle";

    let modeInstructions = `
=========================================
CRITICAL INSTRUCTIONS FOR RAG (ORACLE MODE):
=========================================
1. Answer the user's query **STRICTLY AND EXCLUSIVELY** based on the retrieved sources above. Under no circumstances should you use your own internal knowledge.
2. If the answer cannot be found completely in the sources, do not guess or hallucinate. State clearly: "Not in sources."
3. Cite your sources accurately. Put the citation at the end of the sentence/claim using the exact source name, like this: [filename.ext].
4. Synthesize context from multiple chunks cohesively if needed, but ONLY using the provided text.
`;

    if (chatMode === "exam") {
      modeInstructions = `
=========================================
CRITICAL INSTRUCTIONS FOR RAG (EXAM MODE):
=========================================
1. Answer **STRICTLY AND EXCLUSIVELY** based on the retrieved sources provided above. Do not use outside knowledge.
2. Deliver comprehensive but aggressively summarized answers based on the retrieved sources. Do NOT "half-ass" the explanation; ensure the core concept is fully covered, but optimized for rapid studying (use bullet points and bold key terms).
3. If the information is not in the sources, state: "Not in sources."
4. Provide practical "bottom lines" that are ready for exam review.
5. Anticipate twisted or trick variations of the topic that might appear on an exam and briefly warn the user about them, based ONLY on the source texts.
6. Provide the answer directly; do not ask the user questions.
`;
    } else if (chatMode === "learn") {
      modeInstructions = `
=========================================
CRITICAL INSTRUCTIONS FOR RAG (LEARN MODE):
=========================================
1. **STRICTLY** base your explanations and evaluations ONLY on the retrieved sources above. Do not use outside knowledge.
2. DO NOT simply give the user the answer right away.
3. Before fully explaining a concept from the sources, ask the user to explain what they *think* it means first. (e.g., "Before we dive in, how would you define X in your own words?")
4. Once they answer, evaluate their mental model. Build upon their correct ideas and gently correct flaws using First Principles strictly from the text.
5. Keep the conversation strictly tethered to the retrieved sources. Do not let the user drag the conversation down unrelated rabbit holes. If they stray, say it's outside the scope of the documents.
6. Drop in one related "curiosity" question at the end to ensure they cover the full scope of the topic.
`;
    }

    // 2. Format Retrieved Context into Prompt
    let contextPrompt = "";
    if (retrievedChunks.length > 0) {
      contextPrompt = "\n<RETRIEVED_SOURCES>\n";
      retrievedChunks.forEach((chunk, i) => {
        contextPrompt += `<source name="${chunk.sourceName}">\n`;
        contextPrompt += `${chunk.text}\n`;
        contextPrompt += `</source>\n\n`;
      });
      contextPrompt += "</RETRIEVED_SOURCES>\n\n";
      
      contextPrompt += modeInstructions;
    } else {
      contextPrompt = "\n<RETRIEVED_SOURCES>\nNo sources available or active for this chat.\n</RETRIEVED_SOURCES>\n\nCRITICAL INSTRUCTION: You have no active sources to pull from. You must inform the user that no sources are attached, and you cannot answer specific queries without them. You can casually converse, but refuse to answer factual questions relying on your own knowledge.";
    }

    // 3. Build Full System Prompt
    const soulContent = await import("@/lib/fs").then(m => m.readSoulMd());
    const identityContent = await import("@/lib/fs").then(m => m.readIdentityMd());
    const globalMemoryContent = await import("@/lib/fs").then(m => m.readGlobalMemoryMd());
    const chatMemoryContent = await import("@/lib/fs").then(m => m.readChatMemoryMd(chatId));

    const systemPrompt = `
<SOUL>
${soulContent}
</SOUL>

<USER_IDENTITY>
${identityContent}
</USER_IDENTITY>

<GLOBAL_MEMORY>
${globalMemoryContent}
</GLOBAL_MEMORY>

<CHAT_SPECIFIC_MEMORY>
${chatMemoryContent}
</CHAT_SPECIFIC_MEMORY>

${contextPrompt}
`.trim();

    // 4. Initialize Provider Model
    const settings = readSettings();
    let modelRef = settings.defaultModel;

    if (requestedModel && requestedModel !== "default") {
      // requestedModel comes in as "provider::modelId"
      const [prov, ...rest] = requestedModel.split("::");
      if (prov && rest.length > 0) {
        modelRef = { provider: prov as ProviderId, model: rest.join("::") };
      }
    }

    let model;

    // Check if the provider requires an API key
    const isLocalProvider = modelRef.provider === "ollama" || modelRef.provider === "default";
    const activeProvider = settings.providers.find((p) => p.id === modelRef.provider);

    if (!isLocalProvider && !activeProvider?.apiKey) {
      return new Response(`No API key found for provider: ${modelRef.provider}`, { status: 400 });
    }

    const apiKey = activeProvider?.apiKey || "";

    switch (modelRef.provider) {
      case "openai":
        model = createOpenAI({ apiKey })(modelRef.model);
        break;
      case "anthropic":
        model = createAnthropic({ apiKey })(modelRef.model);
        break;
      case "google":
        model = createGoogleGenerativeAI({ apiKey })(modelRef.model);
        break;
      case "openrouter":
        const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
        model = createOpenRouter({
          apiKey,
        })(modelRef.model);
        break;
      case "moonshot":
        model = createOpenAI({
          apiKey,
          baseURL: "https://api.moonshot.cn/v1",
          compatibility: "compatible",
        } as any)(modelRef.model);
        break;
      default:
        throw new Error(`Unsupported model provider: ${modelRef.provider}`);
    }

    // 5. Stream Response
    // Convert UI messages to core messages by mapping 'parts' to 'content'
    const coreMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.parts
        ?.filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("\n") || m.content || "",
    }));

    // Generate a unique ID for the user's message if it doesn't have a reliable one
    const userMsgId = latestMessage.id || `msg-user-${Date.now()}`;
    
    // Save the user's message to the DB
    try {
      const { insertMessage } = await import("@/lib/messages");
      insertMessage({
        id: userMsgId,
        chatId,
        role: "user",
        content: query,
        citations: null,
      });
    } catch (e) {
      console.error("Failed to save user message", e);
    }

    const { insertMessage, updateMessageContent } = await import("@/lib/messages");

    // Pre-insert the AI message so that any citation badges rendered immediately
    // by the stream can fetch their evidence text from the database.
    const assistantMsgId = `msg-ai-${Date.now()}`;
    try {
      insertMessage({
        id: assistantMsgId,
        chatId,
        role: "assistant",
        content: "", // Will be updated onFinish
        citations: retrievedChunks.length > 0 ? retrievedChunks : null,
      });
    } catch (e) {
      console.error("Failed to pre-insert AI message for citations", e);
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages: coreMessages,
      temperature: 0.3, // Lower temp for factual RAG tasks
      maxOutputTokens: 4096,  // Ensure long, detailed answers aren't cut off
      onFinish: async ({ text }) => {
        // Update the AI's response text securely once the stream completes
        try {
          updateMessageContent(assistantMsgId, text);
        } catch (e) {
          console.error("Failed to update AI message content", e);
        }

        // Trigger memory compression in the background
        import("@/lib/memory").then(({ summarizeChat, extractUserFacts }) => {
          summarizeChat(chatId).catch(console.error);
          extractUserFacts(chatId).catch(console.error);
        });
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Chat error:", error);
    try { require('fs').appendFileSync('debug-errors.log', '\n--- ERROR ---\n' + (error?.stack || error) + '\n' + JSON.stringify(error, null, 2)); } catch(e){}
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
