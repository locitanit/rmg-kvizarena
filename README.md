# RMG Kvízaréna

Osztálytermi kvízverseny a Radnóti digitális kultúra óráihoz. A tanár órán élő kvízt indít
az osztálynak a diasor aktuális állásához igazítva, a diákok telefonról versenyeznek, és
csillagokat gyűjtenek órai munka jegyre.

**Állapot:** mind az 5 fázis kész. A Firebase projekt él (europe-west1), a biztonsági
szabályok ki vannak küldve, az oldal fent van a GitHub Pages-en, és **2809 kérdés**
publikálva 21 bankból, és az élő kvíz végigmegy (lobbi, pontozás, ranglista,
összeomlás utáni folytatás), a csillagrendszer, a statisztikák és az önálló
gyakorló mód is működik. **Hátra: a diákazonosítók feltöltése és az éles kipróbálás.**

- Diák: <https://locitanit.github.io/rmg-kvizarena/>
- Tanári pult: <https://locitanit.github.io/rmg-kvizarena/tanar.html>

- A teljes terv: [`docs/IMPLEMENTACIOS_TERV.md`](docs/IMPLEMENTACIOS_TERV.md)
- Beüzemelés lépésről lépésre: [`docs/telepites.md`](docs/telepites.md)
- Tanári súgó: [`docs/tanari_sugo.md`](docs/tanari_sugo.md)
- Adatvédelmi tájékoztató: [`docs/adatvedelmi_tajekoztato.md`](docs/adatvedelmi_tajekoztato.md)
- A repó szabályai: [`CLAUDE.md`](CLAUDE.md)

## Röviden

| | |
|---|---|
| Hosting | GitHub Pages (statikus) |
| Adatbázis, belépés | Firebase Spark csomag — **bankkártya nélkül** |
| Szerveroldali kód | nincs (a Spark csomagon nem elérhető a Cloud Functions) |
| Kérdésbank | a tanár munkamappájából, kb. 2900 kérdés 21 bankban |
| Belépés | a diák meglévő azonosítója — se név, se e-mail nem kerül a felhőbe |

## Mi van a repóban

```
web/          a GitHub Pages-re menő felület (index.html = diák, tanar.html = tanári pult)
admin/        a tanár gépén futó parancssor (rmg-admin)
firestore.rules   az EGYETLEN védelmi vonal — nincs mögötte szerver
tesztek/rules/    emulátoros bizonyíték, hogy a szabályok tényleg tiltanak
docs/         a terv és a beüzemelési útmutató
```

## Első lépések

Részletesen: [`docs/telepites.md`](docs/telepites.md). Röviden:

```powershell
cd C:\Loci\prog\rmg-kvizarena
npm install
copy admin\config.pelda.json admin\config.json
```

Aztán a Firebase projekt (**europe-west régió!**), a `web/js/firebase-config.js`
kitöltése, és:

```powershell
npm run teszt
node admin\rmg-admin.js tanar hozzaad sajat@email.hu "Vezetek Kereszt"
```

## Fázisok

| | |
|---|---|
| 0. Kérdésbank felkészítése | ✅ kész (a tanári munkamappában: `kvizbazis\_diarend\`) |
| 1. Váz és belépés | ✅ kész (a diákazonosítók feltöltése hátra) |
| 2. Kérdésbank publikálása, kvízösszeállítás | ✅ kész |
| 3. Az élő kvíz | ✅ kész |
| 4. Csillagok és statisztika | ✅ kész |
| 5. Gyakorlás és csiszolás | ✅ kész |
| 6/A. Képes kérdések | ✅ kész |
| 6/B. Címkeszűrő (ICDL-mintakérdések) | ✅ kész |
| 6/C. Új rangsorolás (a jó válaszok száma dönt) | ✅ kész |
