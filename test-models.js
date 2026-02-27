const { generateText } = require("ai");
const { createOpenRouter } = require("@openrouter/ai-sdk-provider");
const fs = require("fs");

const settings = JSON.parse(fs.readFileSync("/Users/mohammadshazan/.weston/settings.json", "utf-8"));
const apiKey = settings.providers.find(p=>p.id==="openrouter").apiKey;

const openrouter = createOpenRouter({ apiKey });

const models = [
  "openai/gpt-oss-120b:free",
  "arcee-ai/trinity-large-preview:free",
  "stepfun/step-3.5-flash:free",
  "z-ai/glm-4.5-air:free"
];

async function testModels() {
  for (const modelId of models) {
    console.log(`\nTesting: ${modelId}`);
    try {
      const res = await generateText({
        model: openrouter(modelId),
        messages: [
          { role: "user", content: "Reply with the word 'SUCCESS' and nothing else." }
        ]
      });
      console.log(`[OK] Response: ${res.text}`);
    } catch (err) {
      console.log(`[ERROR] ${err.message}`);
    }
  }
}
testModels();
