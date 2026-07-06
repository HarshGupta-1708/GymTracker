# Fix Google Sign-In on web (Vercel)

## Error: `redirect_uri_mismatch` (400)

This happens when the web OAuth redirect URL is not registered in Google Cloud.

**Fix in code:** Web builds now use **Firebase `signInWithPopup`** (`hooks/useGoogleSignIn.web.js`) instead of expo-auth-session redirects. You only need to authorize your domain in **Firebase** (steps below).

---

## Step 1 — Firebase authorized domain (required)

1. Open **https://console.firebase.google.com**
2. Project **gymtracker-1708**
3. **Authentication** → **Settings** → **Authorized domains**
4. Click **Add domain**
5. Add:
   ```
   gym-tracker-kdg4.vercel.app
   ```
6. Save

For local dev, `localhost` is usually already listed.

---

## Step 2 — Enable Google provider in Firebase

1. **Authentication** → **Sign-in method**
2. **Google** → **Enable**
3. Support email: your email
4. Save

---

## Step 3 — Redeploy Vercel (after code push)

Push latest `master`, then Vercel → **Redeploy** (clear cache).

Open: **https://gym-tracker-kdg4.vercel.app** → Sign in with Google.

---

## Platform summary

| Platform | Sign-in method | What you configure |
|----------|----------------|-------------------|
| **Web (Vercel)** | Firebase popup | Firebase authorized domain |
| **Android APK** | Native Google Sign-In | SHA-1 in Firebase + Google Cloud Android client |
| **Expo Go** | Browser OAuth | `auth.expo.io` redirect (dev only) |

---

## If popup is blocked

Use a normal browser (Chrome/Safari), not an in-app WebView. Allow popups for your Vercel URL.

---

## Optional — Google Cloud Web client (expo-auth-session / Expo Go only)

If you use **Expo Go** for web testing with the old flow, add to **Web client** redirect URIs:

- `https://auth.expo.io/@harshgupta1708/gym-tracker`
- `http://localhost:8081`
- `http://localhost:19006`

Production Vercel uses Firebase popup — no manual redirect URI needed.
