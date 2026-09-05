// A csillagrendszer (terv 7. pont).
//
// Negy forrasbol lehet csillagot szerezni, es MIND A NEGY kulon kikapcsolhato,
// az ertekek pedig atirhatok a tanari feluleten - kodot nem kell modositani.
//
// Miert nem tiszta dobogos a rendszer: 15 fos csoportban ugyanaz az 5-6 gyerek
// forogna a dobogon, a tobbieknek fel ev alatt nulla csillaguk lenne. Igy viszont
// a leggyengebb diak is osszeszed egy otost, ha vegig ott van es javul.

export const ALAP_BEALLITASOK = {
  dobogo_be: true,
  dobogo_ertekek: [3, 2, 1],      // 1., 2., 3. helyezes
  csucs_be: true,
  csucs_dontetlen_is: true,       // a csucs ELERESE is er csillagot, nem csak a dontese
  csucs_min_kviz: 3,              // legalabb ennyi korabbi kviz utan
  mesterfok_be: true,
  mesterfok_kuszob: 0.80,
  mesterfok_min_kerdes: 8,
  kitartas_be: true,
  kitartas_gyakorisag: 5,         // minden 5. kvizert 1 csillag
  kviz_max_csillag: 4,
  jegy_kuszob: 5,                 // ennyi csillag = egy orai munka otos
};

// Temakoronkenti osszesites egy kviz utan: a korabbi allashoz hozzaadjuk az uj
// kviz eredmenyeit. { <temakor>: {jo, ossz} }
export function temakoroketOsszead(korabbi, ujKviz) {
  const eredmeny = {};
  for (const [temakor, adat] of Object.entries(korabbi || {})) {
    eredmeny[temakor] = { jo: adat.jo || 0, ossz: adat.ossz || 0 };
  }
  for (const [temakor, adat] of Object.entries(ujKviz || {})) {
    if (!eredmeny[temakor]) eredmeny[temakor] = { jo: 0, ossz: 0 };
    eredmeny[temakor].jo += adat.jo || 0;
    eredmeny[temakor].ossz += adat.ossz || 0;
  }
  return eredmeny;
}

// Melyik temakorokben ert el a diak mesterfokot - azokat kiveve, amiket MAR
// megkapott korabban (temakoronkent egyszer jar).
export function ujMesterfokok(temakorTeljesitmeny, mar, beallitasok) {
  const b = { ...ALAP_BEALLITASOK, ...beallitasok };
  if (!b.mesterfok_be) return [];

  return Object.entries(temakorTeljesitmeny || {})
    .filter(([temakor, adat]) =>
      !(mar || []).includes(temakor)
      && adat.ossz >= b.mesterfok_min_kerdes
      && adat.jo / adat.ossz >= b.mesterfok_kuszob)
    .map(([temakor]) => temakor)
    .sort();
}

// Egy diak csillagai EGY kviz utan.
//
//   jatekos          { helyezes, helyes_db }
//   kerdesSzam       hany kerdes volt a kvizben
//   korabbiStat      { szemelyes_csucs, kvizek_szama, mesterfok: [...] } - a kviz ELOTT
//   ujTemakorAllas   a kviz UTANI osszesitett temakor-teljesitmeny
export function csillagokatSzamol(
  { jatekos, kerdesSzam, korabbiStat, ujTemakorAllas, beallitasok }
) {
  const b = { ...ALAP_BEALLITASOK, ...beallitasok };
  const szazalek = kerdesSzam > 0 ? (jatekos.helyes_db || 0) / kerdesSzam : 0;
  const korabbiCsucs = korabbiStat?.szemelyes_csucs ?? 0;
  const korabbiKvizek = korabbiStat?.kvizek_szama ?? 0;
  const kvizekSzamaMost = korabbiKvizek + 1;

  const reszletek = [];

  // 1. Dobogo
  let dobogo = 0;
  if (b.dobogo_be && jatekos.helyezes >= 1 && jatekos.helyezes <= b.dobogo_ertekek.length) {
    dobogo = b.dobogo_ertekek[jatekos.helyezes - 1] || 0;
    if (dobogo) reszletek.push({ forras: 'dobogo', csillag: dobogo, mire: `${jatekos.helyezes}. helyezés` });
  }

  // 2. Szemelyes csucs. Az ELERES is szamit (>=), kulonben aki egyszer 100%-ot
  // ert el, soha tobbe nem kaphatna csucs-csillagot.
  let csucs = 0;
  if (b.csucs_be && korabbiKvizek >= b.csucs_min_kviz) {
    const megvan = b.csucs_dontetlen_is ? szazalek >= korabbiCsucs : szazalek > korabbiCsucs;
    if (megvan && szazalek > 0) {
      csucs = 1;
      reszletek.push({
        forras: 'csucs', csillag: 1,
        mire: `${Math.round(szazalek * 100)}% (eddigi legjobb: ${Math.round(korabbiCsucs * 100)}%)`,
      });
    }
  }

  // 3. Mesterfok - temakoronkent egyszer
  const mesterfokok = ujMesterfokok(ujTemakorAllas, korabbiStat?.mesterfok, b);
  const mesterfok = mesterfokok.length;
  for (const temakor of mesterfokok) {
    reszletek.push({ forras: 'mesterfok', csillag: 1, mire: temakor });
  }

  // 4. Kitartas - a puszta reszvetelert, minden N. kvizen
  let kitartas = 0;
  if (b.kitartas_be && b.kitartas_gyakorisag > 0
      && kvizekSzamaMost % b.kitartas_gyakorisag === 0) {
    kitartas = 1;
    reszletek.push({ forras: 'kitartas', csillag: 1, mire: `${kvizekSzamaMost}. kvíz` });
  }

  const nyers = dobogo + csucs + mesterfok + kitartas;
  const ossz = Math.min(nyers, b.kviz_max_csillag);

  return {
    dobogo, csucs, mesterfok, kitartas,
    nyers, ossz,
    levagva: nyers > b.kviz_max_csillag,
    ujMesterfokok: mesterfokok,
    szazalek,
    ujCsucs: Math.max(korabbiCsucs, szazalek),
    kvizekSzama: kvizekSzamaMost,
    reszletek,
  };
}

// Hany csillag kell meg a kovetkezo otoshoz.
export function otosigHatra(csillagAktualis, beallitasok) {
  const kuszob = { ...ALAP_BEALLITASOK, ...beallitasok }.jegy_kuszob;
  return Math.max(0, kuszob - (csillagAktualis || 0));
}
