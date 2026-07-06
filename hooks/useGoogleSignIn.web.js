import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import { auth } from "../config/firebaseConfig";

/**
 * Web (Vercel / browser): Firebase popup — no redirect_uri mismatch.
 * Mobile uses useGoogleSignIn.android.js / .ios.js instead.
 */
export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const signIn = useCallback(async () => {
    if (Platform.OS !== "web") {
      setError("Use the native Google Sign-In flow on mobile.");
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Sign-In (web popup) failed:", err);
      const code = err?.code || "";
      if (code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled.");
      } else if (code === "auth/unauthorized-domain") {
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
    setError,
  };
}
