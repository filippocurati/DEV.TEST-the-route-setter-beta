# TheRouteSetter v0.0.1

## Chiusura Della Versione

**Stato: CHIUSA E ACCETTATA dall'utente il 2026-09-09, con i limiti noti riportati in questo documento.** La decisione di release e `DEC-029`. Il browser ufficialmente supportato e **Chrome Stable desktop con WebGL 2.0 e accelerazione hardware**. Il canale Chrome installato verificato e `152.0.7977.76`; non si certificano automaticamente versioni future del browser.

Lo sviluppo previsto per questa prima versione viene considerato concluso. Le attenzioni sotto elencate sono accettate e non bloccano il commit di v0.0.1. L'accettazione non significa assenza universale di difetti, esecuzione delle prove mancanti o correzione dei limiti del motore fisico. Edge e Firefox restano utilizzabili a titolo esplorativo, senza supporto certificato per questa versione.

Questo e **l'unico registro corrente di stato, limiti e punti da rivalutare della v0.0.1**. Consolida e sostituisce:

- `phases-outcome/Specifications_alignment_review.md` (il file indicato come `Specification_alignement_review.md`);
- `phases-outcome/Consolidation_physics_residuals.md`;
- `sdd-specs/06-stato-conformita.md`.

Le specifiche `00..05` descrivono la baseline approvata; le guide in `docs` descrivono uso e implementazione. I report rimasti in `phases-outcome` conservano esecuzioni e stati storici: eventuali dichiarazioni di mancata chiusura precedono questa accettazione. I record di `source/conformity-plan.json` e `source/test-traceability.json` sono il dettaglio tecnico delle evidenze, non registri autonomi di blocchi alla release.

## Baseline Funzionale E Tecnica

| Area | Stato della v0.0.1 |
|---|---|
| Architettura | ASP.NET Core API; Three.js e Rapier eseguiti nel browser; nessuna fisica interattiva backend |
| Catalogo | Metadati e preview in cache; GLB/collider caricati quando necessari; una sola istanza per modello |
| Disponibilita progressiva | Endpoint `/api/holds/status`; polling seriale delle prese in attesa, backoff e arresto su Ready/Failed o fine sessione |
| Collider | Parete TriMesh statica; hull generati dal backend con hash sorgente, vertici e indici obbligatori |
| Aggancio | Esplicito tramite shadow, campionamento locale e verifica della posa finale |
| Movimento e rotazione | Click locali da 1 cm / 1 grado con arresto lungo la direzione richiesta; nessuno sliding automatico. Drag globale con preview e validazione del solo endpoint |
| Tolleranze | Parete configurabile 1..10 mm, default 5 mm; tra prese 1 mm fisso; epsilon numerico distinto di 0.002 mm |
| Lifecycle | Gestione caricamenti obsoleti, rollback, cleanup, resize differito, retarget camera e coalescing RAF. Una scena irreversibilmente guasta impedisce ulteriori mutazioni |
| Export | JPG della vista prospettica corrente, lato lungo 2560 px, senza UI/shadow; non costituisce salvataggio editabile della sessione |
| Errori e logging | Messaggi sicuri, correlazione API/browser, reporting limitato e volatile, log JSON server asincroni, filtri .NET e retention per eta |
| Persistenza e accessi | Nessun account, autenticazione o salvataggio delle tracciature; il reload perde la sessione |

**Bug dei raccordi laterali: RISOLTO e confermato dall'utente.** I modelli originali non sono stati modificati. Il confronto delle tolleranze sulle nove pose laterali per ciascuna presa ha dato 3 pose accettate a 1 mm, 7 a 3 mm, 9 a 5 e 10 mm. Sulla griglia diagnostica separata di 52 pose per presa, 5 mm accettano 45 pose per entrambe, 10 mm ne accettano 46. Gli scontri profondi restano respinti. La scelta di 5 mm non promette che ogni posizione su ogni parete sia utilizzabile.

Configurazione: `source/frontend/public/physics-config.json`, chiave `wallPenetrationToleranceMm`. Il file e letto una volta all'avvio, senza cache; dopo la modifica occorre ricaricare la pagina. Nel deploy si modifica la copia effettivamente servita. Istruzioni e perdita della sessione sono descritte nella [guida applicativa](../docs/applicazione.md).

