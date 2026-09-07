// rmg-admin publikal [bank] [--proba]
//
// A kvizbazis YAML-bankjait felviszi a Firestore-ba, kettevagva:
//   kerdesek/  - publikus resz, a diak is olvashatja
//   kulcsok/   - a megoldokulcs, csak tanar olvashatja
//
// Csak a VALTOZOTT kerdeseket irja: minden bankhoz tartozik egy hash-tabla a
// bankok/<kod> dokumentumban, igy egy olvasasbol kiderul, mi valtozott.
//
//   rmg-admin publikal                  minden bank
//   rmg-admin publikal adatbaziskezeles_2026_icdl
//   rmg-admin publikal --proba          megmutatja, mi tortenne, de nem ir

import { db } from '../lib/firebase.js';
import { mappatEllenoriz } from '../lib/config.js';
import {
  diarendekBetolt, diasorDokumentum, bankokBetolt, bankotFeldolgoz, bankDiasora,
} from '../lib/kvizbazis.js';
import { ok, info, fejlec, figyelem, tablazat } from '../lib/kiiras.js';

// A Firestore koteg legfeljebb 500 muveletet visel el. Egy kerdes ket iras
// (kerdesek + kulcsok), ezert 200 kerdes/koteg boven biztonsagos.
const KOTEG_MERET = 200;

export async function publikalParancs(argumentumok, kapcsolo, config) {
  const szurt = argumentumok[0] || null;
  const proba = Boolean(kapcsolo.proba);

  mappatEllenoriz(config.kvizbazis_ut, 'kvizbazis');
  const diarendUt = config.diarend_ut || `${config.kvizbazis_ut}\\_diarend`;

  const diarendek = diarendekBetolt(diarendUt);
  const bankok = bankokBetolt(config.kvizbazis_ut).filter((b) => !szurt || b.kod === szurt);

  if (!bankok.length) {
    throw new Error(
      `Nincs ilyen bank: ${szurt}\n` +
      `  A bank azonosítója a YAML-fájl neve kiterjesztés nélkül, pl. adatbaziskezeles_2026_icdl.`
    );
  }

  fejlec(proba ? 'PUBLIKÁLÁS – PRÓBA (semmit nem írok)' : 'PUBLIKÁLÁS');
  info(`kvizbazis: ${config.kvizbazis_ut}`);
  info(`${bankok.length} bank, ${diarendek.kodSzerint.size} diasor`);

  // 1. A diasorok feltoltese. Kicsi es ritkan valtozik, ezert mindig kiirjuk.
  if (!proba) {
    const koteg = db().batch();
    for (const [kod, adat] of diarendek.kodSzerint) {
      koteg.set(db().doc(`diasorok/${kod}`), diasorDokumentum(adat));
    }
    await koteg.commit();
  }
  ok(`${diarendek.kodSzerint.size} diasor ${proba ? '(felmenne)' : 'feltöltve'}.`);

  // 2. Bankonkent.
  const sorok = [];
  const osszesHiba = [];
  const osszesIsmetlodo = [];
  const kepFigyelmeztetesek = [];
  let kepDb = 0;
  let kepBajt = 0;
  let nincsDiasor = 0;

  for (const bank of bankok) {
    const diasor = bankDiasora(bank, diarendek);
    if (!diasor) nincsDiasor++;

    const feldolgozott = bankotFeldolgoz(bank, diasor);
    osszesHiba.push(...feldolgozott.hibak);
    osszesIsmetlodo.push(...feldolgozott.ismetlodo);
    kepDb += feldolgozott.kepek.db;
    kepBajt += feldolgozott.kepek.osszBajt;
    kepFigyelmeztetesek.push(...feldolgozott.kepek.figyelmeztetesek);

    // A korabbi allapot: egyetlen olvasas bankonkent.
    const korabbiDok = await db().doc(`bankok/${bank.kod}`).get();
    const korabbiHashok = korabbiDok.exists ? (korabbiDok.data().hashok || {}) : {};

    const uj = [];
    const modosult = [];
    for (const [id, eredmeny] of feldolgozott.kerdesek) {
      if (!(id in korabbiHashok)) uj.push(id);
      else if (korabbiHashok[id] !== eredmeny.hash) modosult.push(id);
    }
    const torolt = Object.keys(korabbiHashok).filter((id) => !feldolgozott.kerdesek.has(id));

    if (!proba) {
      await kiirasokat(feldolgozott, [...uj, ...modosult], torolt, bank.kod);
    }

    sorok.push([
      bank.kod,
      diasor ? diasor.kod : '-',
      feldolgozott.kerdesek.size,
      uj.length, modosult.length, torolt.length,
      feldolgozott.kihagyva.kifejtos + feldolgozott.kihagyva.kepes,
    ]);
  }

  fejlec('Eredmény');
  tablazat(sorok, ['bank', 'diasor', 'kérdés', 'új', 'módosult', 'törölt', 'kihagyva']);

  const osszesen = sorok.reduce((sum, s) => sum + s[2], 0);
  const ujOssz = sorok.reduce((sum, s) => sum + s[3], 0);
  const modOssz = sorok.reduce((sum, s) => sum + s[4], 0);
  const torOssz = sorok.reduce((sum, s) => sum + s[5], 0);

  console.log('');
  ok(`${osszesen} kérdés a bankokban. ${ujOssz} új, ${modOssz} módosult, ${torOssz} törölt.`);
  info('A "kihagyva" a kifejtős kérdés – az gépileg nem javítható.');
  if (kepDb) {
    ok(`${kepDb} képes kérdés, összesen ${Math.round(kepBajt / 1024)} KB beágyazva.`);
  }
  if (kepFigyelmeztetesek.length) {
    figyelem(`${kepFigyelmeztetesek.length} nagy kép (60 KB fölött):`);
    kepFigyelmeztetesek.slice(0, 10).forEach((s) => info(`  ${s}`));
    if (kepFigyelmeztetesek.length > 10) info(`  … és még ${kepFigyelmeztetesek.length - 10}`);
  }

  if (nincsDiasor) {
    figyelem(`${nincsDiasor} banknak nincs diasora – ezek csak témakör szerint válogathatók.`);
  }
  if (osszesIsmetlodo.length) {
    figyelem(`${osszesIsmetlodo.length} ismétlődő kérdésszöveg (csak az első ment fel):`);
    osszesIsmetlodo.slice(0, 10).forEach((s) => info(`  ${s}`));
    if (osszesIsmetlodo.length > 10) info(`  … és még ${osszesIsmetlodo.length - 10}`);
  }
  if (osszesHiba.length) {
    figyelem(`${osszesHiba.length} kérdés hibás, ezek NEM mentek fel:`);
    osszesHiba.slice(0, 20).forEach((s) => info(`  ${s}`));
    if (osszesHiba.length > 20) info(`  … és még ${osszesHiba.length - 20}`);
  }
  if (proba) {
    console.log('');
    figyelem('Próba volt: semmi nem íródott ki. Futtasd újra --proba nélkül.');
  }
}

