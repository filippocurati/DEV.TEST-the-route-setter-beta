# Fase 9UX-bis - Drag transazionale con shadow 3D completato

## 1. Stato

La reimplementazione della FASE 9UX e completata secondo le specifiche drag transazionale aggiornate.

Il report precedente `Phase_9UX_implementation_done.md` e stato mantenuto come storico e non e stato sovrascritto.

La nuova implementazione conserva popup, targeting diretto e click incrementali della prima 9UX, aggiungendo:

- drag-and-drop movimento dalle quattro frecce;
- drag-and-drop rotazione dalle frecce circolari;
- shadow 3D runtime senza asset aggiuntivi per targeting, movimento e rotazione;
- linea/freccia e indicatore angolare;
- hold reale e collider immutati durante il drag;
- validazione endpoint-only al rilascio;
- rollback totale su endpoint invalido;
- camera completamente congelata durante drag;
- shadow esclusa da picking ed export.
- popup ridotto e alleggerito con sfondo semitrasparente;
- `Escape` annulla l'interazione, torna a `idle`, deseleziona la hold e nasconde il popup.
- handle circolari di movimento e rotazione ridotti e semitrasparenti;
- pulsante `Dettagli` nel popup con riuso del viewer 3D del catalogo.

## 2. File modificati

### Specifiche

- `app_definition.md`
- `phases_execution_command.md`
- `sdd-specs/00-costituzione.md`
- `sdd-specs/01-specifica-requisiti.md`
- `sdd-specs/02-design-tecnico.md`
- `sdd-specs/03-piano-implementazione.md`
- `sdd-specs/04-tracciabilita.md`
- `sdd-specs/05-open-decisions-guidate.md`

### Implementazione frontend

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

- `REQ-FIS-003`, `REQ-FIS-009..011`, `REQ-FIS-015`
- `REQ-UX-002`, `REQ-UX-006..010`
- `REQ-IMG-002`
- `REQ-PRF-003`
- `REQ-TST-010`
- decisioni `DEC-011..022`
- principi `C18`, `C20`, `C21`

## 4. Shadow runtime

La shadow viene generata a runtime clonando la gerarchia grafica della hold selezionata ed e usata anche al posto del precedente cerchio/ellisse di aggancio:

- nessun PNG o GLB aggiuntivo;
- nessuna nuova richiesta REST;
- geometrie e texture condivise;
- soli materiali preview clonati;
- opacita `0.35`;
- `depthTest=true`, `depthWrite=false`;
- nessun rigid body o collider;
- rimozione di `holdModelId` per escludere il picking;
- gruppo Three.js dedicato `HoldPreviewGroup`;
- una sola shadow attiva;
- colore giallo durante il targeting ordinario;
- colore rosso per 500 ms o fino al movimento successivo dopo un tentativo invalido;
- pivot sul punto colpito e asse locale `+Z` allineato alla normale della parete;
- prospettiva e inclinazione determinate direttamente dalla posa 3D rispetto alla camera.

Al termine o annullamento del targeting o del drag vengono disposti soltanto i materiali preview. Geometrie e texture condivise non vengono rilasciate. Il footprint proiettato continua a definire internamente i 37 ray di campionamento, ma non viene piu renderizzato nel DOM.

## 5. Movimento drag

- Le quattro frecce mantengono il click da 1 cm.
- La soglia drag e 4 px.
- Superata la soglia viene creata la sessione transazionale.
- Il delta pointer viene proiettato sull'asse screen-space della freccia.
- La componente perpendicolare viene ignorata.
- L'origine geometrica e il contact point proiettato, separato dalla posizione dello handle.
- La preview viene elaborata in sottopassi screen-space da 5 px.
- Ogni sottopasso usa esclusivamente raycast geometrici sulla parete.
- La shadow viene orientata sulla normale candidata e conserva il twist iniziale.
- La shadow si arresta su gap, discontinuita locale o normale oltre 5 gradi dall'attachment normal.
- Non viene eseguita alcuna validazione Convex Hull durante pointermove.
- Il drag puo partire anche direttamente dalla mesh della hold quando `Sposta` e attivo; in questo caso conserva l'offset pointer-contact point e usa entrambe le componenti screen-space.

