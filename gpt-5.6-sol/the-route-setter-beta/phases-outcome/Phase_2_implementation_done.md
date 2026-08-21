# Fase 2 - Implementazione completata

## 1. File modificati

### Bootstrap e manifest backend

- `source/backend/src/TheRouteSetter.Api/Program.cs`
- `source/backend/src/TheRouteSetter.Api/Models/AssetModels.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Assets/IAssetCatalogService.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Assets/FileSystemAssetCatalogService.cs`

### Convex Hull backend

- `source/backend/src/TheRouteSetter.Api/Services/ConvexHull/ColliderModels.cs`
- `source/backend/src/TheRouteSetter.Api/Services/ConvexHull/ColliderContracts.cs`
- `source/backend/src/TheRouteSetter.Api/Services/ConvexHull/ColliderJobStore.cs`
- `source/backend/src/TheRouteSetter.Api/Services/ConvexHull/SharpGltfVertexReader.cs`
- `source/backend/src/TheRouteSetter.Api/Services/ConvexHull/MiConvexHullBuilder.cs`
- `source/backend/src/TheRouteSetter.Api/Services/ConvexHull/FileSystemColliderProcessor.cs`
- `source/backend/src/TheRouteSetter.Api/Services/ConvexHull/ColliderGenerationWorker.cs`

### Test backend

- `source/backend/tests/TheRouteSetter.Api.Tests/AssetCatalogServiceTests.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/Support/AssetTestData.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/ColliderProcessorTests.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/ConvexHullGeometryTests.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/ColliderGenerationWorkerTests.cs`

### Asset statici generati

- `holds/Hold1/collider.json`
- `holds/Hold2/collider.json`

### Esito fase

- `phases-outcome/Phase_2_implementation_done.md`

## 2. Requisiti coperti

- `REQ-HUL-001`: l'inviluppo convesso viene calcolato esclusivamente nel backend tramite `MIConvexHull@1.1.19.504`; nessuna dipendenza Rapier e presente nel backend.
- `REQ-HUL-002`: le posizioni mesh vengono lette dai GLB tramite `SharpGLTF.Core@1.0.0`, applicando le matrici mondo dei nodi e scartando valori non finiti.
- `REQ-HUL-003`: ogni `collider.json` contiene `sourceHash`, array piatto `vertices` XYZ e array triangolare `indices`, validati prima della persistenza.
- `REQ-HUL-004`: l'invalidazione usa esclusivamente SHA-256 del contenuto GLB; hash uguale riusa il file senza riscriverlo, hash diverso o JSON non valido provoca rigenerazione.
- `REQ-HUL-005`: un `BackgroundService` accoda il backlog con stato `Pending`, cede subito il controllo all'host e genera i collider in sequenza senza bloccare HTTP.
- `REQ-HUL-006`: il manifest espone `colliderUrl` soltanto nello stato `Ready`; il frontend dovra consumare il documento pre-calcolato senza generare hull lato client.
- `REQ-HUL-007`: i test xUnit behavior-driven coprono generazione, riuso, invalidazione, schema e avvio non bloccante; un loro fallimento rende non verde `dotnet test`.
- `REQ-TST-003`: coperti esplicitamente i casi mancante -> generato, coerente -> riuso, GLB modificato -> rigenerazione.

Il manifest della fase 1 e stato esteso con gli stati `Missing`, `Pending`, `Ready` e `Failed`. Un collider presente ma non ancora verificato viene mantenuto non disponibile fino alla conclusione del confronto hash.

## 3. Test eseguiti e storico risultati

1. Primo build dopo la struttura iniziale: fallito con 4 errori. Cause: refuso `IGlbVertexReader` al posto di `IGltfVertexReader`, ambiguita tra namespace applicativo e `MIConvexHull.ConvexHull`, e `project.assets.json` assente dopo la pulizia della fase precedente.
2. Correzione dei due errori nominali e restore locked-mode: restore superato; build fallita con 1 errore per il nuovo parametro `IColliderJobStore` non ancora passato da `AssetCatalogServiceTests`.
3. Adeguamento test discovery e build: superata con 0 warning e 0 errori.
4. Prima esecuzione completa con i test della fase 2: build superata; 18 test backend superati su 18.
5. Prima prova manuale sugli asset reali: i collider sono stati generati correttamente, ma lo script PowerShell di verifica ha restituito HTTP 404 perche aveva concatenato i due URL del manifest in una singola richiesta. Il problema era nello script, non nell'API.
6. Ispezione file reali: presenti `holds/Hold1/collider.json` e `holds/Hold2/collider.json`, entrambi con `sourceHash`, `vertices` e `indices`.
7. Seconda prova manuale corretta: entrambe le hold in stato `Ready`; endpoint collider HTTP 200; Hold1 con 4560 valori vertice e 9108 indici; Hold2 con 4137 valori vertice e 8262 indici. Il secondo avvio non ha modificato i timestamp dei file, confermando il riuso.
8. Aggiunta integrazione HTTP con processore deliberatamente sospeso: verifica che health e manifest rispondano mentre tutte le hold sono `Pending`.
9. Restore finale `dotnet restore --locked-mode`: superato, lockfile invariati.
10. Build backend finale: superata con 0 warning e 0 errori.
11. Suite backend finale: 19 test superati, 0 falliti, 0 ignorati.
12. Restore frontend deterministico `npm ci --ignore-scripts`: superato; npm segnala le 5 vulnerabilita gia note nella baseline vincolata.
13. Build frontend di regressione: superata con Vite `5.2.0`.
14. Vitest frontend di regressione: 1 test superato su 1.
15. Verifica indipendente degli asset reali con `Get-FileHash`: hash corrispondente per Hold1 e Hold2; cardinalita `vertices` e `indices` valida per entrambi.

