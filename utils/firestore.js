import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    setDoc
} from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";

// Dynamic storage keys namespaced by user UID to prevent data leaking between Gmail & Guest accounts
const getWorkoutsKey = () => {
  const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : "guest");
  return `gt_workouts_local_${uid}`;
};

const getExercisesKey = () => {
  const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : "guest");
  return `gt_exercises_local_${uid}`;
};

const getSyncStatusKey = () => {
  const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : "guest");
  return `gt_sync_status_${uid}`;
};

const getSettingsKey = () => {
  const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : "guest");
  return `gt_user_settings_${uid}`;
};

// ===== UTILITY FUNCTIONS =====

// Calculate kcal burned (rough estimation: 5-7 kcal per rep * weight in kg)
export const estimateKcal = (sets) => {
  if (!Array.isArray(sets)) return 0;
  return Math.round(
    sets.reduce((total, set) => {
      const weight = parseFloat(set.w) || 0;
      const reps = parseInt(set.r) || 0;
      return total + weight * reps * 0.06; // 6 kcal per rep-kg (average)
    }, 0),
  );
};

// Get streak data
export const calculateStreaks = (workouts) => {
  if (!workouts || Object.keys(workouts).length === 0) {
    return { currentStreak: 0, longestStreak: 0, thisWeekWorkouts: 0, thisWeekActive: 0 };
  }

  const isActiveDay = (date) => {
    const w = workouts[date];
    return w?.completedAt || w?.exs?.length > 0;
  };

  const dates = Object.keys(workouts)
    .filter(isActiveDay)
    .sort()
    .reverse();

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, thisWeekWorkouts: 0, thisWeekActive: 0 };
  }

  // Calculate current streak
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 0; i < dates.length; i++) {
    const currDate = new Date(dates[i]);
    const nextDate = i + 1 < dates.length ? new Date(dates[i + 1]) : null;

    if (nextDate) {
      const daysDiff = Math.floor(
        (currDate - nextDate) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff === 1) {
        tempStreak++;
      } else {
        if (i === 0) currentStreak = tempStreak;
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      if (i === 0) currentStreak = tempStreak;
      longestStreak = Math.max(longestStreak, tempStreak);
    }
  }

  // Count this week's workouts
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const isCompletedDay = (w) => {
    if (!w) return false;
    if (w.completedAt) return true;
    return w.exs?.length > 0 && w.exs.some((ex) => ex.sets?.length > 0);
  };

  const thisWeekWorkouts = Object.keys(workouts).filter((date) => {
    if (new Date(`${date}T12:00`) < weekStart) return false;
    return isCompletedDay(workouts[date]);
  }).length;

  const thisWeekActive = dates.filter((date) => new Date(`${date}T12:00`) >= weekStart).length;

  return {
    currentStreak,
    longestStreak,
    thisWeekWorkouts,
    thisWeekActive,
  };
};

// Get workouts by date range
export const getWorkoutsByDateRange = (workouts, startDate, endDate) => {
  return Object.entries(workouts || {})
    .filter(([date]) => date >= startDate && date <= endDate)
    .reduce((acc, [date, data]) => {
      acc[date] = data;
      return acc;
    }, {});
};

// ===== WORKOUTS =====

export const saveWorkout = async (date, workoutData) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Not authenticated");

    // Save to Firestore (auto syncs offline)
    const ref = doc(db, "users", uid, "workouts", date);
    await setDoc(ref, workoutData, { merge: true });

    // Also save locally
    await saveWorkoutLocal(date, workoutData);

    return true;
  } catch (err) {
    console.error("Save workout error:", err);
    // Still save locally even if Firestore fails
    await saveWorkoutLocal(date, workoutData);
    return false;
  }
};

