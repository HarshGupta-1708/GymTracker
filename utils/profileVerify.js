import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { auth } from "../config/firebaseConfig";
import { parseVerifyQuery, verifyProfileInvite } from "./athletes";

export const PENDING_VERIFY_KEY = "gt_pending_verify";

async function readPending() {
  try {
    if (Platform.OS === "web" && typeof sessionStorage !== "undefined") {
      const raw = sessionStorage.getItem(PENDING_VERIFY_KEY);
      return raw ? JSON.parse(raw) : null;
    }
    const raw = await AsyncStorage.getItem(PENDING_VERIFY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function stashPendingVerify(parsed) {
  if (!parsed?.email || !parsed?.token) return;
  const payload = JSON.stringify({
    email: String(parsed.email).toLowerCase(),
    token: parsed.token,
  });
  if (Platform.OS === "web" && typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(PENDING_VERIFY_KEY, payload);
    return;
  }
  await AsyncStorage.setItem(PENDING_VERIFY_KEY, payload);
}

export async function clearPendingVerify() {
  if (Platform.OS === "web" && typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(PENDING_VERIFY_KEY);
    return;
  }
  await AsyncStorage.removeItem(PENDING_VERIFY_KEY);
}

export function extractVerifyFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    if (url.includes("verifyProfile=1")) {
      const query = url.includes("?") ? url.split("?").slice(1).join("?") : url;
      return parseVerifyQuery(`?${query.replace(/^\?/, "")}`);
    }
    const parsed = Linking.parse(url);
    const q = parsed?.queryParams || {};
    if (q.verifyProfile === "1" && q.email && q.token) {
      return {
        email: decodeURIComponent(String(q.email)),
        token: decodeURIComponent(String(q.token)),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Complete verify after opening invite link. Works when user is already signed in
 * (onAuthStateChanged does not re-fire in that case).
 */
export async function tryCompletePendingVerify(user) {
  if (!user?.email || auth.isDemo) return null;

  const pending = await readPending();
  if (!pending?.email || !pending?.token) return null;

  const loginEmail = String(user.email).toLowerCase();
  const targetEmail = String(pending.email).toLowerCase();

  if (loginEmail !== targetEmail) {
    return {
      status: "wrong_account",
      expected: targetEmail,
      actual: loginEmail,
    };
  }

  try {
    const result = await verifyProfileInvite(pending);
    await clearPendingVerify();
    return { status: "verified", ...result };
  } catch (err) {
    return {
      status: "failed",
      message: err?.message || "Invalid or expired verification link",
      pending,
    };
  }
}

export function showVerifyAlert(title, message) {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.alert) {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  const { Alert } = require("react-native");
  Alert.alert(title, message);
}
