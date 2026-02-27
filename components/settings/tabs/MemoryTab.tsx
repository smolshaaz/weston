"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MemoryTab() {
  const [identity, setIdentity] = useState("");
  const [soul, setSoul] = useState("");
  const [isIdentityLoading, setIsIdentityLoading] = useState(true);
  const [isSoulLoading, setIsSoulLoading] = useState(true);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingSoul, setSavingSoul] = useState(false);

  useEffect(() => {
    fetch("/api/memory")
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setIdentity(data.data.identity || "");
          setSoul(data.data.soul || "");
        }
      })
      .catch(console.error)
      .finally(() => {
        setIsIdentityLoading(false);
        setIsSoulLoading(false);
      });
  }, []);

  const handleSave = async (type: "identity" | "soul") => {
    const isEditingIdentity = type === "identity";
    if (isEditingIdentity) setSavingIdentity(true);
    else setSavingSoul(true);

    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content: isEditingIdentity ? identity : soul }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert("Failed to save memory: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save memory.");
    } finally {
      if (isEditingIdentity) setSavingIdentity(false);
      else setSavingSoul(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Introduction */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-6 flex items-start gap-4">
        <div className="bg-primary/20 p-3 rounded-lg text-primary shrink-0 mt-1">
          <BrainCircuit className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Memory Control Center</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            Weston constantly learns about you from your chats. The underlying raw Markdown files are exposed below. You can freely edit, delete, or correct any facts or directives. Click save to instantly update Weston's global context window.
          </p>
        </div>
      </div>

      {/* Identity Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">Core Identity <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md hidden sm:inline-block">~/.weston/identity.md</span></h3>
            <p className="text-xs text-muted-foreground mt-0.5">Facts, preferences, and details Weston has learned about you.</p>
          </div>
          <Button 
            size="sm" 
            onClick={() => handleSave("identity")} 
            disabled={isIdentityLoading || savingIdentity}
            className="h-8 gap-1.5 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
          >
            {savingIdentity ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
        <div className="relative group">
          {isIdentityLoading && (
            <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl border border-border">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          <textarea
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            disabled={isIdentityLoading}
            spellCheck={false}
            className="w-full h-64 p-4 font-mono text-sm bg-muted/30 border border-border/60 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all outline-none resize-y text-foreground/90 placeholder:text-muted-foreground/50"
            placeholder="Loading identity.md..."
          />
        </div>
      </div>

      {/* Soul Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">System Directives <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md hidden sm:inline-block">~/.weston/soul.md</span></h3>
            <p className="text-xs text-muted-foreground mt-0.5">Global behavioral rules and core operating persona instructions.</p>
          </div>
          <Button 
            size="sm" 
            onClick={() => handleSave("soul")} 
            disabled={isSoulLoading || savingSoul}
            className="h-8 gap-1.5 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
          >
            {savingSoul ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
        <div className="relative group">
          {isSoulLoading && (
            <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl border border-border">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          <textarea
            value={soul}
            onChange={(e) => setSoul(e.target.value)}
            disabled={isSoulLoading}
            spellCheck={false}
            className="w-full h-80 p-4 font-mono text-[13px] bg-muted/30 border border-border/60 rounded-xl focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all outline-none resize-y text-foreground/90 placeholder:text-muted-foreground/50 leading-relaxed"
            placeholder="Loading soul.md..."
          />
        </div>
      </div>

      <div className="h-12" />
    </div>
  );
}
