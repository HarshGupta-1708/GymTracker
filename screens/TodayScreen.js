import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    CATEGORIES,
    CATEGORY_COLORS,
    COLORS,
    PRESET_EXERCISES,
    WORKOUT_PLANS,
    getTrackingType,
    prettyDate,
    timeStr,
    toDateStr,
    todayStr,
} from "../constants/data";
import { estimateKcal, listenWorkouts, saveWorkout } from "../utils/firestore";

const { width } = Dimensions.get("window");

export default function TodayScreen({ navigation, exercises: propExercises = PRESET_EXERCISES, onAddCustomExercise }) {
  const [date, setDate] = useState(todayStr());
  const [workouts, setWorkouts] = useState({});
  const workoutsRef = useRef({});
  const exLib = propExercises;
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Modals
  const [modal, setModal] = useState(null);
  const [addSetFor, setAddSetFor] = useState(null);
  const [setW, setSetW] = useState("");
  const [setR, setSetR] = useState("");
  const [setDuration, setSetDuration] = useState("");
  const [setDistance, setSetDistance] = useState("");
  const [exSearch, setExSearch] = useState("");
  const [newExName, setNewExName] = useState("");
  const [newExCat, setNewExCat] = useState("Custom");
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const unsubscribe = listenWorkouts((data) => {
      setWorkouts(data);
      workoutsRef.current = data;
      setLoading(false);
      setSyncing(false);
    });
    return unsubscribe;
  }, []);

  const wk = workouts[date] || { exs: [] };
  const isToday = date === todayStr();
  const hasCompleted = Boolean(wk.completedAt);

  const updWk = async (val) => {
    setWorkouts((p) => {
      const next = { ...p, [date]: val };
      workoutsRef.current = next;
      return next;
    });
    setSyncing(true);
    await saveWorkout(date, val);
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
    await updWk({ ...wk, exs: wk.exs.filter((e) => e.name !== name) });
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

    await updWk({ ...wk, exs: newExs });
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
    const allSets = Object.values(workouts).flatMap((w) =>
      (w.exs || []).filter((e) => e.name === name).flatMap((e) => e.sets),
    );
    const last = allSets[allSets.length - 1];
    setSetW(last ? String(last.w) : "");
    setSetR(last ? String(last.r) : "");
    setSetDuration(last?.durMin ? String(last.durMin) : "");
    setSetDistance(last?.distKm ? String(last.distKm) : "");
    setAddSetFor(name);
    setModal("addSet");
  };

  const saveSet = async () => {
    if (!addSetFor) {
      Alert.alert("Error", "Select an exercise first");
      return;
    }

    const exercise = exLib.find((e) => e.name === addSetFor);
    const tracking = getTrackingType(addSetFor, exercise?.category);
    const w = parseFloat(setW) || 0;
    const r = parseInt(setR) || 0;
    const durMin = parseFloat(setDuration) || 0;
    const distKm = parseFloat(setDistance) || 0;

    if (tracking === "strength" && !r) return Alert.alert("Error", "Enter reps");
    if (tracking === "duration" && !durMin) return Alert.alert("Error", "Enter duration");
    if (tracking === "cardio" && !durMin && !distKm) {
      return Alert.alert("Error", "Enter duration or distance");
    }

    const newSet =
      tracking === "strength"
        ? { w, r, t: timeStr() }
        : tracking === "duration"
          ? { durMin, t: timeStr() }
          : { durMin, distKm, t: timeStr() };

    const latestWk = workoutsRef.current[date] || { exs: [] };
    await updWk({
      ...latestWk,
      exs: latestWk.exs.map((e) =>
        e.name === addSetFor
          ? { ...e, sets: [...e.sets, newSet] }
          : e,
      ),
    });
    setSetR("");
    setSetW("");
    setSetDuration("");
    setSetDistance("");
    setModal(null);
  };

  const completeWorkout = async () => {
    if (!wk.exs?.length) {
      Alert.alert("No workout", "Add at least one exercise first.");
      return;
    }
    const kcal = wk.exs.reduce((sum, ex) => sum + estimateKcal(ex.sets || []), 0);
    await updWk({
      ...wk,
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
    await updWk({
      ...wk,
      exs: wk.exs.map((e) =>
        e.name === exName
          ? { ...e, sets: e.sets.filter((_, i) => i !== idx) }
          : e,
      ),
    });
  };

  const addCustomEx = async () => {
    if (!newExName.trim()) return;
    const name = newExName.trim();
    if (!exLib.find((e) => e.name === name)) {
      if (typeof onAddCustomExercise === 'function') {
        await onAddCustomExercise(name, newExCat);
      }
    }
    setNewExName("");
    setModal("addEx");
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
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
            <Text style={[styles.headerDate, { color: COLORS.accent, fontWeight: '700' }]}>
              {prettyDate(date)} ▾
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.syncing}>
          {syncing && <ActivityIndicator size="small" color={COLORS.accent} />}
          <Text
            style={[
              styles.syncText,
              { color: syncing ? COLORS.accent : COLORS.green },
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
            color={COLORS.muted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={() => setModal("calendarLookup")}
        >
          <MaterialCommunityIcons
            name="calendar"
            size={16}
            color={COLORS.accent}
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
            color={date >= todayStr() ? COLORS.muted : COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {wk.exs.length > 0 && (
        <View style={styles.stats}>
          <StatCard
            label="EXERCISES"
            value={stats.exercises}
            color={COLORS.accent}
          />
          <StatCard label="SETS" value={stats.sets} color={COLORS.orange} />
          <StatCard
            label="VOLUME"
            value={`${stats.volume}kg`}
            color={COLORS.green}
          />
        </View>
      )}

      {/* Exercises List */}
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {wk.exs.length === 0 ? (
          <EmptyState
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
              const cat =
                exLib.find((e) => e.name === ex.name)?.category || "Custom";
              const color = CATEGORY_COLORS[cat] || COLORS.accent;
              const allW = allMaxW(ex.name);
              const maxSetW = ex.sets.length
                ? Math.max(...ex.sets.map((s) => s.w))
                : 0;
              const isPR =
                allW.length > 0 && maxSetW > 0 && maxSetW >= Math.max(...allW);

              return (
                <ExerciseCard
                  key={ex.name}
                  ex={ex}
                  cat={cat}
                  color={color}
                  isPR={isPR}
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
                  color={COLORS.accent}
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
                    color={COLORS.accent}
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
          exerciseName={addSetFor}
          category={exLib.find((e) => e.name === addSetFor)?.category}
          weight={setW}
          reps={setR}
          duration={setDuration}
          distance={setDistance}
          onWeightChange={setSetW}
          onRepsChange={setSetR}
          onDurationChange={setSetDuration}
          onDistanceChange={setSetDistance}
          onSave={saveSet}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "addEx" && (
        <AddExerciseModal
          search={exSearch}
          onSearchChange={setExSearch}
          exercises={exLib}
          groupedAdd={groupedAdd}
          onSelectEx={addExToDay}
          onClose={() => {
            setModal(null);
            setExSearch("");
          }}
          onAddCustom={() => setModal("customEx")}
        />
      )}

      {modal === "customEx" && (
        <CustomExerciseModal
          name={newExName}
          category={newExCat}
          onNameChange={setNewExName}
          onCategoryChange={setNewExCat}
          onAdd={addCustomEx}
          onClose={() => setModal("addEx")}
        />
      )}

      {modal === "plan" && (
        <PlanModal
          plans={WORKOUT_PLANS}
          onSelectPlan={addPlan}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "copy" && (
        <CopyWorkoutModal
          previousDates={getPreviousWorkoutDates()}
          workouts={workouts}
          onSelectDate={copyWorkoutFrom}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "calendarLookup" && (
        <CalendarLookupModal
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

function StatCard({ label, value, color }) {
  return (
    <View
      style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ExerciseCard({
  ex,
  cat,
  color,
  isPR,
  onAddSet,
  onRemoveEx,
  onRemoveSet,
}) {
  const tracking = getTrackingType(ex.name, cat);
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
              color={COLORS.gold}
            />
          )}
          <TouchableOpacity onPress={onRemoveEx} style={styles.iconBtn}>
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={COLORS.muted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {ex.sets.length > 0 && (
        <View>
          <View style={styles.setsHeader}>
            <Text style={styles.setNumber}>#</Text>
            <Text style={styles.setLabel}>
              {tracking === "strength" ? "Weight" : "Duration"}
            </Text>
            <Text style={styles.setLabel}>
              {tracking === "cardio" ? "Distance" : tracking === "strength" ? "Reps" : "Details"}
            </Text>
            <Text style={styles.setLabel}>Time</Text>
            <View style={{ width: 24 }} />
          </View>
          {ex.sets.map((set, i) => {
            const isTop =
              set.w > 0 &&
              ex.sets.length > 1 &&
              set.w === Math.max(...ex.sets.map((s) => s.w));
            return (
              <View
                key={i}
                style={[
                  styles.setRow,
                  {
                    backgroundColor:
                      i % 2 === 0 ? "transparent" : `${COLORS.muted}10`,
                  },
                ]}
              >
                <Text style={styles.setNumber}>{i + 1}</Text>
                <Text
                  style={[
                    styles.setWeight,
                    { color: isTop ? COLORS.gold : COLORS.text },
                  ]}
                >
                  {tracking === "strength"
                    ? set.w > 0
                      ? `${set.w}kg`
                      : "BW"
                    : `${set.durMin || 0} min`}
                </Text>
                <Text style={styles.setReps}>
                  {tracking === "strength"
                    ? set.r
                    : tracking === "cardio"
                      ? `${set.distKm || 0} km`
                      : "-"}
                </Text>
                <Text style={styles.setTime}>{set.t}</Text>
                <TouchableOpacity
                  onPress={() => onRemoveSet(i)}
                  style={[styles.iconBtn, { opacity: 0.5 }]}
                >
                  <MaterialCommunityIcons
                    name="trash-can"
                    size={14}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>
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

function EmptyState({ onAddEx, onAddPlan, onAddCopy }) {
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name="dumbbell"
        size={60}
        color={`${COLORS.muted}40`}
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
          <MaterialCommunityIcons name="plus" size={16} color={COLORS.accent} />
          <Text style={styles.buttonTextOutline}>Add Exercise</Text>
        </TouchableOpacity>
        {onAddCopy && (
          <TouchableOpacity
            style={[styles.button, styles.buttonOutline]}
            onPress={onAddCopy}
          >
            <MaterialCommunityIcons name="content-copy" size={16} color={COLORS.accent} />
            <Text style={styles.buttonTextOutline}>Copy Previous Workout</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function AddSetModal({
  exerciseName,
  category,
  weight,
  reps,
  duration,
  distance,
  onWeightChange,
  onRepsChange,
  onDurationChange,
  onDistanceChange,
  onSave,
  onClose,
}) {
  const tracking = getTrackingType(exerciseName, category);
  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ADD SET</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.exerciseName}>{exerciseName}</Text>

          {tracking === "strength" && (
            <View style={styles.inputGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>WEIGHT (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={onWeightChange}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>REPS</Text>
                <TextInput
                  style={styles.input}
                  placeholder="12"
                  keyboardType="number-pad"
                  value={reps}
                  onChangeText={onRepsChange}
                />
              </View>
            </View>
          )}

          {tracking === "duration" && (
            <View style={styles.inputGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>DURATION (min)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="30"
                  keyboardType="decimal-pad"
                  value={duration}
                  onChangeText={onDurationChange}
                />
              </View>
            </View>
          )}

          {tracking === "cardio" && (
            <View style={styles.inputGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>DURATION (min)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="30"
                  keyboardType="decimal-pad"
                  value={duration}
                  onChangeText={onDurationChange}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>DISTANCE (km)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2.5"
                  keyboardType="decimal-pad"
                  value={distance}
                  onChangeText={onDistanceChange}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={onSave}
          >
            <MaterialCommunityIcons name="check" size={18} color="#000" />
            <Text style={styles.buttonTextPrimary}>SAVE SET</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AddExerciseModal({
  search,
  onSearchChange,
  exercises,
  groupedAdd,
  onSelectEx,
  onClose,
  onAddCustom,
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
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <MaterialCommunityIcons
              name="magnify"
              size={18}
              color={COLORS.muted}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={COLORS.muted}
              value={search}
              onChangeText={onSearchChange}
              autoFocus
            />
          </View>

          <ScrollView style={{ maxHeight: "70%" }}>
            {CATEGORIES.map((cat) => {
              const exs = groupedAdd(cat);
              if (!exs.length) return null;
              return (
                <View key={cat}>
                  <Text
                    style={[
                      styles.categoryTitle,
                      { color: CATEGORY_COLORS[cat] },
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
              color={COLORS.accent}
            />
            <Text style={styles.buttonTextOutline}>Create Custom</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CustomExerciseModal({
  name,
  category,
  onNameChange,
  onCategoryChange,
  onAdd,
  onClose,
}) {
  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>NEW EXERCISE</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>EXERCISE NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Leg Extension"
            value={name}
            onChangeText={onNameChange}
          />

          <Text style={[styles.inputLabel, { marginTop: 16 }]}>CATEGORY</Text>
          <ScrollView
            style={styles.categoryGrid}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryBtn,
                  category === cat && {
                    backgroundColor: CATEGORY_COLORS[cat],
                    borderColor: CATEGORY_COLORS[cat],
                  },
                ]}
                onPress={() => onCategoryChange(cat)}
              >
                <Text
                  style={[
                    styles.categoryBtnText,
                    category === cat && { color: "#000" },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={onAdd}
          >
            <MaterialCommunityIcons name="plus" size={16} color="#000" />
            <Text style={styles.buttonTextPrimary}>ADD EXERCISE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PlanModal({ plans, onSelectPlan, onClose }) {
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
                color={COLORS.muted}
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

function CopyWorkoutModal({ previousDates, workouts, onSelectDate, onClose }) {
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
                color={COLORS.muted}
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
                    <Text style={styles.copyDetails}>
                      {exCount} exercise{exCount !== 1 ? "s" : ""} • {setCount}{" "}
                      set{setCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="content-copy"
                    size={18}
                    color={COLORS.accent}
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
              <MaterialCommunityIcons name="close" size={22} color={COLORS.muted} />
            </TouchableOpacity>
          </View>

          {/* Month Navigation */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <TouchableOpacity style={{ padding: 6 }} onPress={() => changeMonth(-1)}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: "700" }}>{monthLabel}</Text>
            <TouchableOpacity style={{ padding: 6, opacity: isNextDisabled ? 0.3 : 1 }} onPress={() => !isNextDisabled && changeMonth(1)}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={isNextDisabled ? COLORS.muted : COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday Labels */}
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
              <Text key={i} style={{ width: `${100 / 7}%`, textAlign: "center", color: COLORS.muted, fontSize: 10, fontWeight: "700" }}>{w}</Text>
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
                    cell.isSelected && { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
                    !cell.isSelected && cell.isToday && { borderColor: COLORS.gold },
                    !cell.isSelected && cell.hasWorkout && { backgroundColor: `${COLORS.accent}15`, borderColor: `${COLORS.accent}40` },
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
                      { color: COLORS.muted, fontSize: 12, fontWeight: "600" },
                      isFuture && { color: `${COLORS.muted}40` },
                      cell.isSelected && { color: "#000", fontWeight: "800" },
                      !cell.isSelected && (cell.hasWorkout || cell.isToday) && { color: COLORS.text, fontWeight: "700" },
                      !cell.isSelected && cell.isToday && { color: COLORS.gold },
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {cell.hasWorkout && !cell.isSelected && (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.accent, marginTop: 2 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick jump to Today */}
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 8,
              paddingVertical: 10,
              alignItems: "center",
              marginTop: 14,
            }}
            onPress={() => {
              onSelectDate(todayStr());
            }}
          >
            <Text style={{ color: COLORS.accent, fontWeight: "700", fontSize: 12 }}>JUMP TO TODAY</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 8,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: 1,
  },
  headerDate: {
    fontSize: 12,
    color: COLORS.muted,
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
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  dateText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  todayBadge: {
    backgroundColor: `${COLORS.accent}20`,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  todayBadgeText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  stats: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 9,
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 1,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  exerciseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  exColorBar: {
    width: 3,
    height: 34,
    borderRadius: 2,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
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
  setsHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: "center",
  },
  setNumber: {
    width: 28,
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  setLabel: {
    flex: 1,
    color: COLORS.muted,
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
    color: COLORS.text,
  },
  setTime: {
    flex: 1,
    fontSize: 10,
    color: COLORS.muted,
    fontFamily: "monospace",
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
    backgroundColor: COLORS.accent,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  buttonTextPrimary: {
    color: "#000",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  buttonTextOutline: {
    color: COLORS.accent,
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
    color: COLORS.text,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 6,
  },
  dateDisplayWeb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.card,
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
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...Platform.select({
      web: {
        width: "90%",
        maxWidth: 500,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
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
    color: COLORS.text,
    letterSpacing: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: COLORS.text,
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exListItemText: {
    color: COLORS.text,
    fontSize: 13,
  },
  inputLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputGrid: {
    flexDirection: "row",
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
    borderColor: COLORS.border,
    marginRight: 8,
    backgroundColor: COLORS.surface,
  },
  categoryBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  planItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  planExercises: {
    color: COLORS.muted,
    fontSize: 11,
  },
  modalDescription: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 14,
    fontWeight: "500",
  },
  copyItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copyDate: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  copyDetails: {
    color: COLORS.muted,
    fontSize: 11,
  },
});
