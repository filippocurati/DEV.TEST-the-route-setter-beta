# Specifica dei requisiti
## Applicazione per tracciatura vie climbing indoor

Ogni requisito usa ID `REQ-<DOMINIO>-<NUMERO>` e include criteri di accettazione verificabili.

Domini: ARC, MOD, CAT, SCN, FIS, HUL, UI, IMG, PRF, ERR, LOG, TST, DOC, DEP.

## ARC - Architettura

**REQ-ARC-001 - Architettura a due livelli.**
Backend ASP.NET Core Web API + frontend browser con three.js.
- Criteri: backend e frontend sono separati; comunicazione via REST/JSON.

**REQ-ARC-002 - API standard.**
OpenAPI/Swagger + separazione Controller/Service.
- Criteri: Swagger disponibile; controller senza business logic.

**REQ-ARC-003 - Rendering client-side.**
- Criteri: nessun rendering 3D lato server.

**REQ-ARC-004 - Rapier solo client-side.**
- Criteri: backend senza dipendenze Rapier; interazioni continue senza chiamate REST.

**REQ-ARC-005 - Nessuna persistenza tracciature.**
- Criteri: nessun endpoint di salvataggio tracciatura; reload pagina riparte da stato iniziale.

**REQ-ARC-006 - Nessuna autenticazione/autorizzazione.**
- Criteri: nessun login/token/ruoli richiesti per l'uso.

**REQ-ARC-007 - Compatibilita browser.**
- Criteri: funzionamento su Chrome/Edge/Firefox stabili con WebGL 2.0.

**REQ-ARC-008 - No REST ad alta frequenza.**
- Criteri: durante movimento continuo non ci sono chiamate per frame/mouse move.

## MOD - File modelli

**REQ-MOD-001 - Struttura cartelle.**
`main-wall` + `holds/Hold<number>` (es. `Hold1`, `Hold2`).
- Criteri: naming hold univoco `Hold<number>` in tutti i flussi.

**REQ-MOD-002 - Caricamento tollerante.**
GLB obbligatorio; texture/asset opzionali.
- Criteri: hold senza texture e comunque caricabile.

**REQ-MOD-003 - Anteprima PREV_.**
- Criteri: catalogo usa file `PREV_`; errore preview singola hold non blocca il catalogo.

**REQ-MOD-004 - File statici backend.**
- Criteri: GLB/preview/collider serviti come statici con URL risolvibili.

**REQ-MOD-005 - Convenzione orientamento modelli.**
- Tutti i modelli devono utilizzare un sistema di coordinate destrorso coerente con three.js.
- L'asse `Y` deve rappresentare la direzione verticale verso l'alto.
- Il lato frontale arrampicabile della parete deve essere orientato verso `+Z`.
- I modelli devono essere espressi in metri, con `1 unita = 1 metro`.
- Rotazione e scala devono essere applicate prima dell'esportazione GLB.
- Criteri: la camera iniziale posta sul semiasse `+Z` visualizza il fronte arrampicabile senza correzioni automatiche lato applicazione.

**REQ-MOD-006 - Geometria continua della parete.**
- La parete deve essere un unico modello geometricamente connesso, composto da una superficie continua che puo includere pannelli piani o inclinati, raccordi, spigoli, diedri, curvature, pance, rientranze e sporgenze.
- I modelli operativi non devono contenere pavimento ne fori geometrici nelle superfici della parete; ogni foro rappresentato deve essere esclusivamente una texture.
- Non sono richiesti proxy fisici, gruppi semantici o metadati aggiuntivi nel GLB.
- Criteri: superficie operativa connessa; assenza di pavimento e aperture geometriche; funzionamento senza proxy o metadati semantici; tutta la superficie operativa e rappresentata dai triangoli del modello; nessuna logica applicativa dipende dalla forma specifica del modello corrente.

## CAT - Catalogo

**REQ-CAT-001 - Catalogo a sinistra.**
- Criteri: pannello sinistro con lista verticale e scrolling.

**REQ-CAT-002 - Box hold.**
- Criteri: ogni box mostra `PREV_`, `Utilizza`, `Dettagli`.

**REQ-CAT-003 - Cache catalogo.**
- Criteri: manifest e preview richiesti una volta per sessione.

**REQ-CAT-004 - Lazy load GLB.**
- Criteri: GLB hold richiesto solo su `Utilizza` o `Dettagli`.

**REQ-CAT-005 - Modale dettagli.**
- Criteri: modello caricato all'apertura e rilasciato alla chiusura.