export const saveWorkoutLocal = async (date, workoutData) => {
  try {
    const allWorkouts = JSON.parse(
      (await AsyncStorage.getItem(getWorkoutsKey())) || "{}",
    );
    allWorkouts[date] = workoutData;
    await AsyncStorage.setItem(
      getWorkoutsKey(),
      JSON.stringify(allWorkouts),
    );
  } catch (err) {
    console.error("Local save error:", err);
  }
};

export const loadWorkoutLocal = async () => {
  try {
    const data = await AsyncStorage.getItem(getWorkoutsKey());
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

export const getWorkouts = async () => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Not authenticated");

    const ref = collection(db, "users", uid, "workouts");
    const snapshot = await getDocs(ref);
    const data = {};
    snapshot.forEach((doc) => {
      data[doc.id] = doc.data();
    });

    // Save to local storage
    await AsyncStorage.setItem(getWorkoutsKey(), JSON.stringify(data));
    return data;
  } catch (err) {
    console.error("Get workouts error:", err);
    // Return local data as fallback
    return await loadWorkoutLocal();
  }
};

export const listenWorkouts = (callback) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      callback({});
      return () => {};
    }

    const ref = collection(db, "users", uid, "workouts");
    return onSnapshot(
      ref,
      (snapshot) => {
        const data = {};
        snapshot.forEach((doc) => {
          data[doc.id] = doc.data();
        });
        callback(data);
        // Save snapshot to local
        AsyncStorage.setItem(getWorkoutsKey(), JSON.stringify(data)).catch(
          console.error,
        );
      },
      (error) => {
        console.error("Listen workouts error:", error);
        // Fallback to local
        loadWorkoutLocal().then(callback);
      },
    );
  } catch (err) {
    console.error("Listen setup error:", err);
    loadWorkoutLocal().then(callback);
    return () => {};
  }
};

export const deleteWorkout = async (date) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Not authenticated");

    await deleteDoc(doc(db, "users", uid, "workouts", date));

    // Remove from local
    const allWorkouts = JSON.parse(
      (await AsyncStorage.getItem(getWorkoutsKey())) || "{}",
    );
    delete allWorkouts[date];
    await AsyncStorage.setItem(
      getWorkoutsKey(),
      JSON.stringify(allWorkouts),
    );
  } catch (err) {
    console.error("Delete workout error:", err);
  }
};

// ===== EXERCISES =====

export const saveExercisesLib = async (exercises) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Not authenticated");

    const ref = doc(db, "users", uid, "exercises", "library");
    await setDoc(ref, { items: exercises }, { merge: true });

    // Save locally
    await AsyncStorage.setItem(
      getExercisesKey(),
      JSON.stringify(exercises),
    );
    return true;
  } catch (err) {
    console.error("Save exercises error:", err);
    await AsyncStorage.setItem(
      getExercisesKey(),
      JSON.stringify(exercises),
    );
    return false;
  }
};

export const getExercisesLib = async () => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Not authenticated");

    const ref = doc(db, "users", uid, "exercises", "library");
    const snapshot = await getDocs(collection(ref.parent, ref.id));

    if (snapshot.empty) return null;

    const data = snapshot.docs[0]?.data();
    if (data?.items) {
      await AsyncStorage.setItem(
        getExercisesKey(),
        JSON.stringify(data.items),
      );
      return data.items;
    }
  } catch (err) {
    console.error("Get exercises error:", err);
  }

  // Return local as fallback
  try {
    const local = await AsyncStorage.getItem(getExercisesKey());
    return local ? JSON.parse(local) : null;
  } catch {
    return null;
  }
};

export const listenExercises = (callback) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      callback(null);
      return () => {};
    }

    const ref = doc(db, "users", uid, "exercises", "library");
    return onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.items) {
            callback(data.items);
            AsyncStorage.setItem(
              getExercisesKey(),
              JSON.stringify(data.items),
            ).catch(console.error);
          }
        }
      },
      (error) => {
        console.error("Listen exercises error:", error);
        AsyncStorage.getItem(getExercisesKey())
          .then((data) => callback(data ? JSON.parse(data) : null))
          .catch(() => callback(null));
      },
    );
  } catch (err) {
    console.error("Listen setup error:", err);
    return () => {};
  }
};

