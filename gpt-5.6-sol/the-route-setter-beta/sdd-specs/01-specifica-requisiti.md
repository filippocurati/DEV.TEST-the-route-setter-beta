# Specifica dei requisiti
## Applicazione per tracciatura vie climbing indoor

Ogni requisito usa ID `REQ-<DOMINIO>-<NUMERO>` e include criteri di accettazione verificabili.

Domini: ARC, MOD, CAT, SCN, FIS, HUL, UI, UX, IMG, PRF, ERR, LOG, TST, DOC, DEP.

## Baseline e prevalenza 9UX

Le fasi 0-9 e i relativi report restano congelati come baseline storica. Dalla fase 9UX in avanti i requisiti aggiornati in questo documento sostituiscono le precedenti regole di interazione basate su snap automatico, comandi avanti/indietro, pannello comandi fisso e shortcut globali. Non e richiesto retrofittare i report delle fasi congelate.

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
- Criteri: hold selezionata evidenziata; compare popup contestuale ancorato alla hold; azioni e overlay agiscono solo sulla selezionata.

**REQ-SCN-003 - Rimozione hold selezionata.**
- Criteri: rimozione elimina istanza e collider associato.

**REQ-SCN-004 - Parete auto-load.**
- Criteri: parete visibile all'avvio senza input utente.

**REQ-SCN-005 - Posizionamento iniziale hold in stato detached.**
- All'aggiunta in scena, la hold deve essere posta in stato `detached`.
- Il sistema deve individuare il punto di riferimento frontale della parete lungo la direzione globale `+Z`, in corrispondenza del centro geometrico proiettato sul fronte.
- Il primo punto candidato deve essere posto a `2.0 m` dal punto frontale, verso l'esterno lungo `+Z`.
- Se il punto candidato e occupato o genera compenetrazione, il sistema deve cercare una posizione libera mediante una griglia deterministica sul piano parallelo al fronte della parete.
- La ricerca deve partire dal centro e procedere per distanza crescente, con ordinamento stabile, mantenendo sempre l'offset di `2.0 m` lungo `+Z`.
- La distanza tra i punti della griglia deve essere di `0.30 m`.
- Gli assi della griglia devono essere definiti sul piano locale frontale della parete.
- La ricerca su griglia deve essere limitata all'area frontale proiettata della parete (bounding frontale) estesa da un margine configurabile.
- Ogni posizione candidata deve essere validata tramite Rapier rispetto alla parete e alle hold gia presenti.
- L'inserimento deve essere annullato soltanto se nessuna posizione valida e disponibile dopo esaurimento deterministico di tutti i candidati nel dominio di ricerca.
- Criteri: la hold compare in una posizione detached libera, non compenetra, non viene agganciata automaticamente e piu hold possono essere aggiunte contemporaneamente.

## FIS - Fisica, snap, movimento

**REQ-FIS-001 - Sistema unita.**
- Criteri: 1 unita = 1 metro, sistema destrorso coerente three.js.

**REQ-FIS-002 - Regole fisiche base.**
Gravita off, corpi hold cinematici, no dinamica, no inerzia, no rimbalzo, no attrito.
- Criteri: hold non si muovono autonomamente.

**REQ-FIS-003 - CCD.**
- Il CCD e l'assenza di tunneling si applicano alle trasformazioni reali incrementali e alle pose committate.
- Il percorso visuale della shadow e il teletrasporto editoriale endpoint-only dei drag non sono una simulazione fisica e sono esclusi dal requisito di tunneling.
- Criteri: nessun tunneling nei click incrementali e nei movimenti cinematici reali; un endpoint drag libero oltre un ostacolo intermedio e accettato se la posa finale e valida.

**REQ-FIS-004 - KinematicCharacterController.**
- Criteri: movimento move-and-slide con blocco componenti in collisione e mantenimento componenti libere.

**REQ-FIS-005 - Origine hold.**
- Criteri: rotazione attorno al punto di contatto posteriore.

