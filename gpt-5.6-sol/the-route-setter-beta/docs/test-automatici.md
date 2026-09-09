# Test Automatici E Benchmark

## Obiettivo

La strategia verifica separatamente logica pura, fisica browser, contratti HTTP, flussi utente e prestazioni. Ogni comando restituisce exit code diverso da zero in caso di fallimento. La pipeline `.github/workflows/ci.yml` usa restore deterministici e pubblica gli artifact anche quando un test fallisce.

**TheRouteSetter v0.0.1: release CHIUSA per accettazione dell'utente, con limiti noti accettati**, non certificazione universale. Il solo [stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md) raccoglie perimetro supportato e punti di attenzione; il [report di consolidamento](../phases-outcome/Consolidation_implementation_done.md) conserva la fotografia precedente alla chiusura. Le [verifiche definitive JSON](../phases-outcome/Consolidation_verification_results.json) registrano comandi, risultati, versioni, percorsi artifact e hash SHA-256 delle evidenze. Sono esecuzioni precedenti dell'agente nel workspace, non conteggi riferiti dall'utente o nuove esecuzioni di questo aggiornamento documentale. I report storici restano invariati.

## Toolchain

| Livello | Framework | Scopo |
|---|---|---|
| Backend unit/integration | xUnit + `WebApplicationFactory` | Servizi, hull, middleware, logging e API. |
| Frontend unit/headless | Vitest | Matematica, targeting, fisica Rapier WASM, catalogo ed export. |
| End-to-end | Playwright, matrice browser opzionale | Chromium/Chrome/Edge/Firefox, WebGL, API, catalogo e UX contestuale. |
| Prestazioni | Playwright headed + telemetria Three.js | Profili 8/40 hold, rendering e input separati, long task, heartbeat e distribuzione endpoint. |
| Documentazione/tracciabilita | Script Node.js e test dei tool | Discovery AST ricorsiva, record di tutti i requisiti attivi e percorsi file; non certificazione semantica. |

## Backend

Le factory API correnti derivano da `Support/IsolatedApiFactory` e impongono asset sintetici in una root temporanea prima di avviare i worker; `ApiSmokeTests` verifica l'isolamento. Per E2E, benchmark e gate aggregato, che avviano invece il backend reale, predisporre una directory temporanea dedicata con copie degli asset necessari e impostare `AssetStorage__RootPath` nella stessa sessione. Non rigenerare gli asset originali del workspace. Il solo assegnamento della variabile sotto non crea la directory ne copia gli asset.

Dalla cartella `source`:

```powershell
$env:AssetStorage__RootPath = Join-Path $env:TEMP "route-setter-test-assets"
$env:ContinuousIntegrationBuild = "true"
dotnet restore .\TheRouteSetter.sln --locked-mode
dotnet build .\TheRouteSetter.sln --configuration Release --no-restore
dotnet test .\TheRouteSetter.sln --configuration Release --no-build --no-restore --logger "trx;LogFileName=backend-tests.trx" --results-directory .\TestResults
```

Risultato definitivo: `110/110` xUnit Release, zero fail/skip/retry; build Release con `0` warning e `0` errori. La verifica finale ha prodotto `backend-release.trx` nella root artifact indicata nel JSON, con hash SHA-256 registrato. Il comando di esempio sopra produce invece `source/TestResults/backend-tests.trx`. Il precedente `33/33` resta storico.

La suite copre:

- bootstrap, health e Swagger;
- discovery e distribuzione degli asset;
- manifest e content disposition;
- Convex Hull mancante, riusato e rigenerato dopo cambio hash;
- validazione geometrica del collider;
- middleware errori e correlation ID;
- logging asincrono, sanitizzazione e retention.

