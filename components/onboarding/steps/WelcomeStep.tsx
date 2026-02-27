"use client";

type Props = {
  onNext: () => void;
  onSkip: () => void;
};

export function WelcomeStep({ onNext, onSkip }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-card-foreground">Welcome to Weston</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Local-first knowledge companion. Connect a provider now, or skip and
            set it up later in Settings.
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

      <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
        <li>• Your API keys stay on your machine</li>
        <li>• Later: sources + RAG + citations</li>
        <li>• Weston won't guess when it doesn't know</li>
      </ul>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Get started
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}