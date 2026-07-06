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
    const existing = document.querySelector(`script[src="${GSI_SCRIPT}"]`);
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
 * Google Identity Services fallback when Firebase popup is blocked.
 * Uses Google's own button (hidden) to obtain an ID token, then Firebase credential sign-in.
 */
export async function signInWithGoogleIdentity() {
  await loadGsiScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      container?.remove();
      fn(value);
    };

    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(container);

    const timer = setTimeout(() => {
      finish(
        reject,
        new Error(
          "Google Sign-In timed out. Allow popups for this site and try again.",
        ),
      );
    }, 120000);

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
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
    });

    requestAnimationFrame(() => {
      const btn =
        container.querySelector('div[role="button"]') ||
        container.querySelector("iframe");
      if (btn) {
        btn.click?.();
      } else {
        finish(
          reject,
          new Error("Could not open Google Sign-In. Allow popups and retry."),
        );
      }
    });
  });
}
