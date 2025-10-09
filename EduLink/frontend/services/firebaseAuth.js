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

// ✅ Firestore
const db = getFirestore(app);

// ✅ Storage
const storage = getStorage(app);

export { auth, db, storage };