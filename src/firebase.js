import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD0lbpauTl24gf99dM2JKhNPz8-Eqb9kJ4",
  authDomain: "deadlineiq-6321f.firebaseapp.com",
  projectId: "deadlineiq-6321f",
  storageBucket: "deadlineiq-6321f.firebasestorage.app",
  messagingSenderId: "834373667209",
  appId: "1:834373667209:web:16f4a218ab319f2595f958",
};

const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, provider);

// Firestore
export const db = getFirestore(app);