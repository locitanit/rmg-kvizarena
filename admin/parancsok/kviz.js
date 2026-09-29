// rmg-admin kviz lista <osztaly>
// rmg-admin kviz visszavon <kvizId> [--proba]
//
// Egy hibas kviz (pl. elallitott ora miatt azonnal lezart kerdesek) csillagainak
// visszavonasa. A kviz vegen a tanari kliens negy helyre irt (jatekvezetes.js,
// kviztBefejez) - itt mindet visszacsinaljuk:
//   osztalyok/<o>/tagok/<uid>        csillag_ossz, csillag_aktualis
//   statisztika/<o>_<uid>            csillag_ossz, kvizek_szama, szemelyes_csucs,
//                                    temakor_teljesitmeny, mesterfok, csillag_naplo
//   kvizek/<id>/jatekosok/<uid>      csillag, csillag_reszletek
//   kvizek/<id>                      visszavonva jelzes (az archivum mutatja)
//
// A kviz maga megmarad (archivum, elemzes), csak nem szamit bele a csillagokba
// es a statisztikaba. Ketszer nem lehet visszavonni.

import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/firebase.js';
import { ok, info, fejlec, figyelem, tablazat } from '../lib/kiiras.js';
import { valaszHelyes } from '../../web/js/kozos/kviz.js';
import { ujMesterfokok, ALAP_BEALLITASOK } from '../../web/js/kozos/csillag.js';

export async function kvizParancs(argumentumok, kapcsolo) {
  const [alparancs, cel] = argumentumok;
  if (alparancs === 'lista' && cel) return lista(cel);
  if (alparancs === 'visszavon' && cel) return visszavon(cel, Boolean(kapcsolo.proba));
  throw new Error('Használat: rmg-admin kviz lista <osztaly>\n'
    + '           rmg-admin kviz visszavon <kvizId> [--proba]');
}

async function lista(osztalyId) {
  const pillanat = await db().collection('kvizek').where('osztalyId', '==', osztalyId).get();
  const sorok = pillanat.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.indult?.toMillis?.() ?? 0) - (a.indult?.toMillis?.() ?? 0))
    .map((k) => [
      k.id,
      k.indult?.toDate?.().toLocaleString('hu') ?? '',
      k.cim,
      k.allapot + (k.visszavonva ? ' (visszavonva)' : ''),
      k.osszegzes?.resztvevok ?? '',
    ]);
  fejlec(`Kvízek – ${osztalyId} (legújabb elöl)`);
  tablazat(sorok, ['azonosító', 'indult', 'cím', 'állapot', 'fő']);
}

// Diakonkent es temakoronkent: hany kerdes volt es hanyat talalt el ebben a
// kvizben. Ugyanaz a szamolas, mint a tanari kliens javitasiTerkep-je.
async function temakorokKvizenkent(kvizId, kviz) {
  const kerdesek = await Promise.all(kviz.kerdesIdk.map(async (id) => {
    const [kerdes, kulcs] = await Promise.all([
      db().doc(`kerdesek/${id}`).get(),
      db().doc(`kulcsok/${id}`).get(),
    ]);
    return { id, ...(kerdes.data() || {}), kulcs: kulcs.data() };
  }));
  const valaszok = new Map();
  (await db().collection(`kvizek/${kvizId}/valaszok`).get())
    .forEach((d) => valaszok.set(d.id, d.data()));

  return (uid) => {
    const temakorok = {};
    kerdesek.forEach((kerdes, index) => {
      const valasz = valaszok.get(`${uid}_${index}`);
      const helyes = valasz ? valaszHelyes(kerdes, kerdes.kulcs, valasz.valasz) : false;
      const temakor = kerdes.temakor || '(nincs)';
      if (!temakorok[temakor]) temakorok[temakor] = { jo: 0, ossz: 0 };
      temakorok[temakor].ossz++;
      if (helyes) temakorok[temakor].jo++;
    });
    return temakorok;
  };
}

function temakoroketKivon(osszes, kviz) {
  const eredmeny = {};
  for (const [temakor, adat] of Object.entries(osszes || {})) {
    const jo = Math.max(0, (adat.jo || 0) - (kviz[temakor]?.jo || 0));
    const ossz = Math.max(0, (adat.ossz || 0) - (kviz[temakor]?.ossz || 0));
    if (ossz > 0) eredmeny[temakor] = { jo, ossz };
  }
  return eredmeny;
}

