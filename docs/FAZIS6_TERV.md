# Kvízaréna 6. fázis — implementációs terv

Három, egymástól független fejlesztés, **három külön ágon, három PR-ben**, ebben a
sorrendben:

| Rész | Ág | Mi |
|---|---|---|
| A | `kepes-kerdesek` | képes kérdések feltöltése és megjelenítése |
| B | `cimke-szuro` | szűrés a kvízösszeállítóban címkére (elsőként: hivatalos ICDL-mintakérdés) |
| C | `rangsor-jo-valasz` | új rangsorolás: a jó válaszok száma dönt, holtversenynél a válaszidők összege |

Mindhárom rész a fő terv szabályai szerint (CLAUDE.md; „Kész, ha" feltétel; teszt a
tiltásokra). A dokumentum végén részenként van a „Kész, ha".

---

# A. Képes kérdések

Állapot: **terv, 2026-09-07.** A `docs/IMPLEMENTACIOS_TERV.md` 13. pontja a képes kérdést
a „második körre" hagyta. Ez az a második kör. A fő terv szabályai (CLAUDE.md, 2.1 pont:
a kulcs sosem jut a diákhoz; nincs szerveroldali kód; a repóba nem kerül kérdésbank)
itt is érvényesek.

**Miért most:** az IT-biztonság bankba bekerült 119 hivatalos ICDL-mintakérdés
(`hivatalos_minta` címke), és a hivatalos gyűjteményben 5 kérdés ikonokat mutat
(„Melyik ikon jelenti a vezeték nélküli hálózatot?"). Ezek kép nélkül értelmezhetetlenek,
kép nélkül pedig a vizsgára készülő diák nem találkozik velük.

Ág: `kepes-kerdesek`. Egy PR.

---

## 1. Döntés: a kép BEÁGYAZVA megy a Firestore-ba (data URI)

Három lehetőség volt:

| | Hova kerül a kép | Miért nem / miért igen |
|---|---|---|
| A | `web/kepek/` a GitHub Pages-en | **Nem.** Kérdésbank-tartalom kerülne a repóba (CLAUDE.md tiltja), és minden új kép = commit + deploy. |
| B | Firebase Storage | **Nem.** Új szolgáltatás, új biztonsági szabályok, új emulátoros teszt; a Spark-kvóta is szűkebb. Túl sok egy tucat ikonért. |
| C | **data URI a `kerdesek/{id}` dokumentumban** | **Igen.** Nincs új tárhely, nincs új szabály: a kép ugyanazzal a `belepett()` olvasási joggal jön, mint a kérdés. A `publikal` parancs olvassa be a fájlt a tanár gépéről. |

**Korlát, amit a C hoz:** a Firestore-dokumentum legfeljebb 1 MiB. Ezért a feltöltő
**200 KB-os képfájl fölött hibát ad** (base64-ben ~270 KB), 60 KB fölött figyelmeztet.
A kvízbázis `SEMA.md` szerint a képek amúgy is „fekete-fehérben is olvasható", kicsi ábrák.

A **méretkorlát a `publikal` parancsban van, nem a szabályokban** — a szabályok a
`kerdesek/` írását amúgy is tiltják (`allow write: if false`), csak az Admin SDK ír.

---

## 2. Adatmodell

A kvízbázis `kep` mezője (`oraanyagok/kvizbazis/SEMA.md`):

```yaml
kep:
  fajl: kepek/wifi_ikonok.png     # a téma mappájához (kvizbazis/<tema>/) képest
  felirat: "Négy hálózati ikon: a), b), c), d)"
  szelesseg: 50                   # opcionális, a szövegtükör %-a
  tipus: kepernyokep              # opcionális
```

A `kerdesek/{id}` publikus dokumentum **új, opcionális** mezője:

```
kep: {
  adat:     "data:image/png;base64,....",   # a fájl beágyazva
  felirat:  "Négy hálózati ikon: a), b), c), d)",
  szelesseg: 50,                             # 1–100, hiányzik → 100
  mime:     "image/png",
  meret:    12345                            # a fájl mérete bájtban (diagnosztika)
}
```

- A `kulcsok/{id}` NEM változik. A kép publikus, mint a kérdésszöveg — de a
  `SEMA.md` 1. szabálya szerint a kép nem árulhatja el a választ, ez a bank felelőssége.
- **A hash** (`kvizbazis.js`, `hasit(JSON.stringify([publikus, kulcs]))`) automatikusan
  fedi a képet is, mert a `kep` a `publikus` része → ha a tanár kicseréli a PNG-t,
  a következő `publikal` módosultként írja újra. Ezt nem kell külön lekezelni.
- A kérdés **azonosítója** továbbra is a kérdésszöveg hash-e (`kerdesAzonosito`), a kép
  nem befolyásolja.

---

## 3. Feltöltő: `admin/lib/kvizbazis.js` és `admin/parancsok/publikal.js`

### 3.1 `kerdestAtalakit(kerdes, bank, diarendAdat, fejezetet)`

Most:

```js
if (kerdes.kep) return { kihagyva: 'kepes' };
```

Helyette a kérdés feldolgozása után, a `publikus` összeállításakor:

```js
if (kerdes.kep) {
  const kep = kepetBeagyaz(kerdes.kep, bank);   // { kep } vagy { hiba }
  if (kep.hiba) return { hiba: kep.hiba };
  publikus.kep = kep.kep;
}
```

Új segédfüggvény ugyanebben a fájlban:

```js
// A kvizbazis "kep" mezoje -> beagyazott kep a publikus dokumentumba.
// A fajl a TEMA mappajahoz kepest relativ: <kvizbazis>/<tema>/kepek/x.png.
const KEP_MAX_BAJT = 200 * 1024;
const KEP_FIGYELMEZTETES_BAJT = 60 * 1024;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
               '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

export function kepetBeagyaz(kep, bank) { ... }
```

Amit csinál, sorrendben:
1. `kep.fajl` kötelező, string; `kep.felirat` kötelező (a SÉMA szerint is az) → különben `hiba`.
2. Az útvonal: `join(bank.mappa, kep.fajl)` — **a bank mappája kell**, ezért a
   `bankokBetolt()` által visszaadott bank-objektumba fel kell venni a `mappa` mezőt
   (a YAML könyvtára), ha még nincs. Ellenőrizd, mi van most benne (`kod`, `fejlec`, …).
3. Útvonal-védelem: a feloldott útvonal a bank mappáján BELÜL legyen (`..` tiltva).
4. Nincs ilyen fájl → `hiba: 'a kép nem található: kepek/x.png'` (a kérdés kimarad,
   a többi megy — a `hiba` ág már így működik).
5. Kiterjesztés → MIME; ismeretlen → `hiba`.
6. Méret > `KEP_MAX_BAJT` → `hiba` („a kép 200 KB-nál nagyobb, kicsinyítsd").
   Méret > `KEP_FIGYELMEZTETES_BAJT` → a visszaadott objektumban `figyelmeztetes` mező,
   amit a `bankotFeldolgoz` összegyűjt (lásd 3.2).
7. `szelesseg`: egész 1–100, különben 100.
8. Visszaad: `{ kep: { adat, felirat, szelesseg, mime, meret } }`.

**Az SVG-t kezeld óvatosan:** a data URI-s SVG `<img>`-ben nem futtat szkriptet, ezért
`<img src>`-ként biztonságos — de **csak `<img>`-ként** jelenjen meg, soha `innerHTML`-lel
beszúrva (lásd 4.).

### 3.2 `bankotFeldolgoz(...)` és a statisztika

- A `kihagyva` számláló marad `{ kifejtos, kepes }`, de a `kepes` **mostantól 0** marad
  normál esetben — hagyd meg a mezőt, hogy a `publikal.js` táblázata ne törjön el, de
  a 105. sor üzenetét írd át: *„A "kihagyva" a kifejtős kérdés – az gépileg nem
  javítható."*
- Új: `kepek: { db, osszBajt, figyelmeztetesek: [] }` a `bankotFeldolgoz` eredményében.
  A `publikal.js` a táblázat után kiírja: *„N képes kérdés, összesen X KB beágyazva"*,
  és a figyelmeztetéseket (`figyelem(...)`) fájlnévvel.

### 3.3 `--proba`

Próba módban is olvasd be és mérd a képeket (a hibák így derülnek ki írás nélkül).

---

## 4. Megjelenítés — három hely, egy közös segéd

Új fájl: `web/js/kozos/kep.js`

```js
// Kepes kerdes: <img> a kerdes szovege ala. SOHA nem innerHTML - a felirat es a
// data URI is a bankbol jon, szovegkent kell kezelni.
export function kepetKirak(tarolo, kep) {
  tarolo.innerHTML = '';
  tarolo.hidden = !kep;
  if (!kep) return;
  const img = document.createElement('img');
  img.src = kep.adat;
  img.alt = kep.felirat || '';
  img.style.width = `${kep.szelesseg || 100}%`;
  const felirat = document.createElement('div');
  felirat.className = 'kepfelirat';
  felirat.textContent = kep.felirat || '';
  tarolo.append(img, felirat);
}
```

Hívási helyek (mindhárom `kerdestMutat()` függvényben, a `.textContent = kerdes.kerdes`
sor után):

| Fájl | Meglévő elem | Új tároló elem (a kérdésszöveg ALÁ) |
|---|---|---|
| `web/js/diak/jatek.js` (élő kvíz, diák) | `#jatek-kerdes` | `#jatek-kep` |
| `web/js/diak/gyakorlas.js` (gyakorlás) | `#gyak-kerdes` | `#gyak-kep` |
| `web/js/tanar/jatekvezetes.js` (kivetítő) | `#kerdes-szoveg` | `#kerdes-kep` |

HTML: `web/index.html` 149. és 209. sora után, `web/tanar.html` 342. sora után egy
`<div class="kerdeskep" id="…" hidden></div>`.

CSS (`web/css/…` — nézd meg, hol van a `.kerdesszoveg-diak` és a `.nagykerdes`):

```css
.kerdeskep { margin: .5rem auto 1rem; text-align: center; }
.kerdeskep img { max-width: 100%; max-height: 40vh; height: auto; image-rendering: auto; }
.kerdeskep .kepfelirat { font-size: .85em; opacity: .75; margin-top: .25rem; }
```

- **Kivetítőn** (`tanar.html`) a `max-height` lehet 50vh, hogy a válaszrács is kiférjen.
- **Telefonon** a `szelesseg` %-a a keskeny képernyőn is jó, mert a szövegtükörhöz képest
  értendő; ne legyen fix pixel.
- Kis ikonok (pl. 40×40 px-es, hivatalos ICDL-ikonképek) felnagyítva pixelesek — ez
  elfogadható, a felismerhetőség a cél. Ha zavaró, a bankban kell nagyobb képet adni,
  nem a kliensben „élesíteni".

### 4.1 Eredmény- és visszajelző képernyők

- `gyakorlas.js` visszajelzés (`#gyak-visszajelzes`): a kép maradjon látható, amíg a
  diák a magyarázatot olvassa — tehát a `kepetKirak` a kérdés kirakásakor fut, és a
  visszajelzésnél NEM töröljük.
- `jatek.js`: a „válasz elküldve" állapotban (`mar === true`) a kép maradjon.
- `tanar/eredmenyek.js` (226. sor, lista): nem kell kép, csak a szöveg — de tegyél
  elé egy `📷 ` jelet, ha `kerdes.kep`, hogy a tanár lássa.

### 4.2 Kvízösszeállító — `web/js/tanar/kvizosszeallito.js`

A 305–314. sor környékén, a jelölők (`.jelolo`) közé egy plusz jelölő: `📷 képes`.
Csak jelzés, a kép nem jelenik meg a listában (a lista több száz kérdés lehet, a data
URI-k lassítanák). **Ellenőrizd, hogy a kvízösszeállító `select()`-tel vagy teljes
dokumentummal kéri-e le a kérdéseket** — ha teljes dokumentummal, akkor a képes
kérdések betöltése nőni fog; ha ez gond, a `kep.adat` mezőt a listanézet helyett csak a
kiválasztott kérdésekhez töltsd be. (Első körben: mérd meg, egy tucat képes kérdés nem
számít.)

---

## 5. Tesztek

### 5.1 `tesztek/publikalo.test.js`

- A meglévő „a kepes kerdes sem megy fel" teszt (89–90. sor) **megfordul**: a képes
  kérdés felmegy, `publikus.kep.adat` `data:image/png;base64,`-val kezdődik,
  `felirat` egyezik, `szelesseg` a YAML-ból jön. A 101. sor számítása:
  9 kérdés − 1 kifejtős − 1 hibás = **7**.
- Ehhez kell egy valódi kis PNG: `tesztek/minta/kvizbazis/proba/kepek/proba.png`
  (a `proba_bank.yaml` 73–74. sora már erre hivatkozik). Legyen 1×1 vagy 8×8 px, pár
  száz bájt. Ez tesztminta, nem kérdésbank — mehet a repóba.
- Új esetek:
  - hiányzó képfájl → `hiba`, a kérdés kimarad, a többi feldolgozódik;
  - `..`-t tartalmazó útvonal → `hiba`;
  - 200 KB fölötti fájl → `hiba` (a tesztben generált Buffer, nem valódi fájl);
  - 60–200 KB közötti → felmegy, de `figyelmeztetes`;
  - nincs `felirat` → `hiba`;
  - a hash változik, ha a kép bájtjai változnak (két különböző PNG ugyanahhoz a YAML-hoz).

### 5.2 Szabályok (`tesztek/rules/`)

**Nem változnak**, mert a `kerdesek/` dokumentum szerkezetét a szabályok nem
vizsgálják, csak az olvasási jogot. Ne nyúlj hozzá; a `npm run teszt` viszont fusson
le zölden (ez a bizonyíték, hogy tényleg nem nyúltál hozzá).

### 5.3 Kézi próba

1. A `oraanyagok/kvizbazis/it_biztonsag/` bankban legyen legalább egy képes kérdés
   (a hivatalos ikonos kérdések — ezeket a tanár teszi be, nem ez a PR).
2. `node admin\rmg-admin.js publikal it_biztonsag_icdl_2026 --proba` → kiírja a képes
   kérdések számát és méretét, hiba nélkül.
3. `node admin\rmg-admin.js publikal it_biztonsag_icdl_2026` → módosult: N.
4. Tanári pult: kvíz összeállítása, a képes kérdés jelölővel látszik; élő kvízben a
   kivetítőn ÉS a diák telefonján is látszik a kép; gyakorlásban is.
5. Firestore konzol: a `kerdesek/<id>` dokumentum mérete < 300 KB.

---

## 6. Dokumentáció, amit ugyanebben a PR-ben frissíts

- `docs/IMPLEMENTACIOS_TERV.md` 13. pont: a „Képes kérdések" sort töröld, és a 4.
  (adatmodell) fejezetbe vedd fel a `kep` mezőt a 2. pont szerint.
- `docs/tanari_sugo.md`: rövid bekezdés — a képes kérdés a kvízbázis `kep` mezőjével
  megy, a kép a témamappa `kepek/` almappájában van, 200 KB fölött nem megy fel, és a
  `publikal` kiírja, hány kép ment fel.
- `README.md`: a „Kérdésbank" sorban a „kb. 2900 kérdés" mellé nem kell semmi; a
  Fázisok táblába új sor: „6. Képes kérdések ✅".
- `CLAUDE.md`: **nem kell** módosítani — a képek a tanár munkamappájában maradnak, a
  repóba csak a tesztminta PNG kerül.

---

## 7. Amit szándékosan NEM csinálunk most

- Kép a **válaszlehetőségekben** (4 külön kép mint 4 válasz). A hivatalos ICDL-ikonos
  kérdéseknél a 4 ikon EGY képen van, a válaszok pedig „a)", „b)", „c)", „d)". Ez a
  bank oldalán megoldott, kliens-támogatás nem kell hozzá.