CON01/CON03/CON05 aggiungono readiness con worker reale, discovery isolata e terminale, contratti HTTP/MVC e 416, log frontend correlati, logger HTTP Serilog via DI, livelli/override, sanitizzazione avversaria, saturazione/drain e retention per eta/mezzanotte simulata. Schema e limiti in [contratti backend](backend-contracts.md). Test in-memory non equivalgono a soak multi-giorno, ACL reali o enforcement chunked su Kestrel.

## Frontend Unit E Fisica Headless

Dalla cartella `source/frontend`:

```powershell
npm ci
npm test
```

Esito definitivo: **447/447 Vitest in 18 file**, zero fail/skip/retry, registrato nel JSON con hash dell'evidenza. Le regressioni correnti includono readiness/backoff/dispose, reporter/HTTP/privacy e lifecycle CON04, fail-closed dopo errori di rendering, capture/RAF/resize, viewer obsoleto ed export. I **14/14** test dei tool Node sono conteggiati separatamente. La build frontend di produzione passa; Vite segnala soltanto l'avviso sul chunk JavaScript oltre 500 kB.

Risultati storici dell'agente: DEC-026 `331/331` in `12` file; DEC-025 `215/215` in `11` file e build frontend superata. Non sono esecuzioni dell'utente o del consolidamento corrente.

La suite copre:

- stato catalogo e caricamento preview;
- comandi incrementali;
- campionamento a 37 punti e superficie dominante;
- matematica di orientamento e normale;
- generazione JPG;
- TriMesh parete e spawn deterministico;
- cinque scenari fisici obbligatori;
- ripetibilità delle decisioni di collisione.

Le regressioni aggiunte si riferiscono ai requisiti esistenti `REQ-FIS-003`, `REQ-FIS-011..014` e `REQ-TST-006..007`:

- `tests/physics/poseValidation.test.ts`: baseline esplicita parete `1 mm`, soglie separate parete `1..10 mm` (default `5 mm`) e hold immutabile `1 mm`, epsilon invariato `2e-6 m`; minimo per contatto `distance + tolerance`, anche con ordine candidati invertito e contatto governante diverso dal piu profondo, diagnostica `toleranceMeters`, endpoint e intervalli. Restano diedri a 90 gradi, entrambi i lati, winding invertiti e trasformazioni rigide; ostacoli sottili fra endpoint liberi, sweep da partenza separata fermato prima del primo contatto anche verso il pavimento, pavimento/pinna nello stesso TriMesh con contatto iniziale, rotazione di un grado con ostacolo a meta arco, contatto tangente e distacco; esiti contraddittori marcati `uncertain`, broadphase con 40 collider lontani senza query narrowphase aggiuntive, determinismo, rimozione ostacolo e assenza di mutazioni o rete nelle query.
- `tests/physics/realWall.test.ts`: SHA-256 della parete reale invariata, coerenza hash GLB/collider originali Hold1/Hold2, ripetibilita di raycast, normali e validita delle pose laterali e sui tre pannelli frontali. Alcune pose laterali sono attese invalide: il test non dichiara agganciabile ogni punto del modello.
- `tests/config/physicsConfig.test.ts`: JSON stretto, numero finito `1..10` inclusi e decimali (`7.5`), default `5 mm`, hold sempre `1 mm`, rifiuto di chiavi sconosciute/valori non numerici o fuori range; fetch alla base URL con `cache: 'no-store'`, una richiesta per caricamento, errori HTTP/rete/parsing gestiti senza dettagli grezzi o fallback silenzioso.
- Regressione diagnostica finale in `poseValidation.test.ts`, nei due ordini broadphase: una violazione hold confermata prevale su una parete incerta; `blocker`, `colliderHandle`, `penetrationMeters`, `toleranceMeters` e `uncertain: false` restano coerenti con la hold, anche per il percorso. Rimossa la hold, la parete incerta torna governante con `uncertain: true` e percorso irrisolto, senza essere accettata perche entro tolleranza.

### Evidenze Reali DEC-026

