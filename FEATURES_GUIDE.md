# GymTracker - Complete Features Guide

## ✅ What's Been Done

### 1. **Dashboard (Default After Login)**

Your app now loads to a powerful Dashboard showing:

- **Personal Profile**: Display name and quick sign out
- **Stats**: Total sessions, sets, volume (kg), and total kcal burned
- **Today Status**: Quick view of whether you've logged today
- **Streaks**:
  - 🔥 Current Streak (consecutive days)
  - 👑 Longest Streak (personal best)
  - 📊 This Week's Workouts (toward your goal)
- **Weekly Goal Progress**: Visual progress bar showing workouts completed vs target
- **Heaviest Lift**: Your strongest recorded weight

### 2. **Goal Setting**

Click the ✏️ pencil icon on the goal card to set your target:

- **1-7 workouts per week**
- Goal updates in real-time
- Progress bar shows completion %

### 3. **Streak Tracking**

Automatically tracks:

- Current consecutive day streak (counts toward motivation)
- Longest streak (your personal record)
- This week's workouts (shows progress toward weekly goal)
- Resets if you miss a day

### 4. **Calorie Estimation**

Automatically calculates estimated kcal burned:

- Formula: 6 kcal per rep × weight (kg)
- Shows in Dashboard under "KCAL"
- Displayed after workout completion

---

## 🚀 Key Features (Ready to Use)

### Dashboard Navigation

- **Start Workout**: Jump to Today's workout
- **View History**: See all past workouts
- **View Performance**: See charts and progress
- **Manage Exercises**: Add custom exercises
- **Sign Out**: Exit your account

### Working Features

✅ Save sets to workouts
✅ Add/remove exercises  
✅ Load workout plans (Quick Start)
✅ Create custom exercises
✅ Date navigation (past workouts)
✅ Offline mode (syncs when online)

---

## 📨 Coming Soon / To Implement

### 1. **Copy Previous Workout** (RECOMMENDED FIRST)

```
Feature: Reuse yesterday's workout
- Click copy button
- Select previous date
- All exercises, sets, reps, weights copy instantly
- Edit weights before saving
- Saves time on routine workouts
```

### 2. **Monthly Calendar View**

```
Feature: See your workout schedule
- Monthly calendar grid
- ✓ marks days you worked out
- Click any date to jump to that day
- Visual streak overview
```

### 3. **Workout Completion Button**

```
Feature: Lock and celebrate workouts
- "Complete Workout" button appears when exercises added
- Shows: 🎉 Celebration emojis + Fireworks
- Displays: Total kcal for this workout
- Preview: "TODAY: 250 sessions, 45 sets, 12,450kg volume, 2,400 kcal! 🔥"
- Lock: Can't edit after completion (undo option available)
```

### 4. **Weekly Streak for Goals**

```
Feature: Track consecutive weeks of hitting goal
- Shows in Dashboard: "Week Streak: 4 weeks"
- Resets if you miss weekly goal target
- Example: Goal is 5/week, if you do 5+ you maintain streak
```

---

## 🤖 Firebase & Firestore Setup

Your app uses Firebase with:

- **Authentication**: Google Sign-In only
- **Database**: Firestore (Cloud)
- **Offline Support**: AsyncStorage (local backup)

**Current Users Path**: `users/{uid}/workouts/{date}`

---

## 📱 Android, Web & Mobile Setup

### Option 1: Web (EASIEST - Current)

```bash
npm run web
# Opens at http://localhost:8081
# Press 'w' in terminal to open in browser
```

### Option 2: Android Physical Device (QR Code)

```bash
1. Install Expo Go app from Google Play
2. Run: npm start (or npm run web)
3. Press 'a' in terminal → Android
4. Scan QR code with Expo Go app
5. Or press 'w' for web
```

**Important**: QR code method requires:

- Android device on same WiFi
- Expo Go app installed

### Option 3: iOS (Mac Only)

```bash
npm start
# Press 'i' in terminal
# Requires Xcode & iOS simulator
```

### Option 4: Production Build

```bash
# Create standalone APK/bundle
eas build -p android --mobile
# Requires EAS account (free tier available)
```

---

## 🔧 Troubleshooting

### "Save Set" Button Not Working

**Solution**:

1. Check browser console for errors (F12 → Console)
2. Ensure Firebase initialized successfully
3. Check `.env` has valid `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
4. Try hard refresh: `Cmd+Shift+R`

### Sign In Still Fails

**Solution**:

1. Go to Google Cloud Console
2. Check "Authorized redirect URIs": Must be exactly `http://localhost:8081`
3. Check "Authorized JavaScript origins": Include your localhost URLs
4. Wait 5 minutes, refresh browser

### Calendar Not Showing

**Solution**:

1. Try `npm run web` restart
2. If still blank, this feature is planned for next update

### Android QR Not Working

**Solution**:

1. Ensure both device and computer on same WiFi
2. Check IP address is correct (shown in terminal)
3. Try web instead: Press `w` in terminal
4. Clear Expo cache: `npm start -- --clear`

---

## 📊 Workout Data Structure

Your data is stored as:

```json
{
  "2024-04-21": {
    "exs": [
      {
        "name": "Back Squat",
        "sets": [
          { "w": 100, "r": 8, "t": "14:32:10" },
          { "w": 110, "r": 6, "t": "14:33:45" }
        ]
      }
    ]
  }
}
```

- `w` = weight in kg
- `r` = reps
- `t` = timestamp

---

## 🎯 User Settings Stored

Your preferences saved to Firebase:

```json
{
  "goalsPerWeek": 4,
  "theme": "dark"
}
```

Edit by clicking goal progress card in Dashboard.

---

## 🔄 Real-Time Sync

Your app automatically:

- ✅ Saves to Firestore (cloud)
- ✅ Backs up to AsyncStorage (local)
- ✅ Syncs offline changes when online
- ✅ Shows "Syncing..." when uploading
- ✅ Shows "Synced" when complete

---

## 📝 Next Steps

1. **Try the Dashboard** - Click goal card, set 4-5 week target
2. **Test Offline** - Turn off WiFi, add a set, turn on → should sync
3. **Log a Workout** - Use "Start Workout" to add today's session
4. **Check Stats** - Return to Dashboard, see your stats update in real-time

---

## ❓ Questions?

Check browser console (F12) for error messages if anything fails.  
All errors are logged for debugging.

---

_Last updated: April 22, 2024_
