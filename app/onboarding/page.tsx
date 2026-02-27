import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const runtime = "nodejs";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <OnboardingFlow />
    </main>
  );
}