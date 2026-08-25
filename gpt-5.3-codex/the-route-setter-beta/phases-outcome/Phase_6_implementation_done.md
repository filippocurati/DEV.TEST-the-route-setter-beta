# Phase 6 - esito implementazione (DONE)

## 1) Elenco file modificati

- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`
- `source/frontend/src/api/holdsApi.ts`
- `source/frontend/tests/e2e/smoke.spec.ts`
- `source/frontend/tests/e2e/catalog-phase6.spec.ts`

## 2) Requisiti REQ-* coperti

- `REQ-CAT-001`: pannello catalogo a sinistra con lista verticale scrollabile.
- `REQ-CAT-002`: card hold con preview (`PREV_`), azioni `Utilizza` e `Dettagli`.
- `REQ-CAT-003`: cache sessione del manifest hold (una sola fetch catalogo per sessione runtime).
- `REQ-CAT-004`: lazy-load GLB on-demand solo su `Utilizza`/`Dettagli`.
- `REQ-CAT-005`: modale dettagli con load modello all'apertura e rilascio risorse alla chiusura.
- `REQ-CAT-006`: transizione catalogo/scena coerente (hold usata sparisce da catalogo, rimozione la ripristina).
- `REQ-CAT-007`: unicita uso hold (non duplicabile in scena mentre e in uso).
- `REQ-SCN-001`: separazione modello/istanza (template cache + clone per istanza scena).
- `REQ-UI-001`: layout complessivo catalogo sinistra + viewport nel restante spazio.
- `REQ-UI-002`: menu superiore con bottoni `Genera immagine` e `Rimuovi presa` presenti.

## 3) Test eseguiti per la fase e risultati

1. `npm run build`
   - Esito: OK.

2. `node node_modules/@playwright/test/cli.js test tests/e2e/smoke.spec.ts --workers=1`
   - Esito: OK.

3. `node node_modules/@playwright/test/cli.js test tests/e2e/physics-foundation.spec.ts --workers=1`
   - Esito: OK.

4. `node node_modules/@playwright/test/cli.js test tests/e2e/catalog-phase6.spec.ts --workers=1`
   - Esito: OK.

## 4) Eventuali limiti/blocchi riscontrati in fase di implementazione

- Nessun blocco residuo.
- I bottoni top menu sono presenti come da requisito UI fase 6; la loro logica avanzata resta demandata alle fasi successive.

## 5) Passi manuali per verificare personalmente la fase (comandi inclusi)

1. Avvio backend:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" run --project "source\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj" --urls "http://127.0.0.1:5099"
```

2. Avvio frontend:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node_modules\npm\bin\npm-cli.js" run dev --prefix "source/frontend" -- --host 127.0.0.1 --port 5173
```

3. Verifica manuale in browser (`http://127.0.0.1:5173`):
- confermare catalogo a sinistra con card e bottoni `Utilizza`/`Dettagli`;
- aprire `Dettagli` e chiudere modale;
- usare una hold e verificare che scompaia dal catalogo;
- cliccare `Rimuovi presa` e verificare rientro della hold nel catalogo.

4. Verifica automatica fase 6:

```powershell
$env:E2E_BACKEND_CMD = '"C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" run --project "../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj" --urls http://127.0.0.1:5099'
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "source/frontend/node_modules/@playwright/test/cli.js" test "source/frontend/tests/e2e/catalog-phase6.spec.ts" --workers=1
```
