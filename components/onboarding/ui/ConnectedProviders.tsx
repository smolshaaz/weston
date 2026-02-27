"use client";

import type { VerifiedProvider } from "@/components/onboarding/types";

type Props = {
  items: VerifiedProvider[];
};

export function ConnectedProviders({ items }: Props) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Connected providers
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((p) => (
          <div
            key={p.id}
            className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary"
            title={`${p.id}`}
          >
            {p.name} — {p.model}
          </div>
        ))}
      </div>
    </div>
  );
}