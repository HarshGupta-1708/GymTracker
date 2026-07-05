# Fix `DEVELOPER_ERROR` on Google Sign-In (APK)

This error means **the APK signing key (SHA-1) is not registered** in Firebase / Google Cloud.

Expo Go uses Expo’s key. **Your EAS APK uses a different key** — you must add that SHA-1 once.

**You do NOT need to rebuild the APK** after adding SHA-1. Wait 5–10 minutes, then try sign-in again.

---

## Step 1 — Copy SHA-1 from Expo (EAS keystore)

### Option A — Expo website (easiest)

1. Open **https://expo.dev/accounts/harshgupta1708/projects/gym-tracker/credentials**
2. Click **Android**
3. Open **Keystore** (or **Build Credentials**)
4. Copy **SHA-1 Certificate Fingerprint**  
   Example format: `AA:BB:CC:DD:...`

Also copy **SHA-256** if shown.

### Option B — Terminal

```bash
cd /Users/harshgupta1708/Desktop/GymTracker
npx eas-cli credentials -p android
```

Choose **Keystore** → view fingerprint → copy **SHA-1**.

---

## Step 2 — Add SHA-1 to Firebase (required)

1. Open **https://console.firebase.google.com**
2. Project **gymtracker-1708**
3. ⚙️ **Project settings** → **Your apps**
4. Select Android app **com.harshgupta1708.gymtracker**  
   (If missing: **Add app** → Android → package `com.harshgupta1708.gymtracker`)
5. **Add fingerprint** → paste **SHA-1** → Save
6. Add **SHA-256** too if available

---

## Step 3 — Add SHA-1 to Google Cloud Android OAuth client

1. Open **https://console.cloud.google.com/apis/credentials**
2. Project **gymtracker-1708** (or project-1013071433374)
3. Under **OAuth 2.0 Client IDs**, open type **Android**  
   (Client ending in `...tbuplbi4egicmjsogurlfv9elkhpp1s4` or similar)
4. **Edit**
5. **+ ADD FINGERPRINT** → paste same **SHA-1**
6. Confirm **Package name**: `com.harshgupta1708.gymtracker`
7. **Save**

You can have **multiple SHA-1** on one client (debug + EAS production).

---

## Step 4 — Verify Web client ID (for Firebase)

Native Google Sign-In uses the **Web** client ID internally.

In Google Cloud → Credentials → type **Web application**  
Client ID should match app config:

`1013071433374-5nt3jtkhhok3c1u37k6qrlsna32doa8j.apps.googleusercontent.com`

---

## Step 5 — Wait and test

1. Wait **5–10 minutes** (Google propagation)
2. Force-close Gym Tracker on phone
3. Open app → **Sign in with Google**

No new APK install needed.

---

## Still failing?

| Check | Action |
|-------|--------|
| Wrong Google account on phone | Use same account as before |
| Old SHA-1 only in console | Must be **EAS** SHA-1 from Step 1, not debug keystore |
| New Android OAuth client | Update `googleAndroidClientId` in `app.json` + rebuild |
| Play Services | Update Google Play Services on phone |

Get SHA-1 from **Expo credentials**, not `keytool` debug keystore, unless you sign APK locally.
