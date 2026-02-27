"use client";

import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UIMessage } from "ai";
import { useState, useRef, useEffect } from "react";
import { ArrowDown, Check, Copy, RefreshCw, GitBranch, Loader2 } from "lucide-react";

interface ChatMessagesProps {
  messages: UIMessage[];
  loadingMessages: boolean;
  isSubmitting: boolean;
  error?: any;
  chatId: string;
  reload: () => void;
}

export function ChatMessages({ messages, loadingMessages, isSubmitting, error, chatId, reload }: ChatMessagesProps) {
  const router = useRouter();
  const [citationDialogOpen, setCitationDialogOpen] = useState(false);
  const [citationTitle, setCitationTitle] = useState("");
  const [citationSnippets, setCitationSnippets] = useState<any[]>([]);
  const [loadingCitations, setLoadingCitations] = useState(false);

  const handleCitationClick = async (sourceName: string) => {
    // Strip brackets if present
    const cleanName = sourceName.replace(/^\[|\]$/g, "").trim();
    if (!cleanName) return;

    setCitationTitle(cleanName);
    setCitationSnippets([]);
    setLoadingCitations(true);
    setCitationDialogOpen(true);

    try {
      const res = await fetch(`/api/chat/${chatId}/citations?sourceName=${encodeURIComponent(cleanName)}`);
      const data = await res.json();
      if (data.ok && data.snippets) {
        setCitationSnippets(data.snippets);
      }
    } catch (e) {
      console.error("Failed to load citations", e);
    } finally {
      setLoadingCitations(false);
    }
  };

  // Pre-process text to convert raw bracketed citations like [filename.txt]
  // into markdown links so our custom `a` component can intercept them.
  const transformCitations = (text: string) => {
    if (!text) return text;
    // Match [Any Text Here.ext] and wrap it securely
    return text.replace(/\[([^\]]+)\]/g, (match, p1) => {
      // Don't double-link if it's already a markdown link or image
      if (text.includes(`](${p1})`) || text.includes(`![${p1}`)) {
        return match;
      }
      return `[${match}](#citation)`;
    });
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [branchingId, setBranchingId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBranch = async (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setBranchingId(msgId);
    try {
      const res = await fetch(`/api/chat/${chatId}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMessageId: msgId })
      });
      const data = await res.json();
      if (data.ok && data.newChatId) {
        router.push(`/chat?chat=${data.newChatId}`);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Failed to branch chat:", err);
      // Could show a toast here if we had one
    } finally {
      setBranchingId(null);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Intersection Observer to detect when we're scrolled up
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show button if the invisible bottom div is NOT intersecting (out of view)
        setShowScrollButton(!entry.isIntersecting);
      },
      { root: null, rootMargin: "100px", threshold: 0 }
    );
    const node = messagesEndRef.current;
    if (node) observer.observe(node);

    return () => {
      if (node) observer.disconnect();
    };
  }, []);

  // Auto-scroll on mount/updates
  useEffect(() => {
    if (!loadingMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages.length, loadingMessages]);

  return (
    <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden relative">
      <ScrollArea className="flex-1 h-full">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6">
          <div className="space-y-6 pb-4">
          {loadingMessages ? (
            <div className="flex h-[40vh] flex-col items-center justify-center text-center">
              <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-[40vh] flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-2xl bg-primary/10 p-4">
                <span className="text-3xl">👋</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Welcome to Weston</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Upload documents in the Sources tab, then ask me questions about them.
              </p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isUser = m.role === "user";
              return (
              <div key={m.id} className={`flex w-full flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
                <div className={`flex items-center gap-2 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  {!isUser && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/20 text-primary shadow-sm">
                      <span className="text-[10px] font-bold">W</span>
                    </div>
                  )}
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isUser ? "You" : "Weston"}
                  </span>
                </div>
                <div className={
                  isUser 
                    ? "rounded-2xl bg-muted/80 px-5 py-3 text-[15px] text-foreground max-w-[85%] sm:max-w-[75%]"
                    : "px-2 text-[15px] leading-relaxed text-foreground w-full max-w-[95%] sm:max-w-[85%]"
                }>
                  <div className={`prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border ${!isUser && "prose-headings:mt-6 prose-headings:mb-3 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base"}`}>
                    {/* Handle Vercel UI messages vs custom DB loads */}
                    {m.parts ? (
                      m.parts
                        .filter((p: any) => p.type === "text")
                        .map((p: any, idx: number) => (
                          <ReactMarkdown
                            key={idx}
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ node, ...props }) => {
                                const childrenText = props.children?.toString() || "";
                                const isCitation = props.href?.startsWith('#') || childrenText.match(/^\[.*\]$/);
                                if (isCitation || childrenText.startsWith('[')) {
                                  return (
                                    <Badge 
                                      variant="secondary" 
                                      className="mx-1 font-mono cursor-pointer hover:bg-primary/20 transition-colors text-[10px] bg-primary/10 text-primary border border-primary/20"
                                      onClick={() => handleCitationClick(childrenText)}
                                    >
                                      {props.children}
                                    </Badge>
                                  );
                                }
                                return <a {...props} className="text-primary hover:underline font-medium" />;
                              },
                              table: ({node, ...props}) => (
                                <div className="w-full overflow-x-auto my-4 border border-border/50 rounded-lg">
                                  <table {...props} className="w-full text-sm text-left" />
                                </div>
                              ),
                              thead: ({node, ...props}) => (
                                <thead {...props} className="bg-muted/50 border-b border-border/50" />
                              ),
                              tbody: ({node, ...props}) => (
                                <tbody {...props} className="divide-y divide-border/50" />
                              ),
                              tr: ({node, ...props}) => (
                                <tr {...props} className="hover:bg-muted/20 transition-colors" />
                              ),
                              th: ({node, ...props}) => (
                                <th {...props} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground" />
                              ),
                              td: ({node, ...props}) => (
                                <td {...props} className="px-4 py-3 text-foreground" />
                              ),
                              h1: ({node, ...props}) => <h1 {...props} className="text-2xl font-bold tracking-tight text-foreground mt-8 mb-4 first:mt-0" />,
                              h2: ({node, ...props}) => <h2 {...props} className="text-xl font-semibold tracking-tight text-foreground mt-6 mb-3 first:mt-0 border-b border-border/50 pb-2" />,
                              h3: ({node, ...props}) => <h3 {...props} className="text-lg font-medium tracking-tight text-foreground mt-5 mb-2 first:mt-0" />,
                              p: ({node, ...props}) => <p {...props} className="leading-relaxed text-foreground/90 mb-4 last:mb-0" />,
                              ul: ({node, ...props}) => <ul {...props} className="list-disc leading-relaxed text-foreground/90 mb-4 pl-6 space-y-1.5 marker:text-primary/50" />,
                              ol: ({node, ...props}) => <ol {...props} className="list-decimal leading-relaxed text-foreground/90 mb-4 pl-6 space-y-1.5 marker:text-primary/50 marker:font-medium" />,
                              li: ({node, ...props}) => <li {...props} className="pl-1" />,
                              blockquote: ({node, ...props}) => (
                                <blockquote {...props} className="border-l-4 border-primary/40 text-foreground/80 pl-4 py-1 my-4 italic bg-muted/30 rounded-r-lg" />
                              ),
                              pre: ({node, ...props}) => (
                                <div className="relative my-5 rounded-lg border border-border bg-muted/40 overflow-hidden shadow-sm">
                                  <div className="flex h-9 items-center px-4 bg-muted border-b border-border/60">
                                    <div className="flex space-x-1.5">
                                      <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
                                    </div>
                                  </div>
                                  <pre {...props} className="p-4 overflow-x-auto text-sm" />
                                </div>
                              ),
                              code: ({node, className, children, ...props}) => {
                                const match = /language-(\w+)/.exec(className || '');
                                const isInline = !match;
                                return isInline ? (
                                  <code {...props} className="bg-muted px-1.5 py-0.5 rounded-md text-[13px] font-mono font-medium text-foreground/90 whitespace-nowrap">
                                    {children}
                                  </code>
                                ) : (
                                  <code {...props} className={`font-mono text-[13.5px] leading-relaxed text-foreground/90 ${className || ''}`}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {transformCitations(p.text)}
                          </ReactMarkdown>
                        ))
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, ...props }) => {
                            const childrenText = props.children?.toString() || "";
                            const isCitation = props.href?.startsWith('#') || childrenText.match(/^\[.*\]$/);
                            if (isCitation || childrenText.startsWith('[')) {
                              return (
                                <Badge 
                                  variant="secondary" 
                                  className="mx-1 font-mono cursor-pointer hover:bg-primary/20 transition-colors text-[10px] bg-primary/10 text-primary border border-primary/20"
                                  onClick={() => handleCitationClick(childrenText)}
                                >
                                  {props.children}
                                </Badge>
                              );
                            }
                            return <a {...props} className="text-primary hover:underline font-medium" />;
                          },
                          table: ({node, ...props}) => (
                            <div className="w-full overflow-x-auto my-4 border border-border/50 rounded-lg">
                              <table {...props} className="w-full text-sm text-left" />
                            </div>
                          ),
                          thead: ({node, ...props}) => (
                            <thead {...props} className="bg-muted/50 border-b border-border/50" />
                          ),
                          tbody: ({node, ...props}) => (
                            <tbody {...props} className="divide-y divide-border/50" />
                          ),
                          tr: ({node, ...props}) => (
                            <tr {...props} className="hover:bg-muted/20 transition-colors" />
                          ),
                          th: ({node, ...props}) => (
                            <th {...props} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground" />
                          ),
                          td: ({node, ...props}) => (
                            <td {...props} className="px-4 py-3 text-foreground" />
                          ),
                          h1: ({node, ...props}) => <h1 {...props} className="text-2xl font-bold tracking-tight text-foreground mt-8 mb-4 first:mt-0" />,
                          h2: ({node, ...props}) => <h2 {...props} className="text-xl font-semibold tracking-tight text-foreground mt-6 mb-3 first:mt-0 border-b border-border/50 pb-2" />,
                          h3: ({node, ...props}) => <h3 {...props} className="text-lg font-medium tracking-tight text-foreground mt-5 mb-2 first:mt-0" />,
                          p: ({node, ...props}) => <p {...props} className="leading-relaxed text-foreground/90 mb-4 last:mb-0" />,
                          ul: ({node, ...props}) => <ul {...props} className="list-disc leading-relaxed text-foreground/90 mb-4 pl-6 space-y-1.5 marker:text-primary/50" />,
                          ol: ({node, ...props}) => <ol {...props} className="list-decimal leading-relaxed text-foreground/90 mb-4 pl-6 space-y-1.5 marker:text-primary/50 marker:font-medium" />,
                          li: ({node, ...props}) => <li {...props} className="pl-1" />,
                          blockquote: ({node, ...props}) => (
                            <blockquote {...props} className="border-l-4 border-primary/40 text-foreground/80 pl-4 py-1 my-4 italic bg-muted/30 rounded-r-lg" />
                          ),
                          pre: ({node, ...props}) => (
                            <div className="relative my-5 rounded-lg border border-border bg-muted/40 overflow-hidden shadow-sm">
                              <div className="flex h-9 items-center px-4 bg-muted border-b border-border/60">
                                <div className="flex space-x-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
                                  <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
                                  <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
                                </div>
                              </div>
                              <pre {...props} className="p-4 overflow-x-auto text-sm" />
                            </div>
                          ),
                          code: ({node, className, children, ...props}) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match;
                            return isInline ? (
                              <code {...props} className="bg-muted px-1.5 py-0.5 rounded-md text-[13px] font-mono font-medium text-foreground/90 whitespace-nowrap">
                                {children}
                              </code>
                            ) : (
                              <code {...props} className={`font-mono text-[13.5px] leading-relaxed text-foreground/90 ${className || ''}`}>
                                {children}
                              </code>
                            );
                          }
                        }}
                        >
                          {transformCitations((m as any).content)}
                        </ReactMarkdown>
                    )}
                  </div>
                  
                  {/* Action Bar for AI Messages */}
                  {!isUser && (
                    <div className="mt-3 flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(m.id, (m as any).content || m.parts?.map((p: any) => p.text).join(' ') || "")}
                        className="p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors rounded-md"
                        title="Copy Response"
                      >
                        {copiedId === m.id ? <Check className="w-[14px] h-[14px] text-emerald-500" /> : <Copy className="w-[14px] h-[14px]" />}
                      </button>
                      
                      {/* Only allow regenerate on the very last AI message */}
                      {idx === messages.length - 1 && (
                        <button
                          onClick={() => reload()}
                          className="p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors rounded-md"
                          title="Regenerate"
                          disabled={isSubmitting}
                        >
                          <RefreshCw className={`w-[14px] h-[14px] ${isSubmitting ? 'animate-spin opacity-50' : ''}`} />
                        </button>
                      )}

                      <button
                        onClick={(e) => handleBranch(e, m.id)}
                        className="p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors rounded-md flex items-center gap-1.5 ml-1"
                        title="Branch off from here"
                        disabled={branchingId !== null}
                      >
                        {branchingId === m.id ? (
                          <Loader2 className="w-[14px] h-[14px] animate-spin" />
                        ) : (
                          <GitBranch className="w-[14px] h-[14px]" />
                        )}
                        <span className="text-[11px] font-medium tracking-wide pr-1">Branch</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )})
          )}

          {/* Loading State for AI Reply */}
          {isSubmitting && messages[messages.length - 1]?.role === "user" && (
            <div key="loading-msg" className="flex w-full flex-col gap-1.5 items-start">
              <div className="flex items-center gap-2 px-1 flex-row">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/20 text-primary shadow-sm">
                  <span className="text-[10px] font-bold">W</span>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Weston
                </span>
              </div>
              <div className="px-2 py-2 text-[15px] leading-relaxed text-foreground w-full max-w-[95%] sm:max-w-[85%]">
                <div className="flex space-x-2 h-4 items-center">
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Error State for Provider Failures */}
          {error && (
            <div className="flex w-full flex-col gap-1.5 items-start mt-2 pb-4">
              <div className="flex items-center gap-2 px-1 flex-row">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-destructive/20 text-destructive shadow-sm">
                  <span className="text-[10px] font-bold">!</span>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-destructive/80">
                  System Error
                </span>
              </div>
              <div className="px-2 py-2 text-[14px] leading-relaxed w-full max-w-[95%] sm:max-w-[85%]">
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-destructive">
                  <p className="font-semibold mb-1">Failed to generate response</p>
                  <p className="text-sm opacity-90">{error.message === "Provider returned error" ? "The AI Provider rejected the request. Please check if the selected Model is still available on OpenRouter, or try a different model." : (error.message || "An unknown error occurred during generation.")}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
        <div ref={messagesEndRef} className="h-4 shrink-0" />
      </ScrollArea>

      {/* Floating Scroll to Bottom Button */}
      {showScrollButton && !loadingMessages && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-md flex items-center justify-center text-foreground cursor-pointer hover:bg-muted hover:text-foreground transition-all z-10"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      <Dialog open={citationDialogOpen} onOpenChange={setCitationDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden bg-background border-border shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <span className="truncate">{citationTitle}</span>
              <Badge variant="secondary" className="ml-auto mr-6 bg-primary/10 text-primary border-primary/20 pointer-events-none">
                {citationSnippets.length} {citationSnippets.length === 1 ? "Snippet" : "Snippets"}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 bg-card/50">
            {loadingCitations ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full"></div>
                <p className="text-sm text-muted-foreground animate-pulse">Retrieving textual evidence...</p>
              </div>
            ) : citationSnippets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <span className="text-xl">📄</span>
                </div>
                <p className="text-muted-foreground font-medium">No snippets found.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">This citation might not be tied to an exact retrieved chunk.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {citationSnippets.map((snippet, idx) => (
                  <div key={idx} className="group relative bg-background rounded-xl p-4 sm:p-5 border border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {idx + 1}
                        </span>
                        <div className="flex gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {(snippet.pageStart !== undefined && snippet.pageStart !== null) && (
                            <span>Page {snippet.pageStart}{snippet.pageEnd && snippet.pageEnd !== snippet.pageStart ? `-${snippet.pageEnd}` : ""}</span>
                          )}
                          {(snippet.pageStart !== undefined && snippet.pageStart !== null) && snippet.distance !== undefined && (
                            <span className="text-muted-foreground/30">•</span>
                          )}
                          {snippet.distance !== undefined && (
                            <span>Match: {((1 - snippet.distance) * 100).toFixed(1)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-[14px] leading-relaxed text-foreground/90 font-serif">
                      <ReactMarkdown>{snippet.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