**REQ-FIS-006 - Aggancio diretto al target.**
- L'aggancio e avviato esclusivamente dall'azione contestuale `Aggancia` e dal click su un target della parete.
- Il percorso fra posa detached e target non viene simulato ne validato.
- La posa finale allinea l'asse locale `+Z` della hold alla normale stabilizzata della superficie dominante e conserva il twist corrente.
- Criteri: nessuno snap automatico per prossimita; target valido produce stato `attached`; target invalido lascia invariata la hold e mantiene attiva la modalita di targeting.

**REQ-FIS-007 - Sgancio progressivo controllato.**
- `Sgancia` e disponibile soltanto in stato attached.
- Il sistema ripristina l'orientamento detached iniziale e verifica pose lungo la normale uscente, iniziando a `0.50 m` dal punto di aggancio e aumentando la distanza di `0.10 m` per tentativo.
- La ricerca termina alla prima posa valida oppure a una distanza massima configurata di `10 m`.
- Criteri: primo candidato valido selezionato deterministicamente; nessun fallback allo spawn iniziale; se nessun candidato e valido la hold resta attached e viene mostrato un messaggio non tecnico.

**REQ-FIS-008 - Inclinazione non manuale.**
- Criteri: nessun controllo UI modifica tilt indipendente dalla normale.

**REQ-FIS-009 - Rotazione input.**
- La rotazione e disponibile soltanto in modalita `rotating` per una hold attached.
- Click senza drag sulle frecce circolari: `1 grado`, con validazione immediata come nella prima implementazione 9UX.
- Il drag crea una shadow 3D runtime, ruotata attorno alla normale corrente e quantizzata a `1 grado`, mentre la hold reale resta invariata.
- Durante il drag non vengono eseguite query di collisione; al rilascio viene validata soltanto la posa endpoint.
- Endpoint valido: commit atomico. Endpoint invalido: rollback totale, nessun angolo parziale applicato.
- Criteri: twist candidato derivato dallo snapshot iniziale; shadow piu arco/linea; pointer capture; camera congelata; nessuna shortcut globale.

**REQ-FIS-010 - Traslazione input.**
- La traslazione e disponibile soltanto in modalita `moving` per una hold attached.
- Quattro frecce contestuali muovono alto/basso/destra/sinistra rispetto alla vista corrente.
- Ogni click senza drag applica `0.01 m`; piu click singoli producono piu passi indipendenti.
- Ogni freccia e anche origine di un drag lungo la propria direzione screen-space; la componente pointer perpendicolare viene ignorata.
- Durante il drag la hold reale resta invariata, una shadow 3D runtime segue aderente alla parete e una linea/freccia gialla mostra origine e target richiesto.
- Durante il drag non vengono eseguite query di collisione; al rilascio viene validata soltanto la posa endpoint.
- Endpoint valido: commit atomico di posizione, normale e inclinazione. Endpoint invalido: rollback totale, nessuna posizione parziale applicata.
- Criteri: nessun comando avanti/indietro; nessun limite totale di distanza; pointer release committa o annulla; pointercancel/Escape annullano; nessuna shortcut globale.

**REQ-FIS-011 - No compenetrazione.**
- Tutto il TriMesh, incluso il retro non classificato, e impenetrabile durante spostamento, rotazione e sgancio.
- Aggancio e sgancio diretto validano la posa finale candidata ma non simulano il percorso editoriale verso la destinazione.
- Il contatto a distanza zero e valido; la tolleranza numerica massima di penetrazione accettata e `0.001 m`.
- I click incrementali di spostamento e rotazione continuano ad arrestarsi all'ultima posa valida.
- I drag di spostamento e rotazione validano esclusivamente l'endpoint al rilascio; il percorso puo attraversare ostacoli per scelta editoriale esplicita.
- Criteri: ogni posa committata rispetta la tolleranza di `0.001 m`; endpoint drag invalido annulla integralmente il drag; nessun commit parziale.

**REQ-FIS-012 - Separazione mesh/collider.**
- Criteri: fisica usa solo collider Rapier.

