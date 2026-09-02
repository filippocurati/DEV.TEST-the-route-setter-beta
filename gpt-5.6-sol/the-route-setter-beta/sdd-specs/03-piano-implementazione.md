# Piano di implementazione
## Applicazione per tracciatura vie climbing indoor

## Come usare questo piano (istruzioni operative per agente AI)

1. Leggere integralmente, prima di iniziare, `app_definition.md`, `sdd-specs/00-costituzione.md`, `sdd-specs/01-specifica-requisiti.md`, `sdd-specs/02-design-tecnico.md`, `sdd-specs/04-tracciabilita.md`, `sdd-specs/05-open-decisions-guidate.md`.
2. Implementare una sola fase per volta, nell'ordine indicato.
3. Per ogni fase, rispettare obbligatoriamente:
   - requisiti `REQ-*` associati;
   - principi costituzionali `C*`;
   - vincoli tecnici indicati nel design.
4. Non passare alla fase successiva finche la Definition of Done non e completa.
5. Ogni fase deve produrre evidenze: file modificati, test eseguiti, risultati, check manuali ripetibili.
6. Se emerge un punto OPEN, applicare solo le regole di `05-open-decisions-guidate.md` e documentare la scelta.

### Congelamento baseline 0-9

Le fasi 0-9 e i relativi report sono congelati e descrivono la baseline storica gia completata. Non devono essere riscritti retroattivamente. Dalla fase 9UX in avanti prevalgono i requisiti e il design aggiornati per l'interazione contestuale. In particolare non sono piu normativi snap automatico per prossimita, avanti/indietro, shortcut globali, pannello comandi fisso e `Rimuovi presa` nella topbar.

---

## Dipendenze tra fasi

```text
FASE 0 (Setup)
   |
   +--> FASE 1 (Backend: asset discovery + API baseline)
   |
   +--> FASE 2 (Backend: Convex Hull)
   |
   +--> FASE 3 (Backend: error handling + logging)
               |
               v
         FASE 4 (Frontend: scena base)
               |
               v
         FASE 5 (Frontend: Rapier foundation)
               |
               v
         FASE 6 (Frontend: catalogo + lazy load + istanze)
               |
               v
         FASE 7 (Frontend: selezione/rimozione/comandi)
               |
               v
         FASE 8 (Frontend: snap + degeneri)
               |
               v
         FASE 9 (Frontend: export immagine)
                |
                v
         FASE 9UX (UX contestuale + targeting)
                |
                v
         FASE 10 (Test completo)
               |
               v
         FASE 11 (Performance)
               |
               v
         FASE 12 (Documentazione)
```

Nota: FASE 1 e FASE 2 possono procedere in parallelo dopo FASE 0, ma entrambe devono essere complete prima delle fasi frontend che dipendono da API/collider.
Nota: la FASE 9UX parte dalla baseline congelata della FASE 9 e deve essere completata prima della FASE 10.

---

## FASE 0 - Setup soluzione e baseline dipendenze

### Obiettivo
Preparare soluzione backend/frontend/test conforme allo stack vincolato.

### Requisiti SDD coperti
- `REQ-ARC-001`, `REQ-ARC-002`
- `REQ-DEP-001`, `REQ-DEP-002`, `REQ-DEP-003`, `REQ-DEP-004`
- Tracciabilita: `04-tracciabilita.md` righe REQ-ARC e REQ-DEP.

### Vincoli e specifiche da garantire
- Stack vincolato (`C13`): ASP.NET Core Web API, TypeScript+Vite, SharpGLTF, MIConvexHull, Serilog.
- Policy dipendenze (`C15`): pinning esatto e lockfile obbligatori.
- Solo versioni stabili, niente prerelease.

### Task implementativi
- scaffold backend con Swagger;
- scaffold frontend con Vite + TypeScript;
- setup progetti test backend, test fisica headless, Playwright;
- applicare baseline versioni `REQ-DEP-004`;
- versionare lockfile npm/NuGet;
- predisporre struttura dati `main-wall`, `holds/Hold<number>`.