// ===== SYNC STATUS =====

export const getSyncStatus = async () => {
  try {
    const status = await AsyncStorage.getItem(getSyncStatusKey());
    return status
      ? JSON.parse(status)
      : { synced: true, lastSync: null, pending: 0 };
  } catch {
    return { synced: true, lastSync: null, pending: 0 };
  }
};

export const setSyncStatus = async (status) => {
  try {
    await AsyncStorage.setItem(getSyncStatusKey(), JSON.stringify(status));
  } catch (err) {
    console.error("Set sync status error:", err);
  }
};

// ===== USER SETTINGS (GOALS) =====

// Scramble/encrypt base64 string using XOR with key 13
export const encryptPhoto = (base64Str) => {
  if (!base64Str) return "";
  if (!base64Str.startsWith("data:image")) return base64Str;
  return base64Str.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ 13)).join("");
};

export const decryptPhoto = (encryptedStr) => {
  if (!encryptedStr) return "";
  if (encryptedStr.startsWith("data:image")) return encryptedStr;
  return encryptedStr.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ 13)).join("");
};

export const saveUserSettings = async (settings) => {
  try {
    const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);
    if (!uid) throw new Error("Not authenticated");

    // Scramble photos for cloud storage
    const cloudSettings = { ...settings };
    if (cloudSettings.profilePhoto) {
      cloudSettings.profilePhoto = encryptPhoto(cloudSettings.profilePhoto);
    }
    if (cloudSettings.bodyPhoto) {
      cloudSettings.bodyPhoto = encryptPhoto(cloudSettings.bodyPhoto);
    }

    if (auth.isDemo) {
      await AsyncStorage.setItem(getSettingsKey(), JSON.stringify(settings));
      return true;
    }

    const ref = doc(db, "users", uid, "settings", "preferences");
    await setDoc(ref, cloudSettings, { merge: true });

    // Save locally in decrypted form for fast rendering
    await AsyncStorage.setItem(getSettingsKey(), JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error("Save settings error:", err);
    await AsyncStorage.setItem(getSettingsKey(), JSON.stringify(settings));
    return false;
  }
};

export const loadUserSettings = async () => {
  try {
    const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);
    if (!uid) throw new Error("Not authenticated");

    if (auth.isDemo) {
      const local = await AsyncStorage.getItem(getSettingsKey());
      return local ? JSON.parse(local) : { goalsPerWeek: 4, theme: "dark" };
    }

    const ref = doc(db, "users", uid, "settings", "preferences");
    const snapshot = await getDocs(collection(db, "users", uid, "settings"));

    if (snapshot.size > 0) {
      const doc = snapshot.docs.find((d) => d.id === "preferences");
      if (doc) {
        const data = doc.data();
        // Decrypt photos
        if (data.profilePhoto) {
          data.profilePhoto = decryptPhoto(data.profilePhoto);
        }
        if (data.bodyPhoto) {
          data.bodyPhoto = decryptPhoto(data.bodyPhoto);
        }
        await AsyncStorage.setItem(getSettingsKey(), JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.error("Load settings error:", err);
  }

  // Return local as fallback
  try {
    const local = await AsyncStorage.getItem(getSettingsKey());
    return local ? JSON.parse(local) : { goalsPerWeek: 4, theme: "dark" };
  } catch {
    return { goalsPerWeek: 4, theme: "dark" };
  }
};

export const listenUserSettings = (callback) => {
  try {
    const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);
    if (!uid) {
      callback({ goalsPerWeek: 4, theme: "dark" });
      return () => {};
    }

    // Load from local storage immediately first for fast rendering
    AsyncStorage.getItem(getSettingsKey()).then((local) => {
      if (local) {
        callback(JSON.parse(local));
      }
    }).catch(console.error);

    if (auth.isDemo) {
      return () => {};
    }

    const ref = doc(db, "users", uid, "settings", "preferences");
    return onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // Decrypt photos
          if (data.profilePhoto) {
            data.profilePhoto = decryptPhoto(data.profilePhoto);
          }
          if (data.bodyPhoto) {
            data.bodyPhoto = decryptPhoto(data.bodyPhoto);
          }
          callback(data);
          AsyncStorage.setItem(getSettingsKey(), JSON.stringify(data)).catch(
             console.error,
          );
        }
      },
      (error) => {
        console.error("Listen settings error:", error);
      },
    );
  } catch (err) {
    console.error("Listen settings setup error:", err);
    return () => {};
  }
};

