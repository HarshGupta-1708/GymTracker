import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CATEGORIES, CATEGORY_COLORS } from "../constants/data";
import { useTheme } from "../context/ThemeContext";
import {
  FIELD_TEMPLATES,
  getDefaultFieldsForCategory,
  slugifyFieldKey,
} from "../utils/exerciseTracking";
import { getResolvedFields } from "../utils/exerciseManagement";

export default function CustomExerciseForm({
  visible,
  onClose,
  onSave,
  exercises = [],
  title = "NEW EXERCISE",
  initialExercise = null,
  originalName = null,
  saveLabel = "ADD EXERCISE",
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [name, setName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategories, setCustomCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [fields, setFields] = useState(getDefaultFieldsForCategory("Custom"));
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldUnit, setNewFieldUnit] = useState("");

  const savedCategories = useMemo(() => {
    const fromLib = [...new Set(exercises.map((e) => e.category).filter(Boolean))];
    return fromLib;
  }, [exercises]);

  const allCategories = useMemo(() => {
    return [...new Set([...savedCategories, ...customCategories])];
  }, [savedCategories, customCategories]);

  const reset = () => {
    setName("");
    setSelectedCategory("");
    setCustomCategories([]);
    setNewCategoryName("");
    setFields(getDefaultFieldsForCategory("Custom"));
    setNewFieldLabel("");
    setNewFieldUnit("");
  };

  useEffect(() => {
    if (!visible) {
      reset();
      return;
    }
    if (initialExercise) {
      setName(initialExercise.name || "");
      setSelectedCategory(initialExercise.category || "");
      setFields(getResolvedFields(initialExercise));
      setCustomCategories([]);
      setNewCategoryName("");
      setNewFieldLabel("");
      setNewFieldUnit("");
    }
  }, [visible, initialExercise]);

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const selectCategory = (cat) => {
    setSelectedCategory(cat);
    if (!initialExercise && CATEGORIES.includes(cat)) {
      setFields(getDefaultFieldsForCategory(cat));
    }
  };

  const addCustomCategory = () => {
    const label = newCategoryName.trim();
    if (!label) return;
    if (!allCategories.includes(label)) {
      setCustomCategories((prev) => [...prev, label]);
    }
    setSelectedCategory(label);
    setNewCategoryName("");
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
    const trimmedCategory = selectedCategory.trim() || newCategoryName.trim() || "Custom";
    if (!trimmedName) return;
    if (!trimmedCategory) return;
    if (!fields.length) return;

    const checkName = originalName || trimmedName;
    if (
      trimmedName !== checkName &&
      exercises.some((e) => e.name === trimmedName)
    ) {
      Alert.alert("Name taken", "An exercise with this name already exists.");
      return;
    }

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
              <MaterialCommunityIcons name="close" size={24} color={C.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: "75%" }} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>EXERCISE NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Incline Treadmill Run"
              placeholderTextColor={C.muted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { marginTop: 14 }]}>CATEGORY</Text>
            <Text style={styles.hint}>Add any category name you want (Leg Day, Push, Treadmill...)</Text>

            {allCategories.length > 0 && (
              <View style={styles.chipWrap}>
                {allCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.chip,
                      selectedCategory === cat && {
                        backgroundColor: CATEGORY_COLORS[cat] || C.accent,
                        borderColor: CATEGORY_COLORS[cat] || C.accent,
                      },
                    ]}
                    onPress={() => selectCategory(cat)}
                  >
                    <Text style={[styles.chipText, selectedCategory === cat && { color: "#000" }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.addFieldBox}>
              <Text style={styles.label}>ADD CUSTOM CATEGORY</Text>
              <View style={styles.addFieldRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Category name (e.g. Leg Day)"
                  placeholderTextColor={C.muted}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  onSubmitEditing={addCustomCategory}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addFieldBtn} onPress={addCustomCategory}>
                  <MaterialCommunityIcons name="plus" size={20} color="#000" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedCategory ? (
              <View style={styles.selectedBadge}>
                <MaterialCommunityIcons name="check-circle" size={14} color={C.green} />
                <Text style={styles.selectedBadgeText}>Selected: {selectedCategory}</Text>
              </View>
            ) : null}

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
                  <MaterialCommunityIcons name="close-circle" size={20} color={C.error} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addFieldBox}>
              <Text style={styles.label}>ADD CUSTOM FIELD</Text>
              <View style={styles.addFieldRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Field name (e.g. Incline)"
                  placeholderTextColor={C.muted}
                  value={newFieldLabel}
                  onChangeText={setNewFieldLabel}
                  onSubmitEditing={addCustomField}
                  returnKeyType="done"
                />
                <TextInput
                  style={[styles.input, { width: 70 }]}
                  placeholder="Unit"
                  placeholderTextColor={C.muted}
                  value={newFieldUnit}
                  onChangeText={setNewFieldUnit}
                />
                <TouchableOpacity style={styles.addFieldBtn} onPress={addCustomField}>
                  <MaterialCommunityIcons name="plus" size={20} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, (!name.trim() || !selectedCategory || !fields.length) && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={!name.trim() || !selectedCategory || !fields.length}
          >
            <MaterialCommunityIcons name="plus" size={16} color="#000" />
            <Text style={styles.saveBtnText}>{saveLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (C) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
    ...Platform.select({ web: { justifyContent: "center", alignItems: "center" } }),
  },
  content: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderTopColor: C.border,
    ...Platform.select({
      web: { width: "90%", maxWidth: 500, borderRadius: 16, borderWidth: 1, borderColor: C.border },
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
    color: C.text,
    letterSpacing: 1,
  },
  label: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  hint: {
    color: C.muted,
    fontSize: 11,
    marginBottom: 10,
  },
  input: {
    backgroundColor: C.inputBg,
    borderRadius: 10,
    padding: 12,
    color: C.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipRow: {
    marginTop: 4,
    marginBottom: 4,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "600",
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${C.green}15`,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  selectedBadgeText: {
    color: C.green,
    fontSize: 12,
    fontWeight: "700",
  },
  templateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.accent,
    marginRight: 8,
    backgroundColor: `${C.accent}15`,
  },
  templateChipText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  fieldName: {
    color: C.text,
    fontSize: 13,
    fontWeight: "600",
  },
  fieldUnit: {
    color: C.muted,
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
    backgroundColor: C.accent,
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtn: {
    flexDirection: "row",
    backgroundColor: C.accent,
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
