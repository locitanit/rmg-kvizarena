// A diak jatekfelulete.
//
// A diak kliense NEM javit es NEM pontoz - nem is tudna: a megoldokulcsot a
// biztonsagi szabaly elzarja elole. Csak a kviz dokumentumot figyeli, es amikor
// a tanar lezarja a kerdest, onnan olvassa ki a helyes valasz szoveget.

import {
  doc, collection, getDoc, setDoc, onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, db } from '../firebase.js';
import { ALLAPOTOK, hatralevoMasodperc } from '../kozos/kviz.js';
import { magyarHiba } from '../kozos/hibak.js';
import { elem, kepernyo, uzenet } from '../kozos/ui.js';

let kvizId = null;
let kviz = null;
let kerdes = null;
let sajatAdat = null;
let jatekosok = [];
let valasztott = null;      // amit a diak bejelolt, de meg nem kuldott el
let elkuldottIndex = -1;    // melyik kerdesre kuldott mar valaszt

let leiratkozok = [];
let visszaszamlaloOra = null;
let visszateres = null;

// ---------------------------------------------------------------- csatlakozas

export async function csatlakozas(kvizIdParam, pinBeirt, tag, visszaHivas) {
  const dok = await getDoc(doc(db, `kvizek/${kvizIdParam}`));
  if (!dok.exists()) throw new Error('Ez a kvíz már nem fut.');

  const adat = dok.data();
  if (pinBeirt && String(pinBeirt).trim() !== adat.pin) {
    throw new Error('Nem jó a kód. Nézd meg a kivetítőn!');
  }
  if (adat.allapot === ALLAPOTOK.VEGE) throw new Error('Ez a kvíz már véget ért.');

  // Ha mar bent van (pl. ujratoltotte az oldalt), nem irjuk felul a pontjait.
  const sajatUt = `kvizek/${kvizIdParam}/jatekosok/${auth.currentUser.uid}`;
  const meglevo = await getDoc(doc(db, sajatUt));
  if (!meglevo.exists()) {
    await setDoc(doc(db, sajatUt), {
      becenev: tag.becenev || tag.azonosito,
      azonosito: tag.azonosito,
      pont: 0,
      helyes_db: 0,
    });
  }

  await jatekotFigyel(kvizIdParam, visszaHivas);
}

async function jatekotFigyel(azonosito, visszaHivas) {
  kvizId = azonosito;
  visszateres = visszaHivas;
  figyelesekLeall();
  kotesek();
  kepernyo('jatek');

  leiratkozok.push(
    onSnapshot(doc(db, `kvizek/${kvizId}`), async (pillanat) => {
      if (!pillanat.exists()) return;
      const elozoIndex = kviz?.aktualis;
      const elozoAllapot = kviz?.allapot;
      kviz = { id: kvizId, ...pillanat.data() };

      if (kviz.allapot === ALLAPOTOK.KERDES
          && (kviz.aktualis !== elozoIndex || elozoAllapot !== ALLAPOTOK.KERDES)) {
        await kerdestBetolt();
      }
      nezetetFrissit();
    }, (hiba) => uzenet('jatek-uzenet', magyarHiba(hiba))),

    onSnapshot(collection(db, `kvizek/${kvizId}/jatekosok`), (pillanat) => {
      jatekosok = pillanat.docs.map((d) => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => (b.pont || 0) - (a.pont || 0));
      sajatAdat = jatekosok.find((j) => j.uid === auth.currentUser.uid) || null;

      // A ket figyelo kulon erkezik: a kviz allapota atvalthat "eredmeny"-re
      // ELOBB, mint ahogy a sajat pontszamunk befut. Ezert amikor a jatekos-adat
      // megjon, ujrarajzoljuk azokat a nezeteket, amelyek tole fuggnek -
      // kulonben a diak "0 pont"-ot latna a sajat 128 helyett.
      lobbitFrissit();
      allastFrissit();
      if (kviz?.allapot === ALLAPOTOK.EREDMENY) eredmenytMutat();
      if (kviz?.allapot === ALLAPOTOK.VEGE) vegeredmenytMutat();
    })
  );
}

