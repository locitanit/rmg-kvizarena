# RMG Kvízaréna – implementációs terv

**Mi ez?** Egy osztálytermi kvízverseny-alkalmazás (Kahoot-szerű), ami a Radnóti
digitális kultúra óráihoz készül. A kérdések a meglévő `radnoti\oraanyagok\kvizbazis\`
bankokból jönnek, a tanár a diasor aktuális állásához igazítva indít kvízt, a diákok
telefonról versenyeznek, és csillagokat gyűjtenek órai munka jegyre.

**Kinek szól ez a dokumentum?** Claude Code-nak, aki megvalósítja. Minden fázis végén
van egy „Kész, ha…" szakasz — az a definíciója annak, hogy a fázis elkészült.

**Készült:** 2026-09-05 · **Repó:** `rmg-kvizarena/` a `C:\Loci\prog` mappában

---

## Hogyan indulj

**Claude Code-ot a `C:\Loci\prog` mappában indítsd.** Onnan a repó az `rmg-kvizarena/`
alkönyvtár, és a dokumentumban minden repóbeli útvonal ehhez képest értendő
(pl. `rmg-kvizarena/web/index.html`).

A `prog/` mappában más projektek is vannak (`rmg_tools`, `rmg_defenders`, …) —
**ezekhez ne nyúlj**, kizárólag az `rmg-kvizarena/` alá dolgozz.

### A tananyag máshol van

A kérdésbank és a diarend nem a repóban él, hanem a tanári munkamappában:

```
C:\Loci\munka\radnoti\oraanyagok\kvizbazis\           ← a 21 kérdésbank (YAML)
C:\Loci\munka\radnoti\oraanyagok\kvizbazis\_diarend\  ← <diasor>.json, 21 diasor
```

Ez **szándékos**: a tananyag a tanár munkamappájában változik, a repó csak olvassa.
Ezért a repóban **nincs** kérdésbank-másolat, és soha ne is kerüljön bele.

Az elérési utat egyetlen helyen adjuk meg: `rmg-kvizarena/admin/config.json`
(a `config.pelda.json` alapján, `.gitignore`-ban). A publikáló ebből olvassa,
hol van a kvízbázis. Ha a mappa nem elérhető, a CLI **álljon meg érthető hibaüzenettel**,
ne dolgozzon üres bankkal.

Fejlesztéshez és teszthez a repó egy **kicsi mintát** tartalmazhat
(`rmg-kvizarena/tesztek/minta/`, 20-30 kérdés) — de az csak teszt-fixture, sosem forrás.

---

## 0. A négy eldöntött kérdés

| Döntés | Választás | Miért |
|---|---|---|
| Diák belépés | **meglévő azonosító + jelszó** | Az `azonositok.txt` azonosítói már léteznek. Se név, se e-mail nem kerül a felhőbe. |
| Használati módok | **órai élő verseny + önálló gyakorlás** | A gyakorlás nem ér csillagot, csak a saját statisztikát javítja. |
| Csillagrendszer | **vegyes: dobogó + személyes csúcs + mesterfok** | 15 fős csoportban a tisztán dobogós rendszernél a leggyengébb harmad soha nem kap semmit. |
| Platform | **GitHub Pages + Firebase Spark (ingyenes)** | Bankkártya nélkül. A korlátokat lásd az 1.2 pontban. |

---

## 1. Technológia

### 1.1 Ami hol fut

```
GitHub Pages  (statikus SPA, ingyenes, HTTPS)
      │
      ├── Firebase Authentication   ← belépés (e-mail/jelszó, szintetikus címmel)
      ├── Cloud Firestore           ← osztályok, kérdések, kvízek, eredmények, élő játék
      │
Tanári gép:
      └── rmg-admin (Node CLI, Firebase Admin SDK)
             ← diákfiókok tömeges létrehozása, jelszó-visszaállítás,
               kérdésbank publikálása a kvizbazis YAML-ekből
```

**Nincs backend szerver.** Ez a legfontosabb tervezési döntés, és mindent meghatároz.

### 1.2 A Spark (ingyenes) csomag korlátai és mit jelentenek

| Erőforrás | Napi/havi keret | Mi fér bele |
|---|---|---|
| Firestore olvasás | 50 000 / nap | Egy 30 kérdéses élő kvíz 15 diákkal kb. 1 500–2 500 olvasás. **Napi 15–20 kvíz** is belefér. |
| Firestore írás | 20 000 / nap | Ugyanez kb. 600 írás/kvíz. Bőven elég. |
| Firestore tárhely | 1 GiB | A teljes kvízbázis (2800 kérdés) néhány MB. |
| Authentication | 50 000 aktív felhasználó/hó | Néhány száz diák — meg sem érzi. |
| **Cloud Functions** | **NEM elérhető Sparkon** | Ez a lényeg: **szerveroldali kód nincs.** |

> **Következmény, amit végig tartani kell:** minden logika vagy a böngészőben fut, vagy
> a Firestore biztonsági szabályaiban, vagy a tanár gépén futó admin CLI-ben. Ha valahol
> „ezt majd egy Cloud Function csinálja" gondolat merül fel, azt át kell tervezni.

**Költségvédelem:** a Spark csomag nem tud túlköltekezni (nincs kártya), a limit
elérésekor egyszerűen leáll a napra. Ezt a felületnek kezelnie kell (barátságos hibaüzenet,
lásd 9.3).

### 1.3 Frontend

- **Sima HTML + CSS + JavaScript modulok, keretrendszer nélkül.** Indok: a diákok
  telefonján gyorsan kell betöltenie, a projekt egyszerű, és a tanár maga is érti majd.
  A Firebase JS SDK v10+ modulárisan, ESM importtal a CDN-ről.
- Két belépési pont: `index.html` (diák) és `tanar.html` (tanári pult). Külön oldal, mert
  a két felület nagyon eltér, és így a diák böngészőjébe be sem töltődik a tanári kód.
- **Reszponzív, mobilelső a diákfelületen** (a diák telefonon van), **asztali/projektoros
  a tanári pulton** (a kivetítőn a kérdés és a ranglista megy).
- Sötét/világos téma: a diák telefonján rendszertéma szerint.

### 1.4 A tanári böngésző a „szerver"

Mivel nincs Cloud Function, az élő kvíz alatt **a tanár böngészője a játékvezető**:
kiosztja a kérdést, figyeli a beérkező válaszokat, **javít** (nála van a megoldókulcs),
pontoz, és kiírja az eredményt. A diák kliense soha nem látja a helyes választ, amíg
a kérdés le nem zárul.

> **Ezt a tanárnak tudnia kell:** az élő kvíz alatt a tanári oldalnak nyitva kell maradnia.
> Ha lezárja a fület, a kvíz megáll (nem vész el: a folyamatban lévő állapot a Firestore-ban
> van, újranyitás után folytatható — lásd 6.4).

---

## 2. Adatmodell (Firestore)

Elnevezés: magyar, kisbetű, ékezet nélkül — a projekt többi részéhez igazodva.

```
osztalyok/{osztalyId}
  nev: "10T"                      # megjelenítendő név
  tanev: "2026_27"
  belepokod: "10T-K7QX"           # ezzel csatlakozik a diák regisztrációkor
  tanarok: [uid, ...]             # akik indíthatnak neki kvízt
  letrehozva, aktiv: true

