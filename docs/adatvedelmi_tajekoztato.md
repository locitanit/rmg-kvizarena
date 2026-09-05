# ICDL Gyakorló – adatvédelmi tájékoztató

*Szülőknek, diákoknak és az iskolának. Egy oldal.*

**Mi ez?** Egy osztálytermi kvízalkalmazás a digitális kultúra órákhoz. A tanár órán
kvízt indít, a diákok a saját telefonjukról válaszolnak, és pontokat gyűjtenek.

---

## Ami felkerül a felhőbe

| Adat | Példa | Miért kell |
|---|---|---|
| gépterem-azonosító | `kovacs_b12` | ezzel lép be a diák |
| becenév | `Bence` | ez látszik a ranglistán (a diák maga választja) |
| kvízeredmények | pontszám, helyezés, hány jó válasz | a verseny és az értékelés |
| témakörönkénti teljesítmény | „űrlapok: 14/18" | a tanár lássa, mit kell újra elővenni |
| csillagok | 7 csillag, 1 beváltott ötös | az órai munka jegy |

## Ami NEM kerül fel

- **A diák valódi neve.** Sehol nem szerepel.
- **E-mail-cím.** A diákok nem adnak meg e-mail-címet.
- **Osztálynapló-adat, jegyek, hiányzás.** Semmi ilyen.
- **Bármi a telefonról:** nincs helymeghatározás, nincs kamera, nincs névjegyzék.

Az azonosító → valódi név megfeleltetés **kizárólag a tanár gépén** létezik, egy
táblázatban, amely soha nem kerül fel az internetre. A felhőben tárolt adatból
önmagában nem lehet megmondani, ki az a `kovacs_b12`.

## Hol tárolódik

Google **Cloud Firestore**, a Firebase ingyenes csomagján, az **európai unióban**
(`europe-west1`, Belgium). A tárolás a Google adatfeldolgozói feltételei szerint
történik. Az alkalmazás kódja nyilvános:
<https://github.com/locitanit/icdl-gyakorlo>

## Meddig

A tanév végéig, illetve amíg a tanár törli. Egy osztály adatai a tanév lezárásakor
törölhetők.

## Bejelentkezés

A Firebase belépéshez technikailag e-mail-címet vár, ezért a program egy **nem létező,
mesterséges címet** állít elő az azonosítóból (`kovacs_b12@10t.rmg.local`). Erre a címre
levelet küldeni nem lehet, és a diák soha nem is látja.

Emiatt **„elfelejtett jelszó" e-mail sincs**: ha egy diák elfelejti a jelszavát, a tanár
állít be újat.

## Ki lát mit

- **A diák** csak a saját adatait látja, plusz a kvíz alatti ranglistát (becenév +
  pontszám). Más diák válaszait, statisztikáját nem éri el.
- **A tanár** a saját osztályai adatait látja.
- **Más nem.** Ezt nem ígéret, hanem a Firestore biztonsági szabályai kényszerítik ki,
  és minden tiltásra automata teszt fut (`tesztek/rules/`).

## Kérdés esetén

A tanárhoz kell fordulni. Az adatok törlését, kiadását vagy javítását ő tudja
elintézni.

---

*Utoljára frissítve: 2026-09-05*
