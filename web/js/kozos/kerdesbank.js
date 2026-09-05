// A publikalt kerdesbank olvasasa es a valogatas.
//
// A szures a BONGESZOBEN fut, nem lekerdezesben (terv 4.4/3): egy bank 120-240
// kerdes, azt egyetlen lekerdezessel behuzzuk, es utana memoriaban szurunk.
// Igy a talalatszamlalo azonnal frissul a csuszka mozgatasara, es nincs szukseg
// egyetlen osszetett Firestore-indexre sem.

import {
  collection, doc, getDoc, getDocs, query, where,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { db } from '../firebase.js';

// Az elo kvizben egyelore csak ez a harom tipus mehet (terv 13. pont).
// A parosito es a rovid valasz a gyakorlo modban mar hasznalhato.
export const ELO_KVIZ_TIPUSOK = ['feleletvalasztos', 'igaz_hamis', 'tobb_valasztos'];

export const TIPUS_NEVE = {
  feleletvalasztos: 'feleletvalasztos',
  igaz_hamis: 'igaz/hamis',
  tobb_valasztos: 'tobbvalaszos',
  parosito: 'parosito',
  rovid_valasz: 'rovid valasz',
};

const gyorsitotar = new Map();

export async function bankokListaja() {
  const pillanat = await getDocs(collection(db, 'bankok'));
  return pillanat.docs
    .map((d) => ({ kod: d.id, ...d.data() }))
    .sort((a, b) => (a.cim || a.kod).localeCompare(b.cim || b.kod, 'hu'));
}

export async function diasortBetolt(diasorKod) {
  if (!diasorKod) return null;
  const dok = await getDoc(doc(db, `diasorok/${diasorKod}`));
  return dok.exists() ? { kod: diasorKod, ...dok.data() } : null;
}

// Egy bank osszes kerdese. Egyszeru egyenloseg-lekerdezes: nem kell index hozza.
export async function bankKerdesei(bankKod) {
  if (gyorsitotar.has(bankKod)) return gyorsitotar.get(bankKod);
  const pillanat = await getDocs(
    query(collection(db, 'kerdesek'), where('bank', '==', bankKod))
  );
  const kerdesek = pillanat.docs.map((d) => ({ id: d.id, ...d.data() }));
  gyorsitotar.set(bankKod, kerdesek);
  return kerdesek;
}

// A megoldokulcsok - ezt CSAK a tanari kliens tudja beolvasni (biztonsagi szabaly).
export async function kulcsokatBetolt(idk) {
  const kulcsok = new Map();
  await Promise.all(idk.map(async (id) => {
    const dok = await getDoc(doc(db, `kulcsok/${id}`));
    if (dok.exists()) kulcsok.set(id, dok.data());
  }));
  return kulcsok;
}

// ---------------------------------------------------------------- valogatas

// valogatas = { mod: 'dia'|'fejezet'|'temakor', dia_tol, dia_ig,
//               fejezetek: [index], temakorok: [kod],
//               nehezseg_max: 1..3, csak_elo: true }
export function szur(kerdesek, valogatas) {
  return kerdesek.filter((k) => {
    if (k.nehezseg > (valogatas.nehezseg_max ?? 3)) return false;
    if (valogatas.csak_elo && !ELO_KVIZ_TIPUSOK.includes(k.tipus)) return false;

    switch (valogatas.mod) {
      case 'dia':
        // A dia nelkuli kerdesek nem eshetnek bele semmilyen tartomanyba.
        return Number.isInteger(k.dia)
          && k.dia >= valogatas.dia_tol && k.dia <= valogatas.dia_ig;
      case 'fejezet':
        return valogatas.fejezetek?.length
          ? valogatas.fejezetek.includes(k.fejezet)
          : false;
      case 'temakor':
        return valogatas.temakorok?.length
          ? valogatas.temakorok.includes(k.temakor)
          : false;
      default:
        return true;
    }
  });
}

// Veletlen kivalasztas. A sorrend is veletlen: igy ket egymas utani kvizben
// nem ugyanabban a sorrendben jonnek a kerdesek.
export function sorsol(kerdesek, darab) {
  const kevert = [...kerdesek];
  for (let i = kevert.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kevert[i], kevert[j]] = [kevert[j], kevert[i]];
  }
  return kevert.slice(0, Math.min(darab, kevert.length));
}

// A kulcs olvashato alakja az elonezethez.
export function helyesValaszSzovege(kerdes, kulcs) {
  if (!kulcs) return '(nincs kulcs)';
  switch (kerdes.tipus) {
    case 'feleletvalasztos':
    case 'tobb_valasztos':
      return kulcs.helyes.map((i) => kerdes.valaszok[i]).join(' + ');
    case 'igaz_hamis':
      return kulcs.helyes;
    case 'rovid_valasz':
      return kulcs.helyes.join(' / ');
    case 'parosito':
      return kulcs.helyes.map((p) => `${p.bal} - ${p.jobb}`).join(', ');
    default:
      return '?';
  }
}
