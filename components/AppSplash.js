import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function AppSplash({ message = "Loading GYM TRACKER..." }) {
  const { colors: C } = useTheme();
  const styles = createStyles(C);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="dumbbell" size={56} color={C.accent} />
      </View>
      <Text style={styles.title}>GYM TRACKER</Text>
      <ActivityIndicator size="large" color={C.accent} style={styles.spinner} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const createStyles = (C) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: `${C.accent}15`,
      borderWidth: 2,
      borderColor: `${C.accent}40`,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: "900",
      color: C.text,
      letterSpacing: 2,
      marginBottom: 24,
    },
    spinner: {
      marginBottom: 16,
    },
    message: {
      color: C.muted,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
  });
