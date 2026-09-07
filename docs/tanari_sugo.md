# Tanári súgó

*Amit óra közben tudni kell. A beüzemelés külön van: [`telepites.md`](telepites.md).*

| | |
|---|---|
| Tanári pult | <https://locitanit.github.io/rmg-kvizarena/tanar.html> |
| Diák | <https://locitanit.github.io/rmg-kvizarena/> |

---

## Egy óra menete

1. **Tanári pult → Kvíz összeállítása.** Válaszd ki a bankot, húzd a „Meddig jutottunk?"
   csúszkát oda, ameddig eljutottatok. A számláló azonnal mutatja: *„87 kérdés felel meg,
   ebből 12 lesz kisorsolva."*
2. **Előnézet** — ha kíváncsi vagy, mit fog kapni az osztály. A helyes válaszokat is látod.
3. **Kvíz indítása.** Kivetítőre a nagy **PIN**.
4. A diákok belépnek a telefonjukon, és beírják a PIN-t. Ha az osztályukban fut kvíz,
   egy gombbal is csatlakozhatnak.
5. **Indítás**, ha mindenki bent van. Innentől a kérdés megy a kivetítőn.
6. A kérdés magától lezárul, ha lejárt az idő **vagy mindenki válaszolt**. Sürgős esetben
   ott a „Lezárás most".
7. **Következő kérdés** → … → **Végeredmény**.

> **Az oldalnak végig nyitva kell maradnia.** Nincs szerver: a te böngésződ a játékvezető,
> ő javít és pontoz. Ha mégis bezárul, lásd lent.

## Ha bezárult a fül vagy elszállt a gép

Nyisd meg újra a pultot. Belépés után felajánlja:
*„A(z) … kvíz az 5. kérdésnél tart. Folytatod?"* A diákok addig egy várakozó képernyőn
állnak, nem esnek ki.

## Pontozás

```
helyes válasz          100 pont
gyorsaság            0–50 pont (a hátralévő idővel arányosan)
rossz válasz            0 pont
```

Így aki gondolkodik és jól válaszol, mindig ver egy gyorsan hibázót. Többválaszosnál
részpont nincs.

## Csillagok

Négy forrásból, kvízenként legfeljebb 4:

| Forrás | Csillag | Mikor |
|---|---|---|
| dobogó | 3 / 2 / 1 | 1., 2., 3. helyezés |
| személyes csúcs | 1 | eléri vagy megdönti a saját legjobbját (3 kvíz után) |
| mesterfok | 1 | egy témakörben 80% felett, min. 8 kérdésen — témakörönként egyszer |
| kitartás | 1 | minden 5. kvízen, a részvételért |

**5 csillag = egy órai munka ötös.** Beváltani az *Eredmények → Diákok* lapon lehet;
a jegyet neked kell beírnod az osztálynaplóba.

Mind a négy forrás kikapcsolható és átírható: *Eredmények → Csillagbeállítás*.

> **Kis csoportnál figyelj:** a dobogós csillag a helyezésnek jár, nem a teljesítménynek.
> Háromfős csoportban a harmadik helyezett is kap csillagot, akkor is, ha semmit nem
> tudott. Ilyenkor írd át a dobogós értékeket (pl. `3,2`).

## Gyakorlás – a felszabadítás

A diák egyedül is gyakorolhat, de **csak abból, amit felszabadítottál**:
*Eredmények → Gyakorlásra szabadítás* → bank → az egész bank vagy fejezetenként.

Felszabadított anyagnál a diák **látja a helyes választ és a magyarázatot**. Ezért:

> **Felszabadított anyagból ne indíts élő kvízt.** A kvízösszeállító ezeket alapból ki is
> hagyja — a „Felszabadított kérdések kihagyása" pipát csak akkor vedd ki, ha tudod, mit
> csinálsz.

A gyakorlás **nem ér csillagot**, és nem számít bele az élő kvízek statisztikájába.

## Amit érdemes megnézni a kvíz után

