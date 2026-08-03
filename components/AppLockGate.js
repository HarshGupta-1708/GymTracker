import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { getLockConfig, verifyPin } from "../utils/appLock";

/**
 * Blocks the app until phone biometrics and/or app PIN unlock succeeds.
 * Either method works when both are enabled.
 */
export default function AppLockGate({ children }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [config, setConfig] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const bootstrap = useCallback(async () => {
    setChecking(true);
    const cfg = await getLockConfig();
    setConfig(cfg);
    if (!cfg.enabled) {
      setLocked(false);
      setChecking(false);
      return;
    }
    setLocked(true);
    setChecking(false);

    // Auto-prompt phone unlock when device lock is on
    if (cfg.deviceEnabled && Platform.OS !== "web") {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && enrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Unlock FitTrack",
            cancelLabel: cfg.pinEnabled ? "Use app PIN" : "Cancel",
            disableDeviceFallback: false,
          });
          if (result.success) setLocked(false);
        }
      } catch {
        /* PIN fallback if enabled */
      }
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const tryPin = async () => {
    setBusy(true);
    setError("");
    const ok = await verifyPin(pin);
    setBusy(false);
    if (ok) {
      setPin("");
      setLocked(false);
    } else {
      setError("Wrong PIN");
      setPin("");
    }
  };

  const tryDeviceAgain = async () => {
    if (Platform.OS === "web") {
      setError("Device lock is available on phone builds");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock FitTrack",
        disableDeviceFallback: false,
      });
      if (result.success) setLocked(false);
      else setError("Authentication failed");
    } catch (e) {
      setError(e?.message || "Device unlock unavailable");
    }
    setBusy(false);
  };

  if (checking) {
    return (
      <View style={[styles.gate, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (!locked) return children;

  const deviceOn = Boolean(config?.deviceEnabled);
  const pinOn = Boolean(config?.pinEnabled && config?.pinHash);

  let sub = "Unlock to continue";
  if (deviceOn && pinOn) sub = "Unlock with phone lock or app PIN";
  else if (deviceOn) sub = "Unlock with your phone lock";
  else if (pinOn) sub = "Enter your app PIN";

  return (
    <View style={[styles.gate, { backgroundColor: C.bg }]}>
      <MaterialCommunityIcons name="shield-lock" size={48} color={C.accent} />
      <Text style={styles.title}>FitTrack Locked</Text>
      <Text style={styles.sub}>{sub}</Text>

      {deviceOn ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={tryDeviceAgain} disabled={busy}>
          <MaterialCommunityIcons name="fingerprint" size={20} color="#000" />
          <Text style={styles.primaryText}>Use phone unlock</Text>
        </TouchableOpacity>
      ) : null}

      {pinOn ? (
        <>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 8))}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="PIN"
            placeholderTextColor={C.muted}
            maxLength={8}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, pin.length < 4 && { opacity: 0.5 }]}
            onPress={tryPin}
            disabled={busy || pin.length < 4}
          >
            <Text style={styles.primaryText}>Unlock with PIN</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (C) =>
  StyleSheet.create({
    gate: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 12,
    },
    title: { fontSize: 22, fontWeight: "900", color: C.text, marginTop: 8 },
    sub: { fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 8 },
    input: {
      width: "80%",
      maxWidth: 280,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      padding: 14,
      color: C.text,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 6,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: C.accent,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginTop: 4,
    },
    primaryText: { color: "#000", fontWeight: "800", fontSize: 14 },
    error: { color: C.error, fontSize: 13, fontWeight: "600", marginTop: 6 },
  });