### Test da eseguire
- build backend;
- build frontend;
- restore deterministico da lockfile;
- smoke test esecuzione suite skeleton.

### Definition of Done
- backend e frontend compilano e si avviano;
- Swagger raggiungibile;
- lockfile presenti e coerenti con dipendenze installate;
- nessuna dipendenza prerelease;
- naming cartelle hold conforme (`Hold1`, `Hold2`, ...).

---

## FASE 1 - Backend asset discovery e API baseline

### Obiettivo
Esporre discovery asset e API minime per parete/catalogo/modello/collider/log frontend.

### Requisiti SDD coperti
- `REQ-MOD-001..004`
- `REQ-CAT-003`, `REQ-CAT-004`
- `REQ-SCN-004`
- `REQ-ARC-002`
- `REQ-LOG-002` (solo endpoint base)

### Vincoli e specifiche da garantire
- API baseline obbligatoria:
  - `GET /api/wall`
  - `GET /api/holds`
  - `GET /api/holds/{id}/model`
  - `GET /api/holds/{id}/collider`
  - `POST /api/logs`
- Catalogo senza download preventivo di tutti i GLB.
- Cartelle hold solo in formato `Hold<number>`.

### Task implementativi
- discovery di `main-wall` e `holds/Hold<number>`;
- rilevazione GLB, PREV_, collider e asset opzionali;
- DTO manifest hold con almeno id/previewUrl/modelUrl/colliderUrl/stato collider;
- serving static file;
- documentazione endpoint in OpenAPI.

### Test da eseguire
- unit test discovery/cartelle;
- integration test endpoint baseline (status/shape/consistenza URL);
- test robustezza hold senza texture.

### Definition of Done
- frontend puo popolare il catalogo senza caricare tutti i GLB;
- endpoint baseline operativi e documentati;
- discovery non fallisce per file opzionali mancanti.

---

## FASE 2 - Backend Convex Hull (SharpGLTF + MIConvexHull)

### Obiettivo
Generare e mantenere collider hold pre-calcolati lato backend.

### Requisiti SDD coperti
- `REQ-HUL-001..007`
- `REQ-TST-003`

### Vincoli e specifiche da garantire
- parsing GLB con SharpGLTF;
- calcolo hull con MIConvexHull;
- formato `collider.json` conforme (`sourceHash`, `vertices`, `indices` opzionale);
- invalidazione solo su hash;
- generazione asincrona non bloccante.

### Task implementativi
- estrazione vertici GLB;
- generazione inviluppo convesso;
- serializzazione schema collider;
- confronto hash e logica riuso/rigenerazione;
- background worker di generazione;
- aggiornamento stato disponibilita collider nel manifest.

### Test da eseguire
- `REQ-TST-003`: mancante->generato, coerente->riuso, GLB modificato->rigenerato;
- test schema `collider.json`;
- test non-bloccante avvio backend con backlog collider.

### Definition of Done
- comportamento hash/invalidazione corretto e coperto da test;
- `collider.json` sempre conforme allo schema;
- CI fallisce se i test hull non passano (`REQ-HUL-007`).

---

## FASE 3 - Backend error handling e logging

### Obiettivo
Chiudere gestione errori backend e logging centralizzato server-side.

### Requisiti SDD coperti
- `REQ-ERR-001..003`
- `REQ-LOG-001..007`
- `REQ-TST-002` (parte backend logging/errori)

### Vincoli e specifiche da garantire
- error contract con ErrorId, senza dettagli tecnici al client;
- Serilog JSON;
- livello minimo da `appsettings.json` (default Information);
- rotazione giornaliera, retention 7 giorni;
- sanitizzazione dati sensibili;
- logging asincrono/non bloccante.

