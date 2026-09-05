# ICDL Gyakorló

Osztálytermi kvízverseny a Radnóti digitális kultúra óráihoz. A tanár órán élő kvízt indít
az osztálynak a diasor aktuális állásához igazítva, a diákok telefonról versenyeznek, és
csillagokat gyűjtenek órai munka jegyre.

**Állapot:** tervezés kész, fejlesztés még nem kezdődött el.

- A teljes terv: [`docs/IMPLEMENTACIOS_TERV.md`](docs/IMPLEMENTACIOS_TERV.md)
- A repó szabályai: [`CLAUDE.md`](CLAUDE.md)

## Röviden

| | |
|---|---|
| Hosting | GitHub Pages (statikus) |
| Adatbázis, belépés | Firebase Spark csomag — **bankkártya nélkül** |
| Szerveroldali kód | nincs (a Spark csomagon nem elérhető a Cloud Functions) |
| Kérdésbank | a tanár munkamappájából, kb. 2900 kérdés 21 bankban |
| Belépés | a diák meglévő azonosítója — se név, se e-mail nem kerül a felhőbe |

## Első lépések

```powershell
cd C:\Loci\prog                 # a Claude Code innen indul
copy icdl-gyakorlo\admin\config.pelda.json icdl-gyakorlo\admin\config.json
# majd a config.json-ban ellenőrizd a kvízbázis útvonalát
```

A megvalósítás hat fázisra van bontva (terv, 10. pont). A 0. fázis — a kérdésbank
diahivatkozásainak rendbetétele — **elkészült**, az eszközei a tanári munkamappában
vannak: `radnoti\oraanyagok\kvizbazis\_diarend\`.
