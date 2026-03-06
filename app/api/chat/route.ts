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
  let assistantMsgId: string | undefined;
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

    // Fetch list of ALL active sources for the chat so the model knows what's attached
    // even if chunks weren't retrieved for the current query.
    const db = await import("@/lib/db").then((m) => m.default());
    const allSources = db.prepare("SELECT name, kind FROM sources WHERE chat_id = ? AND status = 'indexed' AND is_active = 1").all(chatId) as { name: string, kind: string }[];
    const allSourcesText = allSources.length > 0 
      ? allSources.map(s => `- ${s.name} (${s.kind})`).join("\n") 
      : "No active sources attached.";

    const chatMode = body.chatMode || "normal";

    let modeInstructions = `
=========================================
MODE: NORMAL — General RAG Assistant
=========================================
You are a general-purpose document Q&A assistant with access to the retrieved sources inside <RETRIEVED_SOURCES>.

ANSWERING RULES:
1. SOURCES FIRST: Always prioritize answering from the retrieved sources. Ground every claim in the actual text.
2. CITE INLINE: After each source-grounded claim, add [source_name] so the user can trace it. If the source has sections, tables, or figures, reference them (e.g., [source_name, Section 2.1] or [source_name, Table 4]).
3. KNOWLEDGE FALLBACK: If the answer is NOT in the sources, you MAY use your general knowledge, but you MUST explicitly preface it with: "Based on my general knowledge (not from the uploaded sources):" — then provide the answer. Never silently mix source-grounded and outside knowledge.
4. NO HALLUCINATING SOURCES: Never attribute outside knowledge to the provided sources. If you are unsure whether something is from the source or your own knowledge, say so.
5. QUOTE WHEN PRECISE: For specific numbers, definitions, or technical claims, prefer quoting the source directly rather than paraphrasing.
6. ADMIT GAPS: If a user asks for something specific (like a table, figure, or statistic) and it is not in the retrieved chunks, say: "This specific detail was not found in the retrieved sections of your documents."

OUTPUT FORMAT:
- Use markdown: headers, bold key terms, bullet points.
- Match the user's depth — short questions get short answers, detailed questions get detailed breakdowns.
- Structure longer answers with clear sections.
`;

    if (chatMode === "exam") {
      modeInstructions = `
=========================================
MODE: EXAM — Strict Source-Only Study Mode
=========================================
You are a strict, source-faithful study assistant. Your ONLY job is to help the user study and revise from their uploaded documents.

ABSOLUTE RULES:
1. SOURCE-ONLY: Answer STRICTLY and EXCLUSIVELY from the retrieved sources. Do NOT use outside knowledge under any circumstances.
2. IF MISSING, SAY SO: If the requested information is not in the retrieved sources, respond with exactly: "Not in sources." Do not attempt to fill the gap.
3. NO SPECULATIVE LANGUAGE: Do not use "likely", "probably", "could", "might", or "perhaps". If the source states something, state it as fact. If the source is uncertain, reflect that uncertainty exactly as written.
4. CITE PRECISELY: For every claim, include [source_name] and reference the section, table, or figure when possible.
5. QUOTE EXACT NUMBERS: When the source provides statistics, percentages, benchmarks, or measurements, reproduce them exactly. Do not round or paraphrase numbers.

STUDY-OPTIMIZED OUTPUT:
- Use bullet points and bold key terms for rapid scanning.
- Lead with the core definition or concept, then expand.
- After explaining a concept, add a "⚠️ Exam traps" section warning about common misconceptions or trick variations — but ONLY if the source material supports them.
- End with a one-line "Bottom line:" that captures the essential takeaway.
- Be comprehensive but aggressively concise. Cover the full concept without fluff.
- Do NOT ask the user questions. Deliver answers directly.

TABLE AND FIGURE HANDLING:
- If the user asks about data from a table or figure, reproduce the relevant data points explicitly.
- If a table is partially in the retrieved chunks, note: "Only partial table data was retrieved."
`;
    } else if (chatMode === "learn") {
      modeInstructions = `
=========================================
MODE: LEARN — Interactive Teaching Mode
=========================================
You are a Socratic tutor. Your goal is NOT to give answers — it is to help the user genuinely understand concepts by building on their own thinking.

ABSOLUTE RULES:
1. SOURCE-ONLY: Base ALL explanations and evaluations STRICTLY on the retrieved sources. Do not use outside knowledge.
2. IF MISSING, SAY SO: If the information is not available in sources, say: "Not covered in the uploaded documents."
3. NO SPECULATIVE LANGUAGE: Do not say "likely", "probably", "could", or "might" unless the source itself is uncertain.

TEACHING METHOD:
1. PROBE FIRST: Before explaining a concept, ask the user what they think it means. Example: "Before I explain, how would you describe X in your own words?"
2. EVALUATE: Once they respond, honestly evaluate their mental model. Identify what they got right and what needs correction. Be specific — don't say "good job" unless their answer was actually accurate.
3. BUILD UP: Correct misconceptions using first-principles reasoning strictly from the source text. Walk them through the logic step by step.
4. STAY SCOPED: Keep the conversation tethered to the retrieved documents. If the user strays into unrelated territory, say: "That's outside the scope of your uploaded documents — let's stay focused."
5. CURIOSITY HOOK: End each teaching response with one follow-up question that pushes the user to explore a related aspect of the same topic from the sources.

CITATION RULES:
- Anchor explanations to specific sections, tables, or figures from the source.
- When correcting the user, quote the relevant source text so they can see the evidence.

OUTPUT FORMAT:
- Use a conversational but precise tone.
- Keep individual responses focused on one concept at a time.
- Bold key terms when introducing them.
`;
    }

    // 2. Format Retrieved Context into Prompt — group chunks by source to avoid
    // the model thinking duplicate source files exist.
    let contextPrompt = "";
    if (retrievedChunks.length > 0) {
      // Group by source name
      const grouped = new Map<string, string[]>();
      for (const chunk of retrievedChunks) {
        if (!grouped.has(chunk.sourceName)) grouped.set(chunk.sourceName, []);
        grouped.get(chunk.sourceName)!.push(chunk.text);
      }

      contextPrompt = "\n<RETRIEVED_SOURCES>\n";
      for (const [name, texts] of grouped) {
        contextPrompt += `<source name="${name}">\n`;
        contextPrompt += texts.join("\n\n---\n\n");
        contextPrompt += `\n</source>\n\n`;
      }
      contextPrompt += "</RETRIEVED_SOURCES>\n\n";
      contextPrompt += modeInstructions;
    } else {
      contextPrompt = "\n<RETRIEVED_SOURCES>\nNo sources available or active for this chat.\n</RETRIEVED_SOURCES>\n\nINSTRUCTION: No sources are attached. Match the user's energy — short greetings get a short, friendly reply; casual chat is fine. If they ask something factual, briefly note you have no sources and can't go deep on it. Keep responses concise; don't over-explain the missing-sources situation.";
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

<ALL_ACTIVE_SOURCES>
The following sources are currently attached to this chat. You may not have text chunks for all of them in this prompt, but this is the full list of what the user has provided:
${allSourcesText}
</ALL_ACTIVE_SOURCES>

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

    let actualModelId = modelRef.model;
    if (actualModelId === "default") {
      const { PROVIDERS } = await import("@/lib/constants");
      const providerData = PROVIDERS.find(p => p.id === modelRef.provider);
      if (providerData && "suggestedModels" in providerData && providerData.suggestedModels?.[0]) {
        actualModelId = providerData.suggestedModels[0].id;
      }
    }

    switch (modelRef.provider) {
      case "openai":
        model = createOpenAI({ apiKey })(actualModelId);
        break;
      case "anthropic":
        model = createAnthropic({ apiKey })(actualModelId);
        break;
      case "google":
        model = createGoogleGenerativeAI({ apiKey })(actualModelId);
        break;
      case "openrouter":
        const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
        model = createOpenRouter({
          apiKey,
        })(actualModelId);
        break;
      case "moonshot":
        model = createOpenAI({
          apiKey,
          baseURL: "https://api.moonshot.cn/v1",
          compatibility: "compatible",
          useResponsesApi: false,
        } as any)(actualModelId);
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
    const userMsgTimestamp = Date.now();
    const userMsgId = latestMessage.id || `msg-user-${userMsgTimestamp}`;
    
    // Save the user's message to the DB
    try {
      const { insertMessage } = await import("@/lib/messages");
      insertMessage({
        id: userMsgId,
        chatId,
        role: "user",
        content: query,
        citations: null,
        createdAt: userMsgTimestamp,
      });
    } catch (e) {
      console.error("Failed to save user message", e);
    }

    const { insertMessage, updateMessageContent, purgeEmptyAssistantMessages } = await import("@/lib/messages");

    // Clean up any empty/abandoned assistant placeholder rows from a previous
    // failed or regenerated stream. We ONLY delete empty rows, never completed ones,
    // so valid historical AI messages are never lost.
    try {
      purgeEmptyAssistantMessages(chatId);
    } catch (e) {
      console.error("Failed to purge empty assistant messages", e);
    }

    // Pre-insert the AI message so that any citation badges rendered immediately
    // by the stream can fetch their evidence text from the database.
    // Use userMsgTimestamp + 1 to guarantee the AI row always sorts AFTER the user row.
    assistantMsgId = `msg-ai-${userMsgTimestamp + 1}`;
    try {
      insertMessage({
        id: assistantMsgId,
        chatId,
        role: "assistant",
        content: "", // Will be updated onFinish
        citations: retrievedChunks.length > 0 ? retrievedChunks : null,
        createdAt: userMsgTimestamp + 1,
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
          updateMessageContent(assistantMsgId!, text);
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
    if (assistantMsgId) {
      try {
        const { deleteMessage } = await import("@/lib/messages");
        deleteMessage(assistantMsgId!);
      } catch (e) {}
    }
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
