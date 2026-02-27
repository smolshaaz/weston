"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";

interface ChatHeaderProps {
  title: string;
}

export function ChatHeader({ title }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background/60 backdrop-blur-sm px-6 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">Chat</div>
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
      </div>

      <div className="flex flex-1 justify-center">
        <TabsList className="grid w-48 grid-cols-2 bg-muted/50">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex flex-1 justify-end">
        <ThemeToggle />
      </div>
    </header>
  );
}
