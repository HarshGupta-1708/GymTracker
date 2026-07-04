import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { useTheme } from "../context/ThemeContext";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CustomExerciseForm from '../components/CustomExerciseForm';
import { CATEGORIES, CATEGORY_COLORS, PRESET_EXERCISES } from "../constants/data";
import {
  countExerciseUsage,
  getAddedFieldKeys,
  getResolvedFields,
} from '../utils/exerciseManagement';

export default function ExercisesScreen({
  exercises = PRESET_EXERCISES,
  workouts = {},
  onAddToday,
  onAddCustomExercise,
  onUpdateExercise,
  onRemoveExercise,
  loading,
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [search, setSearch] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);

  const filteredExercises = useMemo(() => {
    return exercises.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [exercises, search]);

  const categoryList = useMemo(() => {
    const fromLib = [...new Set(filteredExercises.map((e) => e.category).filter(Boolean))];
    return [...new Set([...CATEGORIES, ...fromLib])];
  }, [filteredExercises]);

  const grouped = useMemo(() => {
    const groups = {};
    categoryList.forEach(cat => {
      groups[cat] = filteredExercises.filter(e => e.category === cat);
    });
    return groups;
  }, [filteredExercises, categoryList]);

  const handleSaveCustom = async (data) => {
    if (typeof onAddCustomExercise === 'function') {
      await onAddCustomExercise(data.name, data.category, data.fields);
    }
    setShowCustomForm(false);
  };

  const finishUpdate = async (oldExercise, updated, options) => {
    if (typeof onUpdateExercise === 'function') {
      await onUpdateExercise(oldExercise.name, updated, options);
    }
    setEditingExercise(null);
  };

  const askNewFields = (oldExercise, updated, renameInHistory) => {
    const addedKeys = getAddedFieldKeys(
      getResolvedFields(oldExercise),
      updated.fields,
    );

    if (addedKeys.length === 0) {
      finishUpdate(oldExercise, updated, { renameInHistory });
      return;
    }

    Alert.alert(
      'New tracking fields',
      `You added ${addedKeys.length} new field(s). How should past workout sets be handled?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave empty in history',
          onPress: () =>
            finishUpdate(oldExercise, updated, {
              renameInHistory,
              fillNewFieldsWithZero: false,
            }),
        },
        {
          text: 'Set to 0 in history',
          onPress: () =>
            finishUpdate(oldExercise, updated, {
              renameInHistory,
              fillNewFieldsWithZero: true,
            }),
        },
      ],
    );
  };

  const askRenameHistory = (oldExercise, updated) => {
    const sessions = countExerciseUsage(workouts, oldExercise.name);

    Alert.alert(
      'Exercise renamed',
      `"${oldExercise.name}" is used in ${sessions} past workout(s). Update history to "${updated.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep old name in history',
          onPress: () => askNewFields(oldExercise, updated, false),
        },
        {
          text: 'Update history',
          onPress: () => askNewFields(oldExercise, updated, true),
        },
      ],
    );
  };

  const handleEditSave = async (updated) => {
    const oldExercise = editingExercise;
    if (!oldExercise) return;

    if (
      updated.name !== oldExercise.name &&
      exercises.some((e) => e.name === updated.name)
    ) {
      Alert.alert('Name taken', 'An exercise with this name already exists.');
      return;
    }

    const sessions = countExerciseUsage(workouts, oldExercise.name);
    const nameChanged = updated.name !== oldExercise.name;
    const addedKeys = getAddedFieldKeys(
      getResolvedFields(oldExercise),
      updated.fields,
    );

    if (sessions === 0 || (!nameChanged && addedKeys.length === 0)) {
      await finishUpdate(oldExercise, updated, {
        renameInHistory: nameChanged,
      });
      return;
    }

    if (nameChanged) {
      askRenameHistory(oldExercise, updated);
    } else {
      askNewFields(oldExercise, updated, false);
    }
  };

  const handleDelete = (exercise) => {
    const sessions = countExerciseUsage(workouts, exercise.name);

    if (sessions === 0) {
      Alert.alert(
        'Remove exercise',
        `Remove "${exercise.name}" from your library?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => onRemoveExercise?.(exercise.name, { removeFromHistory: false }),
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Remove exercise',
      `"${exercise.name}" appears in ${sessions} past workout(s). What should happen to history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Library only',
          onPress: () =>
            onRemoveExercise?.(exercise.name, { removeFromHistory: false }),
        },
        {
          text: 'Remove from history too',
          style: 'destructive',
          onPress: () =>
            onRemoveExercise?.(exercise.name, { removeFromHistory: true }),
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading Exercises...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>EXERCISE LIBRARY</Text>
          <Text style={styles.headerSubtitle}>{exercises.length} exercises</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCustomForm(true)}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={18} color={C.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close" size={18} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {categoryList.map(category => {
          const exs = grouped[category];
          if (!exs.length) return null;

          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryBar, { backgroundColor: CATEGORY_COLORS[category] || C.accent }]} />
                <Text style={[styles.categoryTitle, { color: CATEGORY_COLORS[category] || C.accent }]}>
                  {category}
                </Text>
                <Text style={styles.categoryCount}>{exs.length}</Text>
              </View>

              <View style={styles.exerciseList}>
                {exs.map((ex, idx) => {
                  const fieldHint = getResolvedFields(ex)
                    .map((f) => f.label)
                    .join(' • ');
                  return (
                    <View
                      key={ex.name}
                      style={[
                        styles.exerciseItem,
                        idx < exs.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.exerciseMain}
                        onPress={() => onAddToday?.(ex.name)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.exerciseName}>{ex.name}</Text>
                          {fieldHint ? (
                            <Text style={styles.fieldHint}>{fieldHint}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>

                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.iconAction}
                          onPress={() => setEditingExercise(ex)}
                        >
                          <MaterialCommunityIcons name="pencil" size={16} color={C.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconAction}
                          onPress={() => handleDelete(ex)}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={16} color={C.error} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.addExBtn,
                            { backgroundColor: `${CATEGORY_COLORS[category] || C.accent}15`, borderColor: CATEGORY_COLORS[category] || C.accent }
                          ]}
                          onPress={() => onAddToday?.(ex.name)}
                        >
                          <MaterialCommunityIcons
                            name="plus"
                            size={14}
                            color={CATEGORY_COLORS[category] || C.accent}
                          />
                          <Text style={[styles.addExBtnText, { color: CATEGORY_COLORS[category] || C.accent }]}>
                            ADD
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {filteredExercises.length === 0 && search && (
          <View style={styles.noResults}>
            <MaterialCommunityIcons name="magnify" size={40} color={`${C.muted}40`} />
            <Text style={styles.noResultsText}>No exercises found</Text>
          </View>
        )}
      </ScrollView>

      <CustomExerciseForm
        visible={showCustomForm}
        exercises={exercises}
        title="ADD CUSTOM EXERCISE"
        onClose={() => setShowCustomForm(false)}
        onSave={handleSaveCustom}
      />

      <CustomExerciseForm
        visible={Boolean(editingExercise)}
        exercises={exercises.filter((e) => e.name !== editingExercise?.name)}
        initialExercise={editingExercise}
        originalName={editingExercise?.name}
        title="EDIT EXERCISE"
        saveLabel="SAVE CHANGES"
        onClose={() => setEditingExercise(null)}
        onSave={handleEditSave}
      />
    </View>
  );
}

const createStyles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: C.muted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: C.text,
    fontSize: 13,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryBar: {
    width: 3,
    height: 18,
    borderRadius: 1.5,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  categoryCount: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '700',
  },
  exerciseList: {
    backgroundColor: C.card,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  exerciseMain: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
  },
  fieldHint: {
    fontSize: 10,
    color: C.muted,
    marginTop: 3,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconAction: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  addExBtnText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    color: C.muted,
    fontSize: 14,
    marginTop: 10,
  },
});
