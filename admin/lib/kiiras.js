// Egyseges kepernyore iras. Minden uzenet magyar.

export const ok = (uzenet) => console.log(`  OK   ${uzenet}`);
export const info = (uzenet) => console.log(`       ${uzenet}`);
export const fejlec = (uzenet) => console.log(`\n${uzenet}\n${'-'.repeat(uzenet.length)}`);
export const figyelem = (uzenet) => console.log(`  !    ${uzenet}`);

export function tablazat(sorok, fejlecek) {
  if (!sorok.length) return info('(nincs adat)');
  const oszlopok = fejlecek.map((f, i) =>
    Math.max(f.length, ...sorok.map((s) => String(s[i] ?? '').length)));
  const sor = (ertekek) =>
    '  ' + ertekek.map((e, i) => String(e ?? '').padEnd(oszlopok[i])).join('  ');
  console.log(sor(fejlecek));
  console.log('  ' + oszlopok.map((sz) => '-'.repeat(sz)).join('  '));
  sorok.forEach((s) => console.log(sor(s)));
}

// Egyszeru kapcsolo-feldolgozas: --kulcs ertek  vagy  --kapcsolo
export function kapcsolok(argv) {
  const eredmeny = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const elem = argv[i];
    if (elem.startsWith('--')) {
      const nev = elem.slice(2);
      const kovetkezo = argv[i + 1];
      if (kovetkezo && !kovetkezo.startsWith('--')) {
        eredmeny[nev] = kovetkezo;
        i++;
      } else {
        eredmeny[nev] = true;
      }
    } else {
      eredmeny._.push(elem);
    }
  }
  return eredmeny;
}
