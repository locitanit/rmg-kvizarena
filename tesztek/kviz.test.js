// Az elo kviz javitasanak es pontozasanak tesztjei.
//
// Ez a logika a tanari bongeszoben fut, es nincs mogotte szerver, ami
// ujraszamolna - ezert kell rola teszt.

import { describe, it, expect } from 'vitest';
import {
  pontszam, valaszHelyes, helyesValaszSzovege, hatralevoMasodperc,
  rangsorol, helyezesek, masodpercben,
  ALAPPONT, GYORSASAGI_MAX,
} from '../web/js/kozos/kviz.js';

describe('Pontozas', () => {
  it('rossz valasz 0 pont - gyorsasagi pont sem jar ra', () => {
    expect(pontszam(false, 0, 25)).toBe(0);
    expect(pontszam(false, 25000, 25)).toBe(0);
  });

  it('azonnali helyes valasz a teljes pontot hozza', () => {
    expect(pontszam(true, 0, 25)).toBe(ALAPPONT + GYORSASAGI_MAX);
  });

  it('az utolso pillanatban adott helyes valasz csak az alappontot hozza', () => {
    expect(pontszam(true, 25000, 25)).toBe(ALAPPONT);
  });

  it('felidonel a gyorsasagi pont fele jar', () => {
    expect(pontszam(true, 12500, 25)).toBe(ALAPPONT + GYORSASAGI_MAX / 2);
  });

  it('a lejart ido utan beerkezo valasz sem megy alappont ala', () => {
    expect(pontszam(true, 99000, 25)).toBe(ALAPPONT);
  });

  it('a gondolkodo jo valasz mindig ver egy gyors rosszat (terv 6.2)', () => {
    const lassuDeJo = pontszam(true, 24000, 25);
    const gyorsDeRossz = pontszam(false, 200, 25);
    expect(lassuDeJo).toBeGreaterThan(gyorsDeRossz);
  });
});

describe('Javitas', () => {
  const feleletvalasztos = { tipus: 'feleletvalasztos', valaszok: ['a', 'b', 'c', 'd'] };
  const tobbValasztos = { tipus: 'tobb_valasztos', valaszok: ['a', 'b', 'c', 'd'] };
  const igazHamis = { tipus: 'igaz_hamis' };
  const rovidValasz = { tipus: 'rovid_valasz' };
  const parosito = { tipus: 'parosito' };

  it('feleletvalasztos: csak a pontos index jo', () => {
    const kulcs = { helyes: [2] };
    expect(valaszHelyes(feleletvalasztos, kulcs, [2])).toBe(true);
    expect(valaszHelyes(feleletvalasztos, kulcs, [1])).toBe(false);
    expect(valaszHelyes(feleletvalasztos, kulcs, [2, 3])).toBe(false);
    expect(valaszHelyes(feleletvalasztos, kulcs, null)).toBe(false);
  });

  it('tobbvalaszos: reszpont nincs, mindet el kell talalni', () => {
    const kulcs = { helyes: [0, 2] };
    expect(valaszHelyes(tobbValasztos, kulcs, [0, 2])).toBe(true);
    expect(valaszHelyes(tobbValasztos, kulcs, [2, 0])).toBe(true);   // sorrend mindegy
    expect(valaszHelyes(tobbValasztos, kulcs, [0])).toBe(false);     // hianyos
    expect(valaszHelyes(tobbValasztos, kulcs, [0, 1, 2])).toBe(false); // tobblet
  });

  it('igaz/hamis', () => {
    expect(valaszHelyes(igazHamis, { helyes: 'igaz' }, 'igaz')).toBe(true);
    expect(valaszHelyes(igazHamis, { helyes: 'igaz' }, 'hamis')).toBe(false);
  });

  it('rovid valasz: ekezet- es kisbetu-fuggetlen, tobb alak is jo', () => {
    const kulcs = { helyes: ['ciklusváltozó', 'számláló'] };
    expect(valaszHelyes(rovidValasz, kulcs, 'ciklusváltozó')).toBe(true);
    expect(valaszHelyes(rovidValasz, kulcs, 'CIKLUSVALTOZO')).toBe(true);
    expect(valaszHelyes(rovidValasz, kulcs, '  Szamlalo ')).toBe(true);
    expect(valaszHelyes(rovidValasz, kulcs, 'valtozo')).toBe(false);
  });

  it('parosito: minden parnak stimmelnie kell, a sorrend mindegy', () => {
    const kulcs = { helyes: [{ bal: 'A', jobb: '1' }, { bal: 'B', jobb: '2' }] };
    expect(valaszHelyes(parosito, kulcs,
      [{ bal: 'B', jobb: '2' }, { bal: 'A', jobb: '1' }])).toBe(true);
    expect(valaszHelyes(parosito, kulcs,
      [{ bal: 'A', jobb: '2' }, { bal: 'B', jobb: '1' }])).toBe(false);
  });

  it('kulcs nelkul semmi nem jo - a diak kliense igy sem tudna javitani', () => {
    expect(valaszHelyes(feleletvalasztos, null, [2])).toBe(false);
    expect(valaszHelyes(feleletvalasztos, undefined, [2])).toBe(false);
  });
});

