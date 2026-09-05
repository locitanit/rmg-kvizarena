// icdl-admin tanar hozzaad|lista|torol
//
// Tanari jogot KIZAROLAG ez a parancs adhat. A biztonsagi szabalyok szerint a
// "tanarok" kollekcio kliensbol nem irhato - nincs olyan ut, ahol valaki
// tanarra tehetne magat.

import { auth, db } from '../lib/firebase.js';
import { ok, info, fejlec, figyelem, tablazat } from '../lib/kiiras.js';
import { jelszotGeneral } from '../lib/azonositok.js';

export async function tanarParancs(argumentumok, kapcsolo) {
  const alparancs = argumentumok[0];

  if (alparancs === 'hozzaad') return hozzaad(argumentumok.slice(1), kapcsolo);
  if (alparancs === 'lista') return lista();
  if (alparancs === 'torol') return torol(argumentumok.slice(1));

  throw new Error('Hasznalat: icdl-admin tanar hozzaad|lista|torol');
}

async function hozzaad([email, ...nevReszek], kapcsolo) {
  if (!email) throw new Error('Hasznalat: icdl-admin tanar hozzaad <email> <nev>');
  const nev = nevReszek.join(' ') || email;
  const jelszo = kapcsolo.jelszo === true || !kapcsolo.jelszo ? jelszotGeneral() : kapcsolo.jelszo;

  let felhasznalo;
  try {
    felhasznalo = await auth().getUserByEmail(email);
    info(`A fiok mar letezik: ${email}`);
  } catch {
    felhasznalo = await auth().createUser({ email, password: jelszo, displayName: nev });
    ok(`Uj tanari fiok: ${email}`);
    info(`Jelszo: ${jelszo}   <-- ird fel, tobbszor nem lesz kiirva`);
  }

  await db().doc(`tanarok/${felhasznalo.uid}`).set({
    nev, email, letrehozva: new Date(),
  }, { merge: true });

  ok(`Tanari jog megadva. uid: ${felhasznalo.uid}`);
}

async function lista() {
  const pillanat = await db().collection('tanarok').get();
  fejlec('Tanarok');
  tablazat(
    pillanat.docs.map((d) => [d.data().nev, d.data().email, d.id]),
    ['nev', 'email', 'uid']
  );
}

async function torol([email]) {
  if (!email) throw new Error('Hasznalat: icdl-admin tanar torol <email>');
  const felhasznalo = await auth().getUserByEmail(email);
  await db().doc(`tanarok/${felhasznalo.uid}`).delete();
  figyelem(`Tanari jog visszavonva: ${email}`);
  info('A belepesi fiok megmaradt. Torolni a Firebase konzolban lehet.');
}
