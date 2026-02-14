import firebase from "firebase/compat/app";
import * as firebaseAuth from "firebase/auth";

// 입력하신 설정값입니다.
const firebaseConfig = {
  apiKey: "AIzaSyBBwJzc59L0ovhxHK76jonmj_qDOq8buQ0",
  authDomain: "bibleversus-10726.firebaseapp.com",
  projectId: "bibleversus-10726",
  storageBucket: "bibleversus-10726.firebasestorage.app",
  messagingSenderId: "129810318732",
  appId: "1:129810318732:web:8db40d9bc4ffc0bb5d02a9"
};

let app;
let auth: firebaseAuth.Auth | null = null;
let googleProvider: firebaseAuth.GoogleAuthProvider | null = null;

// 키가 입력되었으므로 설정을 완료된 것으로 처리합니다.
const isConfigured = true;

try {
  // 이미 초기화된 앱이 있는지 확인하여 중복 초기화를 방지합니다.
  if (firebase.apps.length > 0) {
    app = firebase.app();
  } else {
    app = firebase.initializeApp(firebaseConfig);
  }
  
  auth = firebaseAuth.getAuth(app);
  googleProvider = new firebaseAuth.GoogleAuthProvider();
} catch (e) {
  console.error("Firebase Initialization Error:", e);
}

export { auth, googleProvider, isConfigured };