"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ShieldCheck, LibraryBig, Star } from "lucide-react";

import { PROVIDERS } from "@/lib/constants";
import type { ProviderId, WestonSettings } from "@/lib/constants";

import { SettingsSection } from "@/components/settings/ui/SettingsSection";
import { ManageModelsDialog } from "@/components/chat/ManageModelsDialog";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SafeSettings = Omit<WestonSettings, "providers"> & {
  providers: Array<{ id: ProviderId; apiKey: string; enabled: boolean }>;
};

interface ModelOption {
  provider: string;
  id: string;
  name: string;
}

export function ProvidersTab() {
  const providerIndex = useMemo(() => {
    const map = new Map<ProviderId, (typeof PROVIDERS)[number]>();
    for (const p of PROVIDERS) map.set(p.id, p);
    return map;
  }, []);

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SafeSettings | null>(null);
  const [customModels, setCustomModels] = useState<ModelOption[]>([]);

  // Add provider dialog
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState<ProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Per-provider manage models dialog
  const [manageDialogProvider, setManageDialogProvider] = useState<{ id: string; name: string } | null>(null);

  // Default model picker dialog
  const [defaultModelOpen, setDefaultModelOpen] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);

  const provider = providerIndex.get(providerId)!;

  async function refresh() {
    setLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/models"),
      ]);
      const data = (await sRes.json()) as SafeSettings;
      setSettings(data);
      if (mRes.ok) {
        const mData = await mRes.json();
        setCustomModels(mData.models || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function verifyAndSave() {
    setBusy(true);
    setError("");
    try {
      const verifyRes = await fetch("/api/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, apiKey, model }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyData.ok) throw new Error(verifyData?.error ?? "Verification failed");

      await fetch("/api/settings/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: providerId, apiKey, enabled: true }),
      });

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupComplete: true, defaultModel: { provider: providerId, model } }),
      });

      setOpen(false);
      setApiKey("");
      setModel("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function setDefaultModel(provider: string, modelId: string) {
    setSavingDefault(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultModel: { provider, model: modelId } }),
      });
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingDefault(false);
    }
  }

  // Build list of all enabled models across all connected providers
  const allEnabledModels: ModelOption[] = useMemo(() => {
    const result: ModelOption[] = [];
    for (const p of settings?.providers ?? []) {
      const def = providerIndex.get(p.id);
      if (!def) continue;
      // Add static models from constants
      for (const m of def.models ?? []) {
        result.push({ provider: p.id, id: m.id, name: m.name });
      }
    }
    // Add custom models (e.g. from OpenRouter)
    for (const m of customModels) {
      result.push(m);
    }
    return result;
  }, [settings, customModels]);

  const currentDefault = settings?.defaultModel;

  return (
    <div className="space-y-6">
      {/* ── Default Model ── */}
      <SettingsSection
        title="Default model"
        description="The model used for all new chats."
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            {currentDefault ? (
              <>
                <div className="text-sm font-medium truncate">
                  {allEnabledModels.find(m => m.provider === currentDefault.provider && m.id === currentDefault.model)?.name ?? currentDefault.model}
                </div>
                <div className="text-xs text-muted-foreground truncate">{currentDefault.provider} / {currentDefault.model}</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No default set.</div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 h-8 rounded-full text-xs"
            onClick={() => setDefaultModelOpen(true)}
          >
            <Star className="mr-1.5 h-3.5 w-3.5" /> Change
          </Button>
        </div>
      </SettingsSection>

      {/* ── Connected providers ── */}
      <SettingsSection
        title="Connected providers"
        description="Keys are stored locally. Weston never sends keys to the browser."
      >
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(settings?.providers ?? []).map((p) => {
              const def = providerIndex.get(p.id);
              const isDefault = settings?.defaultModel.provider === p.id;

              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{def?.name ?? p.id}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{p.apiKey || "(no key)"}</div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {isDefault ? (
                        <div className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                          <ShieldCheck className="h-3.5 w-3.5" /> Default
                        </div>
                      ) : null}

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-border/60 hover:border-primary/50 text-muted-foreground hover:text-foreground"
                        onClick={() => setManageDialogProvider({ id: p.id, name: def?.name ?? p.id })}
                      >
                        <LibraryBig className="mr-1.5 h-3.5 w-3.5" /> Manage Models
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-dashed border-border bg-card p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4" /> Add provider
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Verify key and save locally.</div>
            </button>
          </div>
        )}
      </SettingsSection>

      {/* ── Manage Models Dialog (outside map to prevent unmount on refresh) ── */}
      {manageDialogProvider && (
        <ManageModelsDialog
          open={!!manageDialogProvider}
          onOpenChange={(v) => { if (!v) setManageDialogProvider(null); }}
          provider={manageDialogProvider.id}
          providerName={manageDialogProvider.name}
          availableModels={customModels}
          onModelsChange={refresh}
        />
      )}

      {/* ── Default Model Dialog ── */}
      <Dialog open={defaultModelOpen} onOpenChange={setDefaultModelOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-muted/20">
            <DialogTitle className="text-lg font-semibold text-foreground tracking-tight">Set Default Model</DialogTitle>
            <div className="text-sm text-muted-foreground">Choose the model used by default for all new chats.</div>
          </DialogHeader>

          <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
            {allEnabledModels.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Connect a provider below to select a default model.
              </div>
            ) : (
              allEnabledModels.map((m) => {
                const isSelected = currentDefault?.provider === m.provider && currentDefault?.model === m.id;
                return (
                  <button
                    key={`${m.provider}::${m.id}`}
                    type="button"
                    disabled={savingDefault}
                    onClick={async () => {
                      if (!isSelected) {
                        await setDefaultModel(m.provider, m.id);
                        setDefaultModelOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{m.provider} / {m.id}</div>
                    </div>
                    {isSelected && (
                      savingDefault
                        ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        : <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-muted/20">
            <DialogTitle className="text-lg font-semibold text-foreground tracking-tight">Add Provider</DialogTitle>
            <div className="text-sm text-muted-foreground">Connect a new API provider to access more models.</div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2.5">
              <Label className="text-sm font-medium text-foreground">Provider</Label>
              <select
                className="h-11 w-full rounded-xl border border-border bg-muted/50 px-3.5 text-sm outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-all appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                value={providerId}
                onChange={(e) => {
                  setProviderId(e.target.value as ProviderId);
                  setApiKey("");
                  setModel("");
                  setError("");
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">API Key</Label>
                <a className="text-xs font-medium text-primary hover:text-primary/80 transition-colors" href={provider.docsUrl} target="_blank" rel="noreferrer">
                  Get your key
                </a>
              </div>
              <Input
                type="password"
                className="h-11 rounded-xl border-border bg-muted/50 px-3.5 text-sm focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
                placeholder={provider.keyPlaceholder}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError(""); }}
              />
            </div>

            <div className="space-y-2.5">
              <Label className="text-sm font-medium text-foreground">Model</Label>
              {"modelMode" in provider && provider.modelMode === "select" ? (
                <select
                  className="h-11 w-full rounded-xl border border-border bg-muted/50 px-3.5 text-sm outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-all appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                  value={model}
                  onChange={(e) => { setModel(e.target.value); setError(""); }}
                >
                  <option value="">Select a model</option>
                  {provider.models.map((m: { id: string; name: string }) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <Input
                  type="text"
                  className="h-11 rounded-xl border-border bg-muted/50 px-3.5 text-sm focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
                  placeholder={"modelPlaceholder" in provider ? (provider as any).modelPlaceholder : "e.g. model-id"}
                  value={model}
                  onChange={(e) => { setModel(e.target.value); setError(""); }}
                />
              )}
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />{error}
              </div>
            ) : null}

            <div className="pt-2 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy} className="h-10 px-4 rounded-full font-medium hover:bg-muted">
                Cancel
              </Button>
              <Button onClick={verifyAndSave} disabled={!apiKey || !model || busy} className="h-10 px-5 rounded-full font-medium gap-2 shadow-md hover:shadow-lg transition-all">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Connect Provider
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}