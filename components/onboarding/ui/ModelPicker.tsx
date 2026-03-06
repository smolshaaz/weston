"use client";

type ProviderDef = {
  name: string;
  modelMode: "select" | "text" | "manage";
  modelPlaceholder?: string;
  modelDocsUrl?: string;
  models?: readonly { id: string; name: string }[];
  suggestedModels?: readonly { id: string; name: string }[];
};

type Props = {
  provider: ProviderDef;
  value: string;
  onChange: (v: string) => void;
};

export function ModelPicker({ provider, value, onChange }: Props) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">Model</label>
        {provider.modelDocsUrl && (
          <a
            href={provider.modelDocsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse models
          </a>
        )}
      </div>

      {provider.modelMode === "manage" ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          You&apos;ll add models after connecting via <strong>Manage Models</strong> in Settings.
        </div>
      ) : provider.modelMode === "text" ? (
        <div className="grid gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={provider.modelPlaceholder ?? "Enter model id"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />

          {(provider.models ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(provider.models ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange(m.id)}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/25 transition-colors"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Type any model id supported by {provider.name}.
          </p>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="" disabled>
            Pick a model
          </option>
          {(provider.models ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}