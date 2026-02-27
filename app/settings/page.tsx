import { AppShell } from "@/components/app/AppShell";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";

export const runtime = "nodejs";

export default function SettingsPage() {
  return (
    <>
      <SettingsWorkspace />
    </>
  );
}