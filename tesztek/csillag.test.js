// A csillagrendszer tesztjei (terv 7. pont).
//
// A 4. fazis "Kesz, ha" feltetele: harom egymas utani kviz utan a csillagok
// kezzel utanaszamolva is stimmeljenek. Az utolso describe pont ezt jatssza le.

import { describe, it, expect } from 'vitest';
import {
  csillagokatSzamol, temakoroketOsszead, ujMesterfokok, otosigHatra, ALAP_BEALLITASOK,
} from '../web/js/kozos/csillag.js';

const alap = (modositas = {}) => ({
  jatekos: { helyezes: 5, helyes_db: 6 },
  kerdesSzam: 12,
  korabbiStat: { szemelyes_csucs: 0, kvizek_szama: 0, mesterfok: [] },
  ujTemakorAllas: {},
  beallitasok: {},
  ...modositas,
});

describe('Dobogo', () => {
  it('3 / 2 / 1 csillag az elso harom helyezesre', () => {
    for (const [helyezes, varhato] of [[1, 3], [2, 2], [3, 1]]) {
      const e = csillagokatSzamol(alap({ jatekos: { helyezes, helyes_db: 6 } }));
      expect(e.dobogo).toBe(varhato);
    }
  });

  it('a negyedik helyezettnek mar nem jar', () => {
    expect(csillagokatSzamol(alap({ jatekos: { helyezes: 4, helyes_db: 6 } })).dobogo).toBe(0);
  });

  it('kikapcsolhato', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 1, helyes_db: 6 }, beallitasok: { dobogo_be: false },
    }));
    expect(e.dobogo).toBe(0);
  });

  it('az ertekek atirhatok', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 1, helyes_db: 6 }, beallitasok: { dobogo_ertekek: [5, 4, 3, 2] },
    }));
    expect(e.dobogo).toBe(5);
  });
});

describe('Szemelyes csucs', () => {
  it('nem jar az elso harom kvizen (nincs mihez merni)', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 9, helyes_db: 12 },
      korabbiStat: { szemelyes_csucs: 0.5, kvizek_szama: 2, mesterfok: [] },
    }));
    expect(e.csucs).toBe(0);
  });

  it('jar, ha megdontotte a sajat csucsat', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 9, helyes_db: 10 },   // 83%
      korabbiStat: { szemelyes_csucs: 0.75, kvizek_szama: 4, mesterfok: [] },
    }));
    expect(e.csucs).toBe(1);
    expect(e.ujCsucs).toBeCloseTo(10 / 12);
  });

  it('a csucs ELERESE is er csillagot - kulonben a 100%-os diak sosem kapna tobbet', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 1, helyes_db: 12 },   // 100%
      korabbiStat: { szemelyes_csucs: 1, kvizek_szama: 5, mesterfok: [] },
    }));
    expect(e.csucs).toBe(1);
  });

  it('a dontetlen kikapcsolhato', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 1, helyes_db: 12 },
      korabbiStat: { szemelyes_csucs: 1, kvizek_szama: 5, mesterfok: [] },
      beallitasok: { csucs_dontetlen_is: false },
    }));
    expect(e.csucs).toBe(0);
  });

  it('nulla pontos kvizert nem jar csucs-csillag', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 12, helyes_db: 0 },
      korabbiStat: { szemelyes_csucs: 0, kvizek_szama: 5, mesterfok: [] },
    }));
    expect(e.csucs).toBe(0);
  });
});

describe('Mesterfok - minden kvizen, a kviz szazalekaert', () => {
  const kviz = (helyes_db, kerdesSzam, korabbiStat, beallitasok = {}) => csillagokatSzamol(alap({
    jatekos: { helyezes: 9, helyes_db }, kerdesSzam,
    korabbiStat: korabbiStat ?? { szemelyes_csucs: 1, kvizek_szama: 0, mesterfok: [] },
    beallitasok,
  }));

  it('80%-tol jar, alatta nem', () => {
    expect(kviz(8, 10).mesterfok).toBe(1);    // pont 80%
    expect(kviz(10, 10).mesterfok).toBe(1);
    expect(kviz(7, 10).mesterfok).toBe(0);    // 70%
  });

  it('MINDEN kvizen jar, nem csak az elson - a korabbi jelvenyek nem szamitanak', () => {
    const regiMester = { szemelyes_csucs: 1, kvizek_szama: 7, mesterfok: ['urlapok', 'lekerdezes'] };
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 9, helyes_db: 9 }, kerdesSzam: 10,
      korabbiStat: regiMester,
      ujTemakorAllas: { urlapok: { jo: 30, ossz: 32 } },
      beallitasok: { csucs_be: false },
    }));
    expect(e.mesterfok).toBe(1);
    expect(e.ossz).toBe(1);
    expect(e.reszletek).toEqual([{ forras: 'mesterfok', csillag: 1, mire: '90%' }]);
  });

  it('tul rovid kvizert nem jar', () => {
    expect(kviz(5, 5).mesterfok).toBe(0);
    expect(kviz(5, 5, undefined, { mesterfok_min_kerdes: 5 }).mesterfok).toBe(1);
  });

  it('a kuszob atirhato es kikapcsolhato', () => {
    expect(kviz(6, 10, undefined, { mesterfok_kuszob: 0.6 }).mesterfok).toBe(1);
    expect(kviz(10, 10, undefined, { mesterfok_be: false }).mesterfok).toBe(0);
  });

  it('kvizenkent legfeljebb 1 mesterfok-csillag, akarhany temakorbol all', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 9, helyes_db: 12 },
      ujTemakorAllas: { egyik: { jo: 8, ossz: 8 }, masik: { jo: 9, ossz: 10 } },
    }));
    expect(e.mesterfok).toBe(1);
  });
});

