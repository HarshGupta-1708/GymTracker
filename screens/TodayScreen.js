import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { CATEGORIES, CATEGORY_COLORS, PRESET_EXERCISES, WORKOUT_PLANS, prettyDate, shortDate, toDateStr, todayStr } from "../constants/data";
import CustomExerciseForm from "../components/CustomExerciseForm";
import { useTheme } from "../context/ThemeContext";
import { estimateKcal, saveWorkout } from "../utils/firestore";
import {
    buildSetFromFields,
    formatSetFieldValue,
    getDisplayFieldsForExercise,
    getExerciseFields,
    validateSetFields,
} from "../utils/exerciseTracking";

const { width } = Dimensions.get("window");

export default function TodayScreen({
  navigation,
  exercises: propExercises = PRESET_EXERCISES,
  workouts: propWorkouts,
  onWorkoutsChange,
  onAddCustomExercise,
}) {
  const { colors: C } = useTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const [date, setDate] = useState(todayStr());
  const [localWorkouts, setLocalWorkouts] = useState({});
  const workoutsRef = useRef({});
  const useSharedWorkouts = propWorkouts !== undefined;
  const workouts = useSharedWorkouts ? propWorkouts : localWorkouts;
  const exLib = propExercises;
  const [loading, setLoading] = useState(!useSharedWorkouts);
  const [syncing, setSyncing] = useState(false);
  const [dayTitleDraft, setDayTitleDraft] = useState("");

  // Modals
  const [modal, setModal] = useState(null);
  const [addSetFor, setAddSetFor] = useState(null);
  const [setFieldValues, setSetFieldValues] = useState({});
  const [exSearch, setExSearch] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    workoutsRef.current = workouts;
  }, [workouts]);

  useEffect(() => {
    if (useSharedWorkouts) {
      setLoading(false);
    }
  }, [useSharedWorkouts, propWorkouts]);

  const wk = workouts[date] || { exs: [] };

  useEffect(() => {
    setDayTitleDraft(wk.dayTitle || "");
  }, [date, wk.dayTitle]);
  const isToday = date === todayStr();
  const hasCompleted = Boolean(wk.completedAt);

  const setWorkoutsState = (updater) => {
    const prev = workoutsRef.current;
    const next = typeof updater === "function" ? updater(prev) : updater;
    workoutsRef.current = next;
    if (useSharedWorkouts && onWorkoutsChange) {
      onWorkoutsChange(next);
    } else {
      setLocalWorkouts(next);
    }
    return next;
  };

  const updWk = async (val) => {
    setWorkoutsState((p) => ({ ...p, [date]: val }));
    setSyncing(true);
    await saveWorkout(date, val);
    setSyncing(false);
  };

  const addExToDay = async (name) => {
    if (!wk.exs.find((e) => e.name === name)) {
      await updWk({ ...wk, exs: [...wk.exs, { name, sets: [] }] });
    }
    setModal(null);
    setExSearch("");
  };

  const addPlan = async (planName) => {
    const names = WORKOUT_PLANS[planName];
    const existing = new Set(wk.exs.map((e) => e.name));
    await updWk({
      ...wk,
      exs: [
        ...wk.exs,
        ...names
          .filter((n) => !existing.has(n))
          .map((n) => ({ name: n, sets: [] })),
      ],
    });
    setModal(null);
  };

  const removeEx = async (name) => {
    const latestWk = workoutsRef.current[date] || { exs: [] };
    await updWk({ ...latestWk, exs: latestWk.exs.filter((e) => e.name !== name) });
  };

  const copyWorkoutFrom = async (fromDate) => {
    const sourceWk = workouts[fromDate];
    if (!sourceWk || !sourceWk.exs || sourceWk.exs.length === 0) {
      Alert.alert("No Workout", `No workout found on ${prettyDate(fromDate)}`);
      return;
    }

    // Copy exercises only, not old set logs.
    const copiedExs = sourceWk.exs.map((ex) => ({
      name: ex.name,
      sets: [],
    }));

    // Merge with existing (don't duplicate)
    const existing = new Set(wk.exs.map((e) => e.name));
    const newExs = [
      ...wk.exs,
      ...copiedExs.filter((ex) => !existing.has(ex.name)),
    ];

    await updWk({
      ...wk,
      exs: newExs,
      dayTitle: sourceWk.dayTitle || wk.dayTitle || "",
    });
    setModal(null);
    Alert.alert(
      "✓ Copied!",
      `${copiedExs.length} exercises copied from ${prettyDate(fromDate)}`,
    );
  };

  const getPreviousWorkoutDates = () => {
    return Object.keys(workouts)
      .filter((d) => d < date && workouts[d]?.exs?.length > 0)
      .sort()
      .reverse()
      .slice(0, 7); // Last 7 workouts
  };

  const openAddSet = (name) => {
    const exercise = exLib.find((e) => e.name === name);
    const fields = getExerciseFields(exercise || { name, category: "Custom" });
    // Sort by date so the prefill really is the most recent set logged.
    const allSets = Object.keys(workouts)
      .sort()
      .flatMap((d) =>
        (workouts[d]?.exs || [])
          .filter((e) => e.name === name)
          .flatMap((e) => e.sets || []),
      );
    const last = allSets[allSets.length - 1];
    const initial = {};
    fields.forEach((f) => {
      initial[f.key] = last?.[f.key] !== undefined ? String(last[f.key]) : "";
    });
    setSetFieldValues(initial);
    setAddSetFor(name);
    setModal("addSet");
  };

  const saveSet = async () => {
    if (!addSetFor) {
      Alert.alert("Error", "Select an exercise first");
      return;
    }

    const exercise = exLib.find((e) => e.name === addSetFor);
    const fields = getExerciseFields(exercise || { name: addSetFor, category: "Custom" });
    const err = validateSetFields(fields, setFieldValues);
    if (err) return Alert.alert("Error", err);

    const newSet = buildSetFromFields(fields, setFieldValues);
    const latestWk = workoutsRef.current[date] || { exs: [] };
    await updWk({
      ...latestWk,
      exs: latestWk.exs.map((e) =>
        e.name === addSetFor
          ? { ...e, sets: [...e.sets, newSet] }
          : e,
      ),
    });
    setSetFieldValues({});
    setModal(null);
  };

  const completeWorkout = async () => {
    const latestWk = workoutsRef.current[date] || { exs: [] };
    if (!latestWk.exs?.length) {
      Alert.alert("No workout", "Add at least one exercise first.");
      return;
    }
    const kcal = latestWk.exs.reduce((sum, ex) => sum + estimateKcal(ex.sets || []), 0);
    await updWk({
      ...latestWk,
      completedAt: new Date().toISOString(),
      completedDate: date,
      completionSummary: {
        kcal: Math.round(kcal),
      },
    });
    Alert.alert(
      "Workout Completed 🎉",
      `Great job! 💪\nToday approx ${Math.round(kcal)} kcal burned.`,
      [{ text: "OK" }],
    );
    navigation?.navigate("Dashboard");
  };

  const removeSet = async (exName, idx) => {
    const latestWk = workoutsRef.current[date] || { exs: [] };
    await updWk({
      ...latestWk,
      exs: latestWk.exs.map((e) =>
        e.name === exName
          ? { ...e, sets: e.sets.filter((_, i) => i !== idx) }
          : e,
      ),
    });
  };

  const addCustomEx = async ({ name, category, fields }) => {
    if (!name.trim()) return;
    if (!exLib.find((e) => e.name === name.trim())) {
      if (typeof onAddCustomExercise === "function") {
        await onAddCustomExercise(name.trim(), category, fields);
      }
    }
    setShowCustomForm(false);
    setModal("addEx");
  };

  const saveDayTitle = async () => {
    const trimmed = dayTitleDraft.trim();
    if (trimmed === (wk.dayTitle || "")) return;
    await updWk({ ...wk, dayTitle: trimmed });
  };

  const changeDate = (n) => {
    const d = new Date(date + "T12:00");
    d.setDate(d.getDate() + n);
    setDate(toDateStr(d));
  };

  const handleDatePick = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(toDateStr(selectedDate));
    }
  };

  // For every exercise logged today, find the last 3 PREVIOUS sessions
  // (any earlier date where that exact exercise was logged with sets),
  // so the user can see what weight/reps they did last time.
  const prevSessionsByExercise = useMemo(() => {
    const priorDates = Object.keys(workouts)
      .filter((d) => d < date)
      .sort()
      .reverse();
    const map = {};
    (workouts[date]?.exs || []).forEach((ex) => {
      const sessions = [];
      for (const d of priorDates) {
        const found = (workouts[d]?.exs || []).find((e) => e.name === ex.name);
        if (found?.sets?.length) {
          sessions.push({
            date: d,
            dayTitle: workouts[d]?.dayTitle || "",
            sets: found.sets,
          });
          if (sessions.length === 3) break;
        }
      }
      map[ex.name] = sessions;
    });
    return map;
  }, [workouts, date]);

  const allMaxW = (exName) =>
    Object.values(workouts).flatMap((w) =>
      (w.exs || [])
        .filter((e) => e.name === exName)
        .flatMap((e) => e.sets)
        .map((s) => s.w || 0),
    );

  const stats = {
    exercises: wk.exs.length,
    sets: wk.exs.reduce((s, e) => s + e.sets.length, 0),
    volume: Math.round(
      wk.exs.reduce(
        (s, e) => s + e.sets.reduce((ss, x) => ss + (x.w || 0) * (x.r || 0), 0),
        0,
      ),
    ),
  };

  const filtAddEx = exLib.filter(
    (e) =>
      e.name.toLowerCase().includes(exSearch.toLowerCase()) &&
      !wk.exs.find((we) => we.name === e.name),
  );

  const groupedAdd = (cat) => filtAddEx.filter((e) => e.category === cat);

  const categoryList = useMemo(() => {
    const fromLib = [...new Set(exLib.map((e) => e.category).filter(Boolean))];
    return [...new Set([...CATEGORIES, ...fromLib])];
  }, [exLib]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading Workouts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>TODAY'S WORKOUT</Text>
          <TouchableOpacity onPress={() => setModal("calendarLookup")} style={{ alignSelf: 'flex-start', marginTop: 2 }}>
            <Text style={[styles.headerDate, { color: C.accent, fontWeight: '700' }]}>
              {prettyDate(date)} ▾
            </Text>
            {wk.dayTitle ? (
              <Text style={styles.headerDayTitle}>{wk.dayTitle}</Text>
            ) : null}
          </TouchableOpacity>
        </View>
        <View style={styles.syncing}>
          {syncing && <ActivityIndicator size="small" color={C.accent} />}
          <Text
            style={[
              styles.syncText,
              { color: syncing ? C.accent : C.green },
            ]}
          >
            {syncing ? "Syncing..." : "Synced"}
          </Text>
        </View>
      </View>

      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(-1)}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={C.muted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={() => setModal("calendarLookup")}
        >
          <MaterialCommunityIcons
            name="calendar"
            size={16}
            color={C.accent}
          />
          <Text style={styles.dateText}>{prettyDate(date)} ▾</Text>
        </TouchableOpacity>
        {!isToday && (
          <TouchableOpacity style={styles.todayBadge} onPress={() => setDate(todayStr())}>
            <Text style={styles.todayBadgeText}>Today</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => changeDate(1)}
          disabled={date >= todayStr()}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={date >= todayStr() ? C.muted : C.text}
          />
        </TouchableOpacity>
      </View>

      {/* Workout Day Name */}
      <View style={styles.dayTitleRow}>
        <MaterialCommunityIcons name="label-outline" size={18} color={C.accent} />
        <TextInput
          style={styles.dayTitleInput}
          placeholder="Workout name (e.g. Leg Day, Push Pull)"
          placeholderTextColor={C.muted}
          value={dayTitleDraft}
          onChangeText={setDayTitleDraft}
          onBlur={saveDayTitle}
          onSubmitEditing={saveDayTitle}
          returnKeyType="done"
        />
      </View>

      {/* Stats */}
      {wk.exs.length > 0 && (
        <View style={styles.stats}>
          <StatCard
            styles={styles}
            label="EXERCISES"
            value={stats.exercises}
            color={C.accent}
          />
          <StatCard styles={styles} label="SETS" value={stats.sets} color={C.orange} />
          <StatCard
            styles={styles}
            label="VOLUME"
            value={`${stats.volume}kg`}
            color={C.green}
          />
        </View>
      )}

      {/* Exercises List */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {wk.exs.length === 0 ? (
          <EmptyState
            styles={styles}
            C={C}
            onAddEx={() => setModal("addEx")}
            onAddPlan={() => setModal("plan")}
            onAddCopy={
              getPreviousWorkoutDates().length > 0
                ? () => setModal("copy")
                : null
            }
          />
        ) : (
          <>
            {wk.exs.map((ex) => {
              const exerciseDef = exLib.find((e) => e.name === ex.name);
              const cat = exerciseDef?.category || "Custom";
              const color = CATEGORY_COLORS[cat] || C.accent;
              const fields = getDisplayFieldsForExercise(exerciseDef, ex);
              const allW = allMaxW(ex.name);
              const maxSetW = ex.sets.length
                ? Math.max(...ex.sets.map((s) => s.w || 0))
                : 0;
              const isPR =
                allW.length > 0 && maxSetW > 0 && maxSetW >= Math.max(...allW);

              return (
                <ExerciseCard
                  styles={styles}
                  C={C}
                  key={ex.name}
                  ex={ex}
                  cat={cat}
                  color={color}
                  fields={fields}
                  isPR={isPR}
                  prevSessions={prevSessionsByExercise[ex.name] || []}
                  onAddSet={() => openAddSet(ex.name)}
                  onRemoveEx={() => removeEx(ex.name)}
                  onRemoveSet={(idx) => removeSet(ex.name, idx)}
                />
              );
            })}
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, { flex: 1 }]}
                onPress={() => setModal("addEx")}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#000" />
                <Text style={styles.buttonTextPrimary}>Exercise</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonOutline, { flex: 1 }]}
                onPress={() => setModal("plan")}
              >
                <MaterialCommunityIcons
                  name="flash"
                  size={18}
                  color={C.accent}
                />
                <Text style={styles.buttonTextOutline}>Load Plan</Text>
              </TouchableOpacity>
              {getPreviousWorkoutDates().length > 0 && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonOutline, { flex: 1 }]}
                  onPress={() => setModal("copy")}
                >
                  <MaterialCommunityIcons
                    name="content-copy"
                    size={18}
                    color={C.accent}
                  />
                  <Text style={styles.buttonTextOutline}>Copy</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, { marginBottom: 24, opacity: hasCompleted ? 0.7 : 1 }]}
              onPress={completeWorkout}
              disabled={hasCompleted}
            >
              <MaterialCommunityIcons name={hasCompleted ? "check-decagram" : "party-popper"} size={18} color="#000" />
              <Text style={styles.buttonTextPrimary}>
                {hasCompleted ? "COMPLETED 🎉" : "COMPLETE WORKOUT 🎉"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Modals */}
      {modal === "addSet" && (
        <AddSetModal
          styles={styles}
          C={C}
          exerciseName={addSetFor}
          exercise={exLib.find((e) => e.name === addSetFor)}
          fieldValues={setFieldValues}
          onFieldChange={(key, val) =>
            setSetFieldValues((p) => ({ ...p, [key]: val }))
          }
          onSave={saveSet}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "addEx" && (
        <AddExerciseModal
          styles={styles}
          C={C}
          search={exSearch}
          onSearchChange={setExSearch}
          exercises={exLib}
          categoryList={categoryList}
          groupedAdd={groupedAdd}
          onSelectEx={addExToDay}
          onClose={() => {
            setModal(null);
            setExSearch("");
          }}
          onAddCustom={() => {
            setModal(null);
            setShowCustomForm(true);
          }}
        />
      )}

      <CustomExerciseForm
        visible={showCustomForm}
        exercises={exLib}
        onClose={() => {
          setShowCustomForm(false);
          setModal("addEx");
        }}
        onSave={addCustomEx}
      />

      {modal === "plan" && (
        <PlanModal
          styles={styles}
          C={C}
          plans={WORKOUT_PLANS}
          onSelectPlan={addPlan}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "copy" && (
        <CopyWorkoutModal
          styles={styles}
          C={C}
          previousDates={getPreviousWorkoutDates()}
          workouts={workouts}
          onSelectDate={copyWorkoutFrom}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "calendarLookup" && (
        <CalendarLookupModal
          styles={styles}
          C={C}
          currentDate={date}
          workouts={workouts}
          onSelectDate={(selectedDate) => {
            setDate(selectedDate);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </View>
  );
}

function StatCard({ label, value, color, styles }) {
  return (
    <View
      style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatPrevSet(fields, set) {
  const present = (fields || []).filter((f) => {
    const v = set[f.key];
    return v !== undefined && v !== null && v !== "";
  });
  if (!present.length) return "0 × 0";

  // Plain weight+reps exercises get the classic compact "60kg × 8".
  const onlyWeightReps = present.every((f) => f.key === "w" || f.key === "r");
  if (onlyWeightReps) {
    const w = set.w !== undefined ? formatSetFieldValue({ key: "w", unit: "kg" }, set.w) : "BW";
    return `${w} × ${set.r ?? 0}`;
  }

  // Exercises with extra/custom fields get labelled values so numbers
  // are never ambiguous, e.g. "Weight: 12kg · Incline: 30° · Speed: 8".
  return present
    .map((f) => `${f.label}: ${formatSetFieldValue(f, set[f.key])}`)
    .join(" · ");
}

function PrevSessionsStrip({ sessions, fields, color, styles, C }) {
  if (!sessions.length) {
    return (
      <View style={styles.prevStripEmpty}>
        <MaterialCommunityIcons name="history" size={12} color={C.muted} />
        <Text style={styles.prevEmptyText}>No previous record · 0 × 0</Text>
      </View>
    );
  }
  return (
    <View style={styles.prevStripWrap}>
      <Text style={styles.prevStripLabel}>LAST {sessions.length} SESSION{sessions.length > 1 ? "S" : ""}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 12 }}
      >
        {sessions.map((s) => {
          const lastTime = s.sets[s.sets.length - 1]?.t || "";
          return (
            <View key={s.date} style={[styles.prevCard, { borderLeftColor: color }]}>
              <Text style={styles.prevCardDate} numberOfLines={1}>
                {shortDate(s.date)}{lastTime ? ` · ${lastTime}` : ""}
              </Text>
              {s.sets.slice(0, 4).map((set, idx) => (
                <Text key={idx} style={styles.prevCardSet} numberOfLines={2}>
                  {idx + 1}. {formatPrevSet(fields, set)}
                </Text>
              ))}
              {s.sets.length > 4 && (
                <Text style={styles.prevCardMore}>+{s.sets.length - 4} more sets</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ExerciseCard({
  ex,
  cat,
  color,
  fields,
  isPR,
  prevSessions = [],
  onAddSet,
  onRemoveEx,
  onRemoveSet,
  styles,
  C,
}) {
  const displayFields = fields?.length ? fields : [];

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            flex: 1,
          }}
        >
          <View style={[styles.exColorBar, { backgroundColor: color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseName}>{ex.name}</Text>
            <Text style={[styles.exerciseCategory, { color }]}>
              {cat} • {ex.sets.length} sets
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {isPR && ex.sets.length > 0 && (
            <MaterialCommunityIcons
              name="trophy"
              size={16}
              color={C.gold}
            />
          )}
          <TouchableOpacity onPress={onRemoveEx} style={styles.iconBtn}>
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={C.muted}
            />
          </TouchableOpacity>
        </View>
      </View>

      <PrevSessionsStrip
        sessions={prevSessions}
        fields={displayFields}
        color={color}
        styles={styles}
        C={C}
      />

      {ex.sets.length > 0 && (
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
                  {
                    backgroundColor:
                      i % 2 === 0 ? "transparent" : `${C.muted}10`,
                  },
                ]}
              >
                <View style={styles.setBlockHeader}>
                  <Text style={styles.setNumber}>Set {i + 1}</Text>
                  <Text style={styles.setTimeText} numberOfLines={1}>
                    {set.t}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onRemoveSet(i)}
                    style={styles.deleteSetBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={16}
                      color={C.error || C.muted}
                    />
                  </TouchableOpacity>
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
      )}

      <TouchableOpacity
        style={[styles.addSetBtn, { borderColor: color }]}
        onPress={onAddSet}
      >
        <MaterialCommunityIcons name="plus" size={16} color={color} />
        <Text style={[styles.addSetText, { color }]}>ADD SET</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState({ onAddEx, onAddPlan, onAddCopy, styles, C }) {
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name="dumbbell"
        size={60}
        color={`${C.muted}40`}
      />
      <Text style={styles.emptyTitle}>Workout Log Empty</Text>
      <Text style={styles.emptySubtitle}>
        Start with a plan or add exercises manually
      </Text>
      <View style={{ gap: 10, marginTop: 24 }}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={onAddPlan}
        >
          <MaterialCommunityIcons name="flash" size={16} color="#000" />
          <Text style={styles.buttonTextPrimary}>Quick Start</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonOutline]}
          onPress={onAddEx}
        >
          <MaterialCommunityIcons name="plus" size={16} color={C.accent} />
          <Text style={styles.buttonTextOutline}>Add Exercise</Text>
        </TouchableOpacity>
        {onAddCopy && (
          <TouchableOpacity
            style={[styles.button, styles.buttonOutline]}
            onPress={onAddCopy}
          >
            <MaterialCommunityIcons name="content-copy" size={16} color={C.accent} />
            <Text style={styles.buttonTextOutline}>Copy Previous Workout</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function AddSetModal({
  exerciseName,
  exercise,
  fieldValues,
  onFieldChange,
  onSave,
  onClose,
  styles,
  C,
}) {
  const fields = getExerciseFields(exercise || { name: exerciseName, category: "Custom" });
  return (
    <Modal transparent animationType="slide" visible>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ADD SET</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={C.muted}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.exerciseName}>{exerciseName}</Text>

          <View style={styles.inputGrid}>
            {fields.map((f) => (
              <View key={f.key} style={{ flex: 1, minWidth: "45%" }}>
                <Text style={styles.inputLabel}>
                  {f.label.toUpperCase()}{f.unit ? ` (${f.unit})` : ""}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  value={fieldValues[f.key] || ""}
                  onChangeText={(v) => onFieldChange(f.key, v)}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={onSave}
          >
            <MaterialCommunityIcons name="check" size={18} color="#000" />
            <Text style={styles.buttonTextPrimary}>SAVE SET</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddExerciseModal({
  search,
  onSearchChange,
  exercises,
  categoryList,
  groupedAdd,
  onSelectEx,
  onClose,
  onAddCustom,
  styles,
  C,
}) {
  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ADD EXERCISE</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={C.muted}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <MaterialCommunityIcons
              name="magnify"
              size={18}
              color={C.muted}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={C.muted}
              value={search}
              onChangeText={onSearchChange}
              autoFocus
            />
          </View>

          <ScrollView style={{ maxHeight: "70%" }}>
            {categoryList.map((cat) => {
              const exs = groupedAdd(cat);
              if (!exs.length) return null;
              return (
                <View key={cat}>
                  <Text
                    style={[
                      styles.categoryTitle,
                      { color: CATEGORY_COLORS[cat] || C.accent },
                    ]}
                  >
                    {cat}
                  </Text>
                  {exs.map((e) => (
                    <TouchableOpacity
                      key={e.name}
                      style={styles.exListItem}
                      onPress={() => onSelectEx(e.name)}
                    >
                      <Text style={styles.exListItemText}>{e.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.button, styles.buttonOutline]}
            onPress={onAddCustom}
          >
            <MaterialCommunityIcons
              name="plus"
              size={16}
              color={C.accent}
            />
            <Text style={styles.buttonTextOutline}>Create Custom</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PlanModal({ plans, onSelectPlan, onClose, styles, C }) {
  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>QUICK START PLANS</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={C.muted}
              />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {Object.entries(plans).map(([name, exs]) => (
              <TouchableOpacity
                key={name}
                style={styles.planItem}
                onPress={() => {
                  onSelectPlan(name);
                  onClose();
                }}
              >
                <Text style={styles.planName}>{name}</Text>
                <Text style={styles.planExercises}>
                  {exs.slice(0, 3).join(" • ")}
                  {exs.length > 3 ? ` +${exs.length - 3}` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CopyWorkoutModal({ previousDates, workouts, onSelectDate, onClose, styles, C }) {
  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>COPY WORKOUT</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={C.muted}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalDescription}>
            Select a previous workout to copy all exercises and sets:
          </Text>

          <ScrollView>
            {previousDates.map((date) => {
              const wk = workouts[date];
              const exCount = wk?.exs?.length || 0;
              const setCount =
                wk?.exs?.reduce((s, ex) => s + (ex.sets?.length || 0), 0) || 0;

              return (
                <TouchableOpacity
                  key={date}
                  style={styles.copyItem}
                  onPress={() => onSelectDate(date)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.copyDate}>{prettyDate(date)}</Text>
                    {wk?.dayTitle ? (
                      <Text style={styles.copyDayTitle}>{wk.dayTitle}</Text>
                    ) : null}
                    <Text style={styles.copyDetails}>
                      {exCount} exercise{exCount !== 1 ? "s" : ""} • {setCount}{" "}
                      set{setCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="content-copy"
                    size={18}
                    color={C.accent}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CalendarLookupModal({
  currentDate,
  workouts,
  onSelectDate,
  onClose,
  styles,
  C,
}) {
  const [lookupMonth, setLookupMonth] = useState(() => {
    return new Date(currentDate + "T12:00");
  });

  const changeMonth = (offset) => {
    const next = new Date(lookupMonth);
    next.setMonth(next.getMonth() + offset);
    const today = new Date();
    if (offset > 0 && (next.getFullYear() > today.getFullYear() || (next.getFullYear() === today.getFullYear() && next.getMonth() > today.getMonth()))) {
      return;
    }
    setLookupMonth(next);
  };

  const year = lookupMonth.getFullYear();
  const month = lookupMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = firstDay.getDay();
  const cells = [];

  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayWorkouts = workouts[dateStr];
    cells.push({
      dateStr,
      day,
      hasWorkout: dayWorkouts && dayWorkouts.exs && dayWorkouts.exs.length > 0,
      isToday: dateStr === todayStr(),
      isSelected: dateStr === currentDate,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = lookupMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const isNextDisabled = (() => {
    const today = new Date();
    return year >= today.getFullYear() && month >= today.getMonth();
  })();

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { width: "92%", maxWidth: 380, padding: 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>LOOKUP WORKOUT</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={C.muted} />
            </TouchableOpacity>
          </View>

          {/* Month Navigation */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <TouchableOpacity style={{ padding: 6 }} onPress={() => changeMonth(-1)}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={C.text} />
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: "700" }}>{monthLabel}</Text>
            <TouchableOpacity style={{ padding: 6, opacity: isNextDisabled ? 0.3 : 1 }} onPress={() => !isNextDisabled && changeMonth(1)}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={isNextDisabled ? C.muted : C.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday Labels */}
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
              <Text key={i} style={{ width: `${100 / 7}%`, textAlign: "center", color: C.muted, fontSize: 10, fontWeight: "700" }}>{w}</Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {cells.map((cell, idx) => {
              if (!cell) {
                return <View key={`empty-${idx}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
              }
              const isFuture = cell.dateStr > todayStr();
              return (
                <TouchableOpacity
                  key={cell.dateStr}
                  style={[
                    {
                      width: `${100 / 7}%`,
                      aspectRatio: 1,
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: 8,
                      marginBottom: 4,
                      borderWidth: 1,
                      borderColor: "transparent",
                    },
                    cell.isSelected && { backgroundColor: C.accent, borderColor: C.accent },
                    !cell.isSelected && cell.isToday && { borderColor: C.gold },
                    !cell.isSelected && cell.hasWorkout && { backgroundColor: `${C.accent}15`, borderColor: `${C.accent}40` },
                  ]}
                  onPress={() => {
                    if (!isFuture) {
                      onSelectDate(cell.dateStr);
                    }
                  }}
                  disabled={isFuture}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      { color: C.muted, fontSize: 12, fontWeight: "600" },
                      isFuture && { color: `${C.muted}40` },
                      cell.isSelected && { color: "#000", fontWeight: "800" },
                      !cell.isSelected && (cell.hasWorkout || cell.isToday) && { color: C.text, fontWeight: "700" },
                      !cell.isSelected && cell.isToday && { color: C.gold },
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {cell.hasWorkout && !cell.isSelected && (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, marginTop: 2 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick jump to Today */}
          <TouchableOpacity
            style={{
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 8,
              paddingVertical: 10,
              alignItems: "center",
              marginTop: 14,
            }}
            onPress={() => {
              onSelectDate(todayStr());
            }}
          >
            <Text style={{ color: C.accent, fontWeight: "700", fontSize: 12 }}>JUMP TO TODAY</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: C.muted,
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 1,
  },
  headerDate: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  headerDayTitle: {
    fontSize: 13,
    color: C.text,
    fontWeight: "700",
    marginTop: 2,
  },
  syncing: {
    alignItems: "center",
    gap: 4,
  },
  syncText: {
    fontSize: 10,
    fontWeight: "600",
  },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dateBtn: {
    padding: 8,
    borderRadius: 8,
  },
  dateDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.card,
    borderRadius: 8,
  },
  dateText: {
    color: C.text,
    fontSize: 13,
    fontWeight: "600",
  },
  todayBadge: {
    backgroundColor: `${C.accent}20`,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  todayBadgeText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  dayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dayTitleInput: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 4,
  },
  stats: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 9,
    color: C.muted,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 48,
  },
  exerciseCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  exColorBar: {
    width: 3,
    height: 34,
    borderRadius: 2,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
  },
  exerciseCategory: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 1,
  },
  iconBtn: {
    padding: 6,
  },
  setsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  setBlock: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  setBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingRight: 2,
  },
  setTimeText: {
    flex: 1,
    textAlign: "right",
    fontSize: 10,
    color: C.muted,
    fontFamily: "monospace",
    marginRight: 6,
  },
  deleteSetBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${C.muted}12`,
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
  setsHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    alignItems: "center",
  },
  setNumber: {
    minWidth: 36,
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  setLabel: {
    flex: 1,
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  setRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  setWeight: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  setReps: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
  },
  setTime: {
    flex: 1,
    fontSize: 10,
    color: C.muted,
    fontFamily: "monospace",
  },
  prevStripWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  prevStripLabel: {
    color: C.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  prevCard: {
    backgroundColor: C.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 110,
    maxWidth: 220,
  },
  prevCardDate: {
    color: C.text,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
  },
  prevCardSet: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 1,
  },
  prevCardMore: {
    color: C.muted,
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 2,
  },
  prevStripEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },
  prevEmptyText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "600",
  },
  addSetBtn: {
    margin: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addSetText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  button: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: C.accent,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  buttonTextPrimary: {
    color: "#000",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  buttonTextOutline: {
    color: C.accent,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.text,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.muted,
    marginTop: 6,
  },
  dateDisplayWeb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.card,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
    ...Platform.select({
      web: {
        justifyContent: "center",
        alignItems: "center",
      }
    })
  },
  modalContent: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderTopColor: C.border,
    ...Platform.select({
      web: {
        width: "90%",
        maxWidth: 500,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
      }
    })
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.text,
    letterSpacing: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: C.text,
    fontSize: 13,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 6,
    marginLeft: 0,
  },
  exListItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  exListItemText: {
    color: C.text,
    fontSize: 13,
  },
  inputLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.inputBg,
    borderRadius: 10,
    padding: 12,
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: C.border,
  },
  inputGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  categoryGrid: {
    marginBottom: 16,
  },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 8,
    backgroundColor: C.surface,
  },
  categoryBtnText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "600",
  },
  planItem: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  planName: {
    color: C.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  planExercises: {
    color: C.muted,
    fontSize: 11,
  },
  modalDescription: {
    color: C.muted,
    fontSize: 12,
    marginBottom: 14,
    fontWeight: "500",
  },
  copyItem: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copyDate: {
    color: C.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  copyDayTitle: {
    color: C.accent,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  copyDetails: {
    color: C.muted,
    fontSize: 11,
  },
});
