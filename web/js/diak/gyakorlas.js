// Onallo gyakorlo mod.
//
// Itt a diak MAGA javit: a megoldokulcsot elolvassa. Ez csak azert lehetseges,
// mert a tanar az adott bankot (vagy fejezetet) kifejezetten felszabaditotta -
// a biztonsagi szabaly pontosan ezt ellenorzi. Elo kviz alatt a kulcs
// elerhetetlen, es a kvizosszeallito a felszabaditott kerdeseket ki is hagyja.
//
// A gyakorlas NEM er csillagot, es SZANDEKOSAN kulon dokumentumba (gyakorlas/)
// gyujti az eredmenyt - a csillagokat vezerlo statisztika/ kollekciohoz a diak
// nem nyulhat, kulonben otthon szerezhetne mesterfok-csillagot.

import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { auth, db } from '../firebase.js';
import {
  bankokListaja, diasortBetolt, bankKerdesei, kulcsokatBetolt, felszabaditasokBetolt,
  felszabaditott, sorsol,
} from '../kozos/kerdesbank.js';
import { valaszHelyes, helyesValaszSzovege } from '../kozos/kviz.js';
import { magyarHiba } from '../kozos/hibak.js';
import { elem, kepernyo, uzenet, gombbal } from '../kozos/ui.js';

let osztalyId = null;
let visszateres = null;

let bankok = [];
let felszabaditasok = new Map();
let szabadKerdesek = [];      // az eppen valasztott bank felszabaditott kerdesei
let diasor = null;

let sorozat = [];             // a kisorsolt kerdesek
let kulcsok = new Map();
let hol = 0;
let joDb = 0;
let valasztott = null;
let eredmenyek = [];          // kerdesenkent: eltalalta-e

export async function gyakorlastIndit(osztaly, visszaHivas) {
  osztalyId = osztaly;
  visszateres = visszaHivas;
  kotesek();
  nezetet('valaszto');
  kepernyo('gyakorlas');
  uzenet('gyak-uzenet', '');

  try {
    [bankok, felszabaditasok] = await Promise.all([bankokListaja(), felszabaditasokBetolt()]);
  } catch (hiba) {
    return uzenet('gyak-uzenet', magyarHiba(hiba));
  }

  const szabadBankok = bankok.filter((b) => {
    const f = felszabaditasok.get(b.kod);
    return f && (f.mind === true || (f.fejezetek || []).length > 0);
  });

  const legordulo = elem('gyak-bank');
  legordulo.innerHTML = '';
  if (!szabadBankok.length) {
    legordulo.innerHTML = '<option value="">(még nincs felszabadított anyag)</option>';
    elem('gyak-resz').innerHTML = '';
    return uzenet('gyak-uzenet',
      'A tanárod még nem szabadított fel anyagot gyakorlásra. Szólj neki!', 'info');
  }

  for (const bank of szabadBankok) {
    const sor = document.createElement('option');
    sor.value = bank.kod;
    sor.textContent = bank.cim;
    legordulo.append(sor);
  }
  await bankotValaszt(szabadBankok[0].kod);
}

function kotesek() {
  elem('gyak-bank').onchange = (e) => bankotValaszt(e.target.value);
  elem('gyak-resz').onchange = () => uzenet('gyak-uzenet', '');
  elem('gyak-inditas').onclick = sorozatotInditani;
  elem('gyak-kuldes').onclick = ellenoriz;
  elem('gyak-kovetkezo').onclick = kovetkezo;
  elem('gyak-ujra').onclick = () => { nezetet('valaszto'); uzenet('gyak-uzenet', ''); };
  elem('gyak-vissza').onclick = () => visszateres?.();
  elem('gyak-vege-vissza').onclick = () => visszateres?.();
}

function nezetet(melyik) {
  elem('gyak-valaszto').hidden = melyik !== 'valaszto';
  elem('gyak-jatek').hidden = melyik !== 'jatek';
  elem('gyak-vege').hidden = melyik !== 'vege';
}