**REQ-CAT-006 - Transizione catalogo/scena.**
- Criteri: hold in scena non presente in catalogo; rimozione la riporta in catalogo.

**REQ-CAT-007 - Unicita uso hold.**
- Criteri: stessa hold non utilizzabile due volte contemporaneamente.

## SCN - Scena e istanze

**REQ-SCN-001 - Separazione modello/istanza.**
- Criteri: istanza mantiene stato scena; modello resta risorsa catalogo.

**REQ-SCN-002 - Selezione via click.**
- Criteri: hold selezionata evidenziata; comandi agiscono solo su selezionata.

**REQ-SCN-003 - Rimozione hold selezionata.**
- Criteri: rimozione elimina istanza e collider associato.

**REQ-SCN-004 - Parete auto-load.**
- Criteri: parete visibile all'avvio senza input utente.

**REQ-SCN-005 - Posizionamento iniziale hold in stato pre-snap.**
- All'aggiunta in scena, la hold deve essere posta in stato `pre-snap`.
- Il sistema deve individuare il punto di riferimento frontale della parete lungo la direzione globale `+Z`, in corrispondenza del centro geometrico proiettato sul fronte.
- Il primo punto candidato deve essere posto a `2.0 m` dal punto frontale, verso l'esterno lungo `+Z`.
- Se il punto candidato e occupato o genera compenetrazione, il sistema deve cercare una posizione libera mediante una griglia deterministica sul piano parallelo al fronte della parete.
- La ricerca deve partire dal centro e procedere per distanza crescente, con ordinamento stabile, mantenendo sempre l'offset di `2.0 m` lungo `+Z`.
- La distanza tra i punti della griglia deve essere di `0.30 m`.
- Gli assi della griglia devono essere definiti sul piano locale frontale della parete.
- La ricerca su griglia deve essere limitata all'area frontale proiettata della parete (bounding frontale) estesa da un margine configurabile.
- Ogni posizione candidata deve essere validata tramite Rapier rispetto alla parete e alle hold gia presenti.
- L'inserimento deve essere annullato soltanto se nessuna posizione valida e disponibile dopo esaurimento deterministico di tutti i candidati nel dominio di ricerca.
- Criteri: la hold compare in una posizione pre-snap libera, non compenetra, non viene agganciata automaticamente e piu hold possono essere aggiunte contemporaneamente.

## FIS - Fisica, snap, movimento

**REQ-FIS-001 - Sistema unita.**
- Criteri: 1 unita = 1 metro, sistema destrorso coerente three.js.

**REQ-FIS-002 - Regole fisiche base.**
Gravita off, no dinamica, no inerzia, no rimbalzo, no attrito.
- Criteri: hold non si muovono autonomamente.

**REQ-FIS-003 - CCD.**
- Criteri: niente tunneling nei test fisici.

**REQ-FIS-004 - KinematicCharacterController.**
- Criteri: movimento move-and-slide con blocco componenti in collisione e mantenimento componenti libere.

**REQ-FIS-005 - Origine hold.**
- Criteri: rotazione attorno al punto di contatto posteriore.

**REQ-FIS-006 - Snap 5 cm.**
- La distanza di snap e la distanza euclidea tra il pivot posteriore della hold e il punto piu vicino ammissibile sull'intero TriMesh.
- La ricerca non deve dipendere dalla camera e non deve essere limitata alla direzione globale `+Z` o `-Z`.
- Criteri: snap solo se distanza <= 0.05 m; no snap oltre soglia; snap verificato su pannelli frontali, inclinati e superfici laterali.

**REQ-FIS-007 - Movimento post-snap e sgancio controllato.**
- In stato post-snap la hold resta aderente alla superficie continua e i movimenti standard restano tangenziali alla normale del supporto corrente.
- Quando il movimento raggiunge una faccia contigua con normale differente, il supporto puo passare alla nuova faccia secondo `REQ-FIS-016`.
- Criteri: il comando avanti non produce effetti; il comando indietro provoca lo sgancio, ripristina l'orientamento iniziale completo dell'istanza e riposiziona automaticamente la hold a distanza `0.25 m` dalla parete lungo la normale locale (`0.05 m` soglia snap + `0.20 m` margine).

**REQ-FIS-008 - Inclinazione non manuale.**
- Criteri: nessun controllo UI modifica tilt indipendente dalla normale.

**REQ-FIS-009 - Rotazione input.**
- Criteri: 1 grado/click + continuo a pressione; shortcut equivalenti.

