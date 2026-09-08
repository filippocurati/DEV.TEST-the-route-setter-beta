# Guida Applicativa E Tecnica

## Scopo

The Route Setter consente di comporre una tracciatura di arrampicata su una parete tridimensionale. Il browser visualizza la parete e il catalogo locale, crea le istanze delle prese, gestisce la fisica Rapier, il targeting, le trasformazioni e l'esportazione JPG. Il backend ASP.NET Core scopre e distribuisce gli asset, genera i collider Convex Hull mancanti e centralizza errori e log.

Non esistono account, autenticazione o persistenza delle tracciature. Lo stato della composizione vive esclusivamente nella sessione browser.

## Baseline E UX Attiva

Le fasi 0-9 costituiscono la baseline storica. Alcuni nomi tecnici e test conservano termini come `snap`, ma non descrivono più un aggancio automatico attivo.

Dalla fase 9UX la UX normativa è:

- selezione della presa con popup contestuale;
- `Dettagli`, `Aggancia`, `Sgancia`, `Ruota`, `Sposta` e `Rimuovi` nel popup;
- aggancio esplicito tramite mouse e shadow 3D aderente alla parete;
- movimento e rotazione con click incrementale oppure drag transazionale;
- preview shadow durante il drag e commit soltanto al rilascio;
- nessun comando legacy avanti/indietro e nessuna shortcut globale di trasformazione;
- `Escape` annulla la modalità, elimina la preview, deseleziona la presa e nasconde il popup.

Il primo gruppo (`DEC-025`) riguarda tolleranza/diedri, continuita dei click, diagnostica locale e regressioni. `DEC-026`, approvata dall'utente, ne sostituisce soltanto la parte tolleranza con soglie separate e configurazione runtime della parete. Gli interventi su backend/catalogo e il completamento della gestione globale errori restano differiti; questa guida non ne attesta la chiusura.

## Architettura

```mermaid
flowchart LR
  U[Utente] --> UI[UI DOM]
  UI --> SC[WallScene three.js]
  SC --> RP[Rapier WASM]
  UI --> API[ASP.NET Core API]
  SC --> API
  API --> AC[Asset catalog]
  API --> HW[Convex Hull worker]
  API --> LOG[Serilog]
  AC --> WALL[(main-wall)]
  AC --> HOLDS[(holds/Hold-number)]
  HW --> HOLDS
```

Il backend non esegue la simulazione fisica. Il frontend mantiene separate la mesh grafica Three.js e il collider Rapier. La parete usa un TriMesh statico; ogni presa usa un rigid body cinematico con Convex Hull pre-calcolato.

## Struttura Dei Sorgenti

```mermaid
flowchart TD
  ROOT[the-route-setter-beta]
  ROOT --> SRC[source]
  SRC --> BE[backend/src/TheRouteSetter.Api]
  SRC --> BT[backend/tests/TheRouteSetter.Api.Tests]
  SRC --> FE[frontend/src]
  SRC --> FT[frontend/tests]
  SRC --> SCRIPTS[scripts]
  ROOT --> WALL[main-wall]
  ROOT --> HOLDS[holds/Hold-number]
  ROOT --> DOCS[docs]
  ROOT --> SDD[sdd-specs]
  ROOT --> OUT[phases-outcome]
  FE --> API_TS[api]
  FE --> CATALOG[catalog]
  FE --> PHYS[physics]
  FE --> SCENE[scene]
  FE --> INTERACTION[interaction]
  FE --> EXPORT[export]
```

Gli asset sono esterni a `source`. Le cartelle delle prese devono rispettare `Hold<number>`. I sorgenti applicativi e di test sono contenuti in `source`; la documentazione stabile è in `docs`.

## API

```mermaid
flowchart LR
  B[Browser] -->|GET /api/system/health| SYS[SystemController]
  B -->|GET /api/wall| WC[WallController]
  B -->|GET /api/holds| HC[HoldsController]
  B -->|GET /api/holds/id/model| HC
  B -->|GET /api/holds/id/preview| HC
  B -->|GET /api/holds/id/collider| HC
  B -->|GET /api/holds/id/assets/fileName| HC
  B -->|POST /api/logs| LC[LogsController]
  HC --> AS[IAssetCatalogService]
  WC --> AS
  LC --> LS[IFrontendLogService]
```

