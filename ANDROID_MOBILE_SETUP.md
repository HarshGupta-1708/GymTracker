# 📱 Android & Mobile Setup Guide

## 🎯 Quick Options

| Platform    | Method        | Speed  | Online Needed      | Setup Difficulty |
| ----------- | ------------- | ------ | ------------------ | ---------------- |
| **Web**     | Browser       | ⚡⚡⚡ | After login        | Easy             |
| **Android** | Expo Go + QR  | ⚡⚡   | WiFi required      | Medium           |
| **Android** | Web on Device | ⚡⚡⚡ | WiFi + network     | Easy             |
| **Android** | APK File      | ⚡     | No (after install) | Hard             |

---

## 🌐 **Option 1: Web Browser (EASIEST)**

### Desktop

```bash
npm run web
# Automatically opens at http://localhost:8081
```

### Any Android Device

1. Open Chrome/Firefox on Android
2. Type: `http://YOUR_COMPUTER_IP:8081`
   - Replace YOUR_COMPUTER_IP with your computer's IP
   - On Mac: System Preferences → Network (shows IP like 192.168.1.x)
   - On Windows: `ipconfig` in terminal (IPv4 address)
3. Done! Use full app on Android

**Pros:**

- ✅ Works perfectly on any Android
- ✅ No app installation needed
- ✅ Real-time changes

**Cons:**

- ❌ Requires computer and device on same WiFi

---

## 📲 **Option 2: Expo Go + QR Code (QR METHOD)**

### Setup (One Time)

1. **Install Expo Go app** from Google Play Store
   - Search: "Expo Go"
   - Download from official Expo
2. **On Computer**: Run `npm start` (not `npm run web`)
3. **In Terminal**: Press `a` for Android
4. **QR Code** appears in terminal

### How to Use

1. Open Expo Go app on Android
2. Camera: Point at QR code in terminal
3. Or: Tap QR icon in Expo Go → Scan code
4. App loads in 5-10 seconds

**Example Terminal Output:**

```
› Metro waiting on exp://192.168.1.25:8081

If nothing opens, run: npx expo start
Press? to show all commands
Tap 'w' for web
Tap 'a' for Android
```

**Pros:**

- ✃ Works with live code changes
- ✅ No app installation needed
- ✅ Good for testing

**Cons:**

- ❌ Must be on same WiFi as computer
- ❌ Requires Expo Go app
- ⚠️ Firestore login may have issues with QR method

**If QR Login Fails:**

- Use Option 1 (Web) or Option 3 (APK) instead
- QR mode has limitations with Google OAuth redirects

---

## 🔧 **Option 3: Android APK (STANDALONE APP)**

### Create APK File

```bash
# Install EAS CLI (one time)
npm install -g eas-cli

# Create APK
eas build -p android

# Follow prompts:
# - Login to Expo account (create free account if needed)
# - Choose "APK" when asked
# - Building takes 10-20 minutes
```

### Output

- File saved to your Expo dashboard
- Or: Download link in terminal
- APK is ~50-100MB

### Install on Android Device

1. Download APK to phone or email to self
2. Open file manager on Android
3. Tap the APK file
4. Tap "Install"
5. GymTracker app appears on home screen

**Pros:**

- ✅ Works on any Android
- ✅ No computer needed after
- ✅ Feels like real app
- ✅ Offline mode enabled

**Cons:**

- ❌ Need EAS account (free)
- ❌ Build takes 15+ minutes
- ❌ Need to rebuild after code changes

---

## 🌎 **Option 4: iOS (Mac Only)**

### Simulator (Free)

```bash
npm start
Press 'i' in terminal
# Requires Xcode (huge download)
```

### Physical iPhone (Paid Developer Account)

```bash
eas build -p ios
# Requires Apple Developer membership ($99/year)
```

---

## ⚠️ **Common Issues**

### QR Code Has Error

**Problem:** Error scanning or opens blank screen

**Solutions:**

```bash
# Clear cache
npm start -- --clear

# Then press 'a' for Android again
# Or try web instead: press 'w'
```

### "Can't reach server" when using QR

**Problem:** Device can't connect to computer

**Check:**

1. Both on same WiFi network
2. IP address matches (shown in terminal)
3. Firewall not blocking port 8081
4. Computer IP: `ifconfig` (Mac) or `ipconfig` (Windows)

**Example Terminal:**

```
› Metro waiting on exp://192.168.1.25:19000
                          ↑ Use this IP in Expo Go
```

### Login Fails on QR Method

**Problem:** Google OAuth doesn't work with QR redirect

**Solution:**

- Use web method (Option 1)
- Or use APK method (Option 3)
- QR is best for testing UI, not authentication

---

## 📍 Finding Your Computer's IP

### Mac

```bash
# Terminal
ifconfig | grep "inet " | grep -v 127.0.0.1
# Look for line like: inet 192.168.1.25
```

### Windows

```bash
# CMD
ipconfig
# Look for IPv4 Address: 192.168.x.x
```

### Network Settings

- Mac: ⚙️ System Preferences → Network → WiFi → Advanced
- Windows: Settings → Network & Internet → WiFi → Properties

---

## 🚀 Recommended Setup for You

**For Testing:**

```
1. Web Browser (Option 1) - Best for daily use
   npm run web

2. Physical Android Phone - Use web in Chrome
   Type IP on phone (e.g., 192.168.1.25:8081)
```

**For Production:**

```
1. Build APK once
   eas build -p android

2. Install on phone
   Share APK file

3. Use like any other app
   Works offline!
```

---

## ✅ Testing Checklist

- [ ] Can login on web
- [ ] Dashboard shows stats
- [ ] Can log workout
- [ ] Can copy previous workout
- [ ] Can set weekly goal
- [ ] Data persists after refresh
- [ ] Works on Android phone (web method)
- [ ] Can delete and re-login

---

## 📞 Support

If something doesn't work:

**Check:**

1. Browser console: F12 → Console tab
2. Terminal output: Look for red errors
3. Internet connection: WiFi strong?
4. Firebase: Check Google Cloud console
5. Port 8081: Not blocked by firewall?

**Debug:**

```bash
# Full debug output
npm start -- --verbose

# Clear everything
npm start -- --clear

# Different port (if 8081 busy)
npm start --port 3000
```

---

_Last Updated: April 22, 2024_
