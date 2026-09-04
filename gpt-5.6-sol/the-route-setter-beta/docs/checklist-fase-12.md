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

- [x] Build frontend.
- [x] Vitest: 46/46.
- [x] Playwright: 26/26.
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
