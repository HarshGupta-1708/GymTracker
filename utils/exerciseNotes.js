import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";

const getEffectiveUid = () =>
  auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);

const getNotesKey = () => {
  const uid = getEffectiveUid() || "guest";
  return `gt_exercise_notes_${uid}`;
};

const normalizeNotes = (raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  Object.entries(raw).forEach(([name, note]) => {
    if (typeof name === "string" && name.trim() && typeof note === "string") {
      const trimmed = note.trim();
      if (trimmed) out[name] = trimmed;
    }
  });
  return out;
};

export const loadExerciseNotes = async () => {
  try {
    const local = await AsyncStorage.getItem(getNotesKey());
    if (local) return normalizeNotes(JSON.parse(local));
  } catch (err) {
    console.warn("[Notes] Local load failed:", err?.message);
  }
  return {};
};

export const saveExerciseNotes = async (notes) => {
  const normalized = normalizeNotes(notes);
  const uid = getEffectiveUid();
  try {
    await AsyncStorage.setItem(getNotesKey(), JSON.stringify(normalized));
    if (uid && !auth.isDemo) {
      const ref = doc(db, "users", uid, "settings", "exerciseNotes");
      await setDoc(
        ref,
        { notes: normalized, updatedAt: new Date().toISOString() },
        { merge: true },
      );
    }
    return normalized;
  } catch (err) {
    console.error("[Notes] Save failed:", err);
    await AsyncStorage.setItem(getNotesKey(), JSON.stringify(normalized));
    return normalized;
  }
};

export const upsertExerciseNote = async (exerciseName, text) => {
  const current = await loadExerciseNotes();
  const next = { ...current };
  const trimmed = (text || "").trim();
  if (trimmed) next[exerciseName] = trimmed;
  else delete next[exerciseName];
  return saveExerciseNotes(next);
};

export const listenExerciseNotes = (callback) => {
  const uid = getEffectiveUid();
  let unsub = () => {};

  loadExerciseNotes().then(callback).catch(() => callback({}));

  if (!uid || auth.isDemo) return unsub;

  try {
    const ref = doc(db, "users", uid, "settings", "exerciseNotes");
    unsub = onSnapshot(
      ref,
      async (snap) => {
        if (snap.exists()) {
          const notes = normalizeNotes(snap.data()?.notes);
          await AsyncStorage.setItem(getNotesKey(), JSON.stringify(notes));
          callback(notes);
        }
      },
      (err) => console.warn("[Notes] Snapshot error:", err?.message),
    );
  } catch (err) {
    console.warn("[Notes] Listen failed:", err?.message);
  }

  return () => unsub();
};
