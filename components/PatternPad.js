import { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

const SIZE = 3;

/**
 * Tap-based 3×3 pattern (web + native). Tap dots in order, then Confirm.
 * Append-only (like Android pattern) — Clear to restart.
 */
export default function PatternPad({ onComplete, disabled, minLength = 4 }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [path, setPath] = useState([]);
  const [error, setError] = useState("");

  const tap = (i) => {
    if (disabled) return;
    setError("");
    setPath((prev) => {
      if (prev.includes(i)) return prev;
      return [...prev, i];
    });
  };

  const clear = () => {
    setPath([]);
    setError("");
  };

  const confirm = () => {
    if (path.length < minLength) {
      setError(`Connect at least ${minLength} dots`);
      return;
    }
    onComplete?.([...path]);
    setPath([]);
    setError("");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const order = path.indexOf(i);
          const active = order >= 0;
          return (
            <TouchableOpacity
              key={i}
              disabled={disabled}
              onPress={() => tap(i)}
              style={[
                styles.dot,
                {
                  backgroundColor: active ? C.accent : C.surface,
                  borderColor: active ? C.accent : C.border,
                },
              ]}
            >
              {active ? <Text style={styles.order}>{order + 1}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.hint}>Tap dots in order ({path.length}/{minLength}+)</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnGhost} onPress={clear} disabled={disabled}>
          <Text style={styles.btnGhostText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, path.length < minLength && { opacity: 0.45 }]}
          onPress={confirm}
          disabled={disabled || path.length < minLength}
        >
          <Text style={styles.btnText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (C) =>
  StyleSheet.create({
    wrap: { alignItems: "center", marginVertical: 8, width: "100%" },
    grid: {
      width: 220,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 16,
    },
    dot: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    order: { color: "#000", fontWeight: "900", fontSize: 16 },
    hint: { marginTop: 10, fontSize: 12, color: C.muted, fontWeight: "600" },
    error: { marginTop: 4, fontSize: 12, color: C.error, fontWeight: "700" },
    actions: { flexDirection: "row", gap: 10, marginTop: 12 },
    btn: {
      backgroundColor: C.accent,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
    },
    btnText: { color: "#000", fontWeight: "800" },
    btnGhost: {
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
    },
    btnGhostText: { color: C.text, fontWeight: "700" },
  });
