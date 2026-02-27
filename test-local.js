fetch("http://localhost:3000/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chatId: "test-chat2",
    model: "openrouter::google/gemini-2.0-flash-exp:free",
    messages: [
      { role: "user", content: "What is 5+5?" },
      { role: "assistant", content: "10" },
      { role: "user", content: "And multiply by 2?" }
    ]
  })
}).then(res=>res.text()).then(t=>console.log(t)).catch(console.log);
