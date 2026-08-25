# Fase 7 - Implementazione completata

## 1. File modificati

### Input e controlli

- `source/frontend/src/input/holdCommands.ts`
- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`

### Scena e fisica

- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/src/physics/physicsWorld.ts`

### Configurazione test

- `source/frontend/vite.config.ts`
- `source/frontend/playwright.config.ts`

### Test frontend

- `source/frontend/tests/input/holdCommands.test.ts`
- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/e2e/selection-input.spec.ts`

### Esito fase

- `phases-outcome/Phase_7_implementation_done.md`

## 2. Requisiti coperti

- `REQ-SCN-002`: click sul canvas esegue raycast Three.js esclusivamente sulle istanze hold; una sola hold è selezionata, evidenziata con materiale emissivo temporaneo e controllata dai comandi.
- `REQ-SCN-003`: `Rimuovi presa` agisce esclusivamente sulla hold selezionata, rimuove oggetto Three.js, rigid body e collider Rapier, libera le risorse modello e ripristina la card nel catalogo.
- `REQ-FIS-009`: rotazione oraria/antioraria di 1 grado per passo, sia da pulsanti sia da shortcut `E`/`Q`; ripetizione continua durante pressione prolungata.
- `REQ-FIS-010`: traslazione di 1 cm per passo lungo gli assi camera proiettati sul piano frontale convenzionale della parete, tramite pulsanti e frecce; ripetizione continua durante pressione prolungata.
- `REQ-UI-004`: shortcut documentate nell'interfaccia e non conflittuali: frecce per movimento, `Q` antiorario, `E` orario; disattivate quando il focus è in un controllo editabile.

Vincoli della fase:

- i comandi restano disabilitati senza una hold selezionata;
- il click su spazio vuoto deseleziona;
- l'evidenziazione usa cloni materiali e non modifica il modello catalogo;
- UI e tastiera convergono sullo stesso `HoldCommand` e sullo stesso esecutore;
- nessuna chiamata REST è effettuata durante input singolo o continuo;
- la selezione via raycast non usa collider o mesh della parete.

## 3. Test eseguiti e storico risultati

1. Verifica iniziale: nessun report fase 7 presente; esisteva soltanto la rimozione dell'ultima hold aggiunta dalla fase 6, senza raycast, evidenziazione o input.
2. Prima implementazione raycast, materiali, controlli e input; caricamento accidentale della skill OpenCode rilevato e interrotto senza modifiche alla configurazione.
3. Prima build fase 7: fallita per tipi Three.js mancanti nel raycaster (`Vector2`, `Object3D`). Correzione applicata.
4. Build successiva: superata.
5. Vitest dopo input controller: 16 test superati su 16.
6. Prima esecuzione E2E fase 7: 4 test falliti nel setup perché il test attendeva `Hold1 selezionata`, immediatamente sostituito dal feedback `Hold1 aggiunta alla scena`; nessun errore applicativo di caricamento.
7. Adeguato setup a osservare feedback di inserimento e stato diagnostico selezione.
8. Seconda esecuzione E2E: il raycast non selezionava il punto centrale del bounding box; i comandi risultavano disabilitati e il test rimozione non selezionava Hold1.
9. Aggiunta proiezione del baricentro di un triangolo reale e annotazione ricorsiva delle mesh con `holdModelId`.
10. Diagnostica E2E: il punto proiettato di Hold1 era fuori viewport (`x NDC -1,45`) e il click colpiva involontariamente la card Hold2 nel catalogo.
11. Correzione proiezione: selezione di un triangolo front-facing realmente interno al viewport; click test limitati ai confini canvas.
12. Test raycast isolato: superato.
13. Terza suite E2E fase 7: raycast, passi singoli/equivalenza e rimozione fisica superati; pressione continua fallita perché il comando applicava soltanto il primo passo.
14. Analisi performance: l'uso di `KinematicCharacterController` pre-snap sul TriMesh reale estremamente denso bloccava il main thread. Implementata trasformazione cinematica diretta pre-snap e sincronizzazione mesh senza step globale; il controller collisioni resta predisposto per la fase 8 post-snap.
15. Aggiornati handler mouse/touch/pen e test temporali. Il controller continuo è risultato corretto nei fake timer; Playwright richiedeva una finestra maggiore sotto carico del modello reale.
16. Test pressione continua con finestra browser 1,5 s: superato.
17. Suite E2E fase 7 isolata: 4 test superati su 4.
18. Build frontend di regressione: superata con warning bundle già noto.
19. Vitest di regressione: 17 test superati su 17.
20. Restore backend locked-mode: superato.
21. Build backend: 0 warning, 0 errori.
22. Test backend: 33 superati su 33.
23. Prima suite Playwright completa parallela: 9 test superati e 1 timeout durante caricamento concorrente di più copie degli asset reali.
24. Configurato Playwright con un solo worker per evitare competizione GPU/memoria e rendere deterministica la suite con GLB reali pesanti.
25. Suite Playwright completa finale: 10 test superati su 10.
26. Build frontend finale: superata.
27. Vitest finale: 17 test superati su 17.

I test della fase verificano:

- costanti esatte 0,01 m e 1 grado;
- mapping frecce/Q/E;
- un passo per pressione breve;
- ripetizione e arresto alla pressione continua;
- ignorare keydown ripetuti per lo stesso comando;
- raycast reale su mesh hold e deselezione su spazio vuoto;
- controlli disabilitati senza selezione;
- equivalenza numerica pulsante/tastiera;
- pressione continua con più di due passi;
- assenza di traffico API durante il comando continuo;
- rimozione della sola hold selezionata;
- decremento di un rigid body e un collider Rapier;
- ritorno della hold rimossa nel catalogo.

## 4. Limiti e blocchi

Nessun blocco residuo per la fase 7.

- Prima dello snap, la normale di movimento è il fronte convenzionale `+Z`; gli assi camera vengono proiettati sul piano XY. La fase 8 sostituirà questa normale con quella locale del punto di contatto e applicherà il vincolo tangenziale post-snap.
- Le trasformazioni pre-snap sono cinematiche dirette. Il `KinematicCharacterController` resta operativo e testato, ma viene usato per il move-and-slide post-snap nella fase 8; usarlo ora contro il TriMesh reale da oltre 1,5 milioni di triangoli renderebbe non immediato il comando.
- L'evidenziazione clona temporaneamente i materiali e li rilascia alla deselezione; non modifica le risorse catalogo.
- I test E2E sono serializzati perché gli asset reali sono pesanti; la suite completa richiede circa 5-6 minuti.
- Le porte E2E sono configurabili con `E2E_FRONTEND_PORT` e `E2E_BACKEND_PORT` per evitare conflitti con altre workspace.
- Il bundle frontend resta circa 2,64 MB minificato, 906 kB gzip. Ottimizzazioni e benchmark appartengono alle fasi successive.
- `npm audit` continua a segnalare 5 vulnerabilità transitive della baseline vincolata.

## 5. Verifica manuale

### Build e test

Da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run build
npm test
```

