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
         FASE 10 (Test completo)
               |
               v
         FASE 11 (Performance)
               |
               v
         FASE 12 (Documentazione)
```

Nota: FASE 1 e FASE 2 possono procedere in parallelo dopo FASE 0, ma entrambe devono essere complete prima delle fasi frontend che dipendono da API/collider.

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
- predisporre struttura dati `Data/main-wall`, `Data/holds/Hold<number>`.

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
- `REQ-SCN-001`
- `REQ-UI-001`, `REQ-UI-002`

### Vincoli e specifiche da garantire
- catalogo a sinistra con `PREV_`, `Utilizza`, `Dettagli`;
- cache di manifest+preview per sessione;
- GLB caricato solo on-demand;
- separazione modello/istanza;
- unicita uso hold.

### Task implementativi
- UI catalogo e card;
- modale dettagli con rilascio risorse;
- flusso utilizzo/rientro catalogo;
- stato selezione e disponibilita hold.

### Test da eseguire
- E2E catalogo/use/details/remove;
- test cache sessione;
- test no eager-load GLB.

### Definition of Done
- transizione catalogo<->scena consistente e senza leak evidenti;
- ripristino hold in catalogo dopo rimozione.

---

## FASE 7 - Selezione, rimozione, comandi base

### Obiettivo
Abilitare selezione hold e comandi input principali.

### Requisiti SDD coperti
- `REQ-SCN-002`, `REQ-SCN-003`
- `REQ-FIS-009`, `REQ-FIS-010`
- `REQ-UI-004`

### Vincoli e specifiche da garantire
- click seleziona una sola hold attiva;
- rimozione elimina istanza e spazio fisico;
- 1 grado/click, 1 cm/click + continuo a pressione;
- shortcut coerenti/documentate.

### Task implementativi
- raycast selezione;
- comando rimozione;
- controlli bottoni+tastiera;
- gestione pressione continua.

### Test da eseguire
- E2E selezione/rimozione;
- input tests click singolo e pressione continua;
- test equivalenza UI/tastiera.

### Definition of Done
- comandi agiscono solo su hold selezionata;
- rimozione libera spazio e aggiorna catalogo;
- input coerente e documentato.

---

## FASE 8 - Snap, post-snap e casi degeneri

### Obiettivo
Implementare snap a 5 cm, orientamento normale e regole deterministiche degeneri.

### Requisiti SDD coperti
- `REQ-FIS-005..011`, `REQ-FIS-014`
- `REQ-TST-008`

### Vincoli e specifiche da garantire
- snap entro 0.05 m, non oltre;
- orientamento su normale del punto di contatto;
- movimento tangenziale post-snap;
- fallback normale deterministico;
- tie-break deterministico su contatti equivalenti;
- annullamento inserimento se nessuna posizione valida non compenetrante.

### Task implementativi
- query contatto pre-snap;
- applicazione orientamento e vincoli post-snap;
- gestione fallback/tie-break;
- messaggistica utente non tecnica su inserimento non valido.

### Test da eseguire
- `REQ-TST-008` completo:
  - no snap > 5 cm;
  - snap <= 5 cm;
  - normale corretta;
  - rotazione post-snap attorno normale;
  - movimento tangenziale;
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
- camera ortografica frontale;
- UI nascosta + sfondo bianco;
- lato lungo 2560 px, qualita 0.90;
- ripristino stato scena/UI.

### Task implementativi
- pipeline export;
- gestione hide/restore UI;
- generazione blob JPG e download.

### Test da eseguire
- E2E export file e validita JPG;
- verifica assenza elementi UI nel risultato.

### Definition of Done
- immagine guida leggibile e proporzionata;
- scena interattiva invariata dopo export.

---

## FASE 10 - Test completo e quality gates

### Obiettivo
Chiudere copertura automatica completa e verifiche di regressione.

### Requisiti SDD coperti
- `REQ-TST-001..009`
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
- regressione collisioni e snap.

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
- verificare assenza violazioni costituzionali (`C1..C15`);
- confermare nessuna funzionalita extra non richiesta (autenticazione/persistenza);
- confermare conformita naming hold `Hold<number>` in codice, test, docs;
- confermare pipeline CI completamente verde.