describe('Temakor-jelveny (csillagot nem ad)', () => {
  it('80% felett, legalabb 8 kerdesen, temakoronkent egyszer', () => {
    const allas = { urlapok: { jo: 7, ossz: 8 } };          // 87.5%
    expect(ujMesterfokok(allas, [], {})).toEqual(['urlapok']);
    expect(ujMesterfokok(allas, ['urlapok'], {})).toEqual([]);
  });

  it('nem jar, ha keves a megvalaszolt kerdes', () => {
    expect(ujMesterfokok({ urlapok: { jo: 6, ossz: 6 } }, [], {})).toEqual([]);
  });

  it('nem jar a kuszob alatt', () => {
    expect(ujMesterfokok({ urlapok: { jo: 6, ossz: 8 } }, [], {})).toEqual([]);  // 75%
  });

  it('a kuszob es a minimum atirhato', () => {
    const allas = { urlapok: { jo: 4, ossz: 6 } };          // 66.7%
    expect(ujMesterfokok(allas, [], { mesterfok_kuszob: 0.6, jelveny_min_kerdes: 5 }))
      .toEqual(['urlapok']);
  });

  it('tobb temakor egyszerre is lehet uj jelveny', () => {
    const e = csillagokatSzamol(alap({
      ujTemakorAllas: { egyik: { jo: 8, ossz: 8 }, masik: { jo: 9, ossz: 10 } },
    }));
    expect(e.ujMesterfokok).toEqual(['egyik', 'masik']);
    expect(e.mesterfok).toBe(0);    // a kviz maga csak 50% volt
  });
});

describe('Reszvetel', () => {
  it('a puszta reszvetelert nem jar csillag (az 5. kvizen sem)', () => {
    const e = csillagokatSzamol(alap({
      korabbiStat: { szemelyes_csucs: 0.9, kvizek_szama: 4, mesterfok: [] }, // 50% < 90%
    }));
    expect(e.ossz).toBe(0);
    expect(e.reszletek).toEqual([]);
  });
});

describe('Kvizenkenti felso hatar', () => {
  it('legfeljebb 4 csillag egy kvizert', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 1, helyes_db: 12 },                       // dobogo 3
      korabbiStat: { szemelyes_csucs: 0.5, kvizek_szama: 4, mesterfok: [] }, // csucs 1
      ujTemakorAllas: { egyik: { jo: 8, ossz: 8 } },                 // mesterfok 1
    }));
    expect(e.nyers).toBe(5);
    expect(e.ossz).toBe(4);
    expect(e.levagva).toBe(true);
  });

  it('a hatar atirhato', () => {
    const e = csillagokatSzamol(alap({
      jatekos: { helyezes: 1, helyes_db: 12 },
      korabbiStat: { szemelyes_csucs: 0.5, kvizek_szama: 4, mesterfok: [] },
      ujTemakorAllas: { egyik: { jo: 8, ossz: 8 } },
      beallitasok: { kviz_max_csillag: 10 },
    }));
    expect(e.ossz).toBe(5);
  });
});

describe('Temakor-osszesites', () => {
  it('hozzaadja az uj kviz eredmenyet a korabbihoz', () => {
    const osszeg = temakoroketOsszead(
      { urlapok: { jo: 3, ossz: 5 } },
      { urlapok: { jo: 2, ossz: 3 }, lekerdezes: { jo: 1, ossz: 4 } }
    );
    expect(osszeg).toEqual({
      urlapok: { jo: 5, ossz: 8 },
      lekerdezes: { jo: 1, ossz: 4 },
    });
  });
});