I test automatici della fase 2 verificano inoltre:

- eliminazione di un punto interno e produzione delle quattro facce di un tetraedro tramite MIConvexHull;
- parsing SharpGLTF sul modello reale `holds/Hold1/hold1.glb`;
- sostituzione di un collider JSON malformato;
- mancata invocazione dei componenti geometrici in caso di hash coerente;
- schema con vertici finiti, cardinalita multipla di 3 e indici compresi nell'intervallo;
- disponibilita HTTP dell'applicazione durante un backlog collider sospeso;
- aggiornamento progressivo dello stato del manifest.

## 4. Limiti e blocchi

Nessun blocco residuo per la fase 2.

- La generazione dei collider puo richiedere tempo su cataloghi estesi, ma viene eseguita in background e non blocca l'avvio HTTP.
- Il worker elabora il catalogo statico all'avvio, coerentemente con le specifiche. Nuove cartelle aggiunte mentre il processo e gia in esecuzione saranno elaborate al successivo riavvio.
- Una hold con GLB non valido o geometria degenere passa allo stato `Failed`; le politiche centralizzate di errore e logging strutturato saranno completate esclusivamente nella fase 3.
- I collider reali sono scritti nelle cartelle statiche esterne a `source`, come previsto da `app_definition.md` e dalla procedura di fase.
- La geometria viene trasformata con le matrici mondo dei nodi GLB. I valori dei modelli reali risultano numericamente molto grandi rispetto al vincolo metrico; la correttezza della scala dei file sorgente resta responsabilita degli asset forniti e non viene alterata dal backend.
- `npm audit` continua a segnalare 5 vulnerabilita nelle versioni transitive della baseline vincolata; non sono state aggiornate dipendenze fuori da `OPEN-003`.

## 5. Verifica manuale

### Build e suite automatica

Da `source`:

```powershell
$dotnet = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:ContinuousIntegrationBuild = "true"
& $dotnet restore "TheRouteSetter.sln" --locked-mode
& $dotnet build "TheRouteSetter.sln" --no-restore
& $dotnet test "TheRouteSetter.sln" --no-build --no-restore
```

Risultato atteso: build con 0 warning e 0 errori; 19 test backend superati.

### Generazione reale dei collider

Per verificare la generazione da zero, rimuovere manualmente i collider delle hold di test e avviare il backend:

```powershell
Remove-Item -LiteralPath "holds\Hold1\collider.json" -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "holds\Hold2\collider.json" -ErrorAction SilentlyContinue

& "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe" run `
  --project "source\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj"
```

In un secondo terminale interrogare progressivamente il manifest:

```powershell
Invoke-RestMethod "http://localhost:5080/api/holds" | ConvertTo-Json -Depth 5
```

Risultato atteso: gli stati passano da `Pending` a `Ready`; `colliderUrl` compare soltanto a elaborazione conclusa.

Scaricare i collider:

```powershell
Invoke-RestMethod "http://localhost:5080/api/holds/Hold1/collider" | ConvertTo-Json -Depth 5
Invoke-RestMethod "http://localhost:5080/api/holds/Hold2/collider" | ConvertTo-Json -Depth 5
```

### Verifica invalidazione hash

Su una copia di una cartella hold, conservare `collider.json`, modificare il GLB e riavviare il backend. Il `sourceHash` deve cambiare e il file collider deve essere riscritto. Senza modificare il GLB, un riavvio successivo deve mantenere invariato il timestamp di `collider.json`.

Verifica hash degli asset reali:

```powershell
$collider = Get-Content "holds\Hold1\collider.json" -Raw | ConvertFrom-Json
$hash = "sha256:$((Get-FileHash "holds\Hold1\hold1.glb" -Algorithm SHA256).Hash.ToLowerInvariant())"
$collider.sourceHash -eq $hash
```

Risultato atteso: `True`.
