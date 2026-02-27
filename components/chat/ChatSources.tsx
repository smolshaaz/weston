"use client";

import { useEffect, useState } from "react";
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
  status: "pending" | "indexed" | "indexing" | "failed";
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
  
  // Drag and drop state
  const [dragActive, setDragActive] = useState(false);
  
  // State for Delete Dialog
  const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Source Viewer/Editor State
  const [viewSource, setViewSource] = useState<SourceStub | null>(null);
  const [editTextContent, setEditTextContent] = useState("");
  const [isFetchingText, setIsFetchingText] = useState(false);
  const [isSavingText, setIsSavingText] = useState(false);

  // Initial fetch on mount or chat change
  useEffect(() => {
    fetch(`/api/sources?chatId=${chatId}`)
      .then((r) => r.json())
      .then((d) => setSources(d.sources || []))
      .catch(() => {});
  }, [chatId]);

  // Polling effect: runs whenever sources changes and there's a pending/indexing item
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const isReadyToPoll = sources.some(
      (s) => s.status === "pending" || s.status === "indexing"
    );

    if (isReadyToPoll) {
      timeoutId = setTimeout(() => {
        fetch(`/api/sources?chatId=${chatId}`)
          .then((r) => r.json())
          .then((d) => setSources(d.sources || []))
          .catch(() => {});
      }, 3000);
    }

    return () => clearTimeout(timeoutId);
  }, [sources, chatId]);

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (uploading || !e.dataTransfer.files || !e.dataTransfer.files[0]) return;
    await uploadFile(e.dataTransfer.files[0]);
  }

  async function uploadFile(file: File) {
    setUploading(true);

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

      // Refresh sources
      const refresh = await fetch(`/api/sources?chatId=${chatId}`).then((r) =>
        r.json()
      );
      setSources(refresh.sources || []);
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Upload failed", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
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

      // Refresh sources
      const refresh = await fetch(`/api/sources?chatId=${chatId}`).then((r) =>
        r.json()
      );
      setSources(refresh.sources || []);
      setAddTextOpen(false);
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
        className={`relative mx-auto max-w-3xl space-y-5 rounded-2xl transition-colors ${dragActive ? "p-4 bg-primary/5 outline-dashed outline-2 outline-primary/50" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {dragActive && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="h-8 w-8 animate-bounce" />
              <span className="font-medium text-lg">Drop files to upload</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Chat Sources</h2>
            <p className="text-sm text-muted-foreground">Weston will only answer using these documents.</p>
          </div>
          
          <div className="flex gap-2">
            <label 
              className={`cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none border border-border bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Upload className="h-4 w-4" /> Add files
              <input
                type="file"
                accept=".pdf,.txt,.md"
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
              className="gap-2 text-sm border-border bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> Add text
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          {sources.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
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
