import { getExerciseFields } from "./exerciseTracking";

export function countExerciseUsage(workouts, exerciseName) {
  let sessions = 0;
  Object.values(workouts || {}).forEach((wk) => {
    if (wk?.exs?.some((e) => e.name === exerciseName)) sessions += 1;
  });
  return sessions;
}

export function getAddedFieldKeys(oldFields, newFields) {
  const oldKeys = new Set((oldFields || []).map((f) => f.key));
  return (newFields || []).filter((f) => !oldKeys.has(f.key));
}

export function getResolvedFields(exercise) {
  return exercise?.fields?.length ? exercise.fields : getExerciseFields(exercise);
}

export function renameExerciseInWorkouts(workouts, oldName, newName) {
  const changedDates = [];
  const next = {};
  Object.entries(workouts || {}).forEach(([date, wk]) => {
    if (!wk?.exs?.some((e) => e.name === oldName)) {
      next[date] = wk;
      return;
    }
    changedDates.push(date);
    next[date] = {
      ...wk,
      exs: wk.exs.map((e) =>
        e.name === oldName ? { ...e, name: newName } : e,
      ),
    };
  });
  return { workouts: next, changedDates };
}

export function removeExerciseFromWorkouts(workouts, exerciseName) {
  const changedDates = [];
  const next = {};
  Object.entries(workouts || {}).forEach(([date, wk]) => {
    if (!wk?.exs?.some((e) => e.name === exerciseName)) {
      next[date] = wk;
      return;
    }
    changedDates.push(date);
    const exs = wk.exs.filter((e) => e.name !== exerciseName);
    if (exs.length > 0) {
      next[date] = { ...wk, exs };
    }
  });
  return { workouts: next, changedDates };
}

export function applyNewFieldDefaults(
  workouts,
  exerciseName,
  fieldKeys,
  defaultValue = 0,
) {
  if (!fieldKeys?.length) {
    return { workouts, changedDates: [] };
  }

  const changedDates = [];
  const next = {};
  Object.entries(workouts || {}).forEach(([date, wk]) => {
    if (!wk?.exs?.some((e) => e.name === exerciseName)) {
      next[date] = wk;
      return;
    }

    let modified = false;
    const exs = wk.exs.map((e) => {
      if (e.name !== exerciseName) return e;
      const sets = (e.sets || []).map((set) => {
        let setChanged = false;
        const newSet = { ...set };
        fieldKeys.forEach((key) => {
          if (
            newSet[key] === undefined ||
            newSet[key] === null ||
            newSet[key] === ""
          ) {
            newSet[key] = defaultValue;
            setChanged = true;
          }
        });
        if (setChanged) modified = true;
        return newSet;
      });
      return { ...e, sets };
    });

    if (modified) {
      changedDates.push(date);
      next[date] = { ...wk, exs };
    } else {
      next[date] = wk;
    }
  });

  return { workouts: next, changedDates };
}

export async function persistWorkoutChanges(workouts, changedDates, saveWorkout, deleteWorkout) {
  for (const date of changedDates) {
    const wk = workouts[date];
    if (wk?.exs?.length) {
      await saveWorkout(date, wk);
    } else {
      await deleteWorkout(date);
    }
  }
}
