import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SettingsSection({ title, description, children }: Props) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base text-card-foreground">{title}</CardTitle>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}