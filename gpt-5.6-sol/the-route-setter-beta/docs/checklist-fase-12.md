# Checklist Documentale Fase 12

**TheRouteSetter v0.0.1: release CHIUSA per accettazione dell'utente, con limiti noti accettati.** Il solo [stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md) raccoglie perimetro Chrome Stable desktop, evidenze e punti di attenzione. Le spunte registrano verifiche documentali ed esiti precedenti, non nuove esecuzioni o certificazione universale.

## REQ-DOC

- [x] `REQ-DOC-001`: revisione inline CON08 implementata nel perimetro dichiarato; ultima evidenza del gate **264/264** dichiarazioni nei 24 file TS applicativi, audit XML manuale sui 28 file backend elencati in `source/conformity-plan.json`. Il precedente inventario 261/261 e superato. Il gate conta funzioni/classi con nome, interfacce, costruttori, metodi/firme e accessori; esclude `.d.ts`, arrow/function expression e test fuori `src`. Presenza JSDoc non certifica lingua/semantica e XML non e automatizzato; queste esclusioni tecniche non sono deroghe al requisito.
- [x] `REQ-DOC-002`: `docs/applicazione.md` descrive architettura, logica, struttura, avvio live/debug e distinzione fra baseline 0-9 e UX attiva 9UX+.
- [x] `REQ-DOC-003`: presenti sei diagrammi Mermaid identificabili.
- [x] `REQ-DOC-004`: `docs/test-automatici.md` documenta scopi, framework, strumenti, comandi, risultati e benchmark.
- [x] `REQ-DOC-005`: guide operative finali non inline in `docs`, inclusa [backend-contracts.md](backend-contracts.md), sostitutiva del resoconto backend provvisorio inglese; specifiche/stato in `sdd-specs`, esiti in `phases-outcome`. Nessun report storico modificato.

## Diagrammi

- [x] Architettura.
- [x] Struttura delle cartelle.
- [x] API.
- [x] Lifecycle delle prese.
- [x] Flusso UI.
- [x] Responsabilità backend/frontend.

I diagrammi aggiuntivi, come il flusso Convex Hull e il drag transazionale, approfondiscono i percorsi tecnici senza sostituire i sei obbligatori. Il lifecycle separa stato fisico e modalita UI: target invalido in self-loop, commit/rollback che restano in `moving`/`rotating`, `Escape` verso `idle` con deselezione. Il logging frontend e collegato, la readiness ha un endpoint dedicato e il drag libero e accorpato via RAF come gli handle.

## Coerenza Applicativa

- [x] Backend ASP.NET Core e frontend browser-only.
- [x] Three.js e Rapier eseguiti nel browser.
- [x] Mesh grafiche separate dai collider.
- [x] Parete TriMesh e prese Convex Hull.
- [x] Naming asset `Hold<number>` documentato.
- [x] Nessuna autenticazione aggiunta.
- [x] Nessuna persistenza della tracciatura aggiunta.
- [x] UX storica 0-9 separata dalla UX normativa 9UX+.
- [x] Snap automatico e shortcut legacy non descritti come funzionalità attive.
- [x] Targeting shadow e drag endpoint-only documentati.
- [x] Export privo di overlay e preview documentato.

Implementazioni correnti documentate: readiness terminale senza reload, error contract uniforme nella pipeline incluso 416, reporter applicativo/globale limitato, errori preview segnalati, logging per eta/livelli/privacy, race del viewer corretta, rollback e fail-closed, RAF uniforme, resize/target/popup/bounds ed export. Nel drag si distingue una validazione per endpoint disponibile e variato da zero per `no-change`/`no-surface`. I guasti irreversibili fermano la scena senza mutazioni invisibili; non promettono recupero universale. CON06 approva prefisso conservativo e indici obbligatori. Per limiti accettati e relative evidenze vale lo stato della versione, senza un secondo registro in questa checklist.

## Operatività

- [x] Versioni toolchain indicate.
- [x] Avvio backend documentato dalla directory corretta.
- [x] Avvio frontend documentato dalla directory corretta.
- [x] URL applicazione, health, Swagger e OpenAPI indicati.
- [x] Debug backend/frontend documentato.
- [x] Configurazione asset e logging descritta.
- [x] Variabili E2E e benchmark descritte.
- [x] Troubleshooting essenziale presente.
- [x] `Avvio Live` conservato come sezione di sviluppo locale; produzione distinta con `dotnet publish`, build statica, reverse proxy, root asset assoluta e permessi asset/log.

Deployment operativo non eseguito: la procedura di produzione e una guida, non certificazione degli endpoint distribuiti o nuova condizione di chiusura dell'intervento.

## Verifiche Correnti

