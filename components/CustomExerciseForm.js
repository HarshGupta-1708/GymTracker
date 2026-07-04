import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CATEGORIES, CATEGORY_COLORS, COLORS } from "../constants/data";
import {
  FIELD_TEMPLATES,
  getDefaultFieldsForCategory,
  slugifyFieldKey,
} from "../utils/exerciseTracking";

export default function CustomExerciseForm({
  visible,
  onClose,
  onSave,
  exercises = [],
  title = "NEW EXERCISE",
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [fields, setFields] = useState(getDefaultFieldsForCategory("Custom"));
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldUnit, setNewFieldUnit] = useState("");

  const categoryOptions = useMemo(() => {
    const fromLib = [...new Set(exercises.map((e) => e.category).filter(Boolean))];
    return [...new Set([...CATEGORIES, ...fromLib])];
  }, [exercises]);

  const reset = () => {
    setName("");
    setCategory("");
    setFields(getDefaultFieldsForCategory("Custom"));
    setNewFieldLabel("");
    setNewFieldUnit("");
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const selectCategory = (cat) => {
    setCategory(cat);
    setFields(getDefaultFieldsForCategory(cat));
  };

  const applyTemplate = (templateKey) => {
    setFields([...(FIELD_TEMPLATES[templateKey] || FIELD_TEMPLATES.strength)]);
  };

  const addCustomField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    const key = slugifyFieldKey(label);
    if (fields.find((f) => f.key === key)) return;
    setFields([...fields, { key, label, unit: newFieldUnit.trim() }]);
    setNewFieldLabel("");
    setNewFieldUnit("");
  };

  const removeField = (key) => {
    setFields(fields.filter((f) => f.key !== key));
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim() || "Custom";
    if (!trimmedName) return;
    if (!fields.length) return;
    onSave?.({
      name: trimmedName,
      category: trimmedCategory,
      fields: fields.map((f) => ({ ...f })),
    });
    reset();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: "75%" }} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>EXERCISE NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Incline Treadmill Run"
              placeholderTextColor={COLORS.muted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { marginTop: 14 }]}>CATEGORY</Text>
            <TextInput
              style={styles.input}
              placeholder="Type any category (Leg Day, Cardio, Push...)"
              placeholderTextColor={COLORS.muted}
              value={category}
              onChangeText={setCategory}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {categoryOptions.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    category === cat && {
                      backgroundColor: CATEGORY_COLORS[cat] || COLORS.accent,
                      borderColor: CATEGORY_COLORS[cat] || COLORS.accent,
                    },
                  ]}
                  onPress={() => selectCategory(cat)}
                >
                  <Text style={[styles.chipText, category === cat && { color: "#000" }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { marginTop: 14 }]}>TRACKING FIELDS</Text>
            <Text style={styles.hint}>Choose what to log for each set (reps, weight, min, speed, etc.)</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {[
                { key: "strength", label: "Reps + Weight" },
                { key: "cardio", label: "Min + Distance" },
                { key: "duration", label: "Duration only" },
              ].map((t) => (
                <TouchableOpacity key={t.key} style={styles.templateChip} onPress={() => applyTemplate(t.key)}>
                  <Text style={styles.templateChipText}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {fields.map((f) => (
              <View key={f.key} style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldName}>{f.label}</Text>
                  {f.unit ? <Text style={styles.fieldUnit}>{f.unit}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => removeField(f.key)}>
                  <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addFieldBox}>
              <Text style={styles.label}>ADD CUSTOM FIELD</Text>
              <View style={styles.addFieldRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Field name (e.g. Incline)"
                  placeholderTextColor={COLORS.muted}
                  value={newFieldLabel}
                  onChangeText={setNewFieldLabel}
                />
                <TextInput
                  style={[styles.input, { width: 70 }]}
                  placeholder="Unit"
                  placeholderTextColor={COLORS.muted}
                  value={newFieldUnit}
                  onChangeText={setNewFieldUnit}
                />
                <TouchableOpacity style={styles.addFieldBtn} onPress={addCustomField}>
                  <MaterialCommunityIcons name="plus" size={20} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <MaterialCommunityIcons name="plus" size={16} color="#000" />
            <Text style={styles.saveBtnText}>ADD EXERCISE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
    ...Platform.select({ web: { justifyContent: "center", alignItems: "center" } }),
  },
  content: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...Platform.select({
      web: { width: "90%", maxWidth: 500, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 1,
  },
  label: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  hint: {
    color: COLORS.muted,
    fontSize: 11,
    marginBottom: 10,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    backgroundColor: COLORS.surface,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  templateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
    marginRight: 8,
    backgroundColor: `${COLORS.accent}15`,
  },
  templateChipText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  fieldUnit: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },
  addFieldBox: {
    marginTop: 10,
    marginBottom: 8,
  },
  addFieldRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  addFieldBtn: {
    backgroundColor: COLORS.accent,
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  saveBtnText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "800",
  },
});
