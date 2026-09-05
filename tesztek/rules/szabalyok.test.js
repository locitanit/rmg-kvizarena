// Firestore biztonsagi szabalyok - emulatoros tesztek.
//
// A rendszer mogott NINCS szerver, ami ujraellenorizne, ezert minden tiltashoz
// tartozik itt egy "a diak megprobalja, elbukik" teszt.

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import {
  kornyezetIndit, adatokatFeltolt, mint, mintKivulallo, OSZTALY, BELEPOKOD, KVIZ,
} from './kozos.js';

let kornyezet;

beforeAll(async () => {
  kornyezet = await kornyezetIndit();
});

afterAll(async () => {
  await kornyezet?.cleanup();
});

beforeEach(async () => {
  await kornyezet.clearFirestore();
  await adatokatFeltolt(kornyezet);
});

// ---------------------------------------------------------------------------
describe('A diak megprobalja - es elbukik', () => {

  it('1. nem olvashatja a megoldokulcsot', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(getDoc(doc(db, 'kulcsok/adatbaziskezeles_icdl_1')));
  });

  it('2. nem listazhatja ki a megoldokulcsokat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(getDocs(collection(db, 'kulcsok')));
  });

  it('3. nem lathatja masik diak tagsagi adatlapjat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(getDoc(doc(db, `osztalyok/${OSZTALY}/tagok/diak2`)));
  });

  it('4. nem listazhatja ki az osztaly nevsorat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(getDocs(collection(db, `osztalyok/${OSZTALY}/tagok`)));
  });

  it('5. nem irhatja at a sajat csillagait', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(updateDoc(doc(db, `osztalyok/${OSZTALY}/tagok/diak1`), { csillag_ossz: 99 }));
  });

  it('6. nem regisztralhat mas azonositojaval', async () => {
    const db = mint(kornyezet, 'diak3');
    await assertFails(setDoc(doc(db, `osztalyok/${OSZTALY}/tagok/diak3`), {
      azonosito: 'kovacs_b12', becenev: 'Nemen', csillag_ossz: 0,
      csillag_aktualis: 0, jegyek: 0, csatlakozott: new Date(),
    }));
  });

  it('7. nem regisztralhat olyan azonositoval, ami nincs az engedelyezett listan', async () => {
    // Az e-mail cim stimmelne, de az azonositot a tanar nem toltotte fel.
    const kivulrol = kornyezet
      .authenticatedContext('diak9', { email: `betolakodo@${OSZTALY}.rmg.local` })
      .firestore();
    await assertFails(setDoc(doc(kivulrol, `osztalyok/${OSZTALY}/tagok/diak9`), {
      azonosito: 'betolakodo', becenev: 'Beto', csillag_ossz: 0,
      csillag_aktualis: 0, jegyek: 0, csatlakozott: new Date(),
    }));
  });

  it('8. nem regisztralhat elore beirt csillagokkal', async () => {
    const db = mint(kornyezet, 'diak3');
    await assertFails(setDoc(doc(db, `osztalyok/${OSZTALY}/tagok/diak3`), {
      azonosito: 'szabo_c07', becenev: 'Csongi', csillag_ossz: 50,
      csillag_aktualis: 50, jegyek: 10, csatlakozott: new Date(),
    }));
  });

  it('9. nem teheti magat tanarra', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(setDoc(doc(db, 'tanarok/diak1'), { nev: 'En vagyok a tanar' }));
  });

  it('10. nem irhatja felul a mar elkuldott valaszat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(updateDoc(doc(db, `kvizek/${KVIZ}/valaszok/diak1_0`), { valasz: [2] }));
  });

  it('11. nem torolheti a valaszat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(deleteDoc(doc(db, `kvizek/${KVIZ}/valaszok/diak1_0`)));
  });

  it('12. nem olvashatja masok valaszait', async () => {
    const db = mint(kornyezet, 'diak2');
    await assertFails(getDoc(doc(db, `kvizek/${KVIZ}/valaszok/diak1_0`)));
    await assertFails(getDocs(collection(db, `kvizek/${KVIZ}/valaszok`)));
  });

  it('13. nem valaszolhat mas nevaben', async () => {
    const db = mint(kornyezet, 'diak2');
    await assertFails(setDoc(doc(db, `kvizek/${KVIZ}/valaszok/diak1_0`), {
      uid: 'diak1', kerdesIndex: 0, valasz: [1], kuldve_ms: 100,
    }));
  });

  it('14. nem valaszolhat elore a kovetkezo kerdesre', async () => {
    const db = mint(kornyezet, 'diak2');
    await assertFails(setDoc(doc(db, `kvizek/${KVIZ}/valaszok/diak2_3`), {
      uid: 'diak2', kerdesIndex: 3, valasz: [1], kuldve_ms: 100,
    }));
  });

  it('15. nem valaszolhat mar lezart kerdesre', async () => {
    const db = mint(kornyezet, 'diak2');
    await assertFails(setDoc(doc(db, 'kvizek/kviz_lezart/valaszok/diak2_0'), {
      uid: 'diak2', kerdesIndex: 0, valasz: [1], kuldve_ms: 100,
    }));
  });

  it('16. nem irhatja at a sajat pontszamat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(updateDoc(doc(db, `kvizek/${KVIZ}/jatekosok/diak1`), { pont: 9999 }));
  });

  it('17. nem csatlakozhat elore beirt pontszammal', async () => {
    const db = mint(kornyezet, 'diak3');
    await assertFails(setDoc(doc(db, `kvizek/${KVIZ}/jatekosok/diak3`), {
      becenev: 'Csongi', azonosito: 'szabo_c07', pont: 500, helyes_db: 5,
    }));
  });

  it('18. nem irhatja at a kerdesbankot', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(updateDoc(doc(db, 'kerdesek/adatbaziskezeles_icdl_1'), { kerdes: 'atirva' }));
  });

  it('19. nem lathatja masik osztaly kvizet', async () => {
    const db = mint(kornyezet, 'idegen');
    await assertFails(getDoc(doc(db, `kvizek/${KVIZ}`)));
  });

  it('20. nem modosithatja az osztaly adatait (pl. belepokodot)', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(updateDoc(doc(db, `osztalyok/${OSZTALY}`), { belepokod: '10T-HACK' }));
  });

  it('21. nem olvashatja masik diak statisztikajat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(getDoc(doc(db, `statisztika/${OSZTALY}_diak2`)));
  });

  it('22. nem irhatja a sajat statisztikajat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(setDoc(doc(db, `statisztika/${OSZTALY}_diak1`), { szemelyes_csucs: 1.0 }));
  });

  it('23. nem toltheti le az engedelyezett azonositok listajat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(getDocs(collection(db, `osztalyok/${OSZTALY}/engedelyezett`)));
  });

  it('24. nem listazhatja vegig a belepokodokat', async () => {
    const db = mintKivulallo(kornyezet);
    await assertFails(getDocs(collection(db, 'belepok')));
  });

  it('25. belepes nelkul nem lathatja a kerdeseket', async () => {
    const db = mintKivulallo(kornyezet);
    await assertFails(getDoc(doc(db, 'kerdesek/adatbaziskezeles_icdl_1')));
  });

  it('26. nem listazhatja vegig az osztalyokat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertFails(getDocs(collection(db, 'osztalyok')));
  });
});

