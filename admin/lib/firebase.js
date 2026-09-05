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
      `Nem talalom a szolgaltatasfiok-kulcsot:\n  ${kulcsUt || '(nincs megadva)'}\n\n` +
      `  Firebase konzol > Projekt beallitasai > Szolgaltatasfiokok >\n` +
      `  "Uj privat kulcs letrehozasa". A letoltott JSON-t tedd a repon KIVULRE,\n` +
      `  es az utjat ird be a config.json "szolgaltatasfiok_ut" mezojebe.`
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
