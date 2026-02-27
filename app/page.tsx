import { redirect } from "next/navigation";

import { readSettings } from "@/lib/fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  const settings = readSettings();

  if (!settings.setupComplete) {
    redirect("/onboarding");
  }

  redirect("/chat");
}