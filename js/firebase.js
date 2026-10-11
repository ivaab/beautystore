import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAso3VscbOeuVwuL5LoCrY8xWDNnVuAd6Y",
  authDomain: "beautystore-f17a5.firebaseapp.com",
  projectId: "beautystore-f17a5",
  storageBucket: "beautystore-f17a5.firebasestorage.app",
  messagingSenderId: "535155750744",
  appId: "1:535155750744:web:51194ceac25012891d172d",
  measurementId: "G-LZ0YD1Y1EX"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);