
import { initializeApp, getApps, getApp } from "firebase/app";
// Fix: Re-defined imports to ensure modular SDK functions are properly exported and matched with client expectations
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase 설정값
const firebaseConfig = {
  apiKey: "AIzaSyBBwJzc59L0ovhxHK76jonmj_qDOq8buQ0",
  authDomain: "bibleversus-10726.firebaseapp.com",
  projectId: "bibleversus-10726",
  storageBucket: "bibleversus-10726.firebasestorage.app",
  messagingSenderId: "129810318732",
  appId: "1:129810318732:web:8db40d9bc4ffc0bb5d02a9"
};

// 앱 초기화
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 인증 서비스 초기화 및 설정
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const isConfigured = true;

export { auth, googleProvider, isConfigured };
