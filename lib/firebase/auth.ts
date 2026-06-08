"use client";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
  type Auth,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseApp } from "./config";
import { initUserCredits } from "./credits";

/** Lazy getter — ensures Firebase is only initialized client-side. */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

export async function signIn(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await updateProfile(credential.user, { displayName });
  await initUserCredits(credential.user.uid);
  return credential;
}

/** Starts a Google redirect sign-in. Page navigates away; call getGoogleRedirectResult() on return. */
export async function signInWithGoogle(): Promise<void> {
  return signInWithRedirect(getFirebaseAuth(), googleProvider);
}

/** Call on page load to pick up the result after Google redirect. Returns null if no pending redirect. */
export async function getGoogleRedirectResult(): Promise<UserCredential | null> {
  return getRedirectResult(getFirebaseAuth());
}

export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function signOut(): Promise<void> {
  return firebaseSignOut(getFirebaseAuth());
}

export function mapFirebaseError(code: string): string {
  const map: Record<string, string> = {
    // Email/password
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/user-disabled": "This account has been disabled.",
    // Google / OAuth
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/cancelled-popup-request": "Sign-in was cancelled.",
    "auth/popup-blocked": "Popup was blocked — redirecting instead.",
    "auth/unauthorized-domain": "This domain is not authorised in Firebase. Add it under Authentication → Settings → Authorised domains.",
    "auth/operation-not-allowed": "Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in providers.",
    "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
    // Network / misc
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/internal-error": "An internal error occurred. Please try again.",
    "auth/unauthorized-continue-uri": "The redirect URL domain is not authorised in Firebase Console.",
  };
  return map[code] ?? `Sign-in error (${code || "unknown"}). Please try again.`;
}
