/** Active trainee profile under the signed-in account (`self` = trainer's own logs). */

export const SELF_PROFILE = "self";

let activeProfileId = SELF_PROFILE;
const listeners = new Set();

export const getActiveProfileId = () => activeProfileId || SELF_PROFILE;

export const setActiveProfileId = (id) => {
  activeProfileId = id || SELF_PROFILE;
  listeners.forEach((fn) => {
    try {
      fn(activeProfileId);
    } catch (e) {
      console.warn("[profileScope] listener error", e);
    }
  });
};

/**
 * Run async work under a profile without notifying UI listeners
 * (used for full-account backup / restore).
 */
export async function runWithProfile(profileId, fn) {
  const prev = activeProfileId;
  activeProfileId = profileId || SELF_PROFILE;
  try {
    return await fn();
  } finally {
    activeProfileId = prev;
  }
}

export const onProfileChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const scopeStorageKey = (prefix, uid) => {
  const id = uid || "guest";
  const p = getActiveProfileId();
  return p === SELF_PROFILE ? `${prefix}_${id}` : `${prefix}_${id}_p_${p}`;
};

/** Firestore path segments under the account for the active profile. */
export const scopedUserSegments = (uid) => {
  const p = getActiveProfileId();
  if (p === SELF_PROFILE) return ["users", uid];
  return ["users", uid, "athletes", p];
};
