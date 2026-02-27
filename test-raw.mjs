import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import fs from "fs";

const settings = JSON.parse(fs.readFileSync("/Users/mohammadshazan/.weston/settings.json", "utf-8"));
const apiKey = settings.providers.find(p=>p.id==="openrouter").apiKey;

const openrouter = createOpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

async function main() {
  try {
    const res = await generateText({
      model: openrouter("google/gemini-2.0-flash-exp:free"),
      messages: [
        { role: "user", content: "What is 5+5?" },
        { role: "assistant", content: "10" },
        { role: "user", content: "And multiply by 2?" }
      ]
    });
    console.log(res.text);
  } catch (err) {
    console.log("TRUE ERROR:", err.message);
    if (err.cause) {
      console.log("CAUSE:", err.cause);
    }
  }
}
main();
