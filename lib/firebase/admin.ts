import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

function getAdminApp(): App {
  if (getApps().length) return getApp();

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. " +
      "Download a service account key from Firebase Console → Project Settings → Service Accounts."
    );
  }

  return initializeApp({ credential: cert(JSON.parse(json) as Parameters<typeof cert>[0]) });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
