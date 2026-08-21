# Phase 1 - esito implementazione (DONE)

## 1) Elenco file modificati

- `source/backend/src/TheRouteSetter.Application/Assets/AssetCatalogSnapshot.cs`
- `source/backend/src/TheRouteSetter.Application/Assets/AssetDiscoveryOptions.cs`
- `source/backend/src/TheRouteSetter.Application/Assets/IAssetDiscoveryService.cs`
- `source/backend/src/TheRouteSetter.Application/Assets/AssetDiscoveryService.cs`
- `source/backend/src/TheRouteSetter.Api/Configuration/ApiDataOptions.cs`
- `source/backend/src/TheRouteSetter.Api/Configuration/ApiDataPathResolver.cs`
- `source/backend/src/TheRouteSetter.Api/Contracts/HoldManifestDto.cs`
- `source/backend/src/TheRouteSetter.Api/Contracts/WallResponseDto.cs`
- `source/backend/src/TheRouteSetter.Api/Contracts/AssetFileUrlDto.cs`
- `source/backend/src/TheRouteSetter.Api/Contracts/FrontendLogRequestDto.cs`
- `source/backend/src/TheRouteSetter.Api/Contracts/FrontendLogResponseDto.cs`
- `source/backend/src/TheRouteSetter.Api/Services/AssetManifestService.cs`
- `source/backend/src/TheRouteSetter.Api/Controllers/WallController.cs`
- `source/backend/src/TheRouteSetter.Api/Controllers/HoldsController.cs`
- `source/backend/src/TheRouteSetter.Api/Controllers/LogsController.cs`
- `source/backend/src/TheRouteSetter.Api/Program.cs`
- `source/backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj`
- `source/backend/src/TheRouteSetter.Api/appsettings.json`
- `source/backend/src/TheRouteSetter.Api/packages.lock.json`
- `source/backend/src/TheRouteSetter.Api/Controllers/WeatherForecastController.cs` (rimosso)
- `source/backend/src/TheRouteSetter.Api/WeatherForecast.cs` (rimosso)
- `source/backend/tests/TheRouteSetter.Api.Tests/AssetDiscoveryServiceTests.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/UnitTest1.cs` (rimosso)
- `source/backend/tests/TheRouteSetter.Api.Tests/packages.lock.json`
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/ApiFactory.cs`
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/BaselineEndpointsTests.cs`
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/Usings.cs`
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/UnitTest1.cs` (rimosso)
- `source/backend/tests/TheRouteSetter.Api.IntegrationTests/packages.lock.json`

## 2) Requisiti REQ-* coperti

- `REQ-MOD-001`: discovery solo cartelle `holds/Hold<number>`.
- `REQ-MOD-002`: hold senza texture/asset opzionali resta caricabile.
- `REQ-MOD-003`: supporto preview `PREV_` nel manifest senza blocco globale.
- `REQ-MOD-004`: file statici serviti da `/data/**` con URL risolvibili.
- `REQ-CAT-003`: endpoint catalogo leggero (`GET /api/holds`) senza download massivo GLB.
- `REQ-CAT-004`: endpoint dedicati model/collider (`GET /api/holds/{id}/model`, `GET /api/holds/{id}/collider`).
- `REQ-SCN-004`: endpoint parete (`GET /api/wall`) pronto per autoload frontend.
- `REQ-ARC-002`: separazione Controller/Service e OpenAPI/Swagger per endpoint baseline.
- `REQ-LOG-002` (baseline fase 1): endpoint `POST /api/logs` con accettazione evento frontend.

## 3) Test eseguiti per la fase e risultati

Storico completo:

1. `dotnet restore source/backend/TheRouteSetterBeta.sln --use-lock-file` (dotnet 8 locale)
   - Esito: OK.

2. `dotnet build source/backend/TheRouteSetterBeta.sln -c Release`
   - Esito: FALLITO (errore `CS8820` in `AssetDiscoveryService`, lambda `static` su `holdId`).

3. `dotnet build source/backend/TheRouteSetterBeta.sln -c Release` (dopo fix)
   - Esito: FALLITO (errore `CS0246`, mancava `PhysicalFileProvider`).

4. `dotnet build source/backend/TheRouteSetterBeta.sln -c Release` (dopo fix)
   - Esito: FALLITO (errore `CS0246`, mancava `IWebHostBuilder` nei test integrazione).

5. `dotnet build source/backend/TheRouteSetterBeta.sln -c Release` (dopo fix)
   - Esito: OK.

6. `dotnet test source/backend/TheRouteSetterBeta.sln -c Release`
   - Esito: OK.

7. `dotnet test source/backend/TheRouteSetterBeta.sln -c Release` (dopo aggiornamento test static file)
   - Esito: FALLITO (`BaselineEndpointsTests.ReturnsManifestAndUrlsForConfiguredAssets`, atteso 200 su `/data/...glb`, ricevuto 404).

8. `dotnet test source/backend/TheRouteSetterBeta.sln -c Release` (dopo fix content-type `.glb` static files)
   - Esito: OK.
   - Risultati finali: `TheRouteSetter.Api.Tests` 2/2 pass, `TheRouteSetter.Api.IntegrationTests` 3/3 pass, `TheRouteSetter.Hull.Tests` 1/1 pass.

## 4) Eventuali limiti/blocchi riscontrati in fase di implementazione

- Nessun blocco residuo nella fase 1.
- Nota tecnica: per servire file `.glb` statici e stato necessario mappare esplicitamente il content type `model/gltf-binary`.

## 5) Passi manuali per verificare personalmente la fase (comandi inclusi)

Usare il runtime locale gia adottato in fase 0:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" restore "source\backend\TheRouteSetterBeta.sln" --locked-mode
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" build "source\backend\TheRouteSetterBeta.sln" -c Release
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" test "source\backend\TheRouteSetterBeta.sln" -c Release
```

Avvio API:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\toolchain\dotnet-8.0.424\dotnet.exe" run --project "source\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj" --urls "http://127.0.0.1:5099"
```

Verifiche manuali endpoint baseline:

```powershell
Invoke-WebRequest "http://127.0.0.1:5099/api/wall"
Invoke-WebRequest "http://127.0.0.1:5099/api/holds"
Invoke-WebRequest "http://127.0.0.1:5099/api/holds/Hold1/model"
Invoke-WebRequest "http://127.0.0.1:5099/api/holds/Hold1/collider"
Invoke-RestMethod "http://127.0.0.1:5099/api/logs" -Method Post -ContentType "application/json" -Body '{"level":"Info","category":"manual","message":"test","context":{}}'
```
