import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CustomExerciseForm from '../components/CustomExerciseForm';
import { COLORS, CATEGORIES, CATEGORY_COLORS, PRESET_EXERCISES } from '../constants/data';

export default function ExercisesScreen({ exercises = PRESET_EXERCISES, onAddToday, onAddCustomExercise, loading }) {
  const handleAddToday = (name) => {
    if (typeof onAddToday === 'function') {
      onAddToday(name);
    }
  };

  const [search, setSearch] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

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

  const handleSaveCustom = async ({ name, category, fields }) => {
    if (typeof onAddCustomExercise === 'function') {
      await onAddCustomExercise(name, category, fields);
    }
    setShowCustomForm(false);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
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
        <MaterialCommunityIcons name="magnify" size={18} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close" size={18} color={COLORS.muted} />
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
                <View style={[styles.categoryBar, { backgroundColor: CATEGORY_COLORS[category] || COLORS.accent }]} />
                <Text style={[styles.categoryTitle, { color: CATEGORY_COLORS[category] || COLORS.accent }]}>
                  {category}
                </Text>
                <Text style={styles.categoryCount}>{exs.length}</Text>
              </View>

              <View style={styles.exerciseList}>
                {exs.map((ex, idx) => (
                  <TouchableOpacity
                    key={ex.name}
                    style={[
                      styles.exerciseItem,
                      idx < exs.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.border }
                    ]}
                    onPress={() => handleAddToday(ex.name)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      {ex.fields?.length ? (
                        <Text style={styles.fieldHint}>
                          {ex.fields.map((f) => f.label).join(' • ')}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.addExBtn,
                        { backgroundColor: `${CATEGORY_COLORS[category] || COLORS.accent}15`, borderColor: CATEGORY_COLORS[category] || COLORS.accent }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        size={14}
                        color={CATEGORY_COLORS[category] || COLORS.accent}
                      />
                      <Text style={[styles.addExBtnText, { color: CATEGORY_COLORS[category] || COLORS.accent }]}>
                        ADD
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {filteredExercises.length === 0 && search && (
          <View style={styles.noResults}>
            <MaterialCommunityIcons name="magnify" size={40} color={`${COLORS.muted}40`} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: COLORS.text,
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
    color: COLORS.muted,
    fontWeight: '700',
  },
  exerciseList: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  exerciseName: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  fieldHint: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 2,
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
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 10,
  },
});