async function bankotValaszt(bankKod) {
  const bank = bankok.find((b) => b.kod === bankKod);
  uzenet('gyak-uzenet', '');
  elem('gyak-resz').innerHTML = '<option value="">Betöltés…</option>';

  try {
    const [d, osszes] = await Promise.all([
      bank.diasor ? diasortBetolt(bank.diasor) : null,
      bankKerdesei(bankKod),
    ]);
    diasor = d;
    szabadKerdesek = osszes.filter((k) => felszabaditott(k, felszabaditasok));
  } catch (hiba) {
    return uzenet('gyak-uzenet', magyarHiba(hiba));
  }

  // A "resz" legordulo: eloszor minden, aztan fejezetek, vegul temakorok.
  const legordulo = elem('gyak-resz');
  legordulo.innerHTML = '';
  const opcio = (ertek, szoveg) => {
    const sor = document.createElement('option');
    sor.value = ertek;
    sor.textContent = szoveg;
    legordulo.append(sor);
  };
  opcio('mind', `A teljes felszabadított anyag (${szabadKerdesek.length} kérdés)`);

  const fejezetekben = new Map();
  const temakorokben = new Map();
  for (const kerdes of szabadKerdesek) {
    if (Number.isInteger(kerdes.fejezet)) {
      fejezetekben.set(kerdes.fejezet, (fejezetekben.get(kerdes.fejezet) || 0) + 1);
    }
    const tk = kerdes.temakor || '(egyeb)';
    temakorokben.set(tk, (temakorokben.get(tk) || 0) + 1);
  }
  for (const [index, db_] of [...fejezetekben].sort((a, b) => a[0] - b[0])) {
    const cim = diasor?.fejezetek?.[index]?.cim || `${index + 1}. fejezet`;
    opcio(`fejezet:${index}`, `${cim} (${db_})`);
  }
  for (const [tk, db_] of [...temakorokben].sort((a, b) => a[0].localeCompare(b[0], 'hu'))) {
    opcio(`temakor:${tk}`, `témakör: ${tk} (${db_})`);
  }
}

function reszSzerintSzur() {
  const ertek = elem('gyak-resz').value;
  if (!ertek || ertek === 'mind') return szabadKerdesek;
  const [tipus, kulcs] = ertek.split(':');
  if (tipus === 'fejezet') return szabadKerdesek.filter((k) => k.fejezet === Number(kulcs));
  return szabadKerdesek.filter((k) => (k.temakor || '(egyeb)') === kulcs);
}

async function sorozatotInditani(esemeny) {
  uzenet('gyak-uzenet', '');
  const jeloltek = reszSzerintSzur();
  if (!jeloltek.length) return uzenet('gyak-uzenet', 'Ehhez a részhez nincs kérdés.');

  await gombbal(esemeny.target, async () => {
    sorozat = sorsol(jeloltek, Number(elem('gyak-db').value) || 10);
    try {
      kulcsok = await kulcsokatBetolt(sorozat.map((k) => k.id));
    } catch (hiba) {
      return uzenet('gyak-uzenet', magyarHiba(hiba));
    }
    if (!kulcsok.size) {
      return uzenet('gyak-uzenet',
        'Ehhez az anyaghoz most nem tudom betölteni a megoldást. Szólj a tanárodnak.');
    }
    hol = 0;
    joDb = 0;
    eredmenyek = [];
    nezetet('jatek');
    kerdestMutat();
  });
}

// ------------------------------------------------------------------ kerdes

function kerdestMutat() {
  const kerdes = sorozat[hol];
  valasztott = kerdes.tipus === 'tobb_valasztos' ? [] : null;

  elem('gyak-sorszam').textContent = `${hol + 1}. / ${sorozat.length}`;
  elem('gyak-allas').textContent = `${joDb} jo`;
  elem('gyak-kerdes').textContent = kerdes.kerdes;
  elem('gyak-visszajelzes').hidden = true;
  elem('gyak-valaszok').hidden = false;
  elem('gyak-beviteli-mezo').innerHTML = '';
  elem('gyak-valaszok').innerHTML = '';

  // Az elo kvizben csak harom tipus megy, itt viszont mind az ot.
  if (kerdes.tipus === 'rovid_valasz') rovidValaszMezo();
  else if (kerdes.tipus === 'parosito') parositoMezok(kerdes);
  else valaszgombok(kerdes);

  const kellKuldoGomb = kerdes.tipus !== 'feleletvalasztos' && kerdes.tipus !== 'igaz_hamis';
  elem('gyak-kuldes').hidden = !kellKuldoGomb;
}

function valaszgombok(kerdes) {
  const doboz = elem('gyak-valaszok');
  const lehetosegek = kerdes.tipus === 'igaz_hamis' ? ['igaz', 'hamis'] : (kerdes.valaszok || []);

  lehetosegek.forEach((szoveg, index) => {
    const ertek = kerdes.tipus === 'igaz_hamis' ? szoveg : index;
    const gomb = document.createElement('button');
    gomb.type = 'button';
    gomb.className = `valaszgomb szin${index % 4}`;
    gomb.textContent = szoveg;
    gomb.onclick = () => {
      if (kerdes.tipus === 'tobb_valasztos') {
        valasztott = valasztott.includes(ertek)
          ? valasztott.filter((e) => e !== ertek)
          : [...valasztott, ertek].sort((a, b) => a - b);
        gomb.classList.toggle('bejelolt', valasztott.includes(ertek));
      } else {
        valasztott = kerdes.tipus === 'igaz_hamis' ? ertek : [ertek];
        ellenoriz();
      }
    };
    doboz.append(gomb);
  });
}

