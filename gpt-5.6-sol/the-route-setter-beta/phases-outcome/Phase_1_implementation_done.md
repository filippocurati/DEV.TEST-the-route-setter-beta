# Fase 1 - Implementazione completata

## 1. File modificati

### Configurazione e bootstrap backend

- `source/backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj`
- `source/backend/src/TheRouteSetter.Api/Program.cs`
- `source/backend/src/TheRouteSetter.Api/appsettings.json`

### Modelli

- `source/backend/src/TheRouteSetter.Api/Models/AssetModels.cs`

### Servizi asset

- `source/backend/src/TheRouteSetter.Api/Services/Assets/AssetStorageOptions.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Assets/IAssetCatalogService.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Assets/FileSystemAssetCatalogService.cs`

### Endpoint API

- `source/backend/src/TheRouteSetter.Api/Controllers/WallController.cs`
- `source/backend/src/TheRouteSetter.Api/Controllers/HoldsController.cs`
- `source/backend/src/TheRouteSetter.Api/Controllers/LogsController.cs`

### Servizio base log frontend

- `source/backend/src/TheRouteSetter.Api/Services/Logging/IFrontendLogService.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Logging/FrontendLogService.cs`

### Test

- `source/backend/tests/TheRouteSetter.Api.Tests/Support/AssetTestData.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/AssetCatalogServiceTests.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/AssetApiIntegrationTests.cs`

### Esito fase

- `phases-outcome/Phase_1_implementation_done.md`

## 2. Requisiti coperti

- `REQ-MOD-001`: discovery limitata a `main-wall` e alle sottocartelle con naming esatto `holds/Hold<number>`; cartelle non conformi ignorate.
- `REQ-MOD-002`: il GLB e obbligatorio per includere una hold nel catalogo; texture e altri asset sono opzionali e non impediscono il caricamento.
- `REQ-MOD-003`: rilevazione delle anteprime con prefisso `PREV_`; una preview assente non blocca il catalogo o il modello.
- `REQ-MOD-004`: parete, modelli, preview, collider e asset opzionali sono serviti tramite URL HTTP risolvibili e accesso controllato.
- `REQ-CAT-003`: `GET /api/holds` espone un manifest leggero idoneo alla futura cache frontend di sessione.
- `REQ-CAT-004`: il manifest non contiene i byte o il nome fisico dei GLB; ogni modello viene scaricato separatamente tramite `modelUrl`.
- `REQ-SCN-004`: `GET /api/wall` espone il singolo modello parete necessario al futuro caricamento automatico della scena.
- `REQ-ARC-002`: controller separati dai servizi di discovery e logging; tutti gli endpoint sono documentati nel documento OpenAPI/Swagger.
- `REQ-LOG-002`: predisposto il solo endpoint base `POST /api/logs`; nessuna persistenza log lato frontend e nessuna pipeline avanzata anticipata rispetto alla fase 3.

Sono operativi gli endpoint baseline vincolanti:

- `GET /api/wall`
- `GET /api/holds`
- `GET /api/holds/{id}/model`
- `GET /api/holds/{id}/collider`
- `POST /api/logs`

Sono stati aggiunti soltanto gli endpoint strettamente necessari agli asset dichiarati nel manifest:

- `GET /api/holds/{id}/preview`
- `GET /api/holds/{id}/assets/{fileName}`

Questa estensione rispetta `OPEN-002`: non introduce autenticazione o persistenza delle tracciature ed e documentata in OpenAPI e nei test di integrazione.

## 3. Test eseguiti e storico risultati

