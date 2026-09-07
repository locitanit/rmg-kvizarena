// A kvizbazis YAML-bankjainak beolvasasa es atalakitasa a Firestore alakjara.
//
// Ket dolgot csinal, amit sehol máshol nem szabad:
//   1. KETTEVAGJA a kerdest: publikus resz -> kerdesek/, megoldokulcs -> kulcsok/.
//      A helyes valasz a "publikus" objektumba SOHA nem kerulhet bele.
//   2. KISZAMOLJA a fejezetet a dia + diarend alapjan. A fejezetet nem taroljuk a
//      kvizbazisban (az duplikacio lenne) - egy igazsag van: a pptx.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename, dirname, extname, resolve, sep } from 'node:path';
import { parse as yamlBeolvas } from 'yaml';
import { KonfigHiba } from './config.js';

// Ez marad ki: a kifejtos kerdes gepileg nem javithato.
// (A kepes kerdes a 6. fazis A resze ota felmegy, beagyazott keppel.)
const KIHAGYOTT_TIPUSOK = new Set(['kifejtos']);

// ------------------------------------------------------------------- kepek
//
// A kep BEAGYAZVA megy a kerdesek/{id} dokumentumba, data URI-kent (6. fazis
// terv, A/1): nincs uj tarhely es nincs uj biztonsagi szabaly - a kep ugyanazzal
// az olvasasi joggal jon, mint a kerdesszoveg. Cserebe a Firestore 1 MiB-os
// dokumentumkorlatja miatt meretkorlat kell.
const KEP_MAX_BAJT = 200 * 1024;
const KEP_FIGYELMEZTETES_BAJT = 60 * 1024;
const KEP_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

// A kvizbazis "kep" mezoje -> beagyazott kep a publikus dokumentumba.
// A fajl a bank YAML-jenek mappajahoz kepest relativ: <kvizbazis>/<tema>/kepek/x.png.
// Visszaad: { kep } vagy { hiba }. A { kep } mellett lehet { figyelmeztetes }.
export function kepetBeagyaz(kep, bank) {
  if (!kep.fajl || typeof kep.fajl !== 'string') return { hiba: 'a képnek nincs "fajl" mezője' };
  if (!kep.felirat || typeof kep.felirat !== 'string') {
    return { hiba: `a képnek nincs "felirat" mezője: ${kep.fajl}` };
  }

  const mappa = bank.mappa || dirname(bank.ut || '');
  const ut = resolve(mappa, kep.fajl);
  // Utvonal-vedelem: a kep nem mutathat ki a bank mappajabol ("..").
  if (ut !== resolve(mappa) && !ut.startsWith(resolve(mappa) + sep)) {
    return { hiba: `a kép útvonala kimutat a témamappából: ${kep.fajl}` };
  }
  if (!existsSync(ut)) return { hiba: `a kép nem található: ${kep.fajl}` };

  const kiterjesztes = extname(ut).toLowerCase();
  const mime = KEP_MIME[kiterjesztes];
  if (!mime) {
    return { hiba: `ismeretlen képformátum (${kiterjesztes || 'nincs kiterjesztés'}): ${kep.fajl}` };
  }

  const meret = statSync(ut).size;
  if (meret > KEP_MAX_BAJT) {
    return {
      hiba: `a kép ${Math.round(meret / 1024)} KB, a határ 200 KB – kicsinyítsd: ${kep.fajl}`,
    };
  }

  const szelesseg = Number.isInteger(kep.szelesseg) && kep.szelesseg >= 1 && kep.szelesseg <= 100
    ? kep.szelesseg : 100;

  const eredmeny = {
    kep: {
      adat: `data:${mime};base64,${readFileSync(ut).toString('base64')}`,
      felirat: kep.felirat,
      szelesseg,
      mime,
      meret,
    },
  };
  if (meret > KEP_FIGYELMEZTETES_BAJT) {
    eredmeny.figyelmeztetes = `${kep.fajl}: ${Math.round(meret / 1024)} KB – nagy, de felmegy`;
  }
  return eredmeny;
}

export const ELO_KVIZ_TIPUSOK = ['feleletvalasztos', 'igaz_hamis', 'tobb_valasztos'];

// ---------------------------------------------------------------- diarendek

