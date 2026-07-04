require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { verifyRequestAuth } = require("./src/auth");
const { buildSystemPrompt, buildUserPrompt } = require("./src/prompts");
const { callGroq } = require("./src/groq");
const { checkRateLimit, getUsageStats } = require("./src/rateLimit");

const app = express();
const PORT = process.env.PORT || 3001;
const DAILY_LIMIT = parseInt(process.env.COACH_DAILY_LIMIT || "20", 10);

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "gymtracker-coach-api",
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    firebaseConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    dailyLimit: DAILY_LIMIT,
  });
});

app.post("/ask", async (req, res) => {
  try {
    const authResult = await verifyRequestAuth(req);
    if (!authResult.ok) {
      return res.status(401).json({ error: authResult.error, fallbackLocal: true });
    }

    const { uid } = authResult;
    const rate = checkRateLimit(uid, DAILY_LIMIT);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Daily limit reached (${DAILY_LIMIT}/day on free plan).`,
        fallbackLocal: true,
      });
    }

    const { message, history = [], context = {} } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: "GROQ_API_KEY not configured on server",
        fallbackLocal: true,
      });
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      message: String(message).trim(),
      context,
      history,
      uid,
    });

    const ai = await callGroq({ systemPrompt, userPrompt, history });

    res.json({
      reply: ai.reply,
      source: "groq",
      model: ai.model,
      usage: getUsageStats(uid),
    });
  } catch (err) {
    console.error("Coach /ask error:", err);
    res.status(500).json({
      error: err.message || "Coach failed",
      fallbackLocal: true,
    });
  }
});

app.listen(PORT, () => {
  console.log(`GymTracker Coach API listening on port ${PORT}`);
});
