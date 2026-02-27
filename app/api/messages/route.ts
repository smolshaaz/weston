import { NextResponse } from "next/server";
import { getMessagesForChat } from "@/lib/messages";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json({ ok: false, error: "Missing chatId" }, { status: 400 });
    }

    const dbMessages = getMessagesForChat(chatId);

    // Convert to AI SDK UIMessage format (needs both content and parts depending on the SDK version)
    const initialMessages = dbMessages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }));

    return NextResponse.json({ ok: true, messages: initialMessages });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load messages" },
      { status: 500 }
    );
  }
}