function kotesek() {
  elem('jatek-kuldes').onclick = valasztKuld;
  elem('vege-vissza').onclick = () => { figyelesekLeall(); visszateres?.(); };
}

// -------------------------------------------------------------------- nezetek

function nezetetFrissit() {
  document.querySelectorAll('[data-kepernyo="jatek"] [data-jatek]').forEach((doboz) => {
    doboz.hidden = doboz.dataset.jatek !== kviz.allapot;
  });

  lobbitFrissit();

  if (kviz.allapot === ALLAPOTOK.KERDES) kerdestMutat();
  if (kviz.allapot === ALLAPOTOK.EREDMENY) eredmenytMutat();
  if (kviz.allapot === ALLAPOTOK.VEGE) vegeredmenytMutat();
}

function lobbitFrissit() {
  elem('varakozas-becenev').textContent = sajatAdat?.becenev || '';
  elem('varakozas-letszam').textContent =
    jatekosok.length === 1 ? '1 játékos' : `${jatekosok.length} játékos`;
}

async function kerdestBetolt() {
  const kerdesId = kviz.kerdesIdk[kviz.aktualis];
  const dok = await getDoc(doc(db, `kerdesek/${kerdesId}`));
  kerdes = { id: kerdesId, ...dok.data() };
  valasztott = kerdes.tipus === 'tobb_valasztos' ? [] : null;
}

function valaszLehetosegek() {
  if (kerdes.tipus === 'igaz_hamis') return ['igaz', 'hamis'];
  return kerdes.valaszok || [];
}

function kerdestMutat() {
  if (!kerdes) return;
  const mar = elkuldottIndex === kviz.aktualis;

  elem('jatek-sorszam').textContent = `${kviz.aktualis + 1}. / ${kviz.kerdesIdk.length}`;
  elem('jatek-kerdes').textContent = kerdes.kerdes;
  elem('jatek-elkuldve').hidden = !mar;
  elem('jatek-valaszok').hidden = mar;
  elem('jatek-kuldes').hidden = mar || kerdes.tipus !== 'tobb_valasztos';

  if (!mar) valaszgombokatKirak();
  visszaszamlalotIndit();
}

function valaszgombokatKirak() {
  const doboz = elem('jatek-valaszok');
  doboz.innerHTML = '';

  valaszLehetosegek().forEach((szoveg, index) => {
    const ertek = kerdes.tipus === 'igaz_hamis' ? szoveg : index;
    const gomb = document.createElement('button');
    gomb.type = 'button';
    gomb.className = `valaszgomb szin${index % 4}`;
    gomb.textContent = szoveg;

    gomb.onclick = () => {
      if (kerdes.tipus === 'tobb_valasztos') {
        // Tobbvalaszosnal gyujtunk, es kulon gombbal kuldunk.
        valasztott = valasztott.includes(ertek)
          ? valasztott.filter((e) => e !== ertek)
          : [...valasztott, ertek].sort((a, b) => a - b);
        gomb.classList.toggle('bejelolt', valasztott.includes(ertek));
      } else {
        valasztott = kerdes.tipus === 'igaz_hamis' ? ertek : [ertek];
        valasztKuld();
      }
    };
    doboz.append(gomb);
  });
}

function visszaszamlalotIndit() {
  clearInterval(visszaszamlaloOra);
  const indult = kviz.kerdes_indult?.toMillis?.();
  if (!indult) return;

  const lepes = () => {
    const hatra = hatralevoMasodperc(indult, kviz.ido_limit);
    elem('jatek-ido').textContent = `${hatra} mp`;
    elem('jatek-ido').classList.toggle('surgos', hatra <= 5);
  };
  lepes();
  visszaszamlaloOra = setInterval(lepes, 500);
}

// -------------------------------------------------------------- valaszkuldes

