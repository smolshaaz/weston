"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Check, Loader2, Search, Trash2, LibraryBig } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ModelOption {
  provider: string;
  id: string;
  name: string;
}

interface ManageModelsDialogProps {
  availableModels: ModelOption[];
  onModelsChange: () => void;
  provider: string;    // e.g. "openrouter", "openai"
  providerName: string; // e.g. "OpenRouter", "OpenAI"
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ManageModelsDialog({ availableModels, onModelsChange, provider, providerName, trigger, open: controlledOpen, onOpenChange: setControlledOpen }: ManageModelsDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = setControlledOpen || setUncontrolledOpen;
  const [searchModels, setSearchModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [loadingAct, setLoadingAct] = useState<string | null>(null);

  useEffect(() => {
    if (open && searchModels.length === 0) {
      fetchRegistry();
    }
  }, [open]);

  async function fetchRegistry() {
    setLoading(true);
    try {
      const res = await fetch("/api/models/search");
      if (res.ok) {
        const data = await res.json();
        setSearchModels(data.models || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(model: any) {
    setLoadingAct(model.id);
    try {
      await fetch("/api/models/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: model.id,
          name: model.name || model.id,
          provider,
        }),
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
        body: JSON.stringify({ id: modelId }),
      });
      onModelsChange();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAct(null);
    }
  }

  const filteredRegistry = searchModels.filter((m) =>
    (m.name || "").toLowerCase().includes(query.toLowerCase()) ||
    m.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl w-[95vw] flex flex-col max-h-[85vh] h-[600px] p-0 overflow-hidden rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-lg font-semibold text-foreground tracking-tight">{providerName} — Manage Models</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1 cursor-default">
            Search and add models to your persistent workspace catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 flex-shrink-0 bg-background/50">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by model name or ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 pb-6 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-4" />
              <div className="text-sm">Fetching live model registry...</div>
            </div>
          ) : filteredRegistry.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {query ? "No models match your search." : "No models found."}
            </div>
          ) : (
            <div className="space-y-2 pb-6 pr-2 sm:pr-4">
              {filteredRegistry.map((m) => {
                const isAdded = availableModels.some((am) => am.id === m.id);

                return (
                  <div key={m.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/50 hover:bg-muted/40 hover:border-border transition-all">
                    <div className="flex flex-col pr-4 min-w-0">
                      <div className="text-sm font-medium truncate">{m.name || m.id}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.id}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <div className="text-xs text-muted-foreground font-mono">
                        ${(parseFloat(m.pricing?.prompt) * 1000000 || 0).toFixed(2)}/M
                      </div>

                      {isAdded ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 w-8 rounded-full p-0 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all border border-destructive/20 hover:border-destructive"
                          disabled={loadingAct === m.id}
                          onClick={() => handleRemove(m.id)}
                        >
                          {loadingAct === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-full gap-1.5 px-3.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all font-medium border border-primary/20 hover:border-primary shadow-sm hover:shadow-md"
                          disabled={loadingAct === m.id}
                          onClick={() => handleAdd(m)}
                        >
                          {loadingAct === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
