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

Web uses Firebase **popup** sign-in (redirect fallback if popup is blocked).

**Firebase → Authentication → Settings → Authorized domains** — add every hostname you open the app from (e.g. `gym-tracker-flax-beta.vercel.app`).

### Debug sign-in (browser)

1. Open the site → **F12** (or right-click → Inspect)
2. **Console** tab → filter `GymTracker Auth`
3. Click **Sign in with Google** and watch for:
   - `Popup sign-in:` = success
   - `Redirect sign-in:` = success after page reload
   - `Redirect failed:` or `Sign-in failed:` = copy the error code for troubleshooting
4. **Network** tab → filter `identitytoolkit` or `google` for failed requests

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
