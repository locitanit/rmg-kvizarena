# CLAUDE.md — RMG Kvízaréna

Ezt olvasd elsőként. A teljes terv: **`docs/IMPLEMENTACIOS_TERV.md`** — az az egyetlen
igazság, minden döntés indoklásával együtt. Ez a fájl csak a napi szabályokat sűríti.

## Mi ez

Osztálytermi kvízverseny-alkalmazás (Kahoot-szerű) egy magyar középiskolai digitális
kultúra tanárnak. A tanár órán élő kvízt indít az osztálynak, a diákok telefonról
versenyeznek, és csillagokat gyűjtenek órai munka jegyre. A kérdések a tanár meglévő,
kb. 2900 kérdéses kvízbázisából jönnek, a diasor aktuális állásához igazítva
(„1-től a 43. diáig").

A repó neve `rmg-kvizarena`, mert az első éles használat két ICDL-vizsgás csoport
felkészítése — de a kérdésbank mind a 14 témát lefedi, nem csak az ICDL-t.

## A munka szabályai

- **A Claude Code a `C:\Loci\prog` mappában indul.** Csak az `rmg-kvizarena/` alá dolgozz.
  A `prog/` többi projektje (`rmg_tools`, `rmg_defenders`, …) nem tartozik ide.
- **Minden kimenet magyar**: a felület, a kódkommentek, a commit üzenetek, a dokumentáció.
  Az azonosítók (mappa-, fájl- és változónevek) is magyarul, ékezet nélkül, aláhúzással —
  ahogy a terv adatmodellje mutatja (`osztalyok`, `kerdesek`, `kulcsok`, `kvizek`).
- **Ne írj kérdésbankot a repóba.** A tananyag a tanár munkamappájában él:
  `C:\Loci\munka\radnoti\oraanyagok\kvizbazis\`. Az elérési út egyetlen helyen van:
  `admin/config.json` (a `config.pelda.json` alapján, gitignore-olva).
- **Ne kerüljön a repóba se szolgáltatásfiók-kulcs, se diáknévsor, se valódi diákadat.**
  A webes Firebase-konfig (apiKey) publikus lehet — azt a biztonsági szabályok védik.
- Egy fázis = egy ág + egy PR. A terv 10. pontjában minden fázisnál ott a „Kész, ha"
  feltétel; addig nem megyünk tovább.

## A három tervezési korlát, ami mindent meghatároz

1. **Nincs szerveroldali kód.** A Firebase ingyenes (Spark) csomagján nincs Cloud
   Functions. Ha felmerül, hogy „ezt majd egy Cloud Function csinálja", át kell tervezni.
2. **A tanári böngésző a játékvezető.** Nála van a megoldókulcs, ő javít és pontoz.
   Ezért a kérdés kétfelé van vágva: `kerdesek/` (publikus) és `kulcsok/` (csak tanár
   olvashatja). **A megoldókulcs soha nem juthat el a diák kliensére élő kvíz alatt.**
3. **A biztonsági szabályok az EGYETLEN védelmi vonal.** Nincs mögöttük szerver, ami
   újraellenőrizne. Minden tiltáshoz kell egy emulátoros teszt, ami bizonyítja, hogy egy
   diák nem tudja megkerülni.

## Kétféle diaszám van — el ne rontsd

- **fizikai**: hányadik dia a pptx-ben (e-világ: 134)
- **számozott**: ami a dia sarkában ki van írva (e-világ: 121)

A címlap és a fejezetnyitók nem kapnak számot, ezért tér el a kettő.
**A kvízbázis `dia:` mezője és a tanári felület csúszkája a SZÁMOZOTT diára hivatkozik.**
A `_diarend/<diasor>.json` mindkettőt tartalmazza.

**A `fejezet` mezőt nem tároljuk sehol** — a `dia`-ból és a diarendből számoljuk
publikáláskor. Egy igazság van: a pptx.

## Környezet

- Frontend: sima HTML + CSS + JS modul, keretrendszer nélkül, Firebase JS SDK v10+ ESM
  a CDN-ről. GitHub Pages-re megy.
- Admin CLI: Node + Firebase Admin SDK, a tanár Windows-gépén fut.
- Firebase projekt: **europe-west régió** (adatvédelem).
- Tesztek: Firebase Emulator Suite (offline, ingyenes) + `@firebase/rules-unit-testing`.

## Ha elakadsz

A tervben minden döntéshez oda van írva a **miért**. Ha valami ellentmondásosnak tűnik,
előbb a tervet olvasd újra, és ha tényleg hibás, azt javítsd — ne a kód kerülje meg.
