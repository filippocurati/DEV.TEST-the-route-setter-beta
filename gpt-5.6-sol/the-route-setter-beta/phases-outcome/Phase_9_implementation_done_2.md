# Fase 9 - Reimplementazione vista corrente completata

## 1. File modificati

- `source/frontend/src/export/guideImage.ts`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/tests/export/guideImage.test.ts`
- `source/frontend/tests/e2e/export.spec.ts`
- `source/frontend/playwright.config.ts`
- `phases-outcome/Phase_9_implementation_done_2.md`

Il precedente `Phase_9_implementation_done.md` non e stato sovrascritto e documenta la precedente versione ortografica conforme alle specifiche allora vigenti.

## 2. Requisiti coperti

- `REQ-IMG-001`: clone della camera prospettica corrente con posizione, quaternion, FOV, zoom, near, far e aspect equivalenti.
- `REQ-IMG-002`: renderer Three.js temporaneo della sola scena, senza DOM/UI, con sfondo corrente invariato.
- `REQ-IMG-003`: JPG valido ad alta risoluzione.
- `REQ-IMG-004`: lato lungo 2560 px, lato corto proporzionale alla viewport corrente, qualità 0.90.
- `REQ-UI-002`: comando `Genera immagine` operativo e stato UI ripristinato.

Sono preservati anche output color space, tone mapping, esposizione e configurazione shadow del renderer interattivo.

## 3. Test eseguiti e storico risultati

1. Verifica specifiche aggiornate: confermato obbligo vista corrente e divieto camera ortografica.
2. Sostituita pipeline bounding/ortografica con clone `PerspectiveCamera`.
3. Aggiornati test unitari dimensioni viewport e snapshot camera.
4. Build frontend: superata.
5. Vitest: 38/38 superati.
6. E2E export isolato: superato con camera orbitata, zoomata e pannata.
7. Verifica JPG: firma SOI/EOI, file >10 kB, lato lungo 2560, aspect proporzionale alla viewport.
8. Verifica equivalenza camera export: posizione, quaternion, FOV, zoom, near/far e aspect.
9. Verifica ripristino: camera, target, hold, selezione, UI e pulsante invariati.
10. Prima build backend Debug: fallita per lock su `TheRouteSetter.Api.exe` causato da un processo utente attivo PID 25628; processo non terminato.
11. Build backend Release separata: superata con 0 warning e 0 errori.
12. xUnit backend Release: 33/33 superati.
13. Prima suite E2E con DLL Release avviata direttamente: fallita perché il content root non puntava al progetto e gli asset non erano trovati.
14. Configurazione Playwright estesa con `E2E_BACKEND_COMMAND` e `E2E_REUSE_SERVER`.
15. Suite E2E completa con `dotnet run --configuration Release --no-build`: 17/17 superati.

## 4. Limiti e blocchi

Nessun blocco residuo.

- Un backend Debug dell'utente era attivo e bloccava l'eseguibile; i test hanno usato output Release senza interrompere il processo.
- L'export crea un canvas temporaneo 2560 px e richiede supporto WebGL adeguato.
- Il bundle Vite e le vulnerabilità npm transitive restano limiti già documentati.

## 5. Verifica manuale

Da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run build
npm test
```

E2E con backend Release se un processo Debug e già aperto:

```powershell
$env:DOTNET_COMMAND = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:E2E_FRONTEND_PORT = "5233"
$env:E2E_BACKEND_PORT = "5052"
$env:E2E_BACKEND_COMMAND = '"C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe" run --configuration Release --no-build --no-launch-profile --project ../backend/src/TheRouteSetter.Api/TheRouteSetter.Api.csproj --urls http://127.0.0.1:5052'
npm run test:e2e
```

Risultati attesi: 38 Vitest, 33 xUnit e 17 Playwright superati.

Verifica browser:

1. orientare, zoomare e spostare la camera;
2. premere `Genera immagine`;
3. verificare che il JPG corrisponda alla vista corrente e allo sfondo viewport;
4. verificare assenza di catalogo/menu/controlli;
5. verificare che la scena interattiva resti nella stessa posizione dopo il download.
