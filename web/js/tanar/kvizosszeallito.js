// Kviz osszeallitasa: bank -> valogatas -> elonezet.
//
// A szures memoriaban fut (a bank egyben be van toltve), ezert a talalatszamlalo
// azonnal frissul a csuszka mozgatasara. Lasd a terv 4.4/3 pontjat.

import {
  bankokListaja, diasortBetolt, bankKerdesei, kulcsokatBetolt, felszabaditasokBetolt,
  felszabaditott, szur, sorsol, helyesValaszSzovege, TIPUS_NEVE,
} from '../kozos/kerdesbank.js';
import { magyarHiba } from '../kozos/hibak.js';
import { elem, uzenet, gombbal } from '../kozos/ui.js';

let bankok = [];
let osztalyok = [];
let kviztIndit = null;      // a jatekvezetes inditasa (tanar/fo.js adja at)
let aktualisBank = null;
let aktualisDiasor = null;
let kerdesek = [];
let felszabaditasok = new Map();
let mod = 'dia';

export async function kvizosszeallitotIndit(tanarOsztalyai, inditoFuggveny) {
  osztalyok = tanarOsztalyai;
  kviztIndit = inditoFuggveny;
  kotesek();
  osztalylegordulotKitolt();
  try {
    [bankok, felszabaditasok] = await Promise.all([bankokListaja(), felszabaditasokBetolt()]);
  } catch (hiba) {
    return uzenet('kviz-uzenet', magyarHiba(hiba));
  }

  const legordulo = elem('kviz-bank');
  legordulo.innerHTML = '';
  if (!bankok.length) {
    legordulo.innerHTML = '<option value="">(még nincs publikált bank)</option>';
    uzenet('kviz-uzenet',
      'Még nincs publikált kérdésbank. Futtasd: node admin/rmg-admin.js publikal', 'info');
    return;
  }
  for (const bank of bankok) {
    const sor = document.createElement('option');
    sor.value = bank.kod;
    sor.textContent = `${bank.cim} (${bank.kerdes_db} kérdés)`;
    legordulo.append(sor);
  }
  await bankotValaszt(bankok[0].kod);
}

function kotesek() {
  elem('kviz-bank').onchange = (e) => bankotValaszt(e.target.value);

  document.querySelectorAll('.modgomb').forEach((gomb) => {
    gomb.onclick = () => {
      mod = gomb.dataset.mod;
      document.querySelectorAll('.modgomb').forEach((g) =>
        g.classList.toggle('kivalasztott', g === gomb));
      document.querySelectorAll('[data-mod-panel]').forEach((p) => {
        p.hidden = p.dataset.modPanel !== mod;
      });
      szamlalotFrissit();
    };
  });

  for (const azonosito of ['kviz-dia-tol', 'kviz-dia-ig', 'kviz-nehezseg',
                           'kviz-elo-tipusok', 'kviz-kihagy-felszabaditott', 'kviz-db']) {
    elem(azonosito).oninput = () => {
      if (azonosito.startsWith('kviz-dia')) csuszkatFrissit(azonosito);
      szamlalotFrissit();
    };
  }

  elem('kviz-elonezet').onclick = elonezet;
  elem('kviz-inditas').onclick = kviztInditaniGomb;
}

function osztalylegordulotKitolt() {
  const legordulo = elem('kviz-osztaly');
  legordulo.innerHTML = '';
  if (!osztalyok.length) {
    legordulo.innerHTML = '<option value="">(nincs osztályod)</option>';
    return;
  }
  for (const osztaly of osztalyok) {
    const sor = document.createElement('option');
    sor.value = osztaly.id;
    sor.textContent = osztaly.nev || osztaly.id;
    legordulo.append(sor);
  }
}

// A kviz elinditasa: kisorsoljuk a kerdeseket, es atadjuk a jatekvezetesnek.
async function kviztInditaniGomb(esemeny) {
  const { valogatas, talalatok } = szamlalotFrissit();
  uzenet('kviz-uzenet', '');

  const osztalyId = elem('kviz-osztaly').value;
  if (!osztalyId) return uzenet('kviz-uzenet', 'Válassz osztályt.');
  if (!talalatok.length) {
    return uzenet('kviz-uzenet', 'Nincs miből sorsolni. Bővítsd a tartományt vagy a nehézséget.');
  }

  await gombbal(esemeny.target, async () => {
    try {
      await kviztIndit({
        osztalyId,
        cim: kvizCime(valogatas),
        valogatas,
        kisorsolt: sorsol(talalatok, valogatas.db),
        idoLimit: valogatas.ido_limit,
      });
    } catch (hiba) {
      // A "mar fut egy kviz" a mi sajat, ertheto uzenetunk - azt ne forditsuk at.
      uzenet('kviz-uzenet', hiba.code ? magyarHiba(hiba) : hiba.message);
    }
  });
}

