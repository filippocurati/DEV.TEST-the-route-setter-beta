# Fase 3 - Implementazione completata

## 1. File modificati

### Bootstrap, configurazione e contratti

- `source/.gitignore`
- `source/backend/src/TheRouteSetter.Api/Program.cs`
- `source/backend/src/TheRouteSetter.Api/appsettings.json`
- `source/backend/src/TheRouteSetter.Api/Models/AssetModels.cs`

### Middleware backend

- `source/backend/src/TheRouteSetter.Api/Middleware/RequestCorrelationMiddleware.cs`
- `source/backend/src/TheRouteSetter.Api/Middleware/ExceptionHandlingMiddleware.cs`

### Logging server-side

- `source/backend/src/TheRouteSetter.Api/Services/Logging/IFrontendLogService.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Logging/FrontendLogService.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Logging/SensitiveDataSanitizer.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Logging/SafeJsonLogFormatter.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Logging/BoundedAsyncSink.cs`
- `source/backend/src/TheRouteSetter.Api/Services/Logging/ServerLoggingConfiguration.cs`
- `source/backend/src/TheRouteSetter.Api/Controllers/LogsController.cs`

### Test backend

- `source/backend/tests/TheRouteSetter.Api.Tests/TestAssembly.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/AssetApiIntegrationTests.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/Support/AssetTestData.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/ColliderGenerationWorkerTests.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/ErrorHandlingMiddlewareTests.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/ErrorApiIntegrationTests.cs`
- `source/backend/tests/TheRouteSetter.Api.Tests/LoggingTests.cs`

### Esito fase

- `phases-outcome/Phase_3_implementation_done.md`

## 2. Requisiti coperti

- `REQ-ERR-001`: gestione centralizzata delle eccezioni backend tramite middleware globale; predisposto endpoint server-side per gli errori frontend. La cattura centralizzata nel browser appartiene alle fasi frontend successive.
- `REQ-ERR-002`: ogni errore non gestito riceve un `ErrorId` univoco, un `RequestId`, uno status HTTP coerente e un messaggio utente non tecnico.
- `REQ-ERR-003`: il client non riceve stack trace, percorsi, tipo eccezione, configurazioni o messaggi tecnici interni.
- `REQ-LOG-001`: scrittura disaccoppiata tramite coda bounded asincrona; in saturazione vengono scartati eventi anziche bloccare il thread applicativo.
- `REQ-LOG-002`: `POST /api/logs` inoltra gli eventi al server; non e stata introdotta persistenza locale frontend.
- `REQ-LOG-003`: ogni riga log e JSON e contiene `timestamp`, `level`, `category`, `message`, `component`, oltre a `requestId`, `errorId`, eccezione e contesto quando disponibili.
- `REQ-LOG-004`: livello minimo configurabile tramite `Logging:LogLevel`; default `Information` in `appsettings.json`.
- `REQ-LOG-005`: file giornaliero `log-YYYYMMDD.json`, retention configurata a 7 file e pulizia esplicita dei file con data di modifica oltre sette giorni.
- `REQ-LOG-006`: sanitizzazione globale di password, token bearer, API key, secret e credenziali connection string in messaggi, eccezioni e proprieta strutturate.
- `REQ-LOG-007`: Serilog e provider unico del backend, con `Serilog.AspNetCore@8.0.1` e `Serilog.Sinks.File@5.0.0` gia vincolati dalla baseline.
- `REQ-TST-002`: aggiunti test xUnit unitari e di integrazione per middleware, contratto HTTP, formatter, soglia, coda, retention, sanitizzazione e endpoint frontend.

`POST /api/logs` accetta i livelli standard `.NET LogLevel` tranne `None`, limita categoria e componente a 80 caratteri, messaggio a 2000 caratteri e contesto a 20 proprieta. Gli eventi validi restituiscono HTTP 202.

## 3. Test eseguiti e storico risultati

