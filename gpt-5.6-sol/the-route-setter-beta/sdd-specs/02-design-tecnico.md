# Design tecnico
## Applicazione per tracciatura vie climbing indoor

Questo documento descrive il design della baseline v0.0.1 e i contratti di `01-specifica-requisiti.md`.

I requisiti correnti, entro costituzione e decisioni esplicite, prevalgono su implementazione e report. Lo sviluppo di **v0.0.1 e CHIUSO e ACCETTATO dall'utente con limiti noti** (`DEC-029`); il design non converte questa accettazione in garanzie universali o correzioni tecniche. [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md) e l'unica fonte dello stato di versione, rischi, eccezioni ed evidenze. Le attenzioni accettate non bloccano la chiusura; gli esiti originali di fase restano storici.

## 1. Architettura

Target ufficiale v0.0.1: Chrome Stable desktop con WebGL 2.0, ultima versione testata Chrome 152. Nessuna promessa automatica per future Stable del vendor; Edge e Firefox sono esplorativi e non bloccano la release (`C12`, `REQ-ARC-007`, `DEC-029`).

Browser:
- three.js per rendering;
- Rapier WASM per fisica;
- UI catalogo/comandi;
- stato sessione e istanze;
- export immagine;
- client REST.

Backend ASP.NET Core Web API:
- discovery asset;
- manifest catalogo;
- serving file statici;
- generazione/invalidazione Convex Hull;
- gestione errori;
- logging Serilog JSON.

## 2. Stack vincolato

- Frontend: TypeScript + Vite.
- Backend: ASP.NET Core Web API.
- Rapier frontend: `@dimforge/rapier3d-compat`.
- Parsing GLB backend: SharpGLTF.
- Convex Hull backend: MIConvexHull.
- Logging backend: Serilog.
- Versionamento dipendenze: pinning esatto + lockfile obbligatori.

## 3. Struttura logica delle cartelle

Schema logico, non inventario dei percorsi fisici: i sorgenti applicativi risiedono in `source/backend` e `source/frontend`.

```text
/backend
  /src
    /Controllers
    /Services
      /Catalog
      /Wall
      /ConvexHull
      /Logging
    /Middleware
    /Models
  /main-wall
  /holds
  /tests

/frontend
  /src
    /scene
    /physics
    /holds
    /catalog
    /api
    /errors
    /logging
    /export
  /tests
    /physics
    /e2e

/docs
```

## 4. API baseline (vincolante minima)

Mantenere almeno questi endpoint:
- `GET /api/wall`
- `GET /api/holds`
- `GET /api/holds/status` (readiness separata)
- `GET /api/holds/{id}/model`
- `GET /api/holds/{id}/collider`
- `POST /api/logs`

E consentito aggiungere endpoint ulteriori se necessari, senza alterare i vincoli dei requisiti.

Manifest hold: deve includere almeno id, previewUrl, modelUrl, colliderUrl e stato disponibilita collider.

### Cache e disponibilita progressiva

`HoldsController.GetStatus` delega a `IAssetCatalogService.GetHoldStatuses` e restituisce HTTP `200` con `Cache-Control: no-store`: array di `HoldStatus` con soli `id`, `colliderStatus`, `colliderUrl`. Stati `Missing`, `Pending`, `Ready`, `Failed`; URL `/api/holds/{id}/collider` soltanto per `Ready`, altrimenti `null`. Nessun preview/model URL, asset opzionale, hash o geometria. La discovery rilegge nomi di file/cartelle e job store corrente, non il contenuto GLB. `AssetDirectoryReader` e il worker isolano i guasti delle singole cartelle/job e li correlano con ErrorId; suffissi Hold non rappresentabili come interi sono ignorati senza bloccare le altre prese.

`ColliderGenerationWorker.StartAsync` accoda i modelli scoperti come `Pending`, quindi chiama `CompleteInitialDiscovery`. Da quel momento `ColliderJobStore.GetStatus` restituisce `Failed` per un ID mai accodato, anche se la directory torna leggibile o contiene un collider non verificato; prima conserva i fallback `Missing`/`Ready`. Gli stati espliciti noti prevalgono sempre. Il worker consuma il backlog iniziale e termina quando vuoto, senza hot reload o riaccodamento automatico di ID nuovi.

`source/frontend/src/catalog/sessionCatalog.ts` conserva una sola promessa del manifest e una cache di object URL delle preview. I metadati originali non vengono mutati: una mappa readiness separata sovrappone soltanto stato/URL collider in `availableHolds`. `watchReadiness` usa `fetchHoldReadiness` di `api/holdApi.ts`, che valida array, ID univoci `Hold<number>`, stati e URL coerenti, tramite `api/http.ts` e fetch `no-store`.

Il watcher parte dopo `1 s`, senza richieste concorrenti; programma il successivo controllo `1 s` dopo la conclusione del precedente. Interroga l'endpoint solo finche almeno una hold gia nel manifest e `Pending`/`Missing` e applica aggiornamenti solo a queste hold. `Ready`/`Failed` sono terminali per la sessione; nuove hold eventualmente presenti nella risposta non vengono aggiunte al manifest. Il callback `onChange` aggiorna il catalogo solo quando cambia readiness/URL, senza refetch dei metadati/preview e senza eager-load GLB. Su errore mantiene lo stato precedente, notifica il reporter e ritenta con backoff `2, 4, 8, 16, 30 s`, azzerato dopo fetch riuscita; timeout per richiesta `10 s`. `dispose` cancella timer, abortisce la richiesta e rilascia le preview; nessun aggiornamento tardivo dopo distruzione. Nessun legame con frame o mouse move. Il codice attuale ritenta anche errori di parsing del payload, non solo errori di rete.

La preview usa `fetchBlob` preservando il MIME (incluso SVG), senza mutare i metadati memorizzati.

