import { MaterialCommunityIcons } from "@expo/vector-icons";
import { signInAnonymously } from "firebase/auth";
import { useEffect, useState, useMemo } from "react";
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
import { useTheme } from "../context/ThemeContext";
import { useGoogleSignIn } from "../hooks/useGoogleSignIn";

const { width } = Dimensions.get("window");

export default function LoginScreen({ onGuestLogin }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState(null);

  // Use the platform-specific Google Sign-In hook
  const { 
    signIn: loginWithGoogle, 
    loading: googleLoading, 
    error: googleError, 
    setError: setGoogleError 
  } = useGoogleSignIn();

  // Combine loading and error states for UI simplicity
  const loading = guestLoading || googleLoading;
  const error = guestError || googleError;

  const setError = (msg) => {
    if (msg === null) {
      setGuestError(null);
      setGoogleError(null);
    } else {
      setGoogleError(msg);
    }
  };

  // --- Guest / Anonymous Login ---
  const loginAsGuest = async () => {
    try {
      setGuestLoading(true);
      setGuestError(null);
      await signInAnonymously(auth);
      setGuestLoading(false);
    } catch (err) {
      console.warn("Firebase Anonymous Auth failed, falling back to local demo mode:", err);
      if (typeof onGuestLogin === "function") {
        onGuestLogin();
      }
      setGuestLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'android' && <View style={{ height: StatusBar.currentHeight }} />}
      <View style={styles.gradient} />

      <View style={styles.content}>
        {/* Logo & Branding */}
        <View style={styles.branding}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={60}
              color={C.accent}
            />
          </View>
          <Text style={styles.appTitle}>GYM TRACKER</Text>
          <Text style={styles.subtitle}>Premium Workout Logger</Text>
        </View>

        <View style={styles.features}>
          <FeatureItem icon="chart-line" text="Track Progress" styles={styles} C={C} />
          <FeatureItem icon="cloud-sync" text="Cloud Sync" styles={styles} C={C} />
          <FeatureItem icon="check-circle-outline" text="Offline Mode" styles={styles} C={C} />
        </View>

        {/* Login Section */}
        <View style={styles.loginSection}>
          <Text style={styles.loginText}>Sign in to get started</Text>
          <Text style={styles.restoreHint}>
            Sign in with the same Google account to restore your workout history after reinstall.
          </Text>

          <TouchableOpacity
            style={[styles.googleButton, loading && styles.googleButtonDisabled]}
            onPress={() => {
              setError(null);
              loginWithGoogle();
            }}
            disabled={loading}
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
            <MaterialCommunityIcons name="account-circle-outline" size={20} color={C.accent} />
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>

          {error && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={16}
                color={C.error}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                onPress={() => {
                  setError(null);
                  loginWithGoogle();
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
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

function FeatureItem({ icon, text, styles, C }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconBox}>
        <MaterialCommunityIcons name={icon} size={24} color={C.accent} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const createStyles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: "space-between",
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: C.bg,
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
    backgroundColor: C.card,
    borderWidth: 2,
    borderColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: C.text,
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: C.muted,
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
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: C.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
    flex: 1,
  },
  loginSection: {
    gap: 16,
  },
  loginText: {
    fontSize: 16,
    fontWeight: "600",
    color: C.muted,
    textAlign: "center",
  },
  restoreHint: {
    fontSize: 12,
    color: C.muted,
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: C.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: C.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  guestButton: {
    flexDirection: "row",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: C.accent,
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
    color: C.accent,
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
    backgroundColor: `${C.error}15`,
    borderWidth: 1,
    borderColor: C.error,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    alignItems: "center",
  },
  errorText: {
    fontSize: 12,
    color: C.error,
    flex: 1,
    fontWeight: "500",
  },
  retryButton: {
    backgroundColor: C.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    fontSize: 11,
    color: C.muted,
    textAlign: "center",
    letterSpacing: 0.3,
    marginTop: 20,
  },
});
