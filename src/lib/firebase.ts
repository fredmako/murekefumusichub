import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwI4aE5-p-NYm60p97IG0aKijccPI0sxI",
  authDomain: "prime-media-7216b.firebaseapp.com",
  projectId: "prime-media-7216b",
  storageBucket: "prime-media-7216b.firebasestorage.app",
  messagingSenderId: "497607749297",
  appId: "1:497607749297:web:d113e9a79fd1799f803c90",
  measurementId: "G-NFG3EB5Q7F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

export default app;
