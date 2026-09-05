// Firebase hibakodok -> ertheto magyar mondatok.
//
// A diak telefonjan sose jelenjen meg angol hibakod. Ha valamit nem ismerunk fel,
// altalanos, de nyugtato uzenetet adunk, es a reszletet a konzolba irjuk.

const UZENETEK = {
  'auth/invalid-credential': 'Hibás azonosító vagy jelszó.',
  'auth/wrong-password': 'Hibás azonosító vagy jelszó.',
  'auth/user-not-found': 'Nincs ilyen azonosító ebben az osztályban.',
  'auth/invalid-email': 'Ez az azonosító nem érvényes.',
  'auth/email-already-in-use': 'Ezzel az azonosítóval már regisztráltak. Lépj be a jelszavaddal!',
  'auth/weak-password': 'A jelszó legalább 6 karakter legyen.',
  'auth/too-many-requests': 'Túl sok próbálkozás. Várj egy percet, aztán próbáld újra.',
  'auth/network-request-failed': 'Nincs internetkapcsolat. Ellenőrizd a wifit.',
  'auth/user-disabled': 'Ez a fiók le van tiltva. Szólj a tanárodnak.',

  'permission-denied': 'Ehhez nincs jogosultságod.',
  'unavailable': 'A szolgáltatás most nem elérhető. Próbáld újra egy perc múlva.',
  // A Spark csomag napi ingyenes kerete elfogyott (terv 9.3).
  'resource-exhausted':
    'A rendszer elérte a napi ingyenes keretét. Az eredmény most nem menthető – ' +
    'szólj a tanárodnak.',
};

export function magyarHiba(hiba) {
  const kod = hiba?.code || '';
  if (UZENETEK[kod]) return UZENETEK[kod];
  console.error('ICDL Gyakorlo - kezeletlen hiba:', hiba);
  return 'Valami nem sikerült. Próbáld újra, és ha úgy sem megy, szólj a tanárodnak.';
}
