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
  const [selectedModel, setSelectedModel] = useState("");
  const [chatMode, setChatMode] = useState("oracle");
  const [chatTitle, setChatTitle] = useState(chatId.startsWith("chat-") ? "New chat" : chatId);
  
  // Restore or initialize the per-session model
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_MODEL_KEY(chatId));
    if (saved) {
      setSelectedModel(saved);
    } else {
      // New chat: fetch settings default and persist it for this session
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          if (data.defaultModel?.provider && data.defaultModel?.model) {
            const modelStr = `${data.defaultModel.provider}::${data.defaultModel.model}`;
            setSelectedModel(modelStr);
            localStorage.setItem(SESSION_MODEL_KEY(chatId), modelStr);
          }
        })
        .catch(console.error);
    }
  }, [chatId]);

  // Persist model selection to localStorage whenever it changes (only after initialized)
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem(SESSION_MODEL_KEY(chatId), model);
  };

  // Vercel AI SDK Chat Hook — id isolates messages per chat session
  const chatHelper = useChat({
    id: chatId,
    onError: (err: Error) => {
      console.error(`Chat Error: ${err.message || "Failed to get a response"}`);
    }
  }) as any;
  const { messages, sendMessage, setMessages, error, reload } = chatHelper;

  console.log("USECHAT KEYS:", Object.keys(chatHelper));

  const [loadingMessages, setLoadingMessages] = useState(true);

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

  // Fetch session title
  useEffect(() => {
    fetch(`/api/sessions/${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.session?.title) {
          setChatTitle(d.session.title);
        }
      })
      .catch(() => {});
  }, [chatId]);

  const [availableModels, setAvailableModels] = useState<{provider: string, id: string, name: string}[]>([]);

  const fetchAvailableModels = () => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.models && Array.isArray(data.models)) {
          setAvailableModels(data.models);
        }
      })
      .catch(console.error);
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
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.title) {
          setChatTitle(data.title);
          window.dispatchEvent(new Event("refreshSessions"));
        }
      })
      .catch(console.error);
    }
    
    try {
      await sendMessage({ role: "user", content: currentInput }, { body: { chatId, model: selectedModel, chatMode } });
    } catch (err) {
      console.error("Append error:", err);
      setInput(currentInput);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const scrollToBottom = () => {
    // We will handle scrolling in ChatMessages internally
  };

  // Global Drag and Drop
  const [dragActive, setDragActive] = useState(false);
  const [globalUploading, setGlobalUploading] = useState(false);
  const [lastUploadedName, setLastUploadedName] = useState<string | null>(null);
  const dragCounter = useRef(0);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    
    // Reset if drag leaves the browser window or the counter reaches 0
    if (dragCounter.current <= 0 || !e.relatedTarget) {
      setDragActive(false);
      dragCounter.current = 0;
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounter.current = 0;

    if (globalUploading || !e.dataTransfer.files || !e.dataTransfer.files[0]) return;
    await uploadFile(e.dataTransfer.files[0]);
  }

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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setGlobalUploading(false);
    }
  }

  return (
    <div 
      className="flex h-full min-w-0 flex-1 flex-col overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="absolute inset-4 z-50 flex items-center justify-center rounded-3xl bg-background/80 backdrop-blur-md border-[3px] border-dashed border-primary shadow-2xl">
          <div className="flex flex-col items-center gap-4 text-primary pointer-events-none p-12 bg-background/50 rounded-2xl">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mb-2">
              <Upload className="h-10 w-10 animate-bounce" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-foreground">Drop file to upload to Weston</span>
            <span className="text-muted-foreground font-medium text-sm">Supports PDF, TXT, and MD files</span>
          </div>
        </div>
      )}

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
          reload={reload || (() => window.location.reload())}
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