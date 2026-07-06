# Deploy web app (Vercel)

**Live URL:** https://gym-tracker-kdg4.vercel.app

## Why you saw 404 before

Vercel deployed an **old commit** (`fdafc7f`) **without** `vercel.json`. It uploaded raw source files (`.md`, `.tsx`) instead of running `npm run build:web`. There was no `index.html` at the site root → **404**.

**Fix:** Push latest `master` (includes `vercel.json` + cleanup). Vercel will run `expo export` and serve the `dist/` folder.

### Redeploy now

1. Ensure latest code is on GitHub (`git push origin master`)
2. Vercel → **gym-tracker** → **Deployments** → **Redeploy** → check **Use existing Build Cache: No**
3. Build log should show `npm run build:web` and take **1–3 minutes** (not 7 seconds)
4. Open https://gym-tracker-kdg4.vercel.app

---

## Can Vercel host frontend + backend?

| Part | Where it runs | On Vercel only? |
|------|----------------|-----------------|
| **Web UI** | Vercel (`dist/`) | Yes |
| **Login & workouts** | Firebase Auth + Firestore | No — Firebase (already set up) |
| **AI Coach** | Render (`gymtracker-coach-api.onrender.com`) | No — separate free host |

So: **Vercel = website.** Firebase + Render = backend services the app already uses. All features work on web when:

1. Vercel build succeeds (`vercel.json` present)
2. Google OAuth **Authorized JavaScript origins** includes `https://gym-tracker-kdg4.vercel.app`
3. Render coach API is awake (first request may be slow on free tier)

You do **not** need to move Firebase or Render onto Vercel.

---

## Google Sign-In on web

Web builds use **Firebase popup** (not redirect URIs). See **[docs/GOOGLE_WEB_SIGNIN.md](docs/GOOGLE_WEB_SIGNIN.md)**.

**Required:** Firebase → Authentication → Settings → Authorized domains → add:

```
gym-tracker-kdg4.vercel.app
```

---

## Vercel project settings

| Setting | Value |
|---------|--------|
| Framework Preset | Other |
| Build Command | `npm run build:web` (from `vercel.json`) |
| Output Directory | `dist` |
| Install Command | `npm install` |

---

## Manual deploy from Mac

```bash
npm install -g vercel
cd /Users/harshgupta1708/Desktop/GymTracker
vercel --prod
```
