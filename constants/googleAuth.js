import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

// Public OAuth client IDs — safe in app bundle (not secrets). EAS builds do not load .env.
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  extra.googleWebClientId ||
  "1013071433374-5nt3jtkhhok3c1u37k6qrlsna32doa8j.apps.googleusercontent.com";

export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  extra.googleAndroidClientId ||
  "1013071433374-tbuplbi4egicmjsogurlfv9elkhpp1s4.apps.googleusercontent.com";

export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  extra.googleIosClientId ||
  undefined;
