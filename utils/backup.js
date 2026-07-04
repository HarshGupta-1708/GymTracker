import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { auth } from "../config/firebaseConfig";
import {
  getExercisesLib,
  getWorkouts,
  loadUserSettings,
  saveExercisesLib,
  saveUserSettings,
  saveWorkout,
} from "./firestore";

export const exportUserData = async () => {
  const workouts = await getWorkouts();
  const exercises = (await getExercisesLib()) || [];
  const settings = (await loadUserSettings()) || {};

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    uid: auth.currentUser?.uid || "unknown",
    workouts,
    exercises,
    settings,
  };

  const json = JSON.stringify(payload, null, 2);
  const fileName = `gymtracker-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === "web") {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true, fileName };
  }

  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: "application/json",
      dialogTitle: "Export Gym Tracker Backup",
      UTI: "public.json",
    });
  }

  return { success: true, fileName, path };
};

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

  if (!data.workouts || typeof data.workouts !== "object") {
    throw new Error("Invalid backup file: missing workouts");
  }

  let workoutCount = 0;
  for (const [date, workout] of Object.entries(data.workouts)) {
    await saveWorkout(date, workout);
    workoutCount += 1;
  }

  if (Array.isArray(data.exercises) && data.exercises.length) {
    await saveExercisesLib(data.exercises);
  }

  if (data.settings && typeof data.settings === "object") {
    await saveUserSettings(data.settings);
  }

  return {
    success: true,
    workoutCount,
    exerciseCount: data.exercises?.length || 0,
  };
};
