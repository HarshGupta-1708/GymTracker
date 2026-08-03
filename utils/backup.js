import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { auth } from "../config/firebaseConfig";
import {
  getDefaultProfileId,
  listAthletes,
  replaceAthletesRegistry,
} from "./athletes";
import {
  getExercisesLib,
  getWorkouts,
  loadUserSettings,
  saveExercisesLib,
  saveUserSettings,
  saveWorkout,
} from "./firestore";
import {
  getActiveProfileId,
  runWithProfile,
  SELF_PROFILE,
  setActiveProfileId,
} from "./profileScope";

async function collectActiveSlice() {
  const workouts = await getWorkouts();
  const exercises = (await getExercisesLib()) || [];
  const settings = (await loadUserSettings()) || {};
  return { workouts, exercises, settings };
}

async function applySlice(slice) {
  let workoutCount = 0;
  if (slice?.workouts && typeof slice.workouts === "object") {
    for (const [date, workout] of Object.entries(slice.workouts)) {
      await saveWorkout(date, workout);
      workoutCount += 1;
    }
  }
  if (Array.isArray(slice?.exercises) && slice.exercises.length) {
    await saveExercisesLib(slice.exercises);
  }
  if (slice?.settings && typeof slice.settings === "object") {
    await saveUserSettings(slice.settings);
  }
  return workoutCount;
}

/**
 * Export:
 * - On primary profile → full account (owner + all added profiles)
 * - On other profile → only that profile's data
 */
export const exportUserData = async () => {
  const activeId = getActiveProfileId();
  const defaultId = await getDefaultProfileId();
  const isPrimarySession = activeId === defaultId;

  let payload;
  let fileTag;

  if (!isPrimarySession) {
    const slice = await collectActiveSlice();
    payload = {
      version: 2,
      scope: "profile",
      profileId: activeId,
      exportedAt: new Date().toISOString(),
      uid: auth.currentUser?.uid || "unknown",
      ...slice,
    };
    fileTag = "profile";
  } else {
    const athletes = await listAthletes();
    const profiles = {};

    profiles[SELF_PROFILE] = await runWithProfile(SELF_PROFILE, collectActiveSlice);
    for (const a of athletes) {
      profiles[a.id] = await runWithProfile(a.id, collectActiveSlice);
    }

    payload = {
      version: 2,
      scope: "account",
      defaultProfileId: defaultId,
      athletes,
      profiles,
      exportedAt: new Date().toISOString(),
      uid: auth.currentUser?.uid || "unknown",
      // Convenience: also include active (primary) slice at top-level for older importers
      ...(profiles[activeId] || profiles[SELF_PROFILE] || {}),
    };
    fileTag = "account";
  }

  const json = JSON.stringify(payload, null, 2);
  const fileName = `fittrack-backup-${fileTag}-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === "web") {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true, fileName, scope: payload.scope };
  }

  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: "application/json",
      dialogTitle: "Export FitTrack Backup",
      UTI: "public.json",
    });
  }

  return { success: true, fileName, path, scope: payload.scope };
};

/**
 * Import:
 * - Account backup while on primary → restore all profiles + registry
 * - Otherwise → restore into the currently active profile only
 */
export const importUserData = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { success: false, cancelled: true };
  }

  const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
  const data = JSON.parse(content);

  const activeId = getActiveProfileId();
  const defaultId = await getDefaultProfileId();
  const isPrimarySession = activeId === defaultId;

  // Full account restore
  if (
    isPrimarySession &&
    data.scope === "account" &&
    data.profiles &&
    typeof data.profiles === "object"
  ) {
    let workoutCount = 0;
    const ids = Object.keys(data.profiles);
    for (const pid of ids) {
      const n = await runWithProfile(pid, () => applySlice(data.profiles[pid]));
      workoutCount += n;
    }
    if (Array.isArray(data.athletes)) {
      await replaceAthletesRegistry(data.athletes, data.defaultProfileId || SELF_PROFILE);
    }
    setActiveProfileId(defaultId);
    return {
      success: true,
      workoutCount,
      exerciseCount: 0,
      scope: "account",
      profileCount: ids.length,
    };
  }

  // Single-profile / legacy backup → current profile only
  const slice =
    data.scope === "account" && data.profiles
      ? data.profiles[activeId] || data.profiles[SELF_PROFILE] || data
      : data;

  if (!slice.workouts || typeof slice.workouts !== "object") {
    throw new Error("Invalid backup file: missing workouts");
  }

  const workoutCount = await applySlice(slice);

  return {
    success: true,
    workoutCount,
    exerciseCount: slice.exercises?.length || 0,
    scope: "profile",
  };
};
