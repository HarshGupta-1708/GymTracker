import { useCallback, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "../config/firebaseConfig";

function currentHost() {
  if (typeof window === "undefined") return "";
  return window.location.hostname;
}

/**
 * Web: Firebase redirect sign-in (no popup blockers, no OAuth redirect_uri setup).
 */
export function useGoogleSignIn() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const setErrorState = useCallback((msg) => {
    setError(msg);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRedirectResult(auth)
      .catch((err) => {
        if (cancelled) return;
        console.error("Google Sign-In redirect failed:", err);
        if (err?.code === "auth/unauthorized-domain") {
          const host = currentHost();
          setError(
            host
              ? `Add "${host}" in Firebase → Authentication → Settings → Authorized domains.`
              : "This domain is not authorized in Firebase.",
          );
        } else if (err?.code !== "auth/popup-closed-by-user") {
          setError(err?.message || "Google Sign-In failed.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithRedirect(auth, provider);
    } catch (err) {
      console.error("Google Sign-In (web) failed:", err);
      if (err?.code === "auth/unauthorized-domain") {
        const host = currentHost();
        setError(
          host
            ? `Add "${host}" in Firebase → Authentication → Settings → Authorized domains.`
            : "This domain is not authorized in Firebase.",
        );
      } else {
        setError(err?.message || "Google Sign-In failed.");
      }
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
