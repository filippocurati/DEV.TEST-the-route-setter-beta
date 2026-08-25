# Revisione Fasi 6 e 7 - Seconda implementazione completata

## 1. File modificati

- `source/frontend/src/scene/spawnCandidates.ts`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/src/physics/physicsWorld.ts`
- `source/frontend/src/physics/normalMovement.ts`
- `source/frontend/src/input/holdCommands.ts`
- `source/frontend/src/main.ts`
- `source/frontend/src/style.css`
- `source/frontend/vite.config.ts`
- `source/frontend/playwright.config.ts`
- `source/frontend/tests/scene/spawnCandidates.test.ts`
- `source/frontend/tests/input/holdCommands.test.ts`
- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/e2e/catalog.spec.ts`
- `source/frontend/tests/e2e/selection-input.spec.ts`
- `holds/Hold1/collider.json`
- `holds/Hold2/collider.json`
- `phases-outcome/Phase_6_7_implementation_review_done_2.md`

## 2. Requisiti coperti

- `REQ-SCN-005`: punto frontale determinato con raycast dal centro geometrico lungo `-Z`; primo spawn a offset `2,0 m` lungo `+Z`.
- `REQ-SCN-005`: fallback su griglia frontale deterministica con passo `0,30 m`, dominio bounding frontale più margine `0,30 m`.
- `REQ-SCN-005`: ordinamento centro, distanza crescente, quindi senso orario dall'alto; selezione del primo candidato Rapier non compenetrante.
- `REQ-SCN-005`: inserimento annullato solo dopo esaurimento del dominio.
- `REQ-FIS-005`: nuovi GLB verificati con fondo sul piano `Z=0` e geometria verso `+Z`.
- `REQ-FIS-015`: avanti/indietro di 1 cm e continui, tramite pulsanti e `SHIFT+Freccia Su/Giu`.
- `REQ-FIS-011`: limite parete sul riferimento frontale e collisioni hold-hold tramite shape cast Convex Hull diretto.
- `REQ-UI-004`: shortcut aggiornate e documentate nella UI.

La logica post-snap di `REQ-FIS-007` resta correttamente demandata alla fase 8.

## 3. Test eseguiti e storico risultati

1. Nuovi GLB misurati: parete circa `12,43 x 20 x 10,78 m`; Hold1 circa `0,20 x 0,060 x 0,031 m`; Hold2 circa `0,20 x 0,120 x 0,049 m`.
2. Origine hold verificata: minimo Z locale uguale a `0`, geometria verso `+Z`.
3. Collider mancanti rigenerati dal backend.
4. Hash collider Hold1/Hold2 verificati coerenti con i GLB.
5. Primo spawn dal punto frontale +2 m: superato senza compenetrazione.
6. Comandi avanti/indietro singoli e shortcut: superati.
7. Prima pressione continua normale: troppo lenta per query ripetute sul TriMesh parete.
8. Ottimizzazione: limite parete analitico e shape cast diretto solo hold-hold.
9. Ottimizzazione render/debug: rendering coalescato e punto raycast hold memorizzato.
10. Pressione continua avanti: superata.
11. Implementata griglia pura e deterministica.
12. Test unitari griglia: centro, cardinali, diagonali, bounding/margine, configurazione invalida, primo libero ed esaurimento dominio.
13. E2E spawn multiplo: Hold1 al candidato centrale, Hold2 al primo candidato libero alternativo, entrambi non compenetranti.
14. Prima suite E2E completa: 9/12 verdi; test precedenti assumevano rifiuto della seconda hold e soglie continue troppo strette.
15. Test aggiornati alle nuove specifiche e tolleranze float.
16. Build frontend finale: superata.
17. Vitest finale: 24/24 superati.
18. Backend build: 0 warning, 0 errori.
19. Backend xUnit: 33/33 superati.
20. Suite Playwright finale seriale: 13/13 superati.

## 4. Limiti e blocchi

Nessun blocco residuo.

- Margine griglia impostato a `0,30 m`, configurabile nel modulo `spawnCandidates.ts`.
- Il dominio può contenere molti candidati per pareti ampie; la ricerca termina sul primo libero e normalmente visita solo pochi punti.
- La parete è molto densa; per il movimento normale pre-snap non viene interrogato ripetutamente il TriMesh. Il riferimento frontale deterministico limita il pivot, mentre Rapier gestisce le collisioni tra hold.
- La fase 8 dovrà usare normale locale del contatto e stato post-snap, inclusi sgancio e ripristino orientamento.
- Bundle e vulnerabilità npm restano invariati rispetto ai report precedenti.

## 5. Verifica manuale

Da `source/frontend`:

```powershell
$env:Path = "C:\Users\FCurati\AppData\Local\Temp\opencode\node-v22.18.0-win-x64;$env:Path"
npm ci
npm run build
npm test
```

E2E:

```powershell
$env:DOTNET_COMMAND = "C:\Users\FCurati\AppData\Local\Temp\opencode\dotnet8\dotnet.exe"
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\FCurati\AppData\Local\Temp\opencode\playwright"
$env:E2E_FRONTEND_PORT = "5216"
$env:E2E_BACKEND_PORT = "5069"
npm run test:e2e
```

Risultati attesi: 24 test Vitest, 33 xUnit e 13 Playwright superati.

Verifica browser:

1. Hold1 viene aggiunta al centro frontale a 2 m.
2. Hold2 viene aggiunta in uno slot griglia alternativo.
3. Entrambe restano selezionabili e non compenetrano.
4. Avanti/indietro funzionano con pulsanti e Shift+frecce.
5. La rimozione libera lo slot, il rigid body e il collider.
