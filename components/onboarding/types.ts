import type { ProviderId } from "@/lib/constants";

export type OnboardingStep = "welcome" | "provider" | "identity" | "done";

export interface VerifiedProvider {
  id: ProviderId;
  name: string;
  apiKey: string;
  model: string;
}