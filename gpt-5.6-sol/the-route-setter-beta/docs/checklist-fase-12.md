# Checklist Documentale Fase 12

## REQ-DOC

- [x] `REQ-DOC-001`: classi e metodi applicativi documentati inline in italiano; completati i gap frontend rilevati.
- [x] `REQ-DOC-002`: `docs/applicazione.md` descrive architettura, logica, struttura, avvio live/debug e distinzione fra baseline 0-9 e UX attiva 9UX+.
- [x] `REQ-DOC-003`: presenti sei diagrammi Mermaid identificabili.
- [x] `REQ-DOC-004`: `docs/test-automatici.md` documenta scopi, framework, strumenti, comandi, risultati e benchmark.
- [x] `REQ-DOC-005`: tutta la documentazione finale non inline risiede in `docs`.

## Diagrammi

- [x] Architettura.
- [x] Struttura delle cartelle.
- [x] API.
- [x] Lifecycle delle prese.
- [x] Flusso UI.
- [x] Responsabilità backend/frontend.

I diagrammi aggiuntivi, come il flusso Convex Hull e il drag transazionale, approfondiscono i percorsi tecnici senza sostituire i sei obbligatori.

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

## Operatività

- [x] Versioni toolchain indicate.
- [x] Avvio backend documentato dalla directory corretta.
- [x] Avvio frontend documentato dalla directory corretta.
- [x] URL applicazione, health, Swagger e OpenAPI indicati.
- [x] Debug backend/frontend documentato.
- [x] Configurazione asset e logging descritta.
- [x] Variabili E2E e benchmark descritte.
- [x] Troubleshooting essenziale presente.

## Test Eseguiti

Esito finale `DEC-026`: documentate soglie separate (parete `1..10 mm`, default `5 mm`; hold `1 mm`), configurazione runtime senza fallback, diagnostica coerente con priorita alla violazione accertata, bootstrap fail-closed e procedura edit/reload con avviso di perdita sessione. Unitari `331/331` in `12` file ed E2E `43/43` superati, verificati e comunicati dall'utente. Verificata anche una build produzione in dist temporanea: file reale `5 -> 3 -> 5` applicato al reload senza rebuild. Backend invariato, nessuna nuova certificazione prestazionale. Le evidenze storiche sotto restano invariate; dettaglio corrente in `docs/test-automatici.md` e [report DEC-026](../phases-outcome/Wall_tolerance_configuration_done.md).

Le evidenze seguenti sono storiche della fase 12 e restano invariate. Per il primo gruppo corrente (`DEC-025`) sono confermati build frontend superata, 215/215 unit in 11 file e 31/31 E2E con zero errori pageerror/console/HTTP nella traccia. Backend invariato, 33/33 resta evidenza precedente. La suite prestazionale headless SwiftShader e invece FALLITA (3 FPS, long task massimo 829 ms, heartbeat 748 ms); il benchmark Node su 40 hold reali non e certificativo. Risultati, misure e limiti correnti sono in `docs/test-automatici.md`; nessuna nuova certificazione hardware.

- [x] Build frontend.
- [x] Vitest: 50/50.
- [x] Playwright: 27/27.
- [x] Restore NuGet locked.
- [x] Build backend Release: 0 warning, 0 errori.
- [x] xUnit: 33/33.
- [x] Benchmark fase 11: 40 hold, 60 secondi, 60 FPS mediani.
- [x] Check tracciabilità.
- [x] Verifica lockfile senza drift.
- [x] `git diff --check`.

## Verifica Manuale Finale

1. Seguire il quick start in `README.md` senza consultare i report di fase.
2. Aprire catalogo e viewer `Dettagli`.
3. Inserire, selezionare, agganciare, spostare, ruotare, sganciare e rimuovere una presa.
4. Verificare rollback e deselezione con `Escape`.
5. Generare il JPG e verificare l'assenza degli overlay.
6. Aprire Swagger e verificare gli endpoint elencati.
7. Eseguire i comandi descritti in `docs/test-automatici.md`.