describe('A helyes valasz szovege (ezt latja a diak lezaras utan)', () => {
  it('feleletvalasztosnal a valasz szoveget adja, nem az indexet', () => {
    const kerdes = { tipus: 'feleletvalasztos', valaszok: ['alma', 'korte', 'szilva'] };
    expect(helyesValaszSzovege(kerdes, { helyes: [1] })).toBe('korte');
  });

  it('tobbvalaszosnal osszefuzi', () => {
    const kerdes = { tipus: 'tobb_valasztos', valaszok: ['a', 'b', 'c'] };
    expect(helyesValaszSzovege(kerdes, { helyes: [0, 2] })).toBe('a + c');
  });

  it('rovid valasznal az elfogadhato alakokat sorolja', () => {
    expect(helyesValaszSzovege({ tipus: 'rovid_valasz' }, { helyes: ['egy', 'ketto'] }))
      .toBe('egy / ketto');
  });
});

describe('Visszaszamlalo', () => {
  it('az idolimitrol indul es nullaig megy', () => {
    const most = Date.now();
    expect(hatralevoMasodperc(most, 25)).toBe(25);
    expect(hatralevoMasodperc(most - 25000, 25)).toBe(0);
    expect(hatralevoMasodperc(most - 99000, 25)).toBe(0);
  });

  it('elallitott ora eseten sem lep az idolimit fole', () => {
    // A diak telefonjanak orja jarhat hatrebb - a kijelzo akkor sem hazudhat.
    expect(hatralevoMasodperc(Date.now() + 600000, 25)).toBe(25);
  });
});

// ------------------------------------------------------------------ rangsor

// A jatekos a rangsor szempontjabol lenyeges mezoivel. A "csatlakozott" a
// Firestore Timestamp alakjat utanozza (toMillis()).
const j = (nev, helyes_db, valasz_ido_osszeg_ms, csatlakozottMs = 0) => ({
  nev, helyes_db, valasz_ido_osszeg_ms,
  csatlakozott: { toMillis: () => csatlakozottMs },
});

const nevek = (lista) => lista.map((x) => x.nev);

describe('Rangsorolas: a jo valaszok szama dont', () => {
  it('a tobb jo valasz elorebb visz, akkor is ha kevesebb a pontja', () => {
    // Pont szerint a "gyors" nyerne (9 x 150 = 1350 > 10 x 100 = 1000) - de
    // pont ezert csereltuk le a rangsort.
    const lassu = { ...j('lassu', 10, 200000), pont: 1000 };
    const gyors = { ...j('gyors', 9, 20000), pont: 1350 };
    expect(nevek(rangsorol([gyors, lassu]))).toEqual(['lassu', 'gyors']);
  });

  it('azonos jo valasznal a kisebb osszido nyer', () => {
    expect(nevek(rangsorol([j('lassu', 7, 60000), j('gyors', 7, 40000)])))
      .toEqual(['gyors', 'lassu']);
  });

  it('azonos jo valasz es osszido eseten a korabbi csatlakozas nyer', () => {
    expect(nevek(rangsorol([j('kesobb', 7, 40000, 500), j('korabban', 7, 40000, 100)])))
      .toEqual(['korabban', 'kesobb']);
  });

  it('a hianyzo osszido a lista vegere kerul, de nem dob hibat', () => {
    // Regi, a C resz elott indult es felbeszakadt kviz folytatasa.
    const regi = { nev: 'regi', helyes_db: 7 };
    const uj = j('uj', 7, 99999);
    expect(nevek(rangsorol([regi, uj]))).toEqual(['uj', 'regi']);
  });

  it('a hianyzo helyes_db nullanak szamit', () => {
    expect(nevek(rangsorol([{ nev: 'nincs' }, j('van', 1, 1000)]))).toEqual(['van', 'nincs']);
  });

  it('ures lista - ures lista', () => {
    expect(rangsorol([])).toEqual([]);
  });

  it('nem irja at a kapott tombot', () => {
    const eredeti = [j('b', 1, 100), j('a', 9, 100)];
    rangsorol(eredeti);
    expect(nevek(eredeti)).toEqual(['b', 'a']);
  });
});

describe('Helyezesek a rangsorolt listahoz', () => {
  it('holtversenyben azonos helyezes, es a kovetkezo kimarad (1, 1, 3)', () => {
    const rendezett = rangsorol([
      j('a', 8, 40000), j('b', 8, 40000), j('c', 8, 50000),
    ]);
    expect(helyezesek(rendezett)).toEqual([1, 1, 3]);
  });

  it('holtverseny nelkul sima 1, 2, 3', () => {
    const rendezett = rangsorol([j('a', 9, 1000), j('b', 8, 1000), j('c', 7, 1000)]);
    expect(helyezesek(rendezett)).toEqual([1, 2, 3]);
  });

  it('ures lista', () => {
    expect(helyezesek([])).toEqual([]);
  });
});

describe('Az osszido kiirasa', () => {
  it('magyar tizedesvesszovel, egy tizedessel', () => {
    expect(masodpercben(48200)).toBe('48,2 mp');
    expect(masodpercben(0)).toBe('0,0 mp');
  });

  it('hianyzo osszido eseten gondolatjel', () => {
    expect(masodpercben(undefined)).toBe('–');
    expect(masodpercben(null)).toBe('–');
  });
});
