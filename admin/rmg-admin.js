#!/usr/bin/env node
// RMG Kvizarena - tanari admin parancssor.
//
// A tanar Windows-gepen fut, a Firebase Admin SDK-val. Ez az EGYETLEN hely,
// ahol tanari jog adhato, es ahol a kerdesbank a felhobe kerul.
//
//   rmg-admin tanar hozzaad <email> <nev>     tanari jog megadasa
//   rmg-admin tanar lista|torol
//   rmg-admin osztaly letrehoz <osztaly>      uj osztaly + belepokod
//   rmg-admin osztaly lista
//   rmg-admin osztaly kod <osztaly> [--uj]    belepokod mutatasa/csereje
//   rmg-admin diakok <osztaly> [--fiokok]     azonositok.txt feltoltese
//   rmg-admin jelszo <osztaly> <azonosito>    jelszo visszaallitasa
//   rmg-admin publikal [bank] [--proba]       kerdesbank feltoltese
//
// Kozos kapcsolo:
//   --emulator     a helyi emulator ellen dolgozik (offline, nem kell kulcs)
//   --config <ut>  masik config.json hasznalata

import { konfigBetolt, KonfigHiba } from './lib/config.js';
import { firebaseIndit } from './lib/firebase.js';
import { kapcsolok, fejlec, info } from './lib/kiiras.js';
import { tanarParancs } from './parancsok/tanar.js';
import { osztalyParancs } from './parancsok/osztaly.js';
import { diakokParancs } from './parancsok/diakok.js';
import { jelszoParancs } from './parancsok/jelszo.js';
import { publikalParancs } from './parancsok/publikal.js';

const SUGO = `
RMG Kvízaréna – tanári admin

  rmg-admin tanar hozzaad <email> <nev>     tanári jog megadása (csak itt lehet!)
  rmg-admin tanar lista
  rmg-admin tanar torol <email>

  rmg-admin osztaly letrehoz <osztaly>      új osztály + belépőkód
  rmg-admin osztaly lista
  rmg-admin osztaly kod <osztaly> [--uj]    belépőkód mutatása vagy cseréje

  rmg-admin diakok <osztaly> [--fiokok]     azonositok.txt -> engedélyezett lista
  rmg-admin jelszo <osztaly> <azonosito>    jelszó visszaállítása

  rmg-admin publikal [bank] [--proba]       kérdésbank feltöltése a kvízbázisból
                                            (bank nélkül: mind; --proba: nem ír)

Kapcsolók:
  --emulator          a helyi emulátor ellen (offline, kulcs nélkül)
  --config <ut>       másik config.json használata
  --tanar <email>     osztály létrehozásánál, ha nem a config.json tanára

Első indulás:
  1. copy admin\\config.pelda.json admin\\config.json   (és igazítsd az utakat)
  2. cd admin && npm install
  3. node rmg-admin.js tanar hozzaad sajat@email.hu "Vezetek Kereszt"
`;

async function fut() {
  const osszes = process.argv.slice(2);
  const kapcsolo = kapcsolok(osszes);
  const [parancs, ...argumentumok] = kapcsolo._;

  if (!parancs || parancs === 'sugo' || kapcsolo.help) {
    console.log(SUGO);
    return;
  }

  const config = konfigBetolt(typeof kapcsolo.config === 'string' ? kapcsolo.config : null);
  firebaseIndit(config, { emulator: Boolean(kapcsolo.emulator) });

  if (kapcsolo.emulator) {
    fejlec('EMULÁTOR MÓD');
    info('A helyi emulátor ellen dolgozom, az éles adatbázis nem változik.');
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
    case 'publikal':
      return publikalParancs(argumentumok, kapcsolo, config);
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
