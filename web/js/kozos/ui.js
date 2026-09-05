// Apro DOM-segedek. Nincs keretrendszer - ennyi eleg.

export const elem = (azonosito) => document.getElementById(azonosito);

// Kepernyovaltas: minden <section data-kepernyo> kozul egy latszik.
export function kepernyo(nev) {
  document.querySelectorAll('[data-kepernyo]').forEach((szakasz) => {
    szakasz.hidden = szakasz.dataset.kepernyo !== nev;
  });
}

export function uzenet(azonosito, szoveg, tipus = 'hiba') {
  const doboz = elem(azonosito);
  if (!doboz) return;
  doboz.textContent = szoveg || '';
  doboz.className = `uzenet ${tipus}`;
  doboz.hidden = !szoveg;
}

// Gomb letiltasa a halozati muvelet idejere, hogy ne lehessen duplan kattintani.
export async function gombbal(gomb, muvelet) {
  const eredetiSzoveg = gomb.textContent;
  gomb.disabled = true;
  gomb.textContent = 'Egy pillanat...';
  try {
    return await muvelet();
  } finally {
    gomb.disabled = false;
    gomb.textContent = eredetiSzoveg;
  }
}

// Hatarozott nevelo szam ele: 1, 5 es a szazas/ezres alakjaik "az"-t kapnak
// (az egy, az ot, az ezer). Minden mas "a".
export function nevelo(szam) {
  const elso = String(Math.abs(Math.trunc(szam)))[0];
  const jegyek = String(Math.abs(Math.trunc(szam))).length;
  const azOtos = elso === '5';
  const azEgyes = elso === '1' && (jegyek === 1 || jegyek === 4 || jegyek === 7);
  return azOtos || azEgyes ? 'az' : 'a';
}
