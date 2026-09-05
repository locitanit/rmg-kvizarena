# ICDL Gyakorló

Osztálytermi kvízverseny a Radnóti digitális kultúra óráihoz. A tanár órán élő kvízt indít
az osztálynak a diasor aktuális állásához igazítva, a diákok telefonról versenyeznek, és
csillagokat gyűjtenek órai munka jegyre.

**Állapot:** 1. fázis (váz és belépés) — a kód kész, a Firebase projekt beüzemelése hátravan.

- A teljes terv: [`docs/IMPLEMENTACIOS_TERV.md`](docs/IMPLEMENTACIOS_TERV.md)
- Beüzemelés lépésről lépésre: [`docs/telepites.md`](docs/telepites.md)
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
admin/        a tanár gépén futó parancssor (icdl-admin)
firestore.rules   az EGYETLEN védelmi vonal — nincs mögötte szerver
tesztek/rules/    emulátoros bizonyíték, hogy a szabályok tényleg tiltanak
docs/         a terv és a beüzemelési útmutató
```

## Első lépések

Részletesen: [`docs/telepites.md`](docs/telepites.md). Röviden:

```powershell
cd C:\Loci\prog\icdl-gyakorlo
npm install
copy admin\config.pelda.json admin\config.json
```

Aztán a Firebase projekt (**europe-west régió!**), a `web/js/firebase-config.js`
kitöltése, és:

```powershell
npm run teszt
node admin\icdl-admin.js tanar hozzaad sajat@email.hu "Vezetek Kereszt"
```

## Fázisok

| | |
|---|---|
| 0. Kérdésbank felkészítése | ✅ kész (a tanári munkamappában: `kvizbazis\_diarend\`) |
| 1. Váz és belépés | 🔨 folyamatban |
| 2. Kérdésbank publikálása, kvízösszeállítás | |
| 3. Az élő kvíz | |
| 4. Csillagok és statisztika | |
| 5. Gyakorlás és csiszolás | |
