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

const firebaseConfig = {
  apiKey: "AIzaSyDCWtJsE5AHn-ioLc8goUWKuDhAskiu1dc",
  authDomain: "icdl-gyakorlo.firebaseapp.com",
  projectId: "icdl-gyakorlo",
  storageBucket: "icdl-gyakorlo.firebasestorage.app",
  messagingSenderId: "1014593676873",
  appId: "1:1014593676873:web:ed7a6533310456bc7b4198"
};

// Fejlesztes kozben a helyi emulator ellen dolgozunk. Ezt a cim donti el:
// localhost / 127.0.0.1 -> emulator, barmi mas -> eles Firebase.
export const EMULATOR =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Az emulatornak nem kell valodi kulcs, es sajat projektazonositot hasznal.
// Igy a felulet a Firebase projekt letrehozasa ELOTT is kiprobalhato.
const EMULATOR_CONFIG = {
  apiKey: 'demo-kulcs',
  authDomain: 'localhost',
  projectId: 'demo-icdl',
};

export const HASZNALT_CONFIG = EMULATOR ? EMULATOR_CONFIG : FIREBASE_CONFIG;

export function konfigKitoltve() {
  return EMULATOR || !FIREBASE_CONFIG.apiKey.startsWith('IDE_JON');
}
