// Az "rmg-admin kviz visszavon" tesztje az emulator ellen: egy hibas kviz
// csillagai es statisztikaja visszaall a kviz elotti allapotra, a korabbi
// kvizek adatai megmaradnak, es ketszer nem lehet visszavonni.

import { describe, it, expect, beforeAll } from 'vitest';
import { firebaseIndit, db } from '../admin/lib/firebase.js';
import { kvizParancs } from '../admin/parancsok/kviz.js';

const O = 'VV1';
const KVIZ = `${O}_hibas`;
const UID = 'diak_vv_a';

beforeAll(async () => {
  firebaseIndit({}, { emulator: true });
  const d = db();
  await d.doc('kerdesek/vv_k1').set({ tipus: 'igaz_hamis', temakor: 'halozat', kerdes: 'x' });
  await d.doc('kulcsok/vv_k1').set({ helyes: 'igaz' });
  await d.doc(`kvizek/${KVIZ}`).set({
    osztalyId: O, cim: 'Hibás kvíz', allapot: 'vege', kerdesIdk: ['vv_k1'],
  });
  // A hibas kvizben nem valaszolt, megis 3 csillagot kapott (holtverseny az 1. helyen).
  await d.doc(`kvizek/${KVIZ}/jatekosok/${UID}`).set({ becenev: 'Teszt', csillag: 3 });
  await d.doc(`osztalyok/${O}/tagok/${UID}`).set({ csillag_ossz: 5, csillag_aktualis: 4 });
  await d.doc(`statisztika/${O}_${UID}`).set({
    csillag_ossz: 5,
    kvizek_szama: 2,
    szemelyes_csucs: 0.7,
    temakor_teljesitmeny: { halozat: { jo: 7, ossz: 11 } },
    mesterfok: [],
    csillag_naplo: [
      { kvizId: `${O}_regi`, szazalek: 0.7, csillag: 2 },
      { kvizId: KVIZ, szazalek: 0, csillag: 3 },
    ],
  });
});

describe('Hibas kviz csillagainak visszavonasa', () => {
  it('a proba nem ir semmit', async () => {
    await kvizParancs(['visszavon', KVIZ], { proba: true });
    const tag = (await db().doc(`osztalyok/${O}/tagok/${UID}`).get()).data();
    expect(tag.csillag_aktualis).toBe(4);
  });

  it('visszaallitja a csillagokat es a statisztikat', async () => {
    await kvizParancs(['visszavon', KVIZ], {});

    const tag = (await db().doc(`osztalyok/${O}/tagok/${UID}`).get()).data();
    expect(tag).toMatchObject({ csillag_ossz: 2, csillag_aktualis: 1 });

    const stat = (await db().doc(`statisztika/${O}_${UID}`).get()).data();
    expect(stat.csillag_ossz).toBe(2);
    expect(stat.kvizek_szama).toBe(1);
    expect(stat.szemelyes_csucs).toBe(0.7);
    expect(stat.temakor_teljesitmeny).toEqual({ halozat: { jo: 7, ossz: 10 } });
    expect(stat.csillag_naplo.map((b) => b.kvizId)).toEqual([`${O}_regi`]);

    const jatekos = (await db().doc(`kvizek/${KVIZ}/jatekosok/${UID}`).get()).data();
    expect(jatekos.csillag).toBe(0);
    expect((await db().doc(`kvizek/${KVIZ}`).get()).data().visszavonva).toBeTruthy();
  });

  it('ketszer nem lehet visszavonni', async () => {
    await expect(kvizParancs(['visszavon', KVIZ], {})).rejects.toThrow('már visszavontad');
  });
});
