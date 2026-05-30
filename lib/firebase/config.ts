import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyBsIufRkTMIQi8Bn6Mg0BzFktgvNYf6VyA",
  authDomain: "aiot---saas.firebaseapp.com",
  projectId: "aiot---saas",
  storageBucket: "aiot---saas.firebasestorage.app",
  messagingSenderId: "291934975107",
  appId: "1:291934975107:web:818e1fc8e66db4c1d857b6",
  measurementId: "G-G2E6SLF5EK",
};

let _app: FirebaseApp | undefined;

/** Lazy singleton — safe to call from both client and server. */
export function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return _app;
}
