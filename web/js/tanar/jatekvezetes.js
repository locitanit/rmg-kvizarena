// A tanari bongeszo a jatekvezeto (terv 1.4).
//
// Mivel nincs szerveroldali kod, MINDEN itt tortenik: a kerdes kiosztasa, a
// beerkezo valaszok javitasa (a megoldokulcs csak ide toltodik be), a pontozas
// es a ranglista. A diak kliense csak a kviz dokumentumot figyeli.
//
// Ha ez a ful bezarul, a kviz megall - de nem vesz el: az allapot a Firestore-ban
// van, es ujranyitaskor felajanljuk a folytatast (terv 6.4).

import {
  doc, collection, getDoc, setDoc, updateDoc, onSnapshot, writeBatch,
  serverTimestamp, increment,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, db } from '../firebase.js';
import { ALLAPOTOK, pontszam, valaszHelyes, helyesValaszSzovege, pintGeneral, hatralevoMasodperc }
  from '../kozos/kviz.js';
import { kulcsokatBetolt } from '../kozos/kerdesbank.js';
import { magyarHiba } from '../kozos/hibak.js';
import { elem, kepernyo, uzenet } from '../kozos/ui.js';

let kvizId = null;
let kviz = null;
let kerdesek = [];      // a kisorsolt kerdesek publikus dokumentumai, sorrendben
let kulcsok = new Map();
let jatekosok = new Map();
let valaszok = new Map();   // valaszId -> adat

let leiratkozok = [];
let visszaszamlaloOra = null;
let visszateres = null;     // mit hivjunk, ha a tanar visszamegy a pulthoz

// ------------------------------------------------------------------ inditas

export async function kviztInditani({ osztalyId, cim, valogatas, kisorsolt, idoLimit }) {
  const ujId = `${osztalyId}_${Date.now()}`;
  const kerdesIdk = kisorsolt.map((k) => k.id);

  await setDoc(doc(db, `kvizek/${ujId}`), {
    osztalyId,
    tanarUid: auth.currentUser.uid,
    cim,
    valogatas,
    kerdesIdk,
    allapot: ALLAPOTOK.VARAKOZIK,
    aktualis: 0,
    ido_limit: idoLimit,
    pin: pintGeneral(),
    indult: serverTimestamp(),
  });

  // A diakok innen tudjak meg, hogy fut kviz - egyetlen dokumentum figyelesevel.
  await updateDoc(doc(db, `osztalyok/${osztalyId}`), { aktiv_kviz: ujId });

  return ujId;
}

// A tanar sajat, meg le nem zart kvize (terv 6.4).
//
// Nem lekerdezessel keressuk, hanem az osztalyok "aktiv_kviz" mezojebol: azok a
// dokumentumok ugyis be vannak toltve, igy nem kell osszetett index, es egy
// tanarnak amugy sem futhat egyszerre ket kvize ugyanabban az osztalyban.
export async function futoKvizt(osztalyok) {
  for (const osztaly of osztalyok) {
    if (!osztaly.aktiv_kviz) continue;
    const dok = await getDoc(doc(db, `kvizek/${osztaly.aktiv_kviz}`));
    if (dok.exists() && dok.data().allapot !== ALLAPOTOK.VEGE) {
      return { id: dok.id, osztalyNev: osztaly.nev || osztaly.id, ...dok.data() };
    }
  }
  return null;
}

// ------------------------------------------------------------- jatekvezetes

export async function jatekvezetestIndit(azonosito, visszaHivas) {
  kvizId = azonosito;
  visszateres = visszaHivas;
  kotesek();
  figyelesekLeall();

  try {
    const dok = await getDoc(doc(db, `kvizek/${kvizId}`));
    if (!dok.exists()) throw new Error('nincs ilyen kviz');
    kviz = { id: kvizId, ...dok.data() };
    await kerdeseketBetolt();
  } catch (hiba) {
    return uzenet('jatek-uzenet', magyarHiba(hiba));
  }

  elem('jatek-cim').textContent = kviz.cim;
  elem('jatek-pin').textContent = kviz.pin;
  kepernyo('jatek');

  leiratkozok.push(
    onSnapshot(doc(db, `kvizek/${kvizId}`), (pillanat) => {
      if (!pillanat.exists()) return;
      kviz = { id: kvizId, ...pillanat.data() };
      nezetetFrissit();
    }, (hiba) => uzenet('jatek-uzenet', magyarHiba(hiba))),

    onSnapshot(collection(db, `kvizek/${kvizId}/jatekosok`), (pillanat) => {
      jatekosok = new Map(pillanat.docs.map((d) => [d.id, { uid: d.id, ...d.data() }]));
      jatekosListakatFrissit();
    }),

    onSnapshot(collection(db, `kvizek/${kvizId}/valaszok`), (pillanat) => {
      valaszok = new Map(pillanat.docs.map((d) => [d.id, d.data()]));
      valaszSzamlalotFrissit();
    })
  );
}

