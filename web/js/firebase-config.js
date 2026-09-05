// A webes Firebase-konfiguracio.
//
// EZ NYUGODTAN PUBLIKUS LEHET. Nem titok: nem ez veszi a rendszert, hanem a
// firestore.rules. Barki elolvashatja a bongeszo forrasabol - ez igy van rendjen.
//
// Honnan szedd:
//   Firebase konzol > Projekt beallitasai > Altalanos > "Sajat alkalmazasok" >
//   Web-alkalmazas > SDK beallitasa es konfiguralas > "Konfiguracio"
//
// A projektet europe-west regioban kell letrehozni (adatvedelem).

export const FIREBASE_CONFIG = {
  apiKey: 'IDE_JON_AZ_API_KEY',
  authDomain: 'icdl-gyakorlo.firebaseapp.com',
  projectId: 'icdl-gyakorlo',
  storageBucket: 'icdl-gyakorlo.firebasestorage.app',
  messagingSenderId: 'IDE_JON_A_SENDER_ID',
  appId: 'IDE_JON_AZ_APP_ID',
};

// Fejlesztes kozben a helyi emulator ellen dolgozunk. Ezt a cim donti el:
// localhost / 127.0.0.1 -> emulator, barmi mas -> eles Firebase.
export const EMULATOR =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export function konfigKitoltve() {
  return !FIREBASE_CONFIG.apiKey.startsWith('IDE_JON');
}
