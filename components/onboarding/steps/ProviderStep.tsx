"use client";

import { useMemo, useState } from "react";

import type { ProviderId } from "@/lib/constants";
import type { VerifiedProvider } from "@/components/onboarding/types";
import { ConnectedProviders } from "@/components/onboarding/ui/ConnectedProviders";
import { ModelPicker } from "@/components/onboarding/ui/ModelPicker";

type ProviderDef = {
  id: ProviderId;
  name: string;
  docsUrl: string;
  keyPlaceholder: string;
  modelMode: "select" | "text";
  modelPlaceholder?: string;
  modelDocsUrl?: string;
  models: readonly { id: string; name: string }[];
};

type Props = {
  providers: readonly ProviderDef[];
  verifiedProviders: VerifiedProvider[];
  onVerified: (input: { id: ProviderId; apiKey: string; model: string }) => Promise<void>;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function ProviderStep({
  providers,
  verifiedProviders,
  onVerified,
  onBack,
  onContinue,
  onSkip,
}: Props) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const provider = useMemo(() => {
    return providers.find((p) => p.id === selectedProvider)!;
  }, [providers, selectedProvider]);

  async function verifyAndAdd() {
    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey,
          model,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data?.error ?? "Verification failed");
      }

      await onVerified({ id: selectedProvider, apiKey, model });

      setApiKey("");
      setModel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-card-foreground">Connect a provider</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Weston uses your key to call the model directly. Keys are stored
            locally (not sent to any Weston server).
          </p>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>

      {verifiedProviders.length > 0 && (
        <div className="mt-5">
          <ConnectedProviders items={verifiedProviders} />
          <p className="mt-2 text-xs text-muted-foreground">
            First connected provider becomes the default. Add more for fallbacks.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm text-muted-foreground">Provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => {
              setSelectedProvider(e.target.value as ProviderId);
              setApiKey("");
              setModel("");
              setError("");
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {verifiedProviders.some((vp) => vp.id === p.id) ? " ✓" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">API Key</label>
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Get key
            </a>
          </div>

          <input
            type="password"
            placeholder={provider.keyPlaceholder}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setError("");
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <ModelPicker provider={provider} value={model} onChange={setModel} />

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          Back
        </button>

        <button
          type="button"
          onClick={verifyAndAdd}
          disabled={!apiKey || !model || verifying}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {verifying ? "Verifying…" : "Verify & add"}
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={verifiedProviders.length === 0}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}