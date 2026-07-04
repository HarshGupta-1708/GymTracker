import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/data";

export default function AppSplash({ message = "Loading GYM TRACKER..." }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="dumbbell" size={56} color={COLORS.accent} />
      </View>
      <Text style={styles.title}>GYM TRACKER</Text>
      <ActivityIndicator size="large" color={COLORS.accent} style={styles.spinner} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${COLORS.accent}15`,
    borderWidth: 2,
    borderColor: `${COLORS.accent}40`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 2,
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