// ---------------------------------------------------------------------------
describe('Amit a diaknak tudnia KELL', () => {

  it('belepes elott latja a nyilvanos osztalylistat', async () => {
    const db = mintKivulallo(kornyezet);
    await assertSucceeds(getDocs(collection(db, 'osztalyok_nyilvanos')));
  });

  it('feloldja a belepokodot, ha ismeri', async () => {
    const db = mintKivulallo(kornyezet);
    await assertSucceeds(getDoc(doc(db, `belepok/${BELEPOKOD}`)));
  });

  it('ellenorizni tudja, hogy az azonositoja engedelyezett-e', async () => {
    const db = mintKivulallo(kornyezet);
    await assertSucceeds(getDoc(doc(db, `osztalyok/${OSZTALY}/engedelyezett/szabo_c07`)));
  });

  it('regisztralhat a sajat azonositojaval, nulla csillaggal', async () => {
    const db = mint(kornyezet, 'diak3');
    await assertSucceeds(setDoc(doc(db, `osztalyok/${OSZTALY}/tagok/diak3`), {
      azonosito: 'szabo_c07', becenev: 'Csongi', csillag_ossz: 0,
      csillag_aktualis: 0, jegyek: 0, csatlakozott: new Date(),
    }));
  });

  it('olvassa a sajat adatlapjat es atirhatja a becenevet', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertSucceeds(getDoc(doc(db, `osztalyok/${OSZTALY}/tagok/diak1`)));
    await assertSucceeds(updateDoc(doc(db, `osztalyok/${OSZTALY}/tagok/diak1`), { becenev: 'Bence' }));
  });

  it('olvassa a kerdeseket - kulcs nelkul', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertSucceeds(getDoc(doc(db, 'kerdesek/adatbaziskezeles_icdl_1')));
  });

  it('latja az osztalya kvizet es a ranglistat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertSucceeds(getDoc(doc(db, `kvizek/${KVIZ}`)));
    await assertSucceeds(getDocs(collection(db, `kvizek/${KVIZ}/jatekosok`)));
  });

  it('csatlakozhat a kvizhez nulla ponttal', async () => {
    const db = mint(kornyezet, 'diak3');
    await assertSucceeds(setDoc(doc(db, `kvizek/${KVIZ}/jatekosok/diak3`), {
      becenev: 'Csongi', azonosito: 'szabo_c07', pont: 0, helyes_db: 0,
    }));
  });

  it('elkuldheti a valaszat az eppen futo kerdesre', async () => {
    const db = mint(kornyezet, 'diak2');
    await assertSucceeds(setDoc(doc(db, `kvizek/${KVIZ}/valaszok/diak2_0`), {
      uid: 'diak2', kerdesIndex: 0, valasz: [1], kuldve_ms: 2100,
    }));
  });

  it('lekeri a sajat osztalyanak adatlapjat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertSucceeds(getDoc(doc(db, `osztalyok/${OSZTALY}`)));
  });

  it('lekerdezi az osztalya kvizeit', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertSucceeds(getDocs(
      query(collection(db, 'kvizek'), where('osztalyId', '==', OSZTALY))));
  });

  it('olvassa a sajat statisztikajat', async () => {
    const db = mint(kornyezet, 'diak1');
    await assertSucceeds(getDoc(doc(db, `statisztika/${OSZTALY}_diak1`)));
  });
});

