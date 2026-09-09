# TheRouteSetter v0.0.1

Applicazione web per progettare tracciature di arrampicata indoor su una parete 3D, usando prese GLB locali e collider Convex Hull pre-calcolati.

**Release v0.0.1 CHIUSA per accettazione dell'utente, con limiti noti accettati.** Il riferimento unico per stato, perimetro supportato, evidenze e punti di attenzione e lo [stato della versione](sdd-specs/06-stato-versione-v0.0.1.md). La chiusura non e una certificazione universale; i report delle fasi conservano gli esiti storici.

## Prerequisiti

- .NET SDK `8.0.424`;
- Node.js `22.18.0`;
- npm `10.9.3`;
- Google Chrome Stable desktop con WebGL 2.0, unico browser ufficialmente supportato; versione verificata `152.0.7977.76`. Gli aggiornamenti successivi rientrano nelle normali verifiche di regressione, non sono gia certificati.

Le versioni sono vincolate da `source/global.json`, `source/frontend/.nvmrc`, `source/frontend/package.json` e dai lockfile.

## Avvio Rapido

Terminale backend, dalla cartella `source`:

```powershell
dotnet restore .\TheRouteSetter.sln --locked-mode
dotnet run --project .\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj --launch-profile http
```

Terminale frontend, dalla cartella `source/frontend`:

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

Aprire `http://127.0.0.1:5173`. Swagger è disponibile su `http://localhost:5080/swagger`.

## Documentazione

- [Guida applicativa e architettura](docs/applicazione.md)
- [Test automatici e benchmark](docs/test-automatici.md)
- [Checklist documentale](docs/checklist-fase-12.md)
- [Specifiche SDD](sdd-specs/00-costituzione.md)
- [Tracciabilità requisiti](sdd-specs/04-tracciabilita.md)
- [Stato TheRouteSetter v0.0.1 e punti di attenzione](sdd-specs/06-stato-versione-v0.0.1.md)

## Comandi Principali

Dalla cartella `source/frontend`:

```powershell
npm run build
npm test
npm run test:e2e
npm run test:traceability
```

Il benchmark split-phase richiede una sessione desktop con accelerazione hardware; metodo ed evidenze precedenti sono descritti nella guida test, senza ricertificazione implicita:

```powershell
$env:PERF_HEADLESS = "false"
$env:PERF_DURATION_MS = "60000"
$env:PERF_HOLD_COUNT = "40"
npm run test:performance
```
