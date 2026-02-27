const { generateText } = require("ai");
const { createOpenAI } = require("@ai-sdk/openai");

const openrouter = createOpenAI({
  apiKey: require("./lib/fs").readSettings().providers.find(p=>p.id==="openrouter").apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

async function main() {
  try {
    const res = await generateText({
      model: openrouter("google/gemini-2.0-flash-exp:free"),
      system: "You are a helpful assistant.",
      messages: [
        { role: "user", content: "What is 5+5?" },
        { role: "assistant", content: "10" },
        { role: "user", content: "And multiply by 2?" }
      ]
    });
    console.log(res.text);
  } catch (err) {
    console.error("SDK Error details:");
    console.error(err);
    if (err.cause) console.error("Cause:", err.cause);
  }
}
main();
