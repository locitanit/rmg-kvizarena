// Szimulalt diakok az elo kvizhez - a "Kesz, ha" felteteleben 5 valodi eszkoz
// szerepel, de fejlesztes kozben ez a szkript helyettesiti oket.
//
// CSAK EMULATOR ELLEN MEGY. Elesben nem hasznalhato: a helyes valaszt a
// szolgaltatasfiokkal olvassa ki (hogy tudjon szandekosan jol vagy rosszul
// valaszolni) - a valodi diak kliense erre keptelen, es ezt a szkript kulon
// ellenorzi is minden kerdesnel.
//
// Hasznalat (kulon ablakban, mig fut az emulator):
//   1. npm run emulator
//   2. node admin/icdl-admin.js tanar hozzaad ... --emulator
//      node admin/icdl-admin.js osztaly letrehoz 10T --emulator
//      node admin/icdl-admin.js diakok 10T --fiokok --emulator
//      node admin/icdl-admin.js publikal --emulator
//   3. cd admin && node ../tesztek/jatekszimulator.mjs <jelszo1> <jelszo2> <jelszo3>
//      (az admin mappabol kell inditani, mert onnan latszik a firebase-admin)
//   4. A tanari pulton allitsd ossze es inditsd el a kvizt.
//
// A szimulalt diakok a VALODI kliens-utat jarjak: belepes, regisztracio,
// csatlakozas, valaszkuldes - mind a biztonsagi szabalyokon keresztul.
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { initializeApp as adminIndit } from 'firebase-admin/app';
import { getFirestore as adminDb } from 'firebase-admin/firestore';

// A szimulator "csal": a szolgaltatasfiokkal megnezi a helyes valaszt, hogy
// tudjon szandekosan jol vagy rosszul valaszolni. A VALODI diak kliense ezt
// nem tudja megtenni - ezt a szkript kulon ellenorzi is lentebb.
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
adminIndit({ projectId: 'demo-icdl' });
const kulcsokat = async (id) => (await adminDb().doc(`kulcsok/${id}`).get()).data()?.helyes;

const OSZTALY = '10T';
const DIAKOK = [
  { azonosito: 'teszt_a01', jelszo: process.argv[2], becenev: 'Anna', strategia: 'mindig_jo' },
  { azonosito: 'teszt_b02', jelszo: process.argv[3], becenev: 'Bence', strategia: 'lassu_jo' },
  { azonosito: 'teszt_c03', jelszo: process.argv[4], becenev: 'Cili', strategia: 'mindig_rossz' },
];

const varj = (ms) => new Promise((r) => setTimeout(r, ms));

async function diakotIndit(diak, index) {
  const app = initializeApp({ apiKey: 'demo-kulcs', authDomain: 'localhost', projectId: 'demo-icdl' },
    `diak${index}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, 'localhost', 8080);

  const engedely = await getDoc(doc(db, `osztalyok/${OSZTALY}/engedelyezett/${diak.azonosito}`));
  await signInWithEmailAndPassword(auth, engedely.data().email, diak.jelszo);
  const uid = auth.currentUser.uid;

  const tagUt = `osztalyok/${OSZTALY}/tagok/${uid}`;
  if (!(await getDoc(doc(db, tagUt))).exists()) {
    await setDoc(doc(db, tagUt), {
      azonosito: diak.azonosito, becenev: diak.becenev,
      csillag_ossz: 0, csillag_aktualis: 0, jegyek: 0, csatlakozott: serverTimestamp(),
    });
  }
  console.log(`[${diak.becenev}] belepett (${uid})`);

  // Varunk, amig a tanar elindit egy kvizt.
  let kvizId = null;
  for (let i = 0; i < 240 && !kvizId; i++) {
    const o = await getDoc(doc(db, `osztalyok/${OSZTALY}`));
    kvizId = o.data()?.aktiv_kviz || null;
    if (!kvizId) await varj(1000);
  }
  if (!kvizId) return console.log(`[${diak.becenev}] nem indult kviz, kilepek`);

  const kvizDok = await getDoc(doc(db, `kvizek/${kvizId}`));
  await setDoc(doc(db, `kvizek/${kvizId}/jatekosok/${uid}`), {
    becenev: diak.becenev, azonosito: diak.azonosito, pont: 0, helyes_db: 0,
  });
  console.log(`[${diak.becenev}] csatlakozott, PIN=${kvizDok.data().pin}`);

  // A kviz dokumentumot figyeljuk, es valaszolunk minden uj kerdesre.
  let megvalaszolt = -1;
  await new Promise((kesz) => {
    onSnapshot(doc(db, `kvizek/${kvizId}`), async (pillanat) => {
      const kviz = pillanat.data();
      if (!kviz) return;
      if (kviz.allapot === 'vege') return kesz();
      if (kviz.allapot !== 'kerdes' || kviz.aktualis === megvalaszolt) return;

      megvalaszolt = kviz.aktualis;
      const kerdesId = kviz.kerdesIdk[kviz.aktualis];
      const kerdes = (await getDoc(doc(db, `kerdesek/${kerdesId}`))).data();

      // A diak NEM olvashatja a kulcsot - ezt itt ellenorizzuk is.
      let kulcsHiba = null;
      try { await getDoc(doc(db, `kulcsok/${kerdesId}`)); kulcsHiba = 'OLVASHATO VOLT!'; }
      catch (e) { kulcsHiba = e.code; }
      if (kulcsHiba !== 'permission-denied') {
        console.log(`[${diak.becenev}] BAJ: a kulcs ${kulcsHiba}`);
      }

      // A helyes valaszt a szimulator a szolgaltatasfiokkal kapja meg (a valodi
      // diak nem latja) - csak azert, hogy tudjunk "jol" es "rosszul" valaszolni.
      const jo = await kulcsokat(kerdesId);
      let valasz;
      if (kerdes.tipus === 'igaz_hamis') {
        valasz = diak.strategia === 'mindig_rossz'
          ? (jo === 'igaz' ? 'hamis' : 'igaz') : jo;
      } else {
        const jok = Array.isArray(jo) ? jo : [0];
        valasz = diak.strategia === 'mindig_rossz'
          ? [(jok[0] + 1) % (kerdes.valaszok?.length || 2)] : jok;
      }

      if (diak.strategia === 'lassu_jo') await varj(3000);
      else await varj(300 + index * 200);

      try {
        await setDoc(doc(db, `kvizek/${kvizId}/valaszok/${uid}_${kviz.aktualis}`), {
          uid, kerdesIndex: kviz.aktualis, valasz, kuldve: serverTimestamp(),
        });
        console.log(`[${diak.becenev}] valasz kuldve a ${kviz.aktualis + 1}. kerdesre`);
      } catch (e) {
        console.log(`[${diak.becenev}] a valasz nem ment at: ${e.code}`);
      }
    });
  });

  const sajat = (await getDoc(doc(db, `kvizek/${kvizId}/jatekosok/${uid}`))).data();
  console.log(`[${diak.becenev}] VEGE: ${sajat.pont} pont, ${sajat.helyes_db} jo, ` +
              `${sajat.helyezes}. helyezes`);
}

await Promise.all(DIAKOK.map(diakotIndit));
console.log('minden diak vegzett');
process.exit(0);
