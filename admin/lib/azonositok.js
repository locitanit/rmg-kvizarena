// Azonositok beolvasasa es a szintetikus e-mail cim eloallitasa.
//
// Az azonositok.txt formatuma (a tanari munkamappaban, osztalyonkent):
//     # kettoskereszt = megjegyzes, az ures sorok kimaradnak
//     kovacs_b12
//     nagy_a03
//
// Csak az elso szo szamit soronkent, igy a "kovacs_b12   Kovacs Bence" alaku
// sorok is mukodnek - a nev NEM kerul fel a felhobe, csak az azonosito.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KonfigHiba } from './config.js';

// Csak ezek a karakterek mehetnek szintetikus e-mail cimbe.
const ERVENYES = /^[a-z0-9][a-z0-9._-]*$/;

export function azonositokBeolvas(osztalyokUt, osztaly) {
  const ut = join(osztalyokUt, osztaly, 'azonositok.txt');

  if (!existsSync(ut)) {
    throw new KonfigHiba(
      `Nem találom az azonositok.txt-t:\n  ${ut}\n\n` +
      `  Ellenőrizd az osztály nevét és a config.json "osztalyok_ut" mezőjét.`
    );
  }

  const sorok = readFileSync(ut, 'utf8').split(/\r?\n/);
  const azonositok = [];
  const hibasak = [];

  sorok.forEach((sor, index) => {
    const tiszta = sor.trim();
    if (!tiszta || tiszta.startsWith('#')) return;

    const azonosito = tiszta.split(/\s+/)[0].toLowerCase();
    if (!ERVENYES.test(azonosito)) {
      hibasak.push(`  ${index + 1}. sor: "${azonosito}"`);
      return;
    }
    if (!azonositok.includes(azonosito)) azonositok.push(azonosito);
  });

  if (hibasak.length) {
    throw new KonfigHiba(
      `Érvénytelen azonosítók a(z) ${ut} fájlban.\n` +
      `Csak angol kisbetű, szám, pont, kötőjel és aláhúzás lehet bennük\n` +
      `(ékezet nem, mert e-mail-cím készül belőlük):\n\n${hibasak.join('\n')}`
    );
  }

  if (!azonositok.length) {
    throw new KonfigHiba(
      `A(z) ${ut} fájl üres.\n\n` +
      `  Írd bele a gépterem-azonosítókat, soronként egyet.`
    );
  }

  return azonositok;
}

// A Firebase Auth kisbetusiti az e-mail cimeket, es a domainben nem lehet
// alahuzas - ezert a "10D_human"-bol "10d-human" lesz.
export function osztalyDomain(osztalyId) {
  return osztalyId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

export function szintetikusEmail(azonosito, osztalyId) {
  return `${azonosito.toLowerCase()}@${osztalyDomain(osztalyId)}.rmg.local`;
}

// Konnyen diktalhato jelszo: nincs benne osszekeverheto karakter (0/O, 1/l/I).
const MASSALHANGZO = 'bcdfghkmnprstvz';
const MAGANHANGZO = 'aeiou';

export function jelszotGeneral() {
  let jelszo = '';
  for (let i = 0; i < 3; i++) {
    jelszo += MASSALHANGZO[Math.floor(Math.random() * MASSALHANGZO.length)];
    jelszo += MAGANHANGZO[Math.floor(Math.random() * MAGANHANGZO.length)];
  }
  return jelszo + String(Math.floor(Math.random() * 90) + 10);
}

// Belépőkód: <OSZTALY>-XXXX, osszekeverheto betuk nelkul.
const KOD_KARAKTEREK = 'ACDEFGHJKLMNPQRTUVWXY34679';

export function belepokodotGeneral(osztalyId) {
  let vege = '';
  for (let i = 0; i < 4; i++) {
    vege += KOD_KARAKTEREK[Math.floor(Math.random() * KOD_KARAKTEREK.length)];
  }
  return `${osztalyId.toUpperCase()}-${vege}`;
}
