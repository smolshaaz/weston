"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Edit2, MessageSquarePlus, MoreHorizontal, Search, Settings, Trash2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ChatStub = { id: string; title: string };

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedChatId = searchParams.get("chat");

  const [chats, setChats] = useState<ChatStub[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Fetch sessions from the API
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

  // Fetch on mount and listen to custom event
  useEffect(() => {
    refreshSessions();
    const handleRefresh = () => refreshSessions();
    window.addEventListener("refreshSessions", handleRefresh);
    return () => window.removeEventListener("refreshSessions", handleRefresh);
  }, [refreshSessions]);

  // Poll for new sessions every 8 seconds
  useEffect(() => {
    const interval = setInterval(refreshSessions, 8000);
    return () => clearInterval(interval);
  }, [refreshSessions]);

  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [query, chats]);

  async function handleNewChat() {
    const newId = `chat-${Date.now()}`;

    // Create in the DB
    try {
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, title: "New chat" }),
      });
    } catch {
      // proceed anyway
    }

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
    } catch {
      // silent fail
    }
  }

  function startRename(chat: ChatStub) {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
  }

  async function commitRename(id: string) {
    const newTitle = renameValue.trim();
    if (!newTitle) {
      setRenamingId(null);
      return;
    }

    // Update locally immediately
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
    setRenamingId(null);

    // Persist to DB
    try {
      await fetch("/api/sessions/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: newTitle }),
      });
    } catch {
      // silent fail
    }
  }

  return (
    <aside className={`flex h-full overflow-hidden shrink-0 flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${isCollapsed ? "w-[70px]" : "w-[260px]"}`}>
      {/* Brand header */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between">
        <div className={`flex items-center gap-2.5 ${isCollapsed ? "justify-center w-full" : ""}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            W
          </div>
          {!isCollapsed && (
            <div>
              <div className="text-sm font-semibold text-sidebar-foreground tracking-tight">Weston</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Local</div>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setIsCollapsed(true)}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isCollapsed && (
        <div className="flex justify-center pb-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setIsCollapsed(false)}>
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Accent separator */}
      <div className="mx-4 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-transparent shrink-0" />

      {/* New Chat CTA */}
      <div className={`px-3 pt-4 ${isCollapsed ? "flex justify-center" : ""}`}>
        <Button
          onClick={handleNewChat}
          className={`cursor-pointer justify-start gap-2.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all ${isCollapsed ? "w-10 h-10 p-0 justify-center rounded-full" : "w-full"}`}
        >
          <MessageSquarePlus className={isCollapsed ? "h-5 w-5" : "h-4 w-4"} />
          {!isCollapsed && "New Chat"}
        </Button>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              className="h-8 w-full rounded-lg bg-muted/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground border border-transparent focus:border-primary/30 focus:bg-muted focus:outline-none transition-all"
            />
          </div>
        </div>
      )}

      {/* Chat list */}
      <ScrollArea className="flex-1 min-h-0 px-3 pt-4">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recent
        </div>
        <div className="space-y-0.5">
          {!loaded && (
            <div className="px-2 py-4 text-xs text-muted-foreground">Loading…</div>
          )}
          {loaded && filteredChats.length === 0 && (
            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
              {query ? "No matching chats" : "No chats yet. Start a new one!"}
            </div>
          )}
          {filteredChats.map((c) => {
            const active = c.id === selectedChatId && pathname === "/chat";

            return (
              <div key={c.id} className="group relative flex items-center">
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
                    className="flex-1 rounded-lg px-2.5 py-1.5 text-[13px] bg-muted border border-primary/30 text-foreground focus:outline-none"
                  />
                ) : (
                  <Link
                    href={`/chat?chat=${c.id}`}
                    title={isCollapsed ? c.title : undefined}
                    className={`flex flex-1 items-center overflow-hidden rounded-lg px-2.5 py-2 text-[13px] transition-all cursor-pointer ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary font-medium"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    } ${isCollapsed ? "justify-center" : ""}`}
                  >
                    {isCollapsed ? (
                      <span className="font-bold text-xs uppercase">{c.title.charAt(0)}</span>
                    ) : (
                      <span className="truncate">{c.title}</span>
                    )}
                  </Link>
                )}

                {renamingId !== c.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`absolute right-1 h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-foreground hover:bg-muted cursor-pointer ${
                          active ? "opacity-100" : ""
                        } ${isCollapsed ? "hidden" : ""}`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onSelect={() => startRename(c)} className="cursor-pointer">
                        <Edit2 className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => handleDelete(c.id)}
                        className="focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Settings footer */}
      <div className="mt-auto border-t border-sidebar-border p-3">
        <Button
          variant={pathname === "/settings" ? "secondary" : "ghost"}
          className={`justify-start gap-2.5 text-sm font-normal text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 cursor-pointer ${isCollapsed ? "w-10 h-10 p-0 justify-center mx-auto" : "w-full"}`}
          asChild
        >
          <Link href="/settings" title={isCollapsed ? "Settings" : undefined}>
            <Settings className="h-4 w-4 shrink-0" />
            {!isCollapsed && "Settings"}
          </Link>
        </Button>
      </div>
    </aside>
  );
}