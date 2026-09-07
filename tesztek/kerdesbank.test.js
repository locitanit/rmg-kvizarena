// A valogatas (szur) es a cimkeszuro tesztjei.
//
// A szures a BONGESZOBEN fut, szerver nelkul - ezert kell rola teszt. A cimke a
// harom mod (dia / fejezet / temakor) FOLOTT szur, mint a nehezseg.

import { describe, it, expect } from 'vitest';

// A modul lancolata (kerdesbank -> firebase -> firebase-config) a bongeszo
// "location"-jet nezi, hogy emulatorra vagy elesre kapcsoljon. Node alatt ez
// nincs, ezert a betoltes ELOTT pototjuk - es dinamikusan importalunk, hogy ne
// szivarogjon ki globalis mellekhatas a tobbi tesztfajlba.
globalThis.location ??= { hostname: 'localhost' };
const { szur, cimkeketOsszeszamol, cimkeNeve, CIMKE_KUSZOB } =
  await import('../web/js/kozos/kerdesbank.js');

// Rovid segito: egy kerdes a szuro szempontjabol lenyeges mezoivel.
const k = (id, extra = {}) => ({
  id, tipus: 'feleletvalasztos', nehezseg: 1, dia: 10, fejezet: 1, temakor: 'alapok', ...extra,
});

const MINTA = [
  k('a', { cimkek: ['hivatalos_minta'] }),
  k('b', { cimkek: ['hivatalos_minta', 'sajat'] }),
  k('c', { cimkek: ['sajat'] }),
  k('d', {}),                       // nincs "cimkek" mezo: regi publikalas
  k('e', { cimkek: [] }),
];

const idk = (lista) => lista.map((x) => x.id);

describe('Cimkeszuro a valogatasban', () => {
  it('cimke megadva: csak a cimkes kerdesek jonnek', () => {
    expect(idk(szur(MINTA, { cimke: 'hivatalos_minta' }))).toEqual(['a', 'b']);
  });

  it('cimke + cimke_nelkul: pont a tobbiek', () => {
    expect(idk(szur(MINTA, { cimke: 'hivatalos_minta', cimke_nelkul: true })))
      .toEqual(['c', 'd', 'e']);
  });

  it('cimke nelkul (regi mentett valogatas) nincs hatasa', () => {
    expect(idk(szur(MINTA, {}))).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(idk(szur(MINTA, { cimke: null }))).toEqual(['a', 'b', 'c', 'd', 'e']);
    // A cimke_nelkul onmagaban, cimke nelkul sem szur semmit.
    expect(idk(szur(MINTA, { cimke_nelkul: true }))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('a "cimkek" mezo hianya nem dob hibat - csak "nincs cimkeje"', () => {
    expect(() => szur([k('x')], { cimke: 'barmi' })).not.toThrow();
    expect(idk(szur([k('x')], { cimke: 'barmi' }))).toEqual([]);
    expect(idk(szur([k('x')], { cimke: 'barmi', cimke_nelkul: true }))).toEqual(['x']);
  });

  it('mind a harom modban tovabb szukit', () => {
    const dia = { mod: 'dia', dia_tol: 1, dia_ig: 99, cimke: 'hivatalos_minta' };
    const fejezet = { mod: 'fejezet', fejezetek: [1], cimke: 'hivatalos_minta' };
    const temakor = { mod: 'temakor', temakorok: ['alapok'], cimke: 'hivatalos_minta' };
    expect(idk(szur(MINTA, dia))).toEqual(['a', 'b']);
    expect(idk(szur(MINTA, fejezet))).toEqual(['a', 'b']);
    expect(idk(szur(MINTA, temakor))).toEqual(['a', 'b']);
  });

  it('a nehezseg-szuro es a cimke egyszerre is ervenyes', () => {
    const lista = [k('a', { cimkek: ['t'], nehezseg: 3 }), k('b', { cimkek: ['t'], nehezseg: 1 })];
    expect(idk(szur(lista, { cimke: 't', nehezseg_max: 2 }))).toEqual(['b']);
  });
});

describe('A bank cimkeinek osszeszamolasa', () => {
  const sok = (cimke, db) => Array.from({ length: db }, (_, i) => k(`${cimke}${i}`, { cimkek: [cimke] }));

  it('csak a kuszoböt elero cimkek kerulnek a listaba', () => {
    const lista = [...sok('gyakori', CIMKE_KUSZOB), ...sok('ritka', CIMKE_KUSZOB - 1)];
    expect(cimkeketOsszeszamol(lista)).toEqual([{ cimke: 'gyakori', db: CIMKE_KUSZOB }]);
  });

  it('a hivatalos_minta mindig elol all, a tobbi abecerendben', () => {
    const lista = [...sok('zebra', 5), ...sok('alma', 5), ...sok('hivatalos_minta', 5)];
    expect(cimkeketOsszeszamol(lista).map((c) => c.cimke))
      .toEqual(['hivatalos_minta', 'alma', 'zebra']);
  });

  it('cimke nelkuli kerdesek nem zavarnak be', () => {
    expect(cimkeketOsszeszamol([k('x'), k('y', { cimkek: [] })])).toEqual([]);
  });
});

describe('A cimke emberi neve', () => {
  it('a hivatalos_minta beszedes nevet kap', () => {
    expect(cimkeNeve('hivatalos_minta')).toBe('hivatalos ICDL-mintakérdés');
  });

  it('az ismeretlen cimke onmagat adja vissza', () => {
    expect(cimkeNeve('sajat_cimke')).toBe('sajat_cimke');
  });
});