function rovidValaszMezo() {
  const mezo = document.createElement('input');
  mezo.id = 'gyak-rovid';
  mezo.placeholder = 'Írd be a választ';
  mezo.autocomplete = 'off';
  mezo.oninput = () => { valasztott = mezo.value; };
  mezo.onkeydown = (e) => { if (e.key === 'Enter') ellenoriz(); };
  elem('gyak-beviteli-mezo').append(mezo);
  setTimeout(() => mezo.focus(), 50);
}

function parositoMezok(kerdes) {
  const doboz = elem('gyak-beviteli-mezo');
  valasztott = kerdes.parok_bal.map((bal) => ({ bal, jobb: '' }));

  kerdes.parok_bal.forEach((bal, index) => {
    const cimke = document.createElement('label');
    cimke.textContent = bal;
    const legordulo = document.createElement('select');
    legordulo.innerHTML = '<option value="">– válassz –</option>';
    for (const jobb of kerdes.parok_jobb_kevert) {
      const sor = document.createElement('option');
      sor.value = jobb;
      sor.textContent = jobb;
      legordulo.append(sor);
    }
    legordulo.onchange = () => { valasztott[index].jobb = legordulo.value; };
    doboz.append(cimke, legordulo);
  });
}

// ---------------------------------------------------------------- javitas

function ellenoriz() {
  const kerdes = sorozat[hol];
  const ures = valasztott === null
    || (Array.isArray(valasztott) && !valasztott.length)
    || (typeof valasztott === 'string' && !valasztott.trim())
    || (kerdes.tipus === 'parosito' && valasztott.some((p) => !p.jobb));
  if (ures) return uzenet('gyak-uzenet', 'Válaszolj először!');

  uzenet('gyak-uzenet', '');
  const kulcs = kulcsok.get(kerdes.id);
  const helyes = valaszHelyes(kerdes, kulcs, valasztott);
  eredmenyek[hol] = helyes;
  if (helyes) joDb++;

  elem('gyak-valaszok').hidden = true;
  elem('gyak-kuldes').hidden = true;
  elem('gyak-visszajelzes').hidden = false;
  elem('gyak-visszajelzes').className = `lap kozepre ${helyes ? 'jolap' : 'rosszlap'}`;
  elem('gyak-jelzes').textContent = helyes ? 'Jó válasz!' : 'Nem talált';
  elem('gyak-helyes').textContent = helyesValaszSzovege(kerdes, kulcs);
  elem('gyak-magyarazat').textContent = kulcs?.magyarazat || '';
  elem('gyak-kovetkezo').textContent = hol + 1 < sorozat.length ? 'Következő' : 'Eredmény';
}

async function kovetkezo() {
  hol++;
  if (hol < sorozat.length) return kerdestMutat();

  const arany = sorozat.length ? joDb / sorozat.length : 0;
  elem('gyak-eredmeny').textContent = `${joDb} / ${sorozat.length}`;
  elem('gyak-osszegzes').textContent = arany >= 0.8
    ? 'Ez nagyon jó! Ezt a részt tudod.'
    : (arany >= 0.5 ? 'Nem rossz – még egy kör, és meglesz.'
                    : 'Ezt a részt érdemes átnézni a diasorban.');
  nezetet('vege');
  await eredmenytMent();
}

// A gyakorlas eredmenye a sajat gyakorlas/ dokumentumba megy. Csillagot nem er.
async function eredmenytMent() {
  const ut = `gyakorlas/${osztalyId}_${auth.currentUser.uid}`;
  try {
    const korabbi = (await getDoc(doc(db, ut))).data() || {};
    const temakorok = { ...(korabbi.temakorok || {}) };
    sorozat.forEach((kerdes, index) => {
      const tk = kerdes.temakor || '(egyeb)';
      if (!temakorok[tk]) temakorok[tk] = { jo: 0, ossz: 0 };
      temakorok[tk].ossz++;
      if (eredmenyek[index]) temakorok[tk].jo++;
    });

    await setDoc(doc(db, ut), {
      osztalyId,
      uid: auth.currentUser.uid,
      kerdes_db: (korabbi.kerdes_db || 0) + sorozat.length,
      jo_db: (korabbi.jo_db || 0) + joDb,
      korok: (korabbi.korok || 0) + 1,
      temakorok,
      utoljara: serverTimestamp(),
    });
  } catch (hiba) {
    // A gyakorlas eredmenye nem letfontossagu - ha nem ment el, ne alljon meg
    // miatta a diak, csak szoljunk.
    uzenet('gyak-uzenet', magyarHiba(hiba));
  }
}
