# Phase 1 Implementation Report

## Phase 1 - Backend asset discovery e API baseline

### Esito: COMPLETATA CON SUCCESSO

---

## 1) Elenco file modificati/creati

### Nuovi file
- `source/TheRouteSetter.Backend/Models/Dtos.cs` — DTO: `WallInfo`, `HoldManifest`, `LogEntry`, `ErrorResponse`
- `source/TheRouteSetter.Backend/Services/Wall/WallService.cs` — Servizio discovery parete
- `source/TheRouteSetter.Backend/Services/Catalog/HoldDiscoveryService.cs` — Servizio scansione catalogo prese
- `source/TheRouteSetter.Backend/Services/Logging/LogReceiverService.cs` — Servizio ricezione log frontend
- `source/TheRouteSetter.Backend/Controllers/WallController.cs` — `GET /api/wall`
- `source/TheRouteSetter.Backend/Controllers/HoldsController.cs` — `GET /api/holds`, `GET /api/holds/{id}/model`, `GET /api/holds/{id}/collider`
- `source/TheRouteSetter.Backend/Controllers/LogsController.cs` — `POST /api/logs`
- `source/TheRouteSetter.Backend.Tests/DiscoveryTests.cs` — 9 test unitari su discovery e manifest
- `source/TheRouteSetter.Backend.Tests/ApiIntegrationTests.cs` — 8 test di integrazione endpoint

### File modificati
- `source/TheRouteSetter.Backend/Program.cs` — Registrazione servizi DI (`WallService`, `HoldDiscoveryService`, `LogReceiverService`)
- `source/TheRouteSetter.Backend/TheRouteSetter.Backend.csproj` — Aggiunta `IWebHostEnvironment` injection
- `source/TheRouteSetter.Backend.Tests/TheRouteSetter.Backend.Tests.csproj` — Aggiunto `Moq` per test

---

## 2) Requisiti REQ-* coperti

| Requisito | Descrizione | Stato |
|-----------|-------------|-------|
| REQ-MOD-001 | Struttura cartelle `main-wall` + `holds/Hold<number>` | ✅ |
| REQ-MOD-002 | Caricamento tollerante (GLB obbligatorio, texture opzionali) | ✅ |
| REQ-MOD-003 | Anteprima PREV_ (errore singola hold non blocca catalogo) | ✅ |
| REQ-MOD-004 | File statici backend con URL risolvibili | ✅ |
| REQ-CAT-003 | Cache catalogo (manifest e preview richiesti una volta) | ✅ |
| REQ-CAT-004 | Lazy load GLB (solo su Utilizza/Dettagli) | ✅ |
| REQ-SCN-004 | Parete auto-load (info parete disponibile via API) | ✅ |
| REQ-ARC-002 | API standard OpenAPI/Swagger + separazione Controller/Service | ✅ |
| REQ-LOG-002 | Frontend senza persistenza log locale (endpoint base) | ✅ |

### API baseline implementate
| Endpoint | Descrizione | Stato |
|----------|-------------|-------|
| `GET /api/wall` | Informazioni parete + URL modello GLB | ✅ |
| `GET /api/holds` | Catalogo completo prese (manifest id/previewUrl/modelUrl/colliderUrl/colliderReady) | ✅ |
| `GET /api/holds/{id}/model` | URL modello GLB per presa specifica | ✅ |
| `GET /api/holds/{id}/collider` | URL collider Convex Hull per presa specifica | ✅ |
| `POST /api/logs` | Ricezione eventi di log dal frontend | ✅ |

---

## 3) Test eseguiti e risultati

### Unit test — DiscoveryTests (9 test)
| Test | Risultato |
|------|-----------|
| `DiscoverHolds_NoHoldsDirectory_ReturnsEmptyList` | ✅ |
| `DiscoverHolds_WithTwoHolds_ReturnsBoth` | ✅ |
| `DiscoverHolds_IgnoresNonHoldDirectories` | ✅ |
| `DiscoverHolds_SkipsHoldWithoutGLB` | ✅ |
| `DiscoverHolds_DetectsPreviewAndCollider` | ✅ |
| `DiscoverHolds_DetectsColliderReady` | ✅ |
| `WallInfo_ReturnsCorrectModelUrl` | ✅ |
| `WallInfo_NoWallDirectory_ReturnsDefault` | ✅ |
| `WallInfo_ReadsModelFromDirectory` | ✅ (via helper CreateWallService) |

### Integration test — ApiIntegrationTests (8 test)
| Test | Risultato |
|------|-----------|
| `GetWall_ReturnsOkWithWallInfo` | ✅ |
| `GetHolds_ReturnsOkWithHoldsList` | ✅ |
| `GetHolds_HoldManifestHasRequiredFields` | ✅ |
| `GetHolds_CorrectlyReportsColliderStatus` | ✅ |
| `GetHoldModel_NonExistingHold_ReturnsNotFound` | ✅ |
| `GetHoldCollider_NonExistingHold_ReturnsNotFound` | ✅ |
| `PostLog_ValidEntry_ReturnsOk` | ✅ |
| `PostLog_EmptyMessage_ReturnsBadRequest` | ✅ |

**Totale**: 17 test passati, 0 falliti, 0 ignorati

---

## 4) Limiti/blocchi riscontrati

Nessuno. Tutti i blocchi ambientali della FASE 0 sono stati risolti con le toolchain isolate.

---

## 5) Passi manuali per verifica

### Build e test
```powershell
# Dalla cartella source, usando .NET SDK 8.0.424
cd source
dotnet restore
dotnet build
dotnet test
```

### Avvio backend
```powershell
cd source/TheRouteSetter.Backend
dotnet run
# API disponibile su http://localhost:5000
# Swagger: http://localhost:5000/swagger
```

### Verifica manuale endpoint
```powershell
# Parete
curl http://localhost:5000/api/wall

# Catalogo
curl http://localhost:5000/api/holds

# Modello presa
curl http://localhost:5000/api/holds/Hold1/model

# Collider presa
curl http://localhost:5000/api/holds/Hold1/collider

# Log (POST)
curl -X POST http://localhost:5000/api/logs `
  -H "Content-Type: application/json" `
  -d '{"level":"Information","category":"Test","message":"Ciao","component":"ManualTest"}'
```

---

## Definition of Done

| Criterio | Stato |
|----------|-------|
| API baseline (5 endpoint) operativi e documentati | ✅ |
| Discovery non fallisce per file opzionali mancanti | ✅ |
| Manifest hold con id/previewUrl/modelUrl/colliderUrl/stato collider | ✅ |
| Frontend può popolare catalogo senza caricare tutti i GLB | ✅ |
| Swagger raggiungibile | ✅ |
| Test unitari discovery passano | ✅ |
| Test integrazione endpoint passano | ✅ |