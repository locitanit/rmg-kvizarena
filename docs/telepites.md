# Beüzemelés

Ez a lista egyszer kell végigmenni. Utána a napi használat már csak az admin
parancssor és a böngésző.

Amit a gépre elő kell készíteni: **Node.js** és **Java** (a Firebase emulátor azon
fut, csak a tesztekhez kell). Ezen a gépen mindkettő megvan; a Java hordozható
változatban: `C:\Loci\eszkozok\jdk-21.0.12.1+1-jre\bin`, a felhasználói PATH-ban.

---

## 1. Firebase projekt

**Ez megvan.** A projekt azonosítója **`icdl-gyakorlo`**, és ez **így is marad**:

> A Firebase projektazonosító létrehozás után **nem nevezhető át**. A megjelenő
> nevet a konzolban át lehet írni „RMG Kvízaréná"-ra, de az azonosító (és vele a
> `icdl-gyakorlo.firebaseapp.com` cím) állandó. Új azonosítóhoz új projekt kellene:
> újra kellene publikálni a 2809 kérdést, és **minden diáknak újra regisztrálnia**.
> Nem éri meg – az azonosítót amúgy sem látja senki a felületen.

Ha valaha mégis nulláról indulna egy projekt:

1. <https://console.firebase.google.com> &rarr; **Projekt hozzáadása**
2. Google Analytics: **nem kell**, kapcsold ki.
3. **Build &rarr; Firestore Database &rarr; Adatbázis létrehozása**
   - **Régió: `europe-west1` (Belgium)** vagy `europe-west3` (Frankfurt).
     Ez adatvédelmi döntés, és **utólag nem változtatható**.
   - Indítás: **production mode** (a saját szabályainkat töltjük fel).
