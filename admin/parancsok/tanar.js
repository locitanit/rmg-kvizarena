// rmg-admin tanar hozzaad|lista|torol
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

  throw new Error('Használat: rmg-admin tanar hozzaad|lista|torol');
}

async function hozzaad([email, ...nevReszek], kapcsolo) {
  if (!email) throw new Error('Használat: rmg-admin tanar hozzaad <email> <nev>');
  const nev = nevReszek.join(' ') || email;
  const jelszo = kapcsolo.jelszo === true || !kapcsolo.jelszo ? jelszotGeneral() : kapcsolo.jelszo;

  let felhasznalo;
  try {
    felhasznalo = await auth().getUserByEmail(email);
    info(`A fiók már létezik: ${email}`);
  } catch {
    felhasznalo = await auth().createUser({ email, password: jelszo, displayName: nev });
    ok(`Új tanári fiók: ${email}`);
    info(`Jelszó: ${jelszo}   <-- írd fel, többször nem lesz kiírva`);
  }

  await db().doc(`tanarok/${felhasznalo.uid}`).set({
    nev, email, letrehozva: new Date(),
  }, { merge: true });

  ok(`Tanári jog megadva. uid: ${felhasznalo.uid}`);
}

async function lista() {
  const pillanat = await db().collection('tanarok').get();
  fejlec('Tanárok');
  tablazat(
    pillanat.docs.map((d) => [d.data().nev, d.data().email, d.id]),
    ['név', 'email', 'uid']
  );
}

async function torol([email]) {
  if (!email) throw new Error('Használat: rmg-admin tanar torol <email>');
  const felhasznalo = await auth().getUserByEmail(email);
  await db().doc(`tanarok/${felhasznalo.uid}`).delete();
  figyelem(`Tanári jog visszavonva: ${email}`);
  info('A belépési fiók megmaradt. Törölni a Firebase konzolban lehet.');
}