| Metodo | Percorso | Scopo |
|---|---|---|
| `GET` | `/api/system/health` | Disponibilità del backend. |
| `GET` | `/api/wall` | Modello GLB della parete con supporto range. |
| `GET` | `/api/holds` | Manifest leggero delle prese, senza contenuto GLB. |
| `GET` | `/api/holds/{id}/model` | Modello GLB caricato on demand. |
| `GET` | `/api/holds/{id}/preview` | Immagine catalogo opzionale. |
| `GET` | `/api/holds/{id}/collider` | Documento JSON del Convex Hull pronto. |
| `GET` | `/api/holds/{id}/assets/{fileName}` | Asset opzionale appartenente alla presa. |
| `POST` | `/api/logs` | Evento diagnostico frontend sanitizzato e registrato lato server. |

Swagger UI è esposta su `/swagger`; il documento OpenAPI è `/swagger/v1/swagger.json`. Le risposte di errore non espongono stack trace o percorsi interni e includono gli identificatori di correlazione previsti.

## Lifecycle Della Presa

```mermaid
stateDiagram-v2
  [*] --> Catalogo
  Catalogo --> Detached: Utilizza / load on demand
  Detached --> AttachTargeting: Aggancia
  AttachTargeting --> Attached: click valido / commit
  AttachTargeting --> Detached: target invalido
  Attached --> Moving: Sposta
  Attached --> Rotating: Ruota
  Moving --> Attached: click o drag valido
  Rotating --> Attached: click o drag valido
  Moving --> Attached: endpoint invalido / rollback
  Rotating --> Attached: endpoint invalido / rollback
  Attached --> Detached: Sgancia
  Detached --> Catalogo: Rimuovi
  Attached --> Catalogo: Rimuovi
  AttachTargeting --> Deselezionata: Escape
  Moving --> Deselezionata: Escape
  Rotating --> Deselezionata: Escape
  Deselezionata --> Detached: selezione hold detached
  Deselezionata --> Attached: selezione hold attached
```

Lo stato fisico è `detached` o `attached`; la modalità UI è `idle`, `attach-targeting`, `moving` o `rotating`. Una sola presa e una sola sessione drag possono essere attive. `pointercancel`, perdita della capture, blur, rimozione e cambio selezione eseguono cleanup senza commit.

## Flusso UI

```mermaid
flowchart TD
  START[Avvio pagina] --> CONFIG{Configurazione fisica valida?}
  CONFIG -->|Si| LOAD[Carica manifest e parete]
  CONFIG -->|No| ERROR[Errore in pagina: avvio bloccato]
  LOAD --> READY[Catalogo e scena pronti]
  READY --> USE[Utilizza]
  USE --> SPAWN[Spawn detached libero]
  SPAWN --> SELECT[Selezione e popup]
  SELECT --> DETAILS[Dettagli 3D]
  SELECT --> ATTACH[Aggancia]
  ATTACH --> TARGET[Shadow target sulla parete]
  TARGET --> VALID{Endpoint valido?}
  VALID -->|Si| COMMIT[Commit attached]
  VALID -->|No| RETRY[Shadow rossa e nuovo tentativo]
  COMMIT --> MOVE[Sposta]
  COMMIT --> ROTATE[Ruota]
  MOVE --> PREVIEW[Shadow drag]
  ROTATE --> PREVIEW
  PREVIEW --> ENDPOINT{Rilascio valido?}
  ENDPOINT -->|Si| COMMIT
  ENDPOINT -->|No| ROLLBACK[Rollback totale]
  SELECT --> EXPORT[Genera JPG]
  SELECT --> REMOVE[Rimuovi e torna al catalogo]
  TARGET --> ESC[Escape: annulla e deseleziona]
  PREVIEW --> ESC
```

### Catalogo E Dettagli

Il manifest viene caricato una volta per sessione. Preview, modelli e collider sono caricati on demand. Il viewer `Dettagli` è condiviso tra catalogo e popup e rilascia renderer, controlli e risorse alla chiusura. I modelli con lo stesso URL condividono download, parsing, geometrie e texture tramite reference counting.

### Targeting E Aggancio

La shadow gialla segue il ray centrale e orienta l'asse locale `+Z` sulla normale della parete, conservando il twist. Il footprint della base non è disegnato, ma genera 37 campioni deterministici. Al click gli hit sono raggruppati per continuità e compatibilità delle normali; il gruppo dominante determina punto e normale. Una posa invalida non modifica la presa e rende temporaneamente rossa la shadow.