**REQ-FIS-013 - Parete TriMesh statica client-side.**
- Tutti i triangoli del modello partecipano al collider e sono candidabili per l'aggancio, indipendentemente da normale, inclinazione, prominenza, curvatura o cavita.
- Il retro non viene classificato o filtrato per il targeting; un uso intenzionale del retro e fuori ambito ma resta fisicamente collidente.
- Criteri: collider derivato da tutti i vertici/triangoli parete lato client; nessun filtro basato su `+Z` durante targeting e collisioni.

**REQ-FIS-014 - Target e degeneri deterministici.**
- Criteri: normali finite; raggruppamento e tie-break deterministici; target privo di hit non agganciabile; posa invalida non modifica la hold.

**REQ-FIS-015 - Vincolo alla superficie di aggancio.**
- Al momento dell'aggancio viene memorizzata la normale stabilizzata di aggancio.
- Durante `Sposta` la hold puo seguire piccole variazioni locali pur restando aderente, ma la normale candidata deve rimanere entro `5 gradi` dalla normale di aggancio.
- Durante il drag la shadow viene proiettata incrementalmente sulla parete e resta aderente; non vengono eseguite collision query.
- Un diedro, spigolo, prominenza, gap o cambio di inclinazione oltre soglia arresta la shadow all'ultimo candidato geometricamente ammissibile.
- Al rilascio la normale endpoint viene nuovamente verificata rispetto alla normale di aggancio.
- Criteri: nessuna transizione automatica fra superfici; per cambiare superficie sono necessari `Sgancia` e un nuovo `Aggancia`.

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
- Criteri: bottone `Genera immagine` disponibile; `Rimuovi` e presente esclusivamente nel popup contestuale.

**REQ-UI-003 - OrbitControls.**
- Criteri: orbit/zoom/pan con target parete.

**REQ-UI-004 - Tastiera e accessibilita.**
- Non esistono shortcut globali per spostamento o rotazione hold.
- `Escape` annulla `attach-targeting` e termina `moving`/`rotating`.
- I pulsanti del popup restano utilizzabili tramite focus, `Enter` e `Space`; gli handle che producono movimento o rotazione sono mouse-only.
- Le azioni semantiche del popup, incluso `Sgancia`, possono produrre cambi di stato o riposizionamenti diretti quando attivate da tastiera; il divieto riguarda gli input incrementali di movimento e rotazione.
- Criteri: pressione delle vecchie shortcut non modifica le hold; hint `Escape` visibile nelle modalita attive.

## UX - Interazione contestuale fase 9UX

**REQ-UX-001 - Popup contestuale.**
- Alla selezione di una hold compare un popup DOM vicino al bounding box proiettato della hold.
- Il popup mostra sempre `Aggancia`, `Sgancia`, `Ruota`, `Sposta`, `Rimuovi`.
- Stato detached: `Aggancia` e `Rimuovi` abilitati.
- Stato attached: `Sgancia`, `Ruota`, `Sposta`, `Rimuovi` abilitati.
- Criteri: popup aggiornato durante camera, resize e trasformazioni; mantenuto nella viewport; nascosto in `attach-targeting` e durante export.

**REQ-UX-002 - Macchina a stati interazione.**
- Stati fisici hold: `detached`, `attached`.
- Modalita UI: `idle`, `attach-targeting`, `moving`, `rotating`.
- Le modalita sono mutuamente esclusive; cambio selezione, rimozione, blur, `Escape` e pointer cancel interrompono le interazioni attive secondo il design.
- Le modalita moving/rotating possono contenere una sessione drag transazionale con snapshot iniziale e posa candidata.
- Criteri: una sola modalita attiva; una sola sessione drag; nessun timer, pointer capture, shadow o materiale preview resta attivo dopo l'uscita.

**REQ-UX-003 - Cerchio target.**
- Il target rappresenta un disco circolare tangente alla superficie nel punto colpito; la sua proiezione DOM/SVG appare come un'ellisse piena e trasparente, gialla in stato ordinario e rossa dopo un tentativo invalido.
- Assi, rapporto e rotazione dell'ellisse derivano dalla proiezione prospettica di due assi tangenti locali; il lato maggiore e limitato fra `48 px` e `160 px`, preservando il rapporto fra gli assi.
- Durante `pointermove` viene aggiornato al massimo una volta per frame usando il ray centrale.
- Dopo un click invalido resta rosso per `500 ms` o fino al successivo movimento, poi torna giallo.
- Criteri: parete visibile sotto il target; target assente fuori dalla parete; overlay escluso dall'export.

