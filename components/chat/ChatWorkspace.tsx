"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Upload } from "lucide-react";

import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { ChatSources } from "./ChatSources";

export function ChatWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("chat");

  // If no chat param, redirect to a new chat session
  useEffect(() => {
    if (!chatId) {
      const newId = `chat-${Date.now()}`;
      router.replace(`/chat?chat=${newId}`);
    }
  }, [chatId, router]);

  if (!chatId) return null;

  return <ChatInner key={chatId} chatId={chatId} />;
}

const SESSION_MODEL_KEY = (id: string) => `session:${id}:model`;

function ChatInner({ chatId }: { chatId: string }) {
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    // initialise synchronously to avoid "Model" flash
    if (typeof window === "undefined") return "";
    const sessionSaved = localStorage.getItem(SESSION_MODEL_KEY(chatId));
    if (sessionSaved) return sessionSaved;
    // fall back to globally cached default (written by settings page / last change)
    return localStorage.getItem("weston:default-model") ?? "";
  });
  const [chatMode, setChatMode] = useState("normal");
  const [chatTitle, setChatTitle] = useState(chatId.startsWith("chat-") ? "New chat" : chatId);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentTitle, setParentTitle] = useState<string | null>(null);
  const [parentMessageId, setParentMessageId] = useState<string | null>(null);

  // Track which models have been rate-limited this session
  const [rateLimitedModels, setRateLimitedModels] = useState<Set<string>>(new Set());
  // Notice shown in the input when we auto-switch
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);
  // Ref so the onError callback always reads the latest values without stale closure
  const selectedModelRef = useRef("");
  const availableModelsRef = useRef<{provider: string; id: string; name: string}[]>([]);
  const rateLimitedRef = useRef<Set<string>>(new Set());

  // Restore or initialize the per-session model
  useEffect(() => {
    const sessionSaved = localStorage.getItem(SESSION_MODEL_KEY(chatId));
    if (sessionSaved) {
      setSelectedModel(sessionSaved);
      return;
    }
    // Check cached global default first (sync already done in useState, but persist for this session)
    const cached = localStorage.getItem("weston:default-model");
    if (cached) {
      setSelectedModel(cached);
      localStorage.setItem(SESSION_MODEL_KEY(chatId), cached);
      return;
    }
    // Last resort: fetch from server
    fetch("/api/settings")
      .then(async (r) => {
        if (!r.ok) throw new Error("Settings fetch failed");
        const text = await r.text();
        try { return JSON.parse(text); } catch { return {}; }
      })
      .then((data) => {
        if (data.defaultModel?.provider && data.defaultModel?.model) {
          const modelStr = `${data.defaultModel.provider}::${data.defaultModel.model}`;
          setSelectedModel(modelStr);
          localStorage.setItem(SESSION_MODEL_KEY(chatId), modelStr);
          localStorage.setItem("weston:default-model", modelStr);
        }
      })
      .catch(() => {});
  }, [chatId]);

  // Keep refs in sync so the onError callback can read latest values
  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { rateLimitedRef.current = rateLimitedModels; }, [rateLimitedModels]);

  // Persist model selection to localStorage whenever it changes
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem(SESSION_MODEL_KEY(chatId), model);
    // Keep global default cache in sync so new chats pick it up immediately
    localStorage.setItem("weston:default-model", model);
  };

  // Auto-pick next available non-rate-limited model
  const autoSelectFallback = (failedModel: string) => {
    const rl = new Set([...rateLimitedRef.current, failedModel]);

    // Find next non-rate-limited model
    let next = availableModelsRef.current.find(
      (m) => !rl.has(`${m.provider}::${m.id}`)
    );

    if (next) {
      // Normal case: still have untried models
      setRateLimitedModels(rl);
      rateLimitedRef.current = rl;
    } else {
      // All models exhausted — reset and cycle back from the beginning
      const reset = new Set<string>([failedModel]);
      setRateLimitedModels(reset);
      rateLimitedRef.current = reset;
      next = availableModelsRef.current.find(
        (m) => `${m.provider}::${m.id}` !== failedModel
      ) ?? availableModelsRef.current[0];
    }

    if (next) {
      const key = `${next.provider}::${next.id}`;
      handleModelChange(key);
      setSwitchNotice(`Switched to ${next.name} — previous model hit its rate limit`);
      setTimeout(() => setSwitchNotice(null), 6000);
    }
  };

  // Vercel AI SDK Chat Hook — id isolates messages per chat session
  const chatHelper = useChat({
    id: chatId,
    onError: (err: Error) => {
      const msg = err.message?.toLowerCase() ?? "";
      const isRateLimit =
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("too many requests") ||
        msg.includes("ratelimit") ||
        msg.includes("rate-limited");
      if (isRateLimit) {
        autoSelectFallback(selectedModelRef.current);
      }
    },
  }) as any;
  const { messages, sendMessage, setMessages, error, reload: originalReload, regenerate } = chatHelper;
  const reload = originalReload || regenerate;

  console.log("USECHAT KEYS:", Object.keys(chatHelper));

  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messageBranches, setMessageBranches] = useState<Record<string, {id: string; title: string}[]>>({});

  const fetchBranches = () => {
    fetch(`/api/chat/${chatId}/branches`)
      .then(r => r.json())
      .then(d => { if (d.ok) setMessageBranches(d.branches); })
      .catch(() => {});
  };

  // Fetch initial messages from the database
  useEffect(() => {
    setLoadingMessages(true);
    fetch(`/api/messages?chatId=${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.messages && d.messages.length > 0) {
          setMessages(d.messages);
        }
        setLoadingMessages(false);
      })
      .catch(() => setLoadingMessages(false));
  }, [chatId, setMessages]);

  // Fetch branches map for the navigator
  useEffect(() => { fetchBranches(); }, [chatId]);

  // Fetch session title + parent info
  useEffect(() => {
    fetch(`/api/sessions/${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.session?.title) {
          setChatTitle(d.session.title);
        }
        if (d.ok) {
          setParentId(d.session?.parentId ?? null);
          setParentTitle(d.session?.parentTitle ?? null);
          setParentMessageId(d.session?.parentMessageId ?? null);
        }
      })
      .catch(() => {});
  }, [chatId]);

  // Sync title instantly when renamed from the sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, title } = (e as CustomEvent).detail;
      if (id === chatId) setChatTitle(title);
    };
    window.addEventListener("sessionRenamed", handler);
    return () => window.removeEventListener("sessionRenamed", handler);
  }, [chatId]);

  const [availableModels, setAvailableModels] = useState<{provider: string, id: string, name: string}[]>([]);

  const fetchAvailableModels = () => {
    fetch("/api/models")
      .then(async (res) => {
        if (!res.ok) throw new Error("Models fetch failed");
        const text = await res.text();
        try { return JSON.parse(text); } catch { return {}; }
      })
      .then((data) => {
        if (data.models && Array.isArray(data.models)) {
          const savedOrder: string[] = (() => {
            try { return JSON.parse(localStorage.getItem("weston:model-order") || "[]"); } catch { return []; }
          })();
          let models = data.models;
          if (savedOrder.length > 0) {
            const keyOf = (m: any) => `${m.provider}::${m.id}`;
            const map = new Map(data.models.map((m: any) => [keyOf(m), m]));
            const ordered: any[] = [];
            for (const key of savedOrder) { if (map.has(key)) { ordered.push(map.get(key)); map.delete(key); } }
            for (const m of map.values()) ordered.push(m);
            models = ordered;
          }
          setAvailableModels(models);
          availableModelsRef.current = models;
        }
      })
      .catch(() => {});
  };

  // Fetch available AI models on mount
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  // Manual Input State Management
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting) return;

    const currentInput = input;
    setIsSubmitting(true);
    setInput("");
    
    // Explicitly ensure the session exists right away so it appears in the sidebar quickly
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: chatId, title: "New chat" }),
    })
    .catch(() => {})
    .finally(() => {
      window.dispatchEvent(new Event("refreshSessions"));
    });

    // Auto-generate title if this is the very first message
    if (messages.length === 0) {
      fetch(`/api/chat/${chatId}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentInput })
      })
      .then(async res => {
        if (!res.ok) throw new Error("Title fetch failed");
        const text = await res.text();
        try { return JSON.parse(text); } catch { return {}; }
      })
      .then(data => {
        if (data.ok && data.title) {
          setChatTitle(data.title);
          window.dispatchEvent(new Event("refreshSessions"));
        }
      })
      .catch(() => {});
    }
    
    try {
      await sendMessage({ role: "user", content: currentInput }, { body: { chatId, model: selectedModel, chatMode } });
    } catch (err) {
      // Append errors are caught by UI state
      setInput(currentInput);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const scrollToBottom = () => {
    // We will handle scrolling in ChatMessages internally
  };

  // Re-generate the last AI reply, optionally switching models
  const handleReload = async (modelOverride?: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const targetModel = modelOverride || selectedModel;
    
    // If a new model was picked just for this retry, persist it as the session active model
    if (modelOverride && modelOverride !== selectedModel) {
      setSelectedModel(modelOverride);
      localStorage.setItem(SESSION_MODEL_KEY(chatId), modelOverride);
    }

    try {
      await reload({ body: { chatId, model: targetModel, chatMode } });
    } catch (err) {
      // Reload errors are caught by UI state
    } finally {
      setIsSubmitting(false);
    }
  };

  // Global Drag and Drop
  const [globalUploading, setGlobalUploading] = useState(false);
  const [lastUploadedName, setLastUploadedName] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setGlobalUploading(true);
    setLastUploadedName(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("chatId", chatId);

    try {
      const res = await fetch("/api/sources/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      
      setLastUploadedName(file.name);
      setTimeout(() => setLastUploadedName(null), 3000);
      window.dispatchEvent(new CustomEvent("refreshSources"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setGlobalUploading(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden relative">


      <Tabs defaultValue="chat" className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <ChatHeader title={chatTitle} />

      {/* CHAT TAB */}
      <TabsContent value="chat" className="mt-0 flex min-h-0 flex-1 flex-col p-0 data-[state=inactive]:hidden">
        <ChatMessages
          messages={messages}
          loadingMessages={loadingMessages}
          isSubmitting={isSubmitting}
          error={error}
          chatId={chatId}
          reload={handleReload}
          parentId={parentId}
          parentTitle={parentTitle}
          parentMessageId={parentMessageId}
          messageBranches={messageBranches}
          onBranchCreated={fetchBranches}
          availableModels={availableModels}
        />
        <ChatInput
          chatId={chatId}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          selectedModel={selectedModel}
          setSelectedModel={handleModelChange}
          availableModels={availableModels}
          onModelsChange={fetchAvailableModels}
          chatMode={chatMode}
          setChatMode={setChatMode}
          globalUploading={globalUploading}
          globalLastUploadedName={lastUploadedName}
          onFileUpload={uploadFile}
          rateLimitedModels={rateLimitedModels}
          switchNotice={switchNotice}
          onDismissSwitchNotice={() => setSwitchNotice(null)}
        />
      </TabsContent>

      {/* SOURCES TAB */}
      <TabsContent value="sources" className="mt-0 flex-1 overflow-y-auto p-6 data-[state=inactive]:hidden">
        <ChatSources chatId={chatId} />
      </TabsContent>
    </Tabs>
    </div>
  );
}