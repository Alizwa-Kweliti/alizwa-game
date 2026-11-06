import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA92vNzNYD8bSvjf2TVLXPvWjydT58TT9E",
  authDomain: "alizwa-game.firebaseapp.com",
  projectId: "alizwa-game",
  storageBucket: "alizwa-game.firebasestorage.app",
  messagingSenderId: "455385468460",
  appId: "1:455385468460:web:439554c99454f53859cb89",
  measurementId: "G-D91JMBFW6F"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);