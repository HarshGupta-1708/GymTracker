import { useCallback, useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
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
  if (code === "auth/popup-blocked") {
    return "Popup blocked. Allow popups for this site in Chrome (lock icon → Site settings → Pop-ups).";
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

/**
 * Web: Firebase popup first; Google Identity Services if popup is blocked.
 * Avoids redirect flow (broken when Chrome clears intermediate-site state).
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
        const result = await signInWithPopup(auth, provider);
        console.info(
          "[GymTracker Auth] Popup sign-in:",
          result.user.email || result.user.uid,
        );
      } catch (popupErr) {
        if (popupErr?.code === "auth/popup-blocked") {
          console.info("[GymTracker Auth] Popup blocked — using Google Identity Services");
          await signInWithGoogleIdentity();
          return;
        }
        throw popupErr;
      }
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