osztalyok/{osztalyId}/tagok/{uid}
  azonosito: "kovacs_b12"         # az azonositok.txt-ből, ez a diák publikus neve
  becenev: "Bence"                # amit a ranglistán mutatunk (a diák állítja, moderálható)
  csillag_ossz: 7                 # összes valaha szerzett csillag
  csillag_aktualis: 2             # a beváltás óta gyűlt csillagok (5-nél jár az ötös)
  jegyek: 1                       # hányszor váltott már be
  csatlakozott: <ts>

# ---- a kérdésbank publikált másolata (az admin CLI tölti fel) ----
diasorok/{diasorKod}              # pl. "adatbaziskezeles_icdl" — a _diarend/<kod>.json
  tema: "adatbaziskezeles"
  forras_pptx: "Adatbaziskezeles_2026_ICDL.pptx"
  verzio: "2026-09-02"            # a pptx építésének dátuma
  szamozott_diaszam: 129          # a csúszka felső határa
  fizikai_diaszam: 145
  fejezetek: [ {szam: 12, cim: "Űrlapok", elso_dia: 104, utolso_dia: 111}, ... ]
  diak: [ {szamozott: 43, cim: "Űrlap varázslóval"}, ... ]   # csak a számozott diák

bankok/{bankKod}                  # pl. "adatbaziskezeles_2026_icdl" — egy YAML = egy bank
  cim: "Adatbázis-kezelés (ICDL)"
  tema: "adatbaziskezeles"
  diasor: "adatbaziskezeles_icdl" # null, ha a banknak nincs diasora (it_alapismeretek)
  kerdes_db: 178
  temakorok: [ {kod: "urlapok_es_jelentesek", db: 21}, ... ]
  hashok: { <kerdesId>: <hash> }  # a változásfigyeléshez, hogy 1 olvasás elég legyen
  publikalva: <ts>

kerdesek/{kerdesId}               # kerdesId = bankKod + "_" + a kérdésszöveg hash-e
  bank: "adatbaziskezeles_2026_icdl"
  diasor: "adatbaziskezeles_icdl"
  tema: "adatbaziskezeles"
  temakor: "urlapok_es_jelentesek"
  fejezet: 11                     # SZÁMÍTOTT: a fejezetek tömb INDEXE (0-tól), nem a
                                  # fejezet „szam" mezője — az nem egyedi, lásd 4.4/4.
  dia: 105                        # a kérdés SZÁMOZOTT diaszáma (ami a dia sarkában ki van írva)
  dia_verzio: "2026-09-02"
  tipus: "feleletvalasztos" | "igaz_hamis" | "tobb_valasztos" | "parosito" | "rovid_valasz"
  kerdes: "…"
  valaszok: [...]                 # feleletválasztósnál/többválasztósnál
  parok_bal: [...]                # párosítónál csak a bal oldal + a kevert jobb oldal
  parok_jobb_kevert: [...]
  nehezseg: 1..3
  cimkek: [...]
  kep: {                          # OPCIONÁLIS, csak képes kérdésnél (6. fázis A)
    adat: "data:image/png;base64,…",   # a fájl BEÁGYAZVA — nincs külön tárhely,
    felirat: "Négy hálózati ikon…",    # így nem kell új biztonsági szabály sem
    szelesseg: 50,                     # a szövegtükör %-a, 1–100
    mime: "image/png",
    meret: 12345                       # bájt (diagnosztika; a publikáló 200 KB fölött hibát ad)
  }
  # FIGYELEM: a helyes válasz NINCS ebben a dokumentumban. A kép sem árulhatja
  # el a választ — ez a kérdésbank felelőssége (kvizbazis/SEMA.md 1. szabálya).

kulcsok/{kerdesId}                # csak tanár olvashatja (lásd 3. pont)
  helyes: [2] | "igaz" | ["ciklusváltozó","számláló"] | [{bal,jobb}...]
  magyarazat: "…"

# ---- egy lefuttatott kvíz ----
kvizek/{kvizId}
  osztalyId, tanarUid
  cim: "Űrlapok és jelentések – ismétlés"
  valogatas: { tema, mod: "dia"|"fejezet"|"temakor", dia_tol, dia_ig,
               fejezetek: [...], temakorok: [...], nehezseg_max: 3, db: 12 }
  kerdesIdk: [...]                # a kisorsolt kérdések, rögzített sorrendben
  allapot: "varakozik"|"kerdes"|"eredmeny"|"vege"
  aktualis: 0                     # hányadik kérdésnél tartunk
  kerdes_indult: <ts>             # a szerveridő-bélyeg a kérdés kiosztásakor
  ido_limit: 25                   # másodperc
  pin: "418293"                   # a lobbihoz
  indult, vege: <ts>