async function kerdeseketBetolt() {
  kerdesek = await Promise.all(kviz.kerdesIdk.map(async (id) => {
    const dok = await getDoc(doc(db, `kerdesek/${id}`));
    return { id, ...dok.data() };
  }));
  // A megoldokulcs CSAK ide toltodik be - a diak kliense nem is olvashatja.
  kulcsok = await kulcsokatBetolt(kviz.kerdesIdk);
}

function kotesek() {
  elem('jatek-inditas').onclick = () => kerdestKioszt(0);
  elem('jatek-lezaras').onclick = kerdestLezar;
  elem('jatek-kovetkezo').onclick = () => {
    if (kviz.aktualis + 1 < kerdesek.length) kerdestKioszt(kviz.aktualis + 1);
    else kviztBefejez();
  };
  elem('jatek-megszakitas').onclick = kviztBefejez;
  elem('jatek-vissza').onclick = () => { figyelesekLeall(); visszateres?.(); };
}

// ----------------------------------------------------------------- nezetek

function nezetetFrissit() {
  document.querySelectorAll('[data-jatek]').forEach((doboz) => {
    doboz.hidden = doboz.dataset.jatek !== kviz.allapot;
  });

  const sorszam = `${kviz.aktualis + 1}. / ${kerdesek.length} kerdes`;
  elem('jatek-allapot').textContent = {
    [ALLAPOTOK.VARAKOZIK]: 'Varakozas a jatekosokra',
    [ALLAPOTOK.KERDES]: sorszam,
    [ALLAPOTOK.EREDMENY]: `${sorszam} - lezarva`,
    [ALLAPOTOK.VEGE]: 'Vege',
  }[kviz.allapot] || '';

  if (kviz.allapot === ALLAPOTOK.KERDES) kerdestMutat();
  if (kviz.allapot === ALLAPOTOK.EREDMENY) eredmenytMutat();
  if (kviz.allapot === ALLAPOTOK.VEGE) vegeredmenytMutat();
  jatekosListakatFrissit();
  valaszSzamlalotFrissit();
}

function kerdestMutat() {
  const kerdes = kerdesek[kviz.aktualis];
  elem('kerdes-sorszam').textContent = `${kviz.aktualis + 1}. kerdes`;
  elem('kerdes-szoveg').textContent = kerdes.kerdes;

  const racs = elem('kerdes-valaszok');
  racs.innerHTML = '';
  for (const [index, szoveg] of valaszLehetosegek(kerdes).entries()) {
    const doboz = document.createElement('div');
    doboz.className = `valaszdoboz szin${index % 4}`;
    doboz.textContent = szoveg;
    racs.append(doboz);
  }

  visszaszamlalotIndit();
}

// A tanari kepernyon ugyanaz a sorrend latszik, mint a diakoknal.
export function valaszLehetosegek(kerdes) {
  if (kerdes.tipus === 'igaz_hamis') return ['igaz', 'hamis'];
  return kerdes.valaszok || [];
}

// Melyik valaszlehetosegeket jelolte meg a diak - a valaszeloszlashoz.
function megjeloltIndexek(kerdes, valasz) {
  if (valasz === undefined || valasz === null) return [];
  if (kerdes.tipus === 'igaz_hamis') return [valasz === 'igaz' ? 0 : 1];
  return Array.isArray(valasz) ? valasz : [valasz];
}

function visszaszamlalotIndit() {
  clearInterval(visszaszamlaloOra);
  const indult = kviz.kerdes_indult?.toMillis?.();
  if (!indult) return;

  const lepes = () => {
    const hatra = hatralevoMasodperc(indult, kviz.ido_limit);
    elem('kerdes-ido').textContent = `${hatra} mp`;
    elem('kerdes-ido').classList.toggle('surgos', hatra <= 5);
    // Az ido lejarta a tanari gepen zar - nincs szerver, ami megtenne.
    if (hatra <= 0 && kviz.allapot === ALLAPOTOK.KERDES) {
      clearInterval(visszaszamlaloOra);
      kerdestLezar();
    }
  };
  lepes();
  visszaszamlaloOra = setInterval(lepes, 500);
}