## Evidenze Di Verifica

Ultime suite applicative eseguite dall'agente durante il consolidamento, senza skip o retry nelle run finali:

| Verifica | Esito e ambito |
|---|---|
| Build frontend | Superata; avviso Vite per dimensione del chunk |
| Backend Release | Build zero warning/errori; 110/110 test xUnit |
| Frontend unitario | 447/447 test Vitest in 18 file |
| Tooling | 14/14 test degli strumenti |
| E2E Chromium | 57/57, motore Playwright 125.0.6422.26 |
| E2E Chrome | 57/57, canale installato 152.0.7977.76 |
| E2E Firefox esplorativi | 57/57, motore Playwright 125.0.1, non Firefox Stable corrente |
| Edge esplorativo | Run precedente: 54 pass / 3 fail, non riclassificata come pass |
| Documentazione inline | 264/264 dichiarazioni nel perimetro AST controllato, 24 file TS; audit XML backend manuale |
| Tracciabilita | 101/101 requisiti attivi con record; 102 ID dichiarati includendo uno storico escluso |

Le prove runtime di configurazione `5 -> 3 -> 5` al reload sono state eseguite su un file realmente servito da una copia della build, senza rebuild fra le modifiche. I conteggi e le misure sono dell'agente; la conferma dell'utente riguarda il funzionamento e l'accettazione della versione. Le attribuzioni inesatte all'utente nei vecchi report non sono considerate provenienza delle esecuzioni.

Evidenza durevole: [risultati del consolidamento](../phases-outcome/Consolidation_verification_results.json), con versioni, comandi, hash e percorsi dei raw. Gli E2E sono stati eseguiti tramite Vite dev con backend Release isolato; la build di produzione e stata verificata separatamente. Il riordino e il cambio dei metadati a 0.0.1 non costituiscono una nuova esecuzione di tutte queste suite.

Verifiche eseguite dopo il riordino di release: build frontend `0.0.1` superata (solo avviso dimensione chunk), build backend Release `0.0.1` con zero warning/errori, gate documentazione e tracciabilita superati, sei test degli strumenti documentali/tracciabilita superati e `git diff --check` senza errori. La versione e allineata in `source/frontend/package.json`, nei due campi del pacchetto radice del lockfile e in `source/Directory.Build.props`. Le versioni delle dipendenze non cambiano; il contratto API Swagger resta `v1`, distinto dalla release applicativa. Commit e tag non sono stati creati dall'agente.

### Prestazioni Osservate

Prove headed su Chrome 152 con Intel Graphics integrata, ANGLE D3D11, viewport 1920x1080, due asset reali alternati:

| Misura | 8 prese | 40 prese |
|---|---:|---:|
| Rendering per oltre 60 s, FPS mediani | 60 | 60 |
| Commit movimento / rotazione nella fase input | 59 / 59 | 80 / 80 |
| Solver p50 / massimo | 2.5 / 5.8 ms | 2.7 / 5.1 ms |
| Heartbeat input p95 | 6.6 ms | 11.1 ms |

Rendering sintetico e input reale sono fasi separate. La misura precede gli ultimi fix del consolidamento; non certifica FPS continui durante qualsiasi interazione sul codice finale o prestazioni su ogni PC. I raw mantengono `certified: false`. Il vecchio FAIL SwiftShader (3 FPS) resta storico: non e un test hardware e non viene cancellato dal successivo risultato positivo. Questi limiti di verifica sono accettati per v0.0.1.

## Attenzioni Accettate E Sviluppi Futuri

Tutti i punti seguenti sono **non bloccanti per la chiusura v0.0.1**. Non sono presentati come corretti o verificati integralmente. Alla ripresa degli sviluppi, rivalutare priorita e criterio di chiusura alla luce dei modelli e dei problemi effettivamente osservati.