describe('Otosig hatra', () => {
  it('5 csillagnal jar az otos', () => {
    expect(otosigHatra(0, {})).toBe(5);
    expect(otosigHatra(3, {})).toBe(2);
    expect(otosigHatra(5, {})).toBe(0);
    expect(otosigHatra(7, {})).toBe(0);
    expect(otosigHatra(3, { jegy_kuszob: 8 })).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// A "Kesz, ha" feltetel: harom egymas utani kviz, kezzel utanaszamolva.
describe('Harom egymas utani kviz - kezzel utanaszamolva', () => {
  it('egy kozepmezonyos diak utja', () => {
    // A diak mar 4 kvizen tul van, a csucsa 50%, mesterfokja meg nincs.
    let stat = { szemelyes_csucs: 0.5, kvizek_szama: 4, mesterfok: [] };
    let temakorok = { urlapok: { jo: 4, ossz: 8 }, lekerdezes: { jo: 3, ossz: 6 } };
    let csillagOssz = 0;
    const naplo = [];

    // --- 1. kviz: 8/10 (80%), 3. helyezes, urlapok temakorbol 4/4
    let ujAllas = temakoroketOsszead(temakorok, { urlapok: { jo: 4, ossz: 4 } });
    let e = csillagokatSzamol({
      jatekos: { helyezes: 3, helyes_db: 8 }, kerdesSzam: 10,
      korabbiStat: stat, ujTemakorAllas: ujAllas, beallitasok: {},
    });
    // Kezzel: dobogo 3. hely = 1 | csucs 80% > 50% = 1 |
    //         mesterfok: a kviz 80% -> 1                                   => 3
    expect(e.dobogo).toBe(1);
    expect(e.csucs).toBe(1);
    expect(e.mesterfok).toBe(1);
    expect(e.ujMesterfokok).toEqual([]);      // urlapok 8/12 = 67% - jelveny meg nincs
    expect(e.ossz).toBe(3);

    csillagOssz += e.ossz; naplo.push(e.ossz);
    stat = { szemelyes_csucs: e.ujCsucs, kvizek_szama: e.kvizekSzama,
             mesterfok: [...stat.mesterfok, ...e.ujMesterfokok] };
    temakorok = ujAllas;

    // --- 2. kviz: 6/10 (60%), 7. helyezes, urlapok 6/6
    ujAllas = temakoroketOsszead(temakorok, { urlapok: { jo: 6, ossz: 6 } });
    e = csillagokatSzamol({
      jatekos: { helyezes: 7, helyes_db: 6 }, kerdesSzam: 10,
      korabbiStat: stat, ujTemakorAllas: ujAllas, beallitasok: {},
    });
    // Kezzel: dobogo 0 | csucs 60% < 80% -> 0 |
    //         mesterfok: a kviz 60% -> 0                                   => 0
    expect(e.ossz).toBe(0);

    csillagOssz += e.ossz; naplo.push(e.ossz);
    stat = { szemelyes_csucs: e.ujCsucs, kvizek_szama: e.kvizekSzama,
             mesterfok: [...stat.mesterfok, ...e.ujMesterfokok] };
    temakorok = ujAllas;

    // --- 3. kviz: 9/10 (90%), 1. helyezes, urlapok 4/4
    ujAllas = temakoroketOsszead(temakorok, { urlapok: { jo: 4, ossz: 4 } });
    e = csillagokatSzamol({
      jatekos: { helyezes: 1, helyes_db: 9 }, kerdesSzam: 10,
      korabbiStat: stat, ujTemakorAllas: ujAllas, beallitasok: {},
    });
    // Kezzel: dobogo 1. hely = 3 | csucs 90% > 80% = 1 |
    //         mesterfok: a kviz 90% -> 1 (+ urlapok 18/22 = 82% -> jelveny)
    //         nyers 5, de a kvizenkenti hatar 4                       => 4
    expect(e.dobogo).toBe(3);
    expect(e.csucs).toBe(1);
    expect(e.mesterfok).toBe(1);
    expect(e.ujMesterfokok).toEqual(['urlapok']);
    expect(e.nyers).toBe(5);
    expect(e.ossz).toBe(4);
    expect(e.levagva).toBe(true);

    csillagOssz += e.ossz; naplo.push(e.ossz);

    // Harom kviz alatt osszesen 7 csillag - vagyis egy otos (5) es marad 2.
    expect(naplo).toEqual([3, 0, 4]);
    expect(csillagOssz).toBe(7);
    expect(otosigHatra(csillagOssz, {})).toBe(0);
    expect(csillagOssz - ALAP_BEALLITASOK.jegy_kuszob).toBe(2);
  });
});
