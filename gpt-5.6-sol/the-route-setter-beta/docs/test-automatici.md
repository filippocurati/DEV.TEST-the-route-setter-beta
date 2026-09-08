# Test Automatici E Benchmark

## Obiettivo

La strategia verifica separatamente logica pura, fisica browser, contratti HTTP, flussi utente e prestazioni. Ogni comando restituisce exit code diverso da zero in caso di fallimento. La pipeline `.github/workflows/ci.yml` usa restore deterministici e pubblica gli artifact anche quando un test fallisce.

## Toolchain

| Livello | Framework | Scopo |
|---|---|---|
| Backend unit/integration | xUnit + `WebApplicationFactory` | Servizi, hull, middleware, logging e API. |
| Frontend unit/headless | Vitest | Matematica, targeting, fisica Rapier WASM, catalogo ed export. |
| End-to-end | Playwright Chromium | Browser reale, WebGL, API, catalogo e UX contestuale. |
| Prestazioni | Playwright headed + telemetria Three.js | 40 hold, FPS, long task, heartbeat e endpoint. |
| Tracciabilità | Script Node.js | Presenza requisiti nella matrice e percorsi delle evidenze. |

## Backend

Dalla cartella `source`:

```powershell
$env:ContinuousIntegrationBuild = "true"
dotnet restore .\TheRouteSetter.sln --locked-mode
dotnet build .\TheRouteSetter.sln --configuration Release --no-restore
dotnet test .\TheRouteSetter.sln --configuration Release --no-build --no-restore --logger "trx;LogFileName=backend-tests.trx" --results-directory .\TestResults
```

Risultato atteso: 33 test xUnit superati e file `source/TestResults/backend-tests.trx`.

Il risultato 33/33 appartiene alla verifica precedente: backend invariato e non rieseguito in questo turno.

La suite copre:

- bootstrap, health e Swagger;
- discovery e distribuzione degli asset;
- manifest e content disposition;
- Convex Hull mancante, riusato e rigenerato dopo cambio hash;
- validazione geometrica del collider;
- middleware errori e correlation ID;
- logging asincrono, sanitizzazione e retention.

## Frontend Unit E Fisica Headless

Dalla cartella `source/frontend`:

```powershell
npm ci
npm test
```

Risultato finale verificato e comunicato dall'utente per `DEC-026`: `331/331` test Vitest superati in `12` file. Non rieseguiti per questo aggiornamento documentale. Il risultato del primo gruppo `DEC-025` resta storico e invariato: `215/215` in `11` file e build frontend superata.

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

Risultati verificati e comunicati dall'utente, non nuove esecuzioni di questo aggiornamento documentale. Asset parete e collider originali Hold1/Hold2 invariati. La baseline laterale usa `9` pose per hold; la griglia separata usa `52` pose per hold.

| Tolleranza parete | Baseline Hold1 / Hold2 (su 9 ciascuna) | Griglia Hold1 / Hold2 (su 52 ciascuna) |
|---|---|---|
| `1 mm` | `3 / 3` | `8 / 7` |
| `3 mm` | `7 / 7` | `29 / 29` |
| `5 mm` | `9 / 9` | `45 / 45` |
| `10 mm` | `9 / 9` | `46 / 46` |

Gli scontri profondi parete di circa `120 mm` per Hold1 e `200 mm` per Hold2 sono bloccati a tutte le soglie verificate. Sui target precedentemente rifiutati con profondita circa `4 mm`, passi locali `+/-1 cm` e twist `+/-1 grado` falliscono a `1` e `3 mm`, passano a `5` e `10 mm`. `realWall.test.ts` copre baseline, scontri profondi e passi/twist con controlli di determinismo e assenza mutazioni; la griglia e evidenza separata comunicata dall'utente, non va attribuita a un test automatico non presente.

Prove utente consigliate: `1 mm` baseline, `3 mm` conservativa, `5 mm` raccomandata, `7.5` e `10 mm` esplorative. Non sono garanzie su tutte le superfici o imperfezioni fotografiche/fotogrammetriche. Gap `5 mm`, angolo `5 gradi`, soglia hold `1 mm` ed epsilon restano invariati. Esito finale in [Wall_tolerance_configuration_done.md](../phases-outcome/Wall_tolerance_configuration_done.md); nessun report storico viene modificato.

