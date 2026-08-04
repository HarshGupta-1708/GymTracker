require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { verifyRequestAuth, getAdminAuth, getFirebaseAdmin } = require("./src/auth");
const { buildSystemPrompt, buildUserPrompt } = require("./src/prompts");
const { callGroq } = require("./src/groq");
const { checkRateLimit, getUsageStats } = require("./src/rateLimit");
const { sendProfileVerifyEmail, isMailConfigured, getMailProvider } = require("./src/mail");

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
    mailConfigured: isMailConfigured(),
    mailProvider: getMailProvider(),
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    dailyLimit: DAILY_LIMIT,
  });
});

/**
 * Check whether a Gmail already has a Firebase login and/or a FitTrack invite.
 * Used before linking a shared profile email.
 */
app.post("/check-email", async (req, res) => {
  try {
    const authResult = await verifyRequestAuth(req);
    if (!authResult.ok) {
      return res.status(401).json({ error: authResult.error });
    }

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    let authExists = false;
    let displayName = null;
    const authAdmin = getAdminAuth();
    if (authAdmin) {
      try {
        const user = await authAdmin.getUserByEmail(email);
        authExists = Boolean(user?.uid);
        displayName = user?.displayName || null;
      } catch (e) {
        if (e?.code !== "auth/user-not-found") {
          console.warn("check-email auth lookup:", e.message);
        }
      }
    }

    let invite = null;
    const admin = getFirebaseAdmin();
    if (admin) {
      try {
        const snap = await admin.firestore().collection("profileLinks").doc(email).get();
        if (snap.exists) {
          const d = snap.data() || {};
          invite = {
            hostUid: d.hostUid || null,
            profileId: d.profileId || null,
            name: d.name || null,
            verified: Boolean(d.verified),
            isOwnInvite: d.hostUid === authResult.uid,
          };
        }
      } catch (e) {
        console.warn("check-email invite lookup:", e.message);
      }
    }

    res.json({
      ok: true,
      email,
      authExists,
      displayName,
      invite,
    });
  } catch (err) {
    console.error("check-email error:", err);
    res.status(500).json({ error: err.message || "Lookup failed" });
  }
});

/** Profile invite verify email — Nodemailer + Gmail App Password (Spark-friendly). */
app.post("/send-verify-email", async (req, res) => {
  try {
    const authResult = await verifyRequestAuth(req);
    if (!authResult.ok) {
      return res.status(401).json({ error: authResult.error });
    }

    const { to, name, verifyUrl, hostName } = req.body || {};
    const email = String(to || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid to email is required" });
    }
    if (!verifyUrl || typeof verifyUrl !== "string") {
      return res.status(400).json({ error: "verifyUrl is required" });
    }
    if (!/^https?:\/\//i.test(verifyUrl)) {
      return res.status(400).json({ error: "verifyUrl must be http(s)" });
    }

    await sendProfileVerifyEmail({
      to: email,
      name: String(name || "there").slice(0, 80),
      verifyUrl: String(verifyUrl).slice(0, 2000),
      hostName: String(hostName || "FitTrack user").slice(0, 80),
    });

    res.json({ ok: true, sent: true });
  } catch (err) {
    console.error("send-verify-email error:", err?.code, err?.message);
    const status =
      err.code === "MAIL_NOT_CONFIGURED" ||
      err.code === "MAIL_AUTH_FAILED" ||
      err.code === "MAIL_SMTP_BLOCKED"
        ? 503
        : err.code === "MAIL_BAD_RECIPIENT"
          ? 400
          : 500;
    res.status(status).json({
      error: err.message || "Failed to send email",
      code: err.code || null,
    });
  }
});

/** Invitee confirms verify link — uses Admin SDK so Firestore client rules are not a blocker. */
app.post("/verify-profile-invite", async (req, res) => {
  try {
    const authResult = await verifyRequestAuth(req);
    if (!authResult.ok) {
      return res.status(401).json({ error: authResult.error });
    }

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const token = String(req.body?.token || "").trim();
    if (!email || !email.includes("@") || !token) {
      return res.status(400).json({ error: "email and token are required" });
    }

    const loginEmail = String(authResult.email || "").toLowerCase();
    if (!loginEmail || loginEmail !== email) {
      return res.status(403).json({
        error: `Sign in with Google as ${email} to verify this link.`,
      });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return res.status(503).json({ error: "Firebase Admin not configured on server" });
    }

    const ref = admin.firestore().collection("profileLinks").doc(email);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({
        error: "Invite not found. Ask the host to resend the verify link.",
      });
    }

    const link = snap.data() || {};
    if (link.token !== token) {
      return res.status(400).json({
        error: "This link is outdated. Ask the host to resend a new verify link.",
      });
    }

    await ref.set(
      {
        ...link,
        verified: true,
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Best-effort: mark verified on host profile list
    if (link.hostUid && link.profileId) {
      try {
        const hostRef = admin
          .firestore()
          .collection("users")
          .doc(link.hostUid)
          .collection("settings")
          .doc("athletes");
        const hostSnap = await hostRef.get();
        if (hostSnap.exists) {
          const data = hostSnap.data() || {};
          const items = (data.items || []).map((a) =>
            a.id === link.profileId ? { ...a, emailVerified: true } : a,
          );
          await hostRef.set(
            { ...data, items, updatedAt: new Date().toISOString() },
            { merge: true },
          );
        }
      } catch (e) {
        console.warn("verify-profile-invite host list update:", e.message);
      }
    }

    res.json({
      ok: true,
      name: link.name || "Profile",
      email,
      hostUid: link.hostUid || null,
      profileId: link.profileId || null,
    });
  } catch (err) {
    console.error("verify-profile-invite error:", err);
    res.status(500).json({ error: err.message || "Verification failed" });
  }
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
