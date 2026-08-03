import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCK_KEY = "gt_app_lock_v1";

const canUseSecureStore = Platform.OS !== "web";

async function readRaw() {
  try {
    if (canUseSecureStore) {
      const v = await SecureStore.getItemAsync(LOCK_KEY);
      if (v) return JSON.parse(v);
    }
    const local = await AsyncStorage.getItem(LOCK_KEY);
    return local ? JSON.parse(local) : null;
  } catch {
    return null;
  }
}

async function writeRaw(data) {
  const json = JSON.stringify(data);
  if (canUseSecureStore) {
    await SecureStore.setItemAsync(LOCK_KEY, json);
  }
  await AsyncStorage.setItem(LOCK_KEY, json);
}

export async function hashSecret(value) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, String(value));
}

function normalizeConfig(raw) {
  if (!raw) {
    return {
      enabled: false,
      deviceEnabled: false,
      pinEnabled: false,
      mode: "off",
      appMethod: "pin",
      pinHash: null,
      patternHash: null,
    };
  }

  // New shape
  if (typeof raw.deviceEnabled === "boolean" || typeof raw.pinEnabled === "boolean") {
    const deviceEnabled = Boolean(raw.deviceEnabled);
    const pinEnabled = Boolean(raw.pinEnabled && raw.pinHash);
    const enabled = deviceEnabled || pinEnabled || Boolean(raw.patternHash && raw.enabled);
    let mode = "off";
    if (deviceEnabled && pinEnabled) mode = "both";
    else if (deviceEnabled) mode = "device";
    else if (pinEnabled) mode = "app";
    return {
      enabled,
      deviceEnabled,
      pinEnabled,
      mode,
      appMethod: raw.appMethod || "pin",
      pinHash: raw.pinHash || null,
      patternHash: raw.patternHash || null,
    };
  }

  // Legacy: mode device | app | off
  const deviceEnabled = Boolean(raw.enabled && raw.mode === "device");
  const pinEnabled = Boolean(raw.enabled && raw.mode === "app" && raw.pinHash);
  const enabled = Boolean(raw.enabled && raw.mode !== "off");
  return {
    enabled,
    deviceEnabled,
    pinEnabled,
    mode: deviceEnabled && pinEnabled ? "both" : raw.mode || "off",
    appMethod: raw.appMethod || "pin",
    pinHash: raw.pinHash || null,
    patternHash: raw.patternHash || null,
  };
}

/** @returns {{ enabled, deviceEnabled, pinEnabled, mode, appMethod, pinHash, patternHash }} */
export async function getLockConfig() {
  const raw = await readRaw();
  return normalizeConfig(raw);
}

export async function saveLockConfig(config) {
  const deviceEnabled = Boolean(config.deviceEnabled);
  const pinEnabled = Boolean(config.pinEnabled && config.pinHash);
  const enabled = deviceEnabled || pinEnabled;
  let mode = "off";
  if (deviceEnabled && pinEnabled) mode = "both";
  else if (deviceEnabled) mode = "device";
  else if (pinEnabled) mode = "app";

  await writeRaw({
    enabled,
    deviceEnabled,
    pinEnabled,
    mode,
    appMethod: config.appMethod || "pin",
    pinHash: config.pinHash || null,
    patternHash: config.patternHash || null,
  });
}

export async function clearLockConfig() {
  if (canUseSecureStore) {
    try {
      await SecureStore.deleteItemAsync(LOCK_KEY);
    } catch {
      /* ignore */
    }
  }
  await AsyncStorage.removeItem(LOCK_KEY);
}

export async function verifyPin(pin) {
  const cfg = await getLockConfig();
  if (!cfg.pinHash) return false;
  const h = await hashSecret(pin);
  return h === cfg.pinHash;
}

export async function verifyPattern(cells) {
  const cfg = await getLockConfig();
  if (!cfg.patternHash) return false;
  const h = await hashSecret(cells.join("-"));
  return h === cfg.patternHash;
}

/** Set/change PIN and enable PIN lock (keeps phone lock if already on). */
export async function setAppPin(pin) {
  const cfg = await getLockConfig();
  const pinHash = await hashSecret(pin);
  await saveLockConfig({
    ...cfg,
    pinEnabled: true,
    appMethod: "pin",
    pinHash,
    patternHash: null,
  });
}

export async function setAppPattern(cells) {
  const cfg = await getLockConfig();
  const patternHash = await hashSecret(cells.join("-"));
  await saveLockConfig({
    ...cfg,
    pinEnabled: false,
    appMethod: "pattern",
    patternHash,
    pinHash: null,
  });
}

export async function enableDeviceLock() {
  const cfg = await getLockConfig();
  await saveLockConfig({
    ...cfg,
    deviceEnabled: true,
  });
}

export async function disableDeviceLock() {
  const cfg = await getLockConfig();
  await saveLockConfig({
    ...cfg,
    deviceEnabled: false,
  });
}

export async function disablePinLock() {
  const cfg = await getLockConfig();
  await saveLockConfig({
    ...cfg,
    pinEnabled: false,
    // keep pinHash so user can re-enable without forgetting? Clear for security.
    pinHash: null,
  });
}

/** Turn off all lock methods. */
export async function disableLock() {
  await saveLockConfig({
    deviceEnabled: false,
    pinEnabled: false,
    appMethod: "pin",
    pinHash: null,
    patternHash: null,
  });
}
