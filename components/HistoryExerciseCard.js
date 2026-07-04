import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CATEGORY_COLORS } from "../constants/data";
import { formatSetFieldValue } from "../utils/exerciseTracking";
import { useTheme } from "../context/ThemeContext";

export default memo(function HistoryExerciseCard({ ex, category = "Custom", fields = [] }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const color = CATEGORY_COLORS[category] || C.accent;
  const displayFields = fields?.length ? fields : [];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.colorBar, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{ex.name}</Text>
          <Text style={[styles.category, { color }]}>
            {category} • {ex.sets?.length || 0} sets
          </Text>
        </View>
      </View>

      {ex.sets?.length > 0 ? (
        <View style={styles.setsContainer}>
          {ex.sets.map((set, i) => {
            const isTop =
              set.w > 0 &&
              ex.sets.length > 1 &&
              set.w === Math.max(...ex.sets.map((s) => s.w || 0));
            return (
              <View
                key={i}
                style={[
                  styles.setBlock,
                  { backgroundColor: i % 2 === 0 ? "transparent" : `${C.muted}10` },
                ]}
              >
                <View style={styles.setBlockHeader}>
                  <Text style={styles.setNumber}>Set {i + 1}</Text>
                  <Text style={styles.setTime}>{set.t}</Text>
                </View>
                <View style={styles.setFieldsGrid}>
                  {displayFields.map((f) => (
                    <View key={f.key} style={styles.setFieldItem}>
                      <Text style={styles.setFieldLabel}>{f.label}</Text>
                      <Text
                        style={[
                          styles.setFieldValue,
                          { color: f.key === "w" && isTop ? C.gold : C.text },
                        ]}
                      >
                        {formatSetFieldValue(f, set[f.key])}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.noSets}>No sets logged</Text>
      )}
    </View>
  );
});

const createStyles = (C) => StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  colorBar: {
    width: 3,
    height: 34,
    borderRadius: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
  },
  category: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 1,
  },
  setsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  setBlock: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  setBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  setNumber: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  setTime: {
    fontSize: 10,
    color: C.muted,
  },
  setFieldsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  setFieldItem: {
    minWidth: "30%",
    flexGrow: 1,
    backgroundColor: C.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  setFieldLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  setFieldValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  noSets: {
    color: C.muted,
    fontSize: 12,
    padding: 12,
  },
});
