import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { THEME_LIST } from "../constants/themes";
import { useTheme } from "../context/ThemeContext";

export default function ThemePickerModal({ visible, currentThemeId, onSelect, onClose }) {
  const { colors: C } = useTheme();
  const styles = createStyles(C);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>GYM THEME</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={C.muted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Pick your training vibe</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {THEME_LIST.map((theme) => {
              const selected = theme.id === currentThemeId;
              const c = theme.colors;
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[styles.themeRow, selected && { borderColor: c.accent, backgroundColor: `${c.accent}12` }]}
                  onPress={() => onSelect(theme.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.themeName, selected && { color: c.accent }]}>{theme.name}</Text>
                    <Text style={styles.themeDesc}>{theme.description}</Text>
                    <View style={styles.swatchRow}>
                      <View style={[styles.swatch, { backgroundColor: c.bg, borderColor: c.border }]} />
                      <View style={[styles.swatch, { backgroundColor: c.card, borderColor: c.border }]} />
                      <View style={[styles.swatch, { backgroundColor: c.accent }]} />
                      <View style={[styles.swatch, { backgroundColor: c.orange }]} />
                    </View>
                  </View>
                  {selected && (
                    <MaterialCommunityIcons name="check-circle" size={22} color={c.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (C) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      padding: 20,
    },
    card: {
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 18,
      maxHeight: "80%",
      borderWidth: 1,
      borderColor: C.border,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    title: {
      fontSize: 16,
      fontWeight: "900",
      color: C.text,
      letterSpacing: 1.5,
    },
    subtitle: {
      color: C.muted,
      fontSize: 12,
      marginBottom: 14,
    },
    themeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 10,
      backgroundColor: C.surface,
    },
    themeEmoji: {
      fontSize: 26,
    },
    themeName: {
      color: C.text,
      fontSize: 14,
      fontWeight: "800",
    },
    themeDesc: {
      color: C.muted,
      fontSize: 11,
      marginTop: 2,
    },
    swatchRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 8,
    },
    swatch: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1,
    },
  });