| ID | Punto | Possibile conseguenza | Quando rivalutarlo |
|---|---|---|---|
| ATT01 | Limiti nativi Rapier 0.12, gia CON09 | Pose endpoint erroneamente accettate presso giunzioni o dentro un volume chiuso; nessuna garanzia assoluta di montabilita | Compenetrazioni osservate, nuovi modelli problematici o necessita di validazione geometrica piu rigorosa |
| ATT02 | Chrome unico browser supportato | Download/export o interazioni possono differire su Edge/Firefox | Estensione del supporto ufficiale ad altri browser o aggiornamenti importanti di Chrome |
| ATT03 | Performance finale non certificata su ogni interazione | Rallentamenti con modelli piu pesanti, texture o hardware diverso | Introduzione di asset fotogrammetrici/scene piu complesse; ripetere un profilo rappresentativo |
| ATT04 | Convenzioni e qualita dei nuovi GLB | Scala, pivot o orientamento errati possono produrre prese non aderenti, sproporzionate o collisioni inattese | Ogni introduzione/sostituzione di parete o prese; verificare metri, Y-up, base/posteriore e allineamento mesh/collider |
| ATT05 | Copertura residua degli edge case | Difetti non intercettati in sgancio affollato/esaurito, annullamenti rari, combinazioni di errori e cleanup | Ripresa sviluppo o prima segnalazione pertinente; aggiungere regressione deterministica |
| ATT06 | Diagnostica e sanitizzazione best effort | Errori classificati genericamente, eventi persi per coda/filtri/rete e dati personali non riconoscibili automaticamente | Nuove sorgenti di log, gestione dati sensibili o necessita di audit operativo |
| ATT07 | Verifiche operative e documentali non esaustive | Differenze di reverse proxy, permessi, cache, limiti HTTP o evidenze incomplete | Deploy su un nuovo ambiente, pipeline remota o nuova modifica dei contratti |

### ATT01 - Riproduzioni Fisiche Conservate

Riproduzioni del 2026-09-09 sul `PhysicsWorld` corrente, Rapier 0.12.0, parete con tolleranza 5 mm, senza mock o step dinamici:

| Caso sintetico | Risultato della versione | Limite dimostrato |
|---|---|---|
| Cubo chiuso TriMesh, limiti +/-0.1 m; presa cuboide semilati 0.02 m al centro | Contact null, intersezione false, endpoint valido | Non viene riconosciuto il contenimento completo se la parete e interpretata come solido |
| Stessa presa a x=0.2 m | Endpoint valido | Controllo esterno corretto |
| Stessa presa a x=0.11 m | Profondita circa 10 mm, endpoint invalido | Attraversamento della superficie rilevato |
| Piano a due triangoli; presa semilati (0.02, 0.0005, 0.0005), posizione (0.01, 0, 0) sulla giunzione | Profondita circa 0.7071 mm, endpoint valido | Sottostima rispetto ai 10 mm della superficie intera |
| Stessa presa a (0.01, 0.05, 0), fuori giunzione | Profondita circa 10 mm, endpoint invalido | Controllo fuori giunzione corretto |

I percorsi dall'esterno verso l'interno sono bloccati nei casi esaminati, con frazioni circa 0.39999 per il cubo e 0.49752 per il piano. Sono controesempi di chiamate endpoint dirette, **non riproduzioni di un attraversamento nella UI**, che sceglie punti mediante raycast di superficie e controlla i percorsi incrementali. Non riaprono il bug laterale accettato.

Nelle API pubbliche/raw della versione installata non e stata individuata una correzione generale minima: `containsPoint` e `projectPoint(solid=true)` non distinguono correttamente il contenimento del TriMesh; cambiare solo query/prediction non risolve. Half-space o convex solidi non sostituiscono una parete arbitraria concava. Un eventuale cambio motore o rappresentazione richiede una valutazione dedicata, senza presumere che una versione nuova risolva automaticamente questi casi.

Evidenze di dettaglio temporanee: `C:/Users/FCurati/AppData/Local/Temp/opencode/con09-parameters.json`, `con09-results.json`, `con09-analysis-handoff.md`, `con09-current-source-runner.mjs`. La prova ha verificato 246 hash invariati, senza mutazioni di corpi, target cinematici, geometrie o maschere. I file temporanei non sono necessari per leggere questo registro e potrebbero non essere disponibili dopo una pulizia della macchina.

### ATT02 - Browser Esplorativi

