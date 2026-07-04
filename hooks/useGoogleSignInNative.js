import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { Alert, TurboModuleRegistry } from "react-native";
import { auth } from "../config/firebaseConfig";

function hasNativeGoogleSignIn() {
  try {
    return TurboModuleRegistry.get("RNGoogleSignin") != null;
  } catch {
    return false;
  }
}

function loadGoogleSignInModule() {
  if (!hasNativeGoogleSignIn()) return null;
  try {
    return require("@react-native-google-signin/google-signin");
  } catch (err) {
    console.warn("[Auth] Native Google Sign-In module unavailable:", err?.message);
    return null;
  }
}

export function useGoogleSignInNative({ enabled = true } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nativeReady, setNativeReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const mod = loadGoogleSignInModule();
    if (!mod?.GoogleSignin) return;
    try {
      const config = {
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
        offlineAccess: true,
      };
      if (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) {
        config.iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      }
      mod.GoogleSignin.configure(config);
      setNativeReady(true);
    } catch (err) {
      console.warn("[Auth] Native Google Sign-In configure failed:", err?.message);
    }
  }, [enabled]);

  const signIn = useCallback(async () => {
    if (!enabled) return false;

    const mod = loadGoogleSignInModule();
    if (!mod?.GoogleSignin) return false;

    const { GoogleSignin, statusCodes } = mod;

    try {
      setError(null);
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken || response.idToken;
      if (!idToken) {
        throw new Error("No ID token was returned by Google Sign-In.");
      }
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      return true;
    } catch (err) {
      console.error("Native Google Sign-In Error:", err);
      let errorMsg = "Google Sign-In failed.";
      if (err.code === statusCodes?.SIGN_IN_CANCELLED) {
        errorMsg = "Sign-in was cancelled.";
      } else if (err.code === statusCodes?.IN_PROGRESS) {
        errorMsg = "Sign-in is already in progress.";
      } else if (err.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMsg = "Google Play Services are not available or outdated.";
      } else {
        errorMsg = err.message || "An unexpected error occurred.";
      }
      setError(errorMsg);
      Alert.alert("Sign-In Error", errorMsg);
      return true;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  return {
    signIn,
    loading: enabled ? loading : false,
    error: enabled ? error : null,
    setError,
    nativeReady: enabled && nativeReady,
  };
}

