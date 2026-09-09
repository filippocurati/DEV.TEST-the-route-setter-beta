# Contratti Backend

Stato al `2026-09-09`, verificato sui sorgenti CON01, CON03 e CON05. Questa guida italiana sostituisce il resoconto provvisorio `source/backend/CON01-CON03-CON05.md`, non un report storico di fase. Chiusura di TheRouteSetter v0.0.1, perimetro supportato e punti di attenzione in [06-stato-versione-v0.0.1.md](../sdd-specs/06-stato-versione-v0.0.1.md).

## Readiness

`GET /api/holds/status` restituisce HTTP 200, `Cache-Control: no-store` e un array contenente soltanto:

```json
[
  { "id": "Hold1", "colliderStatus": "Pending", "colliderUrl": null },
  { "id": "Hold2", "colliderStatus": "Ready", "colliderUrl": "/api/holds/Hold2/collider" }
]
```

- Stati: `Missing`, `Pending`, `Ready`, `Failed`; URL valorizzato solo per `Ready`.
- La discovery legge nomi dei file e stato del job store, non il contenuto GLB. Metadati, preview, hash e geometria non sono inclusi nella risposta di stato.
- Dopo il completamento della discovery iniziale, un ID mai accodato e `Failed`, anche se la directory torna leggibile o contiene un collider non verificato. Prima restano i fallback `Missing`/`Ready`; gli stati espliciti noti non vengono sovrascritti.
- Suffissi numerici fuori range vengono scartati tramite `int.TryParse`; errori I/O/accesso di una directory sono isolati e correlati con ErrorId. Un job fallito non blocca il successivo.
- Non e un hot reload del catalogo. Il frontend aggiorna solo le prese in attesa con polling seriale limitato, non per frame.

## Log Frontend

`POST /api/logs` accetta un singolo evento JSON:

```json
{
  "level": "Error",
  "category": "AssetLoad",
  "component": "Catalog",
  "message": "Impossibile caricare la presa.",
  "errorId": "12345678-1234-1234-1234-123456789abc",
  "requestId": "original-request:12",
  "context": { "operation": "load", "holdId": "Hold1" }
}
```

| Campo | Contratto |
|---|---|
| `level` | Obbligatorio: `Trace`, `Debug`, `Information`, `Warning`, `Error`, `Critical`; `None` e valori non definiti rifiutati. |
| `category`, `component` | Obbligatori, da 1 a 80 caratteri. |
| `message` | Obbligatorio, da 1 a 2000 caratteri. |
| `errorId` | Opzionale, massimo 36 caratteri; se presente deve essere un GUID valido, preservato nella forma fornita (formati N/D coperti dai test). |
| `requestId` | Opzionale, da 1 a 128 caratteri ASCII: lettere, cifre, `.`, `_`, `:`, `-`. |
| `context` | Opzionale, dizionario stringa/stringa, massimo 20 voci, chiavi fino a 80 e valori fino a 500 caratteri; JSON nidificato rifiutato. |
| Body | Massimo 32768 byte, controllo preventivo `Content-Length` e limite MVC/Kestrel. |

La ricevuta HTTP 202 contiene esattamente `{ "errorId": string|null, "requestId": string }`. Per Error/Critical preserva l'ErrorId fornito o ne genera uno; per gli altri livelli restituisce null. Il RequestId nel body e quello originale fornito oppure quello della richiesta di ingestione. `X-Request-Id` identifica sempre la richiesta HTTP di ingestione; i log conservano anche `IngestionRequestId`.

HTTP 202 e accettazione best effort, non conferma di persistenza: filtro di livello e saturazione della coda possono scartare eventi. Il consumer esegue I/O e retention fuori dal produttore; a saturazione scarta gli eventi in arrivo senza attesa I/O, allo shutdown drena quelli accettati.

## Errori HTTP

Eccezioni propagate, binding/validazione MVC, risultati di errore, risorse/route mancanti, metodi/media type non supportati e richieste troppo grandi condividono nella pipeline applicativa:

