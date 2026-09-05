// Az elo kviz kozos logikaja: allapotok, javitas, pontozas.
//
// A JAVITAS KIZAROLAG A TANARI KLIENSBEN FUT. A diak bongeszojebe a megoldokulcs
// be sem toltodik (a biztonsagi szabaly tiltja), ezert a "valaszHelyes" fuggvenyt
// ott meg sem lehet ertelmesen meghivni - kulcs nelkul nincs mit osszehasonlitani.

export const ALLAPOTOK = {
  VARAKOZIK: 'varakozik',   // lobbi, gyulnek a jatekosok
  KERDES: 'kerdes',         // fut a kerdes, jonnek a valaszok
  EREDMENY: 'eredmeny',     // lezarva, latszik a helyes valasz
  VEGE: 'vege',
};

// Terv 6.2. A tudas 100 pont, a sebesseg legfeljebb 50 - igy aki gondolkodik es
// jol valaszol, mindig ver egy gyorsan hibazot.
export const ALAPPONT = 100;
export const GYORSASAGI_MAX = 50;

// Gyorsasagi pont CSAK helyes valaszra jar. A terv keplete szo szerint a rossz
// valaszra is adna (0 + gyorsasagi), az viszont a gyors talalgatast jutalmazna.
export function pontszam(helyes, reakcioMs, idoLimitMp) {
  if (!helyes) return 0;
  const limitMs = Math.max(1, idoLimitMp * 1000);
  const hatralevo = Math.max(0, limitMs - Math.max(0, reakcioMs));
  return ALAPPONT + Math.round((hatralevo / limitMs) * GYORSASAGI_MAX);
}

// Ekezet- es kisbetu-fuggetlen osszehasonlitas a rovid valaszokhoz.
// Az NFD szetbontja az ekezetes betut alapbetu + ekezet parra, a \p{Mn}
// (nonspacing mark) pedig pont a levalt ekezeteket dobja el.
const normalizal = (szoveg) => String(szoveg)
  .normalize('NFD').replace(/\p{Mn}/gu, '')
  .toLowerCase().trim().replace(/\s+/g, ' ');

function azonosLista(a, b) {
  if (a.length !== b.length) return false;
  const egyik = [...a].sort();
  const masik = [...b].sort();
  return egyik.every((ertek, i) => ertek === masik[i]);
}

// CSAK TANARI OLDALON. A "kulcs" a kulcsok/<kerdesId> dokumentum.
export function valaszHelyes(kerdes, kulcs, valasz) {
  if (!kulcs || valasz === undefined || valasz === null) return false;

  switch (kerdes.tipus) {
    case 'feleletvalasztos':
      return Array.isArray(valasz) && valasz.length === 1 && valasz[0] === kulcs.helyes[0];
    case 'tobb_valasztos':
      // Reszpont nincs: mindet el kell talalni.
      return Array.isArray(valasz) && azonosLista(valasz, kulcs.helyes);
    case 'igaz_hamis':
      return String(valasz) === kulcs.helyes;
    case 'rovid_valasz':
      return kulcs.helyes.some((jo) => normalizal(jo) === normalizal(valasz));
    case 'parosito':
      return Array.isArray(valasz)
        && valasz.length === kulcs.helyes.length
        && kulcs.helyes.every((par) => {
          const adott = valasz.find((v) => v.bal === par.bal);
          return adott && adott.jobb === par.jobb;
        });
    default:
      return false;
  }
}

// A helyes valasz olvashato alakja - ezt a TANARI kliens irja be a kviz
// dokumentumaba lezaraskor, hogy a diak is lassa. Kulcsot a diak nem olvashat.
export function helyesValaszSzovege(kerdes, kulcs) {
  if (!kulcs) return '';
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
      return '';
  }
}

export const pintGeneral = () =>
  String(Math.floor(Math.random() * 900000) + 100000);

// A visszaszamlalo a diak kepernyojen. Ez CSAK megjelenites: a pontozas a
// szerveridobelyegekbol szamol, ezert egy elallitott telefonora nem ad elonyt.
// Ha megis nagyon eltoltnak tunik az ora, az idolimitre vagunk vissza.
export function hatralevoMasodperc(kerdesIndultMs, idoLimitMp) {
  const eltelt = Date.now() - kerdesIndultMs;
  const hatralevo = Math.ceil((idoLimitMp * 1000 - eltelt) / 1000);
  return Math.max(0, Math.min(idoLimitMp, hatralevo));
}
