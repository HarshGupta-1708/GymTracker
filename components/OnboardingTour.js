import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

const STEPS = [
  {
    icon: "arm-flex",
    title: "Welcome to GYM TRACKER",
    text: "Your personal gym log — workouts, progress charts, body stats and an AI coach. Here's a quick 1-minute tour.",
  },
  {
    icon: "dumbbell",
    title: "Log Today's Workout",
    text: "Open the Today tab, add exercises (or load a full plan), then tap ADD SET to log weight and reps. Each exercise shows your LAST 3 SESSIONS so you always know what you lifted last time.",
  },
  {
    icon: "history",
    title: "Check Your History",
    text: "The History tab keeps every workout you've ever logged. Tap the date on the Today screen to jump to any day from the calendar.",
  },
  {
    icon: "chart-line",
    title: "Track Real Progress",
    text: "The Progress tab shows your strength trend with estimated 1RM, weekly volume vs last week, and per-exercise records — the numbers that actually matter.",
  },
  {
    icon: "robot",
    title: "Ask Your AI Coach",
    text: "The Coach tab answers questions using YOUR workout data — what to train today, progression advice, recent PRs. Use the history icon to manage multiple chats.",
  },
  {
    icon: "account-circle",
    title: "Profile & Backup",
    text: "Tap your name on the Dashboard to set weight, height, body fat and photos. Use Save to Body History for dated snapshots, and Export Backup to keep your data safe.",
  },
];

export default function OnboardingTour({ visible, onDone }) {
  const { colors: C } = useTheme();
  const styles = createStyles(C);
  const [step, setStep] = useState(0);

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleNext = () => {
    if (isLast) {
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={current.icon} size={40} color={C.accent} />
          </View>

          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.text}>{current.text}</Text>

          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step && { backgroundColor: C.accent, width: 18 },
                ]}
              />
            ))}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.skipBtn} onPress={onDone}>
              <Text style={styles.skipText}>SKIP ALL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextText}>{isLast ? "GET STARTED" : "NEXT"}</Text>
              <MaterialCommunityIcons
                name={isLast ? "check" : "arrow-right"}
                size={16}
                color="#000"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (C) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.85)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: C.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: 24,
      alignItems: "center",
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: `${C.accent}15`,
      borderWidth: 1,
      borderColor: `${C.accent}40`,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    title: {
      color: C.text,
      fontSize: 17,
      fontWeight: "900",
      letterSpacing: 0.5,
      textAlign: "center",
      marginBottom: 10,
    },
    text: {
      color: C.muted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      marginBottom: 20,
    },
    dotsRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 20,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: `${C.muted}50`,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      width: "100%",
    },
    skipBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    skipText: {
      color: C.muted,
      fontSize: 12,
      fontWeight: "800",
    },
    nextBtn: {
      flex: 1.4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: C.accent,
    },
    nextText: {
      color: "#000",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
  });