4. **Build &rarr; Authentication &rarr; Kezdés &rarr; E-mail/jelszó &rarr; Engedélyezés**
   (a „jelszó nélküli belépés" maradjon kikapcsolva).

> A projekt a Spark (ingyenes) csomagon marad. Bankkártyát **ne** adj meg.

## 2. A webes konfiguráció bemásolása

Firebase konzol &rarr; **Projekt beállításai** (fogaskerék) &rarr; **Általános** &rarr;
**Saját alkalmazások** &rarr; **`</>` Web**
(a Hosting nem kell, GitHub Pages-t használunk).

A kapott `firebaseConfig` értékeit írd át itt:

```
web/js/firebase-config.js
```

Ez az adat **nyugodtan publikus lehet** – nem ez védi a rendszert, hanem a
`firestore.rules`.

> **Buktató, ami már egyszer megtörtént:** a Firebase konzol
> `const firebaseConfig = {...}` alakban adja a konfigurációt. **Csak az értékeket**
> írd át – az `export const FIREBASE_CONFIG =` sorkezdetet hagyd változatlanul,
> különben a többi modul nem találja meg, és az oldal üres marad. A localhoston ez
> nem látszik, mert ott az emulátor-konfig fut!

## 3. Szolgáltatásfiók-kulcs az admin parancssorhoz

Firebase konzol &rarr; **Projekt beállításai &rarr; Szolgáltatásfiókok &rarr;
Új privát kulcs létrehozása**. A letöltött JSON-t tedd a **repón kívülre**, pl.:

```
C:\Loci\titkok\icdl-gyakorlo-firebase-adminsdk.json
```

> Ez a kulcs teljes hozzáférést ad az adatbázishoz. Soha ne kerüljön a repóba,
> ne küldd el, és ne másold a `prog` mappa alá.

## 4. A config.json

```powershell
cd C:\Loci\prog\rmg-kvizarena
copy admin\config.pelda.json admin\config.json
```

Amit át kell írni benne:

| mező | mi legyen |
|---|---|
| `firebase_projekt` | `icdl-gyakorlo` (a Firebase projektazonosító, nem a projekt neve) |
| `szolgaltatasfiok_ut` | a 3. lépésben letöltött kulcs útja |
| `tanar_email` | a saját e-mail-címed – ehhez kerülnek az osztályok |
| `osztalyok_ut` | ahol az osztálymappák vannak (`azonositok.txt`-vel) |

## 5. Csomagok telepítése

```powershell
cd C:\Loci\prog\rmg-kvizarena
npm install
cd admin
npm install
cd ..
```

## 6. A biztonsági szabályok kiküldése

Először teszteld (ehhez kell a Java):

```powershell
npm run teszt
```

Ha zöld, mehet fel:

```powershell
npx firebase login
npx firebase deploy --only firestore:rules
```

> **Ez a legfontosabb lépés.** Nincs mögötte szerver, ami újraellenőrizne: amit a
> szabályok nem tiltanak meg, azt egy diák meg tudja csinálni.

## 7. Tanári fiók és az első osztály

```powershell
node admin\rmg-admin.js tanar hozzaad sajat@email.hu "Vezetek Kereszt"
node admin\rmg-admin.js osztaly letrehoz 10T
node admin\rmg-admin.js diakok 10T
```

- A `tanar hozzaad` kiírja a generált jelszót – **írd fel**, többször nem lesz kiírva.
- Az `osztaly letrehoz` kiírja a **belépőkódot** (pl. `10T-K7QX`). Ezt kapják a diákok.
- A `diakok` az `azonositok.txt`-t tölti fel. Ha az még üres, előbb írd bele az
  azonosítókat, soronként egyet.

Ha inkább kész fiókokat osztanál ki (a diák nem regisztrál, csak belép):

```powershell
node admin\rmg-admin.js diakok 10T --fiokok
```

Ez `admin\kiosztas_10T.csv` néven kiírja az azonosító-jelszó párokat.
**Kiosztás után töröld a fájlt.**

## 8. Kérdésbank publikálása

```powershell
node admin\rmg-admin.js publikal --proba     # megmutatja, mi változna
node admin\rmg-admin.js publikal             # és most tényleg
```

## 9. GitHub Pages

**Ez megvan:** a repó publikus, a Pages forrása `GitHub Actions`.
A `main` ágra puskolva a `.github/workflows/pages.yml` felteszi a `web/` mappát.

| | |
|---|---|
| repó | <https://github.com/locitanit/rmg-kvizarena> |
| diák | <https://locitanit.github.io/rmg-kvizarena/> |
| tanár | <https://locitanit.github.io/rmg-kvizarena/tanar.html> |

---

## Fejlesztés emulátor ellen (nem kell hozzá éles projekt)

```powershell
npm run emulator
```

Külön ablakban:

```powershell
node admin\rmg-admin.js tanar hozzaad teszt@radnoti.hu "Teszt Tanar" --emulator
node admin\rmg-admin.js osztaly letrehoz 10T --tanar teszt@radnoti.hu --emulator
```

A webes felület **`localhost`-on automatikusan** az emulátorhoz csatlakozik
(lásd `web/js/firebase-config.js`), tehát elég egy statikus kiszolgáló:

```powershell
npx serve web
```

## Ha valami nem megy

| Tünet | Mit jelent |
|---|---|
| `Could not spawn 'java -version'` | A `C:\Loci\eszkozok\jdk-21...\bin` nincs a PATH-ban. Új parancssort nyiss, vagy tedd vissza a PATH-ba. |
| `Még nincs beállítva` a weboldalon | A `web/js/firebase-config.js` még a minta értékeket tartalmazza |
| `Nincs ilyen azonosító ebben az osztályban` | Az `azonositok.txt` nincs feltöltve: `rmg-admin diakok <osztaly>` |
| `Ennek a fióknak nincs tanári joga` | `rmg-admin tanar hozzaad <email> <nev>` |
| `Missing or insufficient permissions` | A szabályok nincsenek kiküldve (6. lépés) |
