# 🏋️ GYM TRACKER - Cross-Platform Fitness App

Complete workout tracking app with **Android + iOS + Web** support, **Google Authentication**, **Firebase Cloud Sync**, **AI Coach**, and **Offline Mode**.

## 📲 Download Android APK

[![Download APK](https://img.shields.io/badge/Download-APK%20v1.2.0-green?style=for-the-badge)](https://github.com/HarshGupta-1708/GymTracker/releases/latest)

> After installing: **Sign in with Google** — your workout history syncs from the cloud.  
> Build instructions: [docs/APK_BUILD_AND_RELEASE.md](docs/APK_BUILD_AND_RELEASE.md)

---

## ✨ Features

### 📱 **Today Tab** - Real-Time Workout Logger
- ✅ Date navigation (past & future workouts)
- ✅ Quick exercise add with search
- ✅ Log sets with weight/reps + auto-timestamp
- ✅ Personal Best detection 🏆 (gold highlight)
- ✅ Quick-start workout plans
- ✅ Real-time sync status indicator

### 📅 **History Tab** - Past Workout Archive
- ✅ Browse all previous workouts by date
- ✅ Expand/collapse to view exercise details
- ✅ Quick stats (exercises, sets, volume)
- ✅ One-tap reopen any past workout

### 📈 **Progress Tab** - Analytics & Charts
- ✅ Max weight progression graph (line chart)
- ✅ Session volume analysis (bar chart)
- ✅ Exercise-wise stats (PB, sessions, avg volume)
- ✅ 20-session rolling window

### 💪 **Exercises Tab** - Exercise Library
- ✅ 40+ preset exercises (organized by category)
- ✅ 8 exercise categories (Legs, Push, Pull, Biceps, Cardio, Recovery, etc.)
- ✅ Search & filter
- ✅ Add custom exercises
- ✅ One-tap add to today's workout

### 🔐 **Authentication**
- ✅ Google Sign-in (streamlined with Expo Auth)
- ✅ Persistent user sessions
- ✅ Secure Firebase Authentication

### ☁️ **Cloud & Offline**
- ✅ **Real-time Firestore sync** (cloud storage)
- ✅ **Automatic offline mode** - works without internet
- ✅ **Local AsyncStorage backup** - never lose data
- ✅ **Sync status indicator** - shows when syncing/synced
- ✅ **Multi-device sync** - login on any device, see all workouts

---

## ⚡ Quick Start

### **1. Firebase Setup (REQUIRED)**

```bash
# Go to firebase.google.com
# 1. Create project: "GymTracker"
# 2. Authentication → Google (Enable)
# 3. Firestore Database → Create (Production mode)
# 4. Add Web App & get credentials
# 5. Update config/firebaseConfig.js

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ... etc
};
```

### **2. Update Firestore Rules**

Go to Firestore → Rules → Paste:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

### **3. .env File**

```bash
EXPO_PUBLIC_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

### **4. Run**

```bash
npm install
npm run web      # Web
npm run ios      # iOS
npm run android  # Android
```

---

## 📱 Platform Support

| Platform | Status | How to Run |
|----------|--------|-----------|
| **Web** ✅ | Production Ready | `npm run web` |
| **Android** 📱 | `eas build -p android --profile preview` |
| **iOS** 🍎 | Requires Mac | `npm run ios` |
| **Standalone** 📦 | EAS Build | `eas build` |

---

## 📊 Project Structure

```
GymTracker/
├── config/firebaseConfig.js      ← Firebase credentials
├── screens/
│   ├── LoginScreen.js            ← Google Sign-in
│   ├── TodayScreen.js            ← Workout logger
│   ├── HistoryScreen.js          ← Past workouts
│   ├── ProgressScreen.js         ← Charts & analytics
│   └── ExercisesScreen.js        ← Exercise library
├── utils/firestore.js            ← Cloud sync + offline
├── constants/data.js             ← Colors, exercises, plans
└── App.js                        ← Navigation
```

---

## 📚 Usage

### **Log a Workout**
1. Go to **Today** tab
2. Click **"+ Exercise"**
3. Select exercise (or create custom)
4. Click **"ADD SET"** button
5. Enter weight & reps
6. Auto-saves to cloud ☁️

### **View Progress**
1. Go to **Progress** tab
2. Select exercise from dropdown
3. See max weight & volume charts
4. Stats update in real-time

### **Browse History**
1. Go to **History** tab
2. Click any date to expand
3. View all exercises & sets from that day

---

## 🔐 Security

- ✅ **Auth**: Google OAuth 2.0
- ✅ **DB**: Firestore rules verify `request.auth.uid == userId`
- ✅ **Transport**: HTTPS only
- ✅ **Storage**: AsyncStorage (iOS Keychain, Android Keystore)

---

## 🛠 Customization

### **Add Exercises**
Edit `constants/data.js`:
```javascript
export const PRESET_EXERCISES = [
  { name: "Your Exercise", category: "Legs" },
];
```

### **Add Plans**
```javascript
export const WORKOUT_PLANS = {
  "🔥 Your Plan": ["Ex 1", "Ex 2"],
};
```

### **Change Colors**
```javascript
export const COLORS = {
  accent: "#00d4ff",
  orange: "#ff6b2b",
};
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Firebase not syncing | Check internet & Firestore rules |
| Auth not working | Verify `firebaseConfig.js` credentials |
| Build errors | `npm install` after `rm -rf node_modules` |
| Port conflict | `PORT=3000 npm run web` |

---

## 📚 Tech Stack

- **Frontend**: React Native (Expo)
- **Navigation**: React Navigation
- **Backend**: Firebase (Auth + Firestore)
- **Charts**: React Native Chart Kit
- **Storage**: AsyncStorage + Firestore

---

## 📖 Learn More

- [Expo Docs](https://docs.expo.dev)
- [Firebase Docs](https://firebase.google.com/docs)
- [React Native Docs](https://reactnative.dev)

---

**Jai Hind! Keep training! 💪**