kvizek/{kvizId}/jatekosok/{uid}
  becenev, azonosito
  pont: 0
  helyes_db: 0
  utolso_valasz_ms: 0             # a legutóbbi reakcióidő, a holtverseny eldöntésére
  helyezes: 3                     # a kvíz végén beírva
  csillag: 1                      # a kvíz végén beírva

kvizek/{kvizId}/valaszok/{uid}_{kerdesIndex}
  uid, kerdesIndex, valasz, kuldve_ms
  # a diák CSAK írni tud ide, olvasni nem — hogy ne lássa mások válaszát

# ---- statisztika (a tanári kliens írja a kvíz végén, hogy ne kelljen összesíteni) ----
statisztika/{osztalyId}_{uid}
  temakor_teljesitmeny: { "urlapok_es_jelentesek": {jo: 14, ossz: 18}, ... }
  szemelyes_csucs: 0.82           # a legjobb kvíz-százaléka
  kvizek_szama, csillag_ossz
  mesterfok: ["kartevok", ...]    # amely témakörökre már megkapta a mesterfok csillagot
```

### 2.1 Miért van külön a `kerdesek` és a `kulcsok`

Ez a csalásvédelem gerince. A diák kliense a `kulcsok` kollekciót **nem tudja olvasni**
(biztonsági szabály tiltja). A javítást a tanári kliens végzi. Így hiába nyitja meg a diák
a fejlesztői eszközöket, a helyes válasz nincs a gépén.

---

## 3. Biztonsági szabályok (Firestore rules)

Az alábbi elveket kell szabályokká írni. **Ez nem kiegészítő feladat, hanem a rendszer
egyetlen védelmi vonala** — nincs mögötte szerver, ami újraellenőrizne.

| Kollekció | Diák | Tanár |
|---|---|---|
| `osztalyok/{id}` | olvashatja, ha tagja | írhatja, ha benne van a `tanarok`-ban |
| `osztalyok/{id}/tagok/{uid}` | **csak a sajátját** olvassa és a `becenev`-et írja | mindet olvassa és írja |
| `kerdesek/**` | olvashatja (kulcs nélkül) | olvashatja |
| `kulcsok/**` | **semmit** | olvashatja |
| `kvizek/{id}` | olvashatja, ha az osztálya kvízje | írhatja, ha ő indította |
| `kvizek/{id}/jatekosok/{uid}` | mindet **olvashatja** (ez a ranglista), csak a sajátját hozza létre | mindet írja |
| `kvizek/{id}/valaszok/**` | **csak írni**, csak a saját uid-jével, csak egyszer kérdésenként | mindet olvassa |
| `statisztika/{osztalyId}_{uid}` | csak a sajátját olvassa | mindet olvassa és írja |

**Amit a szabályokban külön ki kell kényszeríteni:**

1. A `valaszok` dokumentum **nem írható felül** (`allow create` igen, `allow update` nem) —
   különben a diák a lezárás után javíthatná.
2. A `valaszok` írása csak akkor engedett, ha a kvíz `allapot == "kerdes"` és a
   `kerdesIndex == kviz.aktualis`. Ez rules-ból `get()`-tel olvasható.
3. A `jatekosok/{uid}.pont` mezőt **diák nem írhatja** — csak a tanári uid.
4. A `csillag_*` mezőket szintén csak tanár írhatja.
5. Tanári jogosultság: külön `tanarok/{uid}` kollekció, amit **csak az admin CLI hoz létre**.
   Soha ne legyen olyan út, ahol egy kliens tanárrá teheti magát.

> **Tesztelés:** a Firebase Emulator Suite ingyenes és offline megy. A szabályokhoz
> **kötelező** unit teszteket írni (`@firebase/rules-unit-testing`): minden sor fenti
> tiltásra legyen egy „diák megpróbálja, elbukik" teszt.

---

## 4. Kérdés-kiválasztás: a diasorhoz kötés

Ez a kérés lényege: *„1-től a 43-as diáig"*. Három választási mód kell, mert a diasor változhat.

### 4.1 A három mód

1. **Diatartomány** — „`adatbaziskezeles_icdl`, 1–43. dia". A legpontosabb, de a diaszám
   verzióhoz kötött.
2. **Fejezet** — „1–4. fejezet". Stabilabb: a fejezetek ritkábban változnak, mint a diaszámok.
3. **Témakör** — „`urlapok_es_jelentesek` + `export_es_nyomtatas`". A legstabilabb, mert a
   témakörnév a kvízbázis-séma része.

A tanári felületen mindhárom elérhető, **alapértelmezés a diatartomány**, egy csúszkával
(„meddig jutottunk?"), és mellette élőben látszik: *„ebben a tartományban 87 kérdés van"*.

### 4.2 ELŐFELTÉTEL — **elkészült 2026-09-05-én**

A diaszám szerinti válogatásnak két akadálya volt, mindkettő elhárult. Az eszközök a
`radnoti\oraanyagok\kvizbazis\_diarend\` mappában vannak (leírás: `OLVASSEL.md`).

**Amit tudni kell, mielőtt bármit kódolsz:**

- **Kétféle diaszám van.** A *fizikai* a fájlban elfoglalt hely (e-világ: 134), a
  *számozott* az, ami a dia sarkában ki van írva (e-világ: 121) — a címlap és a
  fejezetnyitók nem kapnak számot. **A kvízbázis `dia:` mezője a SZÁMOZOTT diára
  hivatkozik**, és a tanári felület csúszkájának is ezzel kell dolgoznia.
- A `_diarend/<diasor>.json` mind a 21 diasorról tartalmazza diánként a fizikai és a
  számozott sorszámot, a fejezetet, a címkét (KÖZÉP/EMELT/NAT/ICDL/MEGOLDÁS…) és a címet,
  valamint a fejezetek diatartományát. Ez a fájl közvetlenül feltölthető a Firestore
  `diasorok/` kollekciójába.
- **A `fejezet` mezőt NEM tároljuk a kvízbázisban**, mert duplikáció lenne és az első
  diasor-átépítésnél elavulna. A publikáló a `dia`-ból és a `<diasor>.json`-ból számolja
  ki (`dia_ellenorzo.fejezet_feloldo()` ugyanezt csinálja). Egy igazság van: a pptx.

**Amit a 0. fázis rendbe tett:**

- A 2026-09-02-i feladat/megoldás-kettébontás után minden diaszám elcsúszott. A régi
  pptx-ek megmaradtak a `_backup_2026-09-02/` mappában, ezért a régi és a mai diasor
  (fejezet, címke, cím) aláírásait difflib-bel egymáshoz lehetett illeszteni:
  **2640 diahivatkozás íródott át 30 fájlban**, egyetlen régi dia sem veszett el.
- Az ICDL adatbázis-bank 194 kérdése mind `dia: 0` volt. Az érettségi és a teljes diasor
  → ICDL diasor **keresztleképezésével** 76 kérdés kapott valódi diaszámot; a maradék
  118-at (a kifejezetten ICDL-hez írt új kérdéseket) a témakörük fejezetén belül terítettük szét.
- A túllógó és a fejezeten kívülre mutató hivatkozásokat a `dia_javito.py` igazította.

**A mai állapot** (`python3 dia_ellenorzo.py`): 21 bankban **0 túllógó és 0 fejezeten
kívüli** hivatkozás. Marad 35 „kilógó témakör" figyelmeztetés — ezek nem hibák, hanem
jogos kereszthivatkozások (pl. az akadálymentesség témakör a képek fejezet `alt` diájára).

**Két bankot kézzel kell figyelni:**

- `it_biztonsag`: a bank a `_reszek/*.py`-ból épül, ahol a diaszám egy tuple eleme, nem
  `dia:` sor — ott a RÉGI számozás maradt. Ha a `merge.py` újra lefut, újra kell futtatni
  az átszámozást.
- `programozas_2026_oramucsarnok`: generált fájl az RMG Defenders bankjából, a `dia` ott
  szándékosan csak a fejezet eleje.
- `it_alapismeretek`: nincs saját diasora, minden kérdése `dia: 0` — csak témakör szerint
  válogatható.

### 4.3 Publikálás: a kvízbázistól a Firestore-ig

Az `rmg-admin publikal` parancs:

1. Beolvassa a a kvízbázis `**/*.yaml` bankjait bankokat és a `diarend.json`-okat.
2. Kiszedi a `kifejtos` kérdéseket (nem javíthatók gépileg).
3. Kettévágja: publikus rész → `kerdesek/`, megoldókulcs → `kulcsok/`.
4. Tartalom-hash alapján **csak a változott kérdéseket írja** (a napi 20 000 írásos keret
   miatt is, meg hogy gyors legyen).
5. Kiírja, mi változott: *„adatbaziskezeles_icdl: +94 új, 3 módosult, 0 törölt"*.

**Fokozatos bővülés:** a bank egésze felkerül, a *tanár* dönti el kvízenként, meddig
kérdez. Nem kell részletekben publikálni.

### 4.4 Amit a 2. fázis kiderített, és amiatt módosult a 2. pont adatmodellje

A kvízbázis felmérése (17 bank, 2782 kérdés) két ponton cáfolta az eredeti tervet.
Mindkettőt az adatmodellben javítottuk, nem a kódban kerültük meg.

**1. A bank és a diasor nem 1:1.** Két diasorhoz két-két bank tartozik
(`ai_tamogatott_kodolas_2026` + `..._frissitendo` → `AI_kodolas`;
`programozas_2026_erettsegi` + `..._oramucsarnok` → `programozas_erettsegi`), az
`it_alapismeretek_2026`-nak pedig **nincs** diasora (minden kérdése `dia: 0`, csak
témakör szerint válogatható). Ezért a `kerdesId` nem lehet a diasor kódjára építve —
külön `bankok/` kollekció kell, és a kérdés `bank` + `diasor` mezőt is kap.
A bank ↔ diasor összekötése a **pptx fájlnevén** keresztül megy: a bank
`forras_ppt`-jének fájlneve = a diarend `forras_pptx` mezője.

**2. A sorszám nem stabil azonosító.** A bankokat szkriptek állítják elő
(`merge.py`, `merge_icdl.py`), így a kérdések sorrendje bármikor eltolódhat, és egy
sorszám alapú `kerdesId`-nél újrapublikáláskor gyakorlatilag minden kérdés kicserélődne.
Ezért a `kerdesId` a **kérdésszöveg hash-e**: sorrendcserétől és beszúrástól nem változik.
Cserébe egy átfogalmazott kérdés új azonosítót kap (a régi törlődik) — ez vállalt
kompromisszum: az átfogalmazott kérdés statisztikailag amúgy is új kérdés.

**4. A fejezet azonosítója a tömbindex, nem a fejezet száma.** A diarend
`fejezetek` listájában a `szam` mező **nem egyedi**: a számozatlan nyitószakasz
(pl. „BEVEZETÉS") is `szam: 1`-et kap, így ütközik az 1. fejezettel, ráadásul a
számozás ugrik is (11 után 13 jön). Ezért a kérdés `fejezet` mezője a `fejezetek`
tömbben elfoglalt **helyet** tárolja; a megjelenítendő címet a felület ugyanezzel az
indexszel olvassa ki a diasor dokumentumából.

**3. Válogatás: a szűrés a tanár böngészőjében fut, nem lekérdezésben.** A Firestore
összetett lekérdezés lenne (diatartomány + nehézség + témakör), ami indexeket és
korlátokat hozna. Egy bank viszont csak 120–240 kérdés: a tanári pult egyetlen
`where('bank','==',…)` lekérdezéssel behúzza az egészet, és utána memóriában szűr.
Így a találatszámláló **azonnal** frissül a csúszka mozgatására, és nincs szükség
egyetlen összetett indexre sem. Egy kvízösszeállítás ára kb. 200 olvasás — a napi
50 000-es keretbe bőven belefér.

---

## 5. Képernyők

### 5.1 Diák (`index.html`, mobilelső)

| Képernyő | Tartalom |
|---|---|
| Belépés | azonosító + jelszó. Alatta „Első belépés? Osztálykód:" mező. |
| Regisztráció | osztálykód → azonosító → jelszó kétszer → becenév. Ellenőrzi, hogy az azonosító szerepel-e az osztály engedélyezett listáján. |
| Főoldal | csillagok (nagy, látványos), „még N csillag az ötösig", legutóbbi kvízek, gyakorlás gomb |
| Csatlakozás | PIN beírása vagy egy gomb, ha az osztályában épp fut kvíz |
| Játék | kérdés, válaszgombok, visszaszámláló, válasz után „elküldve" + várakozás |
| Kérdés eredménye | jó/rossz, a helyes válasz, magyarázat, aktuális helyezés |
| Végeredmény | dobogó, a szerzett csillagok, mit érdemes ismételni |
| Gyakorlás | témakör- vagy fejezetválasztás, azonnali visszajelzés, nem ér csillagot |
| Statisztikám | témakörönkénti százalék, személyes csúcs, csillagtörténet |

### 5.2 Tanár (`tanar.html`, asztali + projektor)

| Képernyő | Tartalom |
|---|---|
| Osztályok | osztály létrehozása, belépőkód mutatása/újragenerálása, tagok listája, tag eltávolítása |
| Kvíz összeállítása | téma → mód (dia/fejezet/témakör) → tartomány → nehézség → kérdésszám → időlimit. Élő számláló: „87 kérdés felel meg, ebből 12 lesz kisorsolva". Előnézet gomb. |
| Lobby | nagy PIN, csatlakozott diákok listája élőben, „Indítás" gomb |
| Játékvezetés | a kérdés nagyban (kivetítőre), hányan válaszoltak, visszaszámláló, „Lezárás most" és „Következő" gomb |
| Kérdés eredménye | válaszeloszlás oszlopdiagramon, a helyes válasz, ranglista top 5 |
| Végeredmény | dobogó, kiosztott csillagok, „Mentés és lezárás" |
| Kvíz-archívum | minden lefuttatott kvíz, visszakereshetően |
| Egy kvíz elemzése | kérdésenkénti helyes arány (**melyik kérdésnél bukott meg az osztály**), diákonkénti sor |
| Egy diák lapja | minden kvízje, témakörönkénti erősség/gyengeség, csillagtörténet, beváltás |
| Osztálystatisztika | témakörönkénti osztályátlag, időbeli fejlődés, részvétel |
| Csillagbeállítás | a 7. pont kapcsolói |

---

## 6. Az élő kvíz működése

### 6.1 Állapotgép

```
varakozik ──(Indítás)──> kerdes ──(lejárt idő VAGY mind válaszolt VAGY Lezárás)──> eredmeny
                            ↑                                                          │
                            └──────────────(Következő, ha van még)─────────────────────┘
                                                     │
                                            (nincs több) ──> vege