**REQ-FIS-010 - Traslazione input.**
- Criteri: 1 cm/click + continuo a pressione; direzioni da proiezione assi vista sul piano tangente del supporto corrente; in una transizione l'eventuale residuo del passo viene riproiettato sulla tangente della nuova faccia.

**REQ-FIS-011 - No compenetrazione.**
- L'intero Convex Hull deve essere verificato durante traslazione, variazione di orientamento, snap e transizione fra superfici.
- La sola validita della posa finale non e sufficiente quando il percorso intermedio puo attraversare un collider.
- Criteri: hold non attraversa parete ne altra hold; nessuna posa intermedia testata presenta penetrazione superiore alla tolleranza fisica.

**REQ-FIS-012 - Separazione mesh/collider.**
- Criteri: fisica usa solo collider Rapier.

**REQ-FIS-013 - Parete TriMesh statica client-side.**
- Il collider deve includere tutti i pannelli, raccordi, spigoli e superfici laterali dopo l'applicazione delle trasformazioni gerarchiche del GLB.
- Nessuna superficie puo essere esclusa perche la propria normale non e parallela a `+Z`.
- Criteri: collider parete derivato da tutti i vertici/triangoli utilizzabili lato client; collision query positive su facce con normali globali differenti.

**REQ-FIS-014 - Pre-snap e degeneri (deterministici).**
- Criteri: fallback normale (triangolo -> ultima valida -> asse mondo), tie-break stabile su contatti equivalenti, annullamento inserimento se nessuna posizione valida non compenetrante.

**REQ-FIS-015 - Traslazione avanti/indietro lungo normale locale (pre-snap).**
- In stato pre-snap devono essere disponibili i comandi avanti/indietro lungo la normale locale della parete.
- Velocita: `1 cm/click` + movimento continuo a pressione.
- Criteri: durante avanti/indietro devono essere rispettate tutte le regole anti-collisione e anti-compenetrazione; una hold non attraversa parete ne altre hold.

**REQ-FIS-016 - Transizione fra superfici contigue.**
- In post-snap il sistema deve mantenere il triangolo o la feature di supporto corrente.
- Il passaggio a una faccia con inclinazione diversa e consentito soltanto quando il movimento raggiunge un bordo condiviso o il primo contatto fisico con una superficie geometricamente contigua, entro la tolleranza configurata.
- Il sistema deve aggiornare punto di supporto, normale e inclinazione, conservando il twist dell'utente attorno alla normale.
- Non sono consentiti cambi anticipati, salti verso superfici vicine ma non raggiunte, o selezioni determinate dalla camera.
- Criteri: transizione deterministica fra pannelli contigui; nessuna transizione prima del contatto; il residuo del passo viene applicato sulla nuova tangente senza superare il passo totale richiesto.

**REQ-FIS-017 - Diedri, spigoli e massima trasformazione valida.**
- Ogni transizione deve validare il Convex Hull nella posa iniziale, in pose intermedie sufficienti a coprire la rotazione e nella posa finale.
- Se la forma della hold o l'angolo del diedro impediscono la transizione completa, il sistema deve trovare la massima trasformazione non compenetrante, arrestare il residuo e mantenere la hold agganciata.
- Criteri: passaggio consentito su spigolo o raccordo quando esiste un percorso valido; arresto deterministico nei diedri non percorribili; nessuno sgancio automatico; se `f` e la frazione applicata del passo, la posa a `f` e valida e, salvo `f = 1`, la posa a `f` incrementata della tolleranza configurata e non valida.

**REQ-FIS-018 - Termine del supporto e retro fuori ambito.**
- Quando termina il supporto operativo o non esiste una posa contigua non compenetrante, la hold deve arrestarsi senza continuare nello spazio libero.
- Il retro non e classificato automaticamente e non fa parte dell'operativita garantita in questa versione.
- Non e richiesto impedire transizioni, compenetrazioni o snap non corretti quando il modello collega geometricamente lato e retro e l'utente forza tale percorso, oppure porta intenzionalmente una hold dietro il modello.
- Criteri: arresto dove termina il supporto nei flussi operativi frontali e laterali; nessun test obbligatorio di classificazione, snap o movimento sul retro.

**REQ-FIS-019 - Continuita numerica del supporto.**
- Le uguaglianze geometriche esatte non devono essere usate come condizione di transizione.
- Contatto, adiacenza e arresto devono usare tolleranze espresse in metri e documentate nel design.
- Le normali devono essere finite e stabilizzate quanto necessario a evitare oscillazioni tra facce equivalenti, senza cancellare cambi di inclinazione reali.
- Criteri: nessun NaN; nessuna oscillazione ripetuta tra due supporti a parita di input; risultato indipendente dal frame rate.