### Movimento E Rotazione

Il click sulle frecce richiede `1 cm` o `1°`, arrestando il passo alla frazione ammessa dalle query. Solo i click di movimento restano entro `5°` dalla normale di aggancio e si arrestano su gap o discontinuita. Oltre la soglia pointer di `4 px`, il gesto diventa una transazione: la presa reale e il collider restano invariati, la shadow mostra il candidato e il rilascio valida solo l'endpoint, senza query collisioni durante pointermove. Il drag da freccia e vincolato all'asse; quello iniziato sulla presa usa entrambe le dimensioni dello schermo, con contact point sotto al puntatore senza offset iniziale. Il drag usa la prima superficie visibile dell'intero modello, puo cambiare pannello senza limite di `5°` e trasporta l'orientamento sulla nuova normale. Un endpoint invalido annulla tutto; senza hit la shadow e nascosta e l'endpoint non e committabile, fino a un nuovo hit.

### Validazione Fisica E Limiti

`PhysicsWorld` misura la posa originale con `collider.contactShape` contro l'intero TriMesh e le altre prese, senza spostarla verso l'esterno lungo la normale del pannello. La broadphase AABB nativa seleziona i candidati con semiestensione `raggio + prediction`; i contatti negativi devono essere confermati da `intersectsShape`, mentre risposte contraddittorie oltre epsilon rendono la posa incerta e non committabile. Il contatto e valido; la tolleranza parete e configurabile in `1..10 mm`, decimali inclusi, default `5 mm`, mentre fra prese resta immutabile a `1 mm`. L'epsilon numerico separato resta `2e-6 m`. Per endpoint e intervalli governa il minimo per contatto di `distance + tolerance`, non la distanza grezza piu profonda con una soglia unica: ad esempio una parete a `-4 mm` entro i suoi `5 mm` non puo mascherare una presa a `-2 mm` oltre il suo `1 mm`. Le sole query fra coppie convesse supportate usano copie normalizzate di fattore `100`, con gli stessi vertici e indici degli hull precalcolati e distanze riconvertite in metri. Non vengono generati hull frontend: GLB, geometria renderizzata e collider del mondo restano invariati.

Per i click, lo shape cast opera solo a rotazione fissa e da partenza separata, arrestando la traslazione prima del primo contatto, anche verso il pavimento: la tolleranza non autorizza lo sweep a proseguire fino alla profondita ammessa. Contatti iniziali e rotazione sono gestiti dalla suddivisione ricorsiva degli intervalli, confrontando il margine minimo `distance + tolerance` con il massimo moto dei punti del collider, dato da traslazione piu raggio per angolo di rotazione. Ogni chiamata usa budget `512` e bound minimo `2e-6 m`; gli intervalli incerti o irrisolti sono bloccati conservativamente, non accettati perche gli endpoint sono liberi. La regressione pavimento/pinna nello stesso collider con contatto iniziale passa, ma non elimina il limite nativo dei cast da contatto iniziale. Il drag resta editoriale endpoint-only e non usa questo controllo del percorso. Il surface-lock dei click resta a `5 gradi` e il gap massimo di riproiezione a `5 mm`, indipendenti dalla tolleranza parete.

Limiti noti di Rapier `0.12.0`: la profondita per faccia vicino alle giunzioni interne dei triangoli puo essere sottostimata anche se l'intersezione e confermata; una presa completamente contenuta in un TriMesh chiuso senza intersezione superficiale non viene rilevata. Le regressioni e il bound del moto non sono una certificazione generale per geometrie arbitrarie degeneri o volumi solidi, e non attestano che tutti i difetti siano risolti. Il follow-up e aperto in `sdd-specs/05-open-decisions-guidate.md`, `DEC-025`; un eventuale upgrade Rapier richiede approvazione utente e verifiche dedicate.

La tolleranza configurabile (`DEC-026`) non garantisce che ogni superficie sia agganciabile ne compensa necessariamente tutte le imperfezioni di modelli da foto/fotogrammetria. Una soglia maggiore ammette maggiore penetrazione parete, non corregge la mesh o la precisione delle query.

