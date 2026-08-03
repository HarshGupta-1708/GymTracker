import { doc, getDoc, setDoc } from "firebase/firestore";
import { fetchSignInMethodsForEmail } from "firebase/auth";
import { auth, db } from "../config/firebaseConfig";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, "");
}

const indexRef = (email) => doc(db, "emailIndex", normalizeEmail(email));

/** Call on every successful Google login so other devices can detect existing accounts. */
export async function syncEmailIndex(user) {
  if (!user?.email || auth.isDemo) return;
  const key = normalizeEmail(user.email);
  if (!key) return;
  try {
    await setDoc(
      indexRef(key),
      {
        uid: user.uid,
        email: key,
        displayName: user.displayName || "",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn("[emailIndex] sync failed", e?.message || e);
  }
}

/**
 * Detect whether this email already has a FitTrack / Firebase login.
 * Uses (1) Firestore emailIndex (2) fetchSignInMethodsForEmail (3) Identity Toolkit createAuthUri.
 */
export async function emailHasFirebaseLogin(email) {
  const key = normalizeEmail(email);
  if (!key || !key.includes("@")) return { exists: false, source: null };

  // 1) Our index (written on login)
  try {
    const snap = await getDoc(indexRef(key));
    if (snap.exists()) {
      const d = snap.data() || {};
      return {
        exists: true,
        source: "emailIndex",
        uid: d.uid || null,
        displayName: d.displayName || null,
      };
    }
  } catch (e) {
    console.warn("[emailIndex] read failed", e?.message || e);
  }

  // 2) Client Auth methods (works when email enumeration protection is OFF)
  try {
    if (auth && !auth.isDemo) {
      const methods = await fetchSignInMethodsForEmail(auth, key);
      if (Array.isArray(methods) && methods.length > 0) {
        return { exists: true, source: "signInMethods", methods };
      }
    }
  } catch (e) {
    console.warn("[emailIndex] signInMethods failed", e?.message || e);
  }

  // 3) Identity Toolkit createAuthUri (also blocked when enumeration protection is ON)
  try {
    const apiKey = auth?.app?.options?.apiKey;
    if (apiKey) {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: key,
            continueUri: "https://gymtracker-1708.firebaseapp.com",
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (data.registered === true) {
        return { exists: true, source: "createAuthUri" };
      }
    }
  } catch (e) {
    console.warn("[emailIndex] createAuthUri failed", e?.message || e);
  }

  return { exists: false, source: null };
}
