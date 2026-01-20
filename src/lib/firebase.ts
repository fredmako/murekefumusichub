import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCwI4aE5-p-NYm60p97IG0aKijccPI0sxI",
  authDomain: "prime-media-7216b.firebaseapp.com",
  projectId: "prime-media-7216b",
  storageBucket: "prime-media-7216b.appspot.com",
  messagingSenderId: "497607749297",
  appId: "1:497607749297:web:d113e9a79fd1799f803c90",
  measurementId: "G-NFG3EB5Q7F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);   // ✅ THIS WAS MISSING
export const storage = getStorage(app);

export default app;