### Task implementativi
- middleware globale eccezioni;
- correlazione ErrorId/RequestId;
- pipeline Serilog con policy sanitizzazione;
- completamento semantico `POST /api/logs`.

### Test da eseguire
- unit test middleware errori;
- unit/integration test logging (struttura JSON, livello, retention, sanitizzazione);
- test endpoint log frontend.

### Definition of Done
- un errore backend produce risposta utente sicura e log tecnico correlabile;
- assenza stack trace/path/config in risposta client;
- log campione senza dati sensibili.

---

## FASE 4 - Frontend scena base (three.js + parete)

### Obiettivo
Visualizzare la parete e abilitare navigazione camera.

### Requisiti SDD coperti
- `REQ-SCN-004`
- `REQ-UI-003`
- `REQ-FIS-001`
- `REQ-FIS-013` (parte parete collider)

### Vincoli e specifiche da garantire
- OrbitControls con target parete;
- loading parete automatico da API;
- TriMesh parete lato client.

### Task implementativi
- bootstrap scena, renderer, camera;
- integrazione OrbitControls;
- caricamento parete e creazione TriMesh.

### Test da eseguire
- E2E startup e presenza parete;
- test interazione camera (orbit/zoom/pan).

### Definition of Done
- parete visibile all'avvio;
- camera navigabile senza perdere riferimento parete;
- collider TriMesh parete creato correttamente.

---

## FASE 5 - Frontend Rapier foundation

### Obiettivo
Inizializzare motore fisico e sincronizzazione fisica/rendering.

### Requisiti SDD coperti
- `REQ-ARC-004`, `REQ-ARC-008`
- `REQ-FIS-002`, `REQ-FIS-003`, `REQ-FIS-004`, `REQ-FIS-012`

### Vincoli e specifiche da garantire
- Rapier solo client-side;
- gravita zero;
- separazione mesh/collider;
- nessuna chiamata REST nel loop fisico.

### Task implementativi
- init WASM Rapier;
- world setup fisico;
- setup KinematicCharacterController base;
- sincronizzazione trasformazioni collider->mesh.

### Test da eseguire
- physics smoke tests headless;
- controllo assenza traffico REST in loop continuo.

### Definition of Done
- fondazione fisica operativa;
- zero dipendenze rete durante update continui di movimento.

---

## FASE 6 - Catalogo, lazy-load e istanze

### Obiettivo
Implementare ciclo di vita catalogo/scena con lazy loading.

### Requisiti SDD coperti
- `REQ-CAT-001..007`
- `REQ-SCN-001`, `REQ-SCN-005`
- `REQ-UI-001`, `REQ-UI-002`

### Vincoli e specifiche da garantire
- catalogo a sinistra con `PREV_`, `Utilizza`, `Dettagli`;
- cache di manifest+preview per sessione;
- GLB caricato solo on-demand;
- separazione modello/istanza;
- unicita uso hold;
- spawn iniziale hold in stato pre-snap tramite ricerca deterministica:
  primo candidato frontale centrale con offset `2.0 m`;
  fallback su griglia frontale con passo `0.30 m`;
  selezione del primo candidato non compenetrante.

### Task implementativi
- UI catalogo e card;
- modale dettagli con rilascio risorse;
- flusso utilizzo/rientro catalogo;
- stato selezione e disponibilita hold;
- posizionamento iniziale coerente della hold in scena (ricerca candidato libero su piano frontale con ordine deterministico).

### Test da eseguire
- E2E catalogo/use/details/remove;
- test cache sessione;
- test no eager-load GLB;
- test spawn iniziale hold: primo candidato centrale a `2.0 m` quando libero;
- test fallback su griglia frontale con passo `0.30 m` e ordine deterministico candidati;
- test spawn multiplo senza compenetrazione;
- test annullamento inserimento solo dopo esaurimento candidati nel dominio (bounding frontale + margine);
- test assenza snap immediato allo spawn.