// Beszedes cim, hogy az archivumban is vissza lehessen keresni.
function kvizCime(valogatas) {
  const alap = aktualisBank.cim;
  if (valogatas.mod === 'dia') return `${alap} - ${valogatas.dia_tol}-${valogatas.dia_ig}. dia`;
  if (valogatas.mod === 'fejezet') {
    const cimek = valogatas.fejezetek
      .map((i) => aktualisDiasor?.fejezetek?.[i]?.cim)
      .filter(Boolean);
    return `${alap} - ${cimek.join(', ') || 'fejezetek'}`;
  }
  return `${alap} - ${valogatas.temakorok.join(', ') || 'temakorok'}`;
}

async function bankotValaszt(bankKod) {
  aktualisBank = bankok.find((b) => b.kod === bankKod);
  uzenet('kviz-uzenet', '');
  elem('kviz-elonezet-lap').hidden = true;
  elem('kviz-szamlalo').textContent = 'Betöltés…';

  try {
    [aktualisDiasor, kerdesek] = await Promise.all([
      diasortBetolt(aktualisBank.diasor),
      bankKerdesei(bankKod),
    ]);
  } catch (hiba) {
    elem('kviz-szamlalo').textContent = '';
    return uzenet('kviz-uzenet', magyarHiba(hiba));
  }

  // Figyelmeztetes: felszabaditott anyagbol a diak elo kviz alatt is
  // kiolvashatna a megoldokulcsot.
  const szabadDb = kerdesek.filter((k) => felszabaditott(k, felszabaditasok)).length;
  elem('kviz-felszabaditott-info').textContent = szabadDb
    ? `Ebből a bankból ${szabadDb} kérdés gyakorlásra fel van szabadítva – `
      + 'azoknál a diák látja a megoldást, ezért élő kvízbe nem valók.'
    : 'Ebből a bankból semmi nincs felszabadítva gyakorlásra.';

  elem('kviz-bank-info').textContent = aktualisDiasor
    ? `${aktualisDiasor.forras_pptx} – ${aktualisDiasor.szamozott_diaszam} számozott dia`
    : 'Ehhez a bankhoz nincs diasor – csak témakör szerint válogatható.';

  diaCsuszkatBeallit();
  fejezeteketKirak();
  temakorokKirak();

  // Diasor nelkul a dia- es fejezet-mod ertelmetlen: temakorre valtunk.
  const diaGomb = document.querySelector('.modgomb[data-mod="dia"]');
  const fejezetGomb = document.querySelector('.modgomb[data-mod="fejezet"]');
  diaGomb.disabled = fejezetGomb.disabled = !aktualisDiasor;
  if (!aktualisDiasor && mod !== 'temakor') {
    document.querySelector('.modgomb[data-mod="temakor"]').click();
  }

  szamlalotFrissit();
}

function diaCsuszkatBeallit() {
  const max = aktualisDiasor?.szamozott_diaszam || 1;
  for (const [azonosito, ertek] of [['kviz-dia-tol', 1], ['kviz-dia-ig', max]]) {
    const csuszka = elem(azonosito);
    csuszka.max = max;
    csuszka.value = ertek;
  }
  csuszkatFrissit('kviz-dia-ig');
}

// A ket csuszka nem mehet at egymason, es kiirjuk az adott dia cimet is -
// ettol lesz ertelme a "meddig jutottunk?" kerdesnek.
function csuszkatFrissit(melyik) {
  const tol = elem('kviz-dia-tol');
  const ig = elem('kviz-dia-ig');
  if (Number(tol.value) > Number(ig.value)) {
    if (melyik === 'kviz-dia-tol') ig.value = tol.value;
    else tol.value = ig.value;
  }
  elem('kviz-dia-tol-ertek').textContent = tol.value;
  elem('kviz-dia-ig-ertek').textContent = ig.value;

  const dia = (aktualisDiasor?.diak || []).find((d) => d.szamozott === Number(ig.value));
  elem('kviz-dia-cim').textContent = dia ? `${ig.value}. dia: ${dia.cim}` : '';
}

function fejezeteketKirak() {
  const doboz = elem('kviz-fejezetek');
  doboz.innerHTML = '';
  if (!aktualisDiasor) {
    doboz.innerHTML = '<p class="alcim">Ehhez a bankhoz nincs diasor.</p>';
    return;
  }
  aktualisDiasor.fejezetek.forEach((fejezet, index) => {
    const db = kerdesek.filter((k) => k.fejezet === index).length;
    doboz.append(pipa('fejezet', index, `${fejezet.cim}  (${fejezet.elso_dia}-${fejezet.utolso_dia})`, db));
  });
}

function temakorokKirak() {
  const doboz = elem('kviz-temakorok');
  doboz.innerHTML = '';
  for (const { kod, db } of aktualisBank.temakorok || []) {
    doboz.append(pipa('temakor', kod, kod, db));
  }
}