Questi casi non certificano geometrie arbitrarie degeneri o volumi solidi: Rapier `0.12.0` puo sottostimare la profondita per faccia vicino alle giunzioni interne dei triangoli e non rileva il contenimento completo in un TriMesh chiuso senza intersezione superficiale. Il follow-up numerico resta aperto in `DEC-025`; il budget `512` e il bound `2e-6 m` arrestano gli intervalli irrisolti, ma non eliminano tali limiti delle query native.

Per produrre JUnit:

```powershell
npm run test:unit:ci
```

Output: `source/frontend/test-results/vitest-junit.xml`.

## End-To-End

Installare Chromium una volta:

```powershell
npx playwright install chromium
```

Eseguire:

```powershell
npm run test:e2e
```

Risultato storico verificato e confermato dall'utente per `DEC-025`: `31/31` E2E superati, zero errori pageerror/console/HTTP nella traccia. La suite comprende startup, navigazione camera, catalogo, dettaglio 3D, caricamento/rimozione, export, popup, `Escape`, targeting, aggancio, sgancio, movimento globale fra pannelli, rotazione, shadow, commit/rollback e cleanup `pointercancel`. Le regressioni in `selection-input.spec.ts` verificano inoltre feedback `hold-collision`, assenza superficie, no-change distinto da collisione e ripristino coerente di posa/preview. Non rieseguiti per questo aggiornamento documentale.

Risultato finale E2E `DEC-026` verificato e comunicato dall'utente: `43/43` superati. `tests/e2e/physics-config.spec.ts` verifica file reale a `5 mm`, una richiesta al bootstrap e nessuna durante interazioni, cambio a `3`/`10 mm` applicato solo al reload, hold sempre `1 mm` nello snapshot, avvio impedito con errore in pagina per config invalida/assente, HTTP, JSON con commenti o rete interrotta. I test richiedono assenza di `pageerror` non gestiti anche nei casi negativi; gli errori HTTP/rete deliberatamente provocati non equivalgono alla precedente attestazione di zero errori HTTP nella traccia. Non rieseguiti in questo aggiornamento documentale.

Verifica produzione separata, confermata dall'utente: su una build di produzione in `dist` temporanea, modifica del file runtime effettivamente servito `physics-config.json` da `5` a `3` e poi a `5`, con reload della pagina e applicazione dei valori verificata senza rebuild fra le modifiche. E una prova sul file reale distribuito, distinta dal routing simulato degli E2E; conferma che il valore non e incorporato nel bundle. Backend non modificato; nessuna nuova verifica backend o certificazione prestazionale implicita.

In CI `npm run test:e2e:ci` produce:

- `test-results/playwright-junit.xml`;
- `playwright-report/index.html`;
- screenshot soltanto in caso di fallimento.

La suite automatica corrente usa Chromium. Chrome, Edge e Firefox stabili richiedono smoke manuale di compatibilità finché non vengono aggiunti come progetti Playwright dedicati.

## Gate Aggregato

Dalla cartella `source/frontend`:

```powershell
$env:CI = "true"
npm run test:ci
```

Il comando esegue build, tracciabilita, documentazione, Vitest e Playwright. Il workflow GitHub Actions esegue inoltre backend, verifica lockfile e pubblicazione artifact. Per il solo aggiornamento documentale usare `npm run test:docs` e `npm run test:traceability`: questi gate controllano struttura, riferimenti e JSDoc previsti, non certificano i risultati fisici/E2E o il completamento del gruppo differito backend/catalogo/errori globali.

## Tracciabilità

```powershell
npm run test:traceability
```

Lo script confronta `sdd-specs/01-specifica-requisiti.md`, `sdd-specs/04-tracciabilita.md` e `source/test-traceability.json`. Fallisce se un requisito non compare nella matrice, se manca un'evidenza delle fasi 10-12 o se un percorso registrato non esiste. `REQ-TST-008` è escluso perché storico e congelato.

## Benchmark Fase 11

Il benchmark certificativo richiede una sessione desktop e accelerazione WebGL hardware:

```powershell
$env:PERF_HEADLESS = "false"
$env:PERF_DURATION_MS = "60000"
$env:PERF_HOLD_COUNT = "40"
npm run test:performance
```