- Firebase Storage, képtömörítés, előnézet a kvízösszeállítóban.
- A `_szimulator` (ICDL Vizsgaterem) képtámogatása — az külön eszköz, külön kör.

---

## Kész, ha (A rész)

- `npm run teszt` zöld, benne az 5.1 új esetei;
- egy képes kérdés az `it_biztonsag_icdl_2026` bankból feltöltve látszik **kivetítőn,
  diák-telefonon és gyakorlásban**, a felirattal együtt;
- a `publikal --proba` kiírja a képes kérdések számát és összméretét;
- a hiányzó vagy túl nagy kép **nem állítja meg** a publikálást, csak azt az egy kérdést
  hagyja ki, olvasható magyar hibaüzenettel.


---

# B. Címkeszűrő a kvízösszeállítóban

## 1. Mi a cél

A kvízbázis kérdéseinek van `cimkek` listája (a feltöltő már most is felviszi:
`kvizbazis.js` 177. sor, `publikus.cimkek`). Az IT-biztonság bankban 119 kérdés viseli a
**`hivatalos_minta`** címkét — ezek szó szerint az NJSZT hivatalos ICDL-vizsgafeladat-
gyűjteményéből valók. A tanár szeretne olyan kvízt indítani, amiben **csak** ezek
vannak („próbavizsga-hangulat"), vagy épp ezek nélkül.

A címke a három válogatási mód (dia / fejezet / témakör) **fölött** működik, mint a
nehézség-szűrő: minden módban érvényes, tovább szűkít.

## 2. Adatmodell

A `valogatas` objektum (`web/js/kozos/kerdesbank.js`, 80. sor környéke) két új,
opcionális mezőt kap:

```
cimke:      "hivatalos_minta" | null     # csak az ilyen címkéjű kérdések
cimke_nelkul: false                      # true → fordítva: az ilyen címkéjűek KIMARADNAK
```

A `kvizek/{id}` dokumentumba a `valogatas` így, változatlanul mentődik (ma is
egyben megy: `kvizosszeallito.js` 108. sor) — így az archívumból látszik, hogy egy
kvíz mintakérdéses volt-e.

## 3. `szur(kerdesek, valogatas)` — `web/js/kozos/kerdesbank.js`

A `nehezseg_max` és a `csak_elo` ellenőrzés után, a `switch (valogatas.mod)` ELŐTT:

```js
if (valogatas.cimke) {
  const van = Array.isArray(k.cimkek) && k.cimkek.includes(valogatas.cimke);
  if (valogatas.cimke_nelkul ? van : !van) return false;
}
```

Semmi mást nem kell tudnia a szűrőnek: a címke egy string a listában.

## 4. Felület — `web/tanar.html` + `web/js/tanar/kvizosszeallito.js`

A három módgomb és a nehézség-választó **mellé** (nem a módpanelekbe) egy sor:

```html
<label class="cimkeszuro" id="kviz-cimkeszuro" hidden>
  Címke:
  <select id="kviz-cimke">
    <option value="">– mind –</option>
  </select>
  <label><input type="checkbox" id="kviz-cimke-nelkul"> kihagyva</label>
</label>
```

Viselkedés a `kvizosszeallito.js`-ben:

1. **Bankváltáskor** (ahol a `kerdesek` tömb betöltődik és a témakör-pipalista épül)
   számold meg a bank címkéit: `Map<cimke, db>`. A legördülőbe azok kerülnek, amik
   **legalább 5 kérdésen** szerepelnek, darabszámmal: `hivatalos_minta (119)`.
   A `hivatalos_minta` **mindig az első** a listában, ha van a bankban — a többi
   ábécérendben (`localeCompare(…, 'hu')`).
2. Ha a bankban egyetlen címke sem éri el az 5-öt, a `#kviz-cimkeszuro` marad `hidden`.
3. A `valogatastOsszeszed()` (235. sor) beleírja: `cimke: select.value || null`,
   `cimke_nelkul: checkbox.checked`.
4. A `szamlalotFrissit()` (256. sor) így automatikusan a szűrt találatszámot mutatja —
   erre nem kell külön kód, mert a `szur()`-t hívja.
5. A `kvizCime(valogatas)` (120. sor) a cím végére fűzi: ` · csak: hivatalos_minta`
   vagy ` · kihagyva: hivatalos_minta`. A `hivatalos_minta` címkét a címben írd
   emberi alakban: **„hivatalos ICDL-mintakérdés"** — egy kis szótár a fájl tetején:
   `const CIMKE_NEVE = { hivatalos_minta: 'hivatalos ICDL-mintakérdés' }`, ami hiányzó
   kulcsnál magát a címkét adja vissza. Ugyanezt a nevet mutassa a legördülő is.
6. Az előnézet jelölői közé (305–314. sor) kerüljön be a `hivatalos_minta` címke
   mint külön, kiemelt jelölő (`<span class="jelolo minta">ICDL-minta</span>`), hogy a
   listában ránézésre látszódjon. Más címkét NE listázz a jelölők közé — 3-5 címke
   kérdésenként túl zsúfolt lenne.

**Gyakorló mód** (`web/js/diak/gyakorlas.js`, 109–134. sor, a „resz" legördülő):
ugyanez a címke-lista opcióként: `cimke:hivatalos_minta` → „csak hivatalos ICDL-
mintakérdés (119)". A szűrés a 143. sor mintájára. Ez teszi lehetővé, hogy a diák
otthon a valódi vizsgakérdéseken gyakoroljon — ez a B rész fő haszna.

## 5. Tesztek

`tesztek/kviz.test.js` (vagy ahol a `szur` tesztjei vannak — ellenőrizd):
- `cimke` megadva → csak a címkés kérdések jönnek, mindhárom módban;
- `cimke` + `cimke_nelkul: true` → pont a többiek;
- `cimke: null` → nincs hatása (visszafelé kompatibilis, a régi mentett `valogatas`
  objektumokban nincs ilyen mező);
- kérdés `cimkek` mező nélkül (régi publikálás) → nem dob hibát, „nincs címkéje".

## 6. Dokumentáció

- `docs/tanari_sugo.md`: a kvízösszeállító leírásába egy bekezdés a címkeszűrőről,
  és hogy a `hivatalos_minta` mit jelent (szó szerinti NJSZT-mintakérdés).
- `docs/IMPLEMENTACIOS_TERV.md`: a válogatás leírásánál (3 mód) a címke mint
  keresztszűrő.

## Kész, ha (B rész)

- a tanári pulton az IT-biztonság banknál megjelenik a címke-legördülő
  „hivatalos ICDL-mintakérdés (119)" opcióval, és a találatszámláló követi;
- indítható 20 kérdéses kvíz, amiben mind a 20 kérdés `hivatalos_minta` címkés;
- a „kihagyva" kapcsolóval egy sem;
- a gyakorló módban ugyanez a szűrő elérhető;
- `npm run teszt` zöld az 5. pont eseteivel.

---

# C. Új rangsorolás: a jó válaszok száma dönt

## 1. Hogyan megy MOST (hogy értsd, mit cserélünk)

`web/js/kozos/kviz.js`, `pontszam()`:
- helyes válasz: **100 pont + legfeljebb 50 gyorsasági** (a hátralévő idő arányában);
- rossz vagy hiányzó válasz: **0**.

`web/js/tanar/jatekvezetes.js`:
- kérdés lezárásakor (320–340. sor) a tanári kliens minden játékosnál növeli a
  `pont`, `helyes_db` mezőt, és eltárolja az `utolso_valasz_ms`-t (csak az utolsó
  kérdését!);
- a végső sorrend (435–438. sor): **`pont` csökkenő**, holtversenynél az **utolsó**
  kérdés reakcióideje.

Ennek két gyengéje, amiért cseréljük:
- két diák azonos jó-válasz-számmal is más pontot kap, ha az egyik gyorsabb volt —
  vagyis a gyorsaság nem csak holtversenyt dönt, hanem a sorrendet is átírja
  (10 jó lassan < 9 jó villámgyorsan is előfordulhat: 1000 < 9×150 = 1350);
- a holtverseny-döntő csak az utolsó kérdés idejét nézi, nem az egész kvízét.

## 2. Az új szabály (a tanár döntése, 2026-09-07)

1. **Elsődleges: a jó válaszok száma** (`helyes_db`), csökkenő.
2. **Holtversenynél: a válaszidők összege** (`valasz_ido_osszeg_ms`), növekvő —
   a kevesebb a jobb.
3. Ha ez is egyenlő (gyakorlatilag nem fordul elő): a belépés sorrendje
   (`csatlakozott` időbélyeg), hogy a sorrend determinisztikus legyen.

**A válaszidő definíciója:** a kérdés indulásától (`indultMs`, a kvíz dokumentum
`serverTimestamp()`-je) a válasz `kuldve` szerver-időbélyegéig, ms-ban — pontosan
az, amit ma az `utolso_valasz_ms` tárol. **Nem válaszolt kérdés = a teljes időlimit**
(`kviz.ido_limit * 1000`) — ez ma is így van a pontozásban (329–331. sor), és így a
„kihagyom, hogy ne rontsa az időmet" trükk nem működik. **Rossz válasz ideje is
számít** az összegbe — az összeg a gyorsaságot méri, a helyességet a `helyes_db`.

## 3. Mi marad a pontból

A `pont` mező és a `pontszam()` **megmarad**, de csak **tájékoztató** lesz (a diák
képernyőjén továbbra is látszik, a csillag-szabályok nem használják — ellenőrizd:
`csillag.js` 57–65. sor csak `helyezes`-t és `helyes_db`-t olvas). Így a statisztika
(`atlag_pont`, 519. sor) és a CSV-export (164–170. sor) sem törik el. **De a rangsort
sehol nem a `pont` adja.** Ha később kiderül, hogy a pont zavaró („miért van több
pontom, ha hátrébb vagyok?"), egy külön körben eltüntethető a diák-felületről — most
nem nyúlunk hozzá, hogy a C rész kicsi maradjon.

## 4. Kód

### 4.1 `web/js/kozos/kviz.js` — egy tiszta rangsoroló függvény

```js
// A vegso sorrend (terv 6.2, 2026-09-07-i valtozat): a jo valaszok szama dont,
// holtversenynel a valaszidok osszege (kevesebb = jobb), utana a csatlakozas ideje.
export function rangsorol(jatekosok) {
  return [...jatekosok].sort((a, b) =>
    (b.helyes_db || 0) - (a.helyes_db || 0)
    || (a.valasz_ido_osszeg_ms ?? Infinity) - (b.valasz_ido_osszeg_ms ?? Infinity)
    || (a.csatlakozott?.toMillis?.() ?? 0) - (b.csatlakozott?.toMillis?.() ?? 0));
}
```

Tiszta függvény, Firestore nélkül → egyszerűen tesztelhető.

### 4.2 `web/js/tanar/jatekvezetes.js`

- **Kérdés lezárása** (a `koteg.update` a 334. sornál): új mező
  `valasz_ido_osszeg_ms: increment(Math.max(0, reakcioMs))` — a `reakcioMs` már a
  „nem válaszolt = időlimit" szabállyal jön (329–331. sor), tehát pont jó.
  Az `utolso_valasz_ms` maradhat (a diák képernyőjén hasznos).
- **Végeredmény** (435–438. sor): a saját `sort` helyett `rangsorol([...jatekosok.values()])`.
- **Élő ranglista a kivetítőn kérdések között** (247. sor, `sort` pont szerint):
  szintén `rangsorol(...)`, hogy a köztes állás és a végeredmény ugyanazt a
  logikát mutassa. A sorban a „N pont" helyett/mellett: **„7 jó · 48,2 mp"** — a
  jó válaszok száma és az összidő másodpercben egy tizedessel. A `pont` maradhat
  kisebb betűvel utána.
- **Végeredmény-lista** (546–558. sor): a sorrend `helyezes` szerint (ez már a
  `rangsorol` eredménye), a szöveg: „7/10 jó · 48,2 mp · 1 050 pont ★".
- **CSV-export** (164–170. sor): a sorrend `rangsorol`, új oszlop: `összidő (mp)`.
- **A helyezés kiszámítása** ott, ahol a `helyezes` mezőt a játékos dokumentumába
  írja (a 435. sor utáni ciklus): a `rangsorol` sorrendjének indexe + 1. **Azonos
  `helyes_db` ÉS azonos összidő → azonos helyezés** (holtverseny), a következő
  helyezés kimarad (1, 1, 3). Ez a csillag-dobogónál számít (`csillag.js`): két
  első helyezett két 3 csillagot kap — ez a tanár által elfogadott viselkedés.

### 4.3 `web/js/diak/jatek.js`

- A játékos-dokumentum kezdőértékei (47. sor, `helyes_db: 0`): `valasz_ido_osszeg_ms: 0`.
- A „várakozás" és a végeredmény képernyőn (261. sor környéke) a jó válaszok száma
  mellé az összidő: „7 jó válasz 10 kérdésből · 48,2 mp".

### 4.4 `firestore.rules`

A `kvizek/{id}/jatekosok/{uid}` dokumentumot a tanári kliens írja (`pont`,
`helyes_db`, …). **Ellenőrizd**, hogy a szabály mezőnként korlátozza-e, mit írhat a
tanár, ill. mit hozhat létre a diák (a 47. sor a diák oldalán hoz létre
dokumentumot). Ha a diák létrehozáskor csak fix mezőkészletet adhat meg
(`hasOnly([...])`), akkor a `valasz_ido_osszeg_ms` felvétele a listába **szabály-
módosítás**, és kell hozzá emulátoros teszt (`tesztek/rules/szabalyok.test.js`):
- a diák létrehozhatja a dokumentumot `valasz_ido_osszeg_ms: 0`-val;
- a diák **nem** írhatja át később (ahogy a `pont`-ot és a `helyes_db`-t sem);
- a tanár növelheti.
Ha nincs mezőszintű korlát, akkor nincs szabályváltozás — de ezt a tesztfuttatás
bizonyítsa, ne a feltételezés.

### 4.5 Terv-dokumentum

`docs/IMPLEMENTACIOS_TERV.md` 6.2 pont („tudás 100 pont, gyorsaság legfeljebb 50")
és a holtverseny-szabály (2. pont): írd át az új szabályra, **az indoklással együtt**:
*„a gyorsaság csak holtversenyt dönt, sorrendet nem — 10 jó válasz lassan mindig
több, mint 9 jó gyorsan; és a teljes kvíz ideje számít, nem az utolsó kérdésé."*
A régi képlet maradjon meg egy mondatban mint tájékoztató pont.

## 5. Tesztek

`tesztek/kviz.test.js`, `rangsorol()`:
- több jó válasz elöl, akkor is, ha kevesebb a `pont`-ja;
- azonos jó válasz → kisebb összidő elöl;
- azonos jó válasz és összidő → korábbi csatlakozás elöl;
- hiányzó `valasz_ido_osszeg_ms` (régi, félbemaradt kvíz folytatása) → a lista
  végére, nem dob hibát;
- üres lista → üres lista.

`tesztek/jatekszimulator.mjs`: ha a szimulátor számol végeredményt, igazítsd; és
adj hozzá egy esetet, ahol a „nem válaszolt" játékos összideje = kérdésszám × limit.

Rules-teszt: a 4.4 szerint, ha kell.

## 6. Összeomlás utáni folytatás

A tanári kliens folytatáskor (48. sor, `futoDok`) a játékosok dokumentumaiból
dolgozik. Egy **a C rész előtt indult, félbeszakadt** kvízben nincs
`valasz_ido_osszeg_ms` → a `rangsorol` a `?? Infinity` miatt ezeket hátra sorolja,
de nem hibázik. Ez elfogadható: ilyen kvíz a bevezetés pillanatában legfeljebb egy van.

## Kész, ha (C rész)

- egy próbakvízben a lassabban, de többet tudó játékos előrébb végez, mint a gyors
  hibázó — a kivetítőn, a diák telefonján és a CSV-ben egyaránt;
- holtversenyben az összidő dönt, és az összidőben a kihagyott kérdés a teljes limittel
  számít;
- `npm run teszt` zöld (5. pont + ha kellett, rules);
- a `docs/IMPLEMENTACIOS_TERV.md` 6.2 az új szabályt írja le.
