# Fase 0 - Implementazione completata

## 1. File modificati

### Soluzione e configurazione

- `source/.gitignore`
- `source/TheRouteSetter.sln`
- `source/global.json`
- `source/Directory.Build.props`

### Backend

- `source/backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj`
- `source/backend/src/TheRouteSetter.Api/packages.lock.json`
- `source/backend/src/TheRouteSetter.Api/Program.cs`
- `source/backend/src/TheRouteSetter.Api/Controllers/SystemController.cs`
- `source/backend/src/TheRouteSetter.Api/appsettings.json`
- `source/backend/src/TheRouteSetter.Api/Properties/launchSettings.json`
- `source/backend/tests/TheRouteSetter.Api.Tests/TheRouteSetter.Api.Tests.csproj`
- `source/backend/tests/TheRouteSetter.Api.Tests/packages.lock.json`
- `source/backend/tests/TheRouteSetter.Api.Tests/ApiSmokeTests.cs`
- `source/backend/Data/main-wall/.gitkeep`
- `source/backend/Data/holds/Hold1/.gitkeep`
- `source/backend/Data/holds/Hold2/.gitkeep`

### Frontend

- `source/frontend/.nvmrc`
- `source/frontend/package.json`
- `source/frontend/package-lock.json`
- `source/frontend/tsconfig.json`
- `source/frontend/vite.config.ts`
- `source/frontend/vitest.config.ts`
- `source/frontend/playwright.config.ts`
- `source/frontend/index.html`
- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`
- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/e2e/startup.spec.ts`

### Esito fase

- `phases-outcome/Phase_0_implementation_done.md`

Il precedente `phases-outcome/Phase_0_implementation_block.md` non e stato sovrascritto e conserva l'esito del primo tentativo.

## 2. Requisiti coperti

- `REQ-ARC-001`: soluzione separata in backend ASP.NET Core Web API e frontend browser TypeScript/Vite.
- `REQ-ARC-002`: controller ASP.NET Core separato dal bootstrap, OpenAPI e Swagger configurati e verificati.
- `REQ-DEP-001`: tutte le dipendenze dirette npm e NuGet hanno versioni esatte.
- `REQ-DEP-002`: presenti `package-lock.json` e i due `packages.lock.json` NuGet.
- `REQ-DEP-003`: nessuna versione diretta floating con `^`, `~` o wildcard.
- `REQ-DEP-004`: applicata la baseline stabile prescritta, inclusi MIConvexHull `1.1.19.504`, .NET SDK `8.0.424`, Node.js `22.18.0` e npm `10.9.3`.

Sono inoltre predisposti gli skeleton xUnit, Vitest per la fisica headless e Playwright E2E richiesti dalla fase. Non sono state implementate API applicative, discovery asset, fisica o scena 3D appartenenti alle fasi successive.

## 3. Test eseguiti e storico risultati

1. Verifica specifiche aggiornate: superata. `REQ-DEP-004` e il design tecnico concordano sulla nuova baseline.
2. Installazione toolchain isolata Node.js `22.18.0` con npm `10.9.3`: superata.
3. Verifica .NET SDK isolato `8.0.424`: superata.
4. Restore NuGet iniziale con generazione lockfile: superato senza warning.
5. Generazione aggiornata `package-lock.json` con npm `10.9.3`: superata.
6. Controllo lock NuGet: superato; MIConvexHull richiesto e risolto esattamente come `1.1.19.504`, gli altri package diretti usano intervalli chiusi.
7. Controllo baseline npm nel lockfile: superato; versioni dirette e toolchain corrispondono a `REQ-DEP-004`.
8. Controllo prerelease dirette (`alpha`, `beta`, `rc`): superato, nessuna corrispondenza.
9. Restore backend pulito `dotnet restore --locked-mode` con `ContinuousIntegrationBuild=true`: superato.
10. Build backend `dotnet build --no-restore`: superata con 0 warning e 0 errori.
11. Restore frontend deterministico `npm ci --ignore-scripts`: superato. npm segnala 5 vulnerabilita note nella baseline vincolata: 1 moderata, 3 alte e 1 critica.
12. Build frontend `npm run build`: superata con TypeScript `5.4.5` e Vite `5.2.0`.
13. Suite fisica skeleton Vitest: superata, 1 test su 1.
14. Suite backend xUnit: superata, 2 test su 2. Verificati health endpoint e raggiungibilita del documento Swagger/OpenAPI tramite host ASP.NET Core.
15. Suite E2E Playwright Chromium: superata, 1 test su 1. Verificato l'avvio Vite e il rendering del bootstrap frontend.
16. Verifica finale toolchain: superata; Node.js `22.18.0`, npm `10.9.3`, .NET SDK `8.0.424`.

Storico precedente: il primo tentativo e documentato in `Phase_0_implementation_block.md`; era bloccato dalla versione NuGet inesistente `MIConvexHull 1.1.19`. La nuova specifica `1.1.19.504` ha risolto il blocco.

## 4. Limiti e blocchi

Nessun blocco residuo per la fase 0.

- La macchina non espone globalmente le toolchain richieste; per questa esecuzione sono state installate in forma isolata sotto `C:\Users\FCurati\AppData\Local\Temp\opencode`. Il progetto vincola comunque le versioni tramite `global.json`, `.nvmrc`, `engines` e `packageManager`.
- `npm audit` segnala 5 vulnerabilita nelle versioni transitive della baseline prescritta. Non e stato eseguito `npm audit fix --force`, poiche modificherebbe la baseline senza il processo dedicato previsto da `OPEN-003`.
- Il comando `git` non e disponibile nell'ambiente; non e stato possibile verificare lo stato del repository. Questo non incide su build, test o lockfile.

## 5. Verifica manuale

Prerequisiti: .NET SDK `8.0.424`, Node.js `22.18.0`, npm `10.9.3`.

Verifica backend deterministica:

```powershell
Set-Location source
$env:ContinuousIntegrationBuild = "true"
dotnet restore TheRouteSetter.sln --locked-mode
dotnet build TheRouteSetter.sln --no-restore
dotnet test TheRouteSetter.sln --no-build --no-restore
```

Avvio backend e Swagger:

```powershell
Set-Location source/backend/src/TheRouteSetter.Api
dotnet run
```

Aprire `http://localhost:5080/swagger` e verificare anche `http://localhost:5080/api/system/health`.

Verifica frontend deterministica:

```powershell
Set-Location source/frontend
node --version
npm --version
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Avvio frontend:

```powershell
Set-Location source/frontend
npm run dev
```

Aprire `http://localhost:5173` e verificare la schermata bootstrap `The Route Setter`.
