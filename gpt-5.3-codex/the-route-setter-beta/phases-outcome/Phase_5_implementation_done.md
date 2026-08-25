# Phase 5 - esito implementazione (DONE)

## 1) Elenco file modificati

- `source/frontend/src/physics/wallCollider.ts`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/src/main.ts`
- `source/frontend/tests/e2e/physics-foundation.spec.ts`
- `source/frontend/tests/e2e/smoke.spec.ts`
- `source/frontend/package.json`

## 2) Requisiti REQ-* coperti

- `REQ-ARC-004`: uso Rapier confinato al client frontend (`@dimforge/rapier3d-compat` in browser).
- `REQ-ARC-008`: nessuna chiamata REST nel loop fisico continuo; caricamento REST confinato alla bootstrap iniziale.
- `REQ-FIS-002`: world con gravita zero e colliders con attrito/rimbalzo nulli; nessuna dinamica autonoma.
- `REQ-FIS-003`: attivazione CCD sul rigid body cinematico di test (`setCcdEnabled(true)`).
- `REQ-FIS-004`: integrazione `KinematicCharacterController` base con `computeColliderMovement` e `computedMovement` (move-and-slide).
- `REQ-FIS-012`: separazione mesh/collider mantenuta; la fisica usa collider Rapier e sincronizza solo transform verso mesh visuale.

## 3) Test eseguiti per la fase e risultati

1. `npm run build` (frontend)
   - Esito: OK.

2. `node node_modules/@playwright/test/cli.js test tests/e2e/smoke.spec.ts --workers=1`
   - Esito: OK.

3. `node node_modules/@playwright/test/cli.js test tests/e2e/physics-foundation.spec.ts --workers=1`
   - Esito: OK.

Note run:
- l'esecuzione parallela di due spec E2E nello stesso invio puo introdurre flakiness temporanea sui tempi di bootstrap; verifica finale effettuata in modo seriale (`--workers=1`) con esito verde.

## 4) Eventuali limiti/blocchi riscontrati in fase di implementazione

- Nessun blocco residuo sulla fondazione fisica.
- La visual mesh del controller cinematico e volutamente invisibile (opacita 0) e presente solo per tracciare la sincronizzazione collider->mesh a livello architetturale.

## 5) Passi manuali per verificare personalmente la fase (comandi inclusi)

1. Avvio backend:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" run --project "source\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj" --urls "http://127.0.0.1:5099"
```

2. Avvio frontend:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node_modules\npm\bin\npm-cli.js" run dev --prefix "source/frontend" -- --host 127.0.0.1 --port 5173
```

3. Verifica runtime in browser (`http://127.0.0.1:5173`):
- controllare attributi su `#scene-mount`: `data-physics=ready`, `data-gravity={"x":0,"y":0,"z":0}`, `data-kinematic-controller=ready`, `data-network-loop=none`.

4. Verifica automatica phase 5:

```powershell
$env:E2E_BACKEND_CMD = '"C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" run --project "../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj" --urls http://127.0.0.1:5099'
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\node-v22.18.0-win-x64\node.exe" "source/frontend/node_modules/@playwright/test/cli.js" test "source/frontend/tests/e2e/physics-foundation.spec.ts" --workers=1
```
