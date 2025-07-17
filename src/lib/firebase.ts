
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDBMVaItQ3hq7bg0vSqo6esmHEBf91lcb0",
  authDomain: "aichatbot-3b57f.firebaseapp.com",
  projectId: "aichatbot-3b57f",
  storageBucket: "aichatbot-3b57f.firebasestorage.app",
  messagingSenderId: "880096623731",
  appId: "1:880096623731:web:0b0207375339997b423e06"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { auth };
