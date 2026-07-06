# Gym Tracker

Cross-platform workout tracker built with **React Native (Expo)** — log sets, track progress, sync with **Firebase**, and get tips from a personal **AI Coach** powered by your own training history.

**[Live demo (web)](https://gym-tracker-flax-beta.vercel.app)** · **[Download Android APK](https://github.com/HarshGupta-1708/GymTracker/releases/latest)**

> Web demo: redeploy on Vercel if the link is down — see [docs/DEPLOY_WEB.md](docs/DEPLOY_WEB.md).  
> Android: sign in with Google to restore workout history from the cloud.

---

## Screenshots

Add phone screenshots to `docs/screenshots/` (see [docs/screenshots/README.md](docs/screenshots/README.md)), then they appear here:

<p align="center">
  <img src="./docs/screenshots/login.png" alt="Login" width="200" />
  <img src="./docs/screenshots/dashboard.png" alt="Dashboard" width="200" />
  <img src="./docs/screenshots/today.png" alt="Today" width="200" />
  <img src="./docs/screenshots/history.png" alt="History" width="200" />
  <img src="./docs/screenshots/progress.png" alt="Progress" width="200" />
</p>

*Replace placeholder paths after you upload your images.*

---

## Features

| Area | Highlights |
|------|------------|
| **Today** | Log workouts by date, custom exercises & fields, quick-start plans, PR highlights |
| **History** | Calendar of past sessions, full workout view, edit day titles |
| **Progress** | Max weight & volume charts per exercise |
| **Exercises** | 40+ presets, custom exercises, edit/delete with history-aware updates |
| **Dashboard** | Streaks, weekly goals, profile, backup export/import, 6 themes |
| **AI Coach** | RAG-based coach using your logs (Groq API + optional local mode) |
| **Sync** | Firestore cloud sync, offline cache, Google Sign-In |

---

## Quick start (developers)

```bash
git clone https://github.com/HarshGupta-1708/GymTracker.git
cd GymTracker
npm install
cp .env.example .env   # add Google OAuth client IDs if needed
npm run web              # browser
npm run android          # Android emulator / device
```

Firebase config lives in `config/firebaseConfig.js`. Firestore rules should scope data to `request.auth.uid`.

---

## Build & deploy

| Target | Command / doc |
|--------|----------------|
| **Web (static)** | `npm run build:web` → output in `dist/` |
| **Vercel** | [docs/DEPLOY_WEB.md](docs/DEPLOY_WEB.md) |
| **Android APK** | `npm run build:apk` — [docs/APK_BUILD_AND_RELEASE.md](docs/APK_BUILD_AND_RELEASE.md) |
| **AI Coach API** | `coach-api/` on Render — [docs/COACH_AI_SETUP.md](docs/COACH_AI_SETUP.md) |

---

## Project structure

```
GymTracker/
├── App.js                 # Entry, navigation, auth
├── screens/               # Today, History, Progress, Exercises, Dashboard, Coach
├── components/            # Shared UI
├── utils/                 # Firestore, backup, coach RAG, exercise logic
├── coach-api/             # Free Groq backend for AI Coach
├── constants/             # Themes, exercises, coach config
└── docs/                  # Setup, deploy, screenshots
```

---

## Tech stack

- **Expo 54** / React Native  
- **Firebase** Auth + Firestore  
- **React Navigation** (bottom tabs)  
- **Groq** (LLM) + **Render** (coach API)  
- **EAS Build** (Android APK)  
- **Vercel** (web hosting)

---

## Links

- **Repository:** https://github.com/HarshGupta-1708/GymTracker  
- **APK releases:** https://github.com/HarshGupta-1708/GymTracker/releases  
- **Issues / feedback:** GitHub Issues on the repo above

---

## License

Private project — all rights reserved unless otherwise noted.
