// src/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwI4aE5-p-NYm60p97IG0aKijccPI0sxI",
  authDomain: "prime-media-7216b.firebaseapp.com",
  projectId: "prime-media-7216b",
  storageBucket: "prime-media-7216b.appspot.com", // fixed typo here
  messagingSenderId: "497607749297",
  appId: "1:497607749297:web:d113e9a79fd1799f803c90",
  measurementId: "G-NFG3EB5Q7F"
};

// Initialize Firebase app (check for duplicates)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize services
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;