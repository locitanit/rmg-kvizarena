// A tanari pult vezerlese (1. fazis: belepes, osztalyok, tagok).

import { auth } from '../firebase.js';
import { konfigKitoltve } from '../firebase-config.js';
import {
  onAuthStateChanged, tanarBelepes, tanarOsztalyai, osztalyTagjai, kilepes, BelepesHiba,
} from '../auth.js';
import { magyarHiba } from '../kozos/hibak.js';
import { elem, kepernyo, uzenet, gombbal } from '../kozos/ui.js';

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

  onAuthStateChanged(auth, async (felhasznalo) => {
    if (!felhasznalo) {
      kepernyo('belepes');
      return;
    }
    // A tanari jogot a tanarBelepes() ellenorizte. Ha valaki diakkent lepett be
    // ezen az oldalon (kozos Auth munkamenet), a lekerdezes ures listat ad.
    await pultotMutat(felhasznalo);
  });
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

  osztalyok.forEach((osztaly, index) => {
    const gomb = document.createElement('button');
    gomb.className = 'osztalygomb';
    gomb.textContent = `${osztaly.nev || osztaly.id}  (${osztaly.tanev || ''})`;
    gomb.onclick = () => osztalytValaszt(index);
    lista.append(gomb);
  });

  osztalytValaszt(0);
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
