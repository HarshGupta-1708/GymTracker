import { calculateStreaks } from "./firestore";
import { todayStr } from "../constants/data";

/**
 * Shared streak math used by Dashboard + global leaderboard publish.
 */
export function computeStreakStats(workouts, settings = {}) {
  const workoutEntries = Object.entries(workouts || {}).filter(([, w]) => w?.exs?.length);
  const goalsPerWeek = settings?.goalsPerWeek || settings?.activeDaysPerWeek || 3;

  const toKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (dateStr, n) => {
    const d = new Date(`${dateStr}T12:00`);
    d.setDate(d.getDate() + n);
    return toKey(d);
  };
  const sundayOf = (dateStr) => {
    const d = new Date(`${dateStr}T12:00`);
    d.setDate(d.getDate() - d.getDay());
    return toKey(d);
  };

  const weekMap = {};
  workoutEntries.forEach(([date]) => {
    const key = sundayOf(date);
    if (!weekMap[key]) weekMap[key] = [];
    weekMap[key].push(date);
  });

  const thisWeekStart = sundayOf(todayStr());
  const firstWeekStart = Object.keys(weekMap).sort()[0] || thisWeekStart;

  const weekBreakdown = [];
  for (let cursor = firstWeekStart; cursor <= thisWeekStart; cursor = addDays(cursor, 7)) {
    const dates = (weekMap[cursor] || []).slice().sort();
    const count = dates.length;
    weekBreakdown.push({
      weekStart: cursor,
      count,
      met: count >= goalsPerWeek,
      dates,
    });
  }

  let longestWeekStreak = 0;
  let running = 0;
  let bestWeekRunStart = -1;
  let bestWeekRunLen = 0;
  let runStart = -1;
  weekBreakdown.forEach((w, i) => {
    if (w.met) {
      if (running === 0) runStart = i;
      running += 1;
      if (running > bestWeekRunLen) {
        bestWeekRunLen = running;
        bestWeekRunStart = runStart;
      }
      longestWeekStreak = Math.max(longestWeekStreak, running);
    } else {
      running = 0;
      runStart = -1;
    }
  });

  const thisWeekEntry = weekBreakdown.find((w) => w.weekStart === thisWeekStart);
  let currentWeekStreak = 0;
  if (thisWeekEntry?.met) {
    currentWeekStreak = running;
  } else {
    for (let i = weekBreakdown.length - 1; i >= 0; i--) {
      if (weekBreakdown[i].weekStart === thisWeekStart) continue;
      if (weekBreakdown[i].met) currentWeekStreak += 1;
      else break;
    }
  }

  const longestWeekHistory =
    bestWeekRunLen > 0
      ? weekBreakdown.slice(bestWeekRunStart, bestWeekRunStart + bestWeekRunLen)
      : [];
  const currentWeekHistory = (() => {
    if (currentWeekStreak <= 0) return [];
    const out = [];
    for (let i = weekBreakdown.length - 1; i >= 0 && out.length < currentWeekStreak; i--) {
      if (weekBreakdown[i].weekStart === thisWeekStart && !weekBreakdown[i].met) continue;
      if (weekBreakdown[i].met) out.unshift(weekBreakdown[i]);
      else break;
    }
    return out;
  })();

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = (a, b) =>
    Math.round((new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / dayMs);
  const dayDates = workoutEntries.map(([d]) => d).sort();
  const dayRuns = [];
  let run = [];
  dayDates.forEach((d) => {
    if (run.length && diffDays(run[run.length - 1], d) === 1) run.push(d);
    else {
      if (run.length) dayRuns.push(run);
      run = [d];
    }
  });
  if (run.length) dayRuns.push(run);

  let longestConsecutive = [];
  dayRuns.forEach((r) => {
    if (r.length > longestConsecutive.length) longestConsecutive = r;
  });
  let currentConsecutive = [];
  if (dayRuns.length) {
    const lastRun = dayRuns[dayRuns.length - 1];
    if (diffDays(lastRun[lastRun.length - 1], todayStr()) <= 1) currentConsecutive = lastRun;
  }

  const datesFromWeeks = (weeks) => weeks.flatMap((w) => w.dates).sort();
  const longestFromWeeks = datesFromWeeks(longestWeekHistory);
  const currentFromWeeks = datesFromWeeks(currentWeekHistory);
  const longestDayHistory =
    longestFromWeeks.length > 0 ? longestFromWeeks : longestConsecutive;
  const currentDayHistory =
    currentFromWeeks.length > 0 ? currentFromWeeks : currentConsecutive;

  const streaks = calculateStreaks(workouts);

  return {
    longestWeekStreak,
    currentWeekStreak,
    longestDayStreak: longestDayHistory.length,
    currentDayStreak: currentDayHistory.length,
    goalsPerWeek,
    thisWeekWorkouts: streaks.thisWeekWorkouts || 0,
    sessions: workoutEntries.length,
  };
}