### Definition of Done
- transizione catalogo<->scena consistente e senza leak evidenti;
- ripristino hold in catalogo dopo rimozione.

---

## FASE 7 - Selezione, rimozione, comandi base

### Obiettivo
Abilitare selezione hold e comandi input principali.

### Requisiti SDD coperti
- `REQ-SCN-002`, `REQ-SCN-003`
- `REQ-FIS-009`, `REQ-FIS-010`, `REQ-FIS-015`
- `REQ-UI-004`

### Vincoli e specifiche da garantire
- click seleziona una sola hold attiva;
- rimozione elimina istanza e spazio fisico;
- 1 grado/click, 1 cm/click + continuo a pressione;
- comandi avanti/indietro in pre-snap lungo normale locale parete;
- shortcut coerenti/documentate (`SHIFT+Freccia Su` avanti, `SHIFT+Freccia Giu` indietro);
- rispetto vincoli anti-collisione/anti-compenetrazione anche su avanti/indietro.

### Task implementativi
- raycast selezione;
- comando rimozione;
- controlli bottoni+tastiera;
- gestione pressione continua;
- integrazione comando avanti/indietro pre-snap lungo normale locale.

### Test da eseguire
- E2E selezione/rimozione;
- input tests click singolo e pressione continua;
- test equivalenza UI/tastiera;
- test input `SHIFT+Freccia Su/Giu` su pre-snap con anti-compenetrazione.

### Definition of Done
- comandi agiscono solo su hold selezionata;
- rimozione libera spazio e aggiorna catalogo;
- input coerente e documentato, inclusi comandi avanti/indietro pre-snap.

---

## FASE 8 - Snap, post-snap e casi degeneri

### Obiettivo
Implementare snap a 5 cm, orientamento normale e regole deterministiche degeneri.

### Requisiti SDD coperti
- `REQ-FIS-005..011`, `REQ-FIS-014`, `REQ-FIS-015`
- `REQ-TST-008`

### Vincoli e specifiche da garantire
- snap entro 0.05 m, non oltre;
- orientamento su normale del punto di contatto;
- movimento tangenziale post-snap;
- in post-snap: avanti = no-op; indietro = sgancio controllato;
- su sgancio: ripristino orientamento iniziale completo istanza e riposizionamento automatico a `0.25 m` dalla parete lungo normale locale;
- fallback normale deterministico;
- tie-break deterministico su contatti equivalenti;
- annullamento inserimento se nessuna posizione valida non compenetrante.

### Task implementativi
- query contatto pre-snap;
- applicazione orientamento e vincoli post-snap;
- gestione no-op avanti in post-snap e sgancio su indietro;
- ripristino orientamento iniziale completo allo sgancio e offset automatico a `0.25 m`;
- gestione fallback/tie-break;
- messaggistica utente non tecnica su inserimento non valido.

### Test da eseguire
- `REQ-TST-008` completo:
  - no snap > 5 cm;
  - snap <= 5 cm;
  - normale corretta;
  - rotazione post-snap attorno normale;
  - movimento tangenziale;
  - avanti post-snap senza effetti;
  - indietro post-snap con sgancio, ripristino orientamento e offset `0.25 m`;
  - fallback e tie-break deterministici.

### Definition of Done
- snap robusto e ripetibile;
- nessuna ambiguita nei casi degeneri coperti da test.

---

## FASE 9 - Generazione immagine guida

### Obiettivo
Produrre JPG guida conforme alle specifiche.

### Requisiti SDD coperti
- `REQ-IMG-001..004`
- `REQ-UI-002` (integrazione comando)

### Vincoli e specifiche da garantire
- clone della camera prospettica corrente;
- export della sola scena 3D (senza elementi UI) con sfondo corrente della scena;
- lato lungo 2560 px, qualita 0.90;
- scena e camera interattiva non alterate dopo export.

