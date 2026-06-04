import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useEffect, useState, useCallback } from "react";
import { Alert } from "react-native";
import { auth } from "../config/firebaseConfig";

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Configure native Google Sign-in on Android
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const signIn = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Ensure Google Play Services are available
      await GoogleSignin.hasPlayServices();
      
      // Open the native Google Sign-In prompt
      const response = await GoogleSignin.signIn();
      
      // Access the idToken from response.data (or fallback to response.idToken)
      const idToken = response.data?.idToken || response.idToken;
      if (!idToken) {
        throw new Error("No ID token was returned by Google Sign-In.");
      }

      // Create a Google credential with the token and sign in to Firebase
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      
    } catch (err) {
      console.error("Android Native Google Sign-In Error:", err);
      let errorMsg = "Google Sign-In failed.";
      
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMsg = "Sign-in was cancelled.";
      } else if (err.code === statusCodes.IN_PROGRESS) {
        errorMsg = "Sign-in is already in progress.";
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMsg = "Google Play Services are not available or outdated.";
      } else {
        errorMsg = err.message || "An unexpected error occurred.";
      }
      
      setError(errorMsg);
      Alert.alert("Sign-In Error", errorMsg);
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
