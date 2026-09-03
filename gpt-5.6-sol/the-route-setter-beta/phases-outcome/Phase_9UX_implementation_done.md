# Fase 9UX - Interazione contestuale completata

## 1. Stato

La fase 9UX e completata sulla baseline congelata della fase 9.

L'operativita legacy basata su pannello comandi fisso, shortcut globali, avanti/indietro e snap automatico e stata sostituita da:

- popup contestuale ancorato alla hold selezionata;
- stati fisici `detached` e `attached`;
- modalita `idle`, `attach-targeting`, `moving`, `rotating`;
- aggancio diretto tramite target mouse sulla parete;
- sgancio progressivo da 0.50 m a 10 m;
- gizmo mouse per movimento e rotazione;
- blocco al cambio di superficie oltre 5 gradi dalla normale di aggancio;
- risultati azione e feedback espliciti.

## 2. File modificati

### Implementazione

- `source/frontend/src/interaction/interactionTypes.ts`
- `source/frontend/src/interaction/targetSampling.ts`
- `source/frontend/src/interaction/holdOverlay.ts`
- `source/frontend/src/input/holdCommands.ts`
- `source/frontend/src/main.ts`
- `source/frontend/src/physics/physicsWorld.ts`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/src/style.css`

### Test

- `source/frontend/tests/interaction/interactionTypes.test.ts`
- `source/frontend/tests/interaction/targetSampling.test.ts`
- `source/frontend/tests/input/holdCommands.test.ts`
- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/e2e/catalog.spec.ts`
- `source/frontend/tests/e2e/export.spec.ts`
- `source/frontend/tests/e2e/selection-input.spec.ts`
- `source/frontend/tests/e2e/snap.spec.ts`

## 3. Requisiti coperti

- `REQ-SCN-002`, `REQ-SCN-003`, `REQ-SCN-005`
- `REQ-FIS-002`, `REQ-FIS-006..015`
- `REQ-UI-002..004`
- `REQ-UX-001..010`
- `REQ-IMG-002`
- `REQ-TST-010`
- principi costituzionali `C16..C21`

## 4. Implementazione

### Popup e stati

Il popup mostra sempre `Aggancia`, `Sgancia`, `Ruota`, `Sposta`, `Rimuovi`, abilitandoli in base allo stato detached/attached. Segue il bounding box proiettato della hold, viene limitato alla viewport ed e nascosto durante targeting ed export.

Le modalita sono mutuamente esclusive e `Escape` torna a `idle` mantenendo selezione e popup.

### Targeting

Il target e un overlay DOM circolare giallo, rosso per 500 ms o fino al movimento successivo dopo un tentativo invalido. Il diametro deriva dal footprint posteriore del Convex Hull proiettato nella posa candidata ed e limitato a 48-160 px.

Il commit usa 37 raycast Rapier:

- centro;
- anello da 6 campioni;
- anello da 12 campioni;
- anello da 18 campioni.

Il clustering usa un grafo radiale deterministico, union-find, distanza world e soglia di 5 gradi fra normali. Non esiste copertura minima. I tie-break sono centro, distanza camera e ID stabile.

Se il centro cade in un foro, il diametro viene stimato tramite hit periferici e il campionamento completo continua.

### Aggancio

L'aggancio e un posizionamento editoriale diretto:

- il percorso detached-target non viene simulato;
- l'asse locale `+Z` viene allineato alla normale stabilizzata;
- il twist corrente viene conservato;
- la posa finale viene validata con il Convex Hull contro parete e altre hold;
- contatto consentito e penetrazione oltre 1 mm rifiutata;
- posa invalida: hold invariata, target rosso e targeting ancora attivo.

### Sgancio

Lo sgancio prova deterministicamente:

```text
0.50 m, 0.60 m, 0.70 m, ... 10.00 m
```

lungo la normale uscente. Ripristina l'orientamento detached e azzera il twist. Non torna allo spawn iniziale. Se nessun candidato finale e valido, la hold resta attached.

### Movimento

La modalita moving usa quattro handle mouse:

- click da 1 cm;
- pressione continua con ritardo 300 ms e intervallo 60 ms;
- direzioni screen-relative proiettate sulla tangente;
- riproiezione locale limitata, senza salti su superfici parallele lontane;
- confronto della normale candidata con la normale di aggancio;
- blocco oltre 5 gradi;
- applicazione del prefisso valido quando un passo incontra una collisione.