Al rilascio viene eseguita una sola validazione endpoint. La posa valida viene committata atomicamente; la posa invalida lascia posizione, rotazione, contact point, normale e twist invariati.

## 6. Rotazione drag

- Le frecce circolari mantengono il click da 1 grado.
- Superata la soglia di 4 px viene creata la shadow.
- Il centro matematico e visivo e il contact point proiettato.
- Il delta angolare usa `atan2` e accumulo unwrapped attraverso `-pi/+pi`.
- Il segno del delta tiene conto dell'asse Y CSS e fa seguire alla hold il verso intuitivo del mouse.
- Il twist candidato e calcolato sempre dallo snapshot iniziale e quantizzato a 1 grado.
- Durante pointermove vengono aggiornati soltanto shadow e indicatore.
- Nessun raycast o collision query durante il drag.
- Al rilascio viene validato soltanto l'orientamento endpoint.
- Endpoint invalido: rollback totale.

## 7. Indicatori e lifecycle

- Indicatore lineare giallo origine-target per il movimento.
- Indicatore angolare giallo per la rotazione.
- `Genera immagine` disabilitato durante drag.
- Preview group nascosto comunque nel percorso export.
- Camera completamente congelata durante la sessione.
- Valore precedente di OrbitControls memorizzato e ripristinato.
- Cleanup su pointerup, pointercancel, lostpointercapture, blur, cambio selezione, rimozione ed Escape.
- Shadow e indicatori esclusi dal JPG.

## 8. Test e storico iterazioni

1. Build TypeScript/Vite dopo introduzione sessioni drag: superata.
2. Test unitari iniziali: 44/44 superati.
3. Primo E2E shadow movimento: preview presente e hold reale immutata, ma candidato iniziale non avanzava per origine screen errata.
4. Correzione origine geometrica: contact point proiettato separato dalla posizione dello handle.
5. E2E movimento shadow valido: superato.
6. E2E annullamento rotazione con Escape: superato.
7. E2E commit rotazione al rilascio: superato.
8. Review intermedia: rilevati continuita movimento, centro visuale rotazione, coalescing pointermove e ripristino camera.
9. Correzioni: sottopassi da 5 px, controllo continuita, centro gizmo sul contact point, ultimo pointerup elaborato, RAF coalescing e ripristino stato OrbitControls.
10. Build frontend finale: superata.
11. Vitest finale: 44/44 superati su 9 file.
12. Playwright finale: 24/24 superati.
13. Restore NuGet locked: superato.
14. Build backend Release: 0 warning, 0 errori.
15. xUnit backend Release: 33/33 superati.
16. `git diff --check`: superato.
17. Sostituzione target DOM con shadow 3D di aggancio: completata senza nuovi asset, rigid body o collider.
18. E2E shadow di aggancio, endpoint invalido e normale su parete inclinata: superati.
19. Quality gate successivo alla sostituzione: build frontend superata, Vitest 44/44, Playwright 24/24, build backend 0 warning/0 errori, xUnit 33/33 e `git diff --check` superato.
20. Popup contestuale reso piu compatto e trasparente; `Escape` esteso a deselezione e chiusura menu con rollback delle preview attive.
21. Handle movimento/rotazione ridotti e alleggeriti; viewer dettagli condiviso reso disponibile dal popup della hold in scena.

## 9. Limiti accettati

- UX drag disponibile solo con mouse desktop.
- Il percorso fisico del drag non viene validato per decisione endpoint-only; e ammesso attraversare ostacoli e committare un endpoint libero.
- La preview movement usa continuita locale conservativa e non una topologia globale del TriMesh.
- Il retro resta fuori ambito semantico.
- `Genera immagine` non e disponibile durante una sessione drag.
- Il bundle Vite resta oltre 500 kB e verra trattato nella fase 11.
- Le vulnerabilita npm transitive della baseline non sono state aggiornate.

## 10. Verifica manuale

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

Risultati attesi: 44 Vitest, 33 xUnit e 24 Playwright superati.