## HUL - Convex Hull backend

**REQ-HUL-001 - Libreria hull vincolata.**
Uso di MIConvexHull (.NET), indipendente da Rapier.
- Criteri: modulo hull dipende da MIConvexHull.

**REQ-HUL-002 - Parsing GLB backend.**
Uso SharpGLTF.
- Criteri: vertici letti da GLB via SharpGLTF.

**REQ-HUL-003 - Formato collider JSON.**
`sourceHash`, `vertices`, `indices` (opzionale).
- Criteri: schema valido per ogni collider generato.

**REQ-HUL-004 - Invalidazione hash.**
- Criteri: hash uguale -> riuso; hash diverso -> rigenerazione.

**REQ-HUL-005 - Generazione asincrona non bloccante.**
- Criteri: backend disponibile anche con collider in generazione.

**REQ-HUL-006 - Consumo collider dal frontend.**
- Criteri: nessun calcolo hull nel frontend.

**REQ-HUL-007 - Guardrail CI behavior-driven.**
La pipeline deve fallire se non e rispettato il comportamento hull richiesto.
- Criteri: fallimento CI se test REQ-TST-003 falliscono, se `collider.json` non e conforme a REQ-HUL-003 o se hash/invalidazione non rispettano REQ-HUL-004.

## UI - Interfaccia

**REQ-UI-001 - Layout.**
- Criteri: catalogo sinistra, viewport nel resto dello spazio.

**REQ-UI-002 - Menu superiore.**
- Criteri: bottoni `Genera immagine` e `Rimuovi presa` disponibili.

**REQ-UI-003 - OrbitControls.**
- Criteri: orbit/zoom/pan con target parete.

**REQ-UI-004 - Shortcut tastiera open guidato.**
- Criteri: mappatura documentata, coerente e non conflittuale quando possibile; includere `SHIFT+Freccia Su` per avanti e `SHIFT+Freccia Giu` per indietro.

## IMG - Generazione immagine

**REQ-IMG-001 - Esportazione della vista corrente.**
- Criteri: l'export mantiene esattamente posizione, orientamento, zoom, proiezione prospettica e rapporto d'aspetto della camera interattiva corrente.

**REQ-IMG-002 - Output della sola scena.**
- Criteri: l'immagine contiene esclusivamente il rendering 3D visibile nella viewport, senza catalogo, menu o controlli UI; lo sfondo corrisponde a quello corrente della scena.

**REQ-IMG-003 - Formato.**
- Criteri: file JPG valido ad alta risoluzione.

**REQ-IMG-004 - Specifica concreta export.**
- Criteri: il lato lungo e 2560 px e il lato corto e proporzionale al rapporto d'aspetto della viewport corrente; qualita JPEG 0.90.

## PRF - Prestazioni

**REQ-PRF-001 - Hardware target.**
- Criteri: scenario validato su PC domestico con GPU integrata WebGL 2.0.

**REQ-PRF-002 - Capacita.**
- Criteri: almeno 40 hold + parete interattive.

**REQ-PRF-003 - Reattivita.**
- Criteri: risposta percepita immediata sui comandi principali.

**REQ-PRF-004 - Framerate.**
- Criteri: target indicativo >= 30 FPS durante interazione.

**REQ-PRF-005 - Nessun blocco UI.**
- Criteri: interfaccia resta responsiva durante load/posizionamento.

**REQ-PRF-006 - Metodo benchmark vincolante.**
- Criteri: scenario 40 hold, 1920x1080, 60s, interazione ripetibile, mediana FPS >= 30.

## ERR - Gestione errori

**REQ-ERR-001 - Gestione centralizzata backend/frontend.**

**REQ-ERR-002 - Backend error contract.**
- Criteri: ErrorId univoco, status coerente, messaggio utente non tecnico.

**REQ-ERR-003 - Nessuna esposizione dettagli tecnici.**
- Criteri: assenza stack trace/path/config in risposte utente.

**REQ-ERR-004 - Copertura categorie errori frontend.**
- Criteri: copertura JS, REST/HTTP, model load/parsing, three.js, Rapier, export immagine, UI.

**REQ-ERR-005 - Isolamento errori locali.**
- Criteri: errore su singola hold non blocca il resto quando possibile.

## LOG - Logging

**REQ-LOG-001 - Logging server-side asincrono non bloccante.**

**REQ-LOG-002 - Frontend senza persistenza log locale.**

**REQ-LOG-003 - Logging JSON strutturato.**
- Criteri: campi minimi timestamp/livello/categoria/messaggio/componente + RequestId/ErrorId quando disponibili.

