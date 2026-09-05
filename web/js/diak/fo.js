// A diak felulet vezerlese (1. fazis: belepes, regisztracio, fooldal).

import {
  doc, updateDoc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, db } from '../firebase.js';
import { konfigKitoltve } from '../firebase-config.js';
import {
  onAuthStateChanged, nyilvanosOsztalyok, diakBelepes, diakRegisztracio,
  diakOsztalya, kilepes, BelepesHiba,
} from '../auth.js';
import { magyarHiba } from '../kozos/hibak.js';
import { elem, kepernyo, uzenet, gombbal } from '../kozos/ui.js';
import { csatlakozas, visszateresHaBentVan, figyelesekLeall } from './jatek.js';

// Hany csillag kell egy otoshoz (terv 7. pont). Kesobb a tanar allitja.
const CSILLAG_AZ_OTOSIG = 5;

// Az utoljara valasztott osztaly, hogy a diaknak ne kelljen ujra kikeresnie.
const TAROLO_KULCS = 'icdl_utolso_osztaly';

let aktualisOsztalyId = null;
let aktualisTag = null;
let aktivKvizId = null;
let osztalyFigyelo = null;

if (!konfigKitoltve()) {
  kepernyo('nincs-konfig');
} else {
  indul();
}

function indul() {
  kotesek();

  onAuthStateChanged(auth, async (felhasznalo) => {
    if (!felhasznalo) {
      osztalyFigyelo?.();
      osztalyFigyelo = null;
      figyelesekLeall();
      await osztalylistatTolt();
      kepernyo('belepes');
      return;
    }
    await fooldaltMutat(felhasznalo.uid);
  });
}

function kotesek() {
  elem('valto-regisztraciora').onclick = () => kepernyo('regisztracio');
  elem('valto-belepesre').onclick = () => kepernyo('belepes');

  elem('belepes-urlap').onsubmit = async (esemeny) => {
    esemeny.preventDefault();
    uzenet('belepes-uzenet', '');
    const osztalyId = elem('belepes-osztaly').value;
    await gombbal(esemeny.submitter, async () => {
      try {
        await diakBelepes(osztalyId, elem('belepes-azonosito').value, elem('belepes-jelszo').value);
        localStorage.setItem(TAROLO_KULCS, osztalyId);
      } catch (hiba) {
        uzenet('belepes-uzenet', hiba instanceof BelepesHiba ? hiba.message : magyarHiba(hiba));
      }
    });
  };

  elem('regisztracio-urlap').onsubmit = async (esemeny) => {
    esemeny.preventDefault();
    uzenet('regisztracio-uzenet', '');
    await gombbal(esemeny.submitter, async () => {
      try {
        const osztalyId = await diakRegisztracio(
          elem('reg-kod').value, elem('reg-azonosito').value,
          elem('reg-jelszo').value, elem('reg-jelszo2').value, elem('reg-becenev').value
        );
        localStorage.setItem(TAROLO_KULCS, osztalyId);
        // Az onAuthStateChanged viszi tovabb a fooldalra.
      } catch (hiba) {
        uzenet('regisztracio-uzenet', hiba instanceof BelepesHiba ? hiba.message : magyarHiba(hiba));
      }
    });
  };

  elem('fo-becenev-mentes').onclick = becenevMentes;
  elem('fo-csatlakozas').onclick = csatlakozasGomb;
  elem('fo-kilepes').onclick = () => kilepes();
}

async function osztalylistatTolt() {
  const legordulo = elem('belepes-osztaly');
  try {
    const osztalyok = await nyilvanosOsztalyok();
    legordulo.innerHTML = '';
    if (!osztalyok.length) {
      legordulo.innerHTML = '<option value="">(meg nincs osztaly)</option>';
      uzenet('belepes-uzenet', 'Meg nincs egyetlen osztaly sem. Szolj a tanarodnak.');
      return;
    }
    for (const osztaly of osztalyok) {
      const sor = document.createElement('option');
      sor.value = osztaly.id;
      sor.textContent = osztaly.nev || osztaly.id;
      legordulo.append(sor);
    }
    const utolso = localStorage.getItem(TAROLO_KULCS);
    if (utolso && osztalyok.some((o) => o.id === utolso)) legordulo.value = utolso;
  } catch (hiba) {
    uzenet('belepes-uzenet', magyarHiba(hiba));
  }
}

