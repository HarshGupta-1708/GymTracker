import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { Platform } from "react-native";
import { auth, db } from "../config/firebaseConfig";
import { COACH_API_URL } from "../constants/coach";
import { hashSecret } from "./appLock";
import { emailHasFirebaseLogin } from "./emailIndex";
import { decryptPhoto } from "./firestore";
import { SELF_PROFILE } from "./profileScope";

const getUid = () => auth.currentUser?.uid || (auth.isDemo ? "demo-user" : null);

const localKey = () => `gt_athletes_${getUid() || "guest"}`;
const defaultKey = () => `gt_default_profile_${getUid() || "guest"}`;
const membershipsKey = () => `gt_memberships_${getUid() || "guest"}`;
const ownerMetaKey = () => `gt_account_owner_${getUid() || "guest"}`;
/** Self profile settings — never athlete-scoped */
const selfSettingsKey = () => `gt_user_settings_${getUid() || "guest"}`;

const cloudRef = (uid) => doc(db, "users", uid, "settings", "athletes");
const membershipsRef = (uid) => doc(db, "users", uid, "settings", "memberships");
const selfPrefsRef = (uid) => doc(db, "users", uid, "settings", "preferences");
const linkRef = (email) => doc(db, "profileLinks", normalizeEmail(email));

function cleanOwnerName(name) {
  const n = String(name || "").trim();
  if (!n || /^demo athlete$/i.test(n)) return "";
  return n;
}

export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, "");
}

