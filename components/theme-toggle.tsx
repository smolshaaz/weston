"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-[116px] rounded-lg bg-muted/50 animate-pulse" />;
  }

  return (
    <Tabs value={theme} onValueChange={setTheme} className="h-9">
      <TabsList className="h-full w-[116px] grid grid-cols-3 bg-muted/50 p-1">
        <TabsTrigger value="light" className="h-full px-0" aria-label="Light theme">
          <Sun className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger value="system" className="h-full px-0" aria-label="System theme">
          <Monitor className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger value="dark" className="h-full px-0" aria-label="Dark theme">
          <Moon className="h-4 w-4" />
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