Se una query rileva una violazione accertata e un altro collider restituisce dati incerti, prevale la violazione: la posa resta rifiutata per collisione, non per semplice incertezza. Blocker, handle, penetrazione, tolleranza e `uncertain: false` restano riferiti allo stesso contatto. Senza violazioni confermate, l'incertezza resta bloccante e produce `path-unresolved`.

### Export

`Genera immagine` produce un JPG con lato lungo `2560 px`, rapporto della viewport e qualità `0.90`. Il render temporaneo conserva camera e sfondo, esclude DOM, evidenziazioni, shadow e indicatori e ripristina sempre lo stato nel `finally`. Il comando è disabilitato durante un drag.

## Responsabilità Backend E Frontend

```mermaid
flowchart LR
  subgraph Backend
    DISC[Discovery asset]
    SERVE[Serving HTTP e range]
    HULL[Generazione Convex Hull]
    HASH[Hash e invalidazione]
    ERR[Error contract]
    LOG[Logging Serilog]
  end
  subgraph Frontend
    CATALOG[Catalogo sessione]
    THREE[Rendering three.js]
    RAPIER[Fisica Rapier]
    UX[Macchina a stati UX]
    PREVIEW[Shadow e drag endpoint-only]
    IMAGE[Export JPG]
  end
  DISC --> CATALOG
  SERVE --> THREE
  HULL --> RAPIER
  HASH --> RAPIER
  UX --> THREE
  UX --> RAPIER
  PREVIEW --> THREE
  PREVIEW --> RAPIER
  THREE --> IMAGE
  UX --> LOG
  ERR --> UX
```

## Flusso Convex Hull

```mermaid
sequenceDiagram
  participant W as Worker backend
  participant A as Asset catalog
  participant F as File system
  participant C as Client Rapier
  W->>A: enumera Hold-number
  A->>F: legge GLB e collider.json
  alt collider assente o hash diverso
    W->>F: legge vertici GLB
    W->>W: calcola Convex Hull
    W->>F: scrive collider.json atomico
  else collider coerente
    W->>W: riusa il documento
  end
  C->>A: GET collider
  A-->>C: vertici, indici, sourceHash
  C->>C: crea collider cinematico
```

## Flusso Drag Transazionale

```mermaid
sequenceDiagram
  participant U as Utente
  participant O as HoldOverlay
  participant S as WallScene
  participant P as Rapier
  U->>O: pointerdown
  U->>O: movimento oltre 4 px
  O->>S: begin drag
  S->>S: crea shadow runtime
  loop al massimo una volta per frame
    U->>O: pointermove
    O->>S: aggiorna candidato geometrico
    S->>S: aggiorna solo shadow
  end
  U->>O: pointerup
  O->>S: commit endpoint
  S->>P: una validatePose
  alt valido
    S->>P: aggiorna corpo cinematico
  else invalido
    S->>S: conserva snapshot iniziale
  end
  S->>S: elimina shadow e ripristina camera
```

## Configurazione

Il backend legge `source/backend/src/TheRouteSetter.Api/appsettings.json`:

- `AssetStorage.RootPath`: radice che contiene `main-wall` e `holds`;
- `AssetStorage.MainWallDirectory`: directory della parete;
- `AssetStorage.HoldsDirectory`: directory delle prese;
- `Logging.FilePath`: pattern file Serilog;
- `Logging.RetentionDays`: retention, valore predefinito 7;
- `Logging.QueueCapacity`: capacità della coda asincrona.

Le variabili d'ambiente ASP.NET Core possono sovrascrivere i valori con la sintassi `Sezione__Chiave`, per esempio `AssetStorage__RootPath`.

Il frontend usa:

- `E2E_FRONTEND_PORT` e `E2E_BACKEND_PORT` per la suite E2E;
- `PERF_FRONTEND_PORT`, `PERF_BACKEND_PORT`, `PERF_HEADLESS`, `PERF_DURATION_MS` e `PERF_HOLD_COUNT` per il benchmark.

### Tolleranza Parete Runtime

Il file sorgente da modificare e `source/frontend/public/physics-config.json`. Contenuto iniziale:

```json
{
  "wallPenetrationToleranceMm": 5
}
```

Il valore e un numero JSON in millimetri da `1` a `10` inclusi. Sono ammessi decimali, ad esempio `7.5`, con punto e senza virgolette: non `"5"` o `7,5`. Nessun commento, virgola finale o chiave aggiuntiva. La tolleranza fra prese e sempre `1 mm` e non ha una chiave modificabile; l'epsilon resta `2e-6 m`.

