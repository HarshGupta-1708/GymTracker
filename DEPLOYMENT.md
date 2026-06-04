# 🚀 GYM TRACKER - Deployment Guide

Complete guide for deploying GYM TRACKER to production on all platforms.

---

## 📋 Prerequisites

- ✅ Firebase project configured (see FIREBASE_SETUP.md)
- ✅ .env file with Firebase credentials
- ✅ Node.js & npm installed
- ✅ Expo CLI: `npm install -g eas-cli expo-cli`
- ✅ For iOS: Mac with Xcode (optional, can use EAS)
- ✅ For Android: Android Studio or just use EAS Build

---

## 🌐 Web Deployment (EASIEST)

### **Option 1: Vercel (Recommended)**

```bash
# 1. Build for web
npm run build
# or
expo export --platform web

# 2. Install Vercel CLI
npm install -g vercel

# 3. Deploy
vercel deploy

# 4. Follow prompts → Get live URL
```

**Live app**: `https://your-project.vercel.app`

### **Option 2: Netlify**

```bash
# 1. Build
npm run build

# 2. Drag & drop `dist/` folder to netlify.app
# or use CLI:
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### **Option 3: GitHub Pages**

```bash
# 1. Build
npm run build

# 2. Create `gh-pages` branch
git checkout -b gh-pages

