"use client";

import { useState } from "react";

type Props = {
  userName: string;
  userAbout: string;
  onChangeName: (v: string) => void;
  onChangeAbout: (v: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => Promise<void>;
  canFinish: boolean;
};

export function IdentityStep({
  userName,
  userAbout,
  onChangeName,
  onChangeAbout,
  onBack,
  onSkip,
  onFinish,
  canFinish,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function finish() {
    setSaving(true);
    setError("");

    try {
      await onFinish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finish setup");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-card-foreground">Your identity</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Optional, but useful for study mode later. You can change it anytime
            in Settings.
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

      <div className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm text-muted-foreground">Name</label>
          <input
            value={userName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="What should Weston call you?"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm text-muted-foreground">About (optional)</label>
          <textarea
            value={userAbout}
            onChange={(e) => onChangeAbout(e.target.value)}
            placeholder="e.g. I'm studying X. I learn best with analogies."
            className="h-28 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

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
          onClick={finish}
          disabled={!canFinish || saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving…" : "Finish setup →"}
        </button>
      </div>
    </div>
  );
}