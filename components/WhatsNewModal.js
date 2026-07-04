import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

const WHATS_NEW = [
  "Workout history restores automatically when you sign in with Google",
  "Custom day names (Leg Day, Push Pull) on each workout",
  "Fully custom exercise fields — add reps, weight, speed, incline, and more",
  "Export / import backup from Dashboard settings",
  "Faster updates when you complete a workout",
];

export default function WhatsNewModal({ visible, version, onDismiss }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="star-four-points" size={32} color={C.gold} />
          <Text style={styles.title}>What&apos;s New in v{version}</Text>
          {WHATS_NEW.map((item) => (
            <View key={item} style={styles.row}>
              <MaterialCommunityIcons name="check-circle" size={16} color={C.green} />
              <Text style={styles.item}>{item}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (C) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: C.text,
    marginTop: 12,
    marginBottom: 16,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
    width: "100%",
  },
  item: {
    flex: 1,
    color: C.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  btn: {
    backgroundColor: C.accent,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 12,
  },
  btnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 14,
  },
});