function jatekosListakatFrissit() {
  const rendezett = [...jatekosok.values()].sort((a, b) => (b.pont || 0) - (a.pont || 0));

  elem('lobbi-db').textContent = jatekosok.size;
  elem('lobbi-lista').innerHTML = rendezett.length
    ? rendezett.map((j) => `<div class="jatekossor"><span></span></div>`).join('')
    : '<p class="alcim">Meg senki nem csatlakozott.</p>';
  // A beceneveket szovegkent tesszuk be, hogy ne lehessen HTML-t becsempeszni.
  elem('lobbi-lista').querySelectorAll('.jatekossor span').forEach((cella, i) => {
    cella.textContent = rendezett[i].becenev || rendezett[i].azonosito;
  });

  elem('eredmeny-ranglista').innerHTML = '';
  rendezett.slice(0, 10).forEach((jatekos, index) => {
    const sor = document.createElement('div');
    sor.className = 'jatekossor';
    sor.innerHTML = '<span class="helyezes"></span><span class="nev"></span>' +
                    '<span class="pont"></span>';
    sor.querySelector('.helyezes').textContent = `${index + 1}.`;
    sor.querySelector('.nev').textContent = jatekos.becenev || jatekos.azonosito;
    sor.querySelector('.pont').textContent = `${jatekos.pont || 0} pont`;
    if (jatekos.utolso_helyes !== undefined) {
      sor.classList.add(jatekos.utolso_helyes ? 'jo' : 'rossz');
    }
    elem('eredmeny-ranglista').append(sor);
  });
}

function aktualisValaszok() {
  return [...valaszok.values()].filter((v) => v.kerdesIndex === kviz.aktualis);
}

function valaszSzamlalotFrissit() {
  if (kviz?.allapot !== ALLAPOTOK.KERDES) return;
  const beerkezett = aktualisValaszok().length;
  elem('kerdes-valaszoltak').textContent =
    `${beerkezett} / ${jatekosok.size} valaszolt`;

  // Ha mindenki valaszolt, nincs mire varni.
  if (jatekosok.size > 0 && beerkezett >= jatekosok.size) kerdestLezar();
}

// ------------------------------------------------------- kerdes kiosztasa

let lezarasFolyamatban = false;

async function kerdestKioszt(index) {
  clearInterval(visszaszamlaloOra);
  lezarasFolyamatban = false;
  try {
    await updateDoc(doc(db, `kvizek/${kvizId}`), {
      allapot: ALLAPOTOK.KERDES,
      aktualis: index,
      kerdes_indult: serverTimestamp(),
      utolso_eredmeny: null,
    });
  } catch (hiba) {
    uzenet('jatek-uzenet', magyarHiba(hiba));
  }
}

// ------------------------------------------------------------- JAVITAS
// Ez a rendszer szive: a tanari kliens osszehasonlitja a beerkezett valaszokat a
// megoldokulccsal, es pontoz. A diak kliense ehhez soha nem fer hozza.

async function kerdestLezar() {
  if (lezarasFolyamatban || kviz.allapot !== ALLAPOTOK.KERDES) return;
  lezarasFolyamatban = true;
  clearInterval(visszaszamlaloOra);

  const kerdes = kerdesek[kviz.aktualis];
  const kulcs = kulcsok.get(kerdes.id);
  const indultMs = kviz.kerdes_indult?.toMillis?.() ?? Date.now();

  const koteg = writeBatch(db);
  // Valaszlehetosegenkent szamolunk (tobbvalaszosnal egy diak tobb rekeszt is
  // novel), igy a tanari oszlopdiagram kozvetlenul kirajzolhato belole.
  const eloszlas = new Array(valaszLehetosegek(kerdes).length).fill(0);

  for (const jatekos of jatekosok.values()) {
    const valasz = valaszok.get(`${jatekos.uid}_${kviz.aktualis}`);
    const helyes = valasz ? valaszHelyes(kerdes, kulcs, valasz.valasz) : false;
    const reakcioMs = valasz?.kuldve?.toMillis?.()
      ? valasz.kuldve.toMillis() - indultMs
      : kviz.ido_limit * 1000;
    const pont = pontszam(helyes, reakcioMs, kviz.ido_limit);

    koteg.update(doc(db, `kvizek/${kvizId}/jatekosok/${jatekos.uid}`), {
      pont: increment(pont),
      helyes_db: increment(helyes ? 1 : 0),
      utolso_helyes: helyes,
      utolso_pont: pont,
      utolso_valasz_ms: valasz ? Math.max(0, reakcioMs) : null,
    });

    for (const index of megjeloltIndexek(kerdes, valasz?.valasz)) {
      if (index >= 0 && index < eloszlas.length) eloszlas[index]++;
    }
  }

  // A helyes valasz szovege ITT kerul be a kviz dokumentumaba - ez az egyetlen
  // pont, ahol a megoldas eljut a diakhoz, es csak a kerdes LEZARASA utan.
  koteg.update(doc(db, `kvizek/${kvizId}`), {
    allapot: ALLAPOTOK.EREDMENY,
    utolso_eredmeny: {
      kerdesIndex: kviz.aktualis,
      helyes_szoveg: helyesValaszSzovege(kerdes, kulcs),
      magyarazat: kulcs?.magyarazat || '',
      eloszlas,
      valaszoltak: aktualisValaszok().length,
    },
  });

  try {
    await koteg.commit();
  } catch (hiba) {
    lezarasFolyamatban = false;
    uzenet('jatek-uzenet', magyarHiba(hiba));
  }
}

