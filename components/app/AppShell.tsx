"use client";

import type { ReactNode } from "react";

import { Sidebar } from "@/components/app/Sidebar";

type Props = {
  children: ReactNode;
};

export function AppShell({ children }: Props) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">{children}</div>
    </div>
  );
}