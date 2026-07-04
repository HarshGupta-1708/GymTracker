import Constants from "expo-constants";
import { useCallback } from "react";
import { useGoogleSignInNative } from "./useGoogleSignInNative";
import { useGoogleSignInWeb } from "./useGoogleSignInWeb";

// Expo Go does not include @react-native-google-signin — use browser OAuth instead.
const isExpoGo = Constants.appOwnership === "expo";

export function useGoogleSignIn() {
  const useNative = !isExpoGo;
  const web = useGoogleSignInWeb({ enabled: !useNative });
  const native = useGoogleSignInNative({ enabled: useNative });

  const signIn = useCallback(async () => {
    if (useNative && native.nativeReady) {
      const handled = await native.signIn();
      if (handled) return;
    }
    await web.signIn();
  }, [useNative, native, web]);

  if (useNative && native.nativeReady) {
    return {
      signIn,
      loading: native.loading,
      error: native.error,
      setError: native.setError,
    };
  }

  return {
    signIn,
    loading: web.loading,
    error: web.error,
    setError: web.setError,
  };
}