**REQ-LOG-004 - Soglia configurabile.**
- Criteri: default `Information` in `appsettings.json`.

**REQ-LOG-005 - Rotazione/retention.**
- Criteri: file giornaliero, retention 7 giorni.

**REQ-LOG-006 - Sanitizzazione.**
- Criteri: assenza dati sensibili nei log.

**REQ-LOG-007 - Stack logging vincolato.**
- Criteri: uso Serilog nel backend.

## TST - Test automatici

**REQ-TST-001 - CI fail-on-test-failure.**

**REQ-TST-002 - Unit test backend xUnit.**

**REQ-TST-003 - Test hull obbligatori.**
- Criteri: mancante->generato; coerente->no rigenerazione; GLB modificato->rigenerazione.

**REQ-TST-004 - Integrazione REST.**

**REQ-TST-005 - E2E Playwright flussi principali.**

**REQ-TST-006 - Test fisica headless completi (Vitest).**
- Criteri: copertura dei 5 scenari obbligatori da app_definition.md:
  1) hold non attraversa parete;
  2) due hold non compenetrano;
  3) hold posizionabile correttamente in assenza collisioni;
  4) rimozione hold libera spazio;
  5) comportamento collisioni invariato dopo modifiche (regressione).

**REQ-TST-007 - Determinismo test fisici.**

**REQ-TST-008 - Test snap e degeneri completi.**
- Criteri: no snap oltre 5 cm, snap entro 5 cm, normale del punto di contatto corretta, rotazione post-snap attorno alla normale, movimento tangenziale post-snap, fallback normale deterministico e tie-break deterministico. Le regressioni multi-superficie aggiunte dopo la FASE 8 appartengono a `REQ-TST-010`.

**REQ-TST-009 - Verifica lockfile CI.**
- Criteri: CI usa lockfile, fallisce con drift dipendenze.

**REQ-TST-010 - Regressione parete multi-superficie.**
- Criteri: fixture sintetica con pannello frontale, pannello inclinato, superficie laterale, spigolo convesso, diedro concavo e termine del supporto; transizione soltanto fra facce contigue e non anticipata; rifiuto di superfici vicine non contigue; conservazione del twist; rispetto del passo totale; massima frazione valida entro tolleranza; nessuna oscillazione; indipendenza dal frame rate; E2E sul modello reale per almeno una transizione fra inclinazioni differenti. Il retro e escluso dai test obbligatori.

## DOC - Documentazione

**REQ-DOC-001 - Documentazione inline esaustiva in italiano.**
- Criteri: tutte le classi e tutti i metodi backend/frontend documentati in italiano.

**REQ-DOC-002 - Documento applicativo completo.**
- Criteri: descrive logica completa, struttura software, avvio live/debug.

**REQ-DOC-003 - Diagrammi obbligatori.**
- Criteri: presenti 6 diagrammi richiesti (architettura, cartelle, API, lifecycle hold, flusso UI, responsabilita backend/frontend).

**REQ-DOC-004 - Documento test completo.**
- Criteri: copre scopi, risultati attesi, framework, strumenti.

**REQ-DOC-005 - Cartella documentazione dedicata.**

## DEP - Gestione dipendenze

**REQ-DEP-001 - Versioni esatte pin-nate.**

**REQ-DEP-002 - Lockfile obbligatori versionati.**

**REQ-DEP-003 - Vietate versioni floating (`^`, `~`, wildcard).**

**REQ-DEP-004 - Baseline versioni stabili (no prerelease).**
- Frontend runtime: `three@0.161.0`, `@dimforge/rapier3d-compat@0.12.0`.
- Frontend tooling: `vite@5.2.0`, `typescript@5.4.5`.
- Frontend test: `vitest@1.6.0`, `@playwright/test@1.44.0`.
- Backend runtime: `Serilog.AspNetCore@8.0.1`, `Serilog.Sinks.File@5.0.0`, `SharpGLTF.Core@1.0.0`, `MIConvexHull@1.1.19.504`.
- Backend test: `xunit@2.7.1`, `Microsoft.AspNetCore.Mvc.Testing@8.0.5`.
- Framework target: `.NET 8` LTS; SDK `8.0.424`.
- Toolchain frontend: `Node.js 22.18.0` LTS con `npm 10.9.3`.
- Versioni NuGet dirette espresse come intervalli esatti (esempio: `[1.1.19.504]`).
- Criteri: nessuna dipendenza prerelease (`-alpha`, `-beta`, `-rc`) in baseline/CI.
