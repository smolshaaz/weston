const { generateText } = require("ai");
const { createOpenAI } = require("@ai-sdk/openai");
const fs = require("fs");

const settings = JSON.parse(fs.readFileSync("/Users/mohammadshazan/.weston/settings.json", "utf-8"));
const apiKey = settings.providers.find(p=>p.id==="openrouter").apiKey;

const openrouter = createOpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

async function main() {
  try {
    const res = await generateText({
      model: openrouter("anthropic/claude-3-haiku"),
      messages: [
        { role: "system", content: "You are an AI." },
        { role: "user", content: "What is 5+5?" },
        { role: "assistant", content: "10" },
        { role: "user", content: "And multiply by 2?" }
      ]
    });
    console.log("SUCCESS:", res.text);
  } catch (err) {
    console.log("TRUE ERROR:", err?.message || err);
    console.log(JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }
}
main();