Evidenze della precedente implementazione riportate nel report storico `Wall_tolerance_configuration_done.md`, non nuove esecuzioni di questo audit ne prove attribuite all'utente. Asset parete e collider originali Hold1/Hold2 invariati secondo il report. La baseline laterale usa `9` pose per hold; la griglia separata usa `52` pose per hold.

| Tolleranza parete | Baseline Hold1 / Hold2 (su 9 ciascuna) | Griglia Hold1 / Hold2 (su 52 ciascuna) |
|---|---|---|
| `1 mm` | `3 / 3` | `8 / 7` |
| `3 mm` | `7 / 7` | `29 / 29` |
| `5 mm` | `9 / 9` | `45 / 45` |
| `10 mm` | `9 / 9` | `46 / 46` |

Gli scontri profondi parete di circa `120 mm` per Hold1 e `200 mm` per Hold2 sono bloccati a tutte le soglie verificate. Sui target precedentemente rifiutati con profondita circa `4 mm`, passi locali `+/-1 cm` e twist `+/-1 grado` falliscono a `1` e `3 mm`, passano a `5` e `10 mm`. `realWall.test.ts` copre baseline, scontri profondi e passi/twist con controlli di determinismo e assenza mutazioni; la griglia e evidenza separata del report storico, non va attribuita a un test automatico non presente.

Prove utente consigliate: `1 mm` baseline, `3 mm` conservativa, `5 mm` raccomandata, `7.5` e `10 mm` esplorative. Non sono garanzie su tutte le superfici o imperfezioni fotografiche/fotogrammetriche. Gap `5 mm`, angolo `5 gradi`, soglia hold `1 mm` ed epsilon restano invariati. Esito finale in [Wall_tolerance_configuration_done.md](../phases-outcome/Wall_tolerance_configuration_done.md); nessun report storico viene modificato.

Le riproduzioni CON09 e i limiti Rapier `0.12.0` accettati sono conservati nello [stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md), senza aggiungerli ai conteggi delle suite o considerarli pass di garanzie fisiche universali.

Per produrre JUnit:

```powershell
npm run test:unit:ci
```

Output: `source/frontend/test-results/vitest-junit.xml`.

## End-To-End

Solo Google Chrome Stable desktop e ufficialmente supportato per v0.0.1; versione verificata `152.0.7977.76`. Gli aggiornamenti successivi seguono le normali verifiche di regressione. Chromium e Firefox pinned sono runtime di test; Edge e Firefox restano strumenti opzionali, non browser supportati della baseline.

Installare i runtime Playwright necessari una volta (Chrome/Edge richiedono i rispettivi canali installati):

```powershell
npx playwright install chromium firefox
```

Eseguire con l'isolamento temporaneo degli asset descritto nella sezione Backend:

```powershell
npm run test:e2e
```

La configurazione legge davvero `E2E_BROWSERS`, default `chromium`, distinto dal target ufficiale. Per verificare Chrome installato, sempre dalla cartella `source/frontend` con asset isolati:

```powershell
$env:E2E_BROWSERS = 'chrome'
npm run test:e2e
```

Matrice opzionale mantenuta per diagnosi, non requisito di supporto della release:

```powershell
$env:E2E_BROWSERS = 'chromium,chrome,msedge,firefox'
npm run test:e2e
```

I nomi sono validati, i duplicati eliminati e un browser richiesto ma assente fallisce senza skip silenzioso. `chrome`/`msedge` usano i canali installati; `firefox` usa il runtime Playwright, non automaticamente Firefox Stable. `E2E_BACKEND_COMMAND` permette un host gia compilato; `E2E_REUSE_SERVER=true` e esplicito, non il default. Porte configurabili tramite `E2E_FRONTEND_PORT`/`E2E_BACKEND_PORT`.

