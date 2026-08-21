# Fase 0 - Implementazione bloccata

## 1. File modificati

### Soluzione e configurazione

- `source/TheRouteSetter.sln`
- `source/global.json`
- `source/Directory.Build.props`

### Backend

- `source/backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj`
- `source/backend/src/TheRouteSetter.Api/Program.cs`
- `source/backend/src/TheRouteSetter.Api/Controllers/SystemController.cs`
- `source/backend/src/TheRouteSetter.Api/appsettings.json`
- `source/backend/src/TheRouteSetter.Api/Properties/launchSettings.json`
- `source/backend/tests/TheRouteSetter.Api.Tests/TheRouteSetter.Api.Tests.csproj`
- `source/backend/tests/TheRouteSetter.Api.Tests/ApiSmokeTests.cs`
- `source/backend/Data/main-wall/.gitkeep`
- `source/backend/Data/holds/Hold1/.gitkeep`
- `source/backend/Data/holds/Hold2/.gitkeep`

### Frontend

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

- `phases-outcome/Phase_0_implementation_block.md`

I lockfile NuGet inizialmente generati non sono stati mantenuti, perche contenevano il fallback `MIConvexHull 1.1.19.504` e non rispettavano la versione esatta prescritta.

## 2. Requisiti coperti

- `REQ-ARC-001`: predisposti backend ASP.NET Core Web API e frontend TypeScript/Vite separati.
- `REQ-ARC-002`: predisposti controller ASP.NET Core, OpenAPI e Swagger; smoke test del documento OpenAPI superato prima dell'applicazione del pin esatto bloccante.
- `REQ-DEP-001`: versioni npm esatte; versioni NuGet espresse con intervalli esatti chiusi.
- `REQ-DEP-002`: `package-lock.json` presente; lock NuGet non producibile in modo conforme per il blocco descritto sotto.
- `REQ-DEP-003`: nessuna versione floating nelle dipendenze dirette npm e NuGet.
- `REQ-DEP-004`: tutte le baseline sono impostate come prescritto, ma `MIConvexHull 1.1.19` non esiste su NuGet e impedisce il completamento.

La copertura della fase e quindi parziale: la Definition of Done relativa a restore e lockfile NuGet non puo essere soddisfatta.

## 3. Test eseguiti e storico risultati

1. Verifica toolchain globale: .NET SDK `6.0.309` e Node `16.13.1` rilevati, insufficienti per la baseline. Installati temporaneamente e senza modificare il sistema .NET SDK `8.0.424` e Node `20.15.0`.
2. Primo restore NuGet con richiesta `MIConvexHull 1.1.19`: completato con warning `NU1601`; NuGet ha sostituito la versione inesistente con `1.1.19.504`. Risultato non conforme.
3. Generazione lock npm con `npm install --package-lock-only --ignore-scripts`: superata.
4. Restore NuGet `--locked-mode --force-evaluate`: superato ma con warning `NU1601` e fallback non conforme `1.1.19.504`.
5. Primo build backend: fallito per import `Xunit` mancante nello smoke test. Il difetto e stato corretto.
6. Secondo build backend: superato, 0 errori e 1 warning `NU1601` relativo a MIConvexHull.
7. Test backend xUnit: superati, 2 test su 2. Verificati endpoint health e documento Swagger/OpenAPI.
8. Build frontend `npm run build`: superato con TypeScript `5.4.5` e Vite `5.2.0`.
9. Prima esecuzione Vitest: test fisico skeleton superato, suite complessiva fallita per inclusione accidentale del file Playwright. Aggiunto `vitest.config.ts` per separare i runner.
10. Esecuzione parallela install/test npm: fallita per race sul medesimo `node_modules`; ripetuta correttamente in sequenza.
11. Restore frontend deterministico `npm ci --ignore-scripts`: superato. npm segnala 5 vulnerabilita nelle dipendenze baseline prescritte (1 moderata, 3 alte, 1 critica); non e stato applicato un aggiornamento fuori specifica.
12. Seconda esecuzione Vitest: superata, 1 test su 1.
13. Installazione Chromium Playwright: primo mirror fallito con HTTP 400, fallback automatico sul secondo mirror riuscito.
14. Playwright E2E: superato, 1 test su 1; verificato l'avvio del frontend in Chromium.
15. Restore finale con pin NuGet esatto `[1.1.19]`: fallito correttamente con `NU1102`. NuGet dichiara che `MIConvexHull (= 1.1.19)` non e stato trovato e indica `1.1.19.504` come versione piu vicina.
16. Verifica indice ufficiale NuGet `https://api.nuget.org/v3-flatcontainer/miconvexhull/index.json`: la versione `1.1.19` non e presente; le versioni della linea richiesta iniziano da `1.1.19.504`.

## 4. Limiti e blocchi

### Blocco di specifica

`REQ-DEP-004`, `sdd-specs/02-design-tecnico.md` e la Fase 0 prescrivono `MIConvexHull@1.1.19`. Questa versione esatta non e pubblicata su NuGet. Con un riferimento NuGet ordinario, la richiesta viene interpretata come versione minima e sostituita con `1.1.19.504`, violando `REQ-DEP-001`, `REQ-DEP-004`, `C15` e la Definition of Done. Con il pin esatto `[1.1.19]`, il restore fallisce con `NU1102`.

`phases_execution_command.md` vieta di modificare le specifiche per procedere e impone di interrompere la fase in questo caso. Serve quindi una modifica esplicita delle specifiche che sostituisca `MIConvexHull 1.1.19` con una versione realmente pubblicata, presumibilmente `1.1.19.504`, prima di poter rigenerare i lockfile NuGet e dichiarare conclusa la fase.

### Ambiente

- La macchina non dispone globalmente di .NET 8 e Node 18 o superiore. Le verifiche sono state eseguite con toolchain isolate sotto `C:\Users\FCurati\AppData\Local\Temp\opencode`.
- Il comando `git` non e disponibile nell'ambiente, quindi non e stato possibile verificare lo stato del repository.
- `npm audit` segnala vulnerabilita nelle versioni baseline vincolate. Non sono stati eseguiti aggiornamenti automatici per non violare `REQ-DEP-004` e `OPEN-003`.

## 5. Verifica manuale

Prerequisiti: installare .NET 8 SDK e Node.js 18 o superiore.

Il restore backend seguente riproduce attualmente il blocco atteso:

```powershell
Set-Location source
dotnet restore TheRouteSetter.sln --use-lock-file --force-evaluate
```

Risultato atteso nello stato bloccato: errore `NU1102` per `MIConvexHull (= 1.1.19)`.

Dopo l'approvazione e l'applicazione della correzione della versione MIConvexHull nelle specifiche e nel progetto, eseguire:

```powershell
Set-Location source
dotnet restore TheRouteSetter.sln --use-lock-file
dotnet restore TheRouteSetter.sln --locked-mode
dotnet build TheRouteSetter.sln --no-restore
dotnet test TheRouteSetter.sln --no-build --no-restore
```

Per verificare frontend, test fisico skeleton ed E2E:

```powershell
Set-Location source/frontend
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Per avviare manualmente backend e Swagger dopo la risoluzione del blocco:

```powershell
Set-Location source/backend/src/TheRouteSetter.Api
dotnet run
```

Aprire `http://localhost:5080/swagger`.

Per avviare il frontend:

```powershell
Set-Location source/frontend
npm run dev
```

Aprire `http://localhost:5173`.
