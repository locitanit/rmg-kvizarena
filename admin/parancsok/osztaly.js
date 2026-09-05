// icdl-admin osztaly letrehoz|lista|kod
//
// Egy osztaly harom helyre kerul:
//   osztalyok/<id>             - a teljes adat, csak a tanar lathatja (belepokod!)
//   osztalyok_nyilvanos/<id>   - csak a nev, hogy a belepokepernyo legorduloje
//                                kitoltheto legyen belepes ELOTT
//   belepok/<belepokod>        - a kod feloldasa osztalyra a regisztraciohoz
//                                (csak "get", listazni nem lehet)

import { auth, db } from '../lib/firebase.js';
import { ok, info, fejlec, figyelem, tablazat } from '../lib/kiiras.js';
import { belepokodotGeneral } from '../lib/azonositok.js';

export async function osztalyParancs(argumentumok, kapcsolo, config) {
  const alparancs = argumentumok[0];

  if (alparancs === 'letrehoz') return letrehoz(argumentumok[1], kapcsolo, config);
  if (alparancs === 'lista') return lista();
  if (alparancs === 'kod') return kod(argumentumok[1], kapcsolo);

  throw new Error('Hasznalat: icdl-admin osztaly letrehoz|lista|kod');
}

// A kvizt indito tanar uid-je. Alapbol a config.json "tanar_email" mezoje.
async function tanarUidKeres(kapcsolo, config) {
  const email = kapcsolo.tanar || config.tanar_email;
  if (!email) {
    throw new Error(
      'Nem tudom, kihez tartozzon az osztaly.\n' +
      '  Ird be a config.json "tanar_email" mezojebe, vagy add meg igy:\n' +
      '    icdl-admin osztaly letrehoz 10T --tanar tanar@radnoti.hu'
    );
  }
  const felhasznalo = await auth().getUserByEmail(email).catch(() => null);
  if (!felhasznalo) {
    throw new Error(
      `Nincs ilyen fiok: ${email}\n` +
      `  Elobb hozd letre:  icdl-admin tanar hozzaad ${email} "Vezetek Kereszt"`
    );
  }
  const tanarDok = await db().doc(`tanarok/${felhasznalo.uid}`).get();
  if (!tanarDok.exists) {
    throw new Error(
      `A(z) ${email} fioknak nincs tanari joga.\n` +
      `  Add meg:  icdl-admin tanar hozzaad ${email} "Vezetek Kereszt"`
    );
  }
  return felhasznalo.uid;
}

async function letrehoz(osztalyId, kapcsolo, config) {
  if (!osztalyId) throw new Error('Hasznalat: icdl-admin osztaly letrehoz <osztaly>');

  const tanarUid = await tanarUidKeres(kapcsolo, config);
  const tanev = kapcsolo.tanev || config.tanev || '2026_27';
  const hivatkozas = db().doc(`osztalyok/${osztalyId}`);
  const meglevo = await hivatkozas.get();

  if (meglevo.exists) {
    figyelem(`A(z) ${osztalyId} osztaly mar letezik - csak a tanart frissitem.`);
    await hivatkozas.set({ tanarok: [...new Set([...(meglevo.data().tanarok || []), tanarUid])] },
      { merge: true });
    info(`Belepokod: ${meglevo.data().belepokod}`);
    return;
  }

  const belepokod = belepokodotGeneral(osztalyId);
  const koteg = db().batch();

  koteg.set(hivatkozas, {
    nev: kapcsolo.nev || osztalyId,
    tanev,
    belepokod,
    tanarok: [tanarUid],
    letrehozva: new Date(),
    aktiv: true,
  });
  koteg.set(db().doc(`osztalyok_nyilvanos/${osztalyId}`), {
    nev: kapcsolo.nev || osztalyId, tanev, aktiv: true,
  });
  koteg.set(db().doc(`belepok/${belepokod}`), { osztalyId });

  await koteg.commit();

  ok(`Letrejott a(z) ${osztalyId} osztaly (${tanev}).`);
  info(`Belepokod a diakoknak: ${belepokod}`);
  info(`Kovetkezo lepes:  icdl-admin diakok ${osztalyId}`);
}

async function lista() {
  const pillanat = await db().collection('osztalyok').get();
  fejlec('Osztalyok');
  const sorok = [];
  for (const dok of pillanat.docs) {
    const tagok = await dok.ref.collection('tagok').count().get();
    sorok.push([dok.id, dok.data().tanev, dok.data().belepokod, tagok.data().count]);
  }
  tablazat(sorok, ['osztaly', 'tanev', 'belepokod', 'tagok']);
}

async function kod(osztalyId, kapcsolo) {
  if (!osztalyId) throw new Error('Hasznalat: icdl-admin osztaly kod <osztaly> [--uj]');

  const hivatkozas = db().doc(`osztalyok/${osztalyId}`);
  const dok = await hivatkozas.get();
  if (!dok.exists) throw new Error(`Nincs ilyen osztaly: ${osztalyId}`);

  if (!kapcsolo.uj) {
    fejlec(`${osztalyId} belepokod`);
    info(dok.data().belepokod);
    return;
  }

  const ujKod = belepokodotGeneral(osztalyId);
  const koteg = db().batch();
  koteg.delete(db().doc(`belepok/${dok.data().belepokod}`));
  koteg.set(db().doc(`belepok/${ujKod}`), { osztalyId });
  koteg.set(hivatkozas, { belepokod: ujKod }, { merge: true });
  await koteg.commit();

  ok(`Uj belepokod: ${ujKod}`);
  figyelem('A regi kod ettol kezdve nem mukodik.');
}
