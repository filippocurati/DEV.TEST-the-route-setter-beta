# Fase 4 - Implementazione completata

## 1. File modificati

### Configurazione frontend

- `source/frontend/package.json`
- `source/frontend/package-lock.json`
- `source/frontend/vite.config.ts`
- `source/frontend/vitest.config.ts`
- `source/frontend/playwright.config.ts`

### Bootstrap e interfaccia

- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`

### API e scena Three.js

- `source/frontend/src/api/wallApi.ts`
- `source/frontend/src/scene/wallLoader.ts`
- `source/frontend/src/scene/wallTriMesh.ts`
- `source/frontend/src/scene/wallScene.ts`

### Test frontend

- `source/frontend/tests/scene/wallTriMesh.test.ts`
- `source/frontend/tests/e2e/startup.spec.ts`

### Esito fase

- `phases-outcome/Phase_4_implementation_done.md`

## 2. Requisiti coperti

- `REQ-SCN-004`: il frontend richiede automaticamente `GET /api/wall`, interpreta il GLB nel browser e mostra la parete senza input utente.
- `REQ-UI-003`: navigazione implementata con `OrbitControls`, inclusi orbit, zoom e pan; target iniziale impostato sul centro del bounding box della parete e mantenuto valido durante l'interazione.
- `REQ-FIS-001`: la scena usa il sistema destrorso nativo di Three.js e non applica conversioni arbitrarie di scala; 1 unita del modello corrisponde a 1 metro applicativo.
- `REQ-FIS-013` parte fase 4: geometria TriMesh derivata lato client da vertici e triangoli del GLB, applicando le trasformazioni mondo; dati fisici mantenuti separati dalla mesh grafica. La creazione del collider statico Rapier appartiene alla fase 5.

Vincoli costituzionali rispettati:

- rendering esclusivamente client-side con Three.js (`C1`);
- nessuna simulazione fisica nel backend (`C2`);
- nessuna chiamata REST nel ciclo di rendering o durante OrbitControls (`C3`);
- separazione tra oggetto grafico e dati TriMesh (`C6`);
- TriMesh parete generato esclusivamente nel frontend (`C8`);
- sistema di coordinate Three.js senza conversioni di unita (`C9`).

## 3. Test eseguiti e storico risultati

1. Installazione deterministica frontend con `npm ci --ignore-scripts`: superata. npm segnala le 5 vulnerabilita gia note nella baseline.
2. Prima build frontend dopo l'implementazione: fallita per assenza delle dichiarazioni TypeScript di Three.js e un controllo E2E nullable.
3. Prima esecuzione Vitest: superata, 4 test su 4. Confermata estrazione TriMesh anche prima della correzione di tipizzazione.
4. Verifica registry npm: disponibili `@types/three` `0.161.0`, `0.161.1`, `0.161.2`. Scelta la versione esatta `0.161.0`, corrispondente a `three@0.161.0`.
5. Aggiornamento lockfile, reinstallazione deterministica e seconda build frontend: superata. Vite segnala un chunk da circa 572 kB dopo minificazione.
6. Prima esecuzione Playwright con backend e asset reali: test auto-load/TriMesh superato; test OrbitControls fallito per timeout durante un drag multi-step sul modello reale da 27.055.868 byte.
7. Ottimizzazione rendering: rimossa animazione continua non necessaria nella scena statica; rendering ora eseguito su cambi OrbitControls e resize. Ridotti i drag E2E a singoli spostamenti mantenendo orbit, zoom e pan reali.
8. Seconda build frontend: superata.
9. Seconda esecuzione Playwright: 2 test su 2 superati; auto-load/TriMesh in circa 5,4 secondi e interazione camera in circa 10,9 secondi.
10. Regressione backend completa: restore locked-mode superato; build con 0 warning e 0 errori; 33 test xUnit su 33 superati.
11. Prima regressione frontend dopo portabilita Playwright: `npm ci` superato, build fallita per riferimento a `process` senza tipi Node.
12. Correzione portabile senza nuova dipendenza: accesso tipizzato opzionale a `globalThis.process`, variabile `DOTNET_COMMAND` con fallback `dotnet`.
13. Build frontend successiva: superata.
14. Vitest: 4 test su 4 superati.
15. Playwright: 2 test su 2 superati con backend reale.
16. Rafforzamento test target camera in rapporto alla dimensione parete e aggiunta viewport mobile 390x844.
17. Build frontend finale: superata.
18. Playwright finale: 3 test su 3 superati, inclusi auto-load/TriMesh, orbit/zoom/pan e mobile.
19. Vitest finale: 4 test su 4 superati.
20. Verifica lockfile: `three@0.161.0`, `@types/three@0.161.0`, `vite@5.2.0` e `typescript@5.4.5` presenti con versioni dirette esatte.

I test automatici verificano:

- estrazione di vertici e indici da geometrie indicizzate;
- generazione di indici sequenziali per geometrie non indicizzate;
- applicazione delle trasformazioni mondo;
- rifiuto di una parete priva di triangoli;
- caricamento automatico del modello reale via API;
- presenza del canvas WebGL;
- cardinalita positiva e triangolare del TriMesh;
- coincidenza iniziale tra target OrbitControls e centro parete;
- modifica della camera tramite orbit, zoom e pan;
- target finito e ancora entro una distanza proporzionata alla parete;
- layout e caricamento su viewport mobile.

## 4. Limiti e blocchi

Nessun blocco residuo per la fase 4.

- Il file reale `main-wall/modello_parete.glb` pesa circa 27 MB; in Chromium headless il caricamento iniziale richiede indicativamente 5-6 secondi. L'interfaccia mostra lo stato `Caricamento parete...` fino al completamento.
- Il bundle JavaScript minificato e circa 572 kB, prevalentemente dovuto a Three.js e GLTFLoader. Vite emette un warning oltre 500 kB; la verifica e l'eventuale code splitting appartengono alle fasi di performance.
- Il rendering e on-demand per evitare consumo continuo su una scena ancora statica. Le fasi con movimento/animazione potranno richiedere un scheduler di rendering controllato.
- La fase produce i dati TriMesh ma non inizializza ancora Rapier ne crea il collider fisico: questa responsabilita e esplicitamente prevista dalla fase 5.
- Non sono stati implementati catalogo, menu comandi o layout finale, appartenenti alle fasi successive.
- Gli E2E avviano backend e frontend insieme. La configurazione usa `DOTNET_COMMAND` se impostato, altrimenti il comando globale `dotnet`.
- `npm audit` continua a segnalare 5 vulnerabilita nelle dipendenze transitive della baseline vincolata; nessuna versione e stata aggiornata fuori da `OPEN-003`.

## 5. Verifica manuale

### Avvio backend

Da `source`:

```powershell
$dotnet = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
& $dotnet run --no-launch-profile `
  --project "backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj" `
  --urls "http://127.0.0.1:5080"
```

Il backend usa logging su file e puo non mostrare messaggi in console. Verificare:

```powershell
Invoke-RestMethod "http://127.0.0.1:5080/api/system/health"
```

### Avvio frontend

In un secondo terminale da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run dev
```

Aprire `http://127.0.0.1:5173`. La pagina deve passare da `Caricamento parete...` a `Parete pronta`. Trascinare con il pulsante sinistro per orbit, usare la rotella per zoom e il pulsante destro per pan.

### Build e test frontend

Da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
$env:DOTNET_COMMAND = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\FCurati\AppData\Local\Temp\opencode\playwright"
npm ci
npm run build
npm test
npm run test:e2e
```

Risultati attesi:

- build TypeScript/Vite completata;
- 4 test Vitest superati;
- 3 test Playwright superati.

Su una macchina con .NET 8 globale non e necessario impostare `DOTNET_COMMAND`; Playwright usa automaticamente `dotnet`.