1. Restore NuGet deterministico `dotnet restore --locked-mode`: superato.
2. Primo build dopo l'implementazione: superato con 3 warning nullable in `FileSystemAssetCatalogService`; warning corretti prima dei test finali.
3. Secondo build: superato con 0 warning e 0 errori.
4. Prima esecuzione completa xUnit: 8 test superati e 3 falliti su 11. I fallimenti riguardavano esclusivamente la deserializzazione test dell'enum testuale `colliderStatus`; il JSON prodotto dall'API era corretto. Il contratto enum e stato reso auto-descrivente con `JsonStringEnumConverter`.
5. Seconda esecuzione build e xUnit: build superata con 0 warning e 0 errori; 11 test superati su 11.
6. Smoke test con backend avviato e asset reali esterni a `source`: superato. Rilevate `Hold1` e `Hold2`; parete, modello Hold1 e preview Hold1 hanno restituito HTTP 200; collider Hold1 ha restituito HTTP 404 come previsto, perche non ancora generato.
7. Terza esecuzione build e xUnit dopo il completamento della documentazione inline: 11 test superati su 11; rilevato un warning XML `CS1587` dovuto all'ordine tra commento e attributo `GeneratedRegex`.
8. Correzione warning XML e build finale: superata con 0 warning e 0 errori.
9. Esecuzione xUnit finale: 11 test superati, 0 falliti, 0 ignorati.

I test coprono:

- filtro del naming `Hold<number>`;
- esclusione delle cartelle senza GLB;
- ordinamento numerico deterministico delle hold;
- rilevazione preview, collider e asset opzionali;
- robustezza di una hold priva di texture, preview e collider;
- rifiuto di ID non validi e tentativi di path traversal;
- forma e leggerezza del manifest;
- coerenza e raggiungibilita degli URL restituiti;
- download della parete e dei modelli GLB con MIME corretto;
- risposta 404 per collider non disponibile;
- accettazione dell'evento base frontend tramite `POST /api/logs`;
- presenza degli endpoint baseline nel documento OpenAPI.

## 4. Limiti e blocchi

Nessun blocco residuo per la fase 1.

- Le cartelle asset rimangono esterne a `source`, come richiesto. La loro radice e configurabile tramite la sezione `AssetStorage` di `appsettings.json`.
- I collider non sono presenti negli asset reali; `colliderStatus` vale `Missing`, `colliderUrl` e nullo e la richiesta diretta restituisce HTTP 404. La generazione dei collider appartiene esclusivamente alla fase 2.
- L'endpoint `POST /api/logs` implementa soltanto il contratto base richiesto dalla fase. Logging JSON, sanitizzazione, asincronia, rotazione e retention appartengono alla fase 3.
- Non e stata implementata alcuna parte frontend del catalogo o del caricamento parete, prevista dalle fasi successive.
- Per i test e stata utilizzata l'installazione isolata .NET SDK `8.0.424` in `C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8`.

## 5. Verifica manuale

### Build e test

Da `source`:

```powershell
$dotnet = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:ContinuousIntegrationBuild = "true"
& $dotnet restore "TheRouteSetter.sln" --locked-mode
& $dotnet build "TheRouteSetter.sln" --no-restore
& $dotnet test "TheRouteSetter.sln" --no-build --no-restore
```

Risultato atteso: build con 0 warning e 0 errori; 11 test xUnit superati.

### Avvio backend

Da `source`:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe" run --project "backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj"
```

Aprire Swagger:

```text
http://localhost:5080/swagger
```

### Verifica API

Con il backend avviato:

```powershell
Invoke-RestMethod "http://localhost:5080/api/holds"
Invoke-WebRequest "http://localhost:5080/api/wall" -OutFile "$env:TEMP\wall.glb"
Invoke-WebRequest "http://localhost:5080/api/holds/Hold1/model" -OutFile "$env:TEMP\hold1.glb"
Invoke-WebRequest "http://localhost:5080/api/holds/Hold1/preview" -OutFile "$env:TEMP\hold1.png"
```

Il manifest deve contenere `Hold1` e `Hold2`, senza contenere i modelli GLB. Per entrambe le hold il collider deve risultare `Missing` fino all'esecuzione della fase 2.

Verifica endpoint log base:

```powershell
$body = @{
  level = "Warning"
  category = "AssetLoad"
  message = "Anteprima non disponibile"
  component = "Catalog"
} | ConvertTo-Json

Invoke-WebRequest `
  -Method Post `
  -Uri "http://localhost:5080/api/logs" `
  -ContentType "application/json" `
  -Body $body
```

Risultato atteso: HTTP 202 Accepted.