La prima versione 9UX eseguiva normalmente 10 validazioni Convex-vs-TriMesh per ogni passo da 1 cm sul modello reale da circa 1,5 milioni di triangoli. Il percorso caldo e stato ottimizzato con raycast closest-hit diretto, validazione parete separata e una singola validazione endpoint nel caso libero; sottopassi e ricerca del prefisso valido vengono eseguiti soltanto quando l'endpoint e bloccato. Un benchmark E2E dedicato verifica 20 click consecutivi di movimento e 20 di rotazione entro 3 secondi per gruppo.

### Rotazione

La modalita rotating usa due handle circolari:

- click da 1 grado;
- drag tramite `atan2` e quantizzazione a 1 grado;
- nessun grado spurio all'inizio del drag;
- asse uguale alla normale locale corrente;
- validazione delle pose intermedie;
- arresto all'ultimo grado valido.

Pointer capture, timer e OrbitControls vengono ripristinati su pointerup, pointercancel, lostpointercapture, blur, cambio modalita ed Escape.

### Camera ed export

In targeting:

- il drag sinistro non orbita e non committa accidentalmente un aggancio;
- la rotella mantiene lo zoom;
- il click singolo sinistro committa il target.

Popup, target, hint e gizmo sono DOM e vengono nascosti durante l'export. Camera, selezione e popup vengono ripristinati dopo il download.

## 5. UX legacy rimossa

- nessun pannello fisso dei comandi;
- nessun bottone `Rimuovi presa` nella topbar;
- nessun comando avanti/indietro;
- nessuna mappatura globale Arrow/Q/E/Shift+Arrow;
- nessuno snap automatico per prossimita;
- nessun messaggio generico di successo quando l'azione e bloccata.

I controlli semantici del popup restano accessibili con Tab, Enter e Space. Gli handle di trasformazione sono mouse-only.

## 6. Test

### Unitari

- macchina a stati 9UX;
- 37 campioni e grafo radiale;
- clustering union-find;
- soglia spaziale e angolare;
- gruppo dominante e tie-break;
- clamp target 48-160 px;
- quantizzazione drag;
- timer pointer;
- validazione posa contro parete e altre hold.

### E2E

- popup e azioni detached/attached;
- shortcut legacy inattive;
- rimozione dal popup;
- movimento e rotazione tramite gizmo;
- regressione prestazionale su 20 click consecutivi di movimento e rotazione;
- Escape e click esterno;
- aggancio diretto;
- target invalido rosso con retry;
- sgancio progressivo;
- drag sinistro riservato al targeting;
- zoom disponibile in targeting;
- export con overlay esclusi e ripristinati;
- regressioni catalogo, startup, mobile e download modello.

## 7. Risultati finali

1. Build frontend: superata.
2. Vitest: 44/44 superati, 9 file di test.
3. E2E Playwright Chromium: 19/19 superati, incluso benchmark interattivo su 20 click consecutivi di movimento e rotazione.
4. Restore NuGet locked: superato.
5. Build backend Release: superata con 0 warning e 0 errori.
6. xUnit backend Release: 33/33 superati.
7. `git diff --check`: superato.

La build frontend mantiene il warning noto per il chunk principale da circa 2.66 MB, da valutare nella fase 11.

## 8. Limiti accettati

- UX targeting e gizmo supportata su mouse desktop; touch non incluso.
- Retro non classificato semanticamente e targeting intenzionale sul retro fuori ambito.
- Sgancio limitato a 10 m per garantire terminazione.
- Surface lock configurato a 5 gradi rispetto alla normale di aggancio.
- Il clustering usa continuita locale del pattern di campionamento, non una topologia globale del TriMesh.
- Prestazioni con 40 hold da verificare nella fase 11.
- Vulnerabilita npm transitive della baseline non aggiornate per non alterare il pinning SDD.

## 9. Verifica manuale

Da `source/frontend`:

```powershell
npm run build
npm test
npm run test:e2e
```

Da `source`:

```powershell
$env:ContinuousIntegrationBuild = "true"
dotnet restore TheRouteSetter.sln --locked-mode
dotnet build TheRouteSetter.sln --configuration Release --no-restore
dotnet test TheRouteSetter.sln --configuration Release --no-build --no-restore
```

Risultati attesi: 44 Vitest, 33 xUnit e 19 Playwright superati.
