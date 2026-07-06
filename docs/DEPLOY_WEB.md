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

Web uses **Firebase redirect** sign-in. No Google Cloud redirect URIs needed.

**Firebase → Authentication → Settings → Authorized domains** — add every URL you open the app from:

```
gym-tracker-flax-beta.vercel.app
```

If you use another Vercel domain (e.g. an older `*.vercel.app` link), add that hostname too. The sign-in error message shows the exact domain to add.

Optional: set a **custom domain** in Vercel so you only authorize one stable hostname.

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
