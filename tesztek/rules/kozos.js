// Kozos elokeszites a Firestore-szabalyok emulatoros teszteihez.
//
// Futtatas:  npm run teszt
// (a "firebase emulators:exec" inditja az emulatort es beallitja a
//  FIRESTORE_EMULATOR_HOST kornyezeti valtozot)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const ittVagyunk = dirname(fileURLToPath(import.meta.url));
const repoGyoker = join(ittVagyunk, '..', '..');

export const OSZTALY = '10T';
export const BELEPOKOD = '10T-K7QX';
export const KVIZ = 'kviz1';

// A tesztfiokok. A diak e-mail cime szintetikus: <azonosito>@<osztalyId>.rmg.local
export const FIOKOK = {
  tanar1: { uid: 'tanar1', email: 'tanar1@radnoti.hu' },
  tanar2: { uid: 'tanar2', email: 'tanar2@radnoti.hu' },
  diak1: { uid: 'diak1', azonosito: 'kovacs_b12', email: 'kovacs_b12@10t.rmg.local' },
  diak2: { uid: 'diak2', azonosito: 'nagy_a03', email: 'nagy_a03@10t.rmg.local' },
  // Letezo azonosito, de meg nincs tagsagi dokumentuma - a regisztraciot teszteli.
  diak3: { uid: 'diak3', azonosito: 'szabo_c07', email: 'szabo_c07@10t.rmg.local' },
  // Nem tagja egyetlen osztalynak sem.
  idegen: { uid: 'idegen', email: 'idegen@masik.rmg.local' },
};

export async function kornyezetIndit() {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080').split(':');
  return initializeTestEnvironment({
    projectId: 'demo-icdl',
    firestore: {
      rules: readFileSync(join(repoGyoker, 'firestore.rules'), 'utf8'),
      host,
      port: Number(port),
    },
  });
}

// A kiindulo adatbazis. Szabalyok nelkul irjuk be, ahogy az admin CLI tenne.
export async function adatokatFeltolt(kornyezet) {
  await kornyezet.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await db.doc('tanarok/tanar1').set({ nev: 'Posfai Loci', email: 'tanar1@radnoti.hu' });
    await db.doc('tanarok/tanar2').set({ nev: 'Masik Tanar', email: 'tanar2@radnoti.hu' });

    await db.doc(`osztalyok/${OSZTALY}`).set({
      nev: '10T',
      tanev: '2026_27',
      belepokod: BELEPOKOD,
      tanarok: ['tanar1'],
      aktiv: true,
    });
    await db.doc(`osztalyok_nyilvanos/${OSZTALY}`).set({ nev: '10T', tanev: '2026_27', aktiv: true });
    await db.doc(`belepok/${BELEPOKOD}`).set({ osztalyId: OSZTALY });

    // Masik osztaly, aminek diak1 NEM tagja.
    await db.doc('osztalyok/9B1').set({
      nev: '9B1', tanev: '2026_27', belepokod: '9B1-M2WZ', tanarok: ['tanar2'], aktiv: true,
    });

    // Az "email" mezot az admin CLI szamolja ki, es a szabaly EZT hasonlitja
    // ossze a bejelentkezett fiok cimevel.
    for (const azonosito of ['kovacs_b12', 'nagy_a03', 'szabo_c07']) {
      await db.doc(`osztalyok/${OSZTALY}/engedelyezett/${azonosito}`).set({
        email: `${azonosito}@${OSZTALY.toLowerCase()}.rmg.local`,
        hozzaadva: new Date(),
      });
    }

    for (const kulcs of ['diak1', 'diak2']) {
      const f = FIOKOK[kulcs];
      await db.doc(`osztalyok/${OSZTALY}/tagok/${f.uid}`).set({
        azonosito: f.azonosito,
        becenev: f.azonosito,
        csillag_ossz: 0,
        csillag_aktualis: 0,
        jegyek: 0,
        csatlakozott: new Date(),
      });
    }

    await db.doc('beallitasok/csillagok').set({ jegy_kuszob: 5, kviz_max_csillag: 4 });
    await db.doc('diasorok/adatbaziskezeles_icdl').set({
      tema: 'adatbaziskezeles', szamozott_diaszam: 129, verzio: '2026-09-02',
    });
    await db.doc('bankok/adatbaziskezeles_2026_icdl').set({
      cim: 'Adatbazis-kezeles (ICDL)', diasor: 'adatbaziskezeles_icdl', kerdes_db: 178,
    });
    await db.doc('kerdesek/adatbaziskezeles_icdl_1').set({
      tema: 'adatbaziskezeles_icdl', dia: 105, tipus: 'feleletvalasztos',
      kerdes: 'Mi az elsodleges kulcs?', valaszok: ['a', 'b', 'c'],
    });
    await db.doc('kulcsok/adatbaziskezeles_icdl_1').set({ helyes: [1], magyarazat: 'Mert...' });

    await db.doc(`kvizek/${KVIZ}`).set({
      osztalyId: OSZTALY, tanarUid: 'tanar1', cim: 'Ismetles',
      allapot: 'kerdes', aktualis: 0, ido_limit: 25, pin: '418293',
      kerdesIdk: ['adatbaziskezeles_icdl_1'],
    });
    await db.doc(`kvizek/${KVIZ}/jatekosok/diak1`).set({
      becenev: 'kovacs_b12', azonosito: 'kovacs_b12', pont: 120, helyes_db: 1,
    });
    await db.doc(`kvizek/${KVIZ}/jatekosok/diak2`).set({
      becenev: 'nagy_a03', azonosito: 'nagy_a03', pont: 80, helyes_db: 1,
    });
    await db.doc(`kvizek/${KVIZ}/valaszok/diak1_0`).set({
      uid: 'diak1', kerdesIndex: 0, valasz: [1], kuldve_ms: 3200,
    });

    // Mar lezart kviz - ide nem szabad valaszt kuldeni.
    await db.doc('kvizek/kviz_lezart').set({
      osztalyId: OSZTALY, tanarUid: 'tanar1', cim: 'Regi',
      allapot: 'eredmeny', aktualis: 0, kerdesIdk: ['adatbaziskezeles_icdl_1'],
    });

    await db.doc(`statisztika/${OSZTALY}_diak1`).set({ szemelyes_csucs: 0.8, kvizek_szama: 3 });
    await db.doc(`statisztika/${OSZTALY}_diak2`).set({ szemelyes_csucs: 0.6, kvizek_szama: 3 });
  });
}

// Belepett kliens az adott fiokkal (az e-mail cim bekerul a tokenbe).
export function mint(kornyezet, kulcs) {
  const f = FIOKOK[kulcs];
  return kornyezet.authenticatedContext(f.uid, { email: f.email }).firestore();
}

export function mintKivulallo(kornyezet) {
  return kornyezet.unauthenticatedContext().firestore();
}
