// A tanari pult vezerlese (1. fazis: belepes, osztalyok, tagok).

import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, db } from '../firebase.js';
import { konfigKitoltve } from '../firebase-config.js';
import {
  onAuthStateChanged, tanarBelepes, tanarOsztalyai, osztalyTagjai, kilepes, BelepesHiba,
} from '../auth.js';
import { magyarHiba } from '../kozos/hibak.js';
import { elem, kepernyo, uzenet, gombbal, nevelo } from '../kozos/ui.js';
import { kvizosszeallitotIndit } from './kvizosszeallito.js';
import {
  kviztInditani, futoKvizt, jatekvezetestIndit, figyelesekLeall,
} from './jatekvezetes.js';

let osztalyok = [];

if (!konfigKitoltve()) {
  kepernyo('nincs-konfig');
} else {
  indul();
}

function indul() {
  elem('belepes-urlap').onsubmit = async (esemeny) => {
    esemeny.preventDefault();
    uzenet('belepes-uzenet', '');
    await gombbal(esemeny.submitter, async () => {
      try {
        await tanarBelepes(elem('belepes-email').value, elem('belepes-jelszo').value);
      } catch (hiba) {
        uzenet('belepes-uzenet', hiba instanceof BelepesHiba ? hiba.message : magyarHiba(hiba));
      }
    });
  };

  elem('pult-kilepes').onclick = () => kilepes();
  fuleketBeallit();

  onAuthStateChanged(auth, async (felhasznalo) => {
    if (!felhasznalo) {
      figyelesekLeall();
      kepernyo('belepes');
      return;
    }
    // Ugyanabban a bongeszoben a diak- es a tanari oldal EGY Auth munkamenetet
    // hasznal. Ha tehat valaki diakkent lepett be a masik fulon, itt is o lesz a
    // bejelentkezett felhasznalo - ilyenkor ertheto uzenetet adunk, nem
    // "nincs jogosultsagod" hibat a felulet melyerol.
    if (!(await tanariJoga(felhasznalo.uid))) {
      figyelesekLeall();
      kepernyo('belepes');
      uzenet('belepes-uzenet',
        `${felhasznalo.email} nem tanari fiok. Ha ugyanebben a bongeszoben diakkent `
        + 'is beleptel, az kilepteti a tanart - hasznalj masik bongeszot vagy inkognito ablakot.');
      return;
    }
    await pultotMutat(felhasznalo);
  });
}

// A ket ful kozotti valtas. A kvizosszeallitot csak az elso megnyitaskor
// toltjuk be, hogy a bejelentkezes ne varjon a kerdesbankra.
let kvizFulKesz = false;

function fuleketBeallit() {
  document.querySelectorAll('.ful').forEach((gomb) => {
    gomb.onclick = async () => {
      document.querySelectorAll('.ful').forEach((g) =>
        g.classList.toggle('kivalasztott', g === gomb));
      document.querySelectorAll('[data-panel]').forEach((p) => {
        p.hidden = p.dataset.panel !== gomb.dataset.ful;
      });
      if (gomb.dataset.ful === 'kviz' && !kvizFulKesz) {
        kvizFulKesz = true;
        await kvizosszeallitotIndit(osztalyok, kviztInditaniEsVezetni);
      }
    };
  });
}

async function tanariJoga(uid) {
  try {
    return (await getDoc(doc(db, `tanarok/${uid}`))).exists();
  } catch {
    return false;
  }
}

async function pultotMutat(felhasznalo) {
  elem('pult-nev').textContent = felhasznalo.displayName || 'Tanari pult';
  elem('pult-email').textContent = felhasznalo.email;
  kepernyo('pult');

  try {
    osztalyok = await tanarOsztalyai(felhasznalo.uid);
  } catch (hiba) {
    uzenet('pult-uzenet', magyarHiba(hiba));
    return;
  }

  const lista = elem('osztalylista');
  lista.innerHTML = '';

  if (!osztalyok.length) {
    lista.innerHTML = '<p class="alcim">Meg nincs osztalyod.</p>';
    return;
  }

  // Terv 6.4: ha a tanari ful bezarult egy kviz kozben, az allapot a Firestore-ban
  // maradt - felajanljuk a folytatast, mert a diakok addig varakoznak.
  const futo = await futoKvizt(osztalyok);
  if (futo) folytatastFelajanl(futo);

  osztalyok.forEach((osztaly, index) => {
    const gomb = document.createElement('button');
    gomb.className = 'osztalygomb';
    gomb.textContent = `${osztaly.nev || osztaly.id}  (${osztaly.tanev || ''})`;
    gomb.onclick = () => osztalytValaszt(index);
    lista.append(gomb);
  });

  osztalytValaszt(0);
}

function folytatastFelajanl(futo) {
  elem('folytatas-szoveg').textContent =
    `A(z) "${futo.cim}" kviz (${futo.osztalyNev}) ${nevelo(futo.aktualis + 1)} ` +
    `${futo.aktualis + 1}. kerdesnel tart. ` +
    'A diakok addig varakoznak.';
  elem('folytatas-igen').onclick = () => jatekvezetestIndit(futo.id, pultraVissza);
  elem('folytatas-nem').onclick = async () => {
    // Nem toroljuk a kvizt, csak lezarjuk - az eredmenye igy megmarad.
    await jatekvezetestIndit(futo.id, pultraVissza);
    elem('jatek-megszakitas').click();
  };
  kepernyo('folytatas');
}

async function kviztInditaniEsVezetni(beallitasok) {
  const ujId = await kviztInditani(beallitasok);
  await jatekvezetestIndit(ujId, pultraVissza);
}

function pultraVissza() {
  figyelesekLeall();
  kepernyo('pult');
  if (auth.currentUser) pultotMutat(auth.currentUser);
}

async function osztalytValaszt(index) {
  const osztaly = osztalyok[index];
  document.querySelectorAll('.osztalygomb').forEach((gomb, i) => {
    gomb.classList.toggle('kivalasztott', i === index);
  });

  elem('tagok-cim').textContent = `${osztaly.nev || osztaly.id} - tagok`;
  elem('tagok-kod').innerHTML =
    `Belepokod a diakoknak: <span class="kod">${osztaly.belepokod || '-'}</span>`;
  elem('tagoklista').innerHTML = '<p class="alcim">Betoltes...</p>';
  uzenet('pult-uzenet', '');

  try {
    const tagok = await osztalyTagjai(osztaly.id);
    if (!tagok.length) {
      elem('tagoklista').innerHTML =
        '<p class="alcim">Meg senki nem regisztralt ezzel a koddal.</p>';
      return;
    }

    const tabla = document.createElement('table');
    tabla.innerHTML =
      '<thead><tr><th>azonosito</th><th>becenev</th><th>csillag</th><th>jegyek</th></tr></thead>';
    const torzs = document.createElement('tbody');
    for (const tag of tagok) {
      const sor = document.createElement('tr');
      for (const ertek of [tag.azonosito, tag.becenev, tag.csillag_ossz ?? 0, tag.jegyek ?? 0]) {
        const cella = document.createElement('td');
        cella.textContent = ertek;
        sor.append(cella);
      }
      torzs.append(sor);
    }
    tabla.append(torzs);
    elem('tagoklista').replaceChildren(tabla);
  } catch (hiba) {
    elem('tagoklista').innerHTML = '';
    uzenet('pult-uzenet', magyarHiba(hiba));
  }
}