Suite definitive complete: **57/57** per ciascuno di Chromium `125.0.6422.26`, Chrome `152.0.7977.76` e Firefox Playwright `125.0.1` (build pinned 1449), zero fail/skip/flaky/retry. Eseguite sequenzialmente in headless, un worker, nessuna esclusione grep, trace abilitati, server API Release ricompilato e root asset indipendenti. Gli E2E usano Vite dev server; la build di produzione e verificata separatamente. La regressione stream JPEG Firefox e passata nella nuova suite: il precedente `56 pass / 1 fail` non e piu l'esito corrente.

Edge `152.0.4191.66` non e stato rieseguito: rimangono **54 pass / 3 fail** precedenti, accettati come non bloccanti e non convertiti in pass. Dettagli e provenienza nello [stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md). Non sommare risultati precedenti o subset ai pass finali.

Risultato storico della precedente implementazione `DEC-025`: `31/31` E2E superati, zero errori pageerror/console/HTTP nella traccia. La suite comprende startup, navigazione camera, catalogo, dettaglio 3D, caricamento/rimozione, export, popup, `Escape`, targeting, aggancio, sgancio, movimento globale fra pannelli, rotazione, shadow, commit/rollback e cleanup `pointercancel`. Le regressioni in `selection-input.spec.ts` verificano inoltre feedback `hold-collision`, assenza superficie, no-change distinto da collisione e ripristino coerente di posa/preview. Non rieseguiti per questo aggiornamento documentale.

Risultato E2E della precedente implementazione `DEC-026`, eseguito dall'agente: `43/43` superati, non eseguiti dall'utente. `tests/e2e/physics-config.spec.ts` verifica file reale a `5 mm`, una richiesta al bootstrap e nessuna durante interazioni, cambio a `3`/`10 mm` applicato solo al reload, hold sempre `1 mm` nello snapshot, avvio impedito con errore in pagina per config invalida/assente, HTTP, JSON con commenti o rete interrotta. I test richiedono assenza di `pageerror` non gestiti anche nei casi negativi; gli errori HTTP/rete deliberatamente provocati non equivalgono alla precedente attestazione di zero errori HTTP nella traccia. Non rieseguiti in questo audit.

Verifica produzione separata della precedente implementazione, riportata nel report storico e non rieseguita in questo audit: su una build di produzione in `dist` temporanea, modifica del file runtime effettivamente servito `physics-config.json` da `5` a `3` e poi a `5`, con reload della pagina e applicazione dei valori verificata senza rebuild fra le modifiche. E una prova sul file reale distribuito, distinta dal routing simulato degli E2E; conferma che il valore non e incorporato nel bundle. Backend non modificato; nessuna nuova verifica backend o certificazione prestazionale implicita.

In CI `npm run test:e2e:ci` produce:

- `test-results/playwright-junit.xml`;
- `playwright-report/index.html`.

La configurazione E2E non imposta `screenshot`: nessuno screenshot di fallimento e garantito. Il trace e `on-first-retry`, ma senza retry configurati non viene creato; per una successiva diagnosi usare esplicitamente `npm run test:e2e -- --trace on`, senza modificare la configurazione.

La matrice automatica non estende il supporto ufficiale oltre Chrome; un pass del runtime bundled non certifica il browser Stable corrente, ne un subset certifica tutta l'applicazione.

## Gate Aggregato

Dalla cartella `source/frontend`:

```powershell
$env:CI = "true"
npm run test:ci
```

Il comando esegue build, tracciabilita, documentazione, Vitest e Playwright; prima dell'avvio vale l'isolamento asset della sezione Backend. Il workflow GitHub Actions esegue inoltre backend, verifica lockfile e pubblicazione artifact. `npm run test:docs` e `npm run test:traceability` sono gate strutturali, non certificazioni fisiche/E2E o semantiche. CI remota non eseguita: e un'informazione sulla provenienza, non un nuovo obbligo di run, commit o PR ne un blocco aggiuntivo di chiusura.

