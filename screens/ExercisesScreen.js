import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, SectionList, Modal, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, CATEGORIES, CATEGORY_COLORS, PRESET_EXERCISES } from '../constants/data';

export default function ExercisesScreen({ exercises = PRESET_EXERCISES, onAddToday, onAddCustomExercise, loading }) {
  const handleAddToday = (name) => {
    if (typeof onAddToday === 'function') {
      onAddToday(name);
      return;
    }
  };

  const [search, setSearch] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Custom');

  const filteredExercises = useMemo(() => {
    return exercises.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [exercises, search]);

  const grouped = useMemo(() => {
    const groups = {};
    CATEGORIES.forEach(cat => {
      groups[cat] = filteredExercises.filter(e => e.category === cat);
    });
    return groups;
  }, [filteredExercises]);

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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>EXERCISE LIBRARY</Text>
          <Text style={styles.headerSubtitle}>{exercises.length} exercises</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCustomModal(true)}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Search */}
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

      {/* Exercises by Category */}
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {CATEGORIES.map(category => {
          const exs = grouped[category];
          if (!exs.length) return null;

          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryBar, { backgroundColor: CATEGORY_COLORS[category] }]} />
                <Text style={[styles.categoryTitle, { color: CATEGORY_COLORS[category] }]}>
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
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <View
                      style={[
                        styles.addExBtn,
                        { backgroundColor: `${CATEGORY_COLORS[category]}15`, borderColor: CATEGORY_COLORS[category] }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        size={14}
                        color={CATEGORY_COLORS[category]}
                      />
                      <Text style={[styles.addExBtnText, { color: CATEGORY_COLORS[category] }]}>
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

      {/* Custom Exercise Modal */}
      <Modal transparent animationType="slide" visible={showCustomModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ADD CUSTOM EXERCISE</Text>
              <TouchableOpacity onPress={() => {
                setShowCustomModal(false);
                setCustomName('');
                setCustomCategory('Custom');
              }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>EXERCISE NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Leg Extension"
              placeholderTextColor={COLORS.muted}
              value={customName}
              onChangeText={setCustomName}
            />

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryBtn,
                    customCategory === cat && {
                      backgroundColor: CATEGORY_COLORS[cat],
                      borderColor: CATEGORY_COLORS[cat],
                    }
                  ]}
                  onPress={() => setCustomCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryBtnText,
                      customCategory === cat && { color: '#000', fontWeight: '700' }
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => {
                if (customName.trim()) {
                  if (typeof onAddCustomExercise === 'function') {
                    onAddCustomExercise(customName.trim(), customCategory);
                  }
                  setShowCustomModal(false);
                  setCustomName('');
                  setCustomCategory('Custom');
                }
              }}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#000" />
              <Text style={styles.buttonTextPrimary}>ADD EXERCISE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    flex: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    ...Platform.select({
      web: {
        justifyContent: 'center',
        alignItems: 'center',
      }
    })
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...Platform.select({
      web: {
        width: '90%',
        maxWidth: 500,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
      }
    })
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 8,
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
  categoryGrid: {
    marginBottom: 16,
  },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
    backgroundColor: COLORS.surface,
  },
  categoryBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: COLORS.accent,
  },
  buttonTextPrimary: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
