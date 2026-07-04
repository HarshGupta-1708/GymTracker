import { auth } from "../config/firebaseConfig";
import { COACH_API_URL, COACH_DAILY_LIMIT } from "../constants/coach";
import { buildCoachContext, buildLocalCoachReply } from "./coachRetriever";
import { getDailyQuestionCount, incrementDailyQuestionCount } from "./coachChat";

export async function askCoach({
  message,
  quickPromptId = null,
  history = [],
  workouts = {},
  exercises = [],
  settings = {},
}) {
  const trimmed = String(message || "").trim();
  if (!trimmed && !quickPromptId) {
    throw new Error("Please enter a question.");
  }

  const used = await getDailyQuestionCount();
  if (used >= COACH_DAILY_LIMIT) {
    throw new Error(`Daily limit reached (${COACH_DAILY_LIMIT} questions). Try again tomorrow.`);
  }

  const contextBundle = buildCoachContext({
    message: trimmed,
    quickPromptId,
    workouts,
    exercises,
    settings,
  });

  const userMessage =
    trimmed ||
    {
      deadlift_progress: "What is my deadlift progression in the last month?",
      this_week: "How am I doing this week?",
      train_today: "What should I train today?",
      recent_prs: "What are my recent personal records?",
      overall_progress: "Summarize my overall gym progress.",
    }[quickPromptId] ||
    "Help me with my training.";

  if (!COACH_API_URL) {
    await incrementDailyQuestionCount();
    return {
      reply: buildLocalCoachReply(contextBundle, userMessage),
      source: "local",
      contextBundle,
    };
  }

  let idToken = null;
  if (auth.currentUser && !auth.isDemo) {
    idToken = await auth.currentUser.getIdToken();
  }

  const response = await fetch(`${COACH_API_URL.replace(/\/$/, "")}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...(auth.isDemo ? { "X-Coach-Demo": "demo-user" } : {}),
    },
    body: JSON.stringify({
      message: userMessage,
      quickPromptId,
      history: history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      context: contextBundle,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (data.fallbackLocal) {
      await incrementDailyQuestionCount();
      return {
        reply: buildLocalCoachReply(contextBundle, userMessage),
        source: "local-fallback",
        contextBundle,
      };
    }
    throw new Error(data.error || `Coach API error (${response.status})`);
  }

  await incrementDailyQuestionCount();
  return {
    reply: data.reply,
    source: data.source || "groq",
    model: data.model,
    contextBundle,
  };
}

export async function checkCoachApiHealth() {
  if (!COACH_API_URL) return { ok: true, mode: "local" };
  try {
    const res = await fetch(`${COACH_API_URL.replace(/\/$/, "")}/health`, {
      method: "GET",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, ...data };
  } catch {
    return { ok: false, mode: "offline" };
  }
}
