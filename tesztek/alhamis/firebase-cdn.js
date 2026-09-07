// A Firebase CDN-modulok helyettesitese a tesztekben.
//
// A web/js/ modulok a Firebase SDK-t a gstatic CDN-rol importaljak (nincs build
// lepes). Node alatt ez a https:// import nem oldhato fel, ezert a vitest.config.js
// ide iranyitja. Csak azt kell adnia, ami az IMPORTHOZ kell - a tesztelt
// fuggvenyek (szur, cimkeketOsszeszamol) tiszta fuggvenyek, Firestore nelkul.

const semmi = () => undefined;

export const initializeApp = () => ({});
export const getAuth = () => ({});
export const getFirestore = () => ({});
export const connectAuthEmulator = semmi;
export const connectFirestoreEmulator = semmi;
export const collection = semmi;
export const doc = semmi;
export const getDoc = semmi;
export const getDocs = semmi;
export const setDoc = semmi;
export const updateDoc = semmi;
export const onSnapshot = semmi;
export const writeBatch = semmi;
export const query = semmi;
export const where = semmi;
export const serverTimestamp = semmi;
export const increment = semmi;
