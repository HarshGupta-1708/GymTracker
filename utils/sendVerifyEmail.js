import { auth } from "../config/firebaseConfig";
import { COACH_API_URL } from "../constants/coach";

const SEND_TIMEOUT_MS = 45000;

/**
 * Auto-send verify email via coach-api (Nodemailer + Gmail App Password).
 * Works on Firebase Spark — no Trigger Email extension needed.
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

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
    : null;

  let response;
  try {
    response = await fetch(`${COACH_API_URL.replace(/\/$/, "")}/send-verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        ...(auth.isDemo ? { "X-Coach-Demo": "demo-user" } : {}),
      },
      body: JSON.stringify({
        to: email,
        name: name || "there",
        verifyUrl,
        hostName: hostName || auth.currentUser?.displayName || "FitTrack user",
      }),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(
        "Email server timed out (Render may be waking up). Wait 30s and retry, or copy the link below.",
      );
    }
    throw new Error(
      e?.message ||
        "Could not reach email server. Check EXPO_PUBLIC_COACH_API_URL / network.",
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Email failed (${response.status})`);
  }
  return { sent: true, via: "coach-api" };
}