### Task implementativi
- pipeline export;
- acquisizione vista corrente della camera interattiva;
- generazione blob JPG e download.

### Test da eseguire
- E2E export file e validita JPG;
- verifica assenza elementi UI nel risultato;
- test equivalenza tra camera visualizzata ed esportata (posizione/orientamento/zoom/proiezione/aspect).

### Definition of Done
- immagine guida leggibile e proporzionata;
- scena interattiva invariata dopo export.

---

## FASE 9UX - Interazione contestuale e posizionamento diretto

### Obiettivo
Sostituire l'operativita legacy basata su pannello fisso, tastiera, avanti/indietro e snap automatico con popup contestuale, targeting diretto, gizmo mouse e blocco al cambio di superficie.

### Requisiti SDD coperti
- `REQ-SCN-002`, `REQ-SCN-003`, `REQ-SCN-005`
- `REQ-FIS-002`, `REQ-FIS-006..015`
- `REQ-UI-002..004`
- `REQ-UX-001..010`
- `REQ-IMG-002`
- `REQ-TST-010`
- Principi `C16..C21`

### Vincoli e specifiche da garantire
- popup con tutte le azioni e abilitazione per stato;
- modalita `idle`, `attach-targeting`, `moving`, `rotating` mutuamente esclusive;
- aggancio diretto senza validazione del percorso detached-target;
- target giallo/rosso DOM/SVG e campionamento dominante a 37 punti;
- nessuna copertura minima richiesta per il cerchio;
- posa finale di aggancio verificata con Convex Hull;
- sgancio da 0.50 m con incremento 0.10 m fino a 10 m;
- rotazione mouse quantizzata a 1 grado;
- movimento mouse di 1 cm con pressione continua;
- confronto della normale corrente con la normale di aggancio, tolleranza 5 gradi;
- blocco su cambio di superficie, diedro, spigolo o prominenza oltre soglia;
- parete interamente collidente, retro non classificato;
- nessuna shortcut globale di trasformazione;
- overlay esclusi dall'export;
- supporto richiesto solo per mouse desktop.

### Task implementativi
1. Rifattorizzare `WallSceneController` con stato presentazionale e risultati azione espliciti.
2. Estrarre `HoldInteractionController` e macchina a stati.
3. Implementare `HoldContextMenu` con ancoraggio al bounding box proiettato.
4. Implementare `WallTargetOverlay` e aggiornamento una volta per frame.
5. Implementare campionamento a 37 punti, clustering e tie-break superficie dominante.
6. Implementare commit diretto e validazione posa finale.
7. Implementare sgancio progressivo senza fallback allo spawn.
8. Implementare `HoldRotationHandles` con pointer capture e quantizzazione.
9. Implementare `HoldMoveHandles` con pressione continua e surface lock a 5 gradi.
10. Rimuovere pannello fisso, `Rimuovi` dalla topbar, listener e hint delle shortcut legacy.
11. Coordinare OrbitControls con targeting e drag.
12. Escludere popup, target, hint e gizmo dall'export.
13. Aggiornare feedback utente e cleanup di timer/pointer/modalita.
14. Riscrivere unit test ed E2E legacy interessati.

### Test da eseguire
- popup visibile e ancorato dopo selezione;
- azioni abilitate correttamente in detached/attached;
- popup aggiornato dopo orbit, resize e movimento;
- target segue il mouse e usa limiti 48-160 px;
- campionamento dominante su pannello, curva, bordo, centro in foro e parita;
- target invalido rosso, hold invariata, targeting ancora attivo;
- `Escape` annulla targeting/move/rotate e mantiene selezione;
- aggancio diretto su superficie frontale, inclinata e laterale;
- collisione finale parete/hold rifiutata;
- sgancio a 0.50 m, fallback progressivo 0.10 m e fallimento a 10 m;
- click/drag rotazione a 1 grado e blocco collisione;
- click/hold movimento a 1 cm e stop su release/cancel;
- superficie curva entro 5 gradi seguita senza distacco;
- cambio oltre 5 gradi bloccato senza transizione;
- nessuna vecchia shortcut modifica la hold;
- tasto destro/rotella disponibili in targeting, click sinistro riservato;
- drag gizmo non muove la camera;
- rimozione dal popup aggiorna catalogo;
- overlay assenti dal JPG e stato interattivo ripristinato;
- regressione completa catalogo, selezione, export e mobile smoke.