// A valtozott kerdesek es a torlendok kiirasa kotegekben.
async function kiirasokat(feldolgozott, irandoIdk, torlendoIdk, bankKod) {
  for (let i = 0; i < irandoIdk.length; i += KOTEG_MERET) {
    const koteg = db().batch();
    for (const id of irandoIdk.slice(i, i + KOTEG_MERET)) {
      const { publikus, kulcs } = feldolgozott.kerdesek.get(id);
      koteg.set(db().doc(`kerdesek/${id}`), publikus);
      koteg.set(db().doc(`kulcsok/${id}`), kulcs);
    }
    await koteg.commit();
  }

  for (let i = 0; i < torlendoIdk.length; i += KOTEG_MERET) {
    const koteg = db().batch();
    for (const id of torlendoIdk.slice(i, i + KOTEG_MERET)) {
      koteg.delete(db().doc(`kerdesek/${id}`));
      koteg.delete(db().doc(`kulcsok/${id}`));
    }
    await koteg.commit();
  }

  // A bank dokumentuma (benne a hash-tabla) csak a kerdesek utan frissul, hogy
  // egy felbeszakadt publikalas utan a kovetkezo futas ujra megprobalja.
  await db().doc(`bankok/${bankKod}`).set({
    ...feldolgozott.bankDokumentum,
    publikalva: new Date(),
  });
}
