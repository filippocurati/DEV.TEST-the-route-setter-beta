# The Route Setter

Applicazione web per progettare tracciature di arrampicata indoor su una parete 3D, usando prese GLB locali e collider Convex Hull pre-calcolati.

## Prerequisiti

- .NET SDK `8.0.424`;
- Node.js `22.18.0`;
- npm `10.9.3`;
- browser desktop con WebGL 2.0.

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

## Comandi Principali

Dalla cartella `source/frontend`:

```powershell
npm run build
npm test
npm run test:e2e
npm run test:traceability
```

Il benchmark certificativo della fase 11 richiede una sessione desktop con accelerazione hardware:

```powershell
$env:PERF_HEADLESS = "false"
$env:PERF_DURATION_MS = "60000"
$env:PERF_HOLD_COUNT = "40"
npm run test:performance
```