1. Primo restore locked-mode e build dopo la pipeline iniziale: backend compilato; build soluzione fallita con 1 errore nel test della fase 1, che usava il precedente livello frontend come stringa anziche `LogLevel`.
2. Adeguamento test precedente e aggiunta test middleware/logging: build superata con 0 warning e 0 errori.
3. Prima suite fase 3: 25 test superati e 2 falliti su 27. Cause: il formatter non mascherava ancora il valore quando il nome proprieta era sensibile (`Password`); `POST /api/logs` restituiva errore per metadati DataAnnotations collocati sulle proprieta del record.
4. Correzione sanitizzazione per nomi proprieta sensibili. Test endpoint isolato ancora fallito e riproduzione su host reale eseguita.
5. Troubleshooting tramite log correlato: individuata `InvalidOperationException` ASP.NET Core che richiedeva DataAnnotations sui parametri del costruttore primario del record anziche `[property:]`.
6. Correzione DTO e isolamento log test nelle directory temporanee: suite superata, 27 test su 27.
7. Aggiunta test payload invalidi, header `X-Request-Id` e quattro formati sensibili: 32 test superati e 1 fallito su 33. Causa: lock transitorio Windows sul file Serilog durante il teardown di factory parallele.
8. Disabilitata parallelizzazione dell'assembly test e aggiunto retry di pulizia temporanea: suite superata, 33 test su 33.
9. Resa conservativa la mappatura errori: `InvalidOperationException` generica restituisce HTTP 500, mentre `ArgumentException` e `FileNotFoundException` restano 400 e 404.
10. Primo test integrazione errore reale: build fallita per namespace extension mancante nel progetto test; aggiunto `Microsoft.AspNetCore.Builder`.
11. Secondo test integrazione errore: il ramo terminale configurato dalla factory era esterno alla pipeline applicativa e l'eccezione raggiungeva il client test. Sostituito con controller presente esclusivamente nell'assembly test.
12. Terzo test integrazione errore: status e body corretti, ma `X-Request-Id` assente perche `Response.Clear()` eliminava l'header. Il middleware ora lo ripristina esplicitamente.
13. Suite successiva: 33 test su 33 superati.
14. Prova reale `POST /api/logs`: HTTP 202; un file giornaliero JSON creato; livello `Warning`, categoria `AssetLoad`, componente `Catalog`; `RequestId` del file uguale a `X-Request-Id`; password, bearer token e API key assenti; maschera `[REDACTED]` presente.
15. Restore finale `dotnet restore --locked-mode`: superato, lockfile invariati.
16. Build backend finale: superata con 0 warning e 0 errori.
17. Suite backend finale pre-estensione formatter: 33 test superati su 33.
18. Restore frontend `npm ci --ignore-scripts`: superato; restano le 5 segnalazioni npm audit gia note nella baseline.
19. Build frontend di regressione: superata.
20. Vitest frontend di regressione: 1 test superato su 1.
21. Esteso il test formatter a bearer token nel messaggio e API key nelle proprieta. Prima riesecuzione: 32/33 superati, unico fallimento nel teardown Windows del nuovo host errore per lock file transitorio.
22. Aggiunto retry di pulizia alla factory errore e rieseguita la suite: 33 test superati, 0 falliti, 0 ignorati.

I test della fase verificano inoltre:

- ErrorId nel formato esadecimale univoco e correlato allo scope log;
- RequestId identico tra body, header e log;
- status 400, 404 e 500 coerenti;
- assenza di stack trace, path e dettagli tecnici nella risposta HTTP;
- validazione di severita, lunghezza campi e numero proprieta contesto;
- formato JSON line-oriented valido;
- soglia `Information` che esclude `Debug`;
- coda bounded che non blocca il produttore anche con target lento;
- eliminazione dei file oltre sette giorni e conservazione dei recenti;
- sanitizzazione di password JSON, bearer token, API key, secret e connection string;
- sanitizzazione applicata anche a eccezioni e messaggi backend, non soltanto ai payload frontend.

## 4. Limiti e blocchi

Nessun blocco residuo per la fase 3.

- La gestione centralizzata degli errori nel browser, incluse le categorie JavaScript, REST, Three.js, Rapier ed export, non viene anticipata: sara implementata nelle fasi frontend previste dal piano. Il backend e l'endpoint di ricezione sono pronti.
- La coda asincrona e volutamente bounded e usa `DropWrite`: in caso di saturazione privilegia la continuita applicativa e puo scartare eventi non essenziali, come richiesto dalle specifiche.
- La retention e applicata dal sink file con limite di sette file e da una pulizia iniziale basata sulla data di modifica. Non viene eseguito un timer separato durante la giornata, per evitare I/O periodico non necessario.
- I log tecnici server-side possono contenere stack trace, necessari al troubleshooting, ma passano attraverso il formatter sanitizzante. Tali dettagli non vengono mai restituiti al client.
- I test ASP.NET Core che inizializzano Serilog sono serializzati per evitare contese sul logger statico e lock file transitori su Windows.
- `npm audit` continua a segnalare 5 vulnerabilita nelle dipendenze transitive della baseline frontend; non sono state modificate versioni fuori da `OPEN-003`.

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

Risultato atteso: build con 0 warning e 0 errori; 33 test backend superati.

### Avvio e logging reale

Da `source`:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe" run `
  --project "backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj"
```

In un secondo terminale:

```powershell
$body = @{
  level = "Warning"
  category = "AssetLoad"
  message = "password=secret Authorization: Bearer abc.def.ghi"
  component = "Catalog"
  context = @{
    api_key = "private-key"
    holdId = "Hold1"
  }
} | ConvertTo-Json -Depth 4

$response = Invoke-WebRequest `
  -Method Post `
  -Uri "http://localhost:5080/api/logs" `
  -ContentType "application/json" `
  -Body $body

$response.StatusCode
$response.Headers["X-Request-Id"]
```

Risultato atteso: HTTP 202 e header `X-Request-Id` valorizzato.

Il file viene scritto in:

```text
source/backend/src/TheRouteSetter.Api/Logs/log-YYYYMMDD.json
```

Verificare che ogni riga sia JSON valido e che non contenga `secret`, `abc.def.ghi` o `private-key`; deve invece contenere `[REDACTED]` e lo stesso RequestId restituito al client.

### Verifica soglia e retention

La configurazione e in `source/backend/src/TheRouteSetter.Api/appsettings.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    },
    "FilePath": "Logs/log-.json",
    "RetentionDays": 7,
    "QueueCapacity": 2048
  }
}
```

Modificare temporaneamente `Default` in `Warning`, riavviare il backend e verificare che gli eventi `Information` non vengano scritti. Ripristinare poi `Information`.
