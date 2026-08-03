import { useCallback, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "../config/firebaseConfig";
import { signInWithGoogleIdentity } from "../utils/googleIdentity.web";

function currentHost() {
  if (typeof window === "undefined") return "";
  return window.location.hostname;
}

function unauthorizedMessage() {
  const host = currentHost();
  return host
    ? `Add "${host}" in Firebase → Authentication → Settings → Authorized domains.`
    : "This domain is not authorized in Firebase.";
}

function mapAuthError(err) {
  const code = err?.code || "";
  const message = String(err?.message || "");

  if (code === "auth/popup-closed-by-user") {
    return "Sign-in was cancelled.";
  }
  if (code === "auth/unauthorized-domain") {
    return unauthorizedMessage();
  }
  if (code === "auth/popup-blocked" || /popup/i.test(message)) {
    return "Popup blocked. Allow popups for this site, or use the Google button on the next step.";
  }
  if (
    message.includes("access_denied") ||
    message.includes("org_internal") ||
    code === "auth/operation-not-allowed"
  ) {
    return (
      "This Google account cannot sign in yet. In Google Cloud Console → OAuth consent screen, " +
      "add the account under Test users, or set Publishing status to In production."
    );
  }
  return message || "Google Sign-In failed.";
}

function shouldUseFallback(err) {
  const code = err?.code || "";
  const message = String(err?.message || "");
  return (
    code === "auth/popup-blocked" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/popup-timeout" ||
    /Cross-Origin-Opener-Policy|COOP|timed out|popup/i.test(message)
  );
}

function withTimeout(promise, ms, code = "auth/popup-timeout") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(
        "Google Sign-In timed out. Allow popups for this site and try again.",
      );
      err.code = code;
      reject(err);
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Web: Firebase popup → visible Google button → full-page redirect.
 * Brave + Chrome with the same Google account often blocks the first popup.
 */
export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setErrorState = useCallback((msg) => {
    setError(msg);
  }, []);

  const signIn = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        const result = await withTimeout(signInWithPopup(auth, provider), 45000);
        console.info(
          "[GymTracker Auth] Popup sign-in:",
          result.user.email || result.user.uid,
        );
        return;
      } catch (popupErr) {
        if (!shouldUseFallback(popupErr)) throw popupErr;
        console.info(
          "[GymTracker Auth] Popup issue — trying Google button:",
          popupErr?.code || popupErr?.message,
        );
      }

      try {
        await signInWithGoogleIdentity();
        return;
      } catch (gisErr) {
        if (gisErr?.code === "auth/popup-closed-by-user") throw gisErr;
        console.info(
          "[GymTracker Auth] GIS failed — redirecting:",
          gisErr?.code || gisErr?.message,
        );
      }

      // Full redirect; App.js completes via getRedirectResult.
      await signInWithRedirect(auth, provider);
    } catch (err) {
      console.error("[GymTracker Auth] Sign-in failed:", err?.code, err?.message);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    signIn,
    loading,
    error,
    setError: setErrorState,
  };
}