```

A `kvizek/{kvizId}` dokumentum `allapot` és `aktualis` mezője a közös igazság. Minden
kliens `onSnapshot`-tal figyeli. **Egyetlen dokumentum figyelése 15 diáknál 15 olvasás
állapotváltásonként** — ez fér bele a keretbe.

### 6.2 Pontozás egy kérdésen belül

```
alappont      = 100, ha helyes; 0, ha nem
gyorsasagi    = 0…50, lineárisan: (hátralévő idő / időlimit) * 50
kérdéspont    = alappont + gyorsasagi        (max 150)
```

> **Szándékos eltérés a Kahoottól:** ott a gyorsaság a pont felénél is többet nyom, ami
> kapkodásra tanít. Itt a tudás 100 pont, a sebesség maximum 50 — aki gondolkodik és jól
> válaszol, mindig ver egy gyorsan hibázót.

> **Pontosítás (3. fázis):** a gyorsasági pont **csak helyes válaszra** jár. A fenti
> képlet szó szerint a rossz válaszra is adná (0 + gyorsasági), az viszont a gyors
> találgatást jutalmazná — épp azt, amit el akarunk kerülni. Rossz válasz: 0 pont.

Többválasztósnál részpont nincs (mindet el kell találni). Rövid válasznál ékezet- és
kisbetű-független egyezés, a bankban felsorolt bármelyik elfogadott alakkal.

### 6.3 Az időmérés csapdája

A reakcióidőt **nem** a diák gépének órájából számoljuk (átállítható). Két lehetőség,
a másodikat használjuk:

1. ~~kliensoldali `Date.now()` különbség~~ — hamisítható.
2. **A válaszdokumentumba `serverTimestamp()` kerül**, és a tanári kliens ehhez képest
   számol a `kerdes_indult` szerveridőhöz viszonyítva. Kicsit pontatlanabb (hálózati
   késés), de nem csalható.

### 6.3.1 Amit a 3. fázis hozzátett

- **A `kuldve` mezőt a biztonsági szabály kényszeríti szerveridőbélyegre**
  (`request.resource.data.kuldve == request.time`). Enélkül a diák 0 ms reakcióidőt
  írhatna be, és mindig megkapná a teljes gyorsasági pontot.
- **A futó kvízt az osztály `aktiv_kviz` mezője jelzi**, nem lekérdezés. Így a diák
  kliense egyetlen dokumentumot figyel (a saját osztályáét), és sem a diáknak, sem a
  tanárnak nem kell összetett Firestore-indexet építeni.
- **A tanári és a diákfelület egy böngészőben EGY Auth munkamenetet használ.** Ha a
  tanár ugyanabban a böngészőben diákként is belép, az kilépteti a tanárt. A tanári
  oldal ezt felismeri, és érthető üzenetet ad (nem „nincs jogosultságod" hibát).

### 6.4 Ha a tanári gép elszáll

A kvíz állapota a Firestore-ban van. A tanári felület újranyitásakor felajánlja:
*„A `10T · Űrlapok` kvíz a 7. kérdésnél tart. Folytatod?"* A diákok kliense addig
„várakozás a tanárra" képernyőn áll, nem esik ki.

---

## 7. A csillagrendszer

### 7.1 A probléma a tiszta dobogóval

15 fős csoport, félévente 10 kvíz. Tiszta dobogóval kvízenként 3 diák kap csillagot.
Reálisan **ugyanaz az 5-6 gyerek** forog a dobogón, a többi 9-10 diáknak fél év alatt
nulla vagy egy csillagja lesz. Aki egyszer lemaradt, annak nincs oka próbálkozni —
pont az ellenkezője annak, amit a rendszer akar.

### 7.2 Az ajánlott vegyes rendszer

Négy forrásból lehet csillagot szerezni. **Kvízenként legfeljebb 4 csillag** egy diáknak.

| Forrás | Csillag | Feltétel |
|---|---|---|
| **Dobogó** | 3 / 2 / 1 | 1., 2., 3. helyezés a kvíz pontversenyében |
| **Személyes csúcs** | 1 | Az eddigi legjobb kvíz-százalékodat **elérted vagy megdöntötted** (legalább 3 korábbi kvíz után) |
| **Mesterfok** | 1 | Egy témakörben eléred a 80%-ot, legalább 8 megválaszolt kérdésen. **Témakörönként egyszer.** |
| **Kitartás** | 1 | Minden 5. kvíz, amin részt vettél (a puszta megjelenésért) |

**5 csillag = egy órai munka ötös.** Beváltáskor a számláló nullázódik, a diák
újrakezdi a gyűjtést. Az összes valaha szerzett csillag külön számolódik (`csillag_ossz`) —
az a „hírnév", a beváltható a `csillag_aktualis`.

### 7.3 Miért pont ez a négy

- A **személyes csúcs** a saját legjobbadhoz mér, nem az átlagodhoz. Ez fontos: az átlaghoz
  mérés arra ösztönözne, hogy szándékosan rontsd el az elsőt. A csúcshoz mérés nem
  csalható, és magától egyre nehezebb.
- **A csúcs ELÉRÉSE is ér csillagot, nem csak a megdöntése** (`>=`, nem `>`). Enélkül a
  100 %-ot elérő diák soha többé nem kaphatna csúcs-csillagot: a saját tökéletes
  eredményét definíció szerint nem tudja túlszárnyalni. Így viszont a hibátlan
  teljesítmény ismételten jutalmazódik — ami pont a kívánt üzenet.
- A **mesterfok** azt jutalmazza, amit valójában akarsz: hogy a diák egy témát megtanuljon.
  Nem versenyhelyzet, mindenki elérheti, és pont a lemaradókat húzza be.
- A **kitartás** garantálja, hogy a leggyengébb diák is lát haladást. 5 kvíz = 1 csillag,
  vagyis fél év alatt 2 csillag a puszta részvételért. Nem sok, de nem is nulla.

### 7.4 Számoljunk utána (15 fő, 10 kvíz / félév)

| Diáktípus | Dobogó | Csúcs | Mesterfok | Kitartás | Összesen | Jegy |
|---|---:|---:|---:|---:|---:|---:|
| Éllovas (top 2) | 15–20 | 1–2 | 4–5 | 2 | **22–29** | 4–5 ötös |
| Középmezőny | 2–4 | 3–4 | 3–4 | 2 | **10–14** | 2 ötös |
| Lemaradó | 0 | 2–3 | 1–2 | 2 | **5–7** | **1 ötös** |

A kulcsszám az utolsó sor: **a leggyengébb diák is összeszed egy ötöst egy félév alatt**,
ha végig ott van és javul. A tiszta dobogós rendszerben ez a sor 0 lenne.

### 7.4.1 Amit a 4. fázis kiderített

- **A dobogós csillag a HELYEZÉSNEK jár, nem a teljesítménynek.** Kis létszámnál ez
  furcsán jön ki: háromfős próbában a 0%-ot elért diák is kapott 1 csillagot, mert
  harmadik lett. 15 fős csoportban ez nem gond (ott a 3. hely valódi teljesítmény),
  de ha valaha kis csoportban indul kvíz, a tanár a `dobogo_ertekek` átírásával
  (pl. `3,2` vagy `3`) szűkítheti a dobogót.
- **A kvíz lezárása nem ismételhető művelet.** Minden lefutása csillagot ír és növeli
  a kvízszámlálót, ezért kettős zár védi (futás közbeni + állapot-alapú). Enélkül egy
  dupla kattintás duplán adná a csillagokat — ez a próbában meg is történt.

### 7.5 Amit állíthatóvá kell tenni a tanári felületen

Mind a négy forrás **külön ki-be kapcsolható**, és a csillagértékek átírhatók. Az
5-ös küszöb (`5 csillag = ötös`) szintén. Így ha félév közben kiderül, hogy túl könnyű
vagy túl nehéz, nem kell kódot írni.

Kapcsolók: `dobogo_be`, `dobogo_ertekek: [3,2,1]`, `csucs_be`, `csucs_dontetlen_is: true`, `mesterfok_be`,
`mesterfok_kuszob: 0.80`, `mesterfok_min_kerdes: 8`, `kitartas_be`, `kitartas_gyakorisag: 5`,
`kviz_max_csillag: 4`, `jegy_kuszob: 5`.

## 8. Statisztikák

### 8.1 Amit a tanár lát

- **Kvízenként:** kérdésenkénti helyes arány (melyik kérdés bukott meg), válaszeloszlás
  (melyik rossz választ választották sokan → melyik félreértés él az osztályban), diákonkénti
  pont és helyezés, átlag és szórás.
- **Diákonként:** minden kvízje időrendben, témakörönkénti százalék, személyes csúcs,
  csillagtörténet forrásonként, részvétel.
- **Osztályszinten:** témakörönkénti osztályátlag (**ez mondja meg, mit kell újra elővenni**),
  a fejlődés az idő függvényében, részvételi arány, a csillagok eloszlása (ha egy-két diák
  visz mindent, a rendszer nem működik jól — ez a mutató szól érte).

### 8.2 Hogyan készül szerver nélkül

A kvíz lezárásakor a **tanári kliens** összesít és beír egy `statisztika/` dokumentumot
diákonként. Így a lapok megnyitásakor nem kell száz dokumentumot végigolvasni
(spórolás az 50 000 olvasáson).

**Export:** minden nézetből legyen CSV-letöltés. A tanár így az `rmg_tools`-szal vagy
Excelben tovább tudja vinni az adatot a `nevsor_<csoport>.xlsx`-be.

---

## 9. Adatvédelem és üzemeltetés

### 9.1 Milyen adat kerül a felhőbe

| Felkerül | NEM kerül fel |
|---|---|
| azonosító (pl. `kovacs_b12`) | valódi név |
| becenév (a diák választja) | e-mail-cím |
| kvízeredmények, csillagok | osztálynapló-adat, jegyek |

Az azonosító → valódi név párosítás **kizárólag a tanár gépén**, a
`nevsor_<csoport>.xlsx`-ben létezik. A Firebase-ből önmagában nem azonosítható be a diák.

A Firebase Auth technikailag e-mail/jelszó párost vár, ezért a kliens
`<azonosito>@<osztalyId>.rmg.local` alakú **szintetikus címet** állít elő. Ez a domain nem
létezik, levelet nem kap, a diák soha nem látja.

### 9.2 Jelszó-visszaállítás

Mivel nincs valódi e-mail-cím, az „elfelejtett jelszó" link nem működik. Helyette:
a tanár az admin CLI-vel állít be új jelszót (`rmg-admin jelszo <osztaly> <azonosito>`).
Ez a Firebase Admin SDK-val megy, a tanár gépéről, ingyen. **Ezt a felületen is ki kell
írni**, hogy a diák tudja: a tanárhoz kell fordulnia.

### 9.3 Amikor elfogy a napi keret

Ha a Firestore napi kvótája kimerül, az írások hibával térnek vissza. A felület ezt
**ne néma hibaként** kezelje: *„A rendszer elérte a napi ingyenes keretét. A kvíz
eredménye nem mentődött el — a tanár képernyőjén látható végeredmény érvényes."*
A tanári kliens ilyenkor ajánlja fel a **CSV-letöltést**, hogy semmi ne vesszen el.

### 9.4 Amit a szülőknek/iskolának mondani lehet

Egy rövid, egyoldalas tájékoztató is készüljön (`docs/adatvedelmi_tajekoztato.md`):
mi tárolódik, hol (Google Firebase, EU-régió — a projekt létrehozásakor **`europe-west`
régiót kell választani**), meddig, és hogy a tanulói névsor nem kerül ki.

---

## 10. Megvalósítás fázisokra bontva

Minden fázis külön ág és külön PR. A „Kész, ha" pontok teljesülése nélkül nem megyünk tovább.

### 0. fázis — A kérdésbank felkészítése ✅ **KÉSZ (2026-09-05)**

Elkészült, mielőtt az app egy sora megíródott volna. Eszközök és dokumentáció:
`radnoti\oraanyagok\kvizbazis\_diarend\` (`OLVASSEL.md`). Részletek a 4.2 pontban.

| Szkript | Mit ad |
|---|---|
| `diarend_general.py` | `<diasor>.json` mind a 21 diasorról (fizikai + számozott diaszám, fejezet, címke, cím, fejezettartományok) |
| `dia_terkep.py` | régi → új diaszám-térkép a 09-02-i átépítéshez |
| `dia_keresztterkep.py` | érettségi/teljes → ICDL diasor leképezés |
| `dia_atszamozas.py` | a `dia:` mezők átírása, szövegszinten, mentéssel, kétszer futtatva is biztonságos |
| `dia_javito.py` | a túllógó és fejezeten kívüli hivatkozások igazítása |
| `dia_ellenorzo.py` | **a folyamatos ellenőrzés eszköze** – minden diasor-változás után futtatandó |

**Kész, mert:** a `dia_ellenorzo.py` mind a 21 bankra 0 túllógó és 0 fejezeten kívüli
hivatkozást jelent; a parser 1208/1209 diacímben egyezik a diasorok saját, a build által
írt `diarend.txt`-jével.

**Amit az 1–2. fázisnak ebből használnia kell:** a `<diasor>.json` fájlokat kell feltölteni
a `diasorok/` kollekcióba, és a `fejezet` mezőt publikáláskor SZÁMOLNI, nem tárolni.

### 1. fázis — Váz és belépés

Repó, GitHub Pages, Firebase projekt (**europe-west régió**), Auth, üres Firestore,
biztonsági szabályok első változata + emulátoros tesztek, admin CLI a diákfiókok
létrehozására az `azonositok.txt`-ből, diák belépés/regisztráció, tanári belépés.

**Kész, ha:** egy valódi 10T-s azonosítóval be lehet lépni a GitHub Pages-en futó oldalra,
a tanár látja az osztály tagjait, és a rules-tesztek zöldek (köztük legalább 8 „diák
megpróbálja, elbukik" eset).

### 2. fázis — Kérdésbank publikálása és kvízösszeállítás

Az `rmg-admin publikal` parancs, a `kerdesek`/`kulcsok` szétvágással. Tanári
kvízösszeállító felület mindhárom válogatási móddal, élő találatszámlálóval és előnézettel.

**Kész, ha:** a tanár beállítja, hogy „`adatbaziskezeles_icdl`, 1–43. dia, 12 kérdés",
és az előnézetben 12 olyan kérdést lát, ami tényleg abból a tartományból való.

### 3. fázis — Az élő kvíz

Lobby PIN-nel, állapotgép, kérdéskiosztás, válaszfogadás, tanári javítás, pontozás,
kérdésenkénti eredmény, ranglista, végeredmény, a tanári gép összeomlásából való
visszatérés.

**Kész, ha:** egy 12 kérdéses kvíz végigmegy 5 valódi eszközzel (legalább 2 telefon),
a pontok stimmelnek, és a kvíz közepén a tanári fül bezárása és újranyitása után folytatható.

### 4. fázis — Csillagok és statisztika

A csillagszámítás mind a négy forrással, a tanári kapcsolókkal; a diák csillagoldala;
a kvíz-archívum; a diáklap; az osztálystatisztika; CSV-export mindenhonnan.

**Kész, ha:** három egymás utáni kvíz után a csillagok kézzel utánaszámolva is stimmelnek,
és a CSV-export megnyitható Excelben, ékezethelyesen.

### 5. fázis — Gyakorlás és csiszolás

Önálló gyakorló mód (nem ér csillagot), a diák saját statisztikája, hibaüzenetek,
kvótakezelés, offline viselkedés, adatvédelmi tájékoztató, tanári súgó.

**Kész, ha:** egy diák egyedül, tanár nélkül tud gyakorolni a felszabadított anyagból,
és a rendszer minden ismert hibaesetre értelmes magyar üzenetet ad.

#### 5.1 Hogyan lehet gyakorolni úgy, hogy a megoldókulcs mégse szivárogjon ki

Ez a fázis egyetlen nehéz kérdésen áll: **gyakorláskor a diáknak látnia kell a helyes
választ — de a 2.1 pont szerint a megoldókulcs soha nem juthat el a diák kliensére.**
A kettő csak úgy fér meg, ha a kulcs nem mindig, hanem *kijelölt anyagra* nyílik meg.

Innen a terv „felszabadított anyag" kifejezése, konkrétan:

```
felszabaditasok/{bankKod}
  mind: false          # az egész bank szabad-e
  fejezetek: [0,1,2]   # vagy csak ezek a fejezetek (tömbindex, lásd 4.4/4)
  frissitve: <ts>
