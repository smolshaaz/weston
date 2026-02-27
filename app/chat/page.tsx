import { Suspense } from "react";
import { AppShell } from "@/components/app/AppShell";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
        <ChatWorkspace />
      </Suspense>
    </AppShell>
  );
}