function makeToken() {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildVerifyUrl(email, token) {
  const q = `verifyProfile=1&email=${encodeURIComponent(normalizeEmail(email))}&token=${encodeURIComponent(token)}`;
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/?${q}`;
  }
  return `https://fittrack.app/?${q}`;
}

export async function listAthletes() {
  const uid = getUid();
  if (!uid) return [];

  try {
    const local = await AsyncStorage.getItem(localKey());
    let items = local ? JSON.parse(local) : [];

    if (!auth.isDemo) {
      const snap = await getDoc(cloudRef(uid));
      if (snap.exists()) {
        const data = snap.data() || {};
        items = data.items || [];
        if (data.defaultProfileId) {
          await AsyncStorage.setItem(defaultKey(), data.defaultProfileId);
        }
        await AsyncStorage.setItem(localKey(), JSON.stringify(items));
      }
    }
    return Array.isArray(items) ? items : [];
  } catch (e) {
    console.warn("[athletes] list failed", e);
    const local = await AsyncStorage.getItem(localKey());
    return local ? JSON.parse(local) : [];
  }
}

async function persist(items, defaultProfileId) {
  const uid = getUid();
  await AsyncStorage.setItem(localKey(), JSON.stringify(items));
  let def = defaultProfileId;
  if (def == null) {
    def = (await AsyncStorage.getItem(defaultKey())) || SELF_PROFILE;
  } else {
    await AsyncStorage.setItem(defaultKey(), def);
  }
  if (uid && !auth.isDemo) {
    await setDoc(
      cloudRef(uid),
      { items, defaultProfileId: def, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
  return items;
}

/**
 * Account-owner name/photo (primary login identity). Independent of active athlete profile.
 */
export async function getAccountOwnerMeta(fallback = {}) {
  const uid = getUid();
  let name = cleanOwnerName(fallback.name);
  let photo = fallback.photo || "";

  try {
    const cached = await AsyncStorage.getItem(ownerMetaKey());
    if (cached) {
      const c = JSON.parse(cached);
      name = cleanOwnerName(c.name) || name;
      photo = c.photo || photo;
    }
  } catch {
    /* ignore */
  }

  try {
    const localSelf = await AsyncStorage.getItem(selfSettingsKey());
    if (localSelf) {
      const s = JSON.parse(localSelf);
      name = cleanOwnerName(s.displayName) || name;
      photo = s.profilePhoto || photo;
    }
  } catch {
    /* ignore */
  }

  if (uid && !auth.isDemo) {
    try {
      const ath = await getDoc(cloudRef(uid));
      if (ath.exists()) {
        const d = ath.data() || {};
        name = cleanOwnerName(d.ownerName) || name;
        photo = d.ownerPhoto || photo;
      }
    } catch {
      /* ignore */
    }
    try {
      const pref = await getDoc(selfPrefsRef(uid));
      if (pref.exists()) {
        const d = pref.data() || {};
        name = cleanOwnerName(d.displayName) || name;
        photo = d.profilePhoto ? decryptPhoto(d.profilePhoto) : photo;
      }
    } catch {
      /* ignore */
    }
  }

  if (!name) name = cleanOwnerName(auth.currentUser?.displayName) || "You";
  const result = { name, photo: photo || "" };
  try {
    await AsyncStorage.setItem(ownerMetaKey(), JSON.stringify(result));
  } catch {
    /* ignore */
  }
  return result;
}

/** Call when the account owner (self) updates their dashboard profile name/photo. */
export async function syncAccountOwnerMeta({ name, photo } = {}) {
  const uid = getUid();
  const meta = {
    name: cleanOwnerName(name) || "You",
    photo: photo || "",
  };
  await AsyncStorage.setItem(ownerMetaKey(), JSON.stringify(meta));
  if (uid && !auth.isDemo) {
    await setDoc(
      cloudRef(uid),
      { ownerName: meta.name, ownerPhoto: meta.photo, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
  return meta;
}

export async function getDefaultProfileId() {
  const uid = getUid();
  if (!uid) return SELF_PROFILE;
  try {
    if (!auth.isDemo) {
      const snap = await getDoc(cloudRef(uid));
      if (snap.exists() && snap.data()?.defaultProfileId) {
        const id = snap.data().defaultProfileId;
        await AsyncStorage.setItem(defaultKey(), id);
        return id;
      }
    }
    return (await AsyncStorage.getItem(defaultKey())) || SELF_PROFILE;
  } catch {
    return SELF_PROFILE;
  }
}

export async function setDefaultProfileId(profileId) {
  const id = profileId || SELF_PROFILE;
  if (id !== SELF_PROFILE) {
    const items = await listAthletes();
    if (!items.some((a) => a.id === id)) throw new Error("Profile not found");
  }
  const items = await listAthletes();
  await persist(items, id);
  return id;
}

/** Replace shared-profile registry (used by full-account backup restore). */
export async function replaceAthletesRegistry(items, defaultProfileId) {
  const list = Array.isArray(items) ? items : [];
  await persist(list, defaultProfileId || SELF_PROFILE);
  return list;
}

export async function createAthlete({ name, pin, pinConfirm, email, photo }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("Name is required");
  if (pin || pinConfirm) {
    if (String(pin || "").length < 4) throw new Error("Password must be at least 4 characters");
    if (String(pin) !== String(pinConfirm || "")) throw new Error("Passwords do not match — re-enter both");
  }
  const items = await listAthletes();
  const id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const pinHash = pin ? await hashSecret(String(pin)) : null;
  const linkedEmail = email ? normalizeEmail(email) : null;
  let verifyToken = null;
  let emailVerified = false;

  if (linkedEmail) {
    verifyToken = makeToken();
    await writeProfileLink({
      email: linkedEmail,
      profileId: id,
      name: trimmed,
      token: verifyToken,
      verified: false,
    });
  }

  const next = [
    ...items,
    {
      id,
      name: trimmed,
      pinHash,
      passwordHash: pinHash,
      linkedEmail,
      emailVerified,
      verifyToken,
      photo: photo || "",
      createdAt: new Date().toISOString(),
    },
  ];
  await persist(next);
  const created = next.find((a) => a.id === id);
  return {
    ...created,
    verifyUrl: linkedEmail ? buildVerifyUrl(linkedEmail, verifyToken) : null,
  };
}

export async function updateAthletePin(athleteId, pin, pinConfirm) {
  if (String(pin).length < 4) throw new Error("Password must be at least 4 characters");
  if (String(pin) !== String(pinConfirm || "")) throw new Error("Passwords do not match — re-enter both");
  const items = await listAthletes();
  const pinHash = await hashSecret(String(pin));
  const next = items.map((a) =>
    a.id === athleteId ? { ...a, pinHash, passwordHash: pinHash } : a,
  );
  await persist(next);
}

export async function updateAthletePhoto(athleteId, photo) {
  return updateAthleteProfile(athleteId, { photo });
}

/** Sync dashboard name/photo into the shared Profiles switcher list. */
export async function updateAthleteProfile(athleteId, { name, photo } = {}) {
  if (!athleteId || athleteId === SELF_PROFILE) {
    throw new Error("Use syncAccountOwnerMeta for the account owner");
  }
  const items = await listAthletes();
  const next = items.map((a) => {
    if (a.id !== athleteId) return a;
    const updated = { ...a };
    if (name != null) {
      const trimmed = String(name).trim();
      if (trimmed) updated.name = trimmed;
    }
    if (photo !== undefined) updated.photo = photo || "";
    return updated;
  });
  await persist(next);
  return next.find((a) => a.id === athleteId);
}

async function writeProfileLink({ email, profileId, name, token, verified }) {
  const uid = getUid();
  if (!uid || auth.isDemo) return;
  const key = normalizeEmail(email);
  if (!key || !key.includes("@")) throw new Error("Enter a valid Gmail / email");
  await setDoc(linkRef(key), {
    hostUid: uid,
    hostEmail: auth.currentUser?.email || "",
    hostName: auth.currentUser?.displayName || "FitTrack user",
    profileId,
    name: name || "Member",
    email: key,
    token,
    verified: Boolean(verified),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Local + cloud checks before linking a Gmail to a profile.
 * Detects existing Firebase users via emailIndex / Auth APIs / coach-api Admin.
 */
export async function checkEmailForLink(email, athleteId) {
  const key = normalizeEmail(email);
  if (!key || !key.includes("@")) throw new Error("Enter a valid email");

  const items = await listAthletes();
  const onOtherLocal = items.find((a) => a.linkedEmail === key && a.id !== athleteId);
  if (onOtherLocal) {
    return {
      email: key,
      status: "linked_other_local",
      message: `"${key}" is already linked to profile "${onOtherLocal.name}".`,
      canSend: false,
    };
  }

  const onSame = items.find((a) => a.id === athleteId && a.linkedEmail === key);

  // Client-side: does this email already have a Firebase login?
  const localAuth = await emailHasFirebaseLogin(key);
  let authExists = Boolean(localAuth.exists);

  let remote = null;
  try {
    if (COACH_API_URL && !auth.isDemo && auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`${COACH_API_URL.replace(/\/$/, "")}/check-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: key }),
      });
      if (res.ok) {
        remote = await res.json();
        if (remote.authExists) authExists = true;
      } else {
        console.warn("[athletes] check-email HTTP", res.status);
      }
    }
  } catch (e) {
    console.warn("[athletes] check-email remote failed", e?.message || e);
  }

  // Invite owned by someone else
  if (remote?.invite && !remote.invite.isOwnInvite) {
    return {
      email: key,
      status: "invite_other_host",
      message: `"${key}" already has a FitTrack invite from another account.`,
      canSend: false,
      authExists,
    };
  }

  // Own invite already tied to a profile (and we're linking a different / new one)
  if (
    remote?.invite?.isOwnInvite &&
    remote.invite.profileId &&
    (!athleteId || remote.invite.profileId !== athleteId)
  ) {
    return {
      email: key,
      status: "invite_other_profile",
      message: `"${key}" is already invited for another profile on your account.`,
      canSend: false,
      authExists,
    };
  }

  if (authExists || remote?.invite || onSame) {
    return {
      email: key,
      status: "existing",
      message: authExists
        ? `"${key}" already has a FitTrack / Google login. We’ll send a verify link so they confirm it’s them.`
        : `"${key}" already has an invite. We’ll resend the verify link.`,
      canSend: true,
      authExists,
      verified: Boolean(remote?.invite?.verified || onSame?.emailVerified),
      isResend: true,
    };
  }

  return {
    email: key,
    status: "new",
    message: `"${key}" looks new (no FitTrack login found). We’ll send a verify link for this profile.`,
    canSend: true,
    authExists: false,
    isResend: false,
  };
}

export async function linkAthleteEmail(athleteId, email) {
  const key = normalizeEmail(email);
  if (!key || !key.includes("@")) throw new Error("Enter a valid email");
  const items = await listAthletes();
  const athlete = items.find((a) => a.id === athleteId);
  if (!athlete) throw new Error("Profile not found");

  const taken = items.find((a) => a.linkedEmail === key && a.id !== athleteId);
  if (taken) {
    throw new Error(`Email already linked to "${taken.name}"`);
  }

  const check = await checkEmailForLink(key, athleteId);
  if (!check.canSend) throw new Error(check.message);

  if (athlete.linkedEmail && athlete.linkedEmail !== key && !auth.isDemo) {
    try {
      await deleteDoc(linkRef(athlete.linkedEmail));
    } catch {
      /* ignore */
    }
  }

  const token = makeToken();
  await writeProfileLink({
    email: key,
    profileId: athleteId,
    name: athlete.name,
    token,
    verified: false,
  });

  const next = items.map((a) =>
    a.id === athleteId
      ? { ...a, linkedEmail: key, emailVerified: false, verifyToken: token }
      : a,
  );
  await persist(next);
  return { email: key, verifyUrl: buildVerifyUrl(key, token), token };
}

/** Guest/member opens verify link — mark email verified (does not copy data yet). */
export async function verifyProfileInvite({ email, token }) {
  const key = normalizeEmail(email);
  if (!key || !token) throw new Error("Invalid verification link");
  const snap = await getDoc(linkRef(key));
  if (!snap.exists()) throw new Error("Invite not found or already used");
  const link = snap.data();
  if (link.token !== token) throw new Error("Invalid or expired verification link");

  await setDoc(
    linkRef(key),
    { ...link, verified: true, verifiedAt: new Date().toISOString() },
    { merge: true },
  );

  // Update host athlete flag if current user is host
  const uid = getUid();
  if (uid && uid === link.hostUid) {
    const items = await listAthletes();
    await persist(
      items.map((a) =>
        a.id === link.profileId ? { ...a, emailVerified: true } : a,
      ),
    );
  } else if (link.hostUid && !auth.isDemo) {
    // Best-effort: host list may only be writable by host; member just needs link.verified
    try {
      const hostSnap = await getDoc(cloudRef(link.hostUid));
      if (hostSnap.exists()) {
        const data = hostSnap.data() || {};
        const items = (data.items || []).map((a) =>
          a.id === link.profileId ? { ...a, emailVerified: true } : a,
        );
        await setDoc(
          cloudRef(link.hostUid),
          { ...data, items, updatedAt: new Date().toISOString() },
          { merge: true },
        );
      }
    } catch {
      /* rules may block — OK */
    }
  }

  return { name: link.name, email: key, hostUid: link.hostUid, profileId: link.profileId };
}

export async function resetProfilePasswordViaEmail({ email, token, newPassword, confirm }) {
  if (String(newPassword).length < 4) throw new Error("Password must be at least 4 characters");
  if (String(newPassword) !== String(confirm || "")) throw new Error("Passwords do not match");
  const key = normalizeEmail(email);
  const snap = await getDoc(linkRef(key));
  if (!snap.exists()) throw new Error("Invite not found");
  const link = snap.data();
  if (link.token !== token || !link.verified) throw new Error("Verify your email first");

  const passwordHash = await hashSecret(String(newPassword));
  // Store on link so claimant can use before full claim; host athlete updated if possible
  await setDoc(linkRef(key), { ...link, passwordHash, updatedAt: new Date().toISOString() }, { merge: true });

  const uid = getUid();
  if (uid === link.hostUid) {
    const items = await listAthletes();
    await persist(
      items.map((a) =>
        a.id === link.profileId ? { ...a, passwordHash, pinHash: passwordHash } : a,
      ),
    );
  }
  return true;
}

export async function deleteAthlete(athleteId) {
  if (!athleteId || athleteId === SELF_PROFILE) {
    throw new Error("Cannot remove the account owner profile");
  }
  const items = await listAthletes();
  const target = items.find((a) => a.id === athleteId);
  if (!target) return;

  const def = await getDefaultProfileId();
  const nextDef = def === athleteId ? SELF_PROFILE : def;

  if (target.linkedEmail && !auth.isDemo) {
    try {
      await deleteDoc(linkRef(target.linkedEmail));
    } catch {
      /* ignore */
    }
  }

  await persist(
    items.filter((a) => a.id !== athleteId),
    nextDef,
  );
}

export async function verifyAthletePin(athlete, pin) {
  const hash = athlete?.passwordHash || athlete?.pinHash;
  if (!hash) return true;
  const h = await hashSecret(String(pin || ""));
  return h === hash;
}

export async function listMemberships() {
  const uid = getUid();
  if (!uid) return [];
  try {
    const local = await AsyncStorage.getItem(membershipsKey());
    let items = local ? JSON.parse(local) : [];
    if (!auth.isDemo) {
      const snap = await getDoc(membershipsRef(uid));
      if (snap.exists()) {
        items = snap.data()?.items || [];
        await AsyncStorage.setItem(membershipsKey(), JSON.stringify(items));
      }
    }
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function saveMemberships(items) {
  const uid = getUid();
  await AsyncStorage.setItem(membershipsKey(), JSON.stringify(items));
  if (uid && !auth.isDemo) {
    await setDoc(
      membershipsRef(uid),
      { items, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }
}

export async function removeMembership(shareId) {
  const items = await listMemberships();
  await saveMemberships(items.filter((m) => m.id !== shareId));
}

async function copyCollection(fromParts, toParts) {
  const snap = await getDocs(collection(db, ...fromParts));
  const ops = [];
  snap.forEach((d) => {
    ops.push(setDoc(doc(db, ...toParts, d.id), d.data(), { merge: true }));
  });
  await Promise.all(ops);
  return snap.size;
}

/**
 * After Google login: if invite is verified for this email, copy shared profile into own account.
 */
export async function claimPendingProfileLink(user) {
  if (!user?.email || auth.isDemo) return null;
  const key = normalizeEmail(user.email);
  if (!key) return null;

  try {
    const snap = await getDoc(linkRef(key));
    if (!snap.exists()) return null;
    const link = snap.data();
    if (!link?.hostUid || !link?.profileId) return null;
    if (link.hostUid === user.uid) return null;
    if (!link.verified) {
      return { needsVerify: true, name: link.name, email: key };
    }

    const hostUid = link.hostUid;
    const profileId = link.profileId;
    const fromBase = ["users", hostUid, "athletes", profileId];
    const toBase = ["users", user.uid];

    await copyCollection([...fromBase, "workouts"], [...toBase, "workouts"]);
    for (const settingsId of ["preferences", "workoutPlans", "exerciseNotes"]) {
      const s = await getDoc(doc(db, ...fromBase, "settings", settingsId));
      if (s.exists()) {
        await setDoc(doc(db, ...toBase, "settings", settingsId), s.data(), { merge: true });
      }
    }
    await copyCollection([...fromBase, "bodyPhotos"], [...toBase, "bodyPhotos"]);
    try {
      const lib = await getDoc(doc(db, ...fromBase, "exercises", "library"));
      if (lib.exists()) {
        await setDoc(doc(db, ...toBase, "exercises", "library"), lib.data(), { merge: true });
      }
    } catch {
      /* optional */
    }

    const memberships = await listMemberships();
    const shareId = `${hostUid}_${profileId}`;
    if (!memberships.some((m) => m.id === shareId)) {
      await saveMemberships([
        {
          id: shareId,
          hostUid,
          hostEmail: link.hostEmail || "",
          hostName: link.hostName || "Shared account",
          profileId,
          name: link.name || "Profile",
          claimedAt: new Date().toISOString(),
        },
        ...memberships,
      ]);
    }

    await deleteDoc(linkRef(key));
    return { name: link.name || "Profile", fromHost: hostUid, claimed: true };
  } catch (e) {
    console.warn("[athletes] claim failed", e);
    return null;
  }
}

export function parseVerifyQuery(search) {
  if (!search || typeof search !== "string") return null;
  const q = search.startsWith("?") ? search.slice(1) : search;
  const params = Object.fromEntries(q.split("&").map((p) => {
    const [k, v] = p.split("=");
    return [decodeURIComponent(k || ""), decodeURIComponent(v || "")];
  }));
  if (params.verifyProfile !== "1" || !params.email || !params.token) return null;
  return { email: params.email, token: params.token };
}
