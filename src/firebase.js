import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDxd-vHZyK_4Ju23LslJRVTEyIgDZPhq3Q",
  authDomain: "to-do-list-fc4ef.firebaseapp.com",
  projectId: "to-do-list-fc4ef",
  storageBucket: "to-do-list-fc4ef.firebasestorage.app",
  messagingSenderId: "603277030577",
  appId: "1:603277030577:web:bc1a380f555c4c0cec9e90"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