async function valasztKuld() {
  if (elkuldottIndex === kviz.aktualis) return;
  if (valasztott === null || (Array.isArray(valasztott) && !valasztott.length)) {
    return uzenet('jatek-uzenet', 'Válassz először!');
  }

  // Optimista kepernyovaltas: a diak azonnal lassa, hogy elment.
  const index = kviz.aktualis;
  elkuldottIndex = index;
  kerdestMutat();

  try {
    await setDoc(doc(db, `kvizek/${kvizId}/valaszok/${auth.currentUser.uid}_${index}`), {
      uid: auth.currentUser.uid,
      kerdesIndex: index,
      valasz: valasztott,
      // A reakcioidot a SZERVER oraja adja - a telefon oraja atallithato.
      kuldve: serverTimestamp(),
    });
    uzenet('jatek-uzenet', '');
  } catch (hiba) {
    // Ha nem ment at (pl. a tanar kozben lezarta), engedjuk ujra probalni.
    elkuldottIndex = -1;
    kerdestMutat();
    uzenet('jatek-uzenet', magyarHiba(hiba));
  }
}

// ------------------------------------------------------------------ eredmeny

function eredmenytMutat() {
  clearInterval(visszaszamlaloOra);
  const eredmeny = kviz.utolso_eredmeny;
  const helyes = sajatAdat?.utolso_helyes;

  elem('eredmeny-doboz').className = `lap kozepre ${helyes ? 'jolap' : 'rosszlap'}`;
  elem('eredmeny-jelzes').textContent = helyes === undefined
    ? '…' : (helyes ? 'Jó válasz!' : 'Nem talált');
  elem('eredmeny-pont').textContent = helyes
    ? `+${sajatAdat?.utolso_pont ?? 0} pont`
    : (elkuldottIndex === kviz.aktualis ? '0 pont' : 'Nem válaszoltál');

  elem('eredmeny-helyes-diak').textContent = eredmeny?.helyes_szoveg || '';
  elem('eredmeny-magyarazat-diak').textContent = eredmeny?.magyarazat || '';
  allastFrissit();
}

function allastFrissit() {
  if (!kviz) return;
  const sajatUid = auth.currentUser?.uid;

  for (const [azonosito, lista] of [['eredmeny-allas', jatekosok.slice(0, 5)],
                                    ['vege-lista-diak', jatekosok]]) {
    const doboz = elem(azonosito);
    if (!doboz) continue;
    doboz.innerHTML = '';
    lista.forEach((jatekos, index) => {
      const sor = document.createElement('div');
      sor.className = `jatekossor ${jatekos.uid === sajatUid ? 'sajat' : ''}`;
      sor.innerHTML = '<span class="helyezes"></span><span class="nev"></span>' +
                      '<span class="pont"></span>';
      sor.querySelector('.helyezes').textContent = `${jatekos.helyezes || index + 1}.`;
      sor.querySelector('.nev').textContent = jatekos.becenev || jatekos.azonosito;
      sor.querySelector('.pont').textContent = `${jatekos.pont || 0}`;
      doboz.append(sor);
    });
  }
}

function vegeredmenytMutat() {
  clearInterval(visszaszamlaloOra);
  const helyezes = sajatAdat?.helyezes;
  elem('vege-helyezes').textContent = helyezes ? `${helyezes}. helyezés` : 'Vége';
  elem('vege-pont').textContent = `${sajatAdat?.pont || 0} pont`;
  elem('vege-reszletek').textContent =
    `${sajatAdat?.helyes_db || 0} jó válasz ${kviz.kerdesIdk.length} kérdésből`;
  allastFrissit();
}

export function figyelesekLeall() {
  clearInterval(visszaszamlaloOra);
  leiratkozok.forEach((leiratkozas) => leiratkozas());
  leiratkozok = [];
  elkuldottIndex = -1;
}

// Ujranyitas utan: ha a diak mar jatekos ebben a kvizben, visszaultetjuk.
export async function visszateresHaBentVan(kvizIdParam, visszaHivas) {
  const dok = await getDoc(
    doc(db, `kvizek/${kvizIdParam}/jatekosok/${auth.currentUser.uid}`));
  if (!dok.exists()) return false;
  await jatekotFigyel(kvizIdParam, visszaHivas);
  return true;
}
