// Eredmenyek: kviz-archivum, egy kviz elemzese, osztalystatisztika, diaklap,
// csillagbeallitas. Minden nezetbol van CSV-letoltes.
//
// Az adat NEM itt keszul: a tanari kliens a kviz lezarasakor mar beirta a
// statisztika/ dokumentumokat es a kviz osszegzeset (terv 8.2). Itt csak
// olvasunk - igy egy lap megnyitasa nem szaz, hanem par tucat olvasas.

import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, query, where, increment,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { db } from '../firebase.js';
import { ALAP_BEALLITASOK } from '../kozos/csillag.js';
import { bankokListaja, diasortBetolt, felszabaditasokBetolt } from '../kozos/kerdesbank.js';
import { csvLetolt, szazalek, maiDatum, fajlnevre } from '../kozos/csv.js';
import { magyarHiba } from '../kozos/hibak.js';
import { elem, uzenet } from '../kozos/ui.js';

let osztalyok = [];
let osztalyId = null;
let kvizek = [];
let statok = [];
let tagok = [];
let valasztottKviz = null;
let valasztottDiak = null;
let beallitasok = { ...ALAP_BEALLITASOK };
let bankok = [];
let felszabaditasok = new Map();
let fszDiasor = null;

export async function eredmenyeketIndit(tanarOsztalyai) {
  osztalyok = tanarOsztalyai;
  kotesek();

  const legordulo = elem('er-osztaly');
  legordulo.innerHTML = '';
  for (const osztaly of osztalyok) {
    const sor = document.createElement('option');
    sor.value = osztaly.id;
    sor.textContent = osztaly.nev || osztaly.id;
    legordulo.append(sor);
  }

  await beallitasokatBetolt();
  await felszabaditastIndit();
  if (osztalyok.length) await osztalytValaszt(osztalyok[0].id);
}

// ------------------------------------------------- gyakorlasra szabaditas

async function felszabaditastIndit() {
  try {
    [bankok, felszabaditasok] = await Promise.all([bankokListaja(), felszabaditasokBetolt()]);
  } catch (hiba) {
    return uzenet('fsz-uzenet', magyarHiba(hiba));
  }

  const legordulo = elem('fsz-bank');
  legordulo.innerHTML = '';
  if (!bankok.length) {
    legordulo.innerHTML = '<option value="">(meg nincs publikalt bank)</option>';
    return;
  }
  for (const bank of bankok) {
    const f = felszabaditasok.get(bank.kod);
    const jeloles = f?.mind ? ' - EGESZBEN szabad'
      : (f?.fejezetek?.length ? ` - ${f.fejezetek.length} fejezet szabad` : '');
    const sor = document.createElement('option');
    sor.value = bank.kod;
    sor.textContent = `${bank.cim}${jeloles}`;
    legordulo.append(sor);
  }
  await fszBankotValaszt(bankok[0].kod);
}

async function fszBankotValaszt(bankKod) {
  const bank = bankok.find((b) => b.kod === bankKod);
  const meglevo = felszabaditasok.get(bankKod) || { mind: false, fejezetek: [] };
  elem('fsz-mind').checked = Boolean(meglevo.mind);
  uzenet('fsz-uzenet', '');

  const doboz = elem('fsz-fejezetek');
  doboz.innerHTML = '<p class="alcim">Betoltes...</p>';
  fszDiasor = bank?.diasor ? await diasortBetolt(bank.diasor) : null;

  doboz.innerHTML = '';
  if (!fszDiasor) {
    doboz.innerHTML = '<p class="alcim">Ehhez a bankhoz nincs diasor - '
      + 'csak az egesz bank szabadithato fel.</p>';
    return;
  }
  fszDiasor.fejezetek.forEach((fejezet, index) => {
    const sor = document.createElement('label');
    sor.className = 'pipa';
    sor.innerHTML = '<input type="checkbox" data-fsz-fejezet><span></span>';
    const be = sor.querySelector('input');
    be.value = index;
    be.checked = (meglevo.fejezetek || []).includes(index);
    sor.querySelector('span').textContent =
      `${fejezet.cim} (${fejezet.elso_dia}-${fejezet.utolso_dia}. dia)`;
    doboz.append(sor);
  });
}

