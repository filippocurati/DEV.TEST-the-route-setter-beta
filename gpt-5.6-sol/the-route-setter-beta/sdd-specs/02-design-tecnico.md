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

Ogni cambio modalita interrompe timer, drag e pointer capture della modalita precedente. `Escape` torna a `idle` senza deselezionare la hold. Il cambio selezione termina la modalita attiva e apre il popup per la nuova selezione.

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

### 7.1 Target pointer e overlay

Il target e un elemento DOM/SVG nel contenitore viewport, non un oggetto Three.js.

Dimensionamento:

1. ricavare il footprint locale della base dai vertici del Convex Hull nella fascia `localZ <= minZ + max(0.002 m, 2% della profondita)`;
2. se la fascia non contiene almeno tre vertici non collineari, usare come fallback l'estensione XY completa del Convex Hull;
3. proiettarne la dimensione nella camera corrente alla profondita del punto centrale colpito;
4. usare il diametro maggiore proiettato;
5. clamp fra `48 px` e `160 px`.

Durante `pointermove`:

- accumulare l'ultimo evento;
- aggiornare al massimo una volta per `requestAnimationFrame`;
- usare un solo ray Rapier camera-verso-TriMesh per posizione e visibilita del cerchio;
- non eseguire validazione completa della posa.

Al click eseguire i 37 campioni definiti da `REQ-UX-004`. I campioni sono espressi in coordinate normalizzate del cerchio e trasformati in coordinate canvas prima di costruire i ray camera.

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
6. aggiornare la normale rappresentativa tramite media normalizzata dei campioni del gruppo;
7. scegliere il gruppo con il maggior numero di campioni, tutti a peso unitario;
8. definire per ogni gruppo `distance = minima distanza camera dei membri` e `stableId = minimo ID dei membri`;
9. applicare i tie-break `contiene campione centrale -> distance minore -> stableId minore`.

L'assenza di una soglia minima e intenzionale: i campioni mancanti non votano contro i campioni che colpiscono la parete. Nel gruppo vincente il punto candidato e il membro a distanza schermo minima dal centro del cerchio; in parita prevale l'indice campione minore.

### 7.3 Commit diretto

Il commit costruisce:

```text
position = punto candidato
rotation = align(local +Z, normal) + twist
```

La trasformazione detached-target e un teletrasporto editoriale: il percorso non viene interrogato. La posa finale viene validata mediante il Convex Hull contro il TriMesh parete e tutti i collider hold. Il contatto e valido e la penetrazione massima tollerata e `0.001 m`, centralizzata. Una posa valida viene applicata atomicamente; una posa invalida non modifica corpo, mesh o stato.

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

Per ogni passo:

1. proiettare l'asse vista sulla tangente di `currentNormal`;
2. calcolare il candidato di `0.01 m`;
3. riproiettare localmente sulla parete;
4. stabilizzare la normale candidata;
5. verificare `angle(candidateNormal, attachmentNormal) <= 5 gradi`;
6. verificare il percorso del Convex Hull e la posa finale;
7. applicare la massima frazione valida o arrestare il passo.

Il confronto con `attachmentNormal`, non con la sola normale del passo precedente, impedisce di attraversare gradualmente un cambio di inclinazione accumulando piccole variazioni. La normale corrente puo invece variare entro soglia per seguire una curva senza distacco.

### 7.6 Rotazione e trasformazioni continue

Le rotazioni sono quantizzate a `1 grado`. Ogni incremento viene verificato prima dell'applicazione. Per traslazioni e rotazioni devono essere controllate pose intermedie o query sweep equivalenti; la sola validita dell'endpoint non e sufficiente. Lo sgancio editoriale verifica invece separatamente ogni posa finale candidata. In caso di blocco si mantiene l'ultima posa valida.

Il drag di rotazione calcola l'angolo firmato del pointer attorno al centro proiettato della hold usando `atan2`. Il delta viene normalizzato nell'intervallo `[-pi, +pi]`, accumulato e convertito in passi interi di 1 grado; il residuo inferiore a 1 grado resta accumulato fino ai movimenti successivi.

### 7.7 Degeneri

- normale non finita o quasi nulla: target non valido;
- nessun hit: target nascosto/non valido;
- parita di gruppi: tie-break definito in §7.2;
- proiezione tangenziale degenere: fallback deterministico su asse vista alternativo;
- nessuna posa valida nello sgancio: hold ancora attached e feedback utente;
- il retro non e classificato: un tentativo intenzionale sul retro e fuori ambito, ma la geometria resta collidente.

## 8. Movimento e input

### 8.1 Componenti UI

- `HoldContextMenu`: popup e stato abilitazione azioni;
- `WallTargetOverlay`: cerchio, stato giallo/rosso e hint `Escape`;
- `HoldMoveHandles`: quattro frecce e pressione continua;
- `HoldRotationHandles`: frecce circolari e drag;
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
```

### 8.3 Pointer Events

- usare esclusivamente Pointer Events per popup/gizmo;
- drag con `setPointerCapture`;
- cleanup su `pointerup`, `pointercancel`, `lostpointercapture`, blur, cambio selezione, rimozione, `Escape`;
- in targeting il click sinistro non deve avviare OrbitControls;
- tasto destro e rotella mantengono navigazione camera;
- durante drag di un handle OrbitControls viene temporaneamente disabilitato.

### 8.4 Posizionamento popup e gizmo

Usare il bounding box world della hold proiettato nella camera per ottenere il rettangolo CSS. Aggiornare su camera change, resize, selezione e trasformazione. Se il bounding box e interamente dietro la camera o fuori viewport, nascondere popup e gizmo; se e parzialmente visibile, clamp del popup ai bordi della viewport.

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

## 10. Error handling e logging

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