function eredmenytMutat() {
  const kerdes = kerdesek[kviz.aktualis];
  elem('eredmeny-helyes').textContent = kviz.utolso_eredmeny?.helyes_szoveg || '';
  elem('eredmeny-magyarazat').textContent = kviz.utolso_eredmeny?.magyarazat || '';
  elem('jatek-kovetkezo').textContent =
    kviz.aktualis + 1 < kerdesek.length ? 'Kovetkezo kerdes' : 'Vegeredmeny';

  const doboz = elem('eredmeny-eloszlas');
  doboz.innerHTML = '';
  const eloszlas = kviz.utolso_eredmeny?.eloszlas || [];
  const osszes = Math.max(1, ...eloszlas);

  valaszLehetosegek(kerdes).forEach((szoveg, index) => {
    const db_ = eloszlas[index] || 0;
    const sor = document.createElement('div');
    sor.className = 'eloszlassor';
    sor.innerHTML = '<span class="cimke"></span><span class="rud"><i></i></span>' +
                    '<span class="ertek"></span>';
    sor.querySelector('.cimke').textContent = szoveg;
    sor.querySelector('.rud i').style.width = `${(db_ / osszes) * 100}%`;
    sor.querySelector('.ertek').textContent = db_;
    doboz.append(sor);
  });
}

// --------------------------------------------------------------- befejezes

async function kviztBefejez() {
  clearInterval(visszaszamlaloOra);
  const rendezett = [...jatekosok.values()].sort((a, b) => {
    if ((b.pont || 0) !== (a.pont || 0)) return (b.pont || 0) - (a.pont || 0);
    // Holtversenynel a gyorsabb reakcioido dont (terv 2. pont).
    return (a.utolso_valasz_ms ?? 1e9) - (b.utolso_valasz_ms ?? 1e9);
  });

  const koteg = writeBatch(db);
  rendezett.forEach((jatekos, index) => {
    koteg.update(doc(db, `kvizek/${kvizId}/jatekosok/${jatekos.uid}`), { helyezes: index + 1 });
  });
  koteg.update(doc(db, `kvizek/${kvizId}`), { allapot: ALLAPOTOK.VEGE, vege: serverTimestamp() });
  // A diakok innen tudjak meg, hogy nincs tobb futo kviz.
  koteg.update(doc(db, `osztalyok/${kviz.osztalyId}`), { aktiv_kviz: null });

  try {
    await koteg.commit();
  } catch (hiba) {
    uzenet('jatek-uzenet', magyarHiba(hiba));
  }
}

function vegeredmenytMutat() {
  const rendezett = [...jatekosok.values()].sort((a, b) => (a.helyezes || 99) - (b.helyezes || 99));
  const lista = elem('vege-lista');
  lista.innerHTML = '';
  rendezett.forEach((jatekos) => {
    const sor = document.createElement('div');
    sor.className = `jatekossor ${jatekos.helyezes <= 3 ? 'dobogo' : ''}`;
    sor.innerHTML = '<span class="helyezes"></span><span class="nev"></span>' +
                    '<span class="pont"></span>';
    sor.querySelector('.helyezes').textContent = `${jatekos.helyezes || '-'}.`;
    sor.querySelector('.nev').textContent = jatekos.becenev || jatekos.azonosito;
    sor.querySelector('.pont').textContent =
      `${jatekos.pont || 0} pont - ${jatekos.helyes_db || 0}/${kerdesek.length} jo`;
    lista.append(sor);
  });
}

export function figyelesekLeall() {
  clearInterval(visszaszamlaloOra);
  leiratkozok.forEach((leiratkozas) => leiratkozas());
  leiratkozok = [];
}
