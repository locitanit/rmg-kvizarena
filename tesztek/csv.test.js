// A CSV-export tesztjei.
//
// A 4. fazis "Kesz, ha" feltetele: a CSV megnyithato Excelben, EKEZETHELYESEN.
// Ehhez harom dolog kell, es mindharmat itt ellenorizzuk.

import { describe, it, expect } from 'vitest';
import { csvSzoveg, szazalek, fajlnevre } from '../web/js/kozos/csv.js';

describe('CSV-formatum (magyar Excel)', () => {
  it('BOM-mal kezdodik - enelkul elromlanak az ekezetek', () => {
    const szoveg = csvSzoveg(['nev'], [['Kovács Bence']]);
    expect(szoveg.charCodeAt(0)).toBe(0xFEFF);
  });

  it('pontosvesszo az elvalaszto, mert a magyar Excelben a vesszo tizedesjel', () => {
    const szoveg = csvSzoveg(['a', 'b'], [['1', '2']]);
    expect(szoveg).toContain('a;b');
    expect(szoveg).toContain('1;2');
  });

  it('CRLF a sorvege', () => {
    const szoveg = csvSzoveg(['a'], [['1'], ['2']]);
    expect(szoveg.split('\r\n')).toHaveLength(3);
  });

  it('megorzi az ekezeteket', () => {
    expect(csvSzoveg(['nev'], [['Árvíztűrő tükörfúrógép']]))
      .toContain('Árvíztűrő tükörfúrógép');
  });
});

describe('CSV-idezojelezes', () => {
  it('idezojelbe teszi a pontosvesszot tartalmazo mezot', () => {
    expect(csvSzoveg(['a'], [['egy;ketto']])).toContain('"egy;ketto"');
  });

  it('megduplazza a mezoben levo idezojelet', () => {
    expect(csvSzoveg(['a'], [['ezt "igy" irjuk']])).toContain('"ezt ""igy"" irjuk"');
  });

  it('idezojelbe teszi a sortorest tartalmazo mezot', () => {
    expect(csvSzoveg(['a'], [['elso\nmasodik']])).toContain('"elso\nmasodik"');
  });

  it('az ures es hianyzo mezobol ures cella lesz', () => {
    const szoveg = csvSzoveg(['a', 'b', 'c'], [[null, undefined, '']]);
    expect(szoveg.split('\r\n')[1]).toBe(';;');
  });
});

describe('Szazalek', () => {
  it('tizedes vesszovel ir, hogy az Excel szamnak lassa', () => {
    expect(szazalek(0.8333)).toBe('83,3');
    expect(szazalek(1)).toBe('100');
    expect(szazalek(0)).toBe('0');
  });

  it('hianyzo ertekbol ures cella lesz', () => {
    expect(szazalek(null)).toBe('');
    expect(szazalek(undefined)).toBe('');
  });
});

describe('Fajlnev', () => {
  it('ekezet es szokoz nelkuli nevet ad', () => {
    expect(fajlnevre('Adatbázis-kezelés (ICDL) – 1-43. dia'))
      .toBe('Adatbazis_kezeles_ICDL_1_43_dia');
  });

  it('ures bemenetre is ad hasznalhato nevet', () => {
    expect(fajlnevre('')).toBe('export');
    expect(fajlnevre('///')).toBe('export');
  });
});
