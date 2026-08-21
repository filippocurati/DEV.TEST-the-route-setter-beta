# Phase 2 - esito implementazione (DONE)

## 1) Elenco file modificati

- `source/backend/src/TheRouteSetter.Application/ConvexHull/ColliderDocument.cs`
- `source/backend/src/TheRouteSetter.Application/ConvexHull/IColliderGenerationService.cs`
- `source/backend/src/TheRouteSetter.Application/ConvexHull/ColliderGenerationResult.cs`
- `source/backend/src/TheRouteSetter.Application/ConvexHull/ColliderGenerationService.cs`
- `source/backend/src/TheRouteSetter.Application/Assets/AssetCatalogSnapshot.cs`
- `source/backend/src/TheRouteSetter.Application/Assets/AssetDiscoveryService.cs`
- `source/backend/src/TheRouteSetter.Api/Services/ColliderGenerationBackgroundService.cs`
- `source/backend/src/TheRouteSetter.Api/Program.cs`
- `source/backend/src/TheRouteSetter.Application/Class1.cs` (rimosso)
- `source/backend/tests/TheRouteSetter.Hull.Tests/ColliderGenerationServiceTests.cs`
- `source/backend/tests/TheRouteSetter.Hull.Tests/UnitTest1.cs` (rimosso)
- `source/backend/tests/TheRouteSetter.Api.Tests/AssetDiscoveryServiceTests.cs`
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/BaselineEndpointsTests.cs`
- `source/backend/src/TheRouteSetter.Application/packages.lock.json`
- `source/backend/src/TheRouteSetter.Api/packages.lock.json`
- `source/backend/tests/TheRouteSetter.Api.Tests/packages.lock.json`
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/packages.lock.json`
- `source/backend/tests/TheRouteSetter.Hull.Tests/packages.lock.json`

## 2) Requisiti REQ-* coperti

- `REQ-HUL-001`: calcolo hull backend con MIConvexHull.
- `REQ-HUL-002`: parsing vertici GLB backend con SharpGLTF.
- `REQ-HUL-003`: `collider.json` conforme con `sourceHash`, `vertices`, `indices` opzionale.
- `REQ-HUL-004`: invalidazione su hash (`sha256:*`) e rigenerazione solo se necessario.
- `REQ-HUL-005`: generazione collider asincrona non bloccante tramite background worker.
- `REQ-HUL-006`: frontend consuma collider pre-calcolato (manifest espone solo collider coerente).
- `REQ-HUL-007`: suite test hull behavior-driven presente e fallimento build/test in caso regressione.
- `REQ-TST-003`: coperti i casi obbligatori mancante->generato, coerente->riuso, GLB modificato->rigenerato.

## 3) Test eseguiti per la fase e risultati

Storico esecuzioni:

1. `dotnet build source/backend/TheRouteSetterBeta.sln -c Release`
   - FALLITO: errori compile in `ColliderGenerationService` (uso API MIConvexHull/SharpGLTF non corretto).

2. `dotnet build source/backend/TheRouteSetterBeta.sln -c Release` (dopo fix)
   - FALLITO: API MIConvexHull restituisce `ConvexHullCreationResult`, adattato il codice.

3. `dotnet build source/backend/TheRouteSetterBeta.sln -c Release` (dopo fix)
   - FALLITO: test hull usavano namespace SharpGLTF non disponibili nel pacchetto Core.

4. `dotnet build source/backend/TheRouteSetterBeta.sln -c Release` (dopo fix test)
   - OK.

5. `dotnet test source/backend/TheRouteSetterBeta.sln -c Release`
   - OK.
   - `TheRouteSetter.Hull.Tests`: 3/3 passed.
   - `TheRouteSetter.Api.Tests`: 3/3 passed.
   - `TheRouteSetter.Api.IntegrationTests`: 3/3 passed.

## 4) Eventuali limiti/blocchi riscontrati in fase di implementazione

- Nessun blocco residuo.
- Nota tecnica: i test hull usano fixture GLB reali (`holds/Hold1/hold1.glb`, `holds/Hold2/hold2.glb`) per restare compatibili con `SharpGLTF.Core` senza dipendenze extra per authoring scene.

## 5) Passi manuali per verificare personalmente la fase (comandi inclusi)

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" restore "source\backend\TheRouteSetterBeta.sln" --locked-mode
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" build "source\backend\TheRouteSetterBeta.sln" -c Release
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" test "source\backend\TheRouteSetterBeta.sln" -c Release
```

Per verificare la generazione asincrona collider:

1. eliminare un `collider.json` in una cartella `holds/Hold<number>`;
2. avviare API;
3. attendere pochi secondi e verificare che il file sia rigenerato.

Comando avvio API:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" run --project "source\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj" --urls "http://127.0.0.1:5099"
```