Il gate documentale scopre tutti i file applicativi `.ts` sotto `src`, esclusi `.d.ts`; verifica descrizioni JSDoc per funzioni/classi con nome, interfacce, costruttori, metodi/firme e accessori, contando ogni firma separatamente. Esclude arrow/function expression e test fuori `src`; non verifica automaticamente lingua o correttezza dei commenti. Il backend XML e oggetto di audit manuale dei 28 file elencati nel piano, non del gate AST. Ultima evidenza documentale registrata: **264/264** dichiarazioni in **24** file, 11 documenti obbligatori e 9 diagrammi; supera il precedente inventario `261/261`. Nomi dei documenti e conteggi vanno verificati con il gate dopo ogni riorganizzazione, non dedotti da questa fotografia.

Test separati degli strumenti, dalla cartella `source`:

```powershell
node --test scripts/documentation-scope.test.mjs scripts/check-test-traceability.test.mjs frontend/scripts/con07-tooling.test.mjs frontend/scripts/con07-input-observer.test.mjs
```

Esito del batch definitivo: **14/14 pass**, zero fail/skip/cancelled/retry. I gate documentazione e tracciabilita sono stati rieseguiti dopo l'allineamento documentale con exit code 0: **264/264** dichiarazioni e **101/101** record attivi, nessun mancante e tutti i percorsi richiesti validi. Il precedente fallimento documentale per il link al report allora mancante rimane registrato nel JSON; il pass successivo e riportato nel report corrente.

## Tracciabilità

```powershell
npm run test:traceability
```

Lo script confronta `sdd-specs/01-specifica-requisiti.md`, `sdd-specs/04-tracciabilita.md` e `source/test-traceability.json`. Tutti i `101` requisiti attivi richiedono un record con array non vuoto di percorsi a file esistenti: non solo le fasi 10-12. Record mancanti, ID ignoti/storici e directory al posto di file sono bloccanti. I requisiti dichiarati sono `102`, incluso lo storico escluso `REQ-TST-008`. `source/conformity-plan.json` registra gli stati con ragioni e attivita residue; la distribuzione numerica dipende dalla sua revisione, non costituisce percentuale di conformita. `REQ-DOC-004` e implementato: questa guida e il report corrente sono allineati ai risultati definitivi, non resta pendente l'aggiornamento dei conteggi. Completezza strutturale non significa certificazione semantica o copertura di ogni asserzione.

## Benchmark Fase 11

Il runner corrente misura profili tipico e complesso con rendering sintetico e input mouse in fasi separate. Richiede una sessione desktop visibile e WebGL hardware identificabile per le verifiche hardware; metriche indisponibili restano tali, non zero. Per eseguirlo, applicare prima l'isolamento asset della sezione Backend:

```powershell
$env:PERF_HEADLESS = "false"
$env:PERF_BROWSER = "chrome"
$env:PERF_SMOKE = "false"
$env:PERF_DURATION_MS = "60000"
$env:PERF_HOLD_COUNT = "40"
npm run test:performance
```

Il test usa una build di produzione, viewport `1920x1080`, due asset reali alternati e profili da 8 e 40 identita distinte. Ogni identita crea mesh, rigid body e collider. Gli FPS sono conteggiati sulle chiamate effettive a `renderer.render` in finestre da un secondo durante l'orbita sintetica; l'input reale misura selezioni, movimenti, rotazioni e distribuzione degli endpoint in una fase separata, con rendering on-demand.

`PERF_SMOKE=true` consente run ridotte (minimo 2 hold configurate e 1000 ms); senza smoke la configurazione rifiuta meno di 40 hold o 60000 ms per fase. `PERF_BROWSER` accetta un solo browser per run. Il flag `certification` seleziona i controlli, non conferisce da solo certificazione; il profilo tipico resta da 8 hold. GPU software/sconosciuta, pagina nascosta, viewport non conforme e long-task API assente bloccano la verifica hardware. La modalita split-phase non misura 60 FPS continui durante input ne il completamento GPU/paint.

Gate:

