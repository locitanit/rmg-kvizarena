// A config.json beolvasasa es ellenorzese.
//
// A fajl gitignore-olva van: a config.pelda.json alapjan kell letrehozni.
// Ha valami hianyzik, ITT allunk meg, ertheto uzenettel - nem dolgozunk
// felkonfiguralt allapotban.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ittVagyunk = dirname(fileURLToPath(import.meta.url));
export const ADMIN_MAPPA = join(ittVagyunk, '..');

export class KonfigHiba extends Error {}

// A "--config <ut>" kapcsoloval mas konfiguraciot is meg lehet adni - igy
// lehet peldaul emulator ellen, teszt-osztalyokkal dolgozni.
export function konfigBetolt(megadottUt) {
  const ut = megadottUt || join(ADMIN_MAPPA, 'config.json');

  if (!existsSync(ut)) {
    throw new KonfigHiba(
      `Nincs még a config.json.\n\n` +
      `  Másold le a példát, és igazítsd az utakat:\n` +
      `    copy "${join(ADMIN_MAPPA, 'config.pelda.json')}" "${ut}"`
    );
  }

  let config;
  try {
    config = JSON.parse(readFileSync(ut, 'utf8'));
  } catch (hiba) {
    throw new KonfigHiba(
      `A config.json nem érvényes JSON:\n  ${hiba.message}\n\n` +
      `  A két leggyakoribb ok:\n` +
      `    1. lemaradt egy idézőjel az érték elől vagy után\n` +
      `    2. az útvonalban egyszeres a visszaper – JSON-ban kétszeres kell:\n` +
      `       "C:\\\\Loci\\\\titkok\\\\kulcs.json"\n` +
      `       (vagy használj sima pert: "C:/Loci/titkok/kulcs.json")\n\n` +
      `  A fájl: ${ut}`
    );
  }

  for (const kulcs of ['osztalyok_ut', 'firebase_projekt']) {
    if (!config[kulcs]) {
      throw new KonfigHiba(`A config.json-ból hiányzik a(z) "${kulcs}" mező.`);
    }
  }

  return config;
}

// A tanari munkamappa eleresenek ellenorzese. Ures banknal nem dolgozunk.
export function mappatEllenoriz(ut, mire) {
  if (!existsSync(ut)) {
    throw new KonfigHiba(
      `Nem találom a(z) ${mire} mappáját:\n  ${ut}\n\n` +
      `  Ellenőrizd a config.json-t (admin/config.json).`
    );
  }
  return ut;
}
