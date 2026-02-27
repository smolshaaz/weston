const fs = require("fs");
const settings = JSON.parse(fs.readFileSync("/Users/mohammadshazan/.weston/settings.json", "utf-8"));
const apiKey = settings.providers.find(p=>p.id==="openrouter").apiKey;

async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is 5+5?" },
        { role: "assistant", content: "10" },
        { role: "user", content: "And multiply by 2?" }
      ]
    })
  });
  const data = await res.text();
  console.log("STATUS:", res.status);
  console.log("BODY:", data);
}
main();
