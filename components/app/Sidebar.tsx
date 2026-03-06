"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Edit2,
  MessageSquarePlus,
  MoreHorizontal,
  Search,
  Settings,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type ChatStub = { id: string; title: string };

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedChatId = searchParams.get("chat");

  const [chats, setChats] = useState<ChatStub[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar:collapsed") === "true";
  });

  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return 260;
    const saved = localStorage.getItem("sidebar:width");
    return saved ? parseInt(saved, 10) : 260;
  });
  const [isResizing, setIsResizing] = useState(false);

  function toggleCollapsed() {
    setIsCollapsed((v) => {
      localStorage.setItem("sidebar:collapsed", String(!v));
      return !v;
    });
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const w = Math.min(600, Math.max(200, e.clientX));
      setWidth(w);
    };
    const onUp = (e: MouseEvent) => {
      setIsResizing(false);
      localStorage.setItem("sidebar:width", String(Math.min(600, Math.max(200, e.clientX))));
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isResizing]);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const refreshSessions = useCallback(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.sessions)) {
          setChats(d.sessions.map((s: any) => ({ id: s.id, title: s.title })));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refreshSessions();
    window.addEventListener("refreshSessions", refreshSessions);
    return () => window.removeEventListener("refreshSessions", refreshSessions);
  }, [refreshSessions]);

  useEffect(() => {
    const t = setInterval(refreshSessions, 8000);
    return () => clearInterval(t);
  }, [refreshSessions]);

  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
  }, [query, chats]);

  async function handleNewChat() {
    const newId = `chat-${Date.now()}`;
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, title: "New chat" }),
      });
    } catch { /* proceed */ }
    setChats((prev) => [{ id: newId, title: "New chat" }, ...prev]);
    router.push(`/chat?chat=${newId}`);
  }

  async function handleDelete(id: string) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (selectedChatId === id) router.push("/chat");
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch { /* silent */ }
  }

  function startRename(chat: ChatStub) {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
  }

  async function commitRename(id: string) {
    const newTitle = renameValue.trim();
    if (!newTitle) { setRenamingId(null); return; }
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
    setRenamingId(null);
    window.dispatchEvent(new CustomEvent("sessionRenamed", { detail: { id, title: newTitle } }));
    try {
      await fetch("/api/sessions/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: newTitle }),
      });
    } catch { /* silent */ }
  }

  const menuContent = (c: ChatStub) => (
    <>
      <DropdownMenuItem onSelect={() => startRename(c)} className="cursor-pointer">
        <Edit2 className="mr-2 h-3.5 w-3.5" /> Rename
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => handleDelete(c.id)}
        className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
      </DropdownMenuItem>
    </>
  );

  return (
    <aside
      className={`relative flex h-full overflow-hidden shrink-0 flex-col bg-sidebar border-r border-sidebar-border ${
        isResizing ? "select-none" : "transition-[width] duration-200 ease-in-out"
      }`}
      style={{ width: isCollapsed ? 56 : width }}
    >
      {/* Resize handle */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute bottom-0 right-0 top-0 z-50 w-1 cursor-col-resize hover:bg-primary/40 transition-colors"
        />
      )}

      {/* Header */}
      <div className={`flex h-14 shrink-0 items-center border-b border-sidebar-border px-3 gap-2 ${isCollapsed ? "justify-center" : "justify-between"}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 min-w-0 pl-1">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              W
            </div>
            <span className="text-sm font-semibold truncate text-sidebar-foreground">Weston</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={toggleCollapsed}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Chat */}
      <div className={`shrink-0 px-3 pt-3 pb-1.5 ${isCollapsed ? "flex justify-center" : ""}`}>
        <Button
          onClick={handleNewChat}
          title={isCollapsed ? "New Chat" : undefined}
          className={`cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 ${
            isCollapsed ? "h-9 w-9 p-0 rounded-lg" : "w-full justify-start h-9 text-sm"
          }`}
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0" />
          {!isCollapsed && "New Chat"}
        </Button>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="shrink-0 px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              className="h-8 w-full rounded-md bg-muted/60 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground border border-transparent focus:border-primary/40 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chat list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pb-4">
          {!isCollapsed && (
            <p className="mb-2 mt-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Chats
            </p>
          )}
          <div className="space-y-0.5">
            {!loaded && (
              <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
            )}
            {loaded && filteredChats.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {query ? "No matches" : "No chats yet"}
              </div>
            )}

            {filteredChats.map((c) => {
              const active = c.id === selectedChatId && pathname === "/chat";

              if (isCollapsed) {
                return (
                  <Link
                    key={c.id}
                    href={`/chat?chat=${c.id}`}
                    title={c.title}
                    className={`flex h-8 w-full items-center justify-center rounded-md text-xs font-bold uppercase transition-colors ${
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    }`}
                  >
                    {c.title.charAt(0)}
                  </Link>
                );
              }

              return (
                <ContextMenu key={c.id}>
                  <ContextMenuTrigger asChild>
                    <div className={`group relative flex items-center rounded-md transition-colors ${
                      active
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    }`}>
                      {/* Active accent bar */}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-primary" />
                      )}

                      {renamingId === c.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(c.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => commitRename(c.id)}
                          className="w-full rounded-md border border-primary/40 bg-muted px-2.5 py-1.5 text-[13px] text-foreground focus:outline-none"
                        />
                      ) : (
                        <>
                          {/* Title link — takes all space, truncates */}
                          <Link
                            href={`/chat?chat=${c.id}`}
                            className={`flex-1 min-w-0 py-2 pl-5 pr-2 text-[13px] leading-snug ${active ? "font-medium text-foreground" : ""}`}
                          >
                            <span className="block truncate">{c.title}</span>
                          </Link>

                          {/* Three dots — overlay pattern: covers text only on hover */}
                          <div className={`absolute right-0 top-0 bottom-0 w-12 flex items-center justify-end pr-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${
                            active 
                              ? "bg-gradient-to-l from-[#e6f0f4] from-75% to-transparent dark:from-primary/20" 
                              : "bg-gradient-to-l from-sidebar-accent from-75% to-transparent"
                          }`}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-7 w-7 rounded-full text-muted-foreground transition-all hover:text-foreground hover:scale-105 shadow-sm border border-transparent ${
                                    active 
                                      ? "bg-background/60 hover:bg-background/90 hover:shadow-md hover:border-black/5 dark:hover:border-white/5" 
                                      : "bg-background/80 hover:bg-background hover:shadow-md hover:border-black/5 dark:hover:border-white/5"
                                  }`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 z-50">
                                {menuContent(c)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </>
                      )}
                    </div>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-40">
                    <ContextMenuItem onSelect={() => startRename(c)} className="cursor-pointer">
                      <Edit2 className="mr-2 h-3.5 w-3.5" /> Rename
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onSelect={() => handleDelete(c.id)}
                      className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Button
          variant={pathname === "/settings" ? "secondary" : "ghost"}
          size="sm"
          className={`cursor-pointer gap-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 ${
            isCollapsed ? "h-9 w-9 p-0 mx-auto" : "w-full justify-start h-9"
          }`}
          asChild
        >
          <Link href="/settings" title={isCollapsed ? "Settings" : undefined}>
            <Settings className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="text-sm">Settings</span>}
          </Link>
        </Button>
      </div>
    </aside>
  );
}