// CSV-letoltes a tanari feluletrol.
//
// A cel az, hogy a fajl DUPLA KATTINTASRA, ekezethelyesen nyiljon meg magyar
// Excelben. Ehhez harom dolog kell:
//   1. BOM (﻿) a fajl elejen - enelkul az Excel a rendszer kodlapjaval
//      probalkozik, es az ekezetek elromlanak
//   2. pontosvesszo elvalaszto - a magyar podnak a vesszo a tizedesjel
//   3. CRLF sorvege

const BOM = '﻿';

function mezo(ertek) {
  if (ertek === null || ertek === undefined) return '';
  const szoveg = String(ertek);
  // Idezojelbe tesszuk, ha elvalasztot, idezojelet vagy sortorest tartalmaz.
  return /[;"\n\r]/.test(szoveg) ? `"${szoveg.replace(/"/g, '""')}"` : szoveg;
}

export function csvSzoveg(fejlec, sorok) {
  return BOM + [fejlec, ...sorok].map((sor) => sor.map(mezo).join(';')).join('\r\n');
}

// Tizedes vesszovel, hogy az Excel szamnak lassa.
export const szazalek = (arany) =>
  arany === null || arany === undefined ? '' : String(Math.round(arany * 1000) / 10).replace('.', ',');

export function csvLetolt(fajlnev, fejlec, sorok) {
  const blob = new Blob([csvSzoveg(fejlec, sorok)], { type: 'text/csv;charset=utf-8' });
  const cim = URL.createObjectURL(blob);
  const hivatkozas = document.createElement('a');
  hivatkozas.href = cim;
  hivatkozas.download = fajlnev.endsWith('.csv') ? fajlnev : `${fajlnev}.csv`;
  document.body.append(hivatkozas);
  hivatkozas.click();
  hivatkozas.remove();
  URL.revokeObjectURL(cim);
}

// Fajlnevbe valo datum: 2026-09-05
export const maiDatum = () => new Date().toISOString().slice(0, 10);

// Ekezet nelkuli, szokoz nelkuli fajlnevresz.
export const fajlnevre = (szoveg) => String(szoveg)
  .normalize('NFD').replace(/\p{Mn}/gu, '')
  .replace(/[^A-Za-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 60) || 'export';