async function felszabaditastMent() {
  const bankKod = elem('fsz-bank').value;
  if (!bankKod) return;

  const fejezetek = [...document.querySelectorAll('#fsz-fejezetek input:checked')]
    .map((be) => Number(be.value));
  const ujak = { mind: elem('fsz-mind').checked, fejezetek, frissitve: new Date() };

  try {
    await setDoc(doc(db, `felszabaditasok/${bankKod}`), ujak);
    felszabaditasok.set(bankKod, ujak);
    const mit = ujak.mind ? 'az egesz bank'
      : (fejezetek.length ? `${fejezetek.length} fejezet` : 'semmi');
    uzenet('fsz-uzenet',
      `Mentve: ${mit} szabad gyakorlasra. A diakok azonnal latjak.`, 'siker');
    await felszabaditastIndit();
  } catch (hiba) {
    uzenet('fsz-uzenet', magyarHiba(hiba));
  }
}

function kotesek() {
  elem('er-osztaly').onchange = (e) => osztalytValaszt(e.target.value);

  document.querySelectorAll('.alful').forEach((gomb) => {
    gomb.onclick = () => {
      document.querySelectorAll('.alful').forEach((g) =>
        g.classList.toggle('kivalasztott', g === gomb));
      document.querySelectorAll('[data-alpanel]').forEach((p) => {
        p.hidden = p.dataset.alpanel !== gomb.dataset.alful;
      });
    };
  });

  elem('cs-mentes').onclick = beallitasokatMent;
  elem('osztaly-csv').onclick = osztalyCsv;
  elem('elemzes-csv').onclick = elemzesCsv;
  elem('diaklap-csv').onclick = diaklapCsv;
  elem('diaklap-bevaltas').onclick = csillagotBevalt;
  elem('fsz-bank').onchange = (e) => fszBankotValaszt(e.target.value);
  elem('fsz-mentes').onclick = felszabaditastMent;
}

async function osztalytValaszt(id) {
  osztalyId = id;
  valasztottKviz = null;
  valasztottDiak = null;
  uzenet('osztaly-uzenet', '');
  uzenet('diaklap-uzenet', '');

  try {
    const [kvizPillanat, statPillanat, tagPillanat] = await Promise.all([
      getDocs(query(collection(db, 'kvizek'), where('osztalyId', '==', osztalyId))),
      getDocs(query(collection(db, 'statisztika'), where('osztalyId', '==', osztalyId))),
      getDocs(collection(db, `osztalyok/${osztalyId}/tagok`)),
    ]);
    // A rendezes itt tortenik, nem lekerdezesben - igy nem kell osszetett index.
    kvizek = kvizPillanat.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.indult?.toMillis?.() || 0) - (a.indult?.toMillis?.() || 0));
    statok = statPillanat.docs.map((d) => ({ id: d.id, ...d.data() }));
    tagok = tagPillanat.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (a.azonosito || '').localeCompare(b.azonosito || '', 'hu'));
  } catch (hiba) {
    return uzenet('osztaly-uzenet', magyarHiba(hiba));
  }

  archivumotKirak();
  osztalystatisztikatKirak();
  diakokatKirak();
}

// ------------------------------------------------------------- archivum

function archivumotKirak() {
  const lista = elem('archivum-lista');
  lista.innerHTML = '';
  const lefutott = kvizek.filter((k) => k.allapot === 'vege');

  if (!lefutott.length) {
    lista.innerHTML = '<p class="alcim">Meg nem futott le kviz ebben az osztalyban.</p>';
    return;
  }

  for (const kviz of lefutott) {
    const gomb = document.createElement('button');
    gomb.type = 'button';
    gomb.className = 'osztalygomb';
    const mikor = kviz.indult?.toDate?.();
    gomb.textContent = `${mikor ? mikor.toLocaleDateString('hu') : ''} - ${kviz.cim}`
      + ` (${kviz.osszegzes?.resztvevok ?? '?'} fo)`;
    gomb.onclick = () => kviztElemez(kviz);
    lista.append(gomb);
  }
}

