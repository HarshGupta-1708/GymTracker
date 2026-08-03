import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { auth, db } from "../config/firebaseConfig";
import { getDefaultProfileId } from "./athletes";
import { getActiveProfileId, SELF_PROFILE } from "./profileScope";

const DEVICE_ID_KEY = "gt_device_id";

const getUid = () => auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);
const cloudRef = (uid) => doc(db, "users", uid, "settings", "devices");
const localKey = () => `gt_devices_${getUid() || "guest"}`;

function makeId() {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getDeviceId() {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = makeId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function deviceLabel() {
  if (Platform.OS === "web") {
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad (web)";
      if (/Android/i.test(ua)) return "Android (web)";
      if (/Mac/i.test(ua)) return "Mac (web)";
      if (/Windows/i.test(ua)) return "Windows (web)";
      return "Web browser";
    } catch {
      return "Web browser";
    }
  }
  if (Platform.OS === "ios") return "iPhone / iPad";
  if (Platform.OS === "android") return "Android";
  return Platform.OS;
}

async function loadAll() {
  const uid = getUid();
  if (!uid) return [];
  try {
    const local = await AsyncStorage.getItem(localKey());
    let items = local ? JSON.parse(local) : [];
    if (!auth.isDemo) {
      const snap = await getDoc(cloudRef(uid));
      if (snap.exists()) {
        items = snap.data()?.items || [];
        await AsyncStorage.setItem(localKey(), JSON.stringify(items));
      }
    }
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function saveAll(items) {
  const uid = getUid();
  await AsyncStorage.setItem(localKey(), JSON.stringify(items));
  if (uid && !auth.isDemo) {
    await setDoc(
      cloudRef(uid),
      { items, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
}

/**
 * Upsert this device's session: where logged in + primary + currently using.
 */
export async function touchDeviceSession({
  ownerName,
  athletes = [],
} = {}) {
  const uid = getUid();
  if (!uid) return;

  const deviceId = await getDeviceId();
  const activeId = getActiveProfileId();
  const primaryId = await getDefaultProfileId();
  const resolveName = (id) => {
    if (!id || id === SELF_PROFILE) {
      const n = String(ownerName || "").trim();
      // Never persist demo placeholder as the real primary name
      if (!n || /^demo athlete$/i.test(n)) return "You";
      return n;
    }
    return athletes.find((a) => a.id === id)?.name || "Profile";
  };

  const items = await loadAll();
  const next = {
    id: deviceId,
    label: deviceLabel(),
    platform: Platform.OS,
    activeProfileId: activeId,
    activeProfileName: resolveName(activeId),
    primaryProfileId: primaryId,
    primaryProfileName: resolveName(primaryId),
    updatedAt: new Date().toISOString(),
    thisDevice: true,
  };

  const others = items.filter((d) => d.id !== deviceId).map((d) => ({ ...d, thisDevice: false }));
  // Keep last 12 devices
  const merged = [next, ...others].slice(0, 12);
  await saveAll(merged);
  return merged;
}

export async function listDeviceSessions() {
  const deviceId = await getDeviceId();
  const items = await loadAll();
  return items.map((d) => ({ ...d, thisDevice: d.id === deviceId }));
}

export async function removeDeviceSession(sessionId) {
  const items = await loadAll();
  const deviceId = await getDeviceId();
  if (sessionId === deviceId) return items;
  const next = items.filter((d) => d.id !== sessionId);
  await saveAll(next);
  return next;
}
