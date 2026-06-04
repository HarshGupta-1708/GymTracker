// Firebase Configuration
// Replace these values with your Firebase project credentials from firebase.google.com

import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  getReactNativePersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey:
    process.env.REACT_APP_FIREBASE_API_KEY ||
    "AIzaSyCE7gxQYCdm3rrJwrB100slp8pTnNzxKNk",
  authDomain:
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN ||
    "gymtracker-1708.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "gymtracker-1708",
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ||
    "gymtracker-1708.firebasestorage.app",
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "1013071433374",
  appId:
    process.env.REACT_APP_FIREBASE_APP_ID ||
    "1:1013071433374:web:fc03ee75f0858375cdb58f",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication with platform-specific persistence
export let auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  // Use AsyncStorage for persistence on Native Mobile to prevent crashes
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

// Initialize Firestore with offline persistence
export let db;
if (Platform.OS === "web") {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} else {
  // For mobile devices, local cache persistence works automatically without tab manager
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({}),
  });
}

export default app;

