import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "./config.js";

const app = getApps()[0] ?? initializeApp({
  credential: applicationDefault(),
  projectId: config.FIREBASE_PROJECT_ID
});

export const firebaseAuth = getAuth(app);
