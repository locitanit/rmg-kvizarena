// Az elo kviz javitasanak es pontozasanak tesztjei.
//
// Ez a logika a tanari bongeszoben fut, es nincs mogotte szerver, ami
// ujraszamolna - ezert kell rola teszt.

import { describe, it, expect } from 'vitest';
import {
  pontszam, valaszHelyes, helyesValaszSzovege, hatralevoMasodperc,
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