## 5. Convex Hull backend

Flusso:
1. scansione cartelle `holds/Hold<number>` (es. `Hold1`, `Hold2`);
2. lettura GLB con SharpGLTF;
3. calcolo hull con MIConvexHull (.NET), indipendente da Rapier;
4. serializzazione `collider.json`:

```json
{
  "sourceHash": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "vertices": [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  "indices": [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]
}
```

5. invalidazione su hash;
6. generazione in background non bloccante;
7. hold esposte come utilizzabili quando collider pronto.

Esempio strutturale di tetraedro: l'hash effettivo deve corrispondere al GLB sorgente. `DEC-028` rende tutti e tre i campi obbligatori e non null in `REQ-HUL-003`. `sourceHash` contiene `sha256:` seguito da 64 cifre esadecimali; `vertices` contiene XYZ contigui finiti, almeno 12 numeri e cardinalita multipla di 3; `indices` contiene almeno 12 interi in triangoli, cardinalita multipla di 3, ciascuno in `[0, vertices.length / 3)`. Il contratto descrive l'hull generato, non una triangolazione da ricostruire nel client.

`Services/ConvexHull/ColliderModels.cs` espone `ColliderDocument` con `Indices` richiesto anche in OpenAPI. `FileSystemColliderProcessor` valida geometria prima della scrittura atomica e prima del riuso insieme all'hash: indici assenti/nulli/vuoti/fuori intervallo invalidano il collider anche con hash coerente. Il backend legge/genera gli indici; il frontend `HoldColliderDocument`/`validateColliderDocument` in `api/holdApi.ts` li richiede e `wallScene.ts` li passa a `ColliderDesc.convexMesh`, senza generazione hull. Il frontend verifica anche finitezza dopo conversione float32 e limiti uint32; la validazione backend osservata verifica invece finitezza double e indici `int`. Questi controlli minimi non sono una prova generale di qualita topologica di dati arbitrari.

Non sono necessari migrazione o supporto retrocompatibile per documenti senza indici; non aggiungere fallback frontend. La rigenerazione ordinaria di file invalidi resta distinta da una migrazione.

## 6. Fisica frontend

- mondo Rapier con gravita zero;
- parete: TriMesh statico client-side;
- hold: collider Convex Hull da backend;
- movimento cinematico richiesto: shape-cast e contact query native Rapier coordinate dal solver; `KinematicCharacterController` fondazione legacy/opzionale;
- no autostep/snap-to-ground.

`DEC-028` aggiorna esplicitamente `REQ-FIS-004`: i click devono conservare il prefisso valido nella direzione richiesta, entro i vincoli locali, senza move-and-slide automatico o estrazione delle componenti libere per aggirare gli ostacoli. Il percorso attivo usa `maximumValidPoseFraction` (§7.9). `PhysicsWorld.characterController` resta inizializzato nella foundation e disponibile ai metodi legacy, ma non e richiesto come solver dei click correnti; la sua configurazione slide non determina la semantica dell'interazione attiva. Restano query native Rapier, architettura client-side, assenza di impulsi/dinamica e separazione mesh/collider. I drag restano editoriali endpoint-only; la chiusura normativa non certifica i limiti fisici generali.

### Convenzione spaziale degli asset

Il frontend assume che i modelli GLB rispettino la convenzione `Y-up`, con il fronte arrampicabile della parete rivolto verso `+Z`.
La camera iniziale viene posizionata sul semiasse `+Z` e orientata verso il centro geometrico della parete.

Il frontend non applica euristiche per determinare automaticamente il fronte.
Eventuali modelli non conformi devono essere corretti prima dell'importazione.

### Stato fisico e modalita di interazione 9UX

Ogni hold ha due stati fisici:

- `detached`: disponibile per targeting diretto o rimozione;
- `attached`: aderente a punto e normale memorizzati, disponibile per sgancio, movimento, rotazione o rimozione.

La UI mantiene una modalita globale mutuamente esclusiva:

- `idle`;
- `attach-targeting`;
- `moving`;
- `rotating`.

Ogni cambio modalita interrompe timer, drag e pointer capture della modalita precedente. `Escape` torna a `idle`, annulla ogni preview senza commit, deseleziona la hold e nasconde il popup. Il cambio selezione termina la modalita attiva e apre il popup per la nuova selezione.

### Spawn iniziale detached

Il riferimento dello spawn non e il centro volumetrico della parete.

Il frontend:
1. calcola il centro geometrico del bounding box della parete;
2. proietta tale punto sulla superficie frontale nella direzione `+Z`;
3. seleziona deterministicamente l'intersezione frontale valida;
4. definisce il primo candidato con offset `2.0 m` lungo `+Z`;
5. se il candidato e occupato, genera una griglia sul piano parallelo al fronte;
6. usa come assi della griglia la base locale del piano frontale della parete;
7. visita i punti della griglia per distanza crescente dal centro e con ordinamento stabile;
8. utilizza una distanza di `0.30 m` tra i punti;
9. mantiene per ogni candidato l'offset di `2.0 m` lungo `+Z`;
10. valida ogni posizione con Rapier rispetto a parete e hold presenti;
11. seleziona il primo candidato non compenetrante.

L'inserimento viene annullato soltanto quando nessun candidato valido e disponibile nel dominio di ricerca.
La ricerca e limitata all'area frontale proiettata della parete (bounding frontale) estesa da un margine configurabile.

A parita di distanza dal centro, l'ordine dei candidati deve essere deterministico: alto, destra, basso, sinistra, quindi diagonali in senso orario.

## 7. Targeting, aggancio e validazione (vincolante dalla fase 9UX)

### 7.1 Target pointer e shadow di aggancio

Il target visibile e una shadow Three.js runtime nel `previewGroup`. Il footprint della base viene calcolato e proiettato soltanto per determinare l'area dei 37 campioni; non viene renderizzato.

