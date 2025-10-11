// frontend/services/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDIpbGCUpuy3WNw9XUn2k3mJI19unAOU4w",
  authDomain: "edulink-37eca.firebaseapp.com",
  projectId: "edulink-37eca",
  storageBucket: "edulink-37eca.firebasestorage.app",
  messagingSenderId: "89078948722",
  appId: "1:89078948722:web:7557523772c3ec4a7eb3eb",
};

// ✅ Only initialize once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Auth: check if already initialized
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // Already initialized → fallback
  auth = getAuth(app);
}

let secondaryApp = null;
let secondaryAuth = null;

/**
 * Returns an Auth instance on a secondary Firebase App so you can
 * sign in/out for validation without affecting the main app's auth state.
 */
export function getSecondaryAuth() {
  // Create (or reuse) a named secondary app
  if (!secondaryApp) {
    secondaryApp =
      getApps().find((a) => a.name === "secondary") ||
      initializeApp(firebaseConfig, "secondary");
  }

  // Initialize (or reuse) auth for the secondary app
  if (!secondaryAuth) {
    try {
      secondaryAuth = initializeAuth(secondaryApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // If already initialized, fall back to getAuth
      secondaryAuth = getAuth(secondaryApp);
    }
  }

  return secondaryAuth;
}

// ✅ Firestore
const db = getFirestore(app);

// ✅ Storage
const storage = getStorage(app);

export { auth, db, storage };
