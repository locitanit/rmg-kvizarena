// Belepes es regisztracio.
//
// A Firebase Auth e-mail/jelszo part var, a diaknak viszont nincs e-mail cime.
// Ezert szintetikus cimet hasznalunk: <azonosito>@<osztaly>.rmg.local.
// A cimet NEM itt szamoljuk ki, hanem az
//     osztalyok/<osztalyId>/engedelyezett/<azonosito>
// dokumentumbol olvassuk, amit az admin CLI toltott fel. Igy egy igazsag van:
// a kliens, az admin CLI es a biztonsagi szabaly ugyanazt a cimet hasznalja.
//
// Ez a dokumentum belepes elott is olvashato ("get"), de listazni nem lehet -
// vagyis a nevsor nem toltheto le, csak az ellenorizheto, amit valaki mar tud.

import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, collection, getDocs, query, where, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, db } from './firebase.js';

export { onAuthStateChanged };

export class BelepesHiba extends Error {}

// ------------------------------------------------------------------ osztalyok

export async function nyilvanosOsztalyok() {
  const pillanat = await getDocs(collection(db, 'osztalyok_nyilvanos'));
  return pillanat.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((o) => o.aktiv !== false)
    .sort((a, b) => (a.nev || a.id).localeCompare(b.nev || b.id, 'hu'));
}

async function engedelyezettFiok(osztalyId, azonosito) {
  const dok = await getDoc(doc(db, `osztalyok/${osztalyId}/engedelyezett/${azonosito}`));
  if (!dok.exists()) {
    throw new BelepesHiba('Nincs ilyen azonosító ebben az osztályban.');
  }
  return dok.data().email;
}

// -------------------------------------------------------------------- diakok

export async function diakBelepes(osztalyId, azonosito, jelszo) {
  if (!osztalyId) throw new BelepesHiba('Válaszd ki az osztályodat.');
  if (!azonosito) throw new BelepesHiba('Írd be az azonosítódat.');

  const email = await engedelyezettFiok(osztalyId, azonosito.trim().toLowerCase());
  await signInWithEmailAndPassword(auth, email, jelszo);
}

export async function diakRegisztracio(belepokod, azonosito, jelszo, jelszoUjra, becenev) {
  const kod = (belepokod || '').trim().toUpperCase();
  const tisztaAzonosito = (azonosito || '').trim().toLowerCase();
  const tisztaBecenev = (becenev || '').trim();

  if (!kod) throw new BelepesHiba('Írd be az osztálykódot, amit a tanártól kaptál.');
  if (!tisztaAzonosito) throw new BelepesHiba('Írd be az azonosítódat.');
  if (jelszo.length < 6) throw new BelepesHiba('A jelszó legalább 6 karakter legyen.');
  if (jelszo !== jelszoUjra) throw new BelepesHiba('A két jelszó nem egyezik.');
  if (!tisztaBecenev) throw new BelepesHiba('Adj meg egy becenevet – ez látszik a ranglistán.');
  if (tisztaBecenev.length > 20) throw new BelepesHiba('A becenév legfeljebb 20 karakter lehet.');

  // 1. A kod feloldasa osztalyra.
  const kodDok = await getDoc(doc(db, `belepok/${kod}`));
  if (!kodDok.exists()) throw new BelepesHiba('Ilyen osztálykód nincs. Ellenőrizd a betűket.');
  const osztalyId = kodDok.data().osztalyId;

  // 2. Az azonosito szerepel-e az osztaly engedelyezett listajan.
  const email = await engedelyezettFiok(osztalyId, tisztaAzonosito);

  // 3. Fiok letrehozasa (vagy belepes, ha az admin CLI mar letrehozta).
  try {
    await createUserWithEmailAndPassword(auth, email, jelszo);
  } catch (hiba) {
    if (hiba.code === 'auth/email-already-in-use') {
      // A tanar mar kiosztotta a fiokot: ilyenkor a kapott jelszoval lepunk be,
      // es csak a becenev hianyzik meg.
      await signInWithEmailAndPassword(auth, email, jelszo);
    } else {
      throw hiba;
    }
  }

  // 4. Tagsag felvetele. A szabaly ellenorzi, hogy nulla csillaggal indul.
  await setDoc(doc(db, `osztalyok/${osztalyId}/tagok/${auth.currentUser.uid}`), {
    azonosito: tisztaAzonosito,
    becenev: tisztaBecenev,
    csillag_ossz: 0,
    csillag_aktualis: 0,
    jegyek: 0,
    csatlakozott: serverTimestamp(),
  });

  return osztalyId;
}

// Melyik osztaly(ok) tagja a belepett diak. A tagsagi dokumentum utja tartalmazza
// az osztaly azonositojat, ezert collectionGroup helyett a nyilvanos listat jarjuk
// vegig - keves osztaly van, es igy nem kell kulon index.
export async function diakOsztalya(uid) {
  for (const osztaly of await nyilvanosOsztalyok()) {
    const dok = await getDoc(doc(db, `osztalyok/${osztaly.id}/tagok/${uid}`));
    if (dok.exists()) return { osztalyId: osztaly.id, nev: osztaly.nev, tag: dok.data() };
  }
  return null;
}

// -------------------------------------------------------------------- tanarok

export async function tanarBelepes(email, jelszo) {
  if (!email) throw new BelepesHiba('Írd be az e-mail-címedet.');
  await signInWithEmailAndPassword(auth, email.trim(), jelszo);

  const tanarDok = await getDoc(doc(db, `tanarok/${auth.currentUser.uid}`));
  if (!tanarDok.exists()) {
    await signOut(auth);
    throw new BelepesHiba(
      'Ennek a fióknak nincs tanári joga. Tanári jogot csak az admin parancssor adhat: ' +
      'icdl-admin tanar hozzaad <email> <nev>'
    );
  }
  return tanarDok.data();
}

export async function tanarOsztalyai(uid) {
  const pillanat = await getDocs(
    query(collection(db, 'osztalyok'), where('tanarok', 'array-contains', uid))
  );
  return pillanat.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nev || a.id).localeCompare(b.nev || b.id, 'hu'));
}

export async function osztalyTagjai(osztalyId) {
  const pillanat = await getDocs(collection(db, `osztalyok/${osztalyId}/tagok`));
  return pillanat.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .sort((a, b) => a.azonosito.localeCompare(b.azonosito, 'hu'));
}

// ------------------------------------------------------------------- kozos

export const kilepes = () => signOut(auth);
