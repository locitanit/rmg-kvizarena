# Beuzemeles (1. fazis)

Ez a lista egyszer kell vegigmenni. Utana a napi hasznalat mar csak az admin
parancssor es a bongeszo.

Amit a gepre elore fel kell tenni: **Node.js** (megvan) es **Java** (a Firebase
emulator azon fut, csak a tesztekhez kell).

---

## 1. Firebase projekt letrehozasa

1. <https://console.firebase.google.com> &rarr; **Projekt hozzaadasa**
2. Nev: `icdl-gyakorlo` (ha foglalt, a Firebase ad egy utotagot - jegyezd fel!)
3. Google Analytics: **nem kell**, kapcsold ki.
4. A projekt elkeszulte utan: **Build &rarr; Firestore Database &rarr; Adatbazis letrehozasa**
   - **Regio: `europe-west1` (Belgium)** vagy `europe-west3` (Frankfurt).
     Ez adatvedelmi dontes, es **utolag nem valtoztathato**.
   - Inditas: **production mode** (a sajat szabalyainkat toltjuk fel).
5. **Build &rarr; Authentication &rarr; Kezdes &rarr; E-mail/jelszo &rarr; Engedelyezes**
   (a "jelszo nelkuli belepes" maradjon kikapcsolva).

> A projekt a Spark (ingyenes) csomagon marad. Bankkartyat **ne** adj meg.

## 2. A webes konfiguracio bemasolasa

Firebase konzol &rarr; **Projekt beallitasai** (fogaskerek) &rarr; **Altalanos** &rarr;
**Sajat alkalmazasok** &rarr; **`</>` Web** &rarr; nev: `icdl-gyakorlo-web`
(a Hosting nem kell, GitHub Pages-t hasznalunk).

A kapott `firebaseConfig` ertekeit ird at itt:

```
web/js/firebase-config.js
```

Ez az adat **nyugodtan publikus lehet** - nem ez vedi a rendszert, hanem a
`firestore.rules`.

## 3. Szolgaltatasfiok-kulcs az admin parancssorhoz

Firebase konzol &rarr; **Projekt beallitasai &rarr; Szolgaltatasfiokok &rarr;
Uj privat kulcs letrehozasa**. A letoltott JSON-t tedd a **repon kivulre**, pl.:

```
C:\Loci\titkok\icdl-gyakorlo-serviceaccount.json
```

> Ez a kulcs teljes hozzaferest ad az adatbazishoz. Soha ne keruljon a repoba,
> ne kuldd el, es ne masold a `prog` mappa ala.

## 4. A config.json

```powershell
cd C:\Loci\prog\icdl-gyakorlo
copy admin\config.pelda.json admin\config.json
```

Amit at kell irni benne:

| mezo | mi legyen |
|---|---|
| `firebase_projekt` | a valodi projektazonosito (ha kapott utotagot, azzal egyutt) |
| `szolgaltatasfiok_ut` | a 3. lepesben letoltott kulcs utja |
| `tanar_email` | a sajat e-mail cimed - ehhez kerulnek az osztalyok |
| `osztalyok_ut` | ahol az osztalymappak vannak (`azonositok.txt`-vel) |

## 5. Csomagok telepitese

```powershell
cd C:\Loci\prog\icdl-gyakorlo
npm install
cd admin
npm install
cd ..
```

## 6. A biztonsagi szabalyok kikuldese

Eloszor teszteld (ehhez kell a Java):

```powershell
npm run teszt
```

Ha zold, mehet fel:

```powershell
npx firebase login
npx firebase deploy --only firestore:rules
```

> **Ez a legfontosabb lepes.** Nincs mogotte szerver, ami ujraellenorizne: amit a
> szabalyok nem tiltanak meg, azt egy diak meg tudja csinalni.

## 7. Tanari fiok es az elso osztaly

```powershell
node admin\icdl-admin.js tanar hozzaad sajat@email.hu "Vezetek Kereszt"
node admin\icdl-admin.js osztaly letrehoz 10T
node admin\icdl-admin.js diakok 10T
```

- A `tanar hozzaad` kiirja a generalt jelszot - **ird fel**, tobbszor nem lesz kiirva.
- Az `osztaly letrehoz` kiirja a **belepokodot** (pl. `10T-K7QX`). Ezt kapjak a diakok.
- A `diakok` az `azonositok.txt`-t tolti fel. Ha az meg ures, elobb ird bele az
  azonositokat, soronkent egyet.

Ha inkabb kesz fiokokat osztanal ki (a diak nem regisztral, csak belep):

```powershell
node admin\icdl-admin.js diakok 10T --fiokok
```

Ez `admin\kiosztas_10T.csv` neven kiirja az azonosito-jelszo parokat.
**Kiosztas utan torold a fajlt.**

## 8. GitHub Pages

1. Told fel a repot GitHubra.
2. **Settings &rarr; Pages &rarr; Source: `GitHub Actions`**.
3. A `main` agra puskolva a `.github/workflows/pages.yml` felteszi a `web/` mappat.

Cimek:

- diak: `https://<felhasznalo>.github.io/icdl-gyakorlo/`
- tanar: `https://<felhasznalo>.github.io/icdl-gyakorlo/tanar.html`

---

## Fejlesztes emulator ellen (nem kell hozza eles projekt)

```powershell
npm run emulator
```

Kulon ablakban:

```powershell
node admin\icdl-admin.js tanar hozzaad teszt@radnoti.hu "Teszt Tanar" --emulator
node admin\icdl-admin.js osztaly letrehoz 10T --tanar teszt@radnoti.hu --emulator
```

A webes felulet **`localhost`-on automatikusan** az emulatorhoz csatlakozik
(lasd `web/js/firebase-config.js`), tehat eleg egy statikus kiszolgalo:

```powershell
npx serve web
```

## Ha valami nem megy

| Tunet | Mit jelent |
|---|---|
| `Could not spawn 'java -version'` | Nincs Java. `winget install EclipseAdoptium.Temurin.21.JRE` |
| `Meg nincs beallitva` a weboldalon | A `web/js/firebase-config.js` meg a minta ertekeket tartalmazza |
| `Nincs ilyen azonosito ebben az osztalyban` | Az `azonositok.txt` nincs feltoltve: `icdl-admin diakok <osztaly>` |
| `Ennek a fioknak nincs tanari joga` | `icdl-admin tanar hozzaad <email> <nev>` |
| `Missing or insufficient permissions` | A szabalyok nincsenek kikuldve (6. lepes) |