- almeno 40 hold nel profilo complesso, 8 nel tipico;
- almeno 60 secondi per fase rendering/input nel profilo completo;
- FPS mediano almeno 30;
- nessun long task oltre 200 ms durante caricamento, aggancio o interazione;
- heartbeat p95 non oltre 200 ms;
- endpoint tipico non oltre 50 ms e massimo non oltre 100 ms;
- nessun errore pagina.

### Evidenza Prestazionale CON07

Evidenza dell'agente su uno **snapshot precedente agli ultimi fix**, persistita nella sezione `priorPerformanceEvidence` delle [verifiche definitive](../phases-outcome/Consolidation_verification_results.json). Due profili passati, zero skip/retry; entrambi i raw conservano `certified: false`. Non e una ricertificazione prestazionale del codice finale. Il JSON registra anche root artifact e conservazione di 39 file JSON/log prestazionali copiati con hash identici, senza sovrascrivere gli originali. Le metriche dettagliate sotto provengono da `summary.json` e dai profili tipico/complesso della root `route-con07-performance-certification`.

Ambiente: Chrome `152.0.7977.76` headed, WebGL 2.0, Intel(R) Graphics `0x00007DD5` via ANGLE D3D11, 22 processori logici e 16 GiB dichiarati dal browser, workstation condivisa. Viewport `1920x1080`, DPR osservato `1.0000000149011612`, canvas CSS `1616x1004.325`, drawing buffer `1616x1004`. Non 40 geometrie distinte e non prova universale del PC domestico target.

| Misura | Tipico | Complesso |
|---|---:|---:|
| Hold attached / corpi / collider | 8 / 9 / 9 | 40 / 41 / 41 |
| Rendering sintetico, durata ms / FPS mediani | 60020.3 / 60 | 60006.9 / 60 |
| Fase input, durata ms / render effettivi | 60253.3 / 1179 | 85610.0 / 1603 |
| Selezioni / hold distinte selezionate | 59 / 8 | 80 / 40 |
| Commit movimento / rotazione | 59 / 59 | 80 / 80 |
| Campioni endpoint/solver | 118 | 160 |
| Solver p50 / massimo ms | 2.5 / 5.8 | 2.7 / 5.1 |
| Dispatch pointerup p50 / massimo ms | 3.1 / 7.0 | 3.4 / 5.9 |
| Durata render input p95 ms | 7.1 | 6.3 |
| Long task input massimo ms | 50 | 0 osservati |
| Heartbeat input p95 ms | 6.6 | 11.1 |
| Heartbeat load / attach / render p95 ms | 61.5 / 27.4 / 7.5 | 22.2 / 16.6 / 12.7 |
| Errori pagina / endpoint rifiutati | 0 / 0 | 0 / 0 |

Nessun long task osservato nelle fasi load/attach/render di entrambi i profili. La durata dispatch va dal capture del pointerup reale alla microtask del listener bubble finale: include UI/solver, non round-trip Playwright o conferma paint. Le correzioni di selezione mouse entro 12 px sono incluse nelle misure, non selezioni dirette del controller. Primo smoke: tipico passato, complesso fallito sulla selezione Hold38; dopo correzione harness, smoke `2/2` e profilo `2/2`. Il fallimento precedente resta registrato. I 60 FPS del rendering sintetico non sono FPS continui durante input; il riscontro hardware Intel vale per quella run, non per tutti i PC. Nessuna soglia ridotta, nuova run o ricertificazione del codice finale: accettazione e punti di attenzione nello [stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md).

Risultato storico della fase 11: 60 FPS mediani per `60.150,4 ms`, endpoint `2,8 ms`, long task massimo di caricamento `80 ms`, nessun long task durante l'interazione. I dati completi sono in `phases-outcome/Phase_11_performance_results.json`; non sono una nuova misura del primo gruppo corrente.