// A diarend fajlokat a pptx fajlneve koti a bankokhoz: a bank "forras_ppt"
// mezojenek fajlneve = a diarend "forras_pptx" mezoje.
export function diarendekBetolt(diarendUt) {
  if (!existsSync(diarendUt)) {
    throw new KonfigHiba(
      `Nem találom a diarend mappát:\n  ${diarendUt}\n\n` +
      `  Ellenőrizd a config.json "diarend_ut" mezőjét.`
    );
  }

  const pptxSzerint = new Map();
  const kodSzerint = new Map();

  for (const fajl of readdirSync(diarendUt)) {
    if (!fajl.endsWith('.json')) continue;
    if (fajl.startsWith('dia_terkep') || fajl.startsWith('dia_keresztterkep')) continue;

    const adat = JSON.parse(readFileSync(join(diarendUt, fajl), 'utf8'));
    if (!Array.isArray(adat.diak)) continue;

    const kod = adat.kod || fajl.replace(/\.json$/, '');
    kodSzerint.set(kod, adat);
    if (adat.forras_pptx) pptxSzerint.set(adat.forras_pptx, kod);
  }

  if (!kodSzerint.size) {
    throw new KonfigHiba(`A diarend mappában nincs egyetlen használható .json sem:\n  ${diarendUt}`);
  }
  return { pptxSzerint, kodSzerint };
}

// A diasor Firestore-alakja. A "diak" listabol csak a szamozott diak kellenek
// (azokra hivatkozik a kvizbazis es a tanari csuszka).
export function diasorDokumentum(adat) {
  return {
    tema: adat.tema || null,
    forras_pptx: adat.forras_pptx || null,
    verzio: adat.verzio || null,
    fizikai_diaszam: adat.fizikai_diaszam || 0,
    szamozott_diaszam: adat.szamozott_diaszam || 0,
    fejezetek: (adat.fejezetek || []).map((f) => ({
      szam: f.szam, cim: f.cim, elso_dia: f.elso_dia, utolso_dia: f.utolso_dia,
    })),
    diak: (adat.diak || [])
      .filter((d) => Number.isInteger(d.szamozott))
      .map((d) => ({ szamozott: d.szamozott, cim: d.cim || '' })),
  };
}

// dia (SZAMOZOTT) -> a fejezet SORSZAMA a diasor "fejezetek" tombjeben (0-tol).
//
// FIGYELEM: nem a fejezet sajat "szam" mezoje! Az nem egyedi: a szamozatlan
// nyitoszakasz (pl. "BEVEZETES") is szam=1-et kap, igy utkozik az 1. fejezettel,
// es a fejezetszamok ugranak is (11 utan 13). A tombindex viszont egyertelmu,
// es a megjelenitendo cimet a diasor dokumentumabol ugyanezzel az indexszel
// lehet kiolvasni.
export function fejezetFeloldo(diarendAdat) {
  const fejezetek = diarendAdat?.fejezetek || [];
  return (dia) => {
    if (!Number.isInteger(dia) || dia <= 0) return null;
    const index = fejezetek.findIndex(
      (f) => Number.isInteger(f.elso_dia) && Number.isInteger(f.utolso_dia)
        && dia >= f.elso_dia && dia <= f.utolso_dia
    );
    return index >= 0 ? index : null;
  };
}

// ------------------------------------------------------------------- bankok

export function bankokBetolt(kvizbazisUt) {
  if (!existsSync(kvizbazisUt)) {
    throw new KonfigHiba(
      `Nem találom a kvízbázist:\n  ${kvizbazisUt}\n\n` +
      `  Ellenőrizd a config.json "kvizbazis_ut" mezőjét.`
    );
  }

  const bankok = [];
  for (const temaMappa of readdirSync(kvizbazisUt, { withFileTypes: true })) {
    // A darabfajlok es a mentesek nem bankok, csak forrasok.
    if (!temaMappa.isDirectory() || temaMappa.name.startsWith('_')) continue;

    const temaUt = join(kvizbazisUt, temaMappa.name);
    for (const fajl of readdirSync(temaUt)) {
      if (!fajl.endsWith('.yaml') || fajl.startsWith('_')) continue;

      const adat = yamlBeolvas(readFileSync(join(temaUt, fajl), 'utf8'));
      // A darabfajlok listat tartalmaznak, nem bank-fejlecet - azokat kihagyjuk.
      if (!adat || typeof adat !== 'object' || !Array.isArray(adat.kerdesek)) continue;

      bankok.push({
        kod: fajl.replace(/\.yaml$/, ''),
        ut: join(temaUt, fajl),
        mappa: temaUt,           // a kepek ehhez kepest relativak
        fejlec: adat,
        kerdesek: adat.kerdesek,
      });
    }
  }

  if (!bankok.length) {
    throw new KonfigHiba(`A kvízbázisban nincs egyetlen bank sem:\n  ${kvizbazisUt}`);
  }
  return bankok.sort((a, b) => a.kod.localeCompare(b.kod));
}

// ------------------------------------------------------------- atalakitas