# 3. Move dist/* to root
cp -r dist/* .

# 4. Commit & push
git add .
git commit -m "Deploy"
git push origin gh-pages

# 5. Enable in repo settings:
# Settings → Pages → Source: gh-pages branch
```

---

## 📱 Android Deployment

### **EAS CLI Build** (Cloud Build - Recommended)

```bash
# 1. Login to EAS
eas login
# (Create account if needed at eas.expo.dev)

# 2. Link project
eas project:init

# 3. Build APK
eas build -p android --profile preview

# 4. Download APK from EAS dashboard
# → Scan QR code or get download link

# 5. Install on phone
# (USB cable or send link)
```

### **Manual APK Build** (requires Android Studio)

```bash
# 1. Build
eas build -p android --profile preview

# 2. Get APK from EAS
# Can take 10-15 minutes

# 3. Submit to Play Store
# (requires developer account: $25 one-time)
eas submit -p android --latest
```

### **Install on Phone**

- **Via USB**: Connect phone → `adb install GymTracker.apk`
- **Via Email**: Send APK link to phone → tap to install
- **Via QR**: EAS dashboard shows QR code → scan with phone

---

## 🍎 iOS Deployment

### **Prerequisites**
- ✅ Mac with Xcode (free)
- ✅ Apple Developer Account ($99/year for App Store)

### **EAS Build** (Cloud)

```bash
# 1. Build
eas build -p ios --profile preview

# 2. Install on simulator
eas build:run -p ios

# 3. Or get live build link for physical device
```

### **Manual Build** (Local)

```bash
# 1. Build
npm run ios

# 2. Runs in simulator automatically

# 3. For physical device:
# - Connect iPhone via USB
# - Select device in Xcode
# - Click Play button
```

### **Submit to App Store**

```bash
# 1. Create Apple Developer Certificate (one-time)
eas credentials

# 2. Build for store
eas build -p ios

# 3. Submit
eas submit -p ios --latest

# 4. Wait for Apple review (1-3 days)
```

---

## 🎯 Google Play Store (Android)

### **Setup**

1. Create [Google Play Developer Account](https://play.google.com/console)
   - Cost: $25 (one-time)
2. Create billing account
3. Accept agreements

### **Build & Submit**

```bash
# 1. Build signed APK
eas build -p android --profile production

# 2. Get from EAS dashboard

# 3. Upload to Play Store
# Via EAS:
eas submit -p android --latest

# Or manually:
# - Go to Play Console
# - Create new app
# - Upload APK to "Production" track
# - Fill store listing details
# - Request review
```

**Timeline**: 2-4 hours for review

---

## 🍎 Apple App Store (iOS)

### **Setup**

1. Create [Apple Developer Account](https://developer.apple.com)
   - Cost: $99/year
2. Accept agreements
3. Create signing certificate

### **Build & Submit**

```bash
# 1. Build for App Store
eas build -p ios --profile production

# 2. Submit
eas submit -p ios --latest

# 3. App goes to review
```

**Timeline**: 1-3 days for review

---

## 📦 Build Profiles (eas.json)

Update `eas.json` for different build types:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      },
      "ios": {
        "buildType": "app-store"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "track": "production"
      },
      "ios": {
        "ascAppId": "YOUR_APP_ID"
      }
    }
  }
}
```

---

## 🔐 Environment Secrets (Secure)

Never commit `.env` file!

### **For EAS Builds**

```bash
# Store secrets securely in EAS
eas secret:create --scope PROJECT --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value YOUR_CLIENT_ID

# Or add via EAS dashboard:
# Settings → Environment → Add secret
```

### **.gitignore**

```
.env
.env.local
.env.*.local
node_modules/
*.apk
*.ipa
dist/
build/
```

---

## 📊 Version Updates

### **Update Version**

Edit `app.json`:

```json
{
  "expo": {
    "version": "1.0.1"  // Change this
  }
}
```

or via CLI:

```bash
eas build --runtimeVersion 1.0.1
```

### **Auto Increment**

```bash
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0
```

---

## 🐛 Troubleshooting

### **Build Fails**

```bash
# Clear cache
eas build:clean

# Check logs
eas build:list  # Get build ID
eas build:log --build-id YOUR_BUILD_ID
```

### **App Crashes After Install**

- Check browser console (web)
- Check device logs (Android Studio / Xcode)
- Verify Firebase credentials
- Check `.env` file exists

### **Play Store Rejection**

Common reasons:
- ✗ Missing privacy policy
- ✗ No user-facing content
- ✗ Crashes on startup

**Solution**: Add privacy policy URL in app listing

### **App Store Rejection**

Common reasons:
- ✗ App doesn't use App Store sign-in for account creation
- ✗ Requires parental consent (if age 13+)
- ✗ Beta testing not allowed for production

**Solution**: Use TestFlight for beta testing

---

## 📈 Post-Launch Monitoring

### **Firebase Console**

Monitor:
- Authentication usage
- Firestore reads/writes
- Error rates

### **EAS Dashboard**

Track:
- Build success rate
- App crash logs
- User growth

### **App Store Dashboard**

- Rating & reviews
- Crash reports
- Retention metrics

---

## 🎯 Launch Checklist

- [ ] Firebase project fully configured
- [ ] `.env` file created with credentials
- [ ] App tested on web locally
- [ ] App tested on Android/iOS
- [ ] Privacy policy written & linked
- [ ] Firebase Rules secured
- [ ] App icon & splash screens added
- [ ] Version number updated
- [ ] Build on EAS succeeds
- [ ] APK/IPA installs without crashes
- [ ] All 5 tabs work
- [ ] Firebase sync tested offline
- [ ] Sign-in works
- [ ] Ready for store submission

---

## 📱 Distribution Channels

| Platform | Audience | Setup Cost | Annual Cost | Review Time |
|----------|----------|-----------|------------|------------|
| **Web** | Everyone | Free | Free | Instant |
| **Google Play** | Android | $25 | $0 | 2-4 hours |
| **App Store** | iOS | $99 | $99 | 1-3 days |

---

## 🆘 Support

**EAS Documentation**: https://docs.expo.dev/eas
**Firebase Hosting**: https://firebase.google.com/docs/hosting
**Play Store Guide**: https://play.google.com/console/about/guides/
**App Store Guide**: https://developer.apple.com/app-store/guide/

---

**Keep grinding! Your app is going live! 🚀💪**