*Eredmények* fül:

- **Kvíz-archívum** → egy kvízre kattintva: **melyik kérdésnél bukott meg az osztály**
  (a legrosszabbak elöl), és a diákonkénti sorok.
- **Osztálystatisztika**: témakörönkénti átlag — *ez mondja meg, mit kell újra elővenni*.
  Alatta a csillagok eloszlása: ha egy-két diák visz mindent, a rendszer nem működik jól.
- **Diákok** → egy diák lapja: témakörönkénti erősség, csillagtörténet, beváltás.

Mindenhonnan van **CSV-letöltés**, ami dupla kattintásra, ékezethelyesen nyílik magyar
Excelben.

## Címkeszűrő – csak a hivatalos ICDL-mintakérdések

A kvízösszeállítóban a nehézség alatt van egy **Címke** legördülő. Ez a három
válogatási mód (dia / fejezet / témakör) **fölött** szűr: bármelyiket választod,
tovább szűkít.

A legfontosabb címke a **„hivatalos ICDL-mintakérdés"** (a bankban: `hivatalos_minta`).
Ezek szó szerint az NJSZT hivatalos ICDL-vizsgafeladat-gyűjteményéből valók, nem
átfogalmazva. Ha ezt választod, próbavizsga-hangulatú kvízt kapsz.

- A **„inkább kihagyva"** pipával fordítva szűr: pont ezek nélkül sorsol.
- A legördülőben csak azok a címkék jelennek meg, amik **legalább 5 kérdésen**
  szerepelnek a bankban. Ha egy sincs, a szűrő nem is látszik.
- A kvíz **címébe belekerül** (pl. „… – csak: hivatalos ICDL-mintakérdés"), így az
  archívumban visszakereshető.
- Az előnézetben az ilyen kérdés kék **ICDL-minta** jelölőt kap.
- **A gyakorló módban** ugyanez a „Melyik rész?" legördülőben van („csak hivatalos
  ICDL-mintakérdés"), tehát a diák otthon is gyakorolhat a valódi vizsgakérdéseken —
  ha az adott bankot felszabadítottad.

## Parancssor (a saját gépeden)

```powershell
cd C:\Loci\prog\rmg-kvizarena
node admin\rmg-admin.js osztaly letrehoz 10T      # új osztály + belépőkód
node admin\rmg-admin.js diakok 10T                # azonositok.txt feltöltése
node admin\rmg-admin.js diakok 10T --fiokok       # + kész fiókok, kiosztólappal
node admin\rmg-admin.js jelszo 10T kovacs_b12     # elfelejtett jelszó
node admin\rmg-admin.js publikal --proba          # mi változna a kérdésbankban
node admin\rmg-admin.js publikal                  # kérdésbank feltöltése
```

## Ha valami nem megy

| Amit látsz | Mit jelent |
|---|---|
| „Nincs internetkapcsolat" piros sáv | kiesett a wifi; amint visszajön, folytatódik |
| „A rendszer elerte a napi ingyenes kereteet" | elfogyott a napi ingyenes keret. **A képernyőn látható végeredmény érvényes** — nyomd meg a „Végeredmény mentése CSV-be" gombot |
| „Ebben az osztalyban mar fut egy kviz" | egy korábbi kvíz nincs lezárva; nyisd meg a pultot, és fejezd be |
| „… nem tanari fiok" | ugyanabban a böngészőben diákként is beléptél. Használj másik böngészőt vagy inkognitó ablakot |
| a diák: „Nincs ilyen azonosito ebben az osztalyban" | az `azonositok.txt` nincs feltöltve: `rmg-admin diakok <osztaly>` |
| a diák elfelejtette a jelszavát | `rmg-admin jelszo <osztaly> <azonosito>` — nincs „elfelejtett jelszó" e-mail |

## Tartalék

Ha bármi elszáll óra közben, a régi offline ICDL Vizsgaterem szimulátor továbbra is
működik. Az élő kvíz nem kötelező eleme az órának.
