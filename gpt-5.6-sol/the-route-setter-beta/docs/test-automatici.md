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

Risultato atteso: 46 test Vitest su 9 file.

La suite copre:

- stato catalogo e caricamento preview;
- comandi incrementali;
- campionamento a 37 punti e superficie dominante;
- matematica di orientamento e normale;
- generazione JPG;
- TriMesh parete e spawn deterministico;
- cinque scenari fisici obbligatori;
- ripetibilità delle decisioni di collisione.

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

Risultato atteso: 26 test Playwright superati. Sono coperti startup, navigazione camera, catalogo, dettaglio 3D, caricamento/rimozione, export, popup, `Escape`, targeting, aggancio, sgancio, movimento, rotazione, shadow, commit/rollback e cleanup `pointercancel`.

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

Il comando esegue build, tracciabilità, Vitest e Playwright. Il workflow GitHub Actions esegue inoltre backend, verifica lockfile e pubblicazione artifact.

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

Risultato certificativo corrente: 60 FPS mediani per `60.150,4 ms`, endpoint `2,8 ms`, long task massimo di caricamento `80 ms`, nessun long task durante l'interazione. I dati completi sono in `phases-outcome/Phase_11_performance_results.json`.

La modalità headless è utile solo come smoke del runner: normalmente usa SwiftShader e può applicare throttling a RAF, quindi non certifica `REQ-PRF-001` o il target FPS.

## Lockfile

Dalla radice Git:

```powershell
git diff --exit-code -- gpt-5.6-sol/the-route-setter-beta/source/frontend/package-lock.json gpt-5.6-sol/the-route-setter-beta/source/backend/src/TheRouteSetter.Api/packages.lock.json gpt-5.6-sol/the-route-setter-beta/source/backend/tests/TheRouteSetter.Api.Tests/packages.lock.json
```

Il comando deve terminare senza differenze dopo `npm ci` e `dotnet restore --locked-mode`.

## Risultati Attesi Correnti

| Gate | Risultato atteso |
|---|---:|
| Build frontend | Superata |
| Vitest | `46/46` |
| Playwright | `26/26` |
| Build backend Release | 0 warning, 0 errori |
| xUnit | `33/33` |
| Tracciabilità | 102 requisiti nella matrice |
| Benchmark | 40 hold, 60 s, mediana >=30 FPS |

## Diagnostica Fallimenti

- Consultare TRX, JUnit, report HTML e screenshot prodotti.
- Ripetere prima il singolo file o test fallito, senza retry.
- Verificare porte `5173/5080` per E2E e `5174/5081` per benchmark.
- Controllare `pageerror`, risposta health e disponibilità WebGL 2.0.
- Non usare risultati headless software per certificare le prestazioni hardware.