- [x] Sorgenti e configurazioni correnti letti prima delle affermazioni implementative.
- [x] [Verifiche definitive persistite](../phases-outcome/Consolidation_verification_results.json): comandi, versioni, artifact e hash SHA-256 delle evidenze.
- [x] Backend `110/110`, Release zero warning/errori; build frontend produzione passata con avviso Vite chunk oltre 500 kB.
- [x] Vitest **447/447 in 18 file** e test tool **14/14**, zero fail/skip/retry.
- [x] Suite complete finali **57/57 ciascuna** su Chromium 125, Chrome 152 e Firefox pinned 125; zero fail/skip/flaky/retry, inclusa regressione stream JPEG Firefox.
- Evidenza opzionale, non supporto baseline: Firefox Stable corrente non verificato; Edge precedente `54 pass / 3 fail`, non rieseguito e accettato non bloccante. Dettagli nello [stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md).
- [x] Artifact prestazionali letti: due profili headed Chrome 152/Intel D3D11 passati, 8/40 hold, split-phase; 118/160 campioni endpoint, non 119.
- [x] Sintesi prestazionale e provenienza persistite nel JSON, 39 file JSON/log precedenti conservati con copie a hash identico.
- Provenienza prestazionale: profilo precedente agli ultimi fix, non rieseguito o ricertificato; 60 FPS sintetici separati dall'input on-demand, `certified: false` conservato.
- [x] Tracciabilita estesa a tutti i 101 requisiti attivi con mapping/stato; completezza semantica non dedotta dai record.
- [x] Analisi CON09 e riproduzioni conservate nello [stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md), insieme all'accettazione dei limiti noti; nessuna nuova esecuzione implicita.

Ultime evidenze registrate: gate documentazione **264/264** dichiarazioni in 24 file, 11 documenti obbligatori/9 diagrammi; tracciabilita **101/101** record; test Node **14/14**, zero fail/skip/retry. Nomi dei documenti e conteggi sono da ricontrollare dopo la riorganizzazione, non sono esiti presunti di una nuova run. Il JSON conserva il fallimento documentale precedente dovuto al report allora mancante; esito del successivo controllo nel [report storico di consolidamento](../phases-outcome/Consolidation_implementation_done.md). Mappatura implementata nel perimetro dichiarato, non percentuale o certificazione semantica; `REQ-DOC-004` implementato con conteggi definitivi. La distribuzione degli stati e mantenuta nel piano macchina, senza duplicare una fotografia superata.

## Test Storici

Esito storico `DEC-026`: soglie separate (parete `1..10 mm`, default `5 mm`; hold `1 mm`), configurazione runtime senza fallback, diagnostica con priorita alla violazione accertata e avviso perdita sessione al reload. Unitari `331/331` in `12` file ed E2E `43/43`, come la prova su dist temporanea (file reale `5 -> 3 -> 5` senza rebuild), sono evidenze dell'agente, non test dell'utente o del consolidamento corrente. La conferma utente riguarda il bug funzionale originale. Il [report storico DEC-026](../phases-outcome/Wall_tolerance_configuration_done.md) resta invariato.

Le evidenze seguenti appartengono alla fase 12 originale: [report fase 12](../phases-outcome/Phase_12_implementation_done.md), Vitest `46/46` in `9` file e Playwright `26/26`. I successivi `50/50` unitari e `27/27` E2E provengono dal [fix drag pannello laterale](../phases-outcome/Lateral_panel_drag_fix_done.md), non dall'esecuzione originale della fase 12. I report storici restano invariati.

Per il successivo primo gruppo `DEC-025` sono riportati build frontend superata, `215/215` unit in `11` file e `31/31` E2E con zero errori pageerror/console/HTTP nella traccia. Backend invariato, `33/33` resta evidenza precedente. La suite prestazionale headless SwiftShader e invece FALLITA (3 FPS, long task massimo 829 ms, heartbeat 748 ms); il benchmark Node su 40 hold reali non e certificativo. Risultati, misure e limiti sono in `docs/test-automatici.md`; nessuna nuova certificazione hardware.

- [x] Build frontend.
- [x] Vitest fase 12 originale: 46/46 in 9 file.
- [x] Playwright fase 12 originale: 26/26.
- [x] Restore NuGet locked.
- [x] Build backend Release: 0 warning, 0 errori.
- [x] xUnit: 33/33.
- [x] Benchmark fase 11: 40 hold, 60 secondi, 60 FPS mediani.
- [x] Check tracciabilità.
- [x] Verifica lockfile senza drift.
- [x] `git diff --check`.

Le spunte di questa sezione registrano esiti storici, non una nuova esecuzione. I gate correnti hanno ora discovery ricorsiva e record per tutti gli attivi, ma restano strutturali: non attestano conformita funzionale universale o copertura di ogni asserzione. Lo stato della release e distinto da questi esiti.

## Verifica Manuale Finale

1. Seguire il quick start in `README.md` senza consultare i report di fase.
2. Aprire catalogo e viewer `Dettagli`.
3. Inserire, selezionare, agganciare, spostare, ruotare, sganciare e rimuovere una presa.
4. Verificare rollback e deselezione con `Escape`.
5. Generare il JPG e verificare l'assenza degli overlay.
6. Aprire Swagger e verificare gli endpoint elencati.
7. Eseguire i comandi descritti in `docs/test-automatici.md`.