async function kviztElemez(kviz) {
  valasztottKviz = kviz;
  document.querySelectorAll('#archivum-lista .osztalygomb').forEach((g) =>
    g.classList.toggle('kivalasztott', g.textContent.includes(kviz.cim)));

  const osszegzes = kviz.osszegzes || {};
  elem('elemzes-cim').textContent = kviz.cim;
  elem('elemzes-osszegzes').textContent =
    `${osszegzes.resztvevok ?? 0} resztvevo - atlag ${szazalek(osszegzes.atlag_szazalek)}%`
    + ` - ${osszegzes.kerdes_db ?? 0} kerdes`;

  // Kerdesenkenti helyes arany: a legrosszabbak elol, mert azok a tanulsagosak.
  const kerdesek = [...(osszegzes.kerdesenkent || [])]
    .map((k, index) => ({ ...k, sorszam: index + 1 }))
    .sort((a, b) => (a.jo / Math.max(1, a.ossz)) - (b.jo / Math.max(1, b.ossz)));

  const doboz = elem('elemzes-kerdesek');
  doboz.innerHTML = '';
  if (!kerdesek.length) {
    doboz.innerHTML = '<p class="alcim">Ehhez a kvizhez nincs osszegzes.</p>';
  }
  for (const kerdes of kerdesek) {
    const arany = kerdes.jo / Math.max(1, kerdes.ossz);
    const sor = document.createElement('div');
    sor.className = 'eloszlassor';
    sor.innerHTML = '<span class="cimke"></span><span class="rud"><i></i></span>'
                  + '<span class="ertek"></span>';
    sor.querySelector('.cimke').textContent = `${kerdes.sorszam}. ${kerdes.kerdes}`.slice(0, 70);
    sor.querySelector('.cimke').title = kerdes.kerdes;
    const rud = sor.querySelector('.rud i');
    rud.style.width = `${arany * 100}%`;
    if (arany < 0.4) rud.style.background = 'var(--rossz)';
    sor.querySelector('.ertek').textContent = `${Math.round(arany * 100)}%`;
    doboz.append(sor);
  }

  // Diakonkenti sorok a jatekosok alkollekciobol.
  const jatekosDoboz = elem('elemzes-diakok');
  jatekosDoboz.innerHTML = '<p class="alcim">Betoltes...</p>';
  try {
    const pillanat = await getDocs(collection(db, `kvizek/${kviz.id}/jatekosok`));
    const jatekosok = pillanat.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (a.helyezes || 99) - (b.helyezes || 99));
    valasztottKviz.jatekosok = jatekosok;

    jatekosDoboz.innerHTML = '';
    for (const jatekos of jatekosok) {
      const sor = document.createElement('div');
      sor.className = 'jatekossor';
      sor.innerHTML = '<span class="helyezes"></span><span class="nev"></span>'
                    + '<span class="pont"></span>';
      sor.querySelector('.helyezes').textContent = `${jatekos.helyezes || '-'}.`;
      sor.querySelector('.nev').textContent = jatekos.becenev || jatekos.azonosito;
      sor.querySelector('.pont').textContent =
        `${jatekos.pont || 0} p - ${Math.round((jatekos.szazalek || 0) * 100)}%`
        + (jatekos.csillag ? ` ${'★'.repeat(jatekos.csillag)}` : '');
      jatekosDoboz.append(sor);
    }
    elem('elemzes-csv').hidden = false;
  } catch (hiba) {
    jatekosDoboz.innerHTML = '';
    uzenet('osztaly-uzenet', magyarHiba(hiba));
  }
}

function elemzesCsv() {
  if (!valasztottKviz) return;
  const sorok = (valasztottKviz.jatekosok || []).map((j) => [
    j.helyezes, j.azonosito, j.becenev, j.pont, j.helyes_db,
    valasztottKviz.osszegzes?.kerdes_db, szazalek(j.szazalek), j.csillag || 0,
  ]);
  csvLetolt(
    `kviz_${fajlnevre(valasztottKviz.cim)}_${maiDatum()}`,
    ['helyezes', 'azonosito', 'becenev', 'pont', 'jo valasz', 'kerdes', 'szazalek', 'csillag'],
    sorok
  );
}