const hasit = (szoveg) => createHash('sha1').update(szoveg, 'utf8').digest('hex');

// A kerdes azonositoja a KERDESSZOVEG hash-e - nem a sorszama. A bankokat
// szkriptek allitjak elo, igy a sorrend barmikor eltolodhat; sorszam alapu
// azonositonal ujrapublikalaskor gyakorlatilag minden kerdes kicserelodne.
const kerdesAzonosito = (bankKod, kerdesSzoveg) =>
  `${bankKod}_${hasit(kerdesSzoveg.trim().replace(/\s+/g, ' ')).slice(0, 12)}`;

// Determinisztikus kevereses: ugyanabbol a magbol mindig ugyanaz a sorrend,
// kulonben minden publikalas ujrairna az osszes parosito kerdest.
function keverDeterminisztikusan(elemek, mag) {
  const kevert = [...elemek];
  let allapot = parseInt(hasit(mag).slice(0, 8), 16) || 1;
  const kovetkezo = () => (allapot = (allapot * 1103515245 + 12345) % 2147483648);
  for (let i = kevert.length - 1; i > 0; i--) {
    const j = kovetkezo() % (i + 1);
    [kevert[i], kevert[j]] = [kevert[j], kevert[i]];
  }
  return kevert;
}

// Egy kerdes -> { id, publikus, kulcs, hash } vagy { hiba } / { kihagyva }.
export function kerdestAtalakit(kerdes, bank, diarendAdat, fejezetet) {
  const tipus = kerdes.tipus;
  if (KIHAGYOTT_TIPUSOK.has(tipus)) return { kihagyva: 'kifejtos' };
  if (!kerdes.kerdes || typeof kerdes.kerdes !== 'string') {
    return { hiba: 'nincs kérdésszöveg' };
  }

  const id = kerdesAzonosito(bank.kod, kerdes.kerdes);
  const dia = Number.isInteger(kerdes.dia) && kerdes.dia > 0 ? kerdes.dia : null;

  const publikus = {
    bank: bank.kod,
    diasor: diarendAdat?.kod || null,
    tema: bank.fejlec.tema || null,
    temakor: kerdes.temakor || null,
    fejezet: fejezetet(dia),   // a fejezetek tomb INDEXE, nem a fejezet szama
    dia,
    dia_verzio: diarendAdat?.verzio || null,
    tipus,
    kerdes: kerdes.kerdes,
    nehezseg: Number.isInteger(kerdes.nehezseg) ? kerdes.nehezseg : 2,
    cimkek: Array.isArray(kerdes.cimkek) ? kerdes.cimkek : [],
  };
  const kulcs = { magyarazat: kerdes.magyarazat || '' };

  // A kep a PUBLIKUS resz - igy a hash is fedi: ha a tanar kicsereli a PNG-t,
  // a kovetkezo publikalas modosultkent irja ujra.
  let kepFigyelmeztetes = null;
  if (kerdes.kep) {
    const beagyazott = kepetBeagyaz(kerdes.kep, bank);
    if (beagyazott.hiba) return { hiba: beagyazott.hiba };
    publikus.kep = beagyazott.kep;
    kepFigyelmeztetes = beagyazott.figyelmeztetes || null;
  }

  switch (tipus) {
    case 'feleletvalasztos': {
      if (!Array.isArray(kerdes.valaszok) || kerdes.valaszok.length < 2) {
        return { hiba: 'nincs elég válaszlehetőség' };
      }
      if (!Number.isInteger(kerdes.helyes)
          || kerdes.helyes < 0 || kerdes.helyes >= kerdes.valaszok.length) {
        return { hiba: `a "helyes" index (${kerdes.helyes}) nincs a válaszok között` };
      }
      publikus.valaszok = kerdes.valaszok.map(String);
      kulcs.helyes = [kerdes.helyes];
      break;
    }
    case 'tobb_valasztos': {
      if (!Array.isArray(kerdes.valaszok) || kerdes.valaszok.length < 2) {
        return { hiba: 'nincs elég válaszlehetőség' };
      }
      const helyesek = Array.isArray(kerdes.helyes) ? kerdes.helyes : [kerdes.helyes];
      if (!helyesek.length
          || helyesek.some((h) => !Number.isInteger(h) || h < 0 || h >= kerdes.valaszok.length)) {
        return { hiba: 'a "helyes" indexek között van érvénytelen' };
      }
      publikus.valaszok = kerdes.valaszok.map(String);
      kulcs.helyes = [...helyesek].sort((a, b) => a - b);
      break;
    }
    case 'igaz_hamis': {
      const ertek = String(kerdes.helyes).toLowerCase();
      // A YAML "igaz"/"hamis" szoveget ad, de a true/false is elofordulhat.
      const igaz = ertek === 'igaz' || ertek === 'true';
      const hamis = ertek === 'hamis' || ertek === 'false';
      if (!igaz && !hamis) return { hiba: `a "helyes" nem igaz/hamis: ${kerdes.helyes}` };
      kulcs.helyes = igaz ? 'igaz' : 'hamis';
      break;
    }
    case 'rovid_valasz': {
      const valaszok = Array.isArray(kerdes.helyes) ? kerdes.helyes : [kerdes.helyes];
      if (!valaszok.length || valaszok.some((v) => !v)) return { hiba: 'nincs elfogadható válasz' };
      kulcs.helyes = valaszok.map(String);
      break;
    }
    case 'parosito': {
      if (!Array.isArray(kerdes.parok) || kerdes.parok.length < 2) {
        return { hiba: 'nincs elég pár' };
      }
      const parok = kerdes.parok.map((p) => ({ bal: String(p.bal), jobb: String(p.jobb) }));
      publikus.parok_bal = parok.map((p) => p.bal);
      publikus.parok_jobb_kevert = keverDeterminisztikusan(parok.map((p) => p.jobb), id);
      kulcs.helyes = parok;
      break;
    }
    default:
      return { hiba: `ismeretlen típus: ${tipus}` };
  }

  // A hash a TELJES tartalmat fedi (publikus + kulcs), hogy a magyarazat vagy a
  // helyes valasz javitasa is ujrairast valtson ki.
  const hash = hasit(JSON.stringify([publikus, kulcs])).slice(0, 16);
  return { id, publikus, kulcs, hash, kepFigyelmeztetes };
}