```json
{
  "errorId": "guid-generato-formato-N",
  "requestId": "identificativo-richiesta",
  "message": "Messaggio sicuro per l'utente"
}
```

Lo status HTTP resta appropriato al caso; lo stesso ErrorId e registrato nei log. Nessun dettaglio di validazione framework, stack o percorso interno viene esposto. HTTP 206 conserva il contenuto parziale; HTTP 416 restituisce ErrorResponse e conserva `Content-Range: bytes */<lunghezza>`. La normalizzazione del 416 avviene dopo il file result, prima dell'inizio della risposta.

Una risposta gia iniziata non e riscrivibile: l'errore viene registrato e la connessione interrotta. La cancellazione del client non diventa un errore interno. Rifiuti di proxy/trasporto precedenti alla pipeline non sono coperti dal contratto JSON. OpenAPI descrive readiness, ricevute log, errori e collider con `sourceHash`, `vertices` e `indices` obbligatori (DEC-028); indici mancanti, nulli, vuoti o fuori range non sono accettati, neppure con hash corrispondente. Nessuna generazione hull nel browser.

## Livelli E Privacy

La configurazione .NET `Trace..None` e mappata in Serilog, con override arbitrari per categoria a prefisso piu lungo; l'output usa `Trace`/`Critical`, non `Verbose`/`Fatal`. Il middleware di completamento HTTP riceve il logger Serilog dell'host via DI, senza dipendere dal logger statico.

La sanitizzazione strutturata e ricorsiva e precede il rendering del messaggio: chiavi prefissate/nidificate, Basic/Bearer, password quotate con spazi, interpolazioni e pattern personali sono coperti da regressioni sintetiche. Il contesto browser ammette soltanto le chiavi diagnostiche `operation`, `assetId`, `holdId`, `status`, `statusCode`, `errorType`, `retryCount`, `phase`, `resource`, `errorClass`, `event`; altri valori vengono oscurati. Anche campi ammessi e testo libero sono limitati e sanitizzati, ma dati personali arbitrari non etichettati non sono riconoscibili con garanzia assoluta. I chiamanti devono inviare riepiloghi, non payload grezzi.

La retention usa l'eta effettiva `LastWriteTimeUtc`, default 7 giorni, e il pattern rolling di `Logging.FilePath`, non il conteggio dei file. Il consumer controlla all'avvio e alla prima iterazione dopo il cambio data UTC, incluso timer idle di un minuto. File estranei non vengono rimossi; errori I/O/accesso del cleanup sono best effort e segnalati a Serilog SelfLog.

## Verifica E Limiti

Le factory API derivano da `Support/IsolatedApiFactory`: root temporanea imposta prima di costruire i worker, asset sintetici e test esplicito di isolamento. Dalla radice applicativa:

```powershell
dotnet build source/backend/tests/TheRouteSetter.Api.Tests/TheRouteSetter.Api.Tests.csproj --configuration Release --no-restore
dotnet test source/backend/tests/TheRouteSetter.Api.Tests/TheRouteSetter.Api.Tests.csproj --configuration Release --no-build --no-restore
```

Esito definitivo nelle [verifiche persistite](../phases-outcome/Consolidation_verification_results.json): `110/110` test backend Release, zero fail/skip/retry e build Release con zero warning/errori; hash SHA-256 del TRX registrato nel JSON. Copertura: contratti HTTP, worker reale Pending -> Ready, GLB bloccato, guasti directory iniettati, log/correlazione persistiti, livelli, saturazione/drain, pattern retention e mezzanotte simulata.

Le prove in-memory non certificano soak reale multi-giorno, ACL reali, errori del reverse proxy o enforcement chunked del limite body su Kestrel. Le suite browser sono evidenze separate; CI remota non eseguita, senza introdurla come nuovo obbligo o blocco. Dettagli in [test automatici](test-automatici.md).
