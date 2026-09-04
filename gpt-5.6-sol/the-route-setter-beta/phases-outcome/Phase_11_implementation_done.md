# Fase 11 - Benchmark prestazionale completato

## 1. Stato

La FASE 11 e completata. Il benchmark normativo e stato eseguito con successo su una macchina fisica dotata di GPU integrata Intel WebGL 2.0, con:

- 40 hold interattive e parete reale;
- 40 rigid body e 40 collider hold, oltre al corpo/collider della parete;
- viewport browser `1920x1080`, device scale factor `1`;
- build frontend di produzione;
- Chromium Playwright headed;
- finestra misurata superiore a 60 secondi;
- sequenza orbit deterministica e continua;
- validazione endpoint reale con 40 collider presenti.

Il risultato machine-readable e salvato in `phases-outcome/Phase_11_performance_results.json`.

## 2. File modificati

### Benchmark e configurazione

- `source/frontend/tests/performance/phase11.spec.ts`
- `source/frontend/playwright.performance.config.ts`
- `source/frontend/package.json`
- `source/frontend/vite.config.ts`
- `.gitignore`

### Telemetria e ottimizzazioni

- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/src/physics/physicsWorld.ts`
- `source/frontend/src/holds/holdResources.ts`
- `source/frontend/src/main.ts`

### Tracciabilita e risultati

- `source/test-traceability.json`
- `source/scripts/check-test-traceability.mjs`
- `sdd-specs/02-design-tecnico.md`
- `sdd-specs/04-tracciabilita.md`
- `phases-outcome/Phase_11_performance_results.json`
- `phases-outcome/Phase_11_implementation_done.md`

## 3. Requisiti coperti

| Requisito | Evidenza |
|---|---|
| `REQ-PRF-001` | Esecuzione headed su HP ProBook 460 G11 con Intel Graphics WebGL 2.0. |
| `REQ-PRF-002` | 40 hold, 41 rigid body e 41 collider verificati nel benchmark. |
| `REQ-PRF-003` | Render al massimo una volta per frame, endpoint `2,8 ms`, nessun long task durante interazione. |
| `REQ-PRF-004` | Mediana `60 FPS`, superiore al target indicativo di 30 FPS. |
| `REQ-PRF-005` | Caricamento cooperativo: long task massimo `80 ms`; interazione: nessun long task. |
| `REQ-PRF-006` | Scenario `1920x1080`, 40 hold, durata `60.150,4 ms`, sequenza orbit deterministica. |

## 4. Metodo

Il benchmark usa `vite preview` per eseguire gli artifact di produzione. La fixture Playwright sostituisce soltanto il manifest con 40 identificatori univoci e alterna gli URL dei due asset reali disponibili. Ogni elemento viene comunque inserito attraverso il normale flusso applicativo e crea:

- un'istanza Three.js distinta;
- un rigid body cinematico distinto;
- un collider Convex Hull distinto;
- una posizione deterministica non compenetrante.

La telemetria e abilitata esclusivamente con `?performance=1`. Conta le chiamate reali a `renderer.render`, non i soli callback RAF del browser. Gli FPS sono calcolati in finestre complete da un secondo e la mediana delle finestre e il gate normativo.

Long Tasks API e heartbeat misurano separatamente:

- caricamento e posizionamento delle 40 hold;
- aggancio iniziale;
- finestra interattiva da 60 secondi.

Il gate di blocco usa la metrica normativa dei long task oltre `200 ms`; il percentile 95 dell'heartbeat resta un controllo aggiuntivo contro ritardi diffusi del main thread.

## 5. Risultati benchmark finale

### Ambiente

- Data: 4 settembre 2026.
- Sistema: HP ProBook 460 16 inch G11 Notebook PC.
- CPU: Intel Core Ultra 7 155H, 16 core, 22 processori logici.
- RAM: 16.613.027.840 byte.
- GPU integrata: Intel Graphics, driver `32.0.101.8508`.
- WebGL: `WebGL 2.0 (OpenGL ES 3.0 Chromium)`.
- Renderer: `ANGLE (Intel, Intel(R) Graphics (0x00007DD5) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- Browser: Chromium Playwright 1.44.0, headed.

### Scena

- Hold: `40`.
- Rigid body totali: `41`.
- Collider totali: `41`.
- Triangoli renderizzati per frame: `2.285.242`.
- Draw call per frame: `41`.
- Geometrie GPU: `3` grazie alla condivisione per URL modello.
- Canvas CSS: `1616 x 1004,325 px` dentro viewport `1920 x 1080`.
- Drawing buffer: `1616 x 1004 px`.

### Rendering 60 secondi

- Durata misurata: `60.150,4 ms`.
- Frame renderizzati: `3.611`.
- FPS mediano: `60`.
- FPS medio: `60,03`.
- FPS minimo per finestra completa: `60`.
- Durata render p95: `0,6 ms`.

### Responsivita

- Long task durante interazione: `0`.
- Massimo long task durante interazione: `0 ms`.
- Ritardo heartbeat massimo durante interazione: `40,4 ms`.
- Ritardo heartbeat p95 durante interazione: `1 ms`.
- Long task durante caricamento delle 40 hold: `2`.
- Massimo long task durante caricamento: `80 ms`, sotto il limite di `200 ms`.
- Ritardo heartbeat p95 durante caricamento: `25,7 ms`.
- Long task durante aggancio: `0`.

### Endpoint

- Validazioni endpoint misurate: `1`.
- Latenza p50: `2,8 ms`.
- Latenza massima: `2,8 ms`.
- Limite tipico: `50 ms`.
- Limite complesso: `100 ms`.

Esito benchmark: PASS.

## 6. Ottimizzazioni applicate

Il primo run completo aveva FPS mediano pari a `60`, ma rilevava una validazione endpoint di circa `598 ms` e un long task di caricamento di `844 ms`. Sono state applicate le seguenti correzioni misurate:

- `validatePose` usa la broad phase Rapier `intersectionsWithShape` e applica il controllo preciso `contactShape` soltanto ai collider candidati;
- modelli con lo stesso URL condividono download, parsing, geometrie e texture tramite cache con reference counting;
- documenti collider con lo stesso URL vengono caricati una sola volta per scena;
- la griglia ordinata dei candidati spawn viene costruita una sola volta;
- la scansione spawn mantiene l'ordine deterministico ma cede il main thread ogni 16 ms;
- l'inserimento rimuove soltanto la card usata invece di ricostruire l'intero catalogo DOM.

Dopo le ottimizzazioni:

- endpoint: da circa `598 ms` a `2,8 ms`;
- massimo long task di caricamento: da `844 ms` a `80 ms`;
- geometrie GPU per 40 hold alternate: da `41` a `3`;
- FPS mediano invariato a `60`.

## 7. Storico esecuzioni

1. Primo smoke headless 4 hold: bloccato per pattern route manifest troppo ampio e porta proxy errata.
2. Correzione route/proxy e allegato JSON: scenario completato ma RAF headless throttled a circa 2 FPS con renderer SwiftShader; run non valido come certificazione hardware.
3. Primo run headed 40 hold/60 s: 60 FPS mediani, ma metriche di setup aggregate mostravano long task `844 ms` ed endpoint circa `598 ms`.
4. Separazione finestre di misura e broad phase Rapier: smoke 40 hold verde, endpoint circa `3 ms`.
5. Cache modello con reference counting: geometrie GPU ridotte da 41 a 3.
6. Cache collider e griglia spawn: regressioni unit superate.
7. Rimozione rerender completo del catalogo a ogni inserimento: riduzione del lavoro DOM crescente.
8. Spawn cooperativo ogni 16 ms: massimo long task caricamento ridotto a `70-80 ms` negli ultimi run.
9. Smoke headed 40 hold/5 s finale: PASS, 60 FPS, endpoint `3,7 ms`, nessun long task interattivo.
10. Benchmark headed 40 hold/60 s finale: PASS con le metriche della sezione 5.
11. Vitest finale: `46/46` superati su 9 file.
12. Playwright regressione finale: `26/26` superati.
13. Restore NuGet locked: superato.
14. Build backend Release: 0 warning, 0 errori.
15. xUnit backend Release: `33/33` superati.

## 8. Limiti

- Il catalogo reale contiene due asset; il benchmark crea 40 identita distinte alternando tali asset senza duplicare file nel repository.
- Il tempo end-to-end per aggiungere una singola hold include automazione Playwright e attese UI; il gate di blocco usa Long Tasks API e heartbeat nel browser.
- Il benchmark headed richiede una sessione desktop con accelerazione WebGL. La modalita headless usa SwiftShader e non e valida per certificare `REQ-PRF-001` o il target FPS.
- Il bundle Vite resta superiore a 500 kB; non ha impedito il superamento dei gate runtime.

## 9. Verifica manuale

Dalla cartella `source/frontend`:

```powershell
$env:PERF_HEADLESS = "false"
$env:PERF_DURATION_MS = "60000"
$env:PERF_HOLD_COUNT = "40"
npm run test:performance
```

Per uno smoke diagnostico non certificativo:

```powershell
$env:PERF_HEADLESS = "false"
$env:PERF_DURATION_MS = "5000"
$env:PERF_HOLD_COUNT = "40"
npx playwright test --config=playwright.performance.config.ts
```

I risultati grezzi del run vengono prodotti in `source/frontend/performance-results/playwright.json`; il risultato certificativo consolidato e versionato in `phases-outcome/Phase_11_performance_results.json`.