async function visszavon(kvizId, proba) {
  const kvizHiv = db().doc(`kvizek/${kvizId}`);
  const kvizDok = await kvizHiv.get();
  if (!kvizDok.exists) throw new Error(`Nincs ilyen kvíz: ${kvizId}\n  Keresd meg: rmg-admin kviz lista <osztaly>`);
  const kviz = kvizDok.data();
  if (kviz.visszavonva) throw new Error('Ennek a kvíznek a csillagait már visszavontad.');
  if (kviz.allapot !== 'vege') throw new Error('Ez a kvíz még nem ért véget – nincs mit visszavonni.');

  const osztalyId = kviz.osztalyId;
  const beallitasok = { ...ALAP_BEALLITASOK, ...((await db().doc('beallitasok/csillagok').get()).data() || {}) };
  const kvizTemakorei = await temakorokKvizenkent(kvizId, kviz);
  const jatekosok = await db().collection(`kvizek/${kvizId}/jatekosok`).get();

  fejlec(`${proba ? 'PRÓBA – nem írok semmit. ' : ''}Visszavonás: ${kviz.cim}`);

  const koteg = db().batch();
  const sorok = [];
  let osszesCsillag = 0;

  for (const jatekosDok of jatekosok.docs) {
    const uid = jatekosDok.id;
    const jatekos = jatekosDok.data();
    const csillag = jatekos.csillag || 0;
    osszesCsillag += csillag;

    const tagHiv = db().doc(`osztalyok/${osztalyId}/tagok/${uid}`);
    const tag = (await tagHiv.get()).data() || {};
    const statHiv = db().doc(`statisztika/${osztalyId}_${uid}`);
    const stat = (await statHiv.get()).data();

    // A valthato csillagot mar elkolthette (jegyre valtva): 0 ala nem megyunk.
    const ujAktualis = Math.max(0, (tag.csillag_aktualis || 0) - csillag);
    if ((tag.csillag_aktualis || 0) < csillag) {
      figyelem(`${jatekos.becenev || jatekos.azonosito}: már beváltotta a csillagok egy részét – 0-ra állítom.`);
    }
    koteg.update(tagHiv, {
      csillag_ossz: Math.max(0, (tag.csillag_ossz || 0) - csillag),
      csillag_aktualis: ujAktualis,
    });

    if (stat) {
      const naplo = (stat.csillag_naplo || []).filter((b) => b.kvizId !== kvizId);
      const temakor = temakoroketKivon(stat.temakor_teljesitmeny, kvizTemakorei(uid));
      // A jelveny csak akkor marad, ha a javitott szamokkal is kijar - a hibas
      // kviz nem adhatott, csak elvehetett volna.
      const jelvenyek = (stat.mesterfok || []).filter((t) =>
        ujMesterfokok({ [t]: temakor[t] || { jo: 0, ossz: 0 } }, [], beallitasok).length > 0);
      koteg.update(statHiv, {
        csillag_naplo: naplo,
        csillag_ossz: Math.max(0, (stat.csillag_ossz || 0) - csillag),
        kvizek_szama: Math.max(0, (stat.kvizek_szama || 0) - 1),
        szemelyes_csucs: Math.max(0, ...naplo.map((b) => b.szazalek || 0)),
        temakor_teljesitmeny: temakor,
        mesterfok: jelvenyek,
        frissitve: FieldValue.serverTimestamp(),
      });
    }

    koteg.update(jatekosDok.ref, { csillag: 0, csillag_reszletek: [], visszavont_csillag: csillag });
    sorok.push([jatekos.becenev || jatekos.azonosito, csillag, ujAktualis]);
  }

  koteg.update(kvizHiv, { visszavonva: FieldValue.serverTimestamp() });

  tablazat(sorok, ['diák', 'elvett csillag', 'váltható marad']);
  info(`Összesen ${osszesCsillag} csillag, ${sorok.length} diák.`);

  if (proba) {
    info('Ez csak próba volt. Élesben:  node rmg-admin.js kviz visszavon ' + kvizId);
    return;
  }
  await koteg.commit();
  ok('Kész, a csillagokat visszavontam.');
}
