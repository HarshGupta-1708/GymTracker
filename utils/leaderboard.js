import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import { getActiveProfileId, SELF_PROFILE } from "./profileScope";
import { computeStreakStats } from "./streakStats";

const board = () => collection(db, "leaderboard");

export function leaderboardEntryId(uid, profileId = SELF_PROFILE) {
  return `${uid}_${profileId || SELF_PROFILE}`;
}

export async function publishLeaderboardEntry({
  displayName,
  workouts,
  settings,
  profileId,
}) {
  const uid = auth.currentUser?.uid;
  if (!uid || auth.isDemo) return false;

  const pid = profileId || getActiveProfileId();
  const stats = computeStreakStats(workouts, settings);
  const id = leaderboardEntryId(uid, pid);

  await setDoc(
    doc(db, "leaderboard", id),
    {
      ownerUid: uid,
      profileId: pid,
      displayName: displayName || "Athlete",
      longestWeekStreak: stats.longestWeekStreak || 0,
      longestDayStreak: stats.longestDayStreak || 0,
      goalsPerWeek: stats.goalsPerWeek || 3,
      sessions: stats.sessions || 0,
      updatedAt: new Date().toISOString(),
      optIn: true,
    },
    { merge: true },
  );
  return true;
}

export async function removeLeaderboardEntry(profileId) {
  const uid = auth.currentUser?.uid;
  if (!uid || auth.isDemo) return;
  const id = leaderboardEntryId(uid, profileId || getActiveProfileId());
  try {
    await deleteDoc(doc(db, "leaderboard", id));
  } catch (e) {
    console.warn("[leaderboard] remove failed", e);
  }
}

export async function fetchLeaderboard(sortField = "longestWeekStreak", max = 50) {
  const field =
    sortField === "longestDayStreak" ? "longestDayStreak" : "longestWeekStreak";
  try {
    const q = query(board(), orderBy(field, "desc"), limit(max));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
    return rows;
  } catch (e) {
    console.warn("[leaderboard] fetch failed — check Firestore rules", e);
    return [];
  }
}

export function rankOf(rows, uid, profileId, field = "longestWeekStreak") {
  const id = leaderboardEntryId(uid, profileId);
  const sorted = [...rows].sort((a, b) => (b[field] || 0) - (a[field] || 0));
  const idx = sorted.findIndex((r) => r.id === id);
  return idx >= 0 ? idx + 1 : null;
}
