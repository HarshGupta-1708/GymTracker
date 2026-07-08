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

// --- Keep-alive self ping ---
// Free tiers (Render/other) spin the server down after ~15 min without
// inbound traffic, causing 30-60s cold starts. Pinging our own public URL
// counts as inbound traffic and keeps the instance warm.
// Render sets RENDER_EXTERNAL_URL automatically; on other hosts set
// KEEP_ALIVE_URL. Disable with KEEP_ALIVE=false.
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;
if (KEEP_ALIVE_URL && process.env.KEEP_ALIVE !== "false") {
  const target = `${KEEP_ALIVE_URL.replace(/\/$/, "")}/health`;
  console.log(`Keep-alive enabled: pinging ${target} every ${KEEP_ALIVE_INTERVAL_MS / 60000} min`);
  const timer = setInterval(() => {
    fetch(target).catch(() => {});
  }, KEEP_ALIVE_INTERVAL_MS);
  timer.unref?.();
}
