# Fase 9A - Continuita multi-superficie completata

## 1. Obiettivo e stato

La fase correttiva 9A e completata rispetto alle specifiche aggiornate.

Collisioni, acquisizione della superficie, snap e movimento post-snap non assumono piu che la parete sia un unico piano ortogonale a `+Z`. La presa usa il TriMesh completo, mantiene una feature di supporto e puo seguire soltanto triangoli geometricamente contigui. Se un cambio di superficie non e percorribile con il Convex Hull reale, la presa resta agganciata nell'ultima posa valida e il movimento residuo viene arrestato.

## 2. File modificati

### Definizione e specifiche

- `app_definition.md`
- `sdd-specs/00-costituzione.md`
- `sdd-specs/01-specifica-requisiti.md`
- `sdd-specs/02-design-tecnico.md`
- `sdd-specs/03-piano-implementazione.md`
- `sdd-specs/04-tracciabilita.md`
- `sdd-specs/05-open-decisions-guidate.md`

### Implementazione frontend

- `source/frontend/src/physics/geometryConfig.ts`
- `source/frontend/src/physics/physicsWorld.ts`
- `source/frontend/src/physics/snapMath.ts`
- `source/frontend/src/physics/surfaceMovement.ts`
- `source/frontend/src/scene/wallScene.ts`
- `source/frontend/src/scene/wallTopology.ts`

### Test

- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/physics/snapMath.test.ts`
- `source/frontend/tests/physics/surfaceMovement.test.ts`
- `source/frontend/tests/e2e/snap.spec.ts`

## 3. Requisiti coperti

- `REQ-MOD-006`: parete unica e connessa, nessuna dipendenza dalla forma specifica del modello corrente.
- `REQ-FIS-006`: nearest-point euclideo sull'intero TriMesh, indipendente dalla camera e da `+Z`.
- `REQ-FIS-007`: supporto post-snap aderente e sgancio controllato.
- `REQ-FIS-010`: passo totale conservato durante il passaggio tra tangenti.
- `REQ-FIS-011`: Convex Hull verificato durante traslazioni e variazioni di orientamento.
- `REQ-FIS-013`: tutti i triangoli e le trasformazioni world del modello partecipano al collider.
- `REQ-FIS-016`: tracking della feature e transizione soltanto fra facce contigue.
- `REQ-FIS-017`: validazione delle pose intermedie e arresto alla massima trasformazione valida.
- `REQ-FIS-018`: arresto quando termina il supporto o non esiste una posa contigua valida; retro fuori ambito.
- `REQ-FIS-019`: tolleranze centralizzate, normali finite e comportamento deterministico.
- `REQ-TST-010`: fixture sintetica multi-superficie e regressioni E2E sul modello reale.

Principi costituzionali coperti: `C8`, `C16`, `C17`, `C18`.

## 4. Implementazione

### Topologia parete

`wallTopology.ts` costruisce una topologia compatta del TriMesh:

- `Int32Array` con un vicino per ogni lato di ogni triangolo;
- `-1` per bordo esterno;
- `-2` per adiacenza ambigua/non manifold;
- adiacenza esatta tramite indici condivisi;
- weld geometrico dei bordi aperti entro `0.0001 m`;
- verifica metrica degli estremi anche tra celle spaziali adiacenti;
- lookup di vertici, normale e vicini per triangle ID.

Sul modello reale l'indice persistente occupa circa 18 MB per 1.511.042 triangoli.

### Triangle walker

`surfaceMovement.ts` segue la superficie senza nearest-point globale post-snap:

1. calcola le coordinate baricentriche nel triangolo corrente;
2. individua il primo bordo raggiunto dal passo;
3. accetta soltanto un triangolo adiacente;
4. trasporta la direzione tramite la rotazione fra le normali;
5. conserva la lunghezza residua del passo;
6. attraversa deterministicamente la fan locale quando il passo raggiunge un vertice;
7. si arresta su bordo, adiacenza ambigua, triangolo non valido o limite di sicurezza.

I triangoli coplanari vengono attraversati mantenendo la normale precedente, evitando vibrazioni dovute alla tassellazione. I triangoli fotogrammetrici molto stretti ma con area finita restano validi.

### Collisioni e trasformazioni

- Il movimento pre-snap include il TriMesh quando il volume della hold puo raggiungerlo.
- Una broad phase conservativa usa la sfera circoscritta dell'AABB della hold.
- Le altre hold sono verificate con shape-cast sui segmenti lineari.
- Parete e hold sono verificate lungo pose interpolate della trasformazione.
- Le rotazioni sono campionate con sottopasso massimo di 2 gradi.
- Le traslazioni combinate con rotazione sono campionate con sottopasso massimo di 5 mm.
- La ricerca della massima frazione valida individua prima il primo intervallo non valido e poi applica la bisezione; non assume che la validita dell'endpoint implichi la validita del percorso.
- Se il cambio di normale non e percorribile, la massima posa ancora aderente e il punto di bordo con l'orientamento della faccia corrente; non viene committata una rotazione parziale non aderente.

### Stato della hold

Ogni hold post-snap mantiene:

- `supportFeatureId`;
- punto di contatto;
- normale locale;
- ultima normale valida;
- twist utente;
- motivo dell'ultimo arresto;
- conteggio delle transizioni angolari applicate.

Lo sgancio azzera il supporto topologico.

### Tolleranze

`geometryConfig.ts` centralizza:

- margine collisione `0.001 m`;
- tolleranza supporto `0.001 m`;
- weld seam `0.0001 m`;
- soglia cambio normale `0.5 gradi`;
- sottopasso rotazione `2 gradi`;
- sottopasso traslazione `0.005 m`;
- iterazioni bisezione `14`;
- limite di sicurezza `128` transizioni per passo.

## 5. Test rosso-verde

Il primo test introdotto e stato:

`blocca il movimento pre-snap contro un pannello laterale della parete`

Prima della correzione falliva con:

```text
expected -1 to be greater than -0.5
```

La hold attraversava integralmente una parete sul piano `X=0`, dimostrando che il percorso applicativo escludeva il TriMesh. Dopo la correzione il test passa e la hold si arresta prima della superficie.

## 6. Copertura REQ-TST-010

La fixture sintetica verifica:

- pannello frontale e pannello inclinato;
- passaggio fra facce contigue;
- conservazione del budget totale del passo;
- bordo esterno bloccante;
- superficie vicina ma non contigua rifiutata;
- equivalenza fra un passo e due mezzi passi;
- seam con vertici duplicati;
- seam entro tolleranza a cavallo di celle spaziali;
- stabilita su triangoli coplanari;
- triangoli stretti prodotti dalla fotogrammetria;
- attraversamento deterministico di una fan di vertice;
- spigolo ortogonale con trasporto della tangente;
- massima frazione valida;
- primo intervallo invalido anche quando l'endpoint torna valido.
- attraversamento di oltre 128 triangoli coplanari in un singolo passo senza dipendenza dalla densita della tassellazione.

Gli E2E sul GLB reale verificano:

- snap centrale a 5 cm;
- movimento tangenziale, twist e sgancio;
- blocco del raccordo laterale in stato pre-snap;
- snap e orientamento sul pannello sinistro inclinato;
- mantenimento del twist e arresto post-snap nel raccordo reale non percorribile dalla geometria di `Hold1`.

Il modello corrente presenta raccordi quasi ortogonali e `Hold1` ha larghezza circa 1 m. La transizione completa non e fisicamente valida senza compenetrazione; l'esito corretto secondo `REQ-FIS-017` e quindi l'arresto nell'ultima posa valida. La transizione valida e coperta dalla fixture sintetica, inclusa una variazione di 90 gradi.

## 7. Risultati finali

1. Build frontend: superata.
2. Vitest: 55/55 superati, 8 file di test.
3. E2E Playwright Chromium: 20/20 superati.
4. Restore NuGet locked: superato.
5. Build backend Release: superata con 0 warning e 0 errori.
6. xUnit backend Release: 33/33 superati.
7. `git diff --check`: superato.

La build frontend continua a segnalare il warning gia noto per il chunk principale da circa 2,66 MB; non e un errore della fase 9A e resta materia della fase 11.

## 8. Limiti accettati

- Il retro non viene classificato automaticamente. Se l'utente forza una hold dietro il modello, movimento, snap e compenetrazione non sono garantiti, come stabilito da `REQ-FIS-018` e `DEC-006`.
- Una seam non manifold o geometricamente ambigua viene trattata come bordo bloccante.
- Una T-junction non rappresentata da lati condivisi viene trattata conservativamente come arresto; non viene usato nearest-point globale per saltarla.
- Il modello reale e fortemente tassellato; i test E2E snap sono piu lenti degli altri test.
- Il benchmark con 40 hold e la misurazione FPS appartengono alla fase 11.

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

Risultati attesi: 55 Vitest, 33 xUnit e 20 Playwright superati.