**REQ-UX-004 - Campionamento superficie dominante.**
- Al click il cerchio usa `37` campioni deterministici: centro e tre anelli rispettivamente da `6`, `12`, `18` punti.
- Ogni campione ha peso unitario ed esegue un raycast camera verso il primo triangolo visibile della parete.
- Gli hit di campioni adiacenti nel pattern vengono raggruppati se la distanza world e inferiore o uguale al diametro fisico della base e la differenza delle normali e entro `5 gradi`; la chiusura transitiva definisce il gruppo.
- Non esiste copertura minima: vince il gruppo con maggior peso fra i soli campioni validi.
- Per ogni gruppo la distanza camera e il minimo delle distanze dei membri e l'ID stabile e il minimo ID dei membri.
- Parita: gruppo contenente il campione centrale, poi distanza camera del gruppo minore, poi ID stabile del gruppo minore.
- Se il centro cade in un foro ma altri campioni colpiscono la parete, il gruppo dominante resta candidabile.
- Criteri: risultato deterministico; nessun hit produce target non valido; superficie dominante verificata su bordo e curva.

**REQ-UX-005 - Commit aggancio.**
- Il click in `attach-targeting` costruisce una posa sul gruppo dominante.
- Il punto candidato e il campione del gruppo dominante piu vicino al centro del cerchio; a pari distanza vince l'indice campione minore. La normale e stabilizzata usando i campioni del gruppo.
- La posa valida viene applicata direttamente e il popup ricompare nello stato attached.
- La posa invalida non sposta la hold, colora il target di rosso e mantiene il targeting.
- `Escape` annulla senza modifiche.
- Criteri: nessuna validazione del percorso detached-target; posa finale validata contro parete e altre hold.

**REQ-UX-006 - Gizmo rotazione.**
- Due frecce circolari DOM/SVG attorno alla hold selezionata.
- Click senza drag = `1 grado` con commit immediato.
- Drag = shadow 3D trasparente piu arco/linea gialla; angolo candidato quantizzato a `1 grado` e calcolato dallo snapshot iniziale.
- La modalita resta attiva fino a `Escape`; click esterno non la chiude.
- Durante il drag OrbitControls, zoom e pan sono completamente disabilitati.
- Nessuna validazione fisica avviene su pointermove; al pointerup si valida una sola volta l'endpoint e si committa o annulla integralmente.
- Criteri: hold reale immutata durante drag; endpoint valido committato una volta; endpoint invalido lascia posa e twist iniziali; cleanup su pointerup, pointercancel, lostpointercapture, blur, cambio selezione, rimozione ed Escape.

**REQ-UX-007 - Gizmo movimento.**
- Quattro frecce DOM/SVG ai bordi della hold proiettata.
- Click senza drag = `1 cm`; piu click singoli restano disponibili. La pressione prolungata non avvia piu ripetizione automatica: superata la soglia drag, inizia la preview transazionale.
- Drag dalla freccia = shadow 3D aderente alla parete piu linea/freccia gialla retta verso il target richiesto; movimento vincolato all'asse della freccia.
- In modalita `moving`, il drag puo iniziare anche direttamente sulla mesh della hold selezionata; in questo caso il delta e libero in entrambe le dimensioni screen-space e mantiene l'offset iniziale pointer-contact point.
- La modalita resta attiva fino a `Escape`; click esterno non la chiude.
- Durante pointermove sono consentiti raycast e calcoli geometrici di surface lock, ma nessuna validazione Convex Hull o collision query.
- Al pointerup viene validato esclusivamente l'endpoint; endpoint invalido annulla integralmente il drag.
- Criteri: direzioni coerenti con lo schermo; shadow aderente; nessun limite totale; hold reale immutata fino al commit; cambio superficie oltre 5 gradi ferma la shadow; cleanup completo su annullamento.