async function fooldaltMutat(uid) {
  const talalat = await diakOsztalya(uid);

  if (!talalat) {
    // Van fiok, de nincs tagsagi dokumentum - felbeszakadt regisztracio.
    await kilepes();
    await osztalylistatTolt();
    kepernyo('belepes');
    uzenet('belepes-uzenet',
      'A fiokod megvan, de a regisztracio nem fejezodott be. Kezdd ujra a Regisztraciot.');
    return;
  }

  aktualisOsztalyId = talalat.osztalyId;
  aktualisTag = talalat.tag;
  const tag = talalat.tag;
  const hatralevo = Math.max(0, CSILLAG_AZ_OTOSIG - (tag.csillag_aktualis || 0));

  elem('fo-becenev').textContent = tag.becenev || tag.azonosito;
  elem('fo-osztaly').textContent = `${talalat.nev || talalat.osztalyId} - ${tag.azonosito}`;
  elem('fo-csillagsor').textContent =
    '★'.repeat(tag.csillag_aktualis || 0) + '☆'.repeat(hatralevo);
  elem('fo-csillagszam').textContent = `${tag.csillag_ossz || 0} csillag`;
  elem('fo-hatralevo').textContent = hatralevo === 0
    ? 'Megvan az otos! Szolj a tanarodnak.'
    : `Meg ${hatralevo} csillag az otosig.`;
  elem('fo-becenev-input').value = tag.becenev || '';

  uzenet('fo-uzenet', '');
  kepernyo('fooldal');
  futoKvizetFigyel();
}

// Az osztaly dokumentumanak "aktiv_kviz" mezojebol tudjuk meg, hogy fut-e kviz.
// Egyetlen dokumentum figyelese - ez fer bele a napi ingyenes keretbe.
function futoKvizetFigyel() {
  osztalyFigyelo?.();
  osztalyFigyelo = onSnapshot(doc(db, `osztalyok/${aktualisOsztalyId}`), async (pillanat) => {
    aktivKvizId = pillanat.exists() ? (pillanat.data().aktiv_kviz || null) : null;
    elem('fo-kviz-doboz').hidden = !aktivKvizId;
    uzenet('fo-kviz-uzenet', '');

    if (!aktivKvizId) return;
    elem('fo-kviz-cim').textContent = 'Az osztalyodban most fut egy kviz.';

    // Ha mar jatekos (pl. ujratoltotte az oldalt), tegyuk vissza a jatekba.
    try {
      await visszateresHaBentVan(aktivKvizId, fooldalraVissza);
    } catch (hiba) {
      console.error(hiba);
    }
  }, (hiba) => console.error(hiba));
}

function fooldalraVissza() {
  kepernyo('fooldal');
  if (auth.currentUser) fooldaltMutat(auth.currentUser.uid);
}

async function csatlakozasGomb(esemeny) {
  uzenet('fo-kviz-uzenet', '');
  if (!aktivKvizId) return uzenet('fo-kviz-uzenet', 'Most nem fut kviz.');

  await gombbal(esemeny.target, async () => {
    try {
      await csatlakozas(aktivKvizId, elem('fo-pin').value, aktualisTag, fooldalraVissza);
      elem('fo-pin').value = '';
    } catch (hiba) {
      uzenet('fo-kviz-uzenet', hiba.code ? magyarHiba(hiba) : hiba.message);
    }
  });
}

async function becenevMentes(esemeny) {
  const ujBecenev = elem('fo-becenev-input').value.trim();
  if (!ujBecenev) return uzenet('fo-uzenet', 'A becenev nem lehet ures.');
  if (ujBecenev.length > 20) return uzenet('fo-uzenet', 'A becenev legfeljebb 20 karakter lehet.');

  await gombbal(esemeny.target, async () => {
    try {
      await updateDoc(doc(db, `osztalyok/${aktualisOsztalyId}/tagok/${auth.currentUser.uid}`),
        { becenev: ujBecenev });
      elem('fo-becenev').textContent = ujBecenev;
      uzenet('fo-uzenet', 'Becenev mentve.', 'siker');
    } catch (hiba) {
      uzenet('fo-uzenet', magyarHiba(hiba));
    }
  });
}