La modalità headless è utile solo come smoke del runner: normalmente usa SwiftShader e può applicare throttling a RAF, quindi non certifica `REQ-PRF-001` o il target FPS.

Misure storiche del primo gruppo, non rieseguite in questo audit: benchmark Node su 40 hold reali, mediane endpoint `1.7-6.3 ms` e massimo `8.4 ms`; mediane click `24-59 ms` e massimo `84 ms`. Sono misure delle query fisiche, non una certificazione di rendering, reattivita browser o prestazioni hardware.

Nella precedente esecuzione la suite prestazionale headless con SwiftShader e FALLITA: `3 FPS` contro target `30`, long task massimo `829 ms`, heartbeat `748 ms` (soglia `200 ms`). Il rendering software non fornisce evidenza sul profilo hardware richiesto: il fallimento resta tale, non viene convertito in pass o compensato dai risultati hardware successivi. Questi ultimi sono ora disponibili per lo specifico metodo split-phase; non eliminano i limiti di accettazione indicati sopra.

## Lockfile

Dalla radice Git:

```powershell
git diff --exit-code -- gpt-5.6-sol/the-route-setter-beta/source/frontend/package-lock.json gpt-5.6-sol/the-route-setter-beta/source/backend/src/TheRouteSetter.Api/packages.lock.json gpt-5.6-sol/the-route-setter-beta/source/backend/tests/TheRouteSetter.Api.Tests/packages.lock.json
```

Il comando deve terminare senza differenze dopo `npm ci` e `dotnet restore --locked-mode`.

## Risultati Correnti

| Gate | Esito e provenienza |
|---|---|
| Conferma utente | Release v0.0.1 chiusa con limiti noti accettati; non esecuzione delle suite |
| Build backend Release / xUnit | 0 warning/errori, `110/110`, zero skip/retry |
| Build frontend produzione | Pass; avviso Vite chunk JavaScript oltre 500 kB |
| Vitest | `447/447` in 18 file, zero skip/retry |
| Chromium 125 / Chrome 152 / Firefox pinned 125 | Suite complete finali `57/57` per runtime, zero skip/flaky/retry; Firefox Stable non verificato |
| Edge | Precedente `54 pass / 3 fail`, non rieseguito; accettato non bloccante, non supportato nella baseline |
| Performance hardware CON07 | Precedente snapshot: `2/2` profili split-phase passati, Chrome 152/Intel D3D11; non ricertificazione degli ultimi fix, `certified: false` nei raw |
| Documentazione / tracciabilita / test tool | Ultime evidenze registrate: `264/264` in 24 file, 11 documenti/9 diagrammi; `101/101` record; `14/14` test tool. Non nuove run o copertura semantica completa |
| Performance SwiftShader | FAIL storico conservato: 3 FPS, long task 829 ms, heartbeat 748 ms |
| Deployment / CI remota | Non eseguiti, indicazione informativa distinta dai pass locali; nessun nuovo blocco di run/commit/PR |
| Stato e punti di attenzione | Riferimento unico: [stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md) |

## Diagnostica Fallimenti

- Consultare TRX, JUnit, report HTML e gli artifact effettivamente prodotti, senza presumere screenshot o trace E2E.
- In una successiva diagnosi ripetere prima il singolo file o test fallito, senza retry; per E2E aggiungere `--trace on` e mantenere l'isolamento asset.
- Verificare porte `5173/5080` per E2E e `5174/5081` per benchmark.
- Controllare `pageerror`, risposta health e disponibilità WebGL 2.0.
- Consultare in sola lettura `window.__ROUTE_SETTER_SCENE__.lastActionResult.reason` e `lastPoseDiagnostic` come descritto in `docs/applicazione.md`: distinguere collisione, assenza superficie, no-op e percorso irrisolto; lo snapshot dell'ultima query puo precedere l'azione corrente e non e un log persistente o una telemetria di rete per frame.
- Non usare risultati headless software per certificare le prestazioni hardware.
