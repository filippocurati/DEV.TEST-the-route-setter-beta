# Phase 0 - esito implementazione (BLOCCO)

## 1) Elenco file modificati

- `source/backend/TheRouteSetterBeta.sln`
- `source/backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj`
- `source/backend/src/TheRouteSetter.Api/Program.cs`
- `source/backend/src/TheRouteSetter.Application/TheRouteSetter.Application.csproj`
- `source/backend/tests/TheRouteSetter.Api.Tests/TheRouteSetter.Api.Tests.csproj`
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/TheRouteSetter.Api.IntegrationTests.csproj`
- `source/backend/tests/TheRouteSetter.Hull.Tests/TheRouteSetter.Hull.Tests.csproj`
- `source/frontend/package.json`
- `source/frontend/package-lock.json`
- `source/frontend/index.html`
- `source/frontend/tsconfig.json`
- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`
- `source/frontend/vitest.config.ts`
- `source/frontend/playwright.config.ts`
- `source/frontend/tests/physics/physics-baseline.test.ts`
- `source/frontend/tests/e2e/smoke.spec.ts`
- cartelle create:
  - `source/backend/Data/main-wall/`
  - `source/backend/Data/holds/Hold1/`
  - `source/backend/Data/holds/Hold2/`

## 2) Requisiti REQ-* coperti

Copertura completata/parziale sulla fase 0:

- `REQ-ARC-001`: struttura backend/frontend separata in `source` predisposta.
- `REQ-ARC-002` (parziale): Web API scaffold con Swagger abilitato.
- `REQ-DEP-001`: versioni dipendenze pin-nate (no `^`, `~`, wildcard) sui file aggiornati.
- `REQ-DEP-002` (parziale): lockfile npm presente (`package-lock.json`), lock NuGet non generabile per blocco tecnico.
- `REQ-DEP-003`: nessuna versione floating nei package configurati.
- `REQ-DEP-004` (parziale): baseline package allineata; blocco su esecuzione locale per prerequisiti runtime mancanti (`.NET 8 SDK` e Node compatibile).

## 3) Test eseguiti per la fase e risultati

Storico esecuzioni:

1. `dotnet --version` -> OK (6.0.309)
2. `dotnet --list-sdks` -> SDK installati: 3.1/5.0/6.0; **.NET 8 assente**
3. `node --version` + `npm --version` -> OK (Node 16.13.1, npm 8.1.2)
4. `npm install` in `source/frontend` -> FALLITO
   - tentativo 1: timeout rete
   - tentativo 2: errore install `esbuild` + engine incompatibili (Vite/Vitest richiedono Node >= 18)
5. `npm install --package-lock-only --ignore-scripts` in `source/frontend` -> OK (lockfile generato)
6. `dotnet restore source/backend/TheRouteSetterBeta.sln` -> FALLITO
   - errore `NETSDK1045`: SDK corrente non supporta `net8.0`

Nota: non e stato possibile arrivare ai build/smoke test finali previsti dalla DoD per limiti ambiente.

## 4) Limiti/blocchi riscontrati

Blocchi tecnici che impediscono chiusura positiva della fase 0:

- **Blocco A (critico):** SDK `.NET 8` non installato nell'ambiente. I progetti sono configurati correttamente su `net8.0` (come da `REQ-DEP-004`), ma restore/build falliscono con `NETSDK1045`.
- **Blocco B (critico):** Node.js disponibile e `v16.13.1`, mentre baseline `vite@5.2.0` e `vitest@1.6.0` richiede Node `>=18`; install/build frontend non eseguibili in modo completo.
- **Effetto del blocco:** impossibile completare DoD di fase 0 su questa macchina (build backend/frontend e restore deterministico completo con lockfile NuGet).

## 5) Passi manuali per verifica personale (comandi inclusi)

Prerequisiti richiesti per sbloccare la fase:

- Installare `.NET SDK 8.x`
- Aggiornare Node.js a `>=18` (raccomandato 20 LTS)

Verifiche da eseguire dopo aggiornamento ambiente:

1. Verifica prerequisiti

```powershell
dotnet --list-sdks
node --version
npm --version
```

2. Backend restore/build

```powershell
dotnet restore "source/backend/TheRouteSetterBeta.sln"
dotnet build "source/backend/TheRouteSetterBeta.sln" -c Release
```

3. Frontend install/build

```powershell
npm install --prefix "source/frontend"
npm run build --prefix "source/frontend"
```

4. Smoke suite skeleton

```powershell
dotnet test "source/backend/TheRouteSetterBeta.sln" -c Release
npm run test:physics --prefix "source/frontend"
npm run test:e2e --prefix "source/frontend"
```

5. Avvio manuale API e verifica Swagger

```powershell
dotnet run --project "source/backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj"
```

Aprire poi lo Swagger UI all'URL riportato in output (tipicamente `/swagger`).
