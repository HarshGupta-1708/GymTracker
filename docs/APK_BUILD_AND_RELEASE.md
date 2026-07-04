# Build APK & Share on GitHub

Your old Expo builds (**1.0.0**, commit `bd4991b`) are **Expired** — that is normal.  
Free EAS builds delete the download file after ~30 days. You need a **new build** from current code (**v1.2.0**, commit `20451f7`).

---

## Part 1 — Build new APK (v1.2.0)

### Option A — Terminal (recommended)

```bash
cd /Users/harshgupta1708/Desktop/GymTracker
npm install
npx eas-cli login
npx eas-cli build -p android --profile preview
```

| Question | Answer |
|----------|--------|
| Use existing keystore? | **Yes** (if you built before — keeps upgrade on phone) |
| First build ever? | **Yes** — let EAS create & store keystore |

Wait **10–20 min** → open link in terminal or **https://expo.dev** → Builds → **Download APK**.

---

### Option B — Build from GitHub (Expo website)

1. Go to **https://expo.dev** → project **gym-tracker**
2. **Builds** → **Build from GitHub**
3. Settings:

| Field | Value |
|-------|--------|
| Repository | `HarshGupta-1708/GymTracker` |
| Git ref / Branch | `master` |
| Profile | **`preview`** (NOT production) |
| Platform | Android |

4. Click **Build**

**Important:** Use profile **`preview`** → produces **APK** file.  
Profile **`production`** → produces **AAB** (Play Store), not a direct phone APK.

---

### If build fails — common fixes

| Error | Fix |
|-------|-----|
| GitHub not connected | expo.dev → Account → GitHub → connect repo |
| Wrong commit / old code | Ensure branch is `master`, latest commit |
| Keystore prompt fails | Run from terminal: `eas build -p android --profile preview` |
| `expo-router` error | Fixed in v1.2.0 — removed unused plugin |
| Google Sign-In fails in APK | Add EAS SHA-1 to Google Cloud Console |

Get EAS SHA-1:

```bash
npx eas credentials -p android
```

---

## Part 2 — Install on your phone (keep history)

1. **Do NOT uninstall** old app if possible
2. Install new APK **over** old one
3. Open app → **Sign in with same Google account**
4. History restores from Firestore cloud

**Safety:** Dashboard → **Export Backup** before installing (optional).

---

## Part 3 — Share APK on GitHub (for others to download)

**Do NOT commit `.apk` inside the repo** (too large, in `.gitignore`).  
Use **GitHub Releases**.

### GitHub website

1. **https://github.com/HarshGupta-1708/GymTracker/releases**
2. **Draft a new release**
3. Tag: `v1.2.0` | Title: `GymTracker v1.2.0 — AI Coach`
4. Attach `GymTracker-v1.2.0.apk`
5. **Publish release**

### Terminal (`gh` CLI)

```bash
gh release create v1.2.0 GymTracker-v1.2.0.apk \
  --repo HarshGupta-1708/GymTracker \
  --title "GymTracker v1.2.0 — AI Coach" \
  --notes "AI Coach, themes, backup. Sign in with Google to sync history."
```

### Share link

```
https://github.com/HarshGupta-1708/GymTracker/releases/download/v1.2.0/GymTracker-v1.2.0.apk
```

---

## Version info

| | |
|--|--|
| App version | 1.2.0 |
| Android versionCode | 5 |
| Package | com.harshgupta1708.gymtracker |
