# Google OAuth Android Fix - Complete Setup Guide

## Problem Summary
Your app works on web but fails on Android because:
1. **Missing Android OAuth Credentials** - You only have the web client ID
2. **Incorrect Redirect URI Configuration** - Google Cloud Console not set up for Expo proxy URLs
3. **Missing Error Handling** - No fallback when Google Auth fails

## Solution: Step-by-Step Fix

### Step 1: Get Your Android Package Fingerprint

Run this command to get your Android package fingerprint (needed for Google OAuth):

```bash
cd /Users/harshgupta1708/Desktop/GymTracker
eas credentials -p android
```

This will show you the SHA-1 fingerprint. **Copy this value - you'll need it soon.**

### Step 2: Create OAuth Credentials in Google Cloud Console

1. Go to: https://console.cloud.google.com/
2. Select your project: **"project-1013071433374"**
3. Go to **Credentials** (left sidebar)
4. Click **+ Create Credentials** → **OAuth 2.0 Client ID**
5. Choose **Android**
6. Fill in:
   - **Package name**: `com.harshgupta1708.gymtracker` (from app.json)
   - **SHA-1 certificate fingerprint**: Paste the value from Step 1
7. Click **Create**
8. **Copy the Client ID** (format: `XXXXX.apps.googleusercontent.com`)

### Step 3: Register Redirect URIs

For web to continue working, ensure these redirect URIs are added to your **Web OAuth Client**:

In Google Cloud Console → Credentials → Web client:
- `https://auth.expo.io` (Expo proxy - for all mobile)
- `https://127.0.0.1:19006` (Local web dev)
- `http://localhost:3000` (Local web dev)

### Step 4: Update Your `.env` File

Replace the contents with:

```env
# Web OAuth Client ID (get from Google Cloud Console - Web)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=1013071433374-5nt3jtkhhok3c1u37k6qrlsna32doa8j.apps.googleusercontent.com

# Android OAuth Client ID (get from Google Cloud Console - Android)
# After following steps above, paste the Android Client ID here:
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com

# iOS OAuth Client ID (optional, but recommended)
# If you plan iOS deployment, create iOS credentials in Google Cloud Console
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
```

### Step 5: Rebuild Your App

After updating `.env`, rebuild:

```bash
# Clear cache
expo start --clear

# Or rebuild EAS APK
eas build -p android --profile preview --clear-cache
```

## Why This Works

- **Web**: Uses the web Client ID with `https://auth.expo.io` redirect
- **Android**: Uses Android Client ID authenticated by SHA-1 fingerprint
- **useProxy: true**: Forces Expo to use `https://auth.expo.io` instead of `exp://` protocol

## Testing

1. Install the rebuilt APK on your physical phone
2. Open the app
3. Tap "Sign in with Google"
4. You should see the Google consent screen
5. After signing in, you should see the app dashboard

## Troubleshooting

### Still getting "Cross-Site request verification failed"?
- Check that your SHA-1 fingerprint in Google Cloud matches your signing key
- Clear app data: Settings → Apps → Gym Tracker → Storage → Clear Data

### Still getting "You can't sign in to this app"?
- Verify the Android Client ID is in your `.env` file
- Run `eas credentials -p android` again to get the correct fingerprint
- Ensure `useProxy: true` is being used (it is in the code)

### App crashes immediately?
- Check logcat: `adb logcat | grep GymTracker` (if using emulator)
- The error handling will now show Alert dialogs with specific errors

## Common Issues Fixed in Code

✅ Missing `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`  
✅ Missing `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`  
✅ Poor error messages (now shows alerts with details)  
✅ No fallback when auth fails (guest mode available)  
✅ App crash on auth error (added error boundaries)
