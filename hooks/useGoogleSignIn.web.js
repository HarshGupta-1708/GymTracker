import { useCallback, useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../config/firebaseConfig";

/**
 * Web (Vercel / browser): Firebase popup sign-in.
 * Avoids redirect_uri_mismatch from expo-auth-session on custom domains.
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
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Sign-In (web) failed:", err);
      if (err?.code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled.");
      } else if (err?.code === "auth/unauthorized-domain") {
        setError(
          "This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.",
        );
      } else {
        setError(err?.message || "Google Sign-In failed.");
      }
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
