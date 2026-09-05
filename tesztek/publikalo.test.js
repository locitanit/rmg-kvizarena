// A publikalo (admin/lib/kvizbazis.js) tesztjei a tesztek/minta/ fixture-on.
//
// A legfontosabb allitas itt van: a MEGOLDOKULCS nem szivaroghat at a publikus
// dokumentumba. Ha ez elromlik, a diak a bongeszo fejlesztoi eszkozeivel
// kiolvashatna a helyes valaszt az elo kviz kozben.

import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  diarendekBetolt, bankokBetolt, bankotFeldolgoz, bankDiasora,
  fejezetFeloldo, diasorDokumentum,
} from '../admin/lib/kvizbazis.js';

const ittVagyunk = dirname(fileURLToPath(import.meta.url));
const MINTA = join(ittVagyunk, 'minta', 'kvizbazis');

let bank;
let diasor;
let feldolgozott;

beforeAll(() => {
  const diarendek = diarendekBetolt(join(MINTA, '_diarend'));
  bank = bankokBetolt(MINTA).find((b) => b.kod === 'proba_bank');
  diasor = bankDiasora(bank, diarendek);
  feldolgozott = bankotFeldolgoz(bank, diasor);
});

const kerdesSzerint = (resz) =>
  [...feldolgozott.kerdesek.values()].find((e) => e.publikus.kerdes.includes(resz));

describe('A megoldokulcs nem szivaroghat at', () => {
  it('egyetlen publikus dokumentumban sincs helyes valasz vagy magyarazat', () => {
    for (const { publikus } of feldolgozott.kerdesek.values()) {
      expect(publikus).not.toHaveProperty('helyes');
      expect(publikus).not.toHaveProperty('magyarazat');
      expect(publikus).not.toHaveProperty('parok');
      expect(publikus).not.toHaveProperty('mintavalasz');
    }
  });

  it('a parosito publikus resze csak a bal oldalt es a KEVERT jobb oldalt tartalmazza', () => {
    const { publikus, kulcs } = kerdesSzerint('Parositsd a betuket');
    expect(publikus.parok_bal).toEqual(['A', 'B', 'C', 'D']);
    expect([...publikus.parok_jobb_kevert].sort()).toEqual(['1', '2', '3', '4']);
    // A kevert sorrend nem egyezhet a helyes parositassal.
    const parban = publikus.parok_jobb_kevert.every((j, i) => j === kulcs.helyes[i].jobb);
    expect(parban).toBe(false);
  });

  it('a kevereses determinisztikus - ujrapublikalaskor nem valtozik a hash', () => {
    const ujra = bankotFeldolgoz(bank, diasor);
    for (const [id, eredmeny] of feldolgozott.kerdesek) {
      expect(ujra.kerdesek.get(id).hash).toBe(eredmeny.hash);
    }
  });
});

describe('Fejezetszamitas a diarendbol', () => {
  it('a fejezet a fejezetek tomb INDEXE, nem a "szam" mezo', () => {
    // A mintaban a "BEVEZETES" es az "1. ALAPOK" is szam: 1 - ezert kell index.
    expect(kerdesSzerint('Melyik allitas igaz').publikus.fejezet).toBe(1);   // 1. ALAPOK
    expect(kerdesSzerint('Melyek tartoznak').publikus.fejezet).toBe(2);      // 2. MASODIK
  });

  it('a fejezethatarok is a jo fejezetbe esnek', () => {
    expect(kerdesSzerint('A proba mindig sikerul').publikus.fejezet).toBe(1); // dia 12 = hatar
    expect(kerdesSzerint('Hogy hivjak a probafejezetet').publikus.fejezet).toBe(2); // dia 22
  });

  it('dia nelkuli kerdesnel a fejezet null', () => {
    const e = kerdesSzerint('nincs diaszama');
    expect(e.publikus.dia).toBeNull();
    expect(e.publikus.fejezet).toBeNull();
  });

  it('diasor nelkul minden fejezet null', () => {
    const feloldo = fejezetFeloldo(null);
    expect(feloldo(5)).toBeNull();
  });
});

describe('Amit kihagyunk vagy hibanak jelzunk', () => {
  it('a kifejtos kerdes nem megy fel', () => {
    expect(feldolgozott.kihagyva.kifejtos).toBe(1);
    expect(kerdesSzerint('Fejtsd ki')).toBeUndefined();
  });

  it('a kepes kerdes sem megy fel (a kep a masodik korben jon)', () => {
    expect(feldolgozott.kihagyva.kepes).toBe(1);
    expect(kerdesSzerint('Mit latsz az abran')).toBeUndefined();
  });

  it('a hibas kerdes nem megy fel, es jelentve van', () => {
    expect(kerdesSzerint('Ez a kerdes hibas')).toBeUndefined();
    expect(feldolgozott.hibak).toHaveLength(1);
    expect(feldolgozott.hibak[0]).toContain('nincs a valaszok kozott');
  });

  it('a jo kerdesek felmennek', () => {
    // 9 kerdes a bankban - 1 kifejtos - 1 kepes - 1 hibas = 6
    expect(feldolgozott.kerdesek.size).toBe(6);
  });
});

describe('A kerdes azonositoja stabil', () => {
  it('a sorrend megvaltozasa nem valtoztatja meg az azonositokat', () => {
    const forditva = { ...bank, kerdesek: [...bank.kerdesek].reverse() };
    const ujra = bankotFeldolgoz(forditva, diasor);
    expect([...ujra.kerdesek.keys()].sort()).toEqual([...feldolgozott.kerdesek.keys()].sort());
  });

  it('a tartalom modosulasa uj hash-t ad, de ugyanazt az azonositot', () => {
    const modositott = {
      ...bank,
      kerdesek: bank.kerdesek.map((k) =>
        k.kerdes.includes('Melyik allitas igaz') ? { ...k, magyarazat: 'Mas magyarazat.' } : k),
    };
    const ujra = bankotFeldolgoz(modositott, diasor);
    const eredeti = kerdesSzerint('Melyik allitas igaz');
    expect(ujra.kerdesek.has(eredeti.id)).toBe(true);
    expect(ujra.kerdesek.get(eredeti.id).hash).not.toBe(eredeti.hash);
  });
});

describe('A bank dokumentuma', () => {
  it('temakoronkent szamol, es hash-tablat visz a valtozasfigyeleshez', () => {
    const dok = feldolgozott.bankDokumentum;
    expect(dok.cim).toBe('Probatananyag');
    expect(dok.diasor).toBe('proba');
    expect(dok.kerdes_db).toBe(6);
    expect(dok.temakorok).toEqual([{ kod: 'alapok', db: 3 }, { kod: 'masodik', db: 3 }]);
    expect(Object.keys(dok.hashok)).toHaveLength(6);
  });
});

describe('A diasor dokumentuma', () => {
  it('csak a szamozott diakat viszi fel', () => {
    const dok = diasorDokumentum(diasor);
    expect(dok.szamozott_diaszam).toBe(22);
    expect(dok.diak.every((d) => Number.isInteger(d.szamozott))).toBe(true);
    // A cimlapnak nincs szamozott diaszama, ezert kimarad.
    expect(dok.diak.some((d) => d.cim === 'CIMLAP')).toBe(false);
    expect(dok.fejezetek).toHaveLength(3);
  });
});
