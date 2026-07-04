import { calculateStreaks } from "./firestore";
import { formatSetFieldValue, getDisplayFieldsForExercise } from "./exerciseTracking";
import { todayStr } from "../constants/data";

const DAY_MS = 86400000;

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchExerciseName(query, exerciseNames = []) {
  const q = normalizeText(query);
  if (!q) return null;

  const exact = exerciseNames.find((n) => normalizeText(n) === q);
  if (exact) return exact;

  const partial = exerciseNames.find(
    (n) => normalizeText(n).includes(q) || q.includes(normalizeText(n)),
  );
  if (partial) return partial;

  const aliases = {
    deadlift: ["deadlift", "rdl", "romanian deadlift", "sumo deadlift"],
    squat: ["squat", "back squat", "front squat"],
    bench: ["bench", "bench press", "incline bench"],
  };

  for (const [key, words] of Object.entries(aliases)) {
    if (words.some((w) => q.includes(w))) {
      const hit = exerciseNames.find((n) => normalizeText(n).includes(key));
      if (hit) return hit;
    }
  }

  return null;
}

export function collectExerciseNames(workouts = {}, exercises = []) {
  const names = new Set(exercises.map((e) => e.name));
  Object.values(workouts).forEach((wk) => {
    wk?.exs?.forEach((ex) => names.add(ex.name));
  });
  return [...names];
}

export function getDateRangeDays(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * DAY_MS);
  return {
    startStr: toDateStr(start),
    endStr: toDateStr(end),
    days,
  };
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getExerciseProgression(workouts, exerciseName, days = 30) {
  const { startStr } = getDateRangeDays(days);
  const sessions = [];

  Object.entries(workouts || {})
    .filter(([date]) => date >= startStr)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, wk]) => {
      const ex = wk?.exs?.find(
        (e) => normalizeText(e.name) === normalizeText(exerciseName),
      );
      if (!ex?.sets?.length) return;

      let maxW = 0;
      let totalVol = 0;
      ex.sets.forEach((set) => {
        const w = parseFloat(set.w) || 0;
        const r = parseInt(set.r, 10) || 0;
        maxW = Math.max(maxW, w);
        totalVol += w * r;
      });

      sessions.push({
        date,
        sets: ex.sets.length,
        maxW,
        totalVol,
        topSet: ex.sets.reduce(
          (best, s) => ((parseFloat(s.w) || 0) > (parseFloat(best.w) || 0) ? s : best),
          ex.sets[0],
        ),
      });
    });

  const maxWeights = sessions.map((s) => s.maxW).filter((w) => w > 0);
  const trend =
    maxWeights.length >= 2 ? maxWeights[maxWeights.length - 1] - maxWeights[0] : 0;

  return { exerciseName, days, sessions, trend, sessionCount: sessions.length };
}

export function getWeekSummary(workouts, settings = {}) {
  const streaks = calculateStreaks(workouts);
  const goal = settings.goalsPerWeek || settings.activeDaysPerWeek || 3;
  const today = todayStr();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const weekSessions = Object.entries(workouts || {})
    .filter(([date]) => new Date(`${date}T12:00`) >= weekStart)
    .filter(([, wk]) => wk?.exs?.length)
    .sort(([a], [b]) => a.localeCompare(b));

  const categories = {};
  weekSessions.forEach(([, wk]) => {
    wk.exs?.forEach((ex) => {
      categories[ex.name] = (categories[ex.name] || 0) + (ex.sets?.length || 0);
    });
  });

  return {
    goal,
    completed: streaks.thisWeekWorkouts,
    activeDays: streaks.thisWeekActive,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    weekSessions: weekSessions.map(([date, wk]) => ({
      date,
      title: wk.dayTitle || "",
      exercises: wk.exs?.length || 0,
      sets: wk.exs?.reduce((s, e) => s + (e.sets?.length || 0), 0) || 0,
    })),
    topExercises: Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, sets]) => ({ name, sets })),
    todayLogged: Boolean(workouts?.[today]?.exs?.length),
  };
}

