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
- Criteri: snap solo se distanza <= 0.05 m; no snap oltre soglia.

**REQ-FIS-007 - Movimento post-snap.**
- Criteri: hold resta aderente alla parete e si muove tangenzialmente.

**REQ-FIS-008 - Inclinazione non manuale.**
- Criteri: nessun controllo UI modifica tilt indipendente dalla normale.

**REQ-FIS-009 - Rotazione input.**
- Criteri: 1 grado/click + continuo a pressione; shortcut equivalenti.

**REQ-FIS-010 - Traslazione input.**
- Criteri: 1 cm/click + continuo a pressione; direzioni da proiezione assi vista su piano tangente.

**REQ-FIS-011 - No compenetrazione.**
- Criteri: hold non attraversa parete ne altra hold.

**REQ-FIS-012 - Separazione mesh/collider.**
- Criteri: fisica usa solo collider Rapier.

**REQ-FIS-013 - Parete TriMesh statica client-side.**
- Criteri: collider parete derivato da vertici/triangoli parete lato client.

**REQ-FIS-014 - Pre-snap e degeneri (deterministici).**
- Criteri: fallback normale (triangolo -> ultima valida -> asse mondo), tie-break stabile su contatti equivalenti, annullamento inserimento se nessuna posizione valida non compenetrante.

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
- Criteri: mappatura documentata, coerente e non conflittuale quando possibile.

## IMG - Generazione immagine

**REQ-IMG-001 - Vista ortografica frontale.**
- Criteri: export usa camera ortografica frontale dedicata.

**REQ-IMG-002 - Output pulito.**
- Criteri: UI nascosta e sfondo bianco durante export.

**REQ-IMG-003 - Formato.**
- Criteri: file JPG valido ad alta risoluzione.

**REQ-IMG-004 - Specifica concreta export.**
- Criteri: lato lungo 2560 px, lato corto proporzionale, qualita JPEG 0.90.

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
- Criteri: no snap oltre 5 cm, snap entro 5 cm, normale del punto di contatto corretta, rotazione post-snap attorno alla normale, movimento tangenziale post-snap, fallback normale deterministico, tie-break deterministico.

**REQ-TST-009 - Verifica lockfile CI.**
- Criteri: CI usa lockfile, fallisce con drift dipendenze.

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