Il test usa una build di produzione, viewport `1920x1080`, 40 identità distinte e due asset reali alternati. Ogni identità crea una mesh, un rigid body e un collider. Gli FPS sono conteggiati sulle chiamate effettive a `renderer.render` in finestre da un secondo.

Gate:

- esattamente 40 hold;
- almeno 60 secondi misurati;
- FPS mediano almeno 30;
- nessun long task oltre 200 ms durante caricamento, aggancio o interazione;
- heartbeat p95 non oltre 200 ms;
- endpoint tipico non oltre 50 ms e massimo non oltre 100 ms;
- nessun errore pagina.

Risultato storico della fase 11: 60 FPS mediani per `60.150,4 ms`, endpoint `2,8 ms`, long task massimo di caricamento `80 ms`, nessun long task durante l'interazione. I dati completi sono in `phases-outcome/Phase_11_performance_results.json`; non sono una nuova misura del primo gruppo corrente.

La modalità headless è utile solo come smoke del runner: normalmente usa SwiftShader e può applicare throttling a RAF, quindi non certifica `REQ-PRF-001` o il target FPS.

Misure correnti confermate per il primo gruppo: benchmark Node su 40 hold reali, mediane endpoint `1.7-6.3 ms` e massimo `8.4 ms`; mediane click `24-59 ms` e massimo `84 ms`. Sono misure delle query fisiche, non una certificazione di rendering, reattivita browser o prestazioni hardware.

La suite prestazionale headless con SwiftShader e FALLITA: `3 FPS` contro target `30`, long task massimo `829 ms`, heartbeat `748 ms` (soglia `200 ms`). Il rendering software non fornisce evidenza sul profilo hardware richiesto: il fallimento resta tale, non viene convertito in pass ne compensato dal benchmark Node o dal risultato storico della fase 11. La certificazione su hardware target resta da eseguire.

## Lockfile

Dalla radice Git:

```powershell
git diff --exit-code -- gpt-5.6-sol/the-route-setter-beta/source/frontend/package-lock.json gpt-5.6-sol/the-route-setter-beta/source/backend/src/TheRouteSetter.Api/packages.lock.json gpt-5.6-sol/the-route-setter-beta/source/backend/tests/TheRouteSetter.Api.Tests/packages.lock.json
```

Il comando deve terminare senza differenze dopo `npm ci` e `dotnet restore --locked-mode`.

## Risultati Correnti

| Gate | Esito e provenienza |
|---|---:|
| Produzione frontend | Build in dist temporanea: file reale `5 -> 3 -> 5` applicato al reload senza rebuild, verifica finale comunicata dall'utente |
| Vitest | DEC-026 finale: `331/331`, 12 file, verificati e comunicati dall'utente; DEC-025 storico: `215/215`, 11 file |
| Playwright | DEC-026 finale: `43/43`, verificati e comunicati dall'utente; DEC-025 storico: `31/31`, zero errori pageerror/console/HTTP nella traccia |
| Build backend Release | Evidenza precedente: 0 warning, 0 errori; backend invariato |
| xUnit | `33/33` precedente, non rieseguito in questo turno |
| Tracciabilità | 102 requisiti nella matrice |
| Benchmark Node | 40 hold reali; endpoint mediane 1.7-6.3 ms/max 8.4 ms, click mediane 24-59 ms/max 84 ms; non certificativo |
| Performance headless SwiftShader | FAIL: 3 FPS, long task max 829 ms, heartbeat 748 ms; nessuna certificazione hardware |

## Diagnostica Fallimenti

- Consultare TRX, JUnit, report HTML e screenshot prodotti.
- Ripetere prima il singolo file o test fallito, senza retry.
- Verificare porte `5173/5080` per E2E e `5174/5081` per benchmark.
- Controllare `pageerror`, risposta health e disponibilità WebGL 2.0.
- Consultare in sola lettura `window.__ROUTE_SETTER_SCENE__.lastActionResult.reason` e `lastPoseDiagnostic` come descritto in `docs/applicazione.md`: distinguere collisione, assenza superficie, no-op e percorso irrisolto; lo snapshot dell'ultima query puo precedere l'azione corrente e non e un log persistente o una telemetria di rete per frame.
- Non usare risultati headless software per certificare le prestazioni hardware.