Campionamento footprint:

1. ricavare il footprint locale della base dai vertici del Convex Hull nella fascia `localZ <= minZ + max(0.002 m, 2% della profondita)`;
2. se la fascia non contiene almeno tre vertici non collineari, usare come fallback l'estensione XY completa del Convex Hull;
3. proiettarne la dimensione nella camera corrente alla profondita del punto centrale colpito;
4. usare il diametro maggiore proiettato;
5. clamp fra `48 px` e `160 px`.

Durante `pointermove`:

- accumulare l'ultimo evento;
- aggiornare al massimo una volta per `requestAnimationFrame`;
- usare un solo ray Rapier camera-verso-TriMesh per posizione e visibilita della shadow;
- collocare il pivot shadow sul punto hit;
- orientare la shadow con `orientationFromNormal(normal, twistCorrente)`;
- usare materiali preview gialli trasparenti;
- non eseguire validazione completa della posa.

Il footprint proiettato viene calcolato senza query fisiche aggiuntive a partire dai punti locali della base nella posa shadow. Il lato maggiore viene clamped a 48-160 px e lo stesso fattore viene applicato agli offset dei campioni.

Al click eseguire i 37 campioni definiti da `REQ-UX-004`. I campioni sono espressi in coordinate normalizzate del footprint e trasformati in coordinate canvas prima di costruire i ray camera.

### 7.2 Raggruppamento superficie dominante

Ogni hit Rapier sul TriMesh contiene almeno:

```text
point
normal
distanceFromCamera
featureId stabile quando disponibile
sampleWeight
containsCenterSample
```

Il clustering e deterministico:

1. ordinare gli hit per indice campione;
2. assegnare ID stabile `mesh traversal index + triangle index` a ogni hit;
3. costruire sul pattern dei 37 campioni un grafo di adiacenza deterministico: numerare ogni anello in senso orario da angolo zero; collegare il centro a tutti i 6 punti del primo anello; collegare ogni punto ai due vicini circolari dello stesso anello; fra anelli consecutivi collegare ciascun punto ai due punti il cui angolo polare racchiude il suo angolo, includendo gli estremi e applicando wrap-around a 360 gradi;
4. unire tramite union-find, elaborato per coppie ordinate `(indiceMinore, indiceMaggiore)`, solo coppie adiacenti nel grafo con distanza world <= diametro fisico della base e differenza delle normali <= `5 gradi`; questa connettivita del grafo definisce interamente la componente locale e non richiede adiacenza globale dei triangoli;
5. la chiusura transitiva delle unioni definisce una componente locale, senza richiedere topologia globale del TriMesh;
6. scegliere il punto candidato del gruppo e aggiornare la normale rappresentativa tramite media normalizzata dei soli campioni entro 5 gradi dalla normale di quel punto; la normale risultante deve restare entro la stessa soglia dalla normale locale del punto;
7. se il campione centrale e valido scegliere il gruppo che lo contiene; altrimenti scegliere il gruppo con il maggior numero di campioni, tutti a peso unitario;
8. definire per ogni gruppo `distance = minima distanza camera dei membri` e `stableId = minimo ID dei membri`;
9. applicare i tie-break residui `distance minore -> stableId minore`.

L'assenza di una soglia minima e intenzionale: i campioni mancanti non votano contro i campioni che colpiscono la parete. Nel gruppo vincente il punto candidato e il membro a distanza schermo minima dal centro del footprint; in parita prevale l'indice campione minore.

### 7.3 Commit diretto

Il commit costruisce:

```text
position = punto candidato
rotation = align(local +Z, normal) + twist
```

La trasformazione detached-target e un teletrasporto editoriale: il percorso non viene interrogato. La posa finale viene validata mediante il Convex Hull contro il TriMesh parete e tutti i collider hold. Il contatto e valido. Secondo `DEC-026`, `wallPenetrationToleranceMeters = wallPenetrationToleranceMm / 1000` (intervallo `0.001..0.010 m`, default `0.005 m`), mentre `HOLD_PENETRATION_TOLERANCE_METERS = 0.001 m` resta immutabile. `CONTACT_NUMERICAL_EPSILON = 2e-6 m` resta distinto e invariato. Ogni contatto contribuisce `margin = distance + tolerance`; governa il minimo di questi margini, non il contatto con la distanza grezza piu profonda. Il rifiuto avviene per `minMargin < -2e-6 m` oppure per esito incerto. Una posa valida viene applicata atomicamente; una posa invalida non modifica corpo, mesh o stato.

`PhysicsWorld.poseClearance` seleziona i candidati con la broadphase nativa `collidersWithAabbIntersectingAabb`, AABB centrata sulla posa con semiestensione `colliderRadius + prediction`, quindi usa `candidate.contactShape` sulla posa originale contro l'intero collider TriMesh, senza offset uscente o selezione di un solo pannello. Le contraddizioni fra contatto e `intersectsShape` (intersezione senza contatto o con distanza positiva oltre epsilon; distanza negativa oltre epsilon senza intersezione) sono conservate separatamente dai contatti confermati. Se il margine minimo confermato viola la soglia oltre epsilon, tale violazione prevale sull'incertezza di un altro collider: `uncertain = false` e tutti i campi diagnostici appartengono al contatto governante. Altrimenti, in presenza di contraddizioni, si seleziona deterministicamente il collider incerto con handle minore: `uncertain = true`, margine zero, distanza riportata dalla query (o prediction in assenza di contatto), soglia e handle dello stesso collider; posa rifiutata e percorso irrisolto, senza sentinelle infinite. Per le sole coppie convex/convex supportate (ConvexPolyhedron, Cuboid, Ball), le query usano copie scalate di fattore `100` e traslazioni relative, riportando le distanze in metri. Gli hull mantengono gli stessi vertici precalcolati e indici: non vengono generati nuovi hull ne aggiunti collider al mondo. Asset, geometria renderizzata e collider fisici restano invariati.