### Definition of Done
- UX legacy non piu raggiungibile;
- tutte le azioni contestuali operative con risultati non ambigui;
- parete impenetrabile nei flussi continui coperti;
- aggancio diretto valido su tutta la geometria visibile targetizzabile;
- nessuna transizione automatica fra inclinazioni oltre soglia;
- timer, pointer capture e modalita sempre rilasciati;
- suite frontend e backend completa verde;
- report `phases-outcome/Phase_9UX_implementation_done.md` con evidenze e limiti.

---

## FASE 10 - Test completo e quality gates

### Obiettivo
Chiudere copertura automatica completa e verifiche di regressione.

### Requisiti SDD coperti
- `REQ-TST-001..007`
- `REQ-TST-009..010`
- collegamenti da `04-tracciabilita.md` su tutti i domini.

### Vincoli e specifiche da garantire
- test backend unit+integration;
- test fisica headless con scenari obbligatori;
- E2E principali;
- verifica lockfile/restore deterministico CI.

### Task implementativi
- consolidamento suite;
- setup report test;
- check tracciabilita requisito->test.

### Test da eseguire
- esecuzione completa suite locale e CI;
- regressione collisioni, targeting e aggancio diretto;
- regressione ciclo detached/attached e modalita contestuali della FASE 9UX;
- verifica che i comportamenti legacy congelati non siano piu raggiungibili.

### Definition of Done
- suite completa verde;
- nessun requisito testabile privo di test associato.

---

## FASE 11 - Benchmark prestazionale

### Obiettivo
Validare target prestazionale nello scenario standard.

### Requisiti SDD coperti
- `REQ-PRF-001..006`

### Vincoli e specifiche da garantire
- scenario vincolante: 40 hold, 1920x1080, 60s;
- misurazione mediana FPS;
- report ripetibile.

### Task implementativi
- script/procedura benchmark;
- raccolta metriche FPS;
- eventuali ottimizzazioni se sotto soglia.

### Test da eseguire
- benchmark completo almeno su profilo hardware target.

### Definition of Done
- mediana FPS >= 30 nello scenario standard;
- nessun blocco UI nelle interazioni benchmark.

---

## FASE 12 - Documentazione finale

### Obiettivo
Completare documentazione tecnica e operativa conforme ai requisiti.

### Requisiti SDD coperti
- `REQ-DOC-001..005`

### Vincoli e specifiche da garantire
- documentazione inline esaustiva in italiano su classi e metodi;
- documento generale completo (architettura, logica, avvio live/debug);
- 6 diagrammi obbligatori;
- documento test completo;
- tutto in cartella docs (esclusa inline).

### Task implementativi
- revisione inline commenti;
- stesura documenti markdown;
- creazione diagrammi;
- verifica coerenza docs vs codice reale.

### Test da eseguire
- checklist documentale;
- prova avvio seguendo solo documentazione.

### Definition of Done
- documentazione completa, coerente, utilizzabile da terzi senza supporto aggiuntivo.

---

## Verifica finale trasversale (obbligatoria)

Prima di considerare chiuso il lavoro:
- controllare copertura completa della matrice `sdd-specs/04-tracciabilita.md`;
- verificare assenza violazioni costituzionali (`C1..C21`);
- confermare nessuna funzionalita extra non richiesta (autenticazione/persistenza);
- confermare conformita naming hold `Hold<number>` in codice, test, docs;
- confermare pipeline CI completamente verde.
