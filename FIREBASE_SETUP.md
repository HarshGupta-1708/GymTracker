# Firebase Setup Guide

Complete step-by-step guide to configure Firebase for GYM TRACKER app.

---

## 📋 Prerequisites

- Google account
- Firebase project access
- Text editor to update credentials

---

## ✅ Step 1: Create Firebase Project

1. Go to **[firebase.google.com](https://firebase.google.com)**
2. Click **"Go to Console"** (top right)
3. Click **"+ Create a project"**
4. **Project name**: `GymTracker`
5. Uncheck "Enable Google Analytics" (optional)
6. Click **"Create project"**
7. Wait for project to initialize (1-2 minutes)

---

## ✅ Step 2: Enable Google Authentication

1. In Firebase Console, click **Authentication** (left sidebar)
2. Click **"Get started"**
3. Under **Sign-in method**, click **Google**
4. Toggle **Enable** to ON
5. Set **Project support email** (your Google email)
6. Click **Save**

✅ **Google Sign-in is now enabled!**

---

## ✅ Step 3: Create Firestore Database

1. Click **Firestore Database** (left sidebar)
2. Click **"Create database"**
3. **Security rules**: Select **"Start in production mode"**
   - (We'll update rules in step 5)
4. **Database location**: Select region closest to you
   - US: `us-central1`
   - EU: `europe-west1`
   - Asia: `asia-southeast1`
5. Click **"Create"**
6. Wait for database to initialize

✅ **Firestore database created!**

---

## ✅ Step 4: Add Web App & Get Credentials

1. Click **Project Settings** (⚙️ icon, top right)
2. Go to **"Your apps"** section
3. Click **"Web"** icon (</> symbol)
4. **App nickname**: `GymTracker Web`
5. Check **"Also set up Firebase Hosting"** (skip if not needed)
6. Click **"Register app"**
7. **Copy these credentials**:

```javascript
{
  apiKey: "B100slp8pTnNzxKNk",
  authDomain: "irebaseapp.com",
  projectId: "",
  storageBucket: "rebasestorage.app",
  messagingSenderId: "74",
  appId: "1:1013071433374:web:58f"
}
```

---

## ✅ Step 5: Update Firestore Security Rules

1. Click **Firestore Database** (left sidebar)
2. Go to **"Rules"** tab (next to Data)
3. **Delete everything** and paste:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

4. Click **"Publish"** button
5. Confirm **"Publish rules"**

✅ **Security rules are now live!**

---

## ✅ Step 6: Get Google OAuth Client ID (For Expo)

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Make sure you're in the correct project (dropdown at top)
3. Click **"APIs & Services"** (left sidebar)
4. Click **"Credentials"**
5. Click **"+ Create Credentials"** → **"OAuth 2.0 Client ID"**
6. Choose **"Web application"**
7. **Name**: `GymTracker Web Client`
8. **Authorized JavaScript origins** (add these):
   - `http://localhost:8081`
   - `http://localhost:3000`
   - `http://localhost:5000`
   - `http://127.0.0.1:8081`
   - `http://127.0.0.1:3000`
9. **Authorized redirect URIs**:
   - `http://localhost:8081/*`
   - `http://localhost:3000/*`
   - `http://localhost:5000/*`
10. Click **"Create"**
11. **Copy your Client ID** (format: `csdc`)
12. Keep this secret! ️

✅ **OAuth Client ID generated!**

---

## ✅ Step 7: Update App Configuration

### **A. Update firebaseConfig.js**

Open `config/firebaseConfig.js` and replace:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

With your actual credentials from **Step 4**.

### **B. Create .env File**

Create file `.env` in project root:

```bash
EXPO_PUBLIC_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Replace with your Client ID from **Step 6**.

---

## ✅ Step 8: Test Setup

```bash
# Install dependencies
npm install

# Start app in web
npm run web

# Or use Expo CLI
npx expo start --web
```

**Test login:**

1. Click "Sign in with Google"
2. Authenticate with your Google account
3. You should see the workout app!

✅ **Testing complete!**

---

## 🚀 Production Deployment

### **For Android**

```bash
# Build APK
eas build -p android --profile preview

# Download from EAS dashboard
# Install on physical device
```

### **For iOS**

```bash
# Requires macOS
eas build -p ios --profile preview
```

### **For Web**

```bash
# Build for production
npm run build

# Deploy to your hosting:
# - Vercel: vercel deploy
# - Netlify: netlify deploy
# - GitHub Pages: pushto gh-pages branch
```

---

## 🔒 Additional Security (Optional)

### **Enable reCAPTCHA** (prevent bot sign-ups)

1. Firebase Console → **Authentication**
2. Go to **Settings** tab
3. Under **reCAPTCHA**, toggle **Enable**
4. Choose v2 or v3

### **Add Custom Domain** (optional)

1. Firebase Console → **Hosting**
2. Click **"Add custom domain"**
3. Follow domain verification steps

---

## 🐛 Troubleshooting

### **"Invalid API Key" Error**

- ✅ Verify `firebaseConfig.js` has correct credentials
- ✅ Clear browser cache: `Cmd+Shift+R` (Mac)
- ✅ Restart dev server: `npm run web`

### **"User does not have access" Error**

- ✅ Check Firestore Rules are published
- ✅ Verify `request.auth.uid == userId` rule exists
- ✅ Try signing out and back in

### **"CORS Error" on Web**

- ✅ Add `http://localhost` to **Authorized JavaScript origins**
- ✅ Ensure `.env` file exists with correct Client ID

### **Google Sign-in Button Not Showing**

- ✅ Check `.env` file has `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
- ✅ Verify Client ID format (ends with `.apps.googleusercontent.com`)

### **Data Not Syncing**

- ✅ Check internet connection
- ✅ Open browser console (F12) for errors
- ✅ Check AsyncStorage has offline backup

---

## 📊 Database Structure

Once you sign in, Firestore will auto-create this structure:

```
users/
  {your-user-id}/
    workouts/
      2025-02-17/
        exs: [...]
    exercises/
      library/
        items: [...]
    profile/
      name: "Your Name"
```

---

## ✅ Verification Checklist

- [ ] Firebase project created
- [ ] Google Authentication enabled
- [ ] Firestore Database created
- [ ] Web app registered + credentials copied
- [ ] Firestore Rules published + verified
- [ ] OAuth Client ID created
- [ ] `firebaseConfig.js` updated with credentials
- [ ] `.env` file created with Client ID
- [ ] Dependencies installed: `npm install`
- [ ] App runs: `npm run web`
- [ ] Google Sign-in works
- [ ] Workouts sync to Firebase

---

## 🆘 Support

**Need help?**

1. Check browser console (F12) for error messages
2. Go to Firebase Console → **Firestore** → Check data is being saved
3. Verify Firestore Rules allow your auth user
4. Restart dev server and clear cache

---

**Everything set up? Start logging workouts! 💪**
