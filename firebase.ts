import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// Substituir com os dados reais do seu projeto Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAEAKYGTf4FmfwZcsReNdr-zJfQBLoGXHg",
  authDomain: "financeocr-cdd50.firebaseapp.com",
  projectId: "financeocr-cdd50",
  storageBucket: "financeocr-cdd50.appspot.com",
  messagingSenderId: "1030775218749",
  appId: "1:1030775218749:web:d5ece2d2fe6681c6a54054"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
