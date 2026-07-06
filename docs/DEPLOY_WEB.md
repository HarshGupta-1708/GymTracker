# Deploy web app (Vercel)

**Live URL:** https://gym-tracker-flax-beta.vercel.app

## Vercel project settings

| Setting | Value |
|---------|--------|
| Framework Preset | Other |
| Build Command | `npm run build:web` (from `vercel.json`) |
| Output Directory | `dist` |
| Install Command | `npm install` |

## Google Sign-In on web

Web uses Firebase popup sign-in, with a Google Identity Services fallback if popups are blocked (no full-page redirect).

**Firebase → Authentication → Settings → Authorized domains** — add every hostname you open the app from (e.g. `gym-tracker-flax-beta.vercel.app`).

**One account works, another does not?** Google Cloud → **OAuth consent screen** → if status is **Testing**, only listed **Test users** can sign in. Add the other Gmail there, or publish the app to **In production**.

**Google Cloud → Credentials → Web client** → **Authorized JavaScript origins** should include:
`https://gym-tracker-flax-beta.vercel.app` and `https://gymtracker-1708.firebaseapp.com`

### Debug sign-in (browser)

1. Open the site → **F12** → **Console** → filter `GymTracker Auth`
2. Click **Sign in with Google**
3. Success: `Popup sign-in:` or `GIS sign-in:` then `Session:`
4. Failure: copy `Sign-in failed:` line (error code matters)

Chrome **Issues** tab warnings about CSP or “intermediate websites” are normal on Vercel; they are not the login error itself.

## Architecture

| Part | Host |
|------|------|
| Web UI | Vercel (`dist/`) |
| Login & data | Firebase Auth + Firestore |
| AI Coach | Render (`gymtracker-coach-api.onrender.com`) |

## Manual deploy

```bash
npm install -g vercel
cd GymTracker
vercel --prod
```
