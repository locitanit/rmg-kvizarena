// icdl-admin jelszo <osztaly> <azonosito> [uj jelszo]
//
// Mivel a diakoknak nincs valodi e-mail cimuk, az "elfelejtett jelszo" link nem
// mukodik. Helyette a tanar allit be ujat, sajat gepen, ingyen.

import { auth } from '../lib/firebase.js';
import { szintetikusEmail, jelszotGeneral } from '../lib/azonositok.js';
import { ok, info } from '../lib/kiiras.js';

export async function jelszoParancs([osztalyId, azonosito, megadott]) {
  if (!osztalyId || !azonosito) {
    throw new Error('Hasznalat: icdl-admin jelszo <osztaly> <azonosito> [uj jelszo]');
  }

  const email = szintetikusEmail(azonosito, osztalyId);
  const felhasznalo = await auth().getUserByEmail(email).catch(() => null);
  if (!felhasznalo) {
    throw new Error(
      `Nincs ilyen fiok: ${azonosito} (${osztalyId})\n` +
      `  Lehet, hogy a diak meg nem regisztralt. Ellenorizd:\n` +
      `    icdl-admin diakok ${osztalyId}`
    );
  }

  const jelszo = megadott || jelszotGeneral();
  if (jelszo.length < 6) throw new Error('A jelszo legalabb 6 karakter legyen.');

  await auth().updateUser(felhasznalo.uid, { password: jelszo });

  ok(`Uj jelszo beallitva: ${azonosito} (${osztalyId})`);
  info(`Jelszo: ${jelszo}`);
}