```

- A `kulcsok/{kerdesId}` **get** művelete akkor engedett a diáknak, ha a kérdés bankja
  (vagy a fejezete) fel van szabadítva. A **list** továbbra is csak tanárnak — a
  kulcsokat egyben letölteni sosem lehet.
- **Élő kvíz alatt a bank nincs felszabadítva**, ezért a kulcs elérhetetlen.
- Hogy a kettő ne csúszhasson egymásba, a **kvízösszeállító alapból kihagyja a
  felszabadított kérdéseket**, és kiírja, hány ilyen van a bankban.

A tanár a felszabadítást a böngészőből állítja (*Eredmények → Gyakorlásra szabadítás*),
nem az admin CLI-ből: gyakran változik, és nem a kérdésbankot írja, csak egy külön
kapcsolót — a `kerdesek`/`kulcsok` kollekció továbbra is kliensből írhatatlan.

#### 5.2 A gyakorlás eredménye külön él

A terv 0. pontja szerint a gyakorlás „csak a saját statisztikáját javítja". Ezt
**külön kollekcióban** valósítjuk meg (`gyakorlas/{osztalyId}_{uid}`), amit a diák maga
ír. A csillagokat vezérlő `statisztika/` kollekcióhoz a diák nem nyúlhat — különben
otthon, egyedül gyakorolva szerezhetne mesterfok-csillagot, ami a 7.3 pont egész
gondolatmenetét kiütné.

---

## 11. Kockázatok

| Kockázat | Mennyire valószínű | Mit teszünk |
|---|---|---|
| ~~A `dia` mezők rendbetétele elhúzódik~~ | — | **Megtörtént 2026-09-05-én**, a 0. fázis kész. |
| A tanári gép/net elszáll óra közben | közepes | 6.4: az állapot a Firestore-ban van, folytatható. Tartalék: a régi, offline szimulátor (ICDL Vizsgaterem) továbbra is működik. |
| Napi kvóta elfogy | alacsony | 9.3: barátságos üzenet + CSV-mentés. A számítás szerint napi 15+ kvíz fér bele. |
| A diákok a fejlesztői eszközökkel csalnak | közepes | A megoldókulcs nem jut el a klienshez (2.1). Gyakorló módban nincs tét. |
| A csillagrendszer nem motivál / túl könnyű | közepes | 7.5: minden szám a tanári felületen állítható, kódmódosítás nélkül. |
| A diasor újraépül és eltolódnak a diaszámok | **magas** (volt már rá példa) | `dia_verzio` mező + az újrapublikálás jelzi az eltérést; a fejezet- és témakörszűrés ilyenkor is jó marad. |

---

## 12. Repó szerkezete

```
C:\Loci\prog\                        ← ITT indítsd a Claude Code-ot
└── rmg-kvizarena/                    ← csak ez alá dolgozz
    ├── README.md
    ├── CLAUDE.md                     ← a repó szabályai (Claude Code ezt olvassa elsőként)
    ├── docs/
    │   ├── IMPLEMENTACIOS_TERV.md    ← EZ A FÁJL (a terv egyetlen igazsága)
    │   ├── adatmodell.md
    │   ├── adatvedelmi_tajekoztato.md
    │   └── tanari_sugo.md
    ├── web/                          ← ez megy GitHub Pages-re
    │   ├── index.html                (diák)
    │   ├── tanar.html                (tanári pult)
    │   ├── css/
    │   ├── js/
    │   │   ├── firebase.js           (init, EU-régió)
    │   │   ├── auth.js
    │   │   └── diak/  tanar/  kozos/
    │   └── assets/
    ├── admin/                        ← Node CLI, a tanár gépén fut
    │   ├── package.json
    │   ├── rmg-admin.js
    │   ├── config.pelda.json         ← a kvízbázis útvonala (a config.json .gitignore-ban)
    │   └── parancsok/  (diakok.js, jelszo.js, publikal.js, tanar.js)
    ├── firestore.rules
    ├── firestore.indexes.json
    └── tesztek/
        ├── rules/                    (emulátoros szabály-tesztek)
        └── minta/                    (kis kérdés-fixture a fejlesztéshez)
```

**Titkok kezelése:** a Firebase service account kulcs (`rmg-kvizarena/admin/`) **soha ne kerüljön a
repóba** — `.gitignore`, és a README írja le, hogyan kell letölteni a Firebase konzolból.
A webes Firebase-konfig (apiKey stb.) viszont nyugodtan publikus lehet: azt a biztonsági
szabályok védik, nem a titkosság.

---

## 13. Ami szándékosan NEM része az első verziónak

- Házi feladatként kiadható, határidős kvíz (később, ha kell)
- Párosítós és rövid válaszos kérdés az élő kvízben (elsőre csak feleletválasztós,
  igaz/hamis és többválasztós; a másik kettő a gyakorló módban már mehet)
- Osztályok közötti verseny, örökranglista
- Mobil app (a böngésző elég)
