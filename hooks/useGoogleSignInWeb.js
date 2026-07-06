import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { auth } from "../config/firebaseConfig";
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "../constants/googleAuth";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignInWeb({ enabled = true } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const redirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: "gymtracker",
        path: "oauthredirect",
      }),
    [],
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (__DEV__ && enabled && Platform.OS === "web") {
      console.log("[Auth] Web OAuth redirect URI:", redirectUri);
    }
  }, [redirectUri, enabled]);

  const signIn = useCallback(async () => {
    if (!enabled) return;
    try {
      setError(null);
      setLoading(true);
      const result = await promptAsync();
      if (result?.type === "dismiss" || result?.type === "cancel") {
        setLoading(false);
      } else if (result?.type !== "success") {
        setLoading(false);
      }
    } catch (err) {
      console.error("Google Sign-In (browser) failed to start:", err);
      setError("Failed to start Google Sign-In. Please try again.");
      setLoading(false);
    }
  }, [enabled, promptAsync]);

  useEffect(() => {
    if (!enabled || !response) return;

    if (response.type === "success") {
      const { id_token } = response.params;
      if (id_token) {
        setLoading(true);
        const credential = GoogleAuthProvider.credential(id_token);
        signInWithCredential(auth, credential)
          .catch((err) => {
            console.error("Firebase Sign-In failed:", err);
            setError(err?.message || "Firebase Sign-In failed.");
          })
          .finally(() => setLoading(false));
      } else {
        setError("Sign-in succeeded but no token was received. Please try again.");
        setLoading(false);
      }
    } else if (response.type === "error") {
      setError(response.error?.message || "Google Sign-in failed.");
      setLoading(false);
    } else if (response.type === "cancel" || response.type === "dismiss") {
      setLoading(false);
    }
  }, [enabled, response]);

  return {
    signIn,
    loading: enabled ? loading || !request : false,
    error: enabled ? error : null,
    setError,
  };
}
