import { useCallback, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "../config/firebaseConfig";

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

/**
 * Web: popup sign-in when allowed; redirect fallback if popup is blocked.
 * Redirect completion runs in App.js via getRedirectResult on page load.
 */
export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setErrorState = useCallback((msg) => {
    setError(msg);
  }, []);

  const signIn = useCallback(async () => {
    let redirecting = false;
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
          console.info("[GymTracker Auth] Popup blocked — using redirect");
          await signInWithRedirect(auth, provider);
          redirecting = true;
          return;
        }
        throw popupErr;
      }
    } catch (err) {
      console.error("[GymTracker Auth] Sign-in failed:", err?.code, err?.message);
      if (err?.code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled.");
      } else if (err?.code === "auth/unauthorized-domain") {
        setError(unauthorizedMessage());
      } else {
        setError(err?.message || "Google Sign-In failed.");
      }
    } finally {
      if (!redirecting) setLoading(false);
    }
  }, []);

  return {
    signIn,
    loading,
    error,
    setError: setErrorState,
  };
}
