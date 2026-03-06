import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const openrouter = createOpenRouter({ apiKey: "test" });
const model = openrouter("invalid/model");

try {
  await generateText({ model, prompt: "test" });
} catch (e) {
  console.log("Error Name:", e.name);
  console.log("Message:", e.message);
}