function pipa(csoport, ertek, cimke, db) {
  const sor = document.createElement('label');
  sor.className = 'pipa';
  sor.innerHTML =
    `<input type="checkbox" data-csoport="${csoport}" value="${ertek}">` +
    '<span></span><span class="db"></span>';
  // A fejezetcim a pptx-bol jon, es lehet benne < vagy & jel - ezert szovegkent.
  sor.querySelectorAll('span')[0].textContent = cimke;
  sor.querySelectorAll('span')[1].textContent = db;
  sor.querySelector('input').onchange = szamlalotFrissit;
  return sor;
}

function valogatastOsszeszed() {
  const bepipalt = (csoport) =>
    [...document.querySelectorAll(`input[data-csoport="${csoport}"]:checked`)]
      .map((be) => be.value);

  return {
    mod,
    dia_tol: Number(elem('kviz-dia-tol').value),
    dia_ig: Number(elem('kviz-dia-ig').value),
    fejezetek: bepipalt('fejezet').map(Number),
    temakorok: bepipalt('temakor'),
    nehezseg_max: Number(elem('kviz-nehezseg').value),
    csak_elo: elem('kviz-elo-tipusok').checked,
    kihagy_felszabaditott: elem('kviz-kihagy-felszabaditott').checked,
    felszabaditasok,
    db: Number(elem('kviz-db').value),
    ido_limit: Number(elem('kviz-ido').value),
  };
}

function szamlalotFrissit() {
  const valogatas = valogatastOsszeszed();
  const talalatok = szur(kerdesek, valogatas);
  const kisorsolt = Math.min(valogatas.db, talalatok.length);

  const szamlalo = elem('kviz-szamlalo');
  if (!talalatok.length) {
    szamlalo.className = 'szamlalo ures';
    szamlalo.textContent = mod === 'dia'
      ? 'Ebben a diatartományban nincs kérdés.'
      : 'Nincs kiválasztva semmi, vagy nincs rá kérdés.';
  } else {
    szamlalo.className = kisorsolt < valogatas.db ? 'szamlalo keves' : 'szamlalo';
    szamlalo.textContent = kisorsolt < valogatas.db
      ? `${talalatok.length} kérdés felel meg – ennyi lesz kisorsolva, mert kevesebb, mint ${valogatas.db}.`
      : `${talalatok.length} kérdés felel meg, ebből ${kisorsolt} lesz kisorsolva.`;
  }
  return { valogatas, talalatok };
}

async function elonezet(esemeny) {
  const { valogatas, talalatok } = szamlalotFrissit();
  uzenet('kviz-uzenet', '');

  if (!talalatok.length) {
    return uzenet('kviz-uzenet', 'Nincs miből sorsolni. Bővítsd a tartományt vagy a nehézséget.');
  }

  await gombbal(esemeny.target, async () => {
    const kisorsolt = sorsol(talalatok, valogatas.db);
    let kulcsok;
    try {
      kulcsok = await kulcsokatBetolt(kisorsolt.map((k) => k.id));
    } catch (hiba) {
      return uzenet('kviz-uzenet', magyarHiba(hiba));
    }

    elem('kviz-elonezet-cim').textContent =
      `Előnézet – ${kisorsolt.length} kérdés (${valogatas.ido_limit} mp / kérdés)`;

    const lista = elem('kviz-elonezet-lista');
    lista.innerHTML = '';
    kisorsolt.forEach((kerdes, index) => {
      const doboz = document.createElement('div');
      doboz.className = 'elonezetsor';
      doboz.innerHTML =
        `<div class="sorszam">${index + 1}.</div>` +
        `<div class="torzs">` +
          `<div class="kerdesszoveg"></div>` +
          `<div class="cimkesor">` +
            `<span class="jelolo">${TIPUS_NEVE[kerdes.tipus] || kerdes.tipus}</span>` +
            `<span class="jelolo">nehézség ${kerdes.nehezseg}</span>` +
            (Number.isInteger(kerdes.dia) ? `<span class="jelolo">${kerdes.dia}. dia</span>` : '') +
            `<span class="jelolo">${kerdes.temakor || ''}</span>` +
          `</div>` +
          `<div class="helyes"></div>` +
        `</div>`;
      // A kerdes es a valasz szovegkent megy be, hogy a bankban levo < > jelek
      // (pl. HTML-kerdesek) ne torjek el a felulet szerkezetet.
      doboz.querySelector('.kerdesszoveg').textContent = kerdes.kerdes;
      doboz.querySelector('.helyes').textContent =
        `Helyes: ${helyesValaszSzovege(kerdes, kulcsok.get(kerdes.id))}`;
      lista.append(doboz);
    });

    elem('kviz-elonezet-lap').hidden = false;
    elem('kviz-elonezet-lap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