// ------------------------------------------------- osztalystatisztika

function temakorAtlagok() {
  const osszesites = new Map();
  for (const stat of statok) {
    for (const [temakor, adat] of Object.entries(stat.temakor_teljesitmeny || {})) {
      if (!osszesites.has(temakor)) osszesites.set(temakor, { jo: 0, ossz: 0 });
      osszesites.get(temakor).jo += adat.jo || 0;
      osszesites.get(temakor).ossz += adat.ossz || 0;
    }
  }
  return [...osszesites.entries()]
    .map(([temakor, adat]) => ({ temakor, ...adat, arany: adat.jo / Math.max(1, adat.ossz) }))
    .sort((a, b) => a.arany - b.arany);
}

function osztalystatisztikatKirak() {
  const doboz = elem('osztaly-temakorok');
  doboz.innerHTML = '';
  const atlagok = temakorAtlagok();

  if (!atlagok.length) {
    doboz.innerHTML = '<p class="alcim">Meg nincs adat - futtass le egy kvizt.</p>';
  }
  for (const { temakor, arany, ossz } of atlagok) {
    const sor = document.createElement('div');
    sor.className = 'eloszlassor';
    sor.innerHTML = '<span class="cimke"></span><span class="rud"><i></i></span>'
                  + '<span class="ertek"></span>';
    sor.querySelector('.cimke').textContent = temakor;
    const rud = sor.querySelector('.rud i');
    rud.style.width = `${arany * 100}%`;
    if (arany < 0.5) rud.style.background = 'var(--rossz)';
    sor.querySelector('.ertek').textContent = `${Math.round(arany * 100)}%`;
    sor.title = `${ossz} megvalaszolt kerdes`;
    doboz.append(sor);
  }

  const csillagDoboz = elem('osztaly-csillagok');
  csillagDoboz.innerHTML = '';
  const rendezett = [...tagok].sort((a, b) => (b.csillag_ossz || 0) - (a.csillag_ossz || 0));
  if (!rendezett.length) {
    csillagDoboz.innerHTML = '<p class="alcim">Meg nincs tag.</p>';
  }
  for (const tag of rendezett) {
    const sor = document.createElement('div');
    sor.className = 'jatekossor';
    sor.innerHTML = '<span class="nev"></span><span class="pont"></span>';
    sor.querySelector('.nev').textContent = `${tag.becenev || tag.azonosito}`;
    sor.querySelector('.pont').textContent =
      `${'★'.repeat(Math.min(tag.csillag_ossz || 0, 10))} ${tag.csillag_ossz || 0}`
      + ` (valthato: ${tag.csillag_aktualis || 0}, jegy: ${tag.jegyek || 0})`;
    csillagDoboz.append(sor);
  }
}

function osztalyCsv() {
  const atlagok = temakorAtlagok();
  const sorok = [
    ...atlagok.map((t) => ['temakor', t.temakor, t.jo, t.ossz, szazalek(t.arany), '', '']),
    ...tagok.map((t) => ['diak', t.azonosito, '', '', '', t.csillag_ossz || 0, t.jegyek || 0]),
  ];
  csvLetolt(
    `osztaly_${fajlnevre(osztalyId)}_${maiDatum()}`,
    ['sortipus', 'nev', 'jo', 'ossz', 'szazalek', 'csillag_ossz', 'jegyek'],
    sorok
  );
}

// ---------------------------------------------------------------- diakok

function diakokatKirak() {
  const lista = elem('diakok-lista');
  lista.innerHTML = '';
  if (!tagok.length) {
    lista.innerHTML = '<p class="alcim">Meg senki nem regisztralt.</p>';
    return;
  }
  for (const tag of tagok) {
    const gomb = document.createElement('button');
    gomb.type = 'button';
    gomb.className = 'osztalygomb';
    gomb.textContent = `${tag.azonosito} - ${tag.becenev || ''} (${tag.csillag_ossz || 0} csillag)`;
    gomb.onclick = () => diakotMutat(tag);
    lista.append(gomb);
  }
}

