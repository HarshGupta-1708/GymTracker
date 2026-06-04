#!/bin/bash
# GYM TRACKER - Quick Commands Reference

echo "🏋️ GYM TRACKER - Development Commands"
echo "======================================"
echo ""

# Setup
echo "📦 SETUP"
echo "npm install              # Install dependencies"
echo "cp .env.example .env     # Create config file"
echo ""

# Development
echo "🚀 DEVELOPMENT"
echo "npm run web              # Start web app (http://localhost:8081)"
echo "npm run ios              # Run iOS simulator"
echo "npm run android          # Run Android emulator"
echo "npx expo start           # Start Expo dev server"
echo ""

# Build
echo "📱 BUILD"
echo "npm run build            # Build for web"
echo "eas build -p android     # Build Android APK (cloud)"
echo "eas build -p ios         # Build iOS (cloud)"
echo ""

# Deploy
echo "🌐 DEPLOY"
echo "vercel deploy            # Deploy to Vercel (web)"
echo "netlify deploy --prod    # Deploy to Netlify"
echo "eas submit -p android    # Submit to Play Store"
echo "eas submit -p ios        # Submit to App Store"
echo ""

# Firebase
echo "🔥 FIREBASE"
echo "eas secret:create        # Add Firebase secrets to EAS"
echo "eas credentials          # Setup iOS/Android signing"
echo ""

# Utilities
echo "🛠️ UTILITIES"
echo "npm run clean            # Clear build cache"
echo "npm run lint             # Run linter"
echo "npm run format           # Format code"
echo ""

echo "📚 DOCS"
echo "README.md                # Feature overview"
echo "FIREBASE_SETUP.md        # Firebase configuration"
echo "DEPLOYMENT.md            # Build & deploy guide"
echo ""