// Egy bank teljes feldolgozasa.
export function bankotFeldolgoz(bank, diarendAdat) {
  const fejezetet = fejezetFeloldo(diarendAdat);
  const kerdesek = new Map();
  const hibak = [];
  const kihagyva = { kifejtos: 0, kepes: 0 };
  const ismetlodo = [];
  const kepek = { db: 0, osszBajt: 0, figyelmeztetesek: [] };

  for (const [index, nyers] of bank.kerdesek.entries()) {
    const eredmeny = kerdestAtalakit(nyers, bank, diarendAdat, fejezetet);

    if (eredmeny.kihagyva) { kihagyva[eredmeny.kihagyva]++; continue; }
    if (eredmeny.hiba) {
      hibak.push(`${bank.kod} #${index + 1}: ${eredmeny.hiba}`);
      continue;
    }
    // Azonos kerdesszoveg ketszer a bankban - jelezzuk, es csak az elsot vesszuk.
    if (kerdesek.has(eredmeny.id)) {
      ismetlodo.push(`${bank.kod} #${index + 1}: "${nyers.kerdes.slice(0, 60)}..."`);
      continue;
    }
    kerdesek.set(eredmeny.id, eredmeny);

    if (eredmeny.publikus.kep) {
      kepek.db++;
      kepek.osszBajt += eredmeny.publikus.kep.meret;
      if (eredmeny.kepFigyelmeztetes) {
        kepek.figyelmeztetesek.push(`${bank.kod} #${index + 1}: ${eredmeny.kepFigyelmeztetes}`);
      }
    }
  }

  const temakorSzamlalo = new Map();
  for (const { publikus } of kerdesek.values()) {
    const kod = publikus.temakor || '(nincs)';
    temakorSzamlalo.set(kod, (temakorSzamlalo.get(kod) || 0) + 1);
  }

  return {
    kerdesek,
    hibak,
    kihagyva,
    kepek,
    ismetlodo,
    bankDokumentum: {
      cim: bank.fejlec.tananyag || bank.kod,
      tema: bank.fejlec.tema || null,
      diasor: diarendAdat?.kod || null,
      forras_ppt: bank.fejlec.forras_ppt || null,
      kerdes_db: kerdesek.size,
      temakorok: [...temakorSzamlalo.entries()]
        .map(([kod, db]) => ({ kod, db }))
        .sort((a, b) => a.kod.localeCompare(b.kod, 'hu')),
      hashok: Object.fromEntries([...kerdesek].map(([id, e]) => [id, e.hash])),
    },
  };
}

// A bank forras_ppt mezojebol a diarend kodja.
export function bankDiasora(bank, diarendek) {
  const pptx = basename(bank.fejlec.forras_ppt || '');
  if (!pptx) return null;
  const kod = diarendek.pptxSzerint.get(pptx);
  return kod ? { ...diarendek.kodSzerint.get(kod), kod } : null;
}