function diakotMutat(tag) {
  valasztottDiak = tag;
  document.querySelectorAll('#diakok-lista .osztalygomb').forEach((g) =>
    g.classList.toggle('kivalasztott', g.textContent.startsWith(`${tag.azonosito} `)));

  const stat = statok.find((s) => s.uid === tag.uid);
  elem('diaklap-cim').textContent = `${tag.becenev || tag.azonosito} (${tag.azonosito})`;
  elem('diaklap-osszegzes').textContent =
    `${stat?.kvizek_szama || 0} kviz - szemelyes csucs ${szazalek(stat?.szemelyes_csucs)}%`
    + ` - ${tag.csillag_ossz || 0} csillag osszesen, ${tag.csillag_aktualis || 0} bevaltatlan`
    + ` - ${tag.jegyek || 0} otos`;

  const temakorDoboz = elem('diaklap-temakorok');
  temakorDoboz.innerHTML = '';
  const temakorok = Object.entries(stat?.temakor_teljesitmeny || {})
    .map(([temakor, adat]) => ({ temakor, ...adat, arany: adat.jo / Math.max(1, adat.ossz) }))
    .sort((a, b) => a.arany - b.arany);

  if (!temakorok.length) temakorDoboz.innerHTML = '<p class="alcim">Meg nincs adat.</p>';
  for (const t of temakorok) {
    const mester = (stat?.mesterfok || []).includes(t.temakor) ? ' ★' : '';
    const sor = document.createElement('div');
    sor.className = 'eloszlassor';
    sor.innerHTML = '<span class="cimke"></span><span class="rud"><i></i></span>'
                  + '<span class="ertek"></span>';
    sor.querySelector('.cimke').textContent = t.temakor + mester;
    sor.querySelector('.rud i').style.width = `${t.arany * 100}%`;
    sor.querySelector('.ertek').textContent = `${Math.round(t.arany * 100)}%`;
    temakorDoboz.append(sor);
  }

  const csillagDoboz = elem('diaklap-csillagok');
  csillagDoboz.innerHTML = '';
  const naplo = [...(stat?.csillag_naplo || [])].reverse();
  if (!naplo.length) csillagDoboz.innerHTML = '<p class="alcim">Meg nincs csillag.</p>';
  for (const bejegyzes of naplo) {
    const forrasok = [
      bejegyzes.dobogo ? `dobogo ${bejegyzes.dobogo}` : null,
      bejegyzes.csucs ? 'csucs 1' : null,
      bejegyzes.mesterfok ? `mesterfok ${bejegyzes.mesterfok}` : null,
      bejegyzes.kitartas ? 'kitartas 1' : null,
    ].filter(Boolean).join(', ') || 'nem kapott';
    const sor = document.createElement('div');
    sor.className = 'jatekossor';
    sor.innerHTML = '<span class="nev"></span><span class="pont"></span>';
    sor.querySelector('.nev').textContent = `${bejegyzes.cim || ''} (${bejegyzes.helyezes}. hely)`;
    sor.querySelector('.pont').textContent = `${bejegyzes.csillag} ★ - ${forrasok}`;
    csillagDoboz.append(sor);
  }

  elem('diaklap-csv').hidden = false;
  elem('diaklap-bevaltas').hidden = (tag.csillag_aktualis || 0) < beallitasok.jegy_kuszob;
  uzenet('diaklap-uzenet', '');
}

// A bevaltas: a szamlalo nullazodik (pontosabban a kuszobbel csokken), a diak
// pedig kap egy otost. Az osszes valaha szerzett csillag NEM valtozik.
async function csillagotBevalt() {
  if (!valasztottDiak) return;
  const kuszob = beallitasok.jegy_kuszob;
  if ((valasztottDiak.csillag_aktualis || 0) < kuszob) return;

  try {
    await updateDoc(doc(db, `osztalyok/${osztalyId}/tagok/${valasztottDiak.uid}`), {
      csillag_aktualis: increment(-kuszob),
      jegyek: increment(1),
    });
    valasztottDiak.csillag_aktualis -= kuszob;
    valasztottDiak.jegyek = (valasztottDiak.jegyek || 0) + 1;
    diakotMutat(valasztottDiak);
    diakokatKirak();
    osztalystatisztikatKirak();
    uzenet('diaklap-uzenet',
      `Bevaltva: ${kuszob} csillag -> egy otos. Ird be az osztalynaploba!`, 'siker');
  } catch (hiba) {
    uzenet('diaklap-uzenet', magyarHiba(hiba));
  }
}

