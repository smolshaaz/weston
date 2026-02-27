fetch("http://localhost:3000/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chatId: "test-chat",
    model: "default::default",
    messages: [
      { role: "user", content: "What is 5+5?" },
      { role: "assistant", content: "10" },
      { role: "user", content: "And multiply by 2?" }
    ]
  })
}).then(res => res.text()).then(text => console.log(text)).catch(console.error);