Risultato atteso: build completata e 17 test Vitest superati.

E2E:

```powershell
$env:DOTNET_COMMAND = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\FCurati\AppData\Local\Temp\opencode\playwright"
$env:E2E_FRONTEND_PORT = "5198"
$env:E2E_BACKEND_PORT = "5086"
npm run test:e2e
```

Risultato atteso: 10 test Playwright superati.

### Verifica manuale browser

1. Avviare backend e frontend come descritto nei report precedenti.
2. Usare Hold1 e cliccare in una zona visibile della presa: deve evidenziarsi.
3. Cliccare sullo spazio vuoto: la presa deve deselezionarsi e i controlli devono disabilitarsi.
4. Selezionare nuovamente Hold1.
5. Premere una freccia o il pulsante corrispondente: la presa deve spostarsi di 1 cm.
6. Premere `Q`/`E` o i pulsanti rotazione: la presa deve ruotare di 1 grado.
7. Tenere premuto un comando: il movimento/rotazione deve continuare fino al rilascio.
8. Aggiungere Hold2, selezionare Hold1 e premere `Rimuovi presa`: solo Hold1 deve tornare nel catalogo.

Shortcut:

- `Freccia su`: movimento su;
- `Freccia giù`: movimento giù;
- `Freccia sinistra`: movimento a sinistra;
- `Freccia destra`: movimento a destra;
- `Q`: rotazione antioraria;
- `E`: rotazione oraria.
