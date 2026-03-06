"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Search, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ModelOption {
  provider: string;
  id: string;
  name: string;
}

interface SuggestedModel {
  id: string;
  name: string;
}

interface ManageModelsDialogProps {
  availableModels: ModelOption[];
  onModelsChange: () => void;
  provider: string;
  providerName: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** If provided, shows a curated list instead of the live OpenRouter registry */
  suggestedModels?: SuggestedModel[];
}

export function ManageModelsDialog({
  availableModels,
  onModelsChange,
  provider,
  providerName,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  suggestedModels,
}: ManageModelsDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = setControlledOpen || setUncontrolledOpen;

  // Live registry (OpenRouter only)
  const [registryModels, setRegistryModels] = useState<any[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [query, setQuery] = useState("");
  const [loadingAct, setLoadingAct] = useState<string | null>(null);

  // Manual add (for typing a custom ID)
  const [manualId, setManualId] = useState("");
  const [manualName, setManualName] = useState("");

  // Always allow manual add/search, but we rely on the registry mostly for OpenRouter.
  const useLiveRegistry = provider === "openrouter";

  useEffect(() => {
    if (open && useLiveRegistry && registryModels.length === 0) {
      fetchRegistry();
    }
  }, [open, useLiveRegistry, registryModels.length]);

  async function fetchRegistry() {
    setLoadingRegistry(true);
    try {
      const res = await fetch("/api/models/search");
      if (res.ok) {
        const data = await res.json();
        setRegistryModels(data.models || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRegistry(false);
    }
  }

  async function handleAdd(model: { id: string; name: string }) {
    setLoadingAct(model.id);
    try {
      await fetch("/api/models/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: model.id, name: model.name || model.id, provider }),
      });
      onModelsChange();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAct(null);
    }
  }

  async function handleRemove(modelId: string) {
    setLoadingAct(modelId);
    try {
      await fetch("/api/models/custom", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modelId, provider }),
      });
      onModelsChange();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAct(null);
    }
  }

  async function handleManualAdd() {
    const id = manualId.trim();
    const name = manualName.trim() || id;
    if (!id) return;
    await handleAdd({ id, name });
    setManualId("");
    setManualName("");
  }

  // Determine the list to show
  const listModels = useLiveRegistry
    ? registryModels.filter(
        (m) =>
          (m.name || "").toLowerCase().includes(query.toLowerCase()) ||
          m.id.toLowerCase().includes(query.toLowerCase())
      )
    : (suggestedModels ?? []).filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.id.toLowerCase().includes(query.toLowerCase())
      );

  const addedModels = availableModels.filter((m) => m.provider === provider);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-2xl w-[95vw] flex flex-col max-h-[85vh] h-[640px] p-0 overflow-hidden rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-lg font-semibold text-foreground tracking-tight">
            {providerName} — Manage Models
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {useLiveRegistry
              ? "Search and add models from the live OpenRouter registry."
              : "Pick from suggested models or enter a custom model ID below."}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 py-3 flex-shrink-0 bg-background/50">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or model ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-6 pb-4">
          {/* Added models */}
          {addedModels.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Added
              </p>
              <div className="space-y-1.5">
                {addedModels.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.id}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 rounded-full p-0 text-destructive hover:bg-destructive/10 shrink-0"
                      disabled={loadingAct === m.id}
                      onClick={() => handleRemove(m.id)}
                    >
                      {loadingAct === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested / Registry list */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-4">
            {useLiveRegistry ? "OpenRouter Registry" : "Suggested / Default"}
          </p>

          {loadingRegistry ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-3" />
              <div className="text-sm">Fetching live model registry...</div>
            </div>
          ) : listModels.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {query ? "No models match your search." : "No models found."}
            </div>
          ) : (
            <div className="space-y-1.5 pb-2">
              {listModels.map((m) => {
                const isAdded = availableModels.some((am) => am.id === m.id && am.provider === provider);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border/50 bg-background/50 hover:bg-muted/40 hover:border-border transition-all"
                  >
                    <div className="flex flex-col pr-4 min-w-0">
                      <div className="text-sm font-medium truncate">{m.name || m.id}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.id}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {useLiveRegistry && (
                        <div className="text-xs text-muted-foreground font-mono hidden sm:block">
                          ${(parseFloat(m.pricing?.prompt) * 1_000_000 || 0).toFixed(2)}/M
                        </div>
                      )}
                      {isAdded ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 rounded-full p-0 text-destructive hover:bg-destructive/10"
                          disabled={loadingAct === m.id}
                          onClick={() => handleRemove(m.id)}
                        >
                          {loadingAct === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 rounded-full gap-1 px-3 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all font-medium border border-primary/20 hover:border-primary text-xs"
                          disabled={loadingAct === m.id}
                          onClick={() => handleAdd(m)}
                        >
                          {loadingAct === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Manual entry */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Custom model ID
            </p>
            <div className="flex gap-2">
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualAdd(); }}
                placeholder="e.g. gpt-4-turbo"
                className="flex-1 h-9 px-3 rounded-lg bg-muted/50 border border-border text-sm outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
              />
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualAdd(); }}
                placeholder="Display name (optional)"
                className="flex-1 h-9 px-3 rounded-lg bg-muted/50 border border-border text-sm outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
              />
              <Button
                size="sm"
                className="h-9 px-4 rounded-lg shrink-0"
                disabled={!manualId.trim() || !!loadingAct}
                onClick={handleManualAdd}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
