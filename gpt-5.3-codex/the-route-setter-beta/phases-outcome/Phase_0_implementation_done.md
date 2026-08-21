# Phase 0 - esito implementazione (DONE)

## 1) Elenco file modificati

- `source/backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj`
- `source/backend/src/TheRouteSetter.Application/TheRouteSetter.Application.csproj`
- `source/backend/tests/TheRouteSetter.Api.Tests/TheRouteSetter.Api.Tests.csproj`
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/TheRouteSetter.Api.IntegrationTests.csproj`
- `source/backend/tests/TheRouteSetter.Hull.Tests/TheRouteSetter.Hull.Tests.csproj`
- `source/backend/src/TheRouteSetter.Api/packages.lock.json`
- `source/backend/src/TheRouteSetter.Application/packages.lock.json`
- `source/backend/tests/TheRouteSetter.Api.Tests/packages.lock.json`
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/packages.lock.json`
- `source/backend/tests/TheRouteSetter.Hull.Tests/packages.lock.json`
- `source/frontend/playwright.config.ts`
- `source/frontend/package-lock.json`

Nota: la struttura fase 0 gia predisposta nel tentativo precedente resta valida (solution, scaffold backend/frontend/test, `Data/main-wall`, `Data/holds/Hold1`, `Data/holds/Hold2`).

## 2) Requisiti REQ-* coperti

- `REQ-ARC-001`: separazione backend/frontend in `source`.
- `REQ-ARC-002`: backend Web API con Swagger attivo e raggiungibile.
- `REQ-DEP-001`: dipendenze pin-nate a versione esatta.
- `REQ-DEP-002`: lockfile npm e NuGet presenti e versionati.
- `REQ-DEP-003`: nessuna versione floating (`^`, `~`, wildcard).
- `REQ-DEP-004`: baseline aggiornata applicata (incluso `MIConvexHull@1.1.19.504` e forma NuGet a intervallo esatto `[x.y.z]`).

## 3) Test eseguiti per la fase e risultati

Storico completo esecuzioni durante questo tentativo:

1. `dotnet --list-sdks` (ambiente iniziale)
   - Esito: OK, solo SDK 3.1/5.0/6.0 presenti.

2. `node --version` e `npm --version` (ambiente iniziale)
   - Esito: OK, Node `v16.13.1`, npm `8.1.2`.

3. `winget install --exact --id Microsoft.DotNet.SDK.8 --version 8.0.424 ...`
   - Esito: FALLITO, installer exit code `1260` (policy macchina).

4. `winget install --exact --id OpenJS.NodeJS.LTS --version 22.18.0 ...`
   - Esito: FALLITO (versione non disponibile nel catalogo winget).

5. Installazione toolchain locale non invasiva (temp)
   - Download+estrazione Node `22.18.0` in `C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64`
   - Install .NET SDK `8.0.424` con `dotnet-install.ps1` in `C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424`
   - Esito: OK.

6. `dotnet restore source/backend/TheRouteSetterBeta.sln --use-lock-file` (dotnet 8 locale)
   - Esito: OK.

7. `dotnet build source/backend/TheRouteSetterBeta.sln -c Release` (dotnet 8 locale)
   - Esito: OK.

8. `dotnet test source/backend/TheRouteSetterBeta.sln -c Release` (dotnet 8 locale)
   - Esito: OK (3/3 progetti test passati).

9. `npm install` (Node 22 locale)
   - Esito: OK.

10. `npm run build` (Node 22 locale)
    - Primo esito: FALLITO per dipendenza opzionale Rollup mancante (`@rollup/rollup-win32-x64-msvc`).

11. Reinstall pulita frontend (`Remove-Item node_modules` + `npm install`)
    - Esito: OK.

12. `npm run build` (retry)
    - Esito: OK.

13. `npm run test:physics` (Node 22 locale)
    - Primo esito: FALLITO (risoluzione package `async_hooks` in esecuzione via wrapper npm).

14. `node node_modules/vitest/vitest.mjs run tests/physics`
    - Esito: OK.

15. `npm run test:physics` con PATH forzato a Node locale
    - Esito: OK.

16. `npm run test:e2e`
    - Primo esito: FALLITO (runtime loader Playwright via wrapper npm).

17. `node node_modules/@playwright/test/cli.js test`
    - Esito: OK (1 test passed).

18. Verifica Swagger runtime
    - Comando: avvio API con dotnet 8 locale su `http://127.0.0.1:5099` + `Invoke-WebRequest /swagger/index.html`
    - Esito: OK (`SwaggerStatus=200`).

19. Restore deterministico da lockfile
    - `dotnet restore source/backend/TheRouteSetterBeta.sln --locked-mode` -> OK
    - `npm ci` (Node 22 locale) -> OK

## 4) Eventuali limiti/blocchi riscontrati in fase di implementazione

- Installazione globale `.NET SDK 8.0.424` via `winget` bloccata da policy sistema (exit code `1260`).
- `winget` non espone `OpenJS.NodeJS.LTS@22.18.0` nel catalogo disponibile su questa macchina.
- Workaround applicato con successo: toolchain locale in cartella temp pre-approvata e uso esplicito degli eseguibili locali per tutte le verifiche fase 0.
- Nessun blocco residuo sulla fase: DoD soddisfatta con toolchain conforme alle specifiche aggiornate.

## 5) Passi manuali per verificare personalmente la fase (comandi inclusi)

### Backend (.NET 8.0.424 locale)

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" restore "source\backend\TheRouteSetterBeta.sln" --locked-mode
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" build "source\backend\TheRouteSetterBeta.sln" -c Release
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" test "source\backend\TheRouteSetterBeta.sln" -c Release
```

### Frontend (Node 22.18.0 locale)

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node_modules\npm\bin\npm-cli.js" ci
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node_modules\npm\bin\npm-cli.js" run build
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node_modules\npm\bin\npm-cli.js" run test:physics
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "node_modules\@playwright\test\cli.js" test
```

### Verifica Swagger raggiungibile

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" run --project "source\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj" --urls "http://127.0.0.1:5099"
```

Poi aprire `http://127.0.0.1:5099/swagger/index.html`.
