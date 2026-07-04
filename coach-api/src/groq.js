const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callGroq({ systemPrompt, userPrompt, history = [] }) {
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: userPrompt },
  ];

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || `Groq API error ${response.status}`;
    throw new Error(msg);
  }

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("Empty response from Groq");

  return { reply, model };
}

module.exports = { callGroq };