**REQ-UX-008 - Interazione camera durante targeting.**
- In `attach-targeting` il click sinistro e riservato al target.
- Rotazione/pan tramite tasto destro e zoom tramite rotella restano disponibili.
- Durante drag di movimento o rotazione OrbitControls, zoom e pan sono completamente congelati fino alla chiusura della sessione.
- Criteri: target e popup si riallineano dopo camera/resize; nessun doppio comando camera+hold.

**REQ-UX-009 - Piattaforma di input.**
- La fase 9UX e progettata per mouse desktop.
- Touch, gesture mobile e trasformazioni hold via tastiera non sono requisiti di questa fase; la viewport deve comunque continuare a caricarsi su schermi piccoli.
- Criteri: flussi E2E eseguiti con mouse desktop Chromium; nessuna promessa di parita touch.

**REQ-UX-010 - Risultati e feedback.**
- Le azioni scena restituiscono esiti distinguibili: `applied`, `blocked`, `invalid-target`, `not-available`, `previewing`, `committed`, `cancelled`, `invalid-endpoint`, `surface-limit`, con motivo non tecnico.
- Criteri: nessun messaggio `comando applicato` quando la trasformazione non avviene; errore locale non chiude il popup o la modalita salvo necessita.

## IMG - Generazione immagine

**REQ-IMG-001 - Esportazione della vista corrente.**
- Criteri: l'export mantiene esattamente posizione, orientamento, zoom, proiezione prospettica e rapporto d'aspetto della camera interattiva corrente.

**REQ-IMG-002 - Output della sola scena.**
- Criteri: l'immagine contiene esclusivamente il rendering 3D committato, senza catalogo, menu, popup, target, hint, gizmo, linee, archi o shadow 3D; lo sfondo corrisponde a quello corrente della scena.

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
- Criteri: risposta percepita immediata sui comandi principali; preview drag aggiornata al massimo una volta per frame; nessuna `validatePose`, `contactShape` o shape-cast Convex Hull durante pointermove; movimento preview usa al massimo i raycast geometrici necessari ai sottopassi locali; validazione endpoint tipica <= `50 ms`, caso complesso <= `100 ms`, nessun long task > `200 ms`.

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
- Stato: requisito storico della fase 8 congelata. I relativi test documentano la baseline precedente e devono essere sostituiti o rimossi dalla fase 9UX quando verificano comportamenti legacy non piu normativi.
- Criteri storici: no snap oltre 5 cm, snap entro 5 cm, normale del punto di contatto corretta, rotazione post-snap attorno alla normale, movimento tangenziale post-snap, fallback normale deterministico, tie-break deterministico.

**REQ-TST-009 - Verifica lockfile CI.**
- Criteri: CI usa lockfile, fallisce con drift dipendenze.

**REQ-TST-010 - Test interazione contestuale 9UX.**
- Criteri: copertura automatica popup, stati, targeting, superficie dominante, target invalido, aggancio diretto, sgancio progressivo e click incrementali.
- Criteri drag: shadow creata senza richieste PNG/GLB/asset; geometrie e texture condivise; nessun rigid body/collider; shadow esclusa dal picking; hold reale, collider, contact point, normale e twist immutati durante pointermove; nessuna `validatePose`, `contactShape` o shape-cast Convex Hull durante pointermove; movimento shadow aderente e bloccato a 5 gradi; rotazione quantizzata a 1 grado; linea/arco coerenti; nessun limite totale alla distanza richiesta; esattamente una fase di validazione endpoint al pointerup; endpoint valido committato una sola volta; endpoint invalido con rollback totale di tutti gli stati; endpoint libero oltre ostacolo intermedio accettato; cleanup pointer/materiali/preview; camera congelata; shadow esclusa dall'export; nessuna perdita risorse dopo drag ripetuti.

## DOC - Documentazione

**REQ-DOC-001 - Documentazione inline esaustiva in italiano.**
- Criteri: tutte le classi e tutti i metodi backend/frontend documentati in italiano.

**REQ-DOC-002 - Documento applicativo completo.**
- Criteri: descrive logica completa, struttura software, avvio live/debug e separa esplicitamente baseline storica 0-9 dalla UX attiva dalla fase 9UX.

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