// ===== HISTORICAL BODY PHOTOS SUBCOLLECTION =====

export const saveBodyPhotoEntry = async (photoEntry) => {
  try {
    const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);
    if (!uid) throw new Error("Not authenticated");

    // Scramble photo for cloud storage
    const cloudEntry = { ...photoEntry };
    if (cloudEntry.photo) {
      cloudEntry.photo = encryptPhoto(cloudEntry.photo);
    }

    if (auth.isDemo) {
      const key = `gt_body_photos_local_demo-user`;
      const current = JSON.parse((await AsyncStorage.getItem(key)) || "[]");
      current.push(photoEntry);
      await AsyncStorage.setItem(key, JSON.stringify(current));
      return true;
    }

    const ref = doc(db, "users", uid, "bodyPhotos", photoEntry.id);
    await setDoc(ref, cloudEntry);

    // Save locally
    const key = `gt_body_photos_local_${uid}`;
    const current = JSON.parse((await AsyncStorage.getItem(key)) || "[]");
    current.push(photoEntry);
    await AsyncStorage.setItem(key, JSON.stringify(current));
    return true;
  } catch (err) {
    console.error("Save body photo entry error:", err);
    return false;
  }
};

export const listenBodyPhotos = (callback) => {
  try {
    const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);
    if (!uid) {
      callback([]);
      return () => {};
    }

    const key = `gt_body_photos_local_${uid}`;
    AsyncStorage.getItem(key).then((local) => {
      if (local) {
        callback(JSON.parse(local));
      }
    }).catch(console.error);

    if (auth.isDemo) {
      return () => {};
    }

    const ref = collection(db, "users", uid, "bodyPhotos");
    return onSnapshot(
      ref,
      (snapshot) => {
        const data = [];
        snapshot.forEach((doc) => {
          const entry = doc.data();
          if (entry.photo) {
            entry.photo = decryptPhoto(entry.photo);
          }
          data.push(entry);
        });
        // Sort by date/timestamp descending
        data.sort((a, b) => b.id.localeCompare(a.id));
        callback(data);
        AsyncStorage.setItem(key, JSON.stringify(data)).catch(console.error);
      },
      (error) => {
        console.error("Listen body photos error:", error);
      }
    );
  } catch (err) {
    console.error("Listen body photos setup error:", err);
    return () => {};
  }
};

export const deleteBodyPhotoEntry = async (entryId) => {
  try {
    const uid = auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);
    if (!uid) throw new Error("Not authenticated");

    if (auth.isDemo) {
      const key = `gt_body_photos_local_demo-user`;
      const current = JSON.parse((await AsyncStorage.getItem(key)) || "[]");
      const updated = current.filter(item => item.id !== entryId);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      return true;
    }

    // Delete from Firestore
    await deleteDoc(doc(db, "users", uid, "bodyPhotos", entryId));

    // Delete from local storage
    const key = `gt_body_photos_local_${uid}`;
    const current = JSON.parse((await AsyncStorage.getItem(key)) || "[]");
    const updated = current.filter(item => item.id !== entryId);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error("Delete body photo entry error:", err);
    return false;
  }
};