export function getTodayWorkoutSummary(workouts, exercises = []) {
  const wk = workouts?.[todayStr()];
  if (!wk?.exs?.length) {
    return { date: todayStr(), empty: true, exercises: [] };
  }

  return {
    date: todayStr(),
    empty: false,
    dayTitle: wk.dayTitle || "",
    completed: Boolean(wk.completedAt),
    exercises: wk.exs.map((ex) => {
      const def = exercises.find((e) => e.name === ex.name);
      const fields = getDisplayFieldsForExercise(def, ex);
      return {
        name: ex.name,
        category: def?.category || "Custom",
        sets: ex.sets?.length || 0,
        lastSet: ex.sets?.[ex.sets.length - 1],
        fields,
      };
    }),
  };
}

export function findRecentPRs(workouts, limit = 5) {
  const prs = [];
  const bestByExercise = {};

  Object.entries(workouts || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, wk]) => {
      wk?.exs?.forEach((ex) => {
        ex.sets?.forEach((set) => {
          const w = parseFloat(set.w) || 0;
          if (w <= 0) return;
          const prev = bestByExercise[ex.name] || 0;
          if (w > prev) {
            if (prev > 0) {
              prs.push({
                date,
                exercise: ex.name,
                weight: w,
                reps: set.r,
                previousBest: prev,
              });
            }
            bestByExercise[ex.name] = w;
          }
        });
      });
    });

  return prs.slice(-limit).reverse();
}

function formatSetLine(set, fields) {
  return fields
    .map((f) => `${f.label}: ${formatSetFieldValue(f, set[f.key])}`)
    .join(", ");
}

export function formatProgressionContext(progression) {
  if (!progression.sessionCount) {
    return `No logged sessions for "${progression.exerciseName}" in the last ${progression.days} days.`;
  }

  const lines = progression.sessions.map((s) => {
    const w = s.maxW > 0 ? `${s.maxW}kg max` : "bodyweight/time based";
    return `- ${s.date}: ${s.sets} sets, ${w}, volume ~${Math.round(s.totalVol)}kg`;
  });

  return [
    `Exercise: ${progression.exerciseName}`,
    `Period: last ${progression.days} days`,
    `Sessions: ${progression.sessionCount}`,
    `Max weight trend: ${progression.trend >= 0 ? "+" : ""}${progression.trend}kg`,
    "Session log:",
    ...lines,
  ].join("\n");
}