// ---------------------------------------------------------------------------
describe('Amit a tanarnak tudnia kell', () => {

  it('olvassa a megoldokulcsot', async () => {
    const db = mint(kornyezet, 'tanar1');
    await assertSucceeds(getDoc(doc(db, 'kulcsok/adatbaziskezeles_icdl_1')));
  });

  // Ez a lekerdezes fut a tanari pult betoltesekor - list muvelet, ezert kulon
  // szabaly vonatkozik ra (lasd a firestore.rules megjegyzeset).
  it('lekerdezi a sajat osztalyait', async () => {
    const db = mint(kornyezet, 'tanar1');
    await assertSucceeds(getDocs(
      query(collection(db, 'osztalyok'), where('tanarok', 'array-contains', 'tanar1'))));
  });

  it('listazza a sajat osztalya tagjait', async () => {
    const db = mint(kornyezet, 'tanar1');
    await assertSucceeds(getDocs(collection(db, `osztalyok/${OSZTALY}/tagok`)));
  });

  it('modosithatja a sajat osztalyat', async () => {
    const db = mint(kornyezet, 'tanar1');
    await assertSucceeds(updateDoc(doc(db, `osztalyok/${OSZTALY}`), { belepokod: '10T-UJKOD' }));
  });

  it('pontozhat a sajat kvizeben', async () => {
    const db = mint(kornyezet, 'tanar1');
    await assertSucceeds(updateDoc(doc(db, `kvizek/${KVIZ}/jatekosok/diak1`), { pont: 240 }));
  });

  it('olvassa a beerkezett valaszokat', async () => {
    const db = mint(kornyezet, 'tanar1');
    await assertSucceeds(getDocs(collection(db, `kvizek/${KVIZ}/valaszok`)));
  });

  it('irhatja a diakok statisztikajat', async () => {
    const db = mint(kornyezet, 'tanar1');
    await assertSucceeds(setDoc(doc(db, `statisztika/${OSZTALY}_diak1`), { szemelyes_csucs: 0.9 }));
  });

  it('DE masik tanar osztalyat nem modosithatja', async () => {
    const db = mint(kornyezet, 'tanar2');
    await assertFails(updateDoc(doc(db, `osztalyok/${OSZTALY}`), { belepokod: '10T-IDEGEN' }));
  });

  it('DE masik tanar kvizet nem pontozhatja', async () => {
    const db = mint(kornyezet, 'tanar2');
    await assertFails(updateDoc(doc(db, `kvizek/${KVIZ}/jatekosok/diak1`), { pont: 0 }));
  });

  it('DE a kerdesbankot o sem irhatja (azt az admin CLI publikalja)', async () => {
    const db = mint(kornyezet, 'tanar1');
    await assertFails(setDoc(doc(db, 'kerdesek/uj_kerdes'), { kerdes: 'x' }));
    await assertFails(setDoc(doc(db, 'kulcsok/uj_kerdes'), { helyes: [0] }));
  });

  it('DE tanari jogot o sem oszthat', async () => {
    const db = mint(kornyezet, 'tanar1');
    await assertFails(setDoc(doc(db, 'tanarok/diak1'), { nev: 'Uj tanar' }));
  });
});
