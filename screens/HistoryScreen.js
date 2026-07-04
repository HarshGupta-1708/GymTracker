import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal, Platform, TextInput, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HistoryExerciseCard from '../components/HistoryExerciseCard';
import { prettyDate, todayStr, PRESET_EXERCISES } from "../constants/data";
import { deleteWorkout, saveWorkout } from '../utils/firestore';
import { formatSetSummary, getDisplayFieldsForExercise } from '../utils/exerciseTracking';
import { useTheme } from "../context/ThemeContext";

const DOUBLE_TAP_DELAY = 300;

export default function HistoryScreen({ workouts, loading, onWorkoutsChange, exercises = PRESET_EXERCISES }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('summary');
  const [dayTitleEdit, setDayTitleEdit] = useState('');
  const lastTapRef = useRef({ date: null, time: 0 });
  const singleTapTimer = useRef(null);

  const workoutDates = Object.keys(workouts)
    .filter(d => workouts[d]?.exs?.length)
    .sort()
    .reverse();

  const totalWorkouts = workoutDates.length;
  const selectedWorkout = selectedDate ? workouts[selectedDate] : null;
  const [deleting, setDeleting] = useState(false);

  const openDate = (dateStr, mode = 'summary') => {
    setSelectedDate(dateStr);
    setViewMode(mode);
    setDayTitleEdit(workouts[dateStr]?.dayTitle || '');
  };

  const closeModal = () => {
    setSelectedDate(null);
    setViewMode('summary');
  };

  const handleDayPress = (dateStr) => {
    const now = Date.now();
    const { date: lastDate, time: lastTime } = lastTapRef.current;

    if (lastDate === dateStr && now - lastTime < DOUBLE_TAP_DELAY) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastTapRef.current = { date: null, time: 0 };
      openDate(dateStr, 'full');
      return;
    }

    lastTapRef.current = { date: dateStr, time: now };
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      openDate(dateStr, 'summary');
      singleTapTimer.current = null;
    }, DOUBLE_TAP_DELAY);
  };

  const saveDayTitle = async () => {
    if (!selectedDate || !selectedWorkout) return;
    const updated = { ...selectedWorkout, dayTitle: dayTitleEdit.trim() };
    await saveWorkout(selectedDate, updated);
    if (typeof onWorkoutsChange === 'function') {
      onWorkoutsChange({ ...workouts, [selectedDate]: updated });
    }
  };

  const handleDeleteSelectedDate = async () => {
    if (!selectedDate || deleting) return;
    try {
      setDeleting(true);
      await deleteWorkout(selectedDate);
      closeModal();
    } finally {
      setDeleting(false);
    }
  };

  const monthGroups = useMemo(() => {
    const grouped = {};
    workoutDates.forEach((dateStr) => {
      const d = new Date(`${dateStr}T12:00`);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(dateStr);
    });
    return Object.entries(grouped).map(([key, dates]) => ({ key, dates }));
  }, [workoutDates]);

  const buildMonthGrid = (monthKey, monthDates) => {
    const [year, month] = monthKey.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = firstDay.getDay();
    const active = new Set(monthDates);
    const cells = [];

    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        dateStr,
        day,
        hasWorkout: active.has(dateStr),
        isToday: dateStr === todayStr(),
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const monthLabel = (monthKey) => {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading History...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>WORKOUT HISTORY</Text>
          <Text style={styles.headerSubtitle}>{totalWorkouts} sessions logged</Text>
        </View>
        <View style={styles.headerStat}>
          <Text style={styles.headerStatValue}>{totalWorkouts}</Text>
          <Text style={styles.headerStatLabel}>TOTAL</Text>
        </View>
      </View>

      <Text style={styles.hintBar}>Tap day for summary · Double-tap for full workout view</Text>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {workoutDates.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="history" size={60} color={`${C.muted}40`} />
            <Text style={styles.emptyTitle}>No History Yet</Text>
            <Text style={styles.emptySubtitle}>Start logging workouts to see them here</Text>
          </View>
        ) : (
          monthGroups.map(({ key, dates }) => {
            const cells = buildMonthGrid(key, dates);
            return (
              <View key={key} style={styles.monthCard}>
                <Text style={styles.monthTitle}>{monthLabel(key)}</Text>
                <View style={styles.weekHeader}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
                    <Text key={`${key}-${w}-${i}`} style={styles.weekHeaderText}>{w}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {cells.map((cell, idx) => (
                    cell ? (
                      <Pressable
                        key={cell.dateStr}
                        style={({ pressed }) => [
                          styles.dayCell,
                          cell.hasWorkout && styles.dayCellActive,
                          cell.isToday && styles.dayCellToday,
                          pressed && cell.hasWorkout && styles.dayCellPressed,
                        ]}
                        onPress={() => cell.hasWorkout && handleDayPress(cell.dateStr)}
                        disabled={!cell.hasWorkout}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            cell.hasWorkout && styles.dayTextActive,
                            cell.isToday && styles.dayTextToday,
                          ]}
                        >
                          {cell.day}
                        </Text>
                        {cell.hasWorkout && <View style={styles.dot} />}
                      </Pressable>
                    ) : (
                      <View key={`${key}-empty-${idx}`} style={styles.dayCellEmpty} />
                    )
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={Boolean(selectedDate)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, viewMode === 'full' && styles.modalCardFull]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedDate ? prettyDate(selectedDate) : ''}</Text>
                {selectedWorkout?.dayTitle ? (
                  <Text style={styles.modalDayTitle}>{selectedWorkout.dayTitle}</Text>
                ) : null}
                <Text style={styles.modalModeLabel}>
                  {viewMode === 'full' ? 'Full workout view' : 'Summary view'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => setViewMode(viewMode === 'full' ? 'summary' : 'full')}
                >
                  <MaterialCommunityIcons
                    name={viewMode === 'full' ? 'format-list-text' : 'view-agenda'}
                    size={20}
                    color={C.accent}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteSelectedDate} disabled={deleting}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={C.error} />
                </TouchableOpacity>
                <TouchableOpacity onPress={closeModal}>
                  <MaterialCommunityIcons name="close" size={22} color={C.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedWorkout && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {viewMode === 'summary' && (
                  <View style={styles.dayTitleEditRow}>
                    <MaterialCommunityIcons name="label-outline" size={16} color={C.accent} />
                    <TextInput
                      style={styles.dayTitleEditInput}
                      placeholder="Workout name (Leg Day, Push Pull...)"
                      placeholderTextColor={C.muted}
                      value={dayTitleEdit}
                      onChangeText={setDayTitleEdit}
                      onBlur={saveDayTitle}
                      onSubmitEditing={saveDayTitle}
                    />
                  </View>
                )}

                {viewMode === 'full' ? (
                  selectedWorkout.exs.map((ex, idx) => {
                    const exerciseDef = exercises.find((e) => e.name === ex.name);
                    const fields = getDisplayFieldsForExercise(exerciseDef, ex);
                    const cat = exerciseDef?.category || 'Custom';
                    return (
                      <HistoryExerciseCard
                        key={`${ex.name}-${idx}`}
                        ex={ex}
                        category={cat}
                        fields={fields}
                      />
                    );
                  })
                ) : (
                  selectedWorkout.exs.map((ex, idx) => {
                    const exerciseDef = exercises.find((e) => e.name === ex.name);
                    const fields = getDisplayFieldsForExercise(exerciseDef, ex);
                    return (
                      <TouchableOpacity
                        key={`${ex.name}-${idx}`}
                        activeOpacity={0.7}
                        onPress={() => setViewMode('full')}
                      >
                        <View style={styles.summaryExBlock}>
                          <Text style={styles.detailExName}>{ex.name}</Text>
                          {ex.sets?.length ? ex.sets.map((set, sidx) => (
                            <Text key={sidx} style={styles.detailSet}>
                              {formatSetSummary(fields, set)}
                              {set.t ? `  ·  ${set.t}` : ''}
                            </Text>
                          )) : <Text style={styles.detailSet}>No sets logged</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
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
  headerStat: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: C.accent,
  },
  headerStatLabel: {
    fontSize: 9,
    color: C.muted,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
  hintBar: {
    textAlign: 'center',
    color: C.muted,
    fontSize: 11,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.muted,
    marginTop: 6,
    textAlign: 'center',
  },
  monthCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    ...Platform.select({
      web: { maxWidth: 400, alignSelf: 'center', width: '100%' },
    }),
  },
  monthTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 2,
  },
  dayCellActive: {
    backgroundColor: `${C.accent}18`,
    borderWidth: 1,
    borderColor: `${C.accent}80`,
  },
  dayCellPressed: {
    backgroundColor: `${C.accent}30`,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: C.gold,
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    aspectRatio: 0.85,
  },
  dayText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  dayTextActive: {
    color: C.text,
    fontWeight: '800',
  },
  dayTextToday: {
    color: C.gold,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.accent,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    ...Platform.select({
      web: { justifyContent: 'center', alignItems: 'center' },
    }),
  },
  modalCard: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    padding: 16,
    borderTopWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      web: { width: '90%', maxWidth: 500, borderRadius: 16, borderWidth: 1 },
    }),
  },
  modalCardFull: {
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  modalDayTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
    marginTop: 4,
  },
  modalModeLabel: {
    fontSize: 10,
    color: C.muted,
    marginTop: 4,
    fontWeight: '600',
  },
  dayTitleEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    backgroundColor: C.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  dayTitleEditInput: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryExBlock: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  detailExName: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  detailSet: {
    color: C.muted,
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 18,
  },
});
