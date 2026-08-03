import { auth } from "../config/firebaseConfig";
import { COACH_API_URL } from "../constants/coach";

const SEND_TIMEOUT_MS = 60000;

async function wakeCoachApi(base) {
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 55000) : null;
    await fetch(`${base}/health`, {
      method: "GET",
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (timer) clearTimeout(timer);
  } catch {
    /* cold start may still succeed on the next request */
  }
}

async function postSend(base, idToken, body) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), SEND_TIMEOUT_MS) : null;
  try {
    const response = await fetch(`${base}/send-verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        ...(auth.isDemo ? { "X-Coach-Demo": "demo-user" } : {}),
      },
      body: JSON.stringify(body),
      ...(controller ? { signal: controller.signal } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Email failed (${response.status})`);
    }
    return { sent: true, via: "coach-api" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Auto-send verify email via coach-api.
 * Render free blocks SMTP — coach-api should use Resend/SendGrid (HTTPS).
 */
export async function sendVerifyEmail({ to, name, verifyUrl, hostName }) {
  const email = String(to || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Valid email required");
  if (!verifyUrl) throw new Error("Missing verify link");
  if (!COACH_API_URL) {
    throw new Error("Coach API URL not configured (EXPO_PUBLIC_COACH_API_URL)");
  }

  let idToken = null;
  if (auth.currentUser && !auth.isDemo) {
    idToken = await auth.currentUser.getIdToken();
  }
  if (!idToken && !auth.isDemo) {
    throw new Error("Sign in again, then retry sending the verify email.");
  }

  const base = COACH_API_URL.replace(/\/$/, "");
  await wakeCoachApi(base);

  const body = {
    to: email,
    name: name || "there",
    verifyUrl,
    hostName: hostName || auth.currentUser?.displayName || "FitTrack user",
  };

  try {
    return await postSend(base, idToken, body);
  } catch (e) {
    if (e?.name === "AbortError") {
      // One retry after wake — free Render cold starts are slow.
      try {
        await wakeCoachApi(base);
        return await postSend(base, idToken, body);
      } catch (e2) {
        if (e2?.name === "AbortError") {
          throw new Error(
            "Email server timed out. On Render free tier, Gmail SMTP is blocked — add RESEND_API_KEY or SENDGRID_API_KEY, redeploy, then retry. Or copy the link below.",
          );
        }
        throw e2;
      }
    }
    throw e instanceof Error
      ? e
      : new Error(e?.message || "Could not reach email server.");
  }
}
