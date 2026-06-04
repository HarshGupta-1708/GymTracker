import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Dimensions
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, shortDate } from '../constants/data';

const { width } = Dimensions.get('window');

export default function ProgressScreen({ workouts, loading }) {
  const [selectedEx, setSelectedEx] = useState(null);
  const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - 32);

  const handleLayout = (event) => {
    const { width: layoutWidth } = event.nativeEvent.layout;
    if (layoutWidth > 0) {
      setChartWidth(layoutWidth);
    }
  };

  // Get all exercises with data
  const exWithData = useMemo(() => {
    const exSet = new Set();
    Object.values(workouts).forEach(w => {
      w.exs?.forEach(e => {
        if (e.sets?.some(s => (s.r || 0) > 0 || (s.w || 0) > 0)) {
          exSet.add(e.name);
        }
      });
    });
    return Array.from(exSet);
  }, [workouts]);

  const activeEx = selectedEx || exWithData[0];

  const progData = useMemo(() => {
    if (!activeEx) return [];
    
    return Object.entries(workouts)
      .filter(([_, w]) => w.exs?.find(e => e.name === activeEx && e.sets.some(s => (s.r || 0) > 0 || (s.w || 0) > 0)))
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-20)
      .map(([d, w]) => {
        const ex = w.exs.find(e => e.name === activeEx);
        const strengthSets = ex.sets.filter(s => (s.r || 0) > 0 || (s.w || 0) > 0);
        return {
          date: shortDate(d),
          maxW: Math.max(...strengthSets.map(s => s.w || 0)),
          vol: strengthSets.reduce((s, x) => s + (x.w || 0) * (x.r || 0), 0),
        };
      });
  }, [activeEx, workouts]);

  // Aggregate stats
  const allSets = Object.values(workouts).flatMap(w =>
    (w.exs || []).flatMap(e => e.sets)
  );

  const stats = {
    sessions: Object.values(workouts).filter(w => w.exs?.length).length,
    totalSets: allSets.length,
    totalVolume: Math.round(allSets.reduce((s, x) => s + (x.w || 0) * (x.r || 0), 0)),
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading Progress...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>PROGRESS</Text>
          <Text style={styles.headerSubtitle}>Your fitness journey</Text>
        </View>
      </View>

      {/* Overview Stats */}
      <View style={styles.statsContainer}>
        <StatBox
          icon="dumbbell"
          label="SESSIONS"
          value={stats.sessions}
          color={COLORS.accent}
        />
        <StatBox
          icon="check-circle"
          label="TOTAL SETS"
          value={stats.totalSets}
          color={COLORS.orange}
        />
        <StatBox
          icon="weight-kilogram"
          label="TOTAL VOLUME"
          value={stats.totalVolume}
          color={COLORS.green}
        />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {exWithData.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chart-line" size={60} color={`${COLORS.muted}40`} />
            <Text style={styles.emptyTitle}>No Progress Data Yet</Text>
            <Text style={styles.emptySubtitle}>Log workouts to see your progress charts</Text>
          </View>
        ) : (
          <>
            {/* Exercise Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SELECT EXERCISE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exScroll}>
                {exWithData.map(ex => (
                  <TouchableOpacity
                    key={ex}
                    style={[
                      styles.exButton,
                      activeEx === ex && { backgroundColor: COLORS.accent, borderColor: COLORS.accent }
                    ]}
                    onPress={() => setSelectedEx(ex)}
                  >
                    <Text
                      style={[
                        styles.exButtonText,
                        activeEx === ex && { color: '#000', fontWeight: '700' }
                      ]}
                      numberOfLines={2}
                    >
                      {ex}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Charts */}
            {progData.length > 0 && (
              <View onLayout={handleLayout}>
                {/* Max Weight Chart */}
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>📈 MAX WEIGHT PROGRESSION (kg)</Text>
                  <LineChart
                    data={{
                      labels: progData.map(d => d.date),
                      datasets: [{
                        data: progData.map(d => d.maxW),
                        strokeWidth: 2,
                        color: () => COLORS.accent,
                      }],
                    }}
                    width={chartWidth}
                    height={220}
                    chartConfig={{
                      backgroundColor: COLORS.card,
                      backgroundGradientFrom: COLORS.card,
                      backgroundGradientTo: COLORS.surface,
                      decimalPlaces: 0,
                      color: () => COLORS.muted,
                      labelColor: () => COLORS.muted,
                      style: { borderRadius: 0 },
                      propsForDots: {
                        r: '4',
                        strokeWidth: '0',
                        stroke: COLORS.accent,
                      },
                    }}
                    style={{ marginVertical: 0, borderRadius: 0 }}
                    bezier
                  />
                </View>

                {/* Volume Chart */}
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>💪 SESSION VOLUME (kg × reps)</Text>
                  <BarChart
                    data={{
                      labels: progData.map(d => d.date),
                      datasets: [{
                        data: progData.map(d => d.vol),
                      }],
                    }}
                    width={chartWidth}
                    height={220}
                    chartConfig={{
                      backgroundColor: COLORS.card,
                      backgroundGradientFrom: COLORS.card,
                      backgroundGradientTo: COLORS.surface,
                      decimalPlaces: 0,
                      color: () => COLORS.muted,
                      labelColor: () => COLORS.muted,
                      propsForBackgroundLines: {
                        stroke: COLORS.border,
                      },
                    }}
                    style={{ marginVertical: 0, borderRadius: 0 }}
                  />
                </View>

                {/* Stats for selected exercise */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>STATS FOR {activeEx}{''}</Text>
                  {progData.length > 0 && (
                    <View style={styles.statsGrid}>
                      <StatCard
                        icon="trending-up"
                        label="Personal Best"
                        value={`${Math.max(...progData.map(d => d.maxW))}kg`}
                        color={COLORS.gold}
                      />
                      <StatCard
                        icon="calendar-check"
                        label="Sessions"
                        value={progData.length}
                        color={COLORS.accent}
                      />
                      <StatCard
                        icon="chart-area"
                        label="Avg Volume"
                        value={`${Math.round(progData.reduce((s, d) => s + d.vol, 0) / progData.length)}`}
                        color={COLORS.green}
                      />
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({ icon, label, value, color }) {
  return (
    <View style={[styles.statBox, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={styles.statBoxValue}>{value}</Text>
        <Text style={styles.statBoxLabel}>{label}</Text>
      </View>
    </View>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <View style={styles.statCardBox}>
      <View style={[styles.statCardIcon, { backgroundColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statCardValue, { color }]}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
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
  statsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  statBoxLabel: {
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
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  exScroll: {
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  exButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    minWidth: 60,
  },
  exButtonText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 16,
    padding:12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCardBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  statCardLabel: {
    fontSize: 9,
    color: COLORS.muted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
