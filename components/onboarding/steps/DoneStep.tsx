"use client";

export function DoneStep() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <div className="text-3xl">✅</div>
      <h2 className="mt-3 text-xl font-semibold text-card-foreground">Setup complete</h2>
      <p className="mt-2 text-sm text-muted-foreground">Opening Weston…</p>
    </div>
  );
}