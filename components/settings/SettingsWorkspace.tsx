"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, KeyRound, User } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ProvidersTab } from "@/components/settings/tabs/ProvidersTab";
import { PersonalizationTab } from "@/components/settings/tabs/PersonalizationTab";
import { MemoryTab } from "@/components/settings/tabs/MemoryTab";
import { BrainCircuit } from "lucide-react";

type TabId = "providers" | "personalization" | "memory";

const TABS: { id: TabId; label: string; icon: React.ElementType; description: string }[] = [
  { id: "providers", label: "API Providers", icon: KeyRound, description: "Connect providers & models" },
  { id: "personalization", label: "Personalization", icon: User, description: "Make Weston talk your way" },
  { id: "memory", label: "Memory", icon: BrainCircuit, description: "Manage identity & directives" },
];

export function SettingsWorkspace() {
  const [tab, setTab] = useState<TabId>("providers");

  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-background/60 backdrop-blur-sm">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Link href="/chat">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-base font-semibold text-foreground tracking-tight">Settings</h1>
              <p className="text-xs text-muted-foreground">
                Local config stored in <code className="text-primary/80">~/.weston</code>
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" asChild className="text-xs border-border">
            <Link href="/onboarding">Re-run onboarding</Link>
          </Button>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1 px-8 pb-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-8">
          <div className="mx-auto max-w-3xl">
            {/* Section heading */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">{activeTab.description}</h2>
            </div>
            {tab === "providers" && <ProvidersTab />}
            {tab === "personalization" && <PersonalizationTab />}
            {tab === "memory" && <MemoryTab />}
          </div>
        </div>
      </main>
    </div>
  );
}