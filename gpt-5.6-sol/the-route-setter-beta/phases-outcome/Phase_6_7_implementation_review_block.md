# Revisione Fasi 6 e 7 - Implementazione bloccata

## 1. File modificati

### Implementazione parziale della revisione

- `source/frontend/src/input/holdCommands.ts`
- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`
- `source/frontend/src/physics/physicsWorld.ts`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/vite.config.ts`
- `source/frontend/playwright.config.ts`

### Test aggiornati o aggiunti

- `source/frontend/tests/input/holdCommands.test.ts`
- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/e2e/catalog.spec.ts`
- `source/frontend/tests/e2e/selection-input.spec.ts`

### Esito revisione

- `phases-outcome/Phase_6_7_implementation_review_block.md`

## 2. Requisiti interessati

- `REQ-SCN-005`: implementato lo stato esplicito `pre-snap`, la normale iniziale `+Z` e il tentativo di spawn del pivot a `2,0 m` dal centro geometrico della parete.
- `REQ-FIS-015`: implementati i comandi avanti/indietro lungo la normale locale con passo `0,01 m`, pulsanti, shortcut `SHIFT+Freccia Su/Giu` e pressione continua.
- `REQ-UI-004`: aggiornata la mappatura shortcut e la documentazione inline nell'interfaccia.
- `REQ-FIS-011`: implementato shape cast Rapier per limitare avanti/indietro prima del contatto con parete o altre hold.
- `REQ-FIS-007`: analizzato ma non anticipato; avanti no-op post-snap, sgancio indietro e ripristino orientamento appartengono alla fase 8.

La copertura non puo essere considerata completata perche lo spawn reale richiesto da `REQ-SCN-005` non e compatibile con gli asset forniti.

## 3. Test eseguiti e storico risultati

1. Lettura e confronto di `Phases_6_7_Updated_Specs.md`, requisiti, design, piano e tracciabilita: completati; modifiche coerenti tra i documenti.
2. Build frontend dopo introduzione stato pre-snap, spawn a 2 m, comandi normali e shape cast: superata.
3. Vitest dopo prima revisione: 20 test superati su 20.
4. Test input: mapping `SHIFT+ArrowUp -> move-forward` e `SHIFT+ArrowDown -> move-backward`, click singolo e continuo superati.
5. Test fisici headless: passo libero avanti, blocco contro parete e blocco contro altra hold superati.
6. Primo E2E reale spawn: fallito; l'applicazione ha correttamente rilevato compenetrazione e restituito `Posizione iniziale della presa non valida.`.
7. Misurazione indipendente dei bounding box GLB tramite Three.js/GLTFLoader:
   - parete: centro `[0, 24.87383631, -4.638668]`, dimensioni `[31.228638, 50.25232738, 27.094806]`, intervallo Z `[-18.186071, 8.908735]`;
   - Hold1: dimensioni `[152.27418137, 45.5910244, 23.54631615]`, intervallo Z locale circa `[0, 23.54631615]`;
   - Hold2: dimensioni `[88.05595016, 53.01616096, 21.58161736]`, intervallo Z locale circa `[0, 21.58161736]`.
8. Calcolo del punto richiesto letteralmente: centro parete Z `-4.638668` + `2.0 m` = `-2.638668`, valore interno all'intervallo Z della parete `[-18.186071, 8.908735]`.
9. La query fisica Rapier `intersectionWithShape` ha confermato la compenetrazione allo spawn e ha impedito correttamente l'inserimento.

Storico precedente alla revisione, rilevante per le parti non modificate:

- fase 6: build verde, 12 test Vitest, 6 test E2E e 33 test backend;
- fase 7: build verde, 17 test Vitest, 10 test E2E e 33 test backend.

## 4. Limiti e blocchi

### Conflitto tra spawn a 2 metri e parete reale

Le specifiche richiedono contemporaneamente:

1. pivot hold a `2,0 m` dal centro geometrico della parete lungo il fronte `+Z`;
2. assenza di compenetrazione;
3. nessuno snap immediato.

Con il modello reale, il centro volumetrico della parete si trova a Z `-4.638668` e il fronte massimo a Z `8.908735`. Il punto a `+2,0 m` dal centro e quindi ancora all'interno dell'estensione geometrica della parete. I tre criteri non possono essere soddisfatti contemporaneamente.

### Dimensioni e convenzione degli asset hold

Le hold fornite hanno bounding box molto maggiori della parete (Hold1 circa 152 m di larghezza contro 31 m della parete) pur con il vincolo `1 unita = 1 metro`. Questo indica che almeno scala, geometria o trasformazioni degli asset non rispettano la convenzione prevista dalle specifiche. Anche uno spawn davanti alla superficie puo causare sovrapposizioni tra hold quando piu modelli vengono aggiunti nello stesso punto.

### Decisione necessaria

Per proseguire serve una decisione esplicita, accompagnata se necessario da aggiornamento delle specifiche o degli asset. Opzioni tecnicamente coerenti:

1. Definire i `2,0 m` rispetto al centro della superficie frontale della parete, non al centro volumetrico. Lo spawn diventerebbe `frontSurfaceCenter + normal * 2.0`.
2. Definire i `2,0 m` come distanza minima dalla superficie piu vicina lungo la normale locale.
3. Correggere parete e hold affinche scala, origine e dimensioni rispettino `1 unita = 1 metro`, origine hold sul fondo e convenzione `+Z`.
4. Definire una policy per la seconda hold quando il punto di spawn e gia occupato: rifiuto inserimento oppure slot pre-snap deterministici. Spostare lateralmente la seconda hold viola il requisito attuale del singolo punto a 2 m dal centro, se interpretato letteralmente.

La procedura `phases_execution_command.md` vieta di modificare autonomamente le specifiche per superare il conflitto. Per questo motivo la revisione viene chiusa come bloccata.

## 5. Verifica manuale

### Verifica geometria asset

Da `source/frontend`, dopo `npm ci`, eseguire uno script Three.js o usare Blender per confrontare:

```text
Parete centro Z: -4.638668
Parete massimo Z: 8.908735
Spawn specificato Z: -4.638668 + 2.0 = -2.638668
```

Poiche `-2.638668 < 8.908735`, il punto di spawn e ancora interno all'estensione frontale della parete.

### Test automatici non bloccati

Da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run build
npm test
```

Risultato ottenuto prima della verifica E2E reale: build superata e 20 test Vitest superati.

### Riproduzione del blocco E2E

```powershell
$env:DOTNET_COMMAND = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\FCurati\AppData\Local\Temp\opencode\playwright"
$env:E2E_FRONTEND_PORT = "5201"
$env:E2E_BACKEND_PORT = "5083"
npx playwright test tests/e2e/catalog.spec.ts --grep "sposta una presa"
```

Risultato attuale atteso: inserimento annullato con messaggio `Posizione iniziale della presa non valida.` per compenetrazione allo spawn specificato.
