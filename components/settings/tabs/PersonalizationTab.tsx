"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { SettingsSection } from "@/components/settings/ui/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tone = "direct" | "friendly" | "socratic";
type Verbosity = "short" | "balanced" | "detailed";

export function PersonalizationTab() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [userName, setUserName] = useState("");
  const [userAbout, setUserAbout] = useState("");

  // “what will they call us”
  const [assistantName, setAssistantName] = useState("Weston");

  const [tone, setTone] = useState<Tone>("direct");
  const [verbosity, setVerbosity] = useState<Verbosity>("balanced");

  const [defaultStrict, setDefaultStrict] = useState(false);
  const [defaultCitations, setDefaultCitations] = useState(true);

  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings");
    const data = await res.json();

    setUserName(data.userName ?? "");
    setUserAbout(data.userAbout ?? "");

    setAssistantName(data.assistantName ?? "Weston");
    setTone((data.tone as Tone) ?? "direct");
    setVerbosity((data.verbosity as Verbosity) ?? "balanced");

    setDefaultStrict(Boolean(data.defaultStrict ?? false));
    setDefaultCitations(Boolean(data.defaultCitations ?? true));

    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    setMsg("");

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setupComplete: true,
        userName,
        userAbout,
        assistantName,
        tone,
        verbosity,
        defaultStrict,
        defaultCitations,
      }),
    });

    setMsg("Saved.");
    setTimeout(() => setMsg(""), 1500);
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Names"
        description="How Weston addresses you, and what you call the assistant."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Call you</Label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label>You call the assistant</Label>
            <Input
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              placeholder="Weston"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>About you (optional)</Label>
          <Textarea
            value={userAbout}
            onChange={(e) => setUserAbout(e.target.value)}
            placeholder="Learning preferences, context, goals…"
            className="min-h-[110px]"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Behavior"
        description="Defaults. You’ll still be able to override per chat later."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="socratic">Socratic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Verbosity</Label>
            <Select
              value={verbosity}
              onValueChange={(v) => setVerbosity(v as Verbosity)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick verbosity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/20 transition-colors">
          <div>
            <div className="font-medium">Strict mode</div>
            <div className="text-sm text-muted-foreground">
              Refuse when evidence isn’t found.
            </div>
          </div>
          <Switch checked={defaultStrict} onCheckedChange={setDefaultStrict} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/20 transition-colors">
          <div>
            <div className="font-medium">Citations</div>
            <div className="text-sm text-muted-foreground">
              Prefer answers with sources when available.
            </div>
          </div>
          <Switch
            checked={defaultCitations}
            onCheckedChange={setDefaultCitations}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}
          <Button onClick={save} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}