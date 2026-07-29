import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import { WORKOUT_PLANS } from "../constants/data";

const getEffectiveUid = () =>
  auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);

const getPlansKey = () => {
  const uid = getEffectiveUid() || "guest";
  return `gt_workout_plans_${uid}`;
};

export const defaultPlansFromConstants = () =>
  Object.entries(WORKOUT_PLANS).map(([name, exercises], i) => ({
    id: `default_${i}_${name.slice(0, 12).replace(/\W/g, "")}`,
    name,
    exercises: [...exercises],
  }));

const normalizePlans = (raw) => {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((p) => p && typeof p.name === "string" && Array.isArray(p.exercises))
    .map((p, i) => ({
      id: p.id || `plan_${i}_${Date.now()}`,
      name: p.name,
      exercises: p.exercises.filter((n) => typeof n === "string" && n.trim()),
    }));
};

export const loadWorkoutPlans = async () => {
  try {
    const local = await AsyncStorage.getItem(getPlansKey());
    if (local != null) {
      const parsed = normalizePlans(JSON.parse(local));
      if (parsed) return parsed;
    }
  } catch (err) {
    console.warn("[Plans] Local load failed:", err?.message);
  }
  return defaultPlansFromConstants();
};

export const saveWorkoutPlans = async (plans) => {
  const normalized = normalizePlans(plans) || [];
  const uid = getEffectiveUid();
  try {
    await AsyncStorage.setItem(getPlansKey(), JSON.stringify(normalized));
    if (uid && !auth.isDemo) {
      const ref = doc(db, "users", uid, "settings", "workoutPlans");
      await setDoc(ref, { items: normalized, updatedAt: new Date().toISOString() }, { merge: true });
    }
    return normalized;
  } catch (err) {
    console.error("[Plans] Save failed:", err);
    await AsyncStorage.setItem(getPlansKey(), JSON.stringify(normalized));
    return normalized;
  }
};

export const listenWorkoutPlans = (callback) => {
  const uid = getEffectiveUid();
  let unsub = () => {};

  loadWorkoutPlans().then(callback).catch(() => callback(defaultPlansFromConstants()));

  if (!uid || auth.isDemo) return unsub;

  try {
    const ref = doc(db, "users", uid, "settings", "workoutPlans");
    unsub = onSnapshot(
      ref,
      async (snap) => {
        if (snap.exists()) {
          const items = normalizePlans(snap.data()?.items);
          if (items) {
            await AsyncStorage.setItem(getPlansKey(), JSON.stringify(items));
            callback(items);
          }
        }
      },
      (err) => console.warn("[Plans] Snapshot error:", err?.message),
    );
  } catch (err) {
    console.warn("[Plans] Listen failed:", err?.message);
  }

  return () => unsub();
};

export const createPlanId = () => `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
