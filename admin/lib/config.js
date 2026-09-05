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

export function konfigBetolt() {
  const ut = join(ADMIN_MAPPA, 'config.json');

  if (!existsSync(ut)) {
    throw new KonfigHiba(
      `Nincs meg a config.json.\n\n` +
      `  Masold le a peldat, es igazitsd az utakat:\n` +
      `    copy "${join(ADMIN_MAPPA, 'config.pelda.json')}" "${ut}"`
    );
  }

  let config;
  try {
    config = JSON.parse(readFileSync(ut, 'utf8'));
  } catch (hiba) {
    throw new KonfigHiba(`A config.json nem ervenyes JSON:\n  ${hiba.message}`);
  }

  for (const kulcs of ['osztalyok_ut', 'firebase_projekt']) {
    if (!config[kulcs]) {
      throw new KonfigHiba(`A config.json-bol hianyzik a "${kulcs}" mezo.`);
    }
  }

  return config;
}

// A tanari munkamappa eleresenek ellenorzese. Ures banknal nem dolgozunk.
export function mappatEllenoriz(ut, mire) {
  if (!existsSync(ut)) {
    throw new KonfigHiba(
      `Nem talalom a(z) ${mire} mappajat:\n  ${ut}\n\n` +
      `  Ellenorizd a config.json-t (admin/config.json).`
    );
  }
  return ut;
}
