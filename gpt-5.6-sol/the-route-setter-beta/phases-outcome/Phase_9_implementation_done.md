# Fase 9 - Implementazione completata

## 1. File modificati

### Pipeline export frontend

- `source/frontend/src/export/guideImage.ts`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`

### Correzione nome asset statici

- `source/backend/src/TheRouteSetter.Api/Controllers/HoldsController.cs`
- `source/backend/src/TheRouteSetter.Api/Controllers/WallController.cs`

### Test

- `source/frontend/tests/export/guideImage.test.ts`
- `source/frontend/tests/e2e/export.spec.ts`
- `source/frontend/tests/e2e/model-download.spec.ts`
- `source/backend/tests/TheRouteSetter.Api.Tests/AssetApiIntegrationTests.cs`

### Esito fase

- `phases-outcome/Phase_9_implementation_done.md`

## 2. Requisiti coperti

- `REQ-IMG-001`: export con camera `OrthographicCamera` dedicata, posizionata frontalmente lungo `+Z` e orientata verso il centro della scena esportabile.
- `REQ-IMG-002`: UI esclusa dal rendering perché il JPG è prodotto da un renderer Three.js temporaneo; durante l'operazione topbar, catalogo e controlli sono inoltre nascosti tramite stato `data-exporting`; sfondo bianco.
- `REQ-IMG-003`: download di un file JPEG valido con firma SOI/EOI verificata.
- `REQ-IMG-004`: lato lungo effettivo pari a 2560 px, lato corto proporzionale e qualità passata a `canvas.toBlob` pari a `0.90`.
- `REQ-UI-002`: bottone superiore `Genera immagine` abilitato e collegato alla pipeline export.

Comportamenti aggiuntivi verificati:

- parete e hold presenti in scena incluse nel bounding frontale;
- evidenziazione della hold selezionata rimossa durante export e ripristinata dopo;
- camera interattiva e target OrbitControls invariati;
- sfondo scena ripristinato in `finally`;
- renderer e contesto WebGL temporanei rilasciati;
- UI ripristinata anche in caso di errore;
- nome download `the-route-setter-guide.jpg`.

## 3. Test eseguiti e storico risultati

1. Verifica stato fase 9 dopo interruzione: pipeline e test parziali presenti, ma nessun report `Phase_9`.
2. Revisione test E2E: il test precedente non leggeva realmente il file scaricato e non verificava dimensioni JPEG.
3. Test E2E esteso con lettura stream Playwright, firma JPEG, terminatore, dimensioni SOF e lato lungo 2560.
4. Restore frontend `npm ci --ignore-scripts`: superato.
5. Build frontend: superata con warning bundle già noto.
6. Vitest iniziale: 37/37 superati, inclusi 4 test dimensioni export.
7. Primo E2E export reale: superato; JPG valido e ripristino scena/UI confermato.
8. Revisione visiva: individuato che l'evidenziazione selezione poteva essere inclusa nell'immagine.
9. Correzione: materiali originali ripristinati temporaneamente durante export e nuova evidenziazione applicata nel `finally`.
10. E2E export esteso con Hold1 selezionata: superato; istanza e selezione invariati dopo export.
11. Correzione separata filename GLB: `Content-Disposition inline` con nome fisico per parete e asset hold.
12. Backend build/test dopo correzione header: 33/33 superati.
13. Primo E2E filename: fallito perché `page.setContent` usava origine `about:blank`, non per difetto endpoint.
14. Test corretto mantenendo origine applicativa: nome suggerito `hold1.glb`, superato.
15. Build frontend successiva: superata.
16. Regressione backend finale: 33/33 superati, 0 warning/errori.
17. Regressione Vitest finale: 37/37 superati.
18. Suite Playwright completa finale: 17/17 superati in una singola esecuzione seriale.

I test export verificano:

- dimensioni orizzontali e verticali proporzionali;
- costanti 2560 px e qualità 0.90;
- rifiuto dimensioni non valide;
- nome file JPG;
- dimensione file maggiore di 10 kB;
- marker JPEG `FFD8` e `FFD9`;
- dimensioni codificate nel JPEG e lato lungo 2560;
- ripristino attributo UI;
- pulsante nuovamente abilitato;
- catalogo e canvas nuovamente visibili;
- camera, target, hold e selezione invariati.

## 4. Limiti e blocchi

Nessun blocco residuo per la fase 9.

- L'export crea temporaneamente un canvas ad alta risoluzione; su hardware con limiti WebGL inferiori a 2560 px fallirà con messaggio utente e ripristino garantito.
- Il renderer export usa gli stessi materiali e luci della scena interattiva, sostituendo esclusivamente camera e sfondo.
- Il bundle frontend resta oltre la soglia Vite, limite già documentato per la fase performance.
- `npm audit` continua a segnalare 5 vulnerabilità transitive della baseline vincolata.

## 5. Verifica manuale

Da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run build
npm test
```

E2E su porte isolate:

```powershell
$env:DOTNET_COMMAND = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\FCurati\AppData\Local\Temp\opencode\playwright"
$env:E2E_FRONTEND_PORT = "5228"
$env:E2E_BACKEND_PORT = "5057"
npm run test:e2e
```

Risultati attesi: 37 Vitest, 33 xUnit e 17 Playwright superati.

Verifica browser:

1. aggiungere e selezionare una hold;
2. premere `Genera immagine`;
3. verificare download `the-route-setter-guide.jpg`;
4. verificare immagine frontale su bianco, senza UI o evidenziazione;
5. verificare che scena, camera, selezione e controlli restino invariati.
