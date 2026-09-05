// Firebase hibakodok -> ertheto magyar mondatok.
//
// A diak telefonjan sose jelenjen meg angol hibakod. Ha valamit nem ismerunk fel,
// altalanos, de nyugtato uzenetet adunk, es a reszletet a konzolba irjuk.

const UZENETEK = {
  'auth/invalid-credential': 'Hibas azonosito vagy jelszo.',
  'auth/wrong-password': 'Hibas azonosito vagy jelszo.',
  'auth/user-not-found': 'Nincs ilyen azonosito ebben az osztalyban.',
  'auth/invalid-email': 'Ez az azonosito nem ervenyes.',
  'auth/email-already-in-use': 'Ezzel az azonositoval mar regisztraltak. Lepj be a jelszavaddal!',
  'auth/weak-password': 'A jelszo legalabb 6 karakter legyen.',
  'auth/too-many-requests': 'Tul sok probalkozas. Varj egy percet, aztan probald ujra.',
  'auth/network-request-failed': 'Nincs internetkapcsolat. Ellenorizd a wifit.',
  'auth/user-disabled': 'Ez a fiok le van tiltva. Szolj a tanarodnak.',

  'permission-denied': 'Ehhez nincs jogosultsagod.',
  'unavailable': 'A szolgaltatas most nem elerheto. Probald ujra egy perc mulva.',
  // A Spark csomag napi ingyenes kerete elfogyott (terv 9.3).
  'resource-exhausted':
    'A rendszer elerte a napi ingyenes kereteet. Az eredmeny most nem mentheto - ' +
    'szolj a tanarodnak.',
};

export function magyarHiba(hiba) {
  const kod = hiba?.code || '';
  if (UZENETEK[kod]) return UZENETEK[kod];
  console.error('ICDL Gyakorlo - kezeletlen hiba:', hiba);
  return 'Valami nem sikerult. Probald ujra, es ha megsem megy, szolj a tanarodnak.';
}
