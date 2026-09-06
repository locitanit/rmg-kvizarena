// Firebase inditasa. Minden mas modul innen keri az "auth" es a "db" peldanyt.
//
// A Firebase JS SDK-t a CDN-rol toltjuk, ESM importtal - igy nincs build lepes,
// a web/ mappa ugy megy fel a GitHub Pages-re, ahogy van.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth, connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { HASZNALT_CONFIG, EMULATOR } from './firebase-config.js';

const alkalmazas = initializeApp(HASZNALT_CONFIG);

export const auth = getAuth(alkalmazas);
export const db = getFirestore(alkalmazas);

if (EMULATOR) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.info('RMG Kvizarena: helyi emulator modban futok.');
}
