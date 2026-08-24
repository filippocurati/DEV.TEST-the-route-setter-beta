# Fase 5 - Implementazione completata

## 1. File modificati

### Fondazione fisica frontend

- `source/frontend/src/physics/rapierRuntime.ts`
- `source/frontend/src/physics/physicsWorld.ts`
- `source/frontend/src/physics/transformSync.ts`

### Integrazione scena

- `source/frontend/src/scene/wallScene.ts`

### Test frontend

- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/e2e/startup.spec.ts`

### Esito fase

- `phases-outcome/Phase_5_implementation_done.md`

## 2. Requisiti coperti

- `REQ-ARC-004`: Rapier `@dimforge/rapier3d-compat@0.12.0` viene inizializzato ed eseguito esclusivamente nel frontend; il backend non contiene dipendenze o simulazione Rapier.
- `REQ-ARC-008`: movimento, step e sincronizzazione sono operazioni locali; test headless ed E2E verificano assenza di chiamate `fetch`/REST durante aggiornamenti continui e interazioni camera.
- `REQ-FIS-002`: mondo con gravita `{0,0,0}`; corpi delle future prese predisposti come cinematici position-based; attrito e restituzione impostati a zero; nessuna inerzia o movimento autonomo.
- `REQ-FIS-003`: i corpi cinematici creati dalla fondazione hanno CCD abilitato tramite `setCcdEnabled(true)`.
- `REQ-FIS-004`: `KinematicCharacterController` nativo Rapier configurato con sliding attivo, autostep disabilitato, snap-to-ground disabilitato e nessun impulso ai corpi dinamici; metodo base move-and-slide operativo.
- `REQ-FIS-012`: mesh Three.js e collider Rapier restano oggetti distinti; la sincronizzazione copia soltanto trasformazioni dal corpo fisico all'oggetto grafico.

La parte di `REQ-FIS-013` iniziata nella fase 4 e ora completata operativamente: il TriMesh client-side della parete viene passato a `ColliderDesc.trimesh` e collegato a un corpo Rapier fisso.

Vincoli costituzionali rispettati:

- Rapier solo frontend (`C2`);
- nessuna REST ad alta frequenza (`C3`);
- separazione mesh/collider (`C6`);
- parete TriMesh client-side (`C8`);
- sistema destrorso Three.js e unita non convertite (`C9`).

## 3. Test eseguiti e storico risultati

1. Verifica stato precedente: nessuna cartella `src/physics`, nessun uso applicativo Rapier, nessun test fisico reale e nessun report fase 5 presenti. Era stata svolta soltanto analisi; un precedente passaggio errato aveva modificato e poi ripristinato la configurazione OpenCode senza produrre codice applicativo.
2. Restore frontend `npm ci --ignore-scripts`: superato; confermata la baseline esatta `@dimforge/rapier3d-compat@0.12.0`.
3. Ispezione API TypeScript della versione installata: confermate `init`, `World`, `ColliderDesc.trimesh`, corpo `fixed`, corpo `kinematicPositionBased`, CCD, controller, autostep e snap-to-ground.
4. Prima build frontend dopo implementazione: fallita per un errore nel solo mock di test, che usava `RAPIER.Vector3` come se esponesse il metodo `set` di `THREE.Vector3`.
5. Prima esecuzione Vitest: 6 test superati e 1 fallito su 7 per lo stesso mock; mondo, controller, collider e no-network risultavano gia verdi.
6. Correzione mock con `THREE.Vector3` e aggiunta test move-and-slide.
7. Seconda build frontend: superata. Vite segnala bundle compat/WASM di circa 2.623 MB minificati, 902 kB gzip.
8. Seconda esecuzione Vitest: 8 test superati su 8.
9. Prima esecuzione E2E con fisica reale: 3 test falliti per timeout di 5 secondi mentre lo stato restava `Caricamento parete...`; nessun errore JavaScript, inizializzazione del TriMesh reale oltre il timeout precedente.
10. Stato UI reso esplicito con `Inizializzazione fisica...`; timeout E2E adeguato all'asset reale e al passaggio WASM.
11. Seconda esecuzione E2E: 3 test superati su 3; inizializzazione fisica completata in circa 11 secondi in Chromium headless.
12. Aggiunti test di validazione TriMesh, cleanup idempotente e blocco operazioni dopo dispose.
13. Restore backend locked-mode finale: superato.
14. Build backend finale: 0 warning, 0 errori.
15. Suite backend finale: 33 test superati su 33.
16. Restore frontend deterministico finale: superato.
17. Build frontend finale: superata con warning dimensione bundle.
18. Vitest finale: 10 test superati su 10, di cui 7 fisici headless e 3 TriMesh.
19. Controllo backend: nessun import o PackageReference Rapier; le sole occorrenze sono commenti descrittivi sul formato collider.
20. E2E finale con backend e modello reali: 3 test superati su 3; fisica pronta, gravita zero, parete fissa, collider valido, controller pronto, autostep e snap-to-ground disabilitati.
21. Controllo lockfile: `@dimforge/rapier3d-compat` richiesto esattamente come `0.12.0` in `package.json` e `package-lock.json`.

I test fisici headless verificano:

- inizializzazione WASM e mondo a gravita zero;
- corpo parete fisso e collider TriMesh valido;
- controller con slide attivo, autostep e snap-to-ground disabilitati;
- corpo cinematico position-based con CCD;
- attrito e restituzione nulli;
- sincronizzazione di posizione e rotazione fisica verso la mesh;
- move-and-slide: blocco della componente verso la parete e mantenimento della componente laterale;
- zero chiamate `fetch` durante 20 iterazioni di movimento/step;
- rifiuto di TriMesh malformati prima del confine WASM;
- rilascio idempotente e protezione da uso dopo dispose.

Gli E2E verificano inoltre che durante orbit, zoom e pan l'unica richiesta API sia il caricamento iniziale `/api/wall`.

## 4. Limiti e blocchi

Nessun blocco residuo per la fase 5.

- Il bundle frontend cresce a circa 2.623 MB minificati, circa 902 kB gzip, per il binding compat e il WASM Rapier. Il code splitting e il benchmark appartengono alle fasi di performance.
- Sul modello parete reale da circa 27 MB, caricamento GLB, estrazione TriMesh e creazione collider Rapier richiedono circa 9-11 secondi in Chromium headless. L'interfaccia distingue caricamento parete e inizializzazione fisica.
- La fondazione espone creazione e movimento di corpi cinematici, ma non crea ancora prese reali: catalogo, lazy load e istanze appartengono alla fase 6.
- Il controller e predisposto con offset di contatto pari a `0.001` metri. Snap parete, movimento tangenziale e casi degeneri saranno implementati nelle fasi dedicate.
- La scena resta a rendering on-demand. Le future modifiche fisiche dovranno richiedere un render dopo la sincronizzazione, senza introdurre polling REST.
- `npm audit` continua a segnalare 5 vulnerabilita nelle dipendenze transitive della baseline; nessuna dipendenza e stata aggiornata fuori da `OPEN-003`.

## 5. Verifica manuale

### Build e test frontend

Da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run build
npm test
```

Risultati attesi:

- build TypeScript/Vite completata;
- 10 test Vitest superati;
- warning Vite sulla dimensione del bundle, non bloccante.

### E2E con backend reale

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
$env:DOTNET_COMMAND = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\FCurati\AppData\Local\Temp\opencode\playwright"
npm run test:e2e
```

Risultato atteso: 3 test Playwright superati.

### Verifica manuale browser

Avviare il backend da `source`:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe" run --no-launch-profile `
  --project "backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj" `
  --urls "http://127.0.0.1:5080"
```

Avviare il frontend da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run dev
```

Aprire `http://127.0.0.1:5173`. Lo stato deve passare da `Caricamento parete...` a `Inizializzazione fisica...` e infine `Parete pronta`. Orbit, zoom e pan devono continuare a funzionare senza ulteriori richieste REST.
