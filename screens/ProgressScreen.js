import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Dimensions
} from 'react-native';
import { useTheme } from "../context/ThemeContext";
import { LineChart, BarChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { shortDate } from "../constants/data";

const { width } = Dimensions.get('window');

export default function ProgressScreen({ workouts, loading }) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
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

  // Epley formula — the standard estimate used in strength research:
  // 1RM ≈ weight × (1 + reps / 30). Lets you compare strength across
  // different rep schemes (5×80kg vs 10×70kg etc).
  const epley1RM = (w, r) => {
    if (!(w > 0)) return 0;
    if (!(r > 0)) return w;
    return w * (1 + r / 30);
  };

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
          e1rm: Math.round(Math.max(...strengthSets.map(s => epley1RM(s.w || 0, s.r || 0)))),
          vol: strengthSets.reduce((s, x) => s + (x.w || 0) * (x.r || 0), 0),
        };
      });
  }, [activeEx, workouts]);

  // Weekly training load: this week vs last week (progressive overload check)
  const weeklyStats = useMemo(() => {
    const toStr = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const thisStart = new Date(now);
    thisStart.setDate(now.getDate() - now.getDay());
    const lastStart = new Date(thisStart);
    lastStart.setDate(thisStart.getDate() - 7);
    const thisStartStr = toStr(thisStart);
    const lastStartStr = toStr(lastStart);

    let thisVol = 0;
    let lastVol = 0;
    let thisSets = 0;
    Object.entries(workouts || {}).forEach(([d, w]) => {
      (w.exs || []).forEach((e) =>
        (e.sets || []).forEach((s) => {
          const vol = (s.w || 0) * (s.r || 0);
          if (d >= thisStartStr) {
            thisVol += vol;
            thisSets += 1;
          } else if (d >= lastStartStr) {
            lastVol += vol;
          }
        }),
      );
    });
    const delta = lastVol > 0 ? Math.round(((thisVol - lastVol) / lastVol) * 100) : null;
    return { thisVol: Math.round(thisVol), thisSets, delta };
  }, [workouts]);

  const stats = {
    sessions: Object.values(workouts).filter(w => w.exs?.length).length,
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={C.accent} />
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
          styles={styles}
          icon="dumbbell"
          label="SESSIONS"
          value={stats.sessions}
          color={C.accent}
        />
        <StatBox
          styles={styles}
          icon="check-circle"
          label="SETS THIS WEEK"
          value={weeklyStats.thisSets}
          color={C.orange}
        />
        <StatBox
          styles={styles}
          icon="weight-kilogram"
          label={
            weeklyStats.delta === null
              ? "VOLUME THIS WEEK (weight × reps)"
              : `VOLUME THIS WEEK · ${weeklyStats.delta >= 0 ? "▲" : "▼"} ${Math.abs(weeklyStats.delta)}% vs last week`
          }
          value={`${weeklyStats.thisVol} kg`}
          color={weeklyStats.delta !== null && weeklyStats.delta < 0 ? C.orange : C.green}
        />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {exWithData.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chart-line" size={60} color={`${C.muted}40`} />
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
                      activeEx === ex && { backgroundColor: C.accent, borderColor: C.accent }
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
                  <Text style={styles.chartTitle}>📈 STRENGTH TREND (kg)</Text>
                  <LineChart
                    data={{
                      labels: progData.map(d => d.date),
                      datasets: [
                        {
                          data: progData.map(d => d.maxW),
                          strokeWidth: 2,
                          color: () => C.accent,
                        },
                        {
                          data: progData.map(d => d.e1rm),
                          strokeWidth: 2,
                          color: () => C.gold,
                        },
                      ],
                      legend: ["Max weight", "Est. 1RM"],
                    }}
                    width={chartWidth}
                    height={220}
                    chartConfig={{
                      backgroundColor: C.card,
                      backgroundGradientFrom: C.card,
                      backgroundGradientTo: C.surface,
                      decimalPlaces: 0,
                      color: () => C.muted,
                      labelColor: () => C.muted,
                      style: { borderRadius: 0 },
                      propsForDots: {
                        r: '4',
                        strokeWidth: '0',
                        stroke: C.accent,
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
                      backgroundColor: C.card,
                      backgroundGradientFrom: C.card,
                      backgroundGradientTo: C.surface,
                      decimalPlaces: 0,
                      color: () => C.muted,
                      labelColor: () => C.muted,
                      propsForBackgroundLines: {
                        stroke: C.border,
                      },
                    }}
                    style={{ marginVertical: 0, borderRadius: 0 }}
                  />
                </View>

                {/* Stats for selected exercise */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>STATS FOR {activeEx}{''}</Text>
                  {progData.length > 0 && (
                    <>
                      <View style={styles.statsGrid}>
                        <StatCard
                          styles={styles}
                          icon="arm-flex"
                          label="Est. 1RM (Epley)"
                          value={`${Math.max(...progData.map(d => d.e1rm))}kg`}
                          color={C.gold}
                        />
                        <StatCard
                          styles={styles}
                          icon="trending-up"
                          label="Heaviest Set"
                          value={`${Math.max(...progData.map(d => d.maxW))}kg`}
                          color={C.accent}
                        />
                        <StatCard
                          styles={styles}
                          icon="fire"
                          label="Best Session Vol"
                          value={`${Math.max(...progData.map(d => d.vol))}kg`}
                          color={C.orange}
                        />
                        <StatCard
                          styles={styles}
                          icon="calendar-check"
                          label="Sessions Logged"
                          value={progData.length}
                          color={C.green}
                        />
                      </View>
                      <Text style={styles.explainerText}>
                        Est. 1RM = weight × (1 + reps ÷ 30), the Epley formula used in
                        strength research. It lets you compare sessions with different
                        rep ranges. Session volume (weight × reps) is your total training
                        load — aim to increase it gradually week over week (progressive
                        overload).
                      </Text>
                    </>
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

function StatBox({ icon, label, value, color, styles }) {
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

function StatCard({ icon, label, value, color, styles }) {
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
  statsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: '900',
    color: C.text,
  },
  statBoxLabel: {
    fontSize: 9,
    color: C.muted,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 24,
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
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
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
    borderColor: C.border,
    backgroundColor: C.surface,
    minWidth: 60,
  },
  exButtonText: {
    color: C.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    marginBottom: 16,
    padding:12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCardBox: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
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
    color: C.muted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  explainerText: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    paddingHorizontal: 2,
    paddingBottom: 24,
  },
});
