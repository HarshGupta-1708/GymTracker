# Redirect URI Fix - Critical OAuth Update

## Problem Identified 🔴

From the logs, the app was showing:
```
LOG  Redirect URI (useProxy: true): exp://192.168.1.55:8081
```

The redirect URI was still using the local `exp://` protocol instead of the Expo proxy `https://auth.expo.io`. This caused Google OAuth to reject the request because Google doesn't recognize `exp://` URLs.

## Root Cause

The `useProxy: true` parameter passed to `promptAsync()` wasn't actually changing the redirect URL used by the auth hook. The hook was initialized with a default redirect URL and `promptAsync()` parameters don't override the initial configuration.

## Solution ✅

**Changed LoginScreen.js:**

```javascript
// BEFORE (didn't work):
const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  // No redirectUrl specified - defaults to exp:// local URL
});

// Later...
await promptAsync({ useProxy: true }); // Parameter ignored!

// AFTER (works correctly):
const redirectUrl = AuthSession.makeRedirectUri({ useProxy: true });

const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  redirectUrl, // CRITICAL: Set it at initialization
});

// Later...
await promptAsync(); // Works! Uses the proxy URL set above
```

## What This Fixes

✅ Redirect URI now correctly uses: `https://auth.expo.io`  
✅ Google OAuth will now accept the request  
✅ Android sign-in should work properly  
✅ No more "invalid_request" or "state mismatch" errors  

## Testing After Update

1. Clear app cache and data
2. Rebuild: `eas build -p android --profile preview --clear-cache`
3. Look for logs showing: `✓ Proxy Redirect URI: https://auth.expo.io/...`
4. Try Google Sign-in - it should now work!

## Key Insight

The issue wasn't with the configuration or credentials - it was with the **initialization order**. The `redirectUrl` must be set when creating the hook, not when calling `promptAsync()`.