Il frontend richiede il file una sola volta al bootstrap con `cache: 'no-store'`, prima di creare la scena. Non lo importa nel bundle e non lo rilegge durante le interazioni. La configurazione resta fissa per quella sessione; solo una nuova apertura/reload applica il valore cambiato. File mancante, errore HTTP/rete, JSON malformato o valore invalido impediscono l'avvio senza ripiegare silenziosamente su `5 mm`: compare un errore gestito nella pagina, non un'eccezione `pageerror` non gestita. Correggere il file servito e ricaricare.

**Prima di modificare il file, esportare l'eventuale vista da conservare con `Genera immagine`.** Il reload perde tutte le prese e lo stato della sessione. Il JPG salva soltanto un riferimento visivo: non e una sessione editabile e non permette di ripristinare la tracciatura. Vite puo ricaricare automaticamente la pagina non appena si modifica un file in `public`, quindi non attendere il reload manuale per esportare.

In sviluppo, con `npm run dev` gia avviato:

1. Esportare prima dell'edit se serve un riferimento della sessione corrente.
2. Modificare il numero in `source/frontend/public/physics-config.json` e verificare il JSON.
3. Ricaricare la pagina se Vite non l'ha gia ricaricata; controllare il valore attivo in console come indicato in Avvio Debug.

Non occorrono riavvio del backend, riavvio del frontend, compilazione o nuova installazione delle dipendenze per questo cambio di valore: Vite serve direttamente `public`.

In produzione, il codice che introduce questa funzionalita richiede prima la normale installazione delle dipendenze (`npm ci`), build (`npm run build`) e distribuzione iniziali. Dopo tale deploy:

