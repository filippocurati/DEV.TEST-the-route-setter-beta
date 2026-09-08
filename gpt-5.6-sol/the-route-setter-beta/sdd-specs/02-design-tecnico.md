# Design tecnico
## Applicazione per tracciatura vie climbing indoor

Questo documento descrive come realizzare i requisiti di `01-specifica-requisiti.md`.

## 1. Architettura

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

## 3. Struttura cartelle proposta

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
- `GET /api/holds/{id}/model`
- `GET /api/holds/{id}/collider`
- `POST /api/logs`

E consentito aggiungere endpoint ulteriori se necessari, senza alterare i vincoli dei requisiti.

Manifest hold: deve includere almeno id, previewUrl, modelUrl, colliderUrl e stato disponibilita collider.

## 5. Convex Hull backend

Flusso:
1. scansione cartelle `holds/Hold<number>` (es. `Hold1`, `Hold2`);
2. lettura GLB con SharpGLTF;
3. calcolo hull con MIConvexHull (.NET), indipendente da Rapier;
4. serializzazione `collider.json`:

```json
{
  "sourceHash": "sha256:...",
  "vertices": [0.0, 0.0, 0.0],
  "indices": [0, 1, 2]
}
```

5. invalidazione su hash;
6. generazione in background non bloccante;
7. hold esposte come utilizzabili quando collider pronto.

## 6. Fisica frontend

- mondo Rapier con gravita zero;
- parete: TriMesh statico client-side;
- hold: collider Convex Hull da backend;
- movimento cinematico: `KinematicCharacterController`, shape-cast e contact query Rapier secondo il tipo di trasformazione;
- no autostep/snap-to-ground.

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

Limiti noti di Rapier `0.12.0`: la profondita per faccia vicino alle giunzioni interne dei triangoli puo essere sottostimata anche con conferma di intersezione; il contenimento completo dentro un TriMesh chiuso senza intersezione superficiale non viene rilevato. Queste query non costituiscono una certificazione generale per geometrie arbitrarie degeneri o volumi solidi (`DEC-025`). La configurazione (`DEC-026`) non garantisce tutte le superfici o la compensazione di tutte le imperfezioni fotografiche/fotogrammetriche.

#### Configurazione runtime delle tolleranze

Il file sorgente `source/frontend/public/physics-config.json` contiene inizialmente:

```json
{
  "wallPenetrationToleranceMm": 5
}
```

`src/config/physicsConfig.ts` valida un oggetto con questa sola chiave e numero finito in `1..10`, estremi inclusi, senza arrotondare i decimali (esempio `7.5`). JSON stretto: valore senza virgolette, punto decimale, niente commenti o chiavi aggiuntive. La soglia hold non e configurabile. Il bootstrap in `main.ts` attende una sola `loadPhysicsConfig()` con fetch di `${import.meta.env.BASE_URL}physics-config.json` e `cache: 'no-store'`, quindi passa il valore immutabile a `createWallScene` e `PhysicsWorld`. Non e un import compilato ne una chiamata backend o per frame. I default disponibili per costruzioni dirette/test non sono un fallback del bootstrap browser.

HTTP non riuscito, rete, parsing o validazione falliti impediscono la creazione della scena e mostrano un errore gestito nella pagina, senza dettagli grezzi e senza `pageerror` non gestiti. Non avviare con default silenzioso. Il perimetro e questo errore di configurazione, non una revisione generale del backend o della gestione globale errori.

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

Al pointerup viene validata esclusivamente `candidatePose`. Non viene verificato il percorso e non viene cercato un prefisso valido. Endpoint valido: un solo commit atomico di corpo, mesh, contact point, feature, normale e twist ricalcolato rispetto alla nuova normale. Endpoint invalido: rollback totale implicito, perche la posa reale non e mai stata modificata.

### 7.7 Drag transazionale rotazione

Il centro visuale e la proiezione del punto di contatto, non il centro del bounding box. La sessione conserva posa e twist iniziali. Il delta firmato del pointer viene calcolato con `atan2`, normalizzato attraversando `-pi/+pi` e applicato sempre rispetto allo snapshot iniziale. Il twist candidato e quantizzato a 1 grado.

Poiche nelle coordinate CSS l'asse Y cresce verso il basso, il segno del delta visuale deve essere invertito rispetto alla convenzione matematica standard, in modo che il punto della hold vicino alla freccia selezionata segua il verso del mouse.

Durante pointermove vengono aggiornati soltanto shadow e arco/linea gialla; non avvengono raycast o collision query. La shadow usa `orientationFromNormal(currentNormal, candidateTwist)`.

Al pointerup viene validata esclusivamente la posa endpoint. Endpoint valido: commit atomico della rotazione e del twist. Endpoint invalido: rollback totale. Non vengono controllati angoli intermedi.

### 7.8 Shadow 3D runtime

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

I click incrementali di movimento e rotazione mantengono la semantica precedente: validazione continua e arresto all'ultima posa valida. I drag hanno invece semantica endpoint-only e rollback totale. Lo sgancio editoriale verifica separatamente ogni posa finale candidata.

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

Il completamento/revisione della gestione globale errori e gli interventi su backend/catalogo restano differiti rispetto al primo gruppo fisica/diagnostica (`DEC-025`). Le prescrizioni seguenti restano requisiti, non attestazioni di completamento del gruppo.

- middleware backend centralizzato con ErrorId;
- frontend intercetta categorie minime richieste e notifica backend quando possibile;
- Serilog JSON, livello minimo da `appsettings.json` (default `Information`), rotazione giornaliera, retention 7 giorni, sanitizzazione.

## 11. Benchmark prestazionale

Metodo vincolante:
- scena con 40 hold + parete;
- viewport 1920x1080;
- test 60 secondi con sequenza interazioni ripetibile;
- target pass: mediana FPS >= 30;
- risultato documentato nei report test/performance.

Il benchmark usa una build frontend di produzione e Chromium headed con `deviceScaleFactor=1`. I 40 identificatori della fixture riutilizzano gli asset reali disponibili, ma ciascuno crea una distinta istanza Three.js, un rigid body e un collider. Gli FPS sono calcolati sui render Three.js effettivi in finestre da un secondo. Long Tasks API e heartbeat misurano separatamente caricamento e interazione; il gate di blocco e nessun long task oltre 200 ms. La latenza endpoint include validazione e commit della transazione. Il risultato JSON registra anche canvas, renderer WebGL e profilo hardware.

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
