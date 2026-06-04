import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
    GoogleAuthProvider,
    signInAnonymously,
    signInWithCredential,
} from "firebase/auth";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { auth } from "../config/firebaseConfig";
import { COLORS } from "../constants/data";

const { width } = Dimensions.get("window");

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ onGuestLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [credentialsReady, setCredentialsReady] = useState(false);

  // Validate that required OAuth credentials are configured
  useEffect(() => {
    const validateCredentials = () => {
      const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
      const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      const proxyUri = AuthSession.makeRedirectUri({ useProxy: true });

      // Log configuration status
      console.log("[Auth Config] Validating OAuth credentials...");
      console.log(
        "[Auth Config] Web Client ID:",
        clientId ? "✓ Set" : "✗ Missing",
      );
      console.log(
        "[Auth Config] Android Client ID:",
        androidClientId ? "✓ Set" : "✗ Missing",
      );
      console.log(
        "[Auth Config] iOS Client ID:",
        iosClientId ? "✓ Set" : "✗ Missing",
      );
      console.log("[Auth Config] Platform:", Platform.OS);
      console.log("[Auth Config] Proxy Redirect URI:", proxyUri);

      // For Android, Android Client ID is critical
      if (Platform.OS === "android" && !androidClientId) {
        console.error("[Auth Error] Android Client ID is missing!");
        setError(
          "Google Sign-in not properly configured for Android. Using Guest mode.",
        );
        setCredentialsReady(true);
        return false;
      }

      // For iOS, iOS Client ID is critical
      if (Platform.OS === "ios" && !iosClientId) {
        console.error("[Auth Error] iOS Client ID is missing!");
        setError(
          "Google Sign-in not properly configured for iOS. Using Guest mode.",
        );
        setCredentialsReady(true);
        return false;
      }

      if (!clientId) {
        console.error("[Auth Error] Web Client ID is missing!");
        setError("OAuth credentials not found. Please check your .env file.");
        setCredentialsReady(true);
        return false;
      }

      setCredentialsReady(true);
      return true;
    };

    validateCredentials();
  }, []);

  const loginAsGuest = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[Auth] Attempting anonymous Firebase sign-in...");
      await signInAnonymously(auth);
      console.log("[Auth] Anonymous sign-in successful");
      setLoading(false);
    } catch (err) {
      console.warn(
        "[Auth] Firebase Anonymous Auth failed, falling back to local demo mode:",
        err.message,
      );
      // Fallback to demo mode
      if (typeof onGuestLogin === "function") {
        onGuestLogin();
      } else {
        setError("Guest mode unavailable. Please configure Firebase.");
      }
      setLoading(false);
    }
  };

  // CRITICAL FIX: Explicitly set the redirect URL to use Expo proxy
  const redirectUrl = AuthSession.makeRedirectUri({ useProxy: true });

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    redirectUrl, // CRITICAL: Explicitly pass the proxy redirect URL
  });

  const handleLogin = async () => {
    try {
      // Validate credentials before attempting login
      if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
        Alert.alert(
          "Configuration Error",
          "Google Client ID not found. Please check your .env file.",
        );
        return;
      }

      // Platform-specific validation
      if (
        Platform.OS === "android" &&
        !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
      ) {
        Alert.alert(
          "Android Configuration Missing",
          "Google Android Client ID not configured.\n\n" +
            "Steps to fix:\n" +
            "1. Run: eas credentials -p android\n" +
            "2. Create Android OAuth credential in Google Cloud Console\n" +
            "3. Add EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID to .env\n" +
            "4. Rebuild the app",
        );
        return;
      }

      if (
        Platform.OS === "ios" &&
        !process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ) {
        Alert.alert(
          "iOS Configuration Missing",
          "Google iOS Client ID not configured.\n\n" +
            "Please add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID to your .env file.",
        );
        return;
      }

      if (!request) {
        Alert.alert(
          "Auth Service Not Ready",
          "Google Auth is initializing. Please try again.",
        );
        return;
      }

      setError(null);
      console.log("[Auth] Starting Google Sign-in with Expo proxy redirect...");

      // CRITICAL: useProxy is already set in the hook configuration via redirectUrl
      // Just call promptAsync without parameters
      await promptAsync();
    } catch (e) {
      console.error("[Auth] Login Error:", e);
      const errorMessage = e.message || "Failed to start Google Sign-in";
      setError(errorMessage);
      Alert.alert("Sign-in Error", errorMessage);
    }
  };

  // Log the ACTUAL URI that will be used
  useEffect(() => {
    const proxyRedirect = AuthSession.makeRedirectUri({ useProxy: true });
    console.log("\n=== OAUTH REDIRECT CONFIGURATION ===");
    console.log("✓ Proxy Redirect URI:", proxyRedirect);
    console.log("✓ Web Client ID exists:", !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
    console.log("✓ Android Client ID exists:", !!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
    console.log("✓ iOS Client ID exists:", !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
    console.log("✓ Platform:", Platform.OS);
    console.log("✓ useIdTokenAuthRequest configured with redirectUrl");
    console.log("=====================================\n");
  }, []);

  // Handle Google Auth responses with comprehensive error handling
  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      if (id_token) {
        loginWithGoogle(id_token);
      } else {
        setError("No ID token received from Google");
        Alert.alert(
          "Auth Error",
          "Failed to get authentication token from Google",
        );
      }
    } else if (response?.type === "error") {
      let errorMessage = "Google Sign-in failed";

      if (response.error?.message) {
        errorMessage = response.error.message;
      } else if (response.params?.error) {
        errorMessage = response.params.error;
      } else if (response.params?.error_description) {
        errorMessage = response.params.error_description;
      }

      console.error("[Auth] Google Auth Error Details:", {
        type: response.type,
        error: response.error,
        params: response.params,
      });

      // Handle specific error cases
      if (
        errorMessage.includes("cross-site") ||
        errorMessage.includes("state")
      ) {
        setError(
          "Cross-site verification failed. Clear app data and try again.",
        );
        Alert.alert(
          "Verification Failed",
          "Settings → Apps → Gym Tracker → Storage → Clear Data, then try again.",
        );
      } else if (errorMessage.includes("invalid_request")) {
        setError(
          "Invalid OAuth request. Check Google Cloud Console configuration.",
        );
        Alert.alert(
          "Configuration Error",
          "Ensure your redirect URI is registered in Google Cloud Console.",
        );
      } else if (errorMessage.includes("Authorization Error")) {
        setError(
          "App not authorized. Check Google Cloud Console OAuth settings.",
        );
        Alert.alert(
          "Authorization Failed",
          "Your app may not comply with Google OAuth security policies.\n\n" +
            "Check: https://support.google.com/cloud/answer/7475711",
        );
      } else {
        setError(errorMessage);
        Alert.alert("Sign-in Error", errorMessage);
      }
    } else if (response?.type === "cancel") {
      console.log("[Auth] User cancelled Google Sign-in");
      setError(null);
    }
  }, [response]);

  const loginWithGoogle = async (idToken) => {
    try {
      setLoading(true);
      console.log("[Auth] Exchanging ID token for Firebase credential...");

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);

      console.log("[Auth] Successfully signed in with Google");
      setLoading(false);
      // Navigation handled in App.js via auth state
    } catch (err) {
      console.error("[Auth] Firebase Sign-in Error:", err);
      const errorMessage = err.message || "Unable to sign in";
      setError(errorMessage);
      setLoading(false);

      // Handle specific Firebase auth errors
      if (errorMessage.includes("auth/invalid-credential")) {
        Alert.alert(
          "Invalid Credentials",
          "The authentication token is invalid. Please try again.",
        );
      } else if (errorMessage.includes("auth/operation-not-allowed")) {
        Alert.alert(
          "Feature Disabled",
          "Google Sign-in is not enabled in Firebase. Enable it in Firebase Console.",
        );
      } else if (errorMessage.includes("auth/network-request-failed")) {
        Alert.alert(
          "Network Error",
          "Failed to connect. Please check your internet connection.",
        );
      } else {
        Alert.alert("Sign-in Error", errorMessage);
      }
    }
  };

  return (
    <View style={styles.container}>
      {Platform.OS === "android" && (
        <View style={{ height: StatusBar.currentHeight }} />
      )}
      <View style={styles.gradient} />

      <View style={styles.content}>
        {/* Logo & Branding */}
        <View style={styles.branding}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={60}
              color={COLORS.accent}
            />
          </View>
          <Text style={styles.appTitle}>GYM TRACKER</Text>
          <Text style={styles.subtitle}>Premium Workout Logger</Text>
        </View>

        <View style={styles.features}>
          <FeatureItem icon="chart-line" text="Track Progress" />
          <FeatureItem icon="cloud-sync" text="Cloud Sync" />
          <FeatureItem icon="check-circle-outline" text="Offline Mode" />
        </View>

        {/* Login Section */}
        <View style={styles.loginSection}>
          <Text style={styles.loginText}>Sign in to get started</Text>

          <TouchableOpacity
            style={[
              styles.googleButton,
              (!request || loading || !credentialsReady) &&
                styles.buttonDisabled,
            ]}
            onPress={() => {
              setError(null);
              handleLogin();
            }}
            disabled={!request || loading || !credentialsReady}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="google" size={20} color="#000" />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guestButton}
            onPress={loginAsGuest}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name="account-circle-outline"
              size={20}
              color={loading ? COLORS.muted : COLORS.accent}
            />
            <Text
              style={[
                styles.guestButtonText,
                loading && { color: COLORS.muted },
              ]}
            >
              Continue as Guest
            </Text>
          </TouchableOpacity>

          {error && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={16}
                color={COLORS.error}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Debug Info (only in development) */}
          {__DEV__ && (
            <View style={styles.debugBox}>
              <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
              <Text style={styles.debugText}>
                Web ID: {process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ? "✓" : "✗"}
              </Text>
              <Text style={styles.debugText}>
                Android ID:{" "}
                {process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ? "✓" : "✗"}
              </Text>
              <Text style={styles.debugText}>
                Request Ready: {request ? "✓" : "✗"}
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Powered by Firebase • Live Sync • Offline Ready
        </Text>
      </View>
    </View>
  );
}

function FeatureItem({ icon, text }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconBox}>
        <MaterialCommunityIcons name={icon} size={24} color={COLORS.accent} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "space-between",
    // Remove hardcoded padding, let App.js SafeAreaView handle it
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "space-between",
    paddingBottom: 40,
  },
  branding: {
    alignItems: "center",
    marginTop: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    letterSpacing: 0.5,
  },
  features: {
    marginTop: 50,
    gap: 14,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  loginSection: {
    gap: 16,
  },
  loginText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.muted,
    textAlign: "center",
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  guestButton: {
    flexDirection: "row",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  guestButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    letterSpacing: 0.5,
  },
  errorBox: {
    flexDirection: "row",
    backgroundColor: `${COLORS.error}15`,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    alignItems: "center",
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    flex: 1,
    fontWeight: "500",
  },
  debugBox: {
    backgroundColor: `${COLORS.accent}15`,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
  },
  debugText: {
    fontSize: 11,
    color: COLORS.muted,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  footer: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: "center",
    letterSpacing: 0.3,
    marginTop: 20,
  },
});
