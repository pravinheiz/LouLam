import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;

export function initFirebaseClient(config: FirebaseConfig): Auth {
  if (authInstance) return authInstance;

  const apps = getApps();
  const app = apps.length > 0 ? getApp() : initializeApp(config);
  authInstance = getAuth(app);
  return authInstance;
}

export function initFirebaseStorage(config: FirebaseConfig): FirebaseStorage {
  if (storageInstance) return storageInstance;

  const apps = getApps();
  const app = apps.length > 0 ? getApp() : initializeApp(config);
  storageInstance = getStorage(app);
  return storageInstance;
}