export function formatWeekContext(summary) {
  const lines = summary.weekSessions.map(
    (s) =>
      `- ${s.date}${s.title ? ` (${s.title})` : ""}: ${s.exercises} exercises, ${s.sets} sets`,
  );

  return [
    `Weekly goal: ${summary.goal} sessions`,
    `Completed this week: ${summary.completed}/${summary.goal}`,
    `Active days this week: ${summary.activeDays}`,
    `Current day streak: ${summary.currentStreak} | Longest: ${summary.longestStreak}`,
    `Today logged: ${summary.todayLogged ? "yes" : "no"}`,
    summary.weekSessions.length ? "This week's sessions:" : "No sessions this week yet.",
    ...lines,
    summary.topExercises.length
      ? `Most sets: ${summary.topExercises.map((e) => `${e.name} (${e sets})`).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatTodayContext(today) {
  if (today.empty) {
    return `Today (${today.date}): no workout logged yet.`;
  }

  const lines = today.exercises.map((ex) => {
    const setInfo =
      ex.lastSet && ex.fields?.length
        ? formatSetLine(ex.lastSet, ex.fields)
        : `${ex.sets} sets logged`;
    return `- ${ex.name} (${ex.category}): ${ex.sets} sets${ex.lastSet ? `, latest: ${setInfo}` : ""}`;
  });

  return [
    `Today (${today.date})${today.dayTitle ? `: ${today.dayTitle}` : ""}`,
    `Status: ${today.completed ? "completed" : "in progress"}`,
    ...lines,
  ].join("\n");
}

export function buildCoachContext({
  message = "",
  quickPromptId = null,
  workouts = {},
  exercises = [],
  settings = {},
}) {
  const names = collectExerciseNames(workouts, exercises);
  const week = getWeekSummary(workouts, settings);
  const today = getTodayWorkoutSummary(workouts, exercises);
  const prs = findRecentPRs(workouts);

  let focusContext = "";
  let intent = "general";

  if (quickPromptId === "deadlift_progress") {
    const ex = matchExerciseName("deadlift", names) || "Deadlift";
    focusContext = formatProgressionContext(getExerciseProgression(workouts, ex, 30));
    intent = "progression";
  } else if (quickPromptId === "this_week") {
    focusContext = formatWeekContext(week);
    intent = "weekly";
  } else if (quickPromptId === "train_today") {
    focusContext = [
      formatWeekContext(week),
      formatTodayContext(today),
      `Exercise library count: ${exercises.length}`,
    ].join("\n\n");
    intent = "plan";
  } else if (quickPromptId === "recent_prs") {
    focusContext =
      prs.length > 0
        ? prs
            .map(
              (p) =>
                `- ${p.date} ${p.exercise}: ${p.weight}kg x ${p.reps || "?"} (prev best ${p.previousBest}kg)`,
            )
            .join("\n")
        : "No recent personal records detected in logs.";
    intent = "prs";
  } else if (quickPromptId === "overall_progress") {
    focusContext = [
      formatWeekContext(week),
      `Total logged workout days: ${Object.keys(workouts || {}).filter((d) => workouts[d]?.exs?.length).length}`,
      prs.length ? `Recent PRs:\n${prs.map((p) => `- ${p.exercise} ${p.weight}kg`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    intent = "overall";
  } else {
    const matched = matchExerciseName(message, names);
    if (matched && /progress|trend|last month|improve|pr|personal record/i.test(message)) {
      const days = /month|30 day|four week/i.test(message) ? 30 : 14;
      focusContext = formatProgressionContext(getExerciseProgression(workouts, matched, days));
      intent = "progression";
    } else if (/today|train today|what should i/i.test(message)) {
      focusContext = [formatWeekContext(week), formatTodayContext(today)].join("\n\n");
      intent = "plan";
    } else if (/this week|weekly|on track/i.test(message)) {
      focusContext = formatWeekContext(week);
      intent = "weekly";
    } else {
      focusContext = [
        formatWeekContext(week),
        formatTodayContext(today),
        prs.length
          ? `Recent PRs:\n${prs.map((p) => `- ${p.date} ${p.exercise} ${p.weight}kg`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  }

  const profile = [
    settings.displayName ? `Name: ${settings.displayName}` : "",
    settings.weight ? `Weight: ${settings.weight}${settings.units === "Imperial" ? " lbs" : " kg"}` : "",
    settings.height ? `Height: ${settings.height}${settings.units === "Imperial" ? " in" : " cm"}` : "",
    settings.age ? `Age: ${settings.age}` : "",
    settings.goalsPerWeek ? `Weekly goal: ${settings.goalsPerWeek} sessions` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    intent,
    profile: profile || "No profile details saved yet.",
    focusContext,
    exerciseNames: names.slice(0, 40),
    dataNote: "Use ONLY the workout data below. Never invent numbers.",
  };
}

export function buildLocalCoachReply(contextBundle, userMessage) {
  const { focusContext, profile, intent } = contextBundle;

  const intro = {
    progression: "Here's what your logs show for that exercise:",
    weekly: "Your week at a glance:",
    plan: "Based on your recent training:",
    prs: "Recent PRs from your history:",
    overall: "Overall progress summary:",
    general: "Based on your GymTracker data:",
  }[intent || "general"];

  return [
    `🏋️ **Coach** — ${intro}`,
    "",
    focusContext,
    "",
    profile ? `Profile:\n${profile}` : "",
    "",
    "💡 Tip: Log consistently for sharper recommendations. This reply was generated locally from your data (no AI API). Connect Groq free API in settings for natural coaching language.",
    "",
    `_You asked: "${userMessage}"_`,
  ]
    .filter(Boolean)
    .join("\n");
}
