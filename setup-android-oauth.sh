#!/bin/bash

# GymTracker Android Sign-In Setup Script
# This script guides you through setting up Google OAuth for Android builds

set -e

echo "🏋️ GymTracker Android Google Sign-In Setup"
echo "==========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
    echo "❌ Error: app.json not found. Please run this script from the GymTracker root directory."
    exit 1
fi

echo "Step 1️⃣ : Getting your Android signing key fingerprint..."
echo ""
echo "Run this command and copy the SHA-1 fingerprint:"
echo "  eas credentials -p android"
echo ""
read -p "Did you copy the SHA-1 fingerprint? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please run 'eas credentials -p android' and copy the SHA-1 fingerprint first."
    exit 1
fi

echo ""
echo "Step 2️⃣ : Create Android OAuth credentials in Google Cloud Console"
echo ""
echo "1. Go to: https://console.cloud.google.com/"
echo "2. Select project: project-1013071433374"
echo "3. Go to Credentials → Create Credentials → OAuth 2.0 Client ID"
echo "4. Choose Android"
echo "5. Package name: com.harshgupta1708.gymtracker"
echo "6. Paste the SHA-1 fingerprint from Step 1"
echo "7. Click Create and copy the Android Client ID"
echo ""
read -p "Press Enter when you have the Android Client ID ready..."

echo ""
echo "Step 3️⃣ : Update your .env file"
echo ""
read -p "Enter your Android Client ID (EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID): " ANDROID_CLIENT_ID

if [ -z "$ANDROID_CLIENT_ID" ]; then
    echo "❌ Error: Android Client ID cannot be empty"
    exit 1
fi

# Update .env file
if grep -q "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID" .env; then
    # Use sed to update existing value
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=.*|EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$ANDROID_CLIENT_ID|" .env
    else
        sed -i "s|^EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=.*|EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$ANDROID_CLIENT_ID|" .env
    fi
    echo "✅ Updated EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in .env"
else
    echo "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$ANDROID_CLIENT_ID" >> .env
    echo "✅ Added EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID to .env"
fi

echo ""
echo "Step 4️⃣ : Verify Google Cloud OAuth Settings"
echo ""
echo "Go to Google Cloud Console:"
echo "1. Credentials → Web client"
echo "2. Under 'Authorized redirect URIs', ensure these are added:"
echo "   - https://auth.expo.io"
echo "   - http://localhost:3000"
echo "   - https://127.0.0.1:19006"
echo ""
read -p "Did you verify the redirect URIs? (y/n) " -n 1 -r
echo ""

echo ""
echo "Step 5️⃣ : Rebuild the app"
echo ""
echo "Run one of these commands:"
echo ""
echo "📱 For testing on Android Studio Emulator:"
echo "   eas build -p android --profile preview --clear-cache"
echo ""
echo "📲 For APK to install on physical phone:"
echo "   eas build -p android --profile preview --clear-cache"
echo ""
echo "Or for local development (web):"
echo "   npm start"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run one of the build commands above"
echo "2. Test the app on your phone"
echo "3. Open the app and try 'Sign in with Google'"
echo ""
echo "If you encounter any errors, check ANDROID_SIGNIN_FIX_COMPLETE.md for troubleshooting"
