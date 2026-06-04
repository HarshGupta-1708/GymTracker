import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useEffect, useState, useCallback } from "react";
import { auth } from "../config/firebaseConfig";

// Complete any pending auth sessions (required for web redirects)
WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });

  const signIn = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await promptAsync();
      if (result?.type === "dismiss" || result?.type === "cancel") {
        setLoading(false);
        console.log("Web Auth flow ended:", result.type);
      } else if (result?.type !== "success") {
        setLoading(false);
      }
    } catch (err) {
      console.error("Web Google Sign-In failed to start:", err);
      setError("Failed to start Google Sign-In. Please try again.");
      setLoading(false);
    }
  }, [promptAsync]);

  useEffect(() => {
    if (!response) return;

    console.log("Web Google Auth Response type:", response.type);

    if (response.type === "success") {
      const { id_token } = response.params;
      if (id_token) {
        setLoading(true);
        const credential = GoogleAuthProvider.credential(id_token);
        signInWithCredential(auth, credential)
          .catch((err) => {
            console.error("Firebase Sign-In failed on Web:", err);
            setError(err?.message || "Firebase Sign-In failed.");
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        console.error("No id_token in success response:", response.params);
        setError("Sign-in succeeded but no token was received. Please try again.");
        setLoading(false);
      }
    } else if (response.type === "error") {
      console.error("Web Google Auth Error:", response.error);
      setError(response.error?.message || "Google Sign-in failed on Web.");
      setLoading(false);
    } else if (response.type === "cancel" || response.type === "dismiss") {
      setLoading(false);
    }
  }, [response]);

  return {
    signIn,
    loading: loading || !request,
    error,
    setError,
  };
}
