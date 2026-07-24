/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// As variáveis devem começar com VITE_ para serem expostas ao frontend no build
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// O canal WebSocket normal do Firestore fica muitas vezes bloqueado por
// firewalls/redes restritivas ou extensões de bloqueio de anúncios, deixando os
// pedidos presos sem nunca responder. Forçar long-polling (HTTP simples) evita
// esse bloqueio, ao custo de latência ligeiramente maior — irrelevante aqui.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});