Per gli endpoint `prediction` e la tolleranza parete, che e sempre almeno quella fra prese; per gli intervalli e `bound + wallPenetrationToleranceMeters`. Distanza, soglia e dati diagnostici del contatto governante devono restare associati: una parete a `-4 mm` con soglia `5 mm` non puo mascherare una hold a `-2 mm` con soglia `1 mm`. `lastPoseDiagnostic.toleranceMeters` descrive la soglia scelta; `penetrationMeters` non e una ricerca indipendente della massima profondita grezza. Le contraddizioni restano bloccanti indipendentemente dalle tolleranze.

Eccezione di release `DEC-029`: v0.0.1 mantiene Rapier `0.12.0` con i limiti noti descritti in [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md), non risolti dall'accettazione. `C17`/`C18` e `REQ-FIS-011` richiedono comunque i controlli sull'intero hull e l'applicazione delle soglie, senza garanzia universale su geometrie arbitrarie o volumi solidi. Tutti i triangoli sono candidabili, non tutte le pose sono valide; nessuna soluzione generale, upgrade del motore o modifica degli asset e implicita nella chiusura.

#### Configurazione runtime delle tolleranze

Il file sorgente `source/frontend/public/physics-config.json` contiene inizialmente:

```json
{
  "wallPenetrationToleranceMm": 5
}
```

`src/config/physicsConfig.ts` valida un oggetto con questa sola chiave e numero finito in `1..10`, estremi inclusi, senza arrotondare i decimali (esempio `7.5`). JSON stretto: valore senza virgolette, punto decimale, niente commenti o chiavi aggiuntive. La soglia hold non e configurabile. Il bootstrap in `main.ts` attende una sola `loadPhysicsConfig()` con fetch di `${import.meta.env.BASE_URL}physics-config.json` e `cache: 'no-store'`, quindi passa il valore immutabile a `createWallScene` e `PhysicsWorld`. Non e un import compilato ne una chiamata backend o per frame. I default disponibili per costruzioni dirette/test non sono un fallback del bootstrap browser.

HTTP non riuscito, rete, parsing o validazione falliti impediscono la creazione della scena e mostrano un errore gestito nella pagina, senza dettagli grezzi e senza `pageerror` non gestiti. Non avviare con default silenzioso. La gestione globale errori e descritta in §10.

In sviluppo Vite serve `public`: modificare il file e ricaricare applica il valore senza compilazione o riavvio backend/frontend. Vite puo ricaricare automaticamente alla modifica: esportare il JPG prima di editare; reload perde la sessione e JPG non conserva lo stato editabile. Per produzione occorre prima installare/buildare/distribuire il codice della funzionalita; poi il file effettivamente servito e `dist/physics-config.json` nel deploy. Su server statico modificarlo e ricaricare non richiede rebuild o riavvio. Modificare solo `public` richiede rebuild o copia nel deploy; il build successivo sovrascrive `dist`, percio il valore permanente va conservato nel sorgente. Configurare server/proxy/cache per `Cache-Control: no-store` su questo URL. Procedura operativa in `docs/applicazione.md`.

Lo snapshot read-only `window.__ROUTE_SETTER_SCENE__.collisionTolerancesMm` mostra `{ wall: 5, holds: 1 }` con il file iniziale; `lastPoseDiagnostic.toleranceMeters` mostra la soglia del contatto governante, non necessariamente il piu profondo.

### 7.4 Sgancio

I candidati sono:

```text
contactPoint + normal * (0.50 + index * 0.10)
```

per distanza `<= 10 m`. Ogni candidato usa l'orientamento detached iniziale e viene validato contro parete e hold. Lo sgancio e un riposizionamento editoriale diretto: non viene simulato il percorso fino al candidato. Il primo candidato finale valido viene applicato. Se il dominio e esaurito, nessuna trasformazione viene applicata.

### 7.5 Movimento sulla stessa superficie

Lo stato attached memorizza:

```text
attachmentPoint
attachmentNormal
currentPoint
currentNormal
twistRadians
```

Per ogni click singolo:

1. proiettare l'asse vista sulla tangente di `currentNormal`;
2. calcolare il candidato di `0.01 m`;
3. riproiettare localmente sulla parete;
4. stabilizzare la normale candidata;
5. verificare `angle(candidateNormal, attachmentNormal) <= 5 gradi`;
6. verificare il percorso del Convex Hull e la posa finale;
7. applicare la massima frazione valida o arrestare il passo.

Il confronto con `attachmentNormal`, non con la sola normale del passo precedente, impedisce di attraversare gradualmente un cambio di inclinazione accumulando piccole variazioni. La normale corrente puo invece variare entro soglia per seguire una curva senza distacco. Il gap massimo fra candidato e punto riproiettato resta `0.005 m` (`5 mm`), anche per la riproiezione del prefisso parziale; non dipende dalla tolleranza parete. Gap `5 mm` e limite angolare `5 gradi` non cambiano con `DEC-026`.

### 7.6 Drag transazionale movimento

Il drag attached non modifica lo stato fisico della hold. All'inizio viene creato:

```text
TransformDragSession {
  kind: move
  pointerId
  holdId
  startPose
  candidatePose
  startContactPoint
  candidateContactPoint
  attachmentNormal
  startCurrentNormal
  candidateNormal
  startTwistRadians
}
```

La direzione e fissata dalla freccia origine del drag. La distanza richiesta e la proiezione firmata del delta pointer sull'asse screen-space della freccia; la componente perpendicolare viene ignorata. La traiettoria richiesta e la linea retta fra origine e target.

Se il drag inizia direttamente sulla mesh della hold selezionata, `moveDirection` e `screenAxis` sono nulli: il contact point richiesto coincide con il puntatore corrente e non viene conservato l'offset iniziale fra punto afferrato e contact point. Il drag da freccia mantiene invece il vincolo screen-space della freccia.

Durante pointermove:

1. accumulare l'ultimo evento e aggiornare al massimo una volta per frame;
2. nel drag libero usare il pointer corrente come contact point richiesto; nel drag da freccia applicare il vincolo screen-space della freccia;
3. eseguire un singolo ray camera-verso-TriMesh sull'intero modello e scegliere il primo punto visibile;
4. aggiornare punto e normale candidati e trasportare l'orientamento iniziale sulla nuova normale mediante la rotazione minima;
5. consentire il passaggio fra pannelli e inclinazioni senza confrontare la normale con quella iniziale;
6. se il pointer non colpisce la parete mantenere la sessione ma rendere l'endpoint non committabile;
7. aggiornare clone 3D e linea/freccia gialla;
8. non eseguire `validatePose`, `contactShape`, shape-cast Convex Hull o mutazioni Rapier.

Al pointerup viene eseguita esattamente una query applicativa `validatePose` su `candidatePose` soltanto se il candidato e cambiato ed e disponibile. No-change, no-hit, sessione non disponibile e annullamento non eseguono query endpoint ne commit. Le query native interne contro piu collider non sono ulteriori validazioni applicative. Non viene verificato il percorso e non viene cercato un prefisso valido. Endpoint valido: un solo commit atomico di corpo, mesh, contact point, feature, normale e twist ricalcolato rispetto alla nuova normale. Endpoint invalido: rollback totale implicito, perche la posa reale non e mai stata modificata.

### 7.7 Drag transazionale rotazione

Il centro visuale e la proiezione del punto di contatto, non il centro del bounding box. La sessione conserva posa e twist iniziali. Il delta firmato del pointer viene calcolato con `atan2`, normalizzato attraversando `-pi/+pi` e applicato sempre rispetto allo snapshot iniziale. Il twist candidato e quantizzato a 1 grado.

Poiche nelle coordinate CSS l'asse Y cresce verso il basso, il segno del delta visuale deve essere invertito rispetto alla convenzione matematica standard, in modo che il punto della hold vicino alla freccia selezionata segua il verso del mouse.

Durante pointermove vengono aggiornati soltanto shadow e arco/linea gialla; non avvengono raycast o collision query. La shadow usa `orientationFromNormal(currentNormal, candidateTwist)`.

Al pointerup viene eseguita esattamente una query applicativa `validatePose` soltanto per un candidato cambiato e disponibile. No-change dopo quantizzazione, sessione non disponibile e annullamento non eseguono query endpoint ne commit. Endpoint valido: commit atomico della rotazione e del twist. Endpoint invalido: rollback totale. Non vengono controllati angoli intermedi.

### 7.8 Shadow 3D runtime

E un elemento visual-only, non un oggetto fisico aggiuntivo: `C6` impone mesh/collider separati a parete e istanze reali, non un collider per la preview.

La shadow viene creata a runtime clonando la gerarchia grafica dell'istanza selezionata:

- geometrie e texture condivise;
- materiali preview dedicati, trasparenti, opacita iniziale `0.35`;
- `depthTest = true`, `depthWrite = false`;
- nessun rigid body o collider;
- nessun `holdModelId` e layer/gruppo escluso dal picking;
- un solo clone preview attivo;
- materiali preview rilasciati alla fine della sessione, geometrie/texture condivise non disposte.

La shadow mostra sempre il target richiesto geometricamente ammissibile e non indica validita fisica. Una linea/freccia gialla accompagna il movimento; un arco/linea e valore angolare accompagnano la rotazione. In caso di endpoint invalido e consentito un breve flash rosso prima della rimozione.

### 7.9 Rotazione e click incrementali

I click incrementali di movimento e rotazione mantengono la validazione continua e l'arresto al prefisso conservativo valido, ora prescritti da `REQ-FIS-004`/`DEC-028`: nessuno scorrimento automatico delle componenti libere o deviazione per aggirare un ostacolo. I drag hanno invece semantica endpoint-only e rollback totale. Lo sgancio editoriale verifica separatamente ogni posa finale candidata.

`maximumValidPoseFraction` usa lo shape cast nativo solo per traslazioni a rotazione fissa (differenza angolare `< 1e-8`), su candidati AABB centrati a meta percorso con semiestensione `raggio + distanzaTraslazione / 2 + epsilon`. Per ogni ostacolo inizialmente separato, arresto al primo contatto sottraendo alla frazione TOI `2e-6 / travel`: anche verso il pavimento ci si ferma prima di toccarlo, senza avanzare fino alla penetrazione tollerata. I contatti gia presenti sono gestiti dagli intervalli: lo shape cast nativo non viene usato per risolvere questa condizione. Per includere anche la rotazione, il percorso viene suddiviso ricorsivamente da sinistra a destra, interpolando posizione e quaternion. Posto `travel = distanzaTraslazione + raggio * angolo`, per l'intervallo `[a,b]` il massimo moto di ogni punto rispetto alla posa centrale e limitato da `bound = travel * (b-a) / 2`. L'intervallo e accettato solo se non incerto e `min_i(distance_i + tolerance_i) >= bound + 2e-6`, con la soglia propria di ciascun contatto, come per gli endpoint. Non usare `min_i(distance_i)` seguito dall'aggiunta di un'unica tolleranza.

Ogni chiamata ha budget `512` valutazioni di intervallo; a `bound <= 2e-6 m` o budget esaurito si conserva soltanto il prefisso accettato, segnalando `unresolved` quando la verifica resta irrisolta. Un esito `uncertain` arresta subito la verifica come irrisolta. Non si accetta un intervallo solo perche i suoi endpoint sono liberi. Il bound geometrico non elimina i limiti delle distanze Rapier descritti in §7.3. `wallScene` verifica anche l'endpoint prima di applicare il prefisso ammesso; un movimento parziale riproiettato sulla parete viene verificato nuovamente per percorso e posa. Nessuna di queste query viene eseguita durante pointermove del drag.

La soglia click/drag e inizialmente `4 px`. Sotto soglia il rilascio produce il click incrementale; sopra soglia produce la sessione drag.

### 7.10 Degeneri

- normale non finita o quasi nulla: target non valido;
- nessun hit: target nascosto/non valido;
- parita di gruppi: tie-break definito in §7.2;
- proiezione tangenziale degenere: fallback deterministico su asse vista alternativo;
- nessuna posa valida nello sgancio: hold ancora attached e feedback utente;
- il retro non e classificato: un tentativo intenzionale sul retro e fuori ambito, ma la geometria resta collidente.
- nessun hit durante movimento drag: shadow nascosta ed endpoint non committabile, recuperabile al successivo hit;
- endpoint drag invalido: nessun commit e risultato `invalid-endpoint`;
- pointercancel, lost capture, blur, cambio selezione, rimozione o Escape: risultato `cancelled` e distruzione preview.

## 8. Movimento e input

### 8.1 Componenti UI

- `HoldContextMenu`: popup, stato abilitazione azioni e apertura del `HoldDetailsModal` condiviso con il catalogo;
- `WallTargetOverlay`: stato della shadow targeting e hint `Escape`;
- `HoldMoveHandles`: quattro frecce con click da 1 cm e drag transazionale oltre la soglia di 4 px;
- `HoldRotationHandles`: frecce circolari e drag;
- `HoldShadowPreview`: clone Three.js runtime, linea/freccia e arco;
- `HoldInteractionController`: macchina a stati e coordinamento pointer/OrbitControls.

Gli overlay usano un contenitore con `pointer-events: none`; solo popup e handle interattivi usano `pointer-events: auto`.

### 8.2 API scena

La scena deve esporre azioni semantiche e risultati espliciti:

```text
getSelectedHoldState
beginAttachTargeting
updateAttachTarget
commitAttachTarget
detachSelected
moveSelected
rotateSelected
beginMoveDrag
updateMoveDrag
commitMoveDrag
beginRotationDrag
updateRotationDrag
commitRotationDrag
cancelTransformDrag
cancelInteraction
removeSelected
onSelectedHoldStateChange
```

Esiti minimi:

```text
applied
blocked
invalid-target
not-available
previewing
committed
cancelled
invalid-endpoint
surface-limit
```

`SceneActionResult.reason` distingue `wall-collision`, `hold-collision`, `no-surface`, `surface-gap`, `normal-limit`, `no-change` e `path-unresolved`, ed e assente quando non applicabile. Un arresto irrisolto o una posa selezionata come `uncertain` produce `path-unresolved`, non una collisione accertata. Come descritto in §7.3, una violazione confermata prevale sull'incertezza di un altro collider e viene restituita con `uncertain = false`, quindi conserva il feedback di collisione. Lo snapshot diagnostico read-only `window.__ROUTE_SETTER_SCENE__` espone `lastActionResult.reason` e `lastPoseDiagnostic` (posizione, quaternion, blocker, penetrazione e tolleranza in metri, handle collider, booleano `uncertain`), con campi coerenti con lo stesso contatto selezionato. Quest'ultimo descrive l'ultima `validatePose`, non necessariamente l'ultima azione o gli intervalli del percorso: puo essere nullo o precedente a un no-op. Nessun log persistente o invio di rete per frame; non e un sistema globale di gestione errori.

### 8.3 Pointer Events

- usare esclusivamente Pointer Events per popup/gizmo;
- drag con `setPointerCapture`;
- cleanup su `pointerup`, `pointercancel`, `lostpointercapture`, blur, cambio selezione, rimozione, `Escape`;
- in targeting il click sinistro non deve avviare OrbitControls;
- in modalita `moving`, un pointerdown sinistro sulla mesh della hold selezionata puo avviare il drag libero dopo 4 px; non deve cambiare selezione ne orbitare la camera;
- tasto destro e rotella mantengono navigazione camera;
- durante drag di un handle OrbitControls, zoom e pan sono completamente disabilitati;
- il valore precedente di `controls.enabled` viene memorizzato e ripristinato su ogni uscita;
- la camera resta immutata per tutta la sessione, cosi coordinate e candidato non cambiano durante il drag.

### 8.4 Posizionamento popup e gizmo

Usare il bounding box world della hold proiettato nella camera per ottenere il rettangolo CSS. Aggiornare su camera change, resize, selezione e trasformazione. Se il bounding box e interamente dietro la camera o fuori viewport, nascondere popup e gizmo; se e parzialmente visibile, clamp del popup ai bordi della viewport. Il popup usa dimensioni compatte, fondo scuro semitrasparente e blur moderato, evitando un pannello opaco che copra la scena. Anche gli handle circolari usano diametro ridotto, fondo giallo semitrasparente, bordo sottile e ombra attenuata.

L'azione `Dettagli` risolve dal manifest gia memorizzato la hold selezionata e richiama la stessa istanza `HoldDetailsModal` usata dalle card catalogo. Il GLB viene caricato solo all'apertura e renderer, controlli e risorse vengono rilasciati alla chiusura.

Le shadow di targeting, movimento e rotazione appartengono allo stesso gruppo Three.js `previewGroup` dedicato. Il gruppo viene escluso dal raycast di selezione e reso invisibile durante export. La shadow targeting usa materiale giallo, passa temporaneamente al rosso dopo un tentativo invalido e torna gialla al movimento successivo o dopo 500 ms.

### 8.5 Scope input

La UX 9UX e desktop mouse. Touch targeting e gesture gizmo non sono implementati. `Tab`, `Enter`, `Space` restano disponibili sui pulsanti del popup, ma non sugli handle che trasformano la hold; non esistono listener globali di trasformazione hold.

## 9. Export immagine

- clonare la camera prospettica interattiva corrente;
- mantenere posizione, orientamento, FOV, zoom e rapporto d'aspetto della viewport;
- renderizzare esclusivamente la scena 3D;
- escludere tutti gli elementi DOM dell'interfaccia;
- mantenere lo sfondo corrente della scena;
- export JPG con lato lungo 2560 px, lato corto proporzionale, qualita 0.90;
- non modificare lo stato della camera o della scena interattiva.
- nascondere `previewGroup` e tutti gli indicatori drag prima del render temporaneo e ripristinarli nel `finally`;
- disabilitare il comando `Genera immagine` durante una sessione drag attiva; non annullare automaticamente il drag per avviare l'export.

## 10. Error handling e logging

I contratti seguenti restano richiesti; le limitazioni di copertura, logging e diagnostica sono eccezioni di release accettate in `DEC-029`, descritte in [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md). La presenza dei componenti non e garanzia universale di intercettazione, recupero o persistenza.

### 10.1 Errori frontend e boundary

`errors/AppError.ts` contiene `AppError`, `toAppError` e validazione della correlazione. Solo un `AppError` creato dal codice applicativo conserva il messaggio pubblico; gli errori sconosciuti non vengono letti tramite `message`, `stack`, `cause` o proprieta custom. Messaggio e contesto sono limitati/sanitizzati; il contesto frontend ammette soltanto `operation`, `resource`, `status`, `errorClass`, `event`, inclusi nell'allowlist backend descritta sotto.

Il modulo HTTP e `source/frontend/src/api/http.ts`. `fetchJson`, `fetchBytes` e `fetchBlob` normalizzano rete, HTTP e lettura della risposta; una risposta remota anche formalmente JSON non rende affidabile il suo `message`. La UI usa il messaggio locale e conserva soltanto `errorId`/`requestId` validati, con fallback dell'ID richiesta dall'header. Gli schemi applicativi richiedono validazione del chiamante: gli helper generici non certificano qualsiasi DTO.

`main.ts` installa `ErrorReporter` e collega catch di bootstrap, catalogo, caricamento hold/dettagli ed export. `wallScene.ts` usa `guarded` per callback canvas, render, camera e resize: su guasto interrompe il flusso compromesso, tenta cleanup e notifica in sicurezza, non promette recupero completo della scena. Listener globali `error` (capture) e `unhandledrejection` coprono errori sfuggiti ai catch senza `preventDefault`; errori sincroni/asincroni della callback di notifica sono contenuti per evitare ricorsione. `REQ-ERR-004` continua a richiedere categorie JS, REST/HTTP, model load/parsing, Three.js, Rapier, export e UI: la loro presenza nel tipo `ErrorCategory` non prova copertura o classificazione esaustiva, e alcuni percorsi restano `Unknown`.

### 10.2 Reporter bounded

`ERROR_REPORTER_DEFAULTS`: coda `20` eventi (incluso quello in invio), deduplica `100` chiavi con scadenza `30 s`, throttle `1 s`, massimo `3` tentativi totali, retry base `1 s`, tetto `8 s`, timeout `5 s`. La chiave e il DTO serializzato, inclusa la correlazione; chiavi scadute rimosse quando arriva una segnalazione e, a capacita, rimossa la piu vecchia. Overflow scarta il nuovo evento senza bloccare la UI. Le opzioni possono ridurre questi limiti, non ampliarli.

Una sola POST `/api/logs` per volta, senza usare gli helper HTTP applicativi: nessun fallimento del trasporto viene riportato ricorsivamente. Retry su rete/timeout, `408`, `429`, `5xx`; altri rifiuti terminano l'evento. Backoff esponenziale limitato a `8 s` (con i default tre tentativi, le due attese di retry sono `1 s` e `2 s`), mai inferiore al throttle. Dopo esaurimento tentativi si scarta e si procede; `dispose` rimuove listener, cancella timer, abortisce la richiesta e svuota coda/cache. Ricevuta `202` non sostituisce gli ID originali nel frontend. Coda volatile senza storage, nessuna garanzia di consegna o invio per frame; blocchi fisici attesi restano feedback locali.

### 10.3 API sicure e ricevuta log

`Middleware/ApiErrors.cs` crea una sola correlazione per richiesta fallita e registra lo stesso ErrorId con RequestId, categoria e componente. `SafeErrorResultFilter`, status-code pages in `Program.cs` ed `ExceptionHandlingMiddleware` normalizzano binding/validazione MVC, risultati falliti, route/risorse mancanti, metodi/media type non supportati, richieste troppo grandi ed eccezioni propagate. JSON `{ errorId, requestId, message }`, status HTTP separato e `X-Request-Id`; `SafeErrorOperationFilter` documenta lo schema in OpenAPI. Le risposte gia iniziate vengono interrotte dopo logging, non riscritte; cancellazione client non tradotta in `500`; proxy/trasporto prima della pipeline restano fuori da questa garanzia applicativa.

HTTP `416` viene normalizzato dopo il file result e prima che la risposta inizi: eliminati tipo/lunghezza asset e Content-Disposition, preservato `Content-Range: bytes */<lunghezza>`, scritto ErrorResponse con lo stesso ErrorId registrato. HTTP `206` resta binario. `UseSerilogRequestLogging` riceve il logger Serilog dell'host via DI, senza dipendere dal logger statico; correlazione e log persistiti sono coperti dai test di contratto.

