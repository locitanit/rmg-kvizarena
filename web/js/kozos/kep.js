// Kepes kerdes megjelenitese: <img> a kerdesszoveg ala.
//
// SOHA nem innerHTML: a felirat es a data URI is a kvizbazisbol jon, es
// szovegkent kell kezelni. Az SVG data URI <img src>-kent nem futtat szkriptet,
// de innerHTML-lel beszurva igen - ezert csak igy szabad kirakni.

export function kepetKirak(tarolo, kep) {
  if (!tarolo) return;
  tarolo.innerHTML = '';
  tarolo.hidden = !kep || !kep.adat;
  if (tarolo.hidden) return;

  const img = document.createElement('img');
  img.src = kep.adat;
  img.alt = kep.felirat || '';
  img.style.width = `${kep.szelesseg || 100}%`;

  const felirat = document.createElement('div');
  felirat.className = 'kepfelirat';
  felirat.textContent = kep.felirat || '';

  tarolo.append(img, felirat);
}
