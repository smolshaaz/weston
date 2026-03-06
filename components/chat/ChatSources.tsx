"use client";

import { useEffect, useState, useRef } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SourceStub = {
  id: string;
  name: string;
  kind: "pdf" | "txt" | "md";
  status: "uploading" | "pending" | "indexed" | "indexing" | "failed";
  progress: number;
  isActive: boolean;
  wordCount: number;
  tokens: number;
};

interface ChatSourcesProps {
  chatId: string;
}

export function ChatSources({ chatId }: ChatSourcesProps) {
  const [sources, setSources] = useState<SourceStub[]>([]);
  const [uploading, setUploading] = useState(false);
  const [addTextOpen, setAddTextOpen] = useState(false);
  const [addTextTitle, setAddTextTitle] = useState("");
  const [addTextContent, setAddTextContent] = useState("");
  const [addTextSubmitting, setAddTextSubmitting] = useState(false);

  // Tracks how many rapid re-polls to fire after an upload/text-add
  const [burstPollsLeft, setBurstPollsLeft] = useState(0);

  // Drag and drop state for the Sources Header box
  const [dragActive, setDragActive] = useState(false);
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

    if (uploading || !e.dataTransfer.files?.length) return;
    await Promise.all(Array.from(e.dataTransfer.files).map((f) => uploadFile(f)));
  }
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Source Viewer/Editor State
  const [viewSource, setViewSource] = useState<SourceStub | null>(null);
  const [editTextContent, setEditTextContent] = useState("");
  const [isFetchingText, setIsFetchingText] = useState(false);
  const [isSavingText, setIsSavingText] = useState(false);

  const fetchSources = () =>
    fetch(`/api/sources?chatId=${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        const real: SourceStub[] = d.sources || [];
        // Keep optimistic "uploading" entries that haven't landed in DB yet
        setSources((prev) => {
          const optimistic = prev.filter(
            (s) => s.status === "uploading" && !real.some((r) => r.name === s.name)
          );
          return [...optimistic, ...real];
        });
      })
      .catch(() => {});

  // Initial fetch on mount or chat change
  useEffect(() => { fetchSources(); }, [chatId]);

  // Slow poll while indexing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const isReadyToPoll = sources.some(
      (s) => s.status === "pending" || s.status === "indexing"
    );
    if (isReadyToPoll) {
      timeoutId = setTimeout(fetchSources, 3000);
    }
    return () => clearTimeout(timeoutId);
  }, [sources, chatId]);

  // Burst poll after upload/text-add to catch sources before slow-poll kicks in
  useEffect(() => {
    if (burstPollsLeft <= 0) return;
    const id = setTimeout(() => {
      fetchSources();
      setBurstPollsLeft((n) => n - 1);
    }, 800);
    return () => clearTimeout(id);
  }, [burstPollsLeft, chatId]);

  // Global listener from ChatWorkspace uploads
  useEffect(() => {
    const onRefresh = () => {
      fetchSources();
      setBurstPollsLeft(5);
    };
    window.addEventListener("refreshSources", onRefresh);
    return () => window.removeEventListener("refreshSources", onRefresh);
  }, []);

  async function uploadFile(file: File) {
    setUploading(true);

    // Immediately add an optimistic placeholder so the user sees something right away
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const ext = file.name.split(".").pop()?.toLowerCase() as "pdf" | "txt" | "md";
    setSources((prev) => [
      ...prev,
      { id: tempId, name: file.name, kind: ext ?? "txt", status: "uploading", progress: 0, isActive: true, wordCount: 0, tokens: 0 },
    ]);

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

      // Start a burst of 5 rapid re-polls (every 800ms) to catch the new source
      // even if the immediate DB write hasn't flushed yet.
      setBurstPollsLeft(5);
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Upload failed", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    // Upload all files concurrently
    await Promise.all(files.map((f) => uploadFile(f)));
    // Reset input so the same file can be re-selected if needed
    e.target.value = "";
  }

  function handleAddText() {
    setAddTextTitle("");
    setAddTextContent("");
    setAddTextOpen(true);
  }

  async function submitAddText() {
    if (!addTextTitle.trim() || !addTextContent.trim()) return;

    setAddTextSubmitting(true);
    try {
      const res = await fetch("/api/sources/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, title: addTextTitle, text: addTextContent }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setAddTextOpen(false);
      // Burst poll to catch the new source
      setBurstPollsLeft(5);
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Text ingestion failed", err);
    } finally {
      setAddTextSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteSourceId) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sources/${deleteSourceId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      // Refresh sources list locally without fetching
      setSources((prev) => prev.filter((s) => s.id !== deleteSourceId));
      setDeleteSourceId(null);
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed to delete source", err);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleSourceClick(e: React.MouseEvent, s: SourceStub) {
    e.preventDefault();
    setViewSource(s);
    if (s.kind === "txt" || s.kind === "md") {
      setIsFetchingText(true);
      fetch(`/api/sources/${s.id}/content`)
        .then(async r => {
          if (!r.ok) {
            const err = await r.text();
            throw new Error(err || "Failed to load text");
          }
          return r.text();
        })
        .then(text => setEditTextContent(text))
        .catch(err => {
          console.error("Failed to load text:", err);
          setEditTextContent("");
        })
        .finally(() => setIsFetchingText(false));
    }
  }

  async function handleSaveText() {
    if (!viewSource) return;
    setIsSavingText(true);
    try {
      const res = await fetch(`/api/sources/${viewSource.id}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editTextContent })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to save");
      
      setSources(sources.map(src => src.id === viewSource.id ? { ...src, status: "pending", progress: 0 } : src));
      setViewSource(null);
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed to save", err);
    } finally {
      setIsSavingText(false);
    }
  }

  return (
    <>
      <div 
        className={`relative mx-auto max-w-3xl space-y-5 rounded-2xl p-6 border-2 border-dashed transition-all ${
          dragActive 
            ? "border-primary bg-primary/5 scale-[1.02] shadow-md" 
            : "border-border/60 bg-muted/10 hover:border-primary/30"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {dragActive && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-card/80 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="h-8 w-8 animate-bounce" />
              <span className="font-semibold text-lg drop-shadow-sm">Drop files here to upload</span>
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Chat Sources</h2>
            <p className="text-sm text-muted-foreground">Weston will only answer using these documents.</p>
          </div>
          <div className="flex flex-col gap-2.5 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
            <div className="flex gap-2 w-full sm:w-auto">
              <label 
                className={`flex-1 sm:flex-none cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none border border-border bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Upload className="h-4 w-4" /> Add files
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>

              <Button
                type="button"
                variant="outline"
                onClick={handleAddText}
                disabled={uploading}
                className="flex-1 sm:flex-none gap-2 text-sm border-border bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 cursor-pointer"
              >
                <FileText className="h-4 w-4" /> Add text
              </Button>
            </div>
            <div className="hidden sm:flex items-center gap-3 opacity-70">
              <div className="h-[1px] flex-1 bg-border/80"></div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                or drop files here
              </span>
              <div className="h-[1px] flex-1 bg-border/80"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-1 py-4">
        <div className="grid gap-2">
          {sources.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border/50 bg-muted/5">
              No sources added to this chat yet.
            </div>
          ) : null}

          {sources.map((s) => (
            <div key={s.id} className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:border-primary/30 hover:shadow-md transition-all">
              <div className="min-w-0 flex-1">
                <a 
                  href="#"
                  onClick={(e) => handleSourceClick(e, s)}
                  className={`truncate font-medium transition-colors block ${s.isActive ? "text-card-foreground hover:underline hover:text-primary" : "text-card-foreground/50 line-through"}`}
                >
                  {s.name}
                </a>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="uppercase font-semibold tracking-wider">{s.kind}</span>
                  {s.status === "indexed" && s.wordCount > 0 && (
                    <>
                      <span className="text-muted-foreground/30">•</span>
                      <span>{s.wordCount.toLocaleString()} words</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 sm:gap-4 shrink-0">
                <div className="relative">
                  <Badge 
                      variant={s.status === "indexed" ? "default" : "secondary"}
                      className={`relative overflow-hidden pointer-events-none ${
                        s.status === "indexed" 
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" 
                          : s.status === "failed"
                          ? "bg-destructive/15 text-destructive border border-destructive/25"
                          : s.status === "uploading"
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}
                    >
                      {(s.status === "indexing" || s.status === "pending") && (
                        <div 
                          className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-500 ease-out" 
                          style={{ width: `${s.status === 'pending' ? 5 : Math.max(5, s.progress)}%` }} 
                        />
                      )}
                      <span className="relative z-10 font-semibold tracking-wide">
                        {s.status === "indexed" 
                          ? "Ready" 
                          : s.status === "indexing" 
                          ? `Reading ${s.progress}%` 
                          : s.status === "pending" 
                          ? "Preparing..."
                          : s.status === "uploading"
                          ? "Uploading..."
                          : "Failed"}
                      </span>
                    </Badge>
                </div>

                {s.status === "indexed" && (
                  <div className="flex items-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={s.isActive}
                      onClick={async () => {
                        const newActiveState = !s.isActive;
                        // Optimistic update
                        setSources(sources.map(src => src.id === s.id ? { ...src, isActive: newActiveState } : src));
                        
                        try {
                          await fetch(`/api/sources/${s.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isActive: newActiveState })
                          });
                        } catch (err) {
                          // Revert on failure
                          setSources(sources.map(src => src.id === s.id ? { ...src, isActive: s.isActive } : src));
                        }
                      }}
                      className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${s.isActive ? 'bg-primary' : 'bg-input'}`}
                    >
                      <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${s.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setDeleteSourceId(s.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={addTextOpen} onOpenChange={setAddTextOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Text Source</DialogTitle>
            <DialogDescription>Paste notes or text content to use as a source in this chat.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="add-text-title" className="text-sm font-medium text-foreground">
                Title
              </label>
              <input
                id="add-text-title"
                placeholder="e.g. Lecture Notes, Chapter Summary…"
                value={addTextTitle}
                onChange={(e) => setAddTextTitle(e.target.value)}
                autoComplete="off"
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="add-text-content" className="text-sm font-medium text-foreground">
                Content
              </label>
              <textarea
                id="add-text-content"
                placeholder="Paste your text here…"
                rows={8}
                value={addTextContent}
                onChange={(e) => setAddTextContent(e.target.value)}
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 resize-none transition-colors"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddTextOpen(false)}
              disabled={addTextSubmitting}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={submitAddText}
              disabled={addTextSubmitting || !addTextTitle.trim() || !addTextContent.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {addTextSubmitting ? "Saving…" : "Add Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteSourceId} onOpenChange={(open) => !open && setDeleteSourceId(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Source</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this source? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteSourceId(null)}
              disabled={isDeleting}
              className="border-border mr-3 "
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Source Viewer/Editor Dialog */}
      <Dialog open={!!viewSource} onOpenChange={(open) => !open && setViewSource(null)}>
        <DialogContent className={`bg-card border-border flex flex-col ${viewSource?.kind === 'pdf' ? 'sm:max-w-5xl h-[85vh]' : 'sm:max-w-4xl h-[75vh]'}`}>
          <DialogHeader>
            <DialogTitle className="text-foreground truncate pr-6">{viewSource?.name}</DialogTitle>
            <DialogDescription>
              {viewSource?.kind === 'pdf' ? 'Viewing PDF document' : 'Editing text source. Saving will re-ingest the document into AI memory.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 py-4">
            {viewSource?.kind === 'pdf' && (
              <iframe
                src={`/api/sources/${viewSource.id}/content`}
                className="w-full h-full rounded-md border border-border"
                title="PDF Viewer"
              />
            )}
            
            {(viewSource?.kind === 'txt' || viewSource?.kind === 'md') && (
              isFetchingText ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-muted-foreground animate-pulse">Loading text content...</span>
                </div>
              ) : (
                <textarea
                  value={editTextContent}
                  onChange={(e) => setEditTextContent(e.target.value)}
                  className="w-full h-full p-4 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none font-mono text-sm leading-relaxed text-foreground"
                />
              )
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewSource(null)}
              disabled={isSavingText}
              className="border-border"
            >
              Close
            </Button>
            {(viewSource?.kind === 'txt' || viewSource?.kind === 'md') && (
              <Button
                onClick={handleSaveText}
                disabled={isSavingText || isFetchingText || !editTextContent.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 ml-2"
              >
                {isSavingText ? "Saving & Re-indexing..." : "Save Changes"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