1. Individuare il `dist/physics-config.json` effettivamente distribuito e servito dal sito (alla base URL dell'applicazione).
2. Dopo l'eventuale export, modificarne il numero e ricaricare la pagina. Con un server statico non servono rebuild o riavvio del server/backend.
3. Riportare il valore permanente in `source/frontend/public/physics-config.json`: il build successivo copia `public` e sovrascrive il file in `dist`.

Modificare soltanto `source/frontend/public/physics-config.json` non cambia un deploy esistente: occorre ricompilare/distribuire oppure copiare quel JSON nella posizione servita. Configurare server statico, reverse proxy e CDN/cache affinche rispettino `Cache-Control: no-store` per `physics-config.json`; il `no-store` della fetch browser non sostituisce la configurazione degli intermediari. In DevTools Network verificare che la risposta contenga il nuovo valore.

Verifica finale confermata dall'utente: su una build di produzione in dist temporanea, il file reale servito e stato modificato `5 -> 3 -> 5` e ciascun valore e stato applicato al reload senza rebuild fra le modifiche. Non e soltanto una risposta simulata nei test. Risultati e limiti nel [report DEC-026](../phases-outcome/Wall_tolerance_configuration_done.md).

### Prove Consigliate

| Valore parete | Uso suggerito |
|---|---|
| `1 mm` | Baseline piu restrittiva, confrontabile con la precedente soglia unica. |
| `3 mm` | Prova conservativa. |
| `5 mm` | Default raccomandato sulla base delle pose reali verificate. |
| `7.5 mm`, `10 mm` | Prove esplorative; non una garanzia di risoluzione su tutte le superfici. |

Confrontare gli stessi punti, click `+/-1 cm` e twist `+/-1 grado`, annotando il valore attivo e il motivo del rifiuto. Ogni reload azzera la sessione: esportare prima di ciascun edit. I risultati reali verificati sono in `docs/test-automatici.md`; non modificare soglia hold, limite angolare o gap per queste prove.

## Avvio Live

Prerequisiti: .NET SDK `8.0.424`, Node.js `22.18.0`, npm `10.9.3` e browser WebGL 2.0.

Backend, dalla cartella `source`:

```powershell
dotnet restore .\TheRouteSetter.sln --locked-mode
dotnet run --project .\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj --launch-profile http
```

Frontend, dalla cartella `source/frontend`:

```powershell
npm ci
npm run dev -- --host 127.0.0.1
```

Aprire `http://127.0.0.1:5173`. Il proxy Vite inoltra `/api` a `http://127.0.0.1:5080`.

## Avvio Debug

Backend con hot reload, dalla cartella `source`:

```powershell
dotnet watch --project .\backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj run --launch-profile http
```

Frontend con HMR e source map, dalla cartella `source/frontend`:

```powershell
npm run dev -- --host 127.0.0.1
```

Usare DevTools del browser per TypeScript/WebGL e il debugger .NET dell'IDE collegato al processo API. Lo snapshot `window.__ROUTE_SETTER_SCENE__` è diagnostico per gli E2E; la telemetria `window.__ROUTE_SETTER_PERFORMANCE__` esiste solo con query string `?performance=1`.

Per diagnosticare un rifiuto, consultare in sola lettura lo snapshot corrente in DevTools, senza modificarlo:

```javascript
window.__ROUTE_SETTER_SCENE__?.collisionTolerancesMm
window.__ROUTE_SETTER_SCENE__?.lastActionResult?.reason
window.__ROUTE_SETTER_SCENE__?.lastPoseDiagnostic
```

Con il file iniziale, `window.__ROUTE_SETTER_SCENE__.collisionTolerancesMm` restituisce `{ wall: 5, holds: 1 }`. Sono valori attivi in millimetri da leggere, non da assegnare per cambiare la fisica. `lastPoseDiagnostic.toleranceMeters` e invece in metri e indica la soglia scelta per il contatto governante dal minimo `distance + tolerance`, non necessariamente il contatto con distanza grezza piu profonda; anche `penetrationMeters` va interpretato rispetto a quel contatto, non come massimo globale indipendente.

`reason` distingue `wall-collision`, `hold-collision`, `no-surface`, `surface-gap`, `normal-limit`, `no-change` e `path-unresolved`; puo essere assente quando non applicabile. `path-unresolved` significa arresto conservativo, non collisione accertata. `lastPoseDiagnostic` contiene `position`, `rotation` (quaternion), `blocker`, `penetrationMeters`, `toleranceMeters`, `colliderHandle` e il booleano `uncertain` dell'ultima `validatePose`. Puo essere nullo o precedente all'azione corrente (ad esempio no-op o controllo del percorso senza query endpoint); non rappresenta una cronologia ne una misura certificata nei casi limite descritti sopra. Una violazione accertata prevale su risposte contraddittorie di altri collider: tutti i campi restano associati al contatto della violazione e `uncertain = false`. Senza violazioni accertate, viene selezionato un contatto incerto con campi coerenti e `uncertain = true`, senza sentinelle infinite in `penetrationMeters`: la UI restituisce `path-unresolved` anche in presenza di un blocker. Sono dati volatili in memoria, senza log persistenti, invii di rete o logging per frame.

## Errori E Logging

Il middleware assegna un identificatore di correlazione alla richiesta e converte le eccezioni nel contratto HTTP previsto. Serilog scrive JSON in modo asincrono, con livello minimo configurabile e retention giornaliera. Il frontend mostra messaggi non tecnici e non conserva log persistenti nel browser. La copertura globale di tutte le categorie di errore e il relativo inoltro al backend restano da completare/verificare nel gruppo differito: `lastActionResult.reason` e `lastPoseDiagnostic` sono diagnostica locale, non sostituiscono tale gestione ne producono invii per frame.

## Risoluzione Problemi

- `Parete non disponibile`: verificare `AssetStorage.RootPath`, la cartella `main-wall` e `GET /api/wall`.
- Configurazione fisica non valida/non disponibile: controllare la risposta di `physics-config.json`, numero `1..10` senza virgolette, punto decimale, nessun commento o altra chiave. Correggere il file effettivamente servito, controllare cache/proxy e ricaricare; nessun fallback automatico. Questo caso non richiede una correzione generale del backend.
- Presa senza pulsante `Utilizza`: verificare `colliderStatus` nel manifest e la presenza di `collider.json`.
- Errori proxy frontend: verificare che il backend ascolti sulla porta `5080` o impostare `E2E_BACKEND_PORT` coerentemente.
- WebGL non disponibile: aggiornare driver/browser e verificare l'accelerazione hardware.
- Benchmark a pochi FPS in headless: eseguire headed; SwiftShader e il throttling RAF non certificano il profilo hardware.
- Porta occupata: terminare il processo esistente o impostare le variabili porta supportate dalle configurazioni Playwright/Vite.