Edge 152 ha tre fallimenti `TargetClosedError` nei test di export ripetuto, JPG e download modello. La diagnostica mostrava download completati e pagina/browser aperti alla fine del corpo test; un problema del teardown del runner e plausibile ma non dimostrato. I fallimenti restano tali, accettati per un browser non supportato in v0.0.1.

Firefox pinned Playwright 125.0.1 supera la suite; non equivale a verificare Firefox Stable corrente. La correzione dello stream JPEG nel runner e passata. Le configurazioni opzionali dei browser restano disponibili per future verifiche; non sono promesse di supporto.

### ATT04 E ATT05 - Asset E Copertura

Prima di usare nuovi GLB verificare sistema destrorso, metri, asse verticale Y, normale uscente +Z della presa, pivot sul retro e coerenza delle trasformazioni. L'applicazione non ricentra automaticamente asset errati. Le dimensioni originali delle due prese di test sono circa un metro sull'asse maggiore: non assumerle come standard dei futuri asset.

Le implementazioni di sgancio progressivo fino a 10 m, annullamento e rollback esistono. Restano da ampliare le prove esplicite di candidati iniziali bloccati/esaurimento, rotazione con endpoint invalido, combinazioni rare di eventi, condivisione/non selezionabilita delle shadow e stabilita delle risorse su cicli lunghi. Anche il reload dopo una composizione modificata e le convenzioni di tutti gli asset possono ricevere test dedicati. Queste lacune non sono difetti gia riprodotti nel normale uso.

### ATT06 E ATT07 - Diagnostica Ed Esercizio

La coda dei log e limitata e best effort: un HTTP 202 non garantisce persistenza in caso di filtri, saturazione o guasti I/O. La sanitizzazione e ricorsiva e testata ma non riconosce qualsiasi dato personale non etichettato; inviare soltanto riepiloghi diagnostici, non payload grezzi. Alcune eccezioni globali possono mantenere categoria Unknown. I casi mancanti vanno verificati quando si estende il codice, senza modificare il comportamento delle collisioni per produrre log per frame.

Restano distinti i guasti precedenti alla pipeline HTTP, risposte gia iniziate, chunked-body enforcement reale, soak della retention e configurazione del reverse proxy. La documentazione inline e verificata automaticamente nell'ambito AST dichiarato; arrow/function expression e XML backend non hanno un controllo automatico esaustivo. I mapping degli ID non dimostrano tutte le asserzioni. CI remota e deployment operativo non sono stati eseguiti come parte di questa chiusura e non costituiscono un ulteriore obbligo di commit/PR.

## Provenienza Del Consolidamento

L'audit del 2026-09-08 sulla baseline `45eaefd` distingueva correttamente bug risolto e applicazione allora incompleta. Aveva identificato catalogo Pending, errori/logging e lifecycle da completare, oltre a due scelte normative. Il consolidamento successivo ha implementato tali aree; DEC-028 ha approvato click senza sliding e indici hull obbligatori. Le vecchie richieste di decisione non sono quindi ancora pendenti.

| Riferimento conservato | Significato |
|---|---|
| [Fase 12](../phases-outcome/Phase_12_implementation_done.md) | 46/46 unit e 26/26 E2E storici |
| [Drag globale](../phases-outcome/Lateral_panel_drag_fix_done.md) | DEC-024, 50/50 unit e 27/27 E2E successivi |
| [Primo gruppo fisica](../phases-outcome/Physics_diagnostics_group_1_done.md) | 215/215 unit, 31/31 E2E e limiti emersi |
| [Tolleranza configurabile](../phases-outcome/Wall_tolerance_configuration_done.md) | 331/331 unit, 43/43 E2E; bug poi confermato risolto |
| [Consolidamento applicativo](../phases-outcome/Consolidation_implementation_done.md) | Implementazioni CON01..CON08 ed esiti precedenti all'accettazione finale |
| [Risultati macchina](../phases-outcome/Consolidation_verification_results.json) | 447 unit, 110 backend, 14 tool, 57 E2E su ciascuno dei tre runtime verificati; hash/evidenze |

La decisione finale dell'utente chiude **v0.0.1 con ATT01..ATT07 accettati**. Alla ripresa degli sviluppi questi punti possono essere rivalutati: non richiedono di riaprire o riscrivere retroattivamente la release.
