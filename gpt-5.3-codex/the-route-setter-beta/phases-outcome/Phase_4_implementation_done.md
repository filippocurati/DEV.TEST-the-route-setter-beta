# Phase 4 - esito implementazione (DONE)

## 1) Elenco file modificati

- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`
- `source/frontend/src/api/wallApi.ts`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/src/physics/wallCollider.ts`
- `source/frontend/vite.config.ts`
- `source/frontend/playwright.config.ts`
- `source/frontend/tests/e2e/smoke.spec.ts`
- `source/frontend/package.json`
- `source/frontend/package-lock.json`

## 2) Requisiti REQ-* coperti

- `REQ-SCN-004`: caricamento automatico parete da `GET /api/wall` all'avvio.
- `REQ-UI-003`: navigazione scena con OrbitControls (orbit/zoom/pan) e target sulla parete.
- `REQ-FIS-001`: spazio e trasformazioni coerenti con sistema three.js (unità in metri).
- `REQ-FIS-013`: creazione collider TriMesh parete lato client tramite Rapier da vertici/triangoli mesh.

## 3) Test eseguiti per la fase e risultati

Storico esecuzioni:

1. `npm ci` (frontend)
   - Esito: OK.

2. `npm run build`
   - Esito: FALLITO (tipi mancanti `@types/node`, `@types/three` + strict null checks).

3. `npm install` (dopo aggiunta devDependencies tipizzazioni)
   - Esito: OK.

4. `npm run build`
   - Esito: OK (warning chunk size elevato non bloccante).

5. `node node_modules/@playwright/test/cli.js test tests/e2e/smoke.spec.ts`
   - Esito: FALLITO (timeout su testo stato iniziale OrbitControls).

6. `node node_modules/@playwright/test/cli.js test tests/e2e/smoke.spec.ts` (dopo aumento timeout attesa stato)
   - Esito: FALLITO (assert collider type atteso non corretto).

7. `node node_modules/@playwright/test/cli.js test tests/e2e/smoke.spec.ts` (dopo fix assert collider type)
   - Esito: OK (1 test passed).

## 4) Eventuali limiti/blocchi riscontrati in fase di implementazione

- Nessun blocco residuo.
- Nota: il bundle frontend risulta voluminoso in fase 4 a causa inclusione runtime 3D/fisica; ottimizzazioni demandate a fasi successive/performance.

## 5) Passi manuali per verificare personalmente la fase (comandi inclusi)

1. Avvio backend:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" run --project "source\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj" --urls "http://127.0.0.1:5099"
```

2. Avvio frontend:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node_modules\npm\bin\npm-cli.js" run dev --prefix "source/frontend" -- --host 127.0.0.1 --port 5173
```

3. Verifica manuale in browser:
- aprire `http://127.0.0.1:5173`;
- confermare parete visibile all'avvio;
- verificare orbit/zoom/pan con mouse;
- verificare attributi runtime su viewport (`data-physics=ready`, `data-collider-type=6`) come evidenza TriMesh client-side.

4. Verifica automatica E2E smoke:

```powershell
$env:E2E_BACKEND_CMD = '"C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" run --project "../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj" --urls http://127.0.0.1:5099'
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "source/frontend/node_modules/@playwright/test/cli.js" test "source/frontend/tests/e2e/smoke.spec.ts"
```
