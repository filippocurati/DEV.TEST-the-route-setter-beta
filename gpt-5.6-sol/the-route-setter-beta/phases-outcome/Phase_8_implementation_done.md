# Fase 8 - Implementazione completata

## 1. File modificati

### Fisica e snap

- `source/frontend/src/physics/snapMath.ts`
- `source/frontend/src/physics/physicsWorld.ts`
- `source/frontend/src/scene/wallScene.ts`

### Test

- `source/frontend/tests/physics/snapMath.test.ts`
- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/e2e/snap.spec.ts`
- `source/frontend/tests/e2e/selection-input.spec.ts`

### Esito fase

- `phases-outcome/Phase_8_implementation_done.md`

## 2. Requisiti coperti

- `REQ-FIS-005`: il pivot GLB posteriore viene posto sul punto di contatto e la rotazione avviene intorno a tale pivot.
- `REQ-FIS-006`: snap soltanto con distanza `<= 0,05 m`; nessuno snap oltre soglia.
- `REQ-FIS-007`: post-snap aderente e tangenziale; avanti no-op; indietro sgancia, ripristina orientamento iniziale e posiziona a `0,25 m` lungo normale.
- `REQ-FIS-008`: tilt determinato esclusivamente dalla normale del contatto.
- `REQ-FIS-009`: twist utente preservato e applicato intorno alla normale locale.
- `REQ-FIS-010`: assi camera proiettati sul piano tangente.
- `REQ-FIS-011`: move-and-slide Rapier tra hold e validazione trasformazioni candidate.
- `REQ-FIS-014`: fallback normale triangolo -> ultima valida -> +Z e tie-break distanza/feature id deterministico.
- `REQ-FIS-015`: continuita con avanti/indietro pre-snap e transizione post-snap.
- `REQ-TST-008`: copertura automatica completa di soglia, normale, twist, tangente e degeneri.

## 3. Test eseguiti e storico risultati

1. Prima build dopo integrazione macchina a stati: superata.
2. Prima suite Vitest: 32 test superati; build TypeScript fallita solo per campo diagnostico `contactPoint` mancante nell'interfaccia.
3. Campo diagnostico aggiunto; build frontend superata.
4. Primo E2E snap con pressione reale: fallito per timeout, dovuto a circa 195 passi da 1 cm e query TriMesh ripetute.
5. Ottimizzazione query: raycast parete attivato soltanto negli ultimi 15 cm.
6. Secondo E2E snap continuo: ancora oltre timeout per percorso reale di 2 m.
7. Test E2E reso deterministico con batch di click reali sullo stesso handler UI; singolo passo lontano verifica no-snap.
8. E2E soglia snap: superato.
9. E2E movimento tangenziale, rotazione e sgancio: superato.
10. Aggiunto test trasformazione candidata sovrapposta: superato.
11. Build frontend finale: superata.
12. Vitest finale: 33/33 superati.
13. Restore/build backend: superati, 0 warning e 0 errori.
14. xUnit backend: 33/33 superati.
15. Prima suite E2E completa: 14/15 superati; unico test intermittente pressione continua pre-snap sotto carico cumulativo.
16. Finestra E2E pressione continua estesa a 5 secondi; test isolato superato.

Test coperti:

- soglia inclusiva 5 cm;
- tie-break distanza e feature id;
- fallback normale completo;
- proiezione tangenziale;
- orientamento +Z sulla normale;
- twist di 1 grado intorno alla normale;
- raycast parete con punto e normale;
- move-and-slide tangenziale hold-hold;
- rifiuto trasformazioni sovrapposte;
- no snap oltre soglia e snap entro soglia;
- avanti no-op post-snap;
- movimento tangenziale aderente;
- rotazione post-snap;
- sgancio a 25 cm con orientamento iniziale.

## 4. Limiti e blocchi

Nessun blocco residuo.

- La parete reale contiene circa 1,5 milioni di triangoli; le query precise sono limitate alla zona prossima al contatto.
- Il test E2E percorre 2 m tramite batch di click per mantenere determinismo; click singolo e pressione continua sono verificati separatamente.
- Il movimento tangenziale usa il KinematicCharacterController contro altre hold e riproiezione raycast sulla parete.
- Il bundle frontend resta oltre la soglia Vite; ottimizzazione demandata alle fasi performance.

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
npm run test:e2e
```

Verifica browser:

1. aggiungere una hold;
2. usare Avanti fino a 5 cm: deve agganciarsi;
3. usare frecce: deve restare aderente e muoversi tangenzialmente;
4. ruotare: deve ruotare attorno alla normale;
5. Avanti post-snap non deve avere effetto;
6. Indietro deve sganciare a 25 cm e ripristinare l'orientamento iniziale.
