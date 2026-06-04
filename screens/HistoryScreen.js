import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, prettyDate, todayStr } from '../constants/data';
import { deleteWorkout } from '../utils/firestore';

export default function HistoryScreen({ workouts, loading }) {
  const [selectedDate, setSelectedDate] = useState(null);

  const workoutDates = Object.keys(workouts)
    .filter(d => workouts[d]?.exs?.length)
    .sort()
    .reverse();

  const totalWorkouts = workoutDates.length;
  const selectedWorkout = selectedDate ? workouts[selectedDate] : null;
  const [deleting, setDeleting] = useState(false);
  const handleDeleteSelectedDate = async () => {
    if (!selectedDate || deleting) return;
    try {
      setDeleting(true);
      await deleteWorkout(selectedDate);
      setSelectedDate(null);
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
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading History...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
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

      {/* Calendar-style history */}
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {workoutDates.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="history" size={60} color={`${COLORS.muted}40`} />
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
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => (
                    <Text key={`${key}-${w}`} style={styles.weekHeaderText}>{w}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {cells.map((cell, idx) => (
                    cell ? (
                      <TouchableOpacity
                        key={cell.dateStr}
                        style={[
                          styles.dayCell,
                          cell.hasWorkout && styles.dayCellActive,
                          cell.isToday && styles.dayCellToday,
                        ]}
                        onPress={() => cell.hasWorkout && setSelectedDate(cell.dateStr)}
                        activeOpacity={cell.hasWorkout ? 0.8 : 1}
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
                      </TouchableOpacity>
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
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedDate ? prettyDate(selectedDate) : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={handleDeleteSelectedDate} disabled={deleting}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={COLORS.error} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedDate(null)}>
                  <MaterialCommunityIcons name="close" size={22} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
            </View>
            {selectedWorkout && (
              <ScrollView>
                {selectedWorkout.exs.map((ex, idx) => (
                  <View key={`${ex.name}-${idx}`} style={{ marginBottom: 10 }}>
                    <Text style={styles.detailExName}>{ex.name}</Text>
                    {ex.sets?.length ? ex.sets.map((set, sidx) => (
                      <Text key={sidx} style={styles.detailSet}>
                        {set.r
                          ? `${set.w > 0 ? `${set.w}kg` : 'BW'} × ${set.r} reps`
                          : `${set.durMin || 0} min${set.distKm ? ` • ${set.distKm} km` : ''}`}
                        {set.t ? ` • ${set.t}` : ''}
                      </Text>
                    )) : <Text style={styles.detailSet}>No sets logged</Text>}
                  </View>
                ))}
              </ScrollView>
            )}
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
    alignItems: 'center',
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
  headerStat: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.accent,
  },
  headerStatLabel: {
    fontSize: 9,
    color: COLORS.muted,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
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
    color: COLORS.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 6,
    textAlign: 'center',
  },
  monthCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    ...Platform.select({
      web: {
        maxWidth: 400,
        alignSelf: 'center',
        width: '100%',
      }
    })
  },
  monthTitle: {
    color: COLORS.text,
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
    color: COLORS.muted,
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
    backgroundColor: `${COLORS.accent}18`,
    borderWidth: 1,
    borderColor: `${COLORS.accent}80`,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    aspectRatio: 0.85,
  },
  dayText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  dayTextActive: {
    color: COLORS.text,
    fontWeight: '800',
  },
  dayTextToday: {
    color: COLORS.gold,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    ...Platform.select({
      web: {
        justifyContent: 'center',
        alignItems: 'center',
      }
    })
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    padding: 16,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      web: {
        width: '90%',
        maxWidth: 500,
        borderRadius: 16,
        borderWidth: 1,
      }
    })
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
    color: COLORS.text,
  },
  detailExName: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  detailSet: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 18,
  },
});
