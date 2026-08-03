import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { GOOGLE_WEB_CLIENT_ID } from "../constants/googleAuth";

const GSI_SCRIPT = "https://accounts.google.com/gsi/client";

let scriptPromise;

function loadGsiScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Sign-In is only available in a browser."));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="' + GSI_SCRIPT + '"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In.")));
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Visible Google button overlay — Brave/Chrome often block hidden auto-clicks
 * and Firebase popups when another browser already has the same Google session.
 */
export async function signInWithGoogleIdentity() {
  await loadGsiScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    let overlay;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      overlay?.remove();
      fn(value);
    };

    overlay = document.createElement("div");
    overlay.setAttribute("data-fittrack-gsi", "1");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483646",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(0,0,0,0.55)",
      "padding:24px",
      "box-sizing:border-box",
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "background:#111",
      "color:#fff",
      "border-radius:16px",
      "padding:24px",
      "max-width:360px",
      "width:100%",
      "font-family:system-ui,-apple-system,sans-serif",
      "box-shadow:0 12px 40px rgba(0,0,0,0.45)",
      "text-align:center",
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "Continue with Google";
    title.style.cssText = "font-size:18px;font-weight:700;margin-bottom:8px;";

    const hint = document.createElement("div");
    hint.textContent =
      "Tap the Google button below. If nothing opens, allow popups/cookies for this site (Brave Shields can block sign-in).";
    hint.style.cssText =
      "font-size:13px;line-height:1.4;opacity:0.85;margin-bottom:16px;text-align:left;";

    const btnHost = document.createElement("div");
    btnHost.style.cssText = "display:flex;justify-content:center;min-height:44px;";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.style.cssText = [
      "margin-top:16px",
      "background:transparent",
      "border:1px solid rgba(255,255,255,0.25)",
      "color:#fff",
      "border-radius:10px",
      "padding:10px 16px",
      "cursor:pointer",
      "width:100%",
      "font-size:14px",
    ].join(";");
    cancel.onclick = () => {
      finish(reject, Object.assign(new Error("Sign-in was cancelled."), { code: "auth/popup-closed-by-user" }));
    };

    card.appendChild(title);
    card.appendChild(hint);
    card.appendChild(btnHost);
    card.appendChild(cancel);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const timer = setTimeout(() => {
      finish(
        reject,
        new Error(
          "Google Sign-In timed out. Allow popups and third-party cookies for this site (in Brave: Shields → allow cookies), then try again.",
        ),
      );
    }, 90000);

    window.google.accounts.id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      callback: async (response) => {
        try {
          if (!response?.credential) {
            throw new Error("Google did not return a sign-in token.");
          }
          const credential = GoogleAuthProvider.credential(response.credential);
          const result = await signInWithCredential(auth, credential);
          console.info(
            "[GymTracker Auth] GIS sign-in:",
            result.user.email || result.user.uid,
          );
          finish(resolve, result);
        } catch (err) {
          finish(reject, err);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: false,
    });

    window.google.accounts.id.renderButton(btnHost, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      width: 280,
    });
  });
}
