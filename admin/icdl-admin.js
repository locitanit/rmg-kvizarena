#!/usr/bin/env node
// ICDL Gyakorlo - tanari admin parancssor.
//
// A tanar Windows-gepen fut, a Firebase Admin SDK-val. Ez az EGYETLEN hely,
// ahol tanari jog adhato, es ahol a kerdesbank a felhobe kerul.
//
//   icdl-admin tanar hozzaad <email> <nev>     tanari jog megadasa
//   icdl-admin tanar lista|torol
//   icdl-admin osztaly letrehoz <osztaly>      uj osztaly + belepokod
//   icdl-admin osztaly lista
//   icdl-admin osztaly kod <osztaly> [--uj]    belepokod mutatasa/csereje
//   icdl-admin diakok <osztaly> [--fiokok]     azonositok.txt feltoltese
//   icdl-admin jelszo <osztaly> <azonosito>    jelszo visszaallitasa
//
// Kozos kapcsolo:
//   --emulator    a helyi emulator ellen dolgozik (offline, nem kell kulcs)

import { konfigBetolt, KonfigHiba } from './lib/config.js';
import { firebaseIndit } from './lib/firebase.js';
import { kapcsolok, fejlec, info } from './lib/kiiras.js';
import { tanarParancs } from './parancsok/tanar.js';
import { osztalyParancs } from './parancsok/osztaly.js';
import { diakokParancs } from './parancsok/diakok.js';
import { jelszoParancs } from './parancsok/jelszo.js';

const SUGO = `
ICDL Gyakorlo - tanari admin

  icdl-admin tanar hozzaad <email> <nev>     tanari jog megadasa (csak itt lehet!)
  icdl-admin tanar lista
  icdl-admin tanar torol <email>

  icdl-admin osztaly letrehoz <osztaly>      uj osztaly + belepokod
  icdl-admin osztaly lista
  icdl-admin osztaly kod <osztaly> [--uj]    belepokod mutatasa vagy csereje

  icdl-admin diakok <osztaly> [--fiokok]     azonositok.txt -> engedelyezett lista
  icdl-admin jelszo <osztaly> <azonosito>    jelszo visszaallitasa

Kapcsolok:
  --emulator          a helyi emulator ellen (offline, kulcs nelkul)
  --tanar <email>     osztaly letrehozasanal, ha nem a config.json tanara

Elso indulas:
  1. copy admin\\config.pelda.json admin\\config.json   (es igazitsd az utakat)
  2. cd admin && npm install
  3. node icdl-admin.js tanar hozzaad sajat@email.hu "Vezetek Kereszt"
`;

async function fut() {
  const osszes = process.argv.slice(2);
  const kapcsolo = kapcsolok(osszes);
  const [parancs, ...argumentumok] = kapcsolo._;

  if (!parancs || parancs === 'sugo' || kapcsolo.help) {
    console.log(SUGO);
    return;
  }

  const config = konfigBetolt();
  firebaseIndit(config, { emulator: Boolean(kapcsolo.emulator) });

  if (kapcsolo.emulator) {
    fejlec('EMULATOR MOD');
    info('A helyi emulator ellen dolgozom, az eles adatbazis nem valtozik.');
  }

  switch (parancs) {
    case 'tanar':
      return tanarParancs(argumentumok, kapcsolo);
    case 'osztaly':
      return osztalyParancs(argumentumok, kapcsolo, config);
    case 'diakok':
      return diakokParancs(argumentumok, kapcsolo, config);
    case 'jelszo':
      return jelszoParancs(argumentumok);
    default:
      throw new Error(`Ismeretlen parancs: ${parancs}\n${SUGO}`);
  }
}

fut().then(
  () => process.exit(0),
  (hiba) => {
    console.error(`\n  HIBA  ${hiba.message}\n`);
    // A konfiguracios hibak uzenete onmagaban elegendo; a tobbihez a
    // veremkiirast az ICDL_RESZLETES=1 kornyezeti valtozo kapcsolja be.
    if (!(hiba instanceof KonfigHiba) && process.env.ICDL_RESZLETES) console.error(hiba);
    process.exit(1);
  }
);