`POST /api/logs` accetta `FrontendLogRequest`: `level`, `category`, `component`, `message` obbligatori. Livelli `Trace`, `Debug`, `Information`, `Warning`, `Error`, `Critical`; `None` e valori non definiti rifiutati. Categoria/componente `1..80` caratteri, messaggio `1..2000`; opzionali ErrorId GUID (formati N/D verificati), RequestId `1..128` caratteri ASCII alfanumerici o `._:-`, contesto stringa/stringa fino a `20` voci, chiavi <=`80`, valori <=`500`, niente valori JSON annidati. Body massimo `32768` byte: controllo Content-Length prima del binding e limite MVC per Kestrel.

`FrontendLogService.Write` restituisce HTTP `202` con esattamente `{ errorId: string|null, requestId: string }`: Error/Critical preservano l'ID fornito o ne generano uno; gli altri livelli restituiscono `null`. RequestId e quello originale fornito oppure quello di ingestione; `X-Request-Id` e proprieta log `IngestionRequestId` identificano la POST corrente. L'accettazione e best-effort, non ack di persistenza: filtri, overflow e guasti I/O possono impedire la registrazione. Il reporter frontend invia attualmente solo livello `Error`.

### 10.4 Pipeline server e retention

`ServerLoggingConfiguration` legge `Logging:LogLevel`, default `Information`, con livelli .NET `Trace..None`. Override arbitrari di categoria, prefisso piu lungo prioritario su `Category` o fallback `SourceContext`; `None` disabilita il logging, non e un evento. `SafeJsonLogFormatter` rende i livelli Serilog `Verbose`/`Fatal` come `Trace`/`Critical`, sanitizza ricorsivamente proprieta prima di renderizzare il messaggio e limita dimensione/profondita. I log conservano dettaglio diagnostico sanitizzato e limitato, non una copia integrale illimitata di qualsiasi eccezione.

Contesto browser: `FrontendLogService` preserva solo valori diagnostici delle chiavi `operation`, `assetId`, `holdId`, `status`, `statusCode`, `errorType`, `retryCount`, `phase`, `resource`, `errorClass`, `event`, sanitizzandoli; chiavi sensibili o sconosciute hanno valore oscurato. L'estensione alle tre chiavi frontend ha regressioni dedicate e non consente payload grezzi. Pattern sensibili, credenziali e dati personali riconoscibili vengono oscurati, ma nessuna euristica garantisce di riconoscere ogni dato personale arbitrario non etichettato: obbligo dei chiamanti inviare solo sintesi diagnostiche.

`BoundedAsyncSink` usa Channel bounded `DropWrite`, default `Logging:QueueCapacity = 2048`, un consumer background e drain in shutdown. Nessuna attesa I/O sul produttore; scrittura file e retention nel consumer. `LogFileRetention` seleziona soltanto il pattern rolling configurato e cancella file con `LastWriteTimeUtc < utcNow - RetentionDays` (default `7`), non i file eccedenti un conteggio. Sweep iniziale e al primo ciclo dopo cambio data UTC, incluso timer idle di un minuto; batch limitati evitano che carico continuo affami la manutenzione. File estranei preservati, errori filesystem best-effort via SelfLog. Nessuna promessa di cancellazione riuscita con ACL/I/O impeditivi o di retention istantanea a mezzanotte.

La guida italiana [backend-contracts.md](../docs/backend-contracts.md) documenta i contratti backend. I gate documentali e di tracciabilita sono strutturali, non certificazioni semantiche.

## 11. Benchmark prestazionale

Metodo vincolante:
- scena con 40 hold + parete;
- viewport 1920x1080;
- test 60 secondi con sequenza interazioni ripetibile;
- target pass: mediana FPS >= 30;
- risultato documentato nei report test/performance.

Il runner corrente usa build frontend di produzione e profili split-phase: rendering sintetico e input mouse ripetibile separati, con `8` hold nel profilo tipico e `40` nel complesso. Gli ID riutilizzano due modelli reali, ma creano istanze, corpi e collider distinti. Long Tasks API e heartbeat misurano le fasi; solver e dispatch pointerup sono tempi distinti, non completamento GPU/paint. Il profilo nominale mantiene almeno `60 s` per fase e viewport `1920x1080`.

Per v0.0.1 le limitazioni del metodo e delle misure sono eccezioni di release accettate (`DEC-029`), non blocchi di chiusura. Esiti, snapshot, hardware e limiti di copertura sono riportati soltanto in [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md); nessuna ricertificazione del sorgente o dei FPS continui durante input e implicita nell'accettazione.

## 12. Gestione versioni dipendenze

- npm: usare versioni esatte e lockfile versionato.
- NuGet: usare versioni esatte espresse come intervalli chiusi (esempio: `[1.1.19.504]`) e lock file ripristino deterministico versionato.
- vietate versioni floating nei package applicativi.
- CI deve ripristinare da lock e fallire in caso di drift non intenzionale.

Versioni iniziali da adottare (vincolanti) come baseline:
- Frontend runtime: `three@0.161.0`, `@dimforge/rapier3d-compat@0.12.0`.
- Frontend build/tooling: `vite@5.2.0`, `typescript@5.4.5`.
- Frontend test: `vitest@1.6.0`, `@playwright/test@1.44.0`.
- Backend/runtime: `Serilog.AspNetCore@8.0.1`, `Serilog.Sinks.File@5.0.0`, `SharpGLTF.Core@1.0.0`, `MIConvexHull@1.1.19.504`.
- Backend test: `xunit@2.7.1`, `Microsoft.AspNetCore.Mvc.Testing@8.0.5`.
- Framework target: `.NET 8` LTS; SDK `8.0.424`.
- Toolchain frontend: `Node.js 22.18.0` LTS con `npm 10.9.3`.

Regola aggiornamenti:
- aggiornamenti ammessi solo tramite PR dedicata;
- obbligo di suite test completa verde prima del merge;
- aggiornamento lockfile e nota di compatibilita in documentazione tecnica.
