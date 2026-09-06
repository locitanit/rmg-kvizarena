// Firebase Admin SDK inditasa.
//
// Ket uzemmod:
//   - eles: a Firebase konzolbol letoltott szolgaltatasfiok-kulccsal
//   - emulator (--emulator): kulcs nelkul, a helyi emulator ellen (offline, ingyen)

import { existsSync, readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { KonfigHiba } from './config.js';

let alkalmazas = null;

export function firebaseIndit(config, { emulator = false } = {}) {
  if (alkalmazas) return alkalmazas;

  if (emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= 'localhost:9099';
    alkalmazas = initializeApp({ projectId: 'demo-icdl' });
    return alkalmazas;
  }

  const kulcsUt = config.szolgaltatasfiok_ut;
  if (!kulcsUt || !existsSync(kulcsUt)) {
    throw new KonfigHiba(
      `Nem találom a szolgáltatásfiók-kulcsot:\n  ${kulcsUt || '(nincs megadva)'}\n\n` +
      `  Firebase konzol > Projekt beállításai > Szolgáltatásfiókok >\n` +
      `  "Új privát kulcs létrehozása". A letöltött JSON-t tedd a repón KÍVÜLRE,\n` +
      `  és az útját írd be a config.json "szolgaltatasfiok_ut" mezőjébe.`
    );
  }

  alkalmazas = initializeApp({
    credential: cert(JSON.parse(readFileSync(kulcsUt, 'utf8'))),
    projectId: config.firebase_projekt,
  });
  return alkalmazas;
}

export const auth = () => getAuth();
export const db = () => getFirestore();
