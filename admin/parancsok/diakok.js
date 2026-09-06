// rmg-admin diakok <osztaly> [--fiokok]
//
// Beolvassa az azonositok.txt-t a tanari munkamappabol, es feltolti az osztaly
// "engedelyezett" listajara. Csak az szerepelhet ezen, aki regisztralhat.
//
// A --fiokok kapcsoloval a belepesi fiokokat is letrehozza generalt jelszoval,
// es kiirja oket egy CSV-be (kiosztas_<osztaly>.csv, gitignore-olva).
// Enelkul a diakok maguk regisztralnak a belepokoddal - lasd a webes felulet.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auth, db } from '../lib/firebase.js';
import { ADMIN_MAPPA, mappatEllenoriz } from '../lib/config.js';
import { azonositokBeolvas, szintetikusEmail, jelszotGeneral } from '../lib/azonositok.js';
import { ok, info, fejlec, figyelem } from '../lib/kiiras.js';

export async function diakokParancs(argumentumok, kapcsolo, config) {
  const osztalyId = argumentumok[0];
  if (!osztalyId) throw new Error('Használat: rmg-admin diakok <osztaly> [--fiokok]');

  const osztalyDok = await db().doc(`osztalyok/${osztalyId}`).get();
  if (!osztalyDok.exists) {
    throw new Error(
      `Nincs ilyen osztály a Firestore-ban: ${osztalyId}\n` +
      `  Előbb hozd létre:  rmg-admin osztaly letrehoz ${osztalyId}`
    );
  }

  mappatEllenoriz(config.osztalyok_ut, 'osztalyok');
  const azonositok = azonositokBeolvas(config.osztalyok_ut, osztalyId);

  fejlec(`${osztalyId} – ${azonositok.length} azonosító`);

  // 1. Az engedelyezett lista. Az "email" mezot a biztonsagi szabaly hasonlitja
  //    ossze a bejelentkezett fiok cimevel, ezert itt kell kiszamolni.
  const koteg = db().batch();
  for (const azonosito of azonositok) {
    koteg.set(db().doc(`osztalyok/${osztalyId}/engedelyezett/${azonosito}`), {
      email: szintetikusEmail(azonosito, osztalyId),
      hozzaadva: new Date(),
    }, { merge: true });
  }
  await koteg.commit();
  ok(`Engedélyezett lista feltöltve (${azonositok.length} db).`);

  if (!kapcsolo.fiokok) {
    info('A diákok most már regisztrálhatnak a belépőkóddal:');
    info(`  ${osztalyDok.data().belepokod}`);
    info('Ha inkább kész fiókokat osztanál ki:  --fiokok');
    return;
  }

  // 2. Belepesi fiokok letrehozasa.
  const sorok = [['azonosító', 'jelszó']];
  let uj = 0;
  let meglevo = 0;

  for (const azonosito of azonositok) {
    const email = szintetikusEmail(azonosito, osztalyId);
    const letezik = await auth().getUserByEmail(email).catch(() => null);
    if (letezik) {
      meglevo++;
      continue;
    }
    const jelszo = jelszotGeneral();
    await auth().createUser({ email, password: jelszo });
    sorok.push([azonosito, jelszo]);
    uj++;
  }

  ok(`${uj} új fiók létrejött, ${meglevo} már létezett.`);

  if (uj === 0) {
    info('Nincs mit kiosztani. Jelszót így állíthatsz vissza:');
    info(`  rmg-admin jelszo ${osztalyId} <azonosito>`);
    return;
  }

  // A CSV Excelnek keszul: BOM + pontosvesszo, hogy ekezethelyesen nyiljon meg.
  const csvUt = join(ADMIN_MAPPA, `kiosztas_${osztalyId}.csv`);
  writeFileSync(csvUt, '﻿' + sorok.map((s) => s.join(';')).join('\r\n'), 'utf8');

  ok(`Kiosztólap: ${csvUt}`);
  figyelem('Ez a fájl jelszavakat tartalmaz. Kiosztás után töröld.');
}
