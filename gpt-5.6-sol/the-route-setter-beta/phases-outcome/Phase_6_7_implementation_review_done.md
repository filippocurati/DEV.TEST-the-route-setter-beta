# Revisione Fasi 6 e 7 - Implementazione completata

## 1. File modificati

### Implementazione frontend

- `source/frontend/src/input/holdCommands.ts`
- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`
- `source/frontend/src/physics/physicsWorld.ts`
- `source/frontend/src/physics/normalMovement.ts`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/vite.config.ts`
- `source/frontend/playwright.config.ts`

### Test frontend

- `source/frontend/tests/input/holdCommands.test.ts`
- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/e2e/catalog.spec.ts`
- `source/frontend/tests/e2e/selection-input.spec.ts`

### Collider rigenerati

- `holds/Hold1/collider.json`
- `holds/Hold2/collider.json`

### Esito revisione

- `phases-outcome/Phase_6_7_implementation_review_done.md`

Il precedente `Phase_6_7_implementation_review_block.md` non e stato sovrascritto e conserva l'esito della prima iterazione bloccata dagli asset precedenti.

## 2. Requisiti coperti

- `REQ-SCN-005`: il frontend calcola il centro del bounding box parete, lo proietta sul fronte con raycast globale `-Z`, seleziona deterministicamente l'intersezione con Z maggiore e posiziona il pivot posteriore della hold a `2,0 m` lungo `+Z`.
- `REQ-SCN-005`: ogni istanza nasce in stato esplicito `pre-snap`; l'inserimento viene annullato se il punto frontale non e determinabile o se la posizione e compenetrante/occupata.
- `REQ-FIS-005`: i nuovi asset hold hanno superficie posteriore sul piano locale `Z=0` e geometria verso `+Z`; pivot grafico e corpo Rapier coincidono.
- `REQ-FIS-015`: aggiunti comandi avanti e indietro lungo la normale locale iniziale `+Z`, con passo `0,01 m`, pressione continua e collisioni.
- `REQ-FIS-011`: il limite parete impedisce al pivot di superare il margine frontale; collisioni hold-hold verificate tramite shape cast diretto tra Convex Hull Rapier.
- `REQ-UI-004`: shortcut `SHIFT+Freccia Su` per avanti e `SHIFT+Freccia Giu` per indietro implementate e documentate nell'interfaccia.
- `REQ-CAT-001..007`, `REQ-SCN-001..003`, `REQ-FIS-009..010`: comportamento delle precedenti fasi mantenuto e verificato in regressione.

La parte aggiornata di `REQ-FIS-007` relativa al post-snap non e stata anticipata: avanti no-op, sgancio indietro, orientamento iniziale e riposizionamento a 0,25 m restano responsabilita della fase 8.

## 3. Test eseguiti e storico risultati

### Validazione nuovi asset

1. Parete misurata con Three.js: centro `[0,0,0]`, dimensioni circa `[12,43, 20, 10,78] m`, Z da `-5,39` a `+5,39 m`.
2. Hold1: dimensioni circa `[0,20, 0,060, 0,031] m`, Z locale da `0` a `0,031 m`.
3. Hold2: dimensioni circa `[0,20, 0,120, 0,049] m`, Z locale da `0` a `0,049 m`.
4. Confermata origine posteriore: entrambe le hold iniziano dal piano locale `Z=0` e si sviluppano verso `+Z`.

### Collider

5. Avvio backend per rigenerazione automatica dei collider mancanti: completato.
6. Hold1 collider: hash coerente col GLB, 1519 vertici, 3034 triangoli.
7. Hold2 collider: hash coerente col GLB, 1379 vertici, 2754 triangoli.

### Implementazione e iterazioni

8. Prima ripresa sul requisito precedente `centro parete + 2 m`: Rapier ha correttamente rifiutato lo spawn per compenetrazione.
9. Dopo aggiornamento specifiche, implementato raycast frontale dal centro geometrico lungo `-Z` e spawn a `frontReference + 2m * +Z`.
10. Primo E2E spawn aggiornato: superato; stato `pre-snap`, distanza 2 m dal fronte, normale `[0,0,1]`, nessuna compenetrazione.
11. Implementati pulsanti avanti/indietro e shortcut Shift+frecce.
12. Build frontend: superata.
13. Vitest: 20 test superati su 20.
14. Primo E2E avanti/indietro: click e shortcut superati; pressione continua lenta per query ripetute sul TriMesh parete.
15. Ottimizzazione collisioni: limite parete analitico sul riferimento frontale; shape cast Rapier diretto solo contro Convex Hull delle altre hold.
16. Ottimizzazione debug/render: punto raycast hold memorizzato una volta e rendering coalescato con `requestAnimationFrame`.
17. Pressione continua avanti: superata con almeno due passi osservati sotto carico reale.
18. Test inserimento seconda hold: correttamente annullato per spawn deterministico occupato, card ripristinata.

### Regressione finale

19. Restore frontend deterministico: superato.
20. Build frontend: superata con warning bundle gia noto.
21. Vitest: 20/20 superati.
22. Restore backend locked-mode: superato.
23. Build backend: 0 warning, 0 errori.
24. xUnit backend: 33/33 superati.
25. Verifica hash collider indipendente: Hold1 e Hold2 coerenti.
26. Prima suite E2E completa: 9/12 superati; due soglie continue e un test che presumeva possibile inserire due hold nello stesso spawn.
27. Test adeguati alle nuove specifiche: soglia continua con tolleranza float, rimozione con una hold, test esplicito di annullamento spawn occupato.
28. Suite E2E completa finale: 13/13 superati in modalita seriale.

I test coprono:

- punto frontale deterministico e distanza spawn 2 m;
- stato pre-snap e normale locale iniziale;
- assenza compenetrazione allo spawn;
- annullamento se spawn occupato;
- mapping Shift+ArrowUp/Down;
- 1 cm click e pressione continua;
- equivalenza pulsanti/shortcut;
- limite parete deterministico;
- shape cast hold-hold;
- selezione, rimozione e rilascio spazio fisico;
- regressione catalogo, dettagli, camera e mobile.

## 4. Limiti e blocchi

Nessun blocco residuo per la revisione delle fasi 6 e 7.

- Lo spawn e unico e deterministico. Se una hold occupa gia il punto, una seconda hold viene rifiutata e rimane nel catalogo, come previsto dalle specifiche aggiornate.
- In pre-snap la normale locale iniziale e `+Z`, coerente con la convenzione asset. La normale del punto di contatto verra calcolata nella fase 8.
- La collisione parete durante avanti usa il riferimento frontale e un margine di 1 mm; collisioni hold-hold usano i Convex Hull Rapier.
- La fase 8 dovra mantenere `initialRotation`, gia memorizzata per istanza, per lo sgancio controllato.
- Gli asset parete restano molto densi; le ottimizzazioni evitano query TriMesh ripetute nei comandi pre-snap.
- Il bundle resta circa 2,64 MB minificato; la performance complessiva sara trattata nelle fasi dedicate.

## 5. Verifica manuale

### Build e test

Da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run build
npm test
```

Risultato atteso: build completata e 20 test Vitest superati.

E2E:

```powershell
$env:DOTNET_COMMAND = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\FCurati\AppData\Local\Temp\opencode\playwright"
$env:E2E_FRONTEND_PORT = "5209"
$env:E2E_BACKEND_PORT = "5075"
npm run test:e2e
```

Risultato atteso: 13 test Playwright superati.

### Verifica browser

1. Aggiungere Hold1: deve apparire davanti al punto frontale della parete a 2 m, in pre-snap.
2. Premere `Shift+Freccia Su` o `Avanti`: movimento di 1 cm verso la parete.
3. Premere `Shift+Freccia Giu` o `Indietro`: movimento di 1 cm verso l'esterno.
4. Tenere premuto: movimento continuo.
5. Tentare di aggiungere Hold2 mentre Hold1 occupa lo spawn: inserimento annullato e Hold2 resta nel catalogo.
6. Rimuovere Hold1 e aggiungere Hold2: inserimento consentito nello spawn libero.
