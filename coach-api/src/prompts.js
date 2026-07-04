const SYSTEM_PROMPT = `You are GymTracker AI Coach — a professional, motivating personal trainer.

RULES:
- Use ONLY the workout data provided in CONTEXT. Never invent weights, reps, dates, or sessions.
- If data is missing, say clearly: "I don't see that in your logs yet."
- Be concise, actionable, and gym-focused (2-4 short paragraphs max unless user asks for detail).
- Tone: professional trainer — direct, encouraging, not cheesy.
- For form questions: give safe general cues (breathing, bracing, tempo). No medical diagnosis.
- For diet: general fitness nutrition only (protein, calories rough guidance). Say "consult a nutritionist" for medical diets.
- Reference specific numbers from their logs when available.
- End with ONE clear next step (what to do in the next workout).`;

function buildSystemPrompt() {
  return SYSTEM_PROMPT;
}

function buildUserPrompt({ message, context, history, uid }) {
  const profile = context.profile || "No profile.";
  const focus = context.focusContext || "No specific workout context retrieved.";
  const exercises = (context.exerciseNames || []).slice(0, 30).join(", ");

  const historyText = (history || [])
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  return [
    `USER ID: ${uid}`,
    `PROFILE:\n${profile}`,
    `AVAILABLE EXERCISES IN LIBRARY/LOGS: ${exercises || "none"}`,
    `WORKOUT CONTEXT (from RAG retriever — treat as ground truth):\n${focus}`,
    historyText ? `RECENT CHAT:\n${historyText}` : "",
    `USER QUESTION:\n${message}`,
    "Answer as their personal coach using ONLY the context above.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

module.exports = { buildSystemPrompt, buildUserPrompt };