function diaklapCsv() {
  if (!valasztottDiak) return;
  const stat = statok.find((s) => s.uid === valasztottDiak.uid);
  const sorok = [
    ...Object.entries(stat?.temakor_teljesitmeny || {}).map(([temakor, adat]) =>
      ['temakor', temakor, adat.jo, adat.ossz, szazalek(adat.jo / Math.max(1, adat.ossz)), '']),
    ...(stat?.csillag_naplo || []).map((b) =>
      ['kviz', b.cim, b.helyezes, '', szazalek(b.szazalek), b.csillag]),
  ];
  csvLetolt(
    `diak_${fajlnevre(valasztottDiak.azonosito)}_${maiDatum()}`,
    ['sortipus', 'nev', 'jo/helyezes', 'ossz', 'szazalek', 'csillag'],
    sorok
  );
}

// -------------------------------------------------------- csillagbeallitas

const SZAM_MEZOK = ['csucs_min_kviz', 'mesterfok_min_kerdes', 'kitartas_gyakorisag',
                    'kviz_max_csillag', 'jegy_kuszob'];
const PIPA_MEZOK = ['dobogo_be', 'csucs_be', 'csucs_dontetlen_is', 'mesterfok_be', 'kitartas_be'];

async function beallitasokatBetolt() {
  try {
    const dok = await getDoc(doc(db, 'beallitasok/csillagok'));
    beallitasok = { ...ALAP_BEALLITASOK, ...(dok.exists() ? dok.data() : {}) };
  } catch {
    beallitasok = { ...ALAP_BEALLITASOK };
  }
  for (const mezo of PIPA_MEZOK) elem(`cs-${mezo}`).checked = Boolean(beallitasok[mezo]);
  for (const mezo of SZAM_MEZOK) elem(`cs-${mezo}`).value = beallitasok[mezo];
  elem('cs-dobogo_ertekek').value = (beallitasok.dobogo_ertekek || []).join(',');
  elem('cs-mesterfok_kuszob').value = Math.round(beallitasok.mesterfok_kuszob * 100);
}

async function beallitasokatMent() {
  const ujak = { ...beallitasok };
  for (const mezo of PIPA_MEZOK) ujak[mezo] = elem(`cs-${mezo}`).checked;
  for (const mezo of SZAM_MEZOK) ujak[mezo] = Number(elem(`cs-${mezo}`).value);

  // Az ures darabokat ELOBB dobjuk el: Number('') nullat ad, es abbol csendben
  // "az elso helyezett 0 csillagot kap" lenne.
  const dobogoDarabok = elem('cs-dobogo_ertekek').value
    .split(',').map((e) => e.trim()).filter((e) => e !== '');
  ujak.dobogo_ertekek = dobogoDarabok.map(Number);
  ujak.mesterfok_kuszob = Number(elem('cs-mesterfok_kuszob').value) / 100;

  if (!ujak.dobogo_ertekek.length
      || ujak.dobogo_ertekek.some((e) => !Number.isInteger(e) || e < 0)) {
    return uzenet('cs-uzenet',
      'A dobogos csillagokat vesszovel elvalasztott egesz szamokkal add meg, pl. 3,2,1');
  }
  if (!(ujak.mesterfok_kuszob > 0 && ujak.mesterfok_kuszob <= 1)) {
    return uzenet('cs-uzenet', 'A mesterfok kuszob 1 es 100 kozott legyen.');
  }
  if (!(ujak.jegy_kuszob >= 1)) {
    return uzenet('cs-uzenet', 'Az otoshoz legalabb 1 csillag kelljen.');
  }

  try {
    await setDoc(doc(db, 'beallitasok/csillagok'), ujak);
    beallitasok = ujak;
    uzenet('cs-uzenet', 'Mentve. A kovetkezo kviztol ervenyes.', 'siker');
  } catch (hiba) {
    uzenet('cs-uzenet', magyarHiba(hiba));
  }
}
