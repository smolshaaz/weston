"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PROVIDERS } from "@/lib/constants";
import type { ProviderId } from "@/lib/constants";
import type { OnboardingStep, VerifiedProvider } from "@/components/onboarding/types";

import { WelcomeStep } from "@/components/onboarding/steps/WelcomeStep";
import { ProviderStep } from "@/components/onboarding/steps/ProviderStep";
import { IdentityStep } from "@/components/onboarding/steps/IdentityStep";
import { DoneStep } from "@/components/onboarding/steps/DoneStep";

export function OnboardingFlow() {
  const router = useRouter();

  const [step, setStep] = useState<OnboardingStep>("welcome");

  const [verifiedProviders, setVerifiedProviders] = useState<VerifiedProvider[]>(
    []
  );

  const [userName, setUserName] = useState("");
  const [userAbout, setUserAbout] = useState("");

  const providerIndex = useMemo(() => {
    const map = new Map<ProviderId, (typeof PROVIDERS)[number]>();
    for (const p of PROVIDERS) map.set(p.id, p);
    return map;
  }, []);

  async function skipSetup() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setupComplete: true,
      }),
    });

    router.push("/chat");
  }

  async function addVerifiedProvider(input: {
    id: ProviderId;
    apiKey: string;
    model: string;
  }) {
    const config = providerIndex.get(input.id);
    if (!config) throw new Error("Unknown provider");

    // Save real key locally (server-side storage).
    const saveRes = await fetch("/api/settings/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: input.id,
        apiKey: input.apiKey,
        enabled: true,
      }),
    });

    if (!saveRes.ok) {
      const data = await saveRes.json().catch(() => ({}));
      throw new Error(data?.error ?? "Failed to save provider key");
    }

    setVerifiedProviders((prev) => {
      const filtered = prev.filter((p) => p.id !== input.id);
      return [
        ...filtered,
        {
          id: input.id,
          name: config.name,
          apiKey: input.apiKey,
          model: input.model,
        },
      ];
    });
  }

  async function finishSetup() {
    if (verifiedProviders.length === 0) {
      throw new Error("No provider connected");
    }

    const primary = verifiedProviders[0];
    const fallbacks = verifiedProviders.slice(1).map((p) => ({
      provider: p.id,
      model: p.model,
    }));

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setupComplete: true,
        userName,
        userAbout,
        defaultModel: { provider: primary.id, model: primary.model },
        fallbackModels: fallbacks,
      }),
    });

    setStep("done");
    setTimeout(() => router.push("/chat"), 900);
  }

  return (
    <div className="w-full max-w-xl">
      {step === "welcome" && (
        <WelcomeStep
          onNext={() => setStep("provider")}
          onSkip={skipSetup}
        />
      )}

      {step === "provider" && (
        <ProviderStep
          verifiedProviders={verifiedProviders}
          providers={PROVIDERS}
          onBack={() => setStep("welcome")}
          onSkip={skipSetup}
          onVerified={addVerifiedProvider}
          onContinue={() => setStep("identity")}
        />
      )}

      {step === "identity" && (
        <IdentityStep
          userName={userName}
          userAbout={userAbout}
          onChangeName={setUserName}
          onChangeAbout={setUserAbout}
          onBack={() => setStep("provider")}
          onSkip={skipSetup}
          onFinish={finishSetup}
          canFinish={verifiedProviders.length > 0}
        />
      )}

      {step === "done" && <DoneStep />}
    </div>
  );
}