# Fase 6 - Implementazione completata

## 1. File modificati

### API e cache catalogo frontend

- `source/frontend/src/api/holdApi.ts`
- `source/frontend/src/catalog/sessionCatalog.ts`

### Modelli e modale dettagli

- `source/frontend/src/holds/holdResources.ts`
- `source/frontend/src/catalog/holdDetailsModal.ts`

### Scena, fisica e interfaccia

- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/src/physics/physicsWorld.ts`

### Test frontend

- `source/frontend/tests/catalog/sessionCatalog.test.ts`
- `source/frontend/tests/e2e/catalog.spec.ts`
- `source/frontend/tests/e2e/startup.spec.ts`

### Esito fase

- `phases-outcome/Phase_6_implementation_done.md`

## 2. Requisiti coperti

- `REQ-CAT-001`: pannello `Catalogo prese` fisso a sinistra, lista verticale con scrolling indipendente e viewport nel restante spazio.
- `REQ-CAT-002`: ogni card mostra anteprima `PREV_`, identificativo, stato collider, bottone `Utilizza` e bottone `Dettagli`.
- `REQ-CAT-003`: manifest richiesto una sola volta per istanza di sessione; preview richieste una sola volta e conservate come object URL fino alla chiusura pagina.
- `REQ-CAT-004`: nessun GLB presa viene richiesto all'avvio; i modelli vengono scaricati soltanto al click su `Utilizza` o `Dettagli`.
- `REQ-CAT-005`: il modale crea on-demand GLB, scena Three.js, renderer e OrbitControls; alla chiusura rilascia renderer, controlli, oggetto, geometrie, materiali e texture. Una nuova apertura effettua un nuovo caricamento.
- `REQ-CAT-006`: una presa usata scompare dal catalogo; il comando superiore `Rimuovi presa` rimuove l'istanza attiva e la riporta nel catalogo.
- `REQ-CAT-007`: prenotazione sincrona dell'ID prima del caricamento asincrono impedisce doppie istanze anche con click ripetuti; un errore rilascia la prenotazione.
- `REQ-SCN-001`: `HoldModelResource` rappresenta il modello catalogo; ogni istanza scena è un clone indipendente con propria trasformazione e riferimento all'ID modello.
- `REQ-UI-001`: layout desktop e mobile con catalogo sinistro e viewport nello spazio residuo.
- `REQ-UI-002`: menu superiore con `Genera immagine` predisposto e `Rimuovi presa` operativo per l'istanza attiva. La generazione immagine resta disabilitata fino alla fase dedicata.

Requisiti trasversali mantenuti:

- `REQ-HUL-006` e `C7`: il frontend scarica `collider.json` e usa `ColliderDesc.convexMesh`; non calcola hull.
- `C6`: mesh grafica e corpo/collider Rapier sono separati.
- `C3`: nessuna chiamata REST nel loop fisico o di rendering.

La selezione via raycast non è stata anticipata: nella fase 6 l'istanza attiva è l'ultima aggiunta. La selezione 3D appartiene alla fase 7.

## 3. Test eseguiti e storico risultati

1. Prima build dopo API, cache, modale, scena e UI: superata con warning bundle Vite già noto.
2. Prima esecuzione Vitest: 12 test superati su 12; TypeScript build successiva ha segnalato che `afterEach` restituiva accidentalmente il valore di `vi.restoreAllMocks()`.
3. Corretto il callback teardown con ritorno `void` e cleanup dei global mock.
4. Prima esecuzione E2E completa fase 6: 5 test superati e 1 fallito su 6. Catalogo, no eager-load, dettagli e ciclo scena/catalogo erano verdi. Falliva soltanto una vecchia asserzione fase 5 che pretendeva `/api/wall` come unica richiesta di startup, mentre la fase 6 richiede anche manifest e preview.
5. Aggiornato test OrbitControls: fotografa il traffico dopo inizializzazione e verifica che orbit/zoom/pan non producano ulteriori richieste.
6. Resa atomica l'aggiunta scena in caso di errore collider: il modello caricato viene liberato e la prenotazione catalogo viene annullata.
7. Build frontend: superata.
8. Vitest: 12 test superati su 12.
9. Restore backend locked-mode: superato.
10. Build backend: 0 warning, 0 errori.
11. Test backend: 33 superati su 33.
12. Seconda esecuzione E2E completa: 6 test superati su 6, inclusi i 3 test scena preesistenti e i 3 test catalogo.
13. Aggiunta base URL `/api/holds/{id}/assets/` a GLTFLoader per texture e asset opzionali referenziati dal GLB.
14. Esteso test modale: chiusura elimina canvas; seconda apertura richiede nuovamente il GLB e ricrea la viewport.
15. Build frontend finale: superata con warning bundle.
16. Vitest finale: 12 test superati su 12.
17. E2E catalogo finali: 3 test superati su 3.

I test automatici verificano:

- manifest richiesto una sola volta anche con chiamate concorrenti;
- preview richiesta una sola volta e nessun eager-load GLB;
- unicità `use` e ripristino `release`;
- due card reali con preview;
- modale dettagli con GLB richiesto solo all'apertura;
- canvas dettagli rimosso alla chiusura;
- nuovo caricamento dopo riapertura;
- `Utilizza` richiede esattamente modello e collider della presa scelta;
- card rimossa dal catalogo e ID presente nella scena;
- modello richiesto una sola volta durante l'inserimento;
- `Rimuovi presa` elimina l'istanza fisica/grafica e ripristina la card;
- OrbitControls senza traffico REST aggiuntivo;
- layout mobile ancora utilizzabile.

## 4. Limiti e blocchi

Nessun blocco residuo per la fase 6.

- Le prese vengono inserite davanti al centro della parete come stato iniziale non agganciato. Snap a 5 cm, normale di contatto e posizione valida appartengono alla fase 8.
- L'istanza attiva è l'ultima aggiunta; click/raycast, evidenziazione e rimozione della presa selezionata saranno implementati nella fase 7.
- Il comando `Genera immagine` è visibile ma disabilitato; la funzionalità appartiene alla fase 9.
- La cache di sessione riguarda manifest e preview. I GLB del modale vengono intenzionalmente rilasciati e quindi ricaricati a ogni apertura, come richiesto.
- Il GLB usato in scena resta residente finché la relativa istanza non viene rimossa; alla rimozione vengono liberate risorse Three.js e Rapier.
- Il bundle frontend resta circa 2,63 MB minificato, circa 904 kB gzip, principalmente per Three.js e Rapier compat/WASM. Il code splitting appartiene alle fasi performance.
- Gli E2E con asset reali sono lenti: caricamento parete, WASM e modelli porta la suite completa a circa 1,5 minuti.
- `npm audit` continua a segnalare 5 vulnerabilità nelle dipendenze transitive della baseline; nessun aggiornamento è stato eseguito fuori da `OPEN-003`.

## 5. Verifica manuale

### Build e test

Da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run build
npm test
```

Risultato atteso: build completata e 12 test Vitest superati.

E2E con backend reale:

```powershell
$env:DOTNET_COMMAND = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\FCurati\AppData\Local\Temp\opencode\playwright"
npm run test:e2e
```

Risultato atteso: 6 test Playwright superati.

### Verifica manuale browser

Avviare backend da `source`:

```powershell
& "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe" run --no-launch-profile `
  --project "backend\src\TheRouteSetter.Api\TheRouteSetter.Api.csproj" `
  --urls "http://127.0.0.1:5080"
```

Avviare frontend da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run dev
```

Aprire `http://127.0.0.1:5173` e verificare:

1. catalogo a sinistra con Hold1 e Hold2;
2. preview caricate senza scaricare inizialmente i modelli GLB;
3. `Dettagli` apre il modello 3D e la chiusura elimina la viewport modale;
4. `Utilizza` rimuove la card e aggiunge la presa alla scena;
5. lo stesso modello non può essere aggiunto due volte;
6. `Rimuovi presa` riporta l'ultima presa aggiunta nel catalogo;
7. orbit, zoom e pan restano operativi.
