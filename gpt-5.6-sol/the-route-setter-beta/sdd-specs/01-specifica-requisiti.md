# Specifica dei requisiti
## Applicazione per tracciatura vie climbing indoor

Ogni requisito usa ID `REQ-<DOMINIO>-<NUMERO>` e include criteri di accettazione verificabili.

Domini: ARC, MOD, CAT, SCN, FIS, HUL, UI, UX, IMG, PRF, ERR, LOG, TST, DOC, DEP.

## Baseline v0.0.1 e prevalenza

Le fasi 0-9 e i relativi report restano congelati come baseline storica. Dalla fase 9UX in avanti i requisiti aggiornati in questo documento sostituiscono le precedenti regole di interazione basate su snap automatico, comandi avanti/indietro, pannello comandi fisso e shortcut globali. Non e richiesto retrofittare i report delle fasi congelate.

### Requisiti e accettazione di versione

I criteri restano normativi entro costituzione e decisioni esplicite; design, codice e report non li riducono implicitamente. La matrice `04` collega requisiti e test ma non certifica da sola il loro soddisfacimento. Restano tutti i `101` requisiti attivi e l'ID storico `REQ-TST-008`.

Lo sviluppo di **v0.0.1 e CHIUSO e ACCETTATO dall'utente con limiti noti** (`DEC-029`). `REQ-ARC-007` e aggiornato al supporto ufficiale solo Chrome; `DEC-028` mantiene prefisso dei click senza sliding e indici hull obbligatori. Le limitazioni accettate sono eccezioni di release, non eliminazioni di funzionalita, test implicitamente superati o correzioni dei limiti. [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md) e l'unica fonte di stato, rischi, eccezioni ed esiti con provenienza; le attenzioni residue non bloccano questa chiusura.

## ARC - Architettura

**REQ-ARC-001 - Architettura a due livelli.**
Backend ASP.NET Core Web API + frontend browser con three.js.
- Criteri: backend e frontend sono separati; comunicazione via REST/JSON.

**REQ-ARC-002 - API standard.**
OpenAPI/Swagger + separazione Controller/Service.
- Criteri: Swagger disponibile; controller senza business logic.

**REQ-ARC-003 - Rendering client-side.**
- Criteri: nessun rendering 3D lato server.

**REQ-ARC-004 - Rapier solo client-side.**
- Criteri: backend senza dipendenze Rapier; interazioni continue senza chiamate REST.

**REQ-ARC-005 - Nessuna persistenza tracciature.**
- Criteri: nessun endpoint di salvataggio tracciatura; reload pagina riparte da stato iniziale.

**REQ-ARC-006 - Nessuna autenticazione/autorizzazione.**
- Criteri: nessun login/token/ruoli richiesti per l'uso.

**REQ-ARC-007 - Compatibilita browser.**
- Criteri: per v0.0.1 funzionamento ufficialmente supportato su Chrome Stable desktop con WebGL 2.0, senza installazioni aggiuntive. Ultima versione testata: Chrome 152; nessuna garanzia automatica per ogni futura Stable del vendor. Edge e Firefox sono esplorativi, non target ufficiali ne blocchi di release. Revisione normativa approvata dall'utente in `DEC-029`, coerente con `C12` e `app_definition.md`.

**REQ-ARC-008 - No REST ad alta frequenza.**
- Criteri: durante movimento continuo non ci sono chiamate per frame/mouse move.

## MOD - File modelli

**REQ-MOD-001 - Struttura cartelle.**
`main-wall` + `holds/Hold<number>` (es. `Hold1`, `Hold2`).
- Criteri: naming hold univoco `Hold<number>` in tutti i flussi.

**REQ-MOD-002 - Caricamento tollerante.**
GLB obbligatorio; texture/asset opzionali.
- Criteri: hold senza texture e comunque caricabile.

**REQ-MOD-003 - Anteprima PREV_.**
- Criteri: catalogo usa file `PREV_`; errore preview singola hold non blocca il catalogo.

**REQ-MOD-004 - File statici backend.**
- Criteri: GLB/preview/collider serviti come statici con URL risolvibili.

**REQ-MOD-005 - Convenzione orientamento modelli.**
- Tutti i modelli devono utilizzare un sistema di coordinate destrorso coerente con three.js.
- L'asse `Y` deve rappresentare la direzione verticale verso l'alto.
- Il lato frontale arrampicabile della parete deve essere orientato verso `+Z`.
- I modelli devono essere espressi in metri, con `1 unita = 1 metro`.
- Rotazione e scala devono essere applicate prima dell'esportazione GLB.
- Criteri: la camera iniziale posta sul semiasse `+Z` visualizza il fronte arrampicabile senza correzioni automatiche lato applicazione.

## CAT - Catalogo

**REQ-CAT-001 - Catalogo a sinistra.**
- Criteri: pannello sinistro con lista verticale e scrolling.

**REQ-CAT-002 - Box hold.**
- Criteri: ogni box mostra `PREV_`, `Utilizza`, `Dettagli`.

**REQ-CAT-003 - Cache catalogo.**
- Criteri: manifest e preview richiesti una volta per sessione.
- La cache riguarda i metadati statici immutabili e le preview; la readiness evolve separatamente tramite `GET /api/holds/status`, senza refetch del manifest/preview o caricamento GLB. Si aggiornano soltanto stati e URL collider delle hold gia note in `Pending`/`Missing`, non i metadati o l'insieme dei modelli della sessione.
- Criteri watcher: prima richiesta dopo `1 s`, richieste seriali con intervallo base `1 s` dalla conclusione della precedente; solo finche esistono hold `Pending`/`Missing`. `Ready`/`Failed` sono terminali per il watcher; nessun timer o richiesta dopo dispose. Errori transitori conservano l'ultimo stato, vengono segnalati e ritentati con backoff `2, 4, 8, 16, 30 s`, reset a `1 s` al successo; timeout richiesta `10 s`, abort su timeout/dispose. Nessun polling per frame o mouse move.

**REQ-CAT-004 - Lazy load GLB.**
- Criteri: GLB hold richiesto solo su `Utilizza` o `Dettagli`.

**REQ-CAT-005 - Modale dettagli.**
- Criteri: modello caricato all'apertura e rilasciato alla chiusura.

**REQ-CAT-006 - Transizione catalogo/scena.**
- Criteri: hold in scena non presente in catalogo; rimozione la riporta in catalogo.

**REQ-CAT-007 - Unicita uso hold.**
- Criteri: stessa hold non utilizzabile due volte contemporaneamente.

## SCN - Scena e istanze

**REQ-SCN-001 - Separazione modello/istanza.**
- Criteri: istanza mantiene stato scena; modello resta risorsa catalogo.

**REQ-SCN-002 - Selezione via click.**
- Criteri: hold selezionata evidenziata; compare popup contestuale ancorato alla hold; azioni e overlay agiscono solo sulla selezionata.

**REQ-SCN-003 - Rimozione hold selezionata.**
- Criteri: rimozione elimina istanza e collider associato.

**REQ-SCN-004 - Parete auto-load.**
- Criteri: parete visibile all'avvio senza input utente.

**REQ-SCN-005 - Posizionamento iniziale hold in stato detached.**
- All'aggiunta in scena, la hold deve essere posta in stato `detached`.
- Il sistema deve individuare il punto di riferimento frontale della parete lungo la direzione globale `+Z`, in corrispondenza del centro geometrico proiettato sul fronte.
- Il primo punto candidato deve essere posto a `2.0 m` dal punto frontale, verso l'esterno lungo `+Z`.
- Se il punto candidato e occupato o genera compenetrazione, il sistema deve cercare una posizione libera mediante una griglia deterministica sul piano parallelo al fronte della parete.
- La ricerca deve partire dal centro e procedere per distanza crescente, con ordinamento stabile, mantenendo sempre l'offset di `2.0 m` lungo `+Z`.
- La distanza tra i punti della griglia deve essere di `0.30 m`.
- Gli assi della griglia devono essere definiti sul piano locale frontale della parete.
- La ricerca su griglia deve essere limitata all'area frontale proiettata della parete (bounding frontale) estesa da un margine configurabile.
- Ogni posizione candidata deve essere validata tramite Rapier rispetto alla parete e alle hold gia presenti.
- L'inserimento deve essere annullato soltanto se nessuna posizione valida e disponibile dopo esaurimento deterministico di tutti i candidati nel dominio di ricerca.
- Criteri: la hold compare in una posizione detached libera, non compenetra, non viene agganciata automaticamente e piu hold possono essere aggiunte contemporaneamente.

## FIS - Fisica, aggancio, movimento

Eccezione di release `DEC-029`: i controlli collisione e le soglie restano obbligatori per tutti i requisiti di posa e movimento, ma v0.0.1 accetta i limiti noti di Rapier `0.12.0`, senza garanzia universale di CCD, impenetrabilita o agganciabilita. Limiti e relativo stato sono in [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md); l'accettazione non implica una soluzione generale implementata.

**REQ-FIS-001 - Sistema unita.**
- Criteri: 1 unita = 1 metro, sistema destrorso coerente three.js.

**REQ-FIS-002 - Regole fisiche base.**
Gravita off, corpi hold cinematici, no dinamica, no inerzia, no rimbalzo, no attrito.
- Criteri: hold non si muovono autonomamente.

**REQ-FIS-003 - CCD.**
- Il CCD e l'assenza di tunneling si applicano alle trasformazioni reali incrementali e alle pose committate.
- Il percorso visuale della shadow e il teletrasporto editoriale endpoint-only dei drag non sono una simulazione fisica e sono esclusi dal requisito di tunneling.
- Criteri: nessun tunneling nei click incrementali e nei movimenti cinematici reali; un endpoint drag libero oltre un ostacolo intermedio e accettato se la posa finale e valida.
- Verifica dei click: shape cast solo a rotazione fissa e da partenza separata fino al primo contatto; contatti iniziali e rotazione sono gestiti da intervalli ricorsivi con clearance rispetto al massimo moto dei punti. Intervalli irrisolti bloccati conservativamente; vale l'eccezione di release della sezione FIS.

**REQ-FIS-004 - Click cinematici al prefisso valido, senza sliding.**
- Per `DEC-028` (approvazione esplicita utente), il click conserva un prefisso conservativo del movimento richiesto nella stessa direzione, entro riproiezione e surface-lock locali. Al blocco non deve scomporre il movimento per mantenere componenti libere, aggirare l'ostacolo o avviare move-and-slide automatico. Anche la rotazione incrementale si arresta al prefisso angolare validato; gli intervalli irrisolti non autorizzano ulteriori commit.
- Criteri: avanzamento integrale quando il percorso e valido, prefisso o arresto quando bloccato/irrisolto, nessuna deviazione automatica tangenziale all'ostacolo. `maximumValidPoseFraction` coordina shape-cast/contact query native Rapier; non introduce un altro motore fisico o hull frontend. Autostep, snap-to-ground, dinamica e impulsi restano esclusi.
- KinematicCharacterController: fondazione legacy/opzionale, non necessario nei click attivi; la sua presenza e i test foundation non dimostrano la semantica corrente. Drag e riposizionamenti editoriali restano endpoint-only.
- Prevalenza: `DEC-028` sostituisce esplicitamente il precedente criterio move-and-slide; prefisso senza sliding approvato, non una scelta ancora aperta.

**REQ-FIS-005 - Origine hold.**
- Criteri: rotazione attorno al punto di contatto posteriore.

**REQ-FIS-006 - Aggancio diretto al target.**
- L'aggancio e avviato esclusivamente dall'azione contestuale `Aggancia` e dal click su un target della parete.
- Il percorso fra posa detached e target non viene simulato ne validato.
- La posa finale allinea l'asse locale `+Z` della hold alla normale stabilizzata della superficie dominante e conserva il twist corrente.
- Criteri: nessuno snap automatico per prossimita; target valido produce stato `attached`; target invalido lascia invariata la hold e mantiene attiva la modalita di targeting.

**REQ-FIS-007 - Sgancio progressivo controllato.**
- `Sgancia` e disponibile soltanto in stato attached.
- Il sistema ripristina l'orientamento detached iniziale e verifica pose lungo la normale uscente, iniziando a `0.50 m` dal punto di aggancio e aumentando la distanza di `0.10 m` per tentativo.
- La ricerca termina alla prima posa valida oppure a una distanza massima configurata di `10 m`.
- Criteri: primo candidato valido selezionato deterministicamente; nessun fallback allo spawn iniziale; se nessun candidato e valido la hold resta attached e viene mostrato un messaggio non tecnico.

**REQ-FIS-008 - Inclinazione non manuale.**
- Criteri: nessun controllo UI modifica tilt indipendente dalla normale.

**REQ-FIS-009 - Rotazione input.**
- La rotazione e disponibile soltanto in modalita `rotating` per una hold attached.
- Click senza drag sulle frecce circolari: `1 grado`, con validazione immediata come nella prima implementazione 9UX.
- Il drag crea una shadow 3D runtime, ruotata attorno alla normale corrente e quantizzata a `1 grado`, mentre la hold reale resta invariata.
- Durante il drag non vengono eseguite query di collisione; al rilascio esattamente una query applicativa endpoint solo se il candidato e cambiato e disponibile, nessuna per no-change o candidato indisponibile.
- Endpoint valido: commit atomico. Endpoint invalido: rollback totale, nessun angolo parziale applicato.
- Criteri: twist candidato derivato dallo snapshot iniziale; shadow piu arco/linea; pointer capture; camera congelata; nessuna shortcut globale.

**REQ-FIS-010 - Traslazione input.**
- La traslazione e disponibile soltanto in modalita `moving` per una hold attached.
- Quattro frecce contestuali muovono alto/basso/destra/sinistra rispetto alla vista corrente.
- Ogni click senza drag applica `0.01 m`; piu click singoli producono piu passi indipendenti.
- Ogni freccia e anche origine di un drag lungo la propria direzione screen-space; la componente pointer perpendicolare viene ignorata.
- Durante il drag la hold reale resta invariata, una shadow 3D runtime segue aderente alla parete e una linea/freccia gialla mostra origine e target richiesto.
- Durante il drag non vengono eseguite query di collisione; al rilascio esattamente una query applicativa endpoint solo se il candidato e cambiato e disponibile, nessuna per no-change o no-hit.
- Endpoint valido: commit atomico di posizione, normale e inclinazione. Endpoint invalido: rollback totale, nessuna posizione parziale applicata.
- Criteri: nessun comando avanti/indietro; nessun limite totale di distanza; pointer release committa o annulla; pointercancel/Escape annullano; nessuna shortcut globale.

**REQ-FIS-011 - No compenetrazione.**
- Tutto il TriMesh, incluso il retro non classificato, deve partecipare ai controlli di non compenetrazione durante spostamento, rotazione e sgancio, con l'eccezione di release della sezione FIS.
- Aggancio e sgancio diretto validano la posa finale candidata ma non simulano il percorso editoriale verso la destinazione.
- Il contatto a distanza zero e valido; la tolleranza geometrica verso la parete e configurabile in `1..10 mm` inclusi, con decimali e default `5 mm`; fra prese resta immutabile a `1 mm`. L'epsilon numerico separato resta `2e-6 m` (`DEC-026`, che supera soltanto la parte tolleranza di `DEC-025`).
- `PhysicsWorld` usa il minimo per contatto di `distance + tolerance`, non la distanza grezza piu profonda con una soglia unica. Questo margine governa sia gli endpoint sia gli intervalli dei click; uno scontro fra prese non puo essere mascherato da una maggiore penetrazione parete entro la propria soglia.
- La validazione interroga la posa originale contro l'intero TriMesh e le altre hold, senza offset uscente dipendente dal pannello; un contatto negativo deve essere corroborato dall'intersezione nativa. Una violazione accertata prevale sull'incertezza di un altro collider, con blocker, handle, penetrazione, tolleranza e `uncertain: false` coerenti con il contatto governante. In assenza di violazioni accertate, risposte contraddittorie oltre epsilon rendono la posa incerta (`lastPoseDiagnostic.uncertain`), rifiutata con feedback `path-unresolved` anziche collisione accertata. Il criterio vale anche per gli intervalli ed e indipendente dall'ordine broadphase.
- I click incrementali di spostamento e rotazione continuano ad arrestarsi all'ultima posa valida.
- I drag di spostamento e rotazione validano esclusivamente l'endpoint al rilascio; il percorso puo attraversare ostacoli per scelta editoriale esplicita.
- Criteri: ogni posa committata deve rispettare la soglia del singolo contatto con il solo epsilon numerico dichiarato; endpoint drag invalido annulla integralmente il drag; nessun commit parziale. Gli sweep da partenza separata continuano a fermarsi prima del primo contatto, anche con il pavimento, senza avanzare fino alla profondita tollerata.
- Configurazione: `source/frontend/public/physics-config.json` contiene soltanto `{"wallPenetrationToleranceMm":5}` come valore iniziale. Numero JSON finito, senza virgolette, decimali con punto, nessun commento; chiavi sconosciute, valori fuori intervallo o non numerici sono invalidi. Non esiste una chiave configurabile per la tolleranza fra prese.
- Bootstrap: una sola fetch con `cache: 'no-store'`, prima di creare la scena; nessuna rilettura durante le interazioni. File invalido, HTTP non riuscito, parsing o rete falliti impediscono l'avvio senza fallback silenzioso; messaggio gestito nella pagina, niente eccezioni `pageerror` non gestite. Per la gestione globale errori valgono i requisiti ERR.
- Operativita: modifica del file servito e reload applicano il valore alla nuova sessione. In sviluppo nessun riavvio backend/frontend o compilazione; Vite puo ricaricare automaticamente dopo una modifica a `public`. Esportare prima di modificare: reload perde la sessione e JPG non salva lo stato editabile. In produzione installazione/build iniziale della funzionalita necessari; poi modifica del `dist/physics-config.json` distribuito e reload senza rebuild/riavvio su server statico. Modifiche al solo sorgente richiedono rebuild/copia nel deploy; conservare il valore permanente in `public`, perche il build sovrascrive `dist`. Server/proxy/cache devono rispettare `no-store`.
- Accettazione v0.0.1: vale l'eccezione di release FIS approvata in `DEC-029`, coerente con `C17`/`C18`; le soglie si applicano alle query richieste, senza dichiarare infallibile la rilevazione su geometrie arbitrarie.

**REQ-FIS-012 - Separazione mesh/collider.**
- Criteri: fisica usa solo collider Rapier.
- Parete e istanze fisiche hanno mesh e collider separati; shadow/overlay visual-only non hanno collider o rigid body (`C6`).

**REQ-FIS-013 - Parete TriMesh statica client-side.**
- Tutti i triangoli del modello partecipano al collider e sono candidabili per l'aggancio, indipendentemente da normale, inclinazione, prominenza, curvatura o cavita.
- Il retro non viene classificato o filtrato per il targeting; un uso intenzionale del retro e fuori ambito ma resta fisicamente collidente.
- Criteri: collider derivato da tutti i vertici/triangoli parete lato client; nessun filtro basato su `+Z` durante targeting e collisioni.
- Candidabilita di tutti i triangoli non significa validita di tutte le pose: resta obbligatoria la validazione dell'intero hull, con l'eccezione di release FIS.

**REQ-FIS-014 - Target e degeneri deterministici.**
- Criteri: normali finite; raggruppamento e tie-break deterministici; target privo di hit non agganciabile; posa invalida non modifica la hold.

**REQ-FIS-015 - Vincolo dei click incrementali alla superficie di aggancio.**
- Al momento dell'aggancio viene memorizzata la normale stabilizzata di aggancio.
- Durante i click da `1 cm` la hold puo seguire piccole variazioni locali pur restando aderente, ma la normale candidata deve rimanere entro `5 gradi` dalla normale di aggancio.
- Un diedro, spigolo, prominenza, gap o cambio di inclinazione oltre soglia arresta il click all'ultima posa valida.
- Il drag transazionale e escluso dal surface-lock iniziale e puo scegliere qualsiasi superficie visibile del modello.
- Il gap massimo di riproiezione resta `5 mm` e il limite angolare resta `5 gradi`: entrambi sono indipendenti da `wallPenetrationToleranceMm`.

## HUL - Convex Hull backend

**REQ-HUL-001 - Libreria hull vincolata.**
Uso di MIConvexHull (.NET), indipendente da Rapier.
- Criteri: modulo hull dipende da MIConvexHull.

**REQ-HUL-002 - Parsing GLB backend.**
Uso SharpGLTF.
- Criteri: vertici letti da GLB via SharpGLTF.

**REQ-HUL-003 - Formato collider JSON.**
`sourceHash`, `vertices`, `indices` tutti obbligatori e non null (`DEC-028`).
- Criteri: `sourceHash` SHA-256 del GLB con prefisso `sha256:` e 64 cifre esadecimali; `vertices` array piatto XYZ di numeri finiti, almeno 12 valori e cardinalita multipla di 3; `indices` array di interi non negativi, almeno 12 valori e cardinalita multipla di 3, ciascuno inferiore al numero di vertici. Le facce triangolari descrivono l'hull generato dal backend; nessuna ricostruzione hull nel browser.
- `ColliderDocument` backend e schema OpenAPI devono dichiarare gli indici obbligatori. Riuso solo con hash coerente e geometria valida; indici mancanti, nulli, vuoti o fuori intervallo invalidano il file anche con hash uguale. `HoldColliderDocument` e `convexMesh` consumano i dati precalcolati; il frontend verifica anche rappresentabilita finita dei vertici in float32.
- Non sono necessari migrazione o supporto retrocompatibile per documenti senza indici. La normale invalidazione/rigenerazione backend resta `REQ-HUL-004`, non un percorso di migrazione.

**REQ-HUL-004 - Invalidazione hash.**
- Criteri: hash uguale -> riuso; hash diverso -> rigenerazione.

**REQ-HUL-005 - Generazione asincrona non bloccante.**
- Criteri: backend disponibile anche con collider in generazione.
- Le prese devono diventare utilizzabili nel catalogo man mano che il collider e pronto, senza reload della sessione. `GET /api/holds/status` restituisce HTTP `200`, `no-store`, array di soli `{ id, colliderStatus, colliderUrl }`; stati `Missing`, `Pending`, `Ready`, `Failed`, URL `/api/holds/{id}/collider` solo per `Ready`, altrimenti `null`. Nessun metadato preview/modello, hash o geometria nella risposta; discovery senza leggere il contenuto GLB. Dopo la discovery iniziale, ID mai accodati nel job store risultano `Failed`, anche se la directory torna leggibile o contiene un collider non verificato; prima valgono i fallback `Missing`/`Ready`, senza sovrascrivere stati espliciti. Il worker elabora il backlog iniziale, non esegue hot reload. Il watcher segue `REQ-CAT-003`; test backend reali e browser simulati restano evidenze distinte.

**REQ-HUL-006 - Consumo collider dal frontend.**
- Criteri: nessun calcolo hull nel frontend.

**REQ-HUL-007 - Guardrail CI behavior-driven.**
La pipeline deve fallire se non e rispettato il comportamento hull richiesto.
- Criteri: fallimento CI se test REQ-TST-003 falliscono, se `collider.json` non e conforme a REQ-HUL-003 o se hash/invalidazione non rispettano REQ-HUL-004.

## UI - Interfaccia

**REQ-UI-001 - Layout.**
- Criteri: catalogo sinistra, viewport nel resto dello spazio.

**REQ-UI-002 - Menu superiore.**
- Criteri: bottone `Genera immagine` disponibile; `Rimuovi` e presente esclusivamente nel popup contestuale.

**REQ-UI-003 - OrbitControls.**
- Criteri: orbit/zoom/pan con target parete.

**REQ-UI-004 - Tastiera e accessibilita.**
- Non esistono shortcut globali per spostamento o rotazione hold.
- `Escape` annulla `attach-targeting`, `moving` o `rotating`, torna a `idle`, deseleziona la hold e nasconde il popup senza modificare la posa committata.
- I pulsanti del popup restano utilizzabili tramite focus, `Enter` e `Space`; gli handle che producono movimento o rotazione sono mouse-only.
- Le azioni semantiche del popup, incluso `Sgancia`, possono produrre cambi di stato o riposizionamenti diretti quando attivate da tastiera; il divieto riguarda gli input incrementali di movimento e rotazione.
- Criteri: pressione delle vecchie shortcut non modifica le hold; hint `Escape` visibile nelle modalita attive.

## UX - Interazione contestuale fase 9UX

**REQ-UX-001 - Popup contestuale.**
- Alla selezione di una hold compare un popup DOM vicino al bounding box proiettato della hold.
- Il popup mostra sempre `Dettagli`, `Aggancia`, `Sgancia`, `Ruota`, `Sposta`, `Rimuovi`.
- `Dettagli` e sempre abilitato e apre per la hold selezionata lo stesso viewer 3D on-demand usato dal catalogo.
- Stato detached: `Aggancia` e `Rimuovi` abilitati.
- Stato attached: `Sgancia`, `Ruota`, `Sposta`, `Rimuovi` abilitati.
- Il popup e compatto e usa uno sfondo semitrasparente con blur leggero per limitare l'occlusione della scena.
- Criteri: popup aggiornato durante camera, resize e trasformazioni; mantenuto nella viewport; nascosto in `attach-targeting`, dopo `Escape` e durante export.

**REQ-UX-002 - Macchina a stati interazione.**
- Stati fisici hold: `detached`, `attached`.
- Modalita UI: `idle`, `attach-targeting`, `moving`, `rotating`.
- Le modalita sono mutuamente esclusive; cambio selezione, rimozione, blur, `Escape` e pointer cancel interrompono le interazioni attive secondo il design.
- Le modalita moving/rotating possono contenere una sessione drag transazionale con snapshot iniziale e posa candidata.
- Criteri: una sola modalita attiva; una sola sessione drag; nessun timer, pointer capture, shadow o materiale preview resta attivo dopo l'uscita.

**REQ-UX-003 - Shadow target di aggancio.**
- Il target visibile e una shadow 3D runtime della hold selezionata, gialla e trasparente in stato ordinario e rossa dopo un tentativo invalido.
- La shadow usa geometrie e texture gia caricate, materiali preview dedicati e nessun collider/rigid body.
- Pivot, inclinazione e prospettiva derivano dal punto e dalla normale del ray centrale; la base appare aderente alla parete rispetto alla camera.
- Il footprint proiettato della base resta usato internamente per posizionare i 37 campioni ed e limitato fra `48 px` e `160 px`, ma non viene renderizzato come cerchio/ellisse.
- Durante `pointermove` viene aggiornato al massimo una volta per frame usando il ray centrale.
- Dopo un click invalido la shadow resta rossa per `500 ms` o fino al successivo movimento, poi torna gialla.
- Criteri: shadow assente fuori dalla parete; hold reale invariata durante targeting; shadow esclusa dal picking e dall'export.

**REQ-UX-004 - Campionamento superficie dominante.**
- Al click il footprint invisibile usa `37` campioni deterministici: centro e tre anelli rispettivamente da `6`, `12`, `18` punti.
- Ogni campione ha peso unitario ed esegue un raycast camera verso il primo triangolo visibile della parete.
- Gli hit di campioni adiacenti nel pattern vengono raggruppati se la distanza world e inferiore o uguale al diametro fisico della base e la differenza delle normali e entro `5 gradi`; la chiusura transitiva definisce il gruppo.
- Se il campione centrale e valido, vince il gruppo che lo contiene per mantenere coerenti shadow visibile e posa finale; se il centro non colpisce la parete, vince il gruppo con maggior peso fra i soli campioni validi. Non esiste copertura minima.
- Per ogni gruppo la distanza camera e il minimo delle distanze dei membri e l'ID stabile e il minimo ID dei membri.
- Tie-break residui: distanza camera del gruppo minore, poi ID stabile del gruppo minore.
- Se il centro cade in un foro ma altri campioni colpiscono la parete, il gruppo dominante resta candidabile.
- Criteri: risultato deterministico; nessun hit produce target non valido; superficie dominante verificata su bordo e curva.

**REQ-UX-005 - Commit aggancio.**
- Il click in `attach-targeting` costruisce una posa sul gruppo dominante.
- Il punto candidato e il campione del gruppo dominante piu vicino al centro del footprint; a pari distanza vince l'indice campione minore. La normale e stabilizzata usando soltanto i campioni del gruppo entro `5 gradi` dalla normale del punto candidato e deve restare entro `5 gradi` da tale normale, garantendo che punto e orientamento appartengano alla stessa patch locale anche sui raccordi.
- La posa valida viene applicata direttamente e il popup ricompare nello stato attached.
- La posa invalida non sposta la hold, colora il target di rosso e mantiene il targeting.
- `Escape` annulla senza modifiche.
- Criteri: nessuna validazione del percorso detached-target; posa finale validata contro parete e altre hold.

**REQ-UX-006 - Gizmo rotazione.**
- Due frecce circolari DOM/SVG compatte e semitrasparenti attorno alla hold selezionata.
- Click senza drag = `1 grado` con commit immediato.
- Drag = shadow 3D trasparente piu arco/linea gialla; angolo candidato quantizzato a `1 grado` e calcolato dallo snapshot iniziale.
- La modalita resta attiva fino a `Escape`; click esterno non la chiude.
- Durante il drag OrbitControls, zoom e pan sono completamente disabilitati.
- Nessuna validazione fisica avviene su pointermove; al pointerup esattamente una query applicativa endpoint (`validatePose`) solo se il candidato e cambiato e disponibile, poi commit o annullamento integrale. No-change, candidato indisponibile e annullamento: zero query endpoint e zero commit. Le query native interne su piu collider non sono ulteriori validazioni applicative.
- Criteri: hold reale immutata durante drag; endpoint valido committato una volta; endpoint invalido lascia posa e twist iniziali; cleanup su pointerup, pointercancel, lostpointercapture, blur, cambio selezione, rimozione ed Escape.

**REQ-UX-007 - Gizmo movimento.**
- Quattro frecce DOM/SVG compatte e semitrasparenti ai bordi della hold proiettata.
- Click senza drag = `1 cm`; piu click singoli restano disponibili. La pressione prolungata non avvia piu ripetizione automatica: superata la soglia drag, inizia la preview transazionale.
- Drag dalla freccia = shadow 3D aderente alla parete piu linea/freccia gialla retta verso il target richiesto; movimento vincolato all'asse della freccia.
- In modalita `moving`, il drag puo iniziare anche direttamente sulla mesh della hold selezionata; in questo caso il contact point segue il puntatore in entrambe le dimensioni screen-space, senza conservare l'offset iniziale pointer-contact point.
- La modalita resta attiva fino a `Escape`; click esterno non la chiude.
- Durante pointermove e consentito un raycast globale sul primo punto visibile, ma nessuna validazione Convex Hull o collision query.
- Durante il drag libero il contact point coincide con il puntatore. La shadow usa il primo punto visibile dell'intero modello, puo passare fra pannelli e adegua posizione e orientamento alla nuova normale trasportando il twist con la rotazione minima; non viene validato il percorso intermedio.
- Al pointerup esattamente una query applicativa endpoint solo se il candidato e cambiato e disponibile; no-change, no-hit e annullamento non eseguono query endpoint ne commit. Endpoint invalido annulla integralmente il drag.
- Criteri: direzioni coerenti con lo schermo; shadow sul punto visibile richiesto; nessun limite totale; hold reale immutata fino al commit; cambio pannello consentito; commit aggiorna punto, normale di aggancio e orientamento; cleanup completo su annullamento.

**REQ-UX-008 - Interazione camera durante targeting.**
- In `attach-targeting` il click sinistro e riservato al target.
- Rotazione/pan tramite tasto destro e zoom tramite rotella restano disponibili.
- Durante drag di movimento o rotazione OrbitControls, zoom e pan sono completamente congelati fino alla chiusura della sessione.
- Criteri: target e popup si riallineano dopo camera/resize; nessun doppio comando camera+hold.

**REQ-UX-009 - Piattaforma di input.**
- La fase 9UX e progettata per mouse desktop.
- Touch, gesture mobile e trasformazioni hold via tastiera non sono requisiti di questa fase; la viewport deve comunque continuare a caricarsi su schermi piccoli.
- Criteri: flussi E2E eseguiti con mouse desktop Chromium; nessuna promessa di parita touch.

**REQ-UX-010 - Risultati e feedback.**
- Le azioni scena restituiscono esiti distinguibili: `applied`, `blocked`, `invalid-target`, `not-available`, `previewing`, `committed`, `cancelled`, `invalid-endpoint`, `surface-limit`, con motivo non tecnico.
- La diagnostica locale espone un `reason` opzionale: `wall-collision`, `hold-collision`, `no-surface`, `surface-gap`, `normal-limit`, `no-change`, `path-unresolved`. Un percorso irrisolto non va presentato come collisione accertata; lo snapshot dell'ultima query posa e consultabile senza log persistenti o rete per frame. Non sostituisce la gestione globale errori definita nei requisiti ERR.
- Lo snapshot read-only `window.__ROUTE_SETTER_SCENE__.collisionTolerancesMm` espone i valori attivi, normalmente `{ wall: 5, holds: 1 }`. `lastPoseDiagnostic.toleranceMeters` indica la soglia del contatto governante selezionato dal minimo `distance + tolerance`, non necessariamente quello con distanza grezza piu profonda; non e un controllo per modificare la configurazione.
- Criteri: nessun messaggio `comando applicato` quando la trasformazione non avviene; errore locale non chiude il popup o la modalita salvo necessita.

## IMG - Generazione immagine

**REQ-IMG-001 - Esportazione della vista corrente.**
- Criteri: l'export mantiene esattamente posizione, orientamento, zoom, proiezione prospettica e rapporto d'aspetto della camera interattiva corrente.

**REQ-IMG-002 - Output della sola scena.**
- Criteri: l'immagine contiene esclusivamente il rendering 3D committato, senza catalogo, menu, popup, target, hint, gizmo, linee, archi o shadow 3D; lo sfondo corrisponde a quello corrente della scena.

**REQ-IMG-003 - Formato.**
- Criteri: file JPG valido ad alta risoluzione.

**REQ-IMG-004 - Specifica concreta export.**
- Criteri: il lato lungo e 2560 px e il lato corto e proporzionale al rapporto d'aspetto della viewport corrente; qualita JPEG 0.90.

## PRF - Prestazioni

Per v0.0.1 i criteri prestazionali restano obiettivi richiesti; limiti del metodo, delle misure e della copertura sono eccezioni di release accettate in `DEC-029`, documentate in [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md). Non sono una certificazione di tutti gli hardware, asset o FPS durante input.

**REQ-PRF-001 - Hardware target.**
- Criteri: scenario validato su PC domestico con GPU integrata WebGL 2.0.

**REQ-PRF-002 - Capacita.**
- Criteri: almeno 40 hold + parete interattive.

**REQ-PRF-003 - Reattivita.**
- Criteri: risposta percepita immediata sui comandi principali; preview drag aggiornata al massimo una volta per frame; nessuna `validatePose`, `contactShape` o shape-cast Convex Hull durante pointermove; movimento preview usa un singolo raycast globale sul modello per aggiornamento, senza sottopassi locali o surface-lock del drag (`DEC-024`); validazione endpoint tipica <= `50 ms`, caso complesso <= `100 ms`, nessun long task > `200 ms`.

**REQ-PRF-004 - Framerate.**
- Criteri: target indicativo >= 30 FPS durante interazione.

**REQ-PRF-005 - Nessun blocco UI.**
- Criteri: interfaccia resta responsiva durante load/posizionamento.

**REQ-PRF-006 - Metodo benchmark vincolante.**
- Criteri: scenario 40 hold, 1920x1080, 60s, interazione ripetibile, mediana FPS >= 30.

## ERR - Gestione errori

Le limitazioni di copertura e classificazione sono eccezioni di release accettate per v0.0.1 (`DEC-029`), non garanzie universali di recupero: [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md). Restano richiesti i controlli e i contratti seguenti.

**REQ-ERR-001 - Gestione centralizzata backend/frontend.**
- Criteri: backend con contratto uniforme nella pipeline applicativa; frontend con `AppError`/`toAppError`, helper `api/http.ts`, `ErrorReporter`, listener `error`/`unhandledrejection` e boundary dei callback asincroni/render/UI. Il reporter non deve propagare errori del proprio trasporto o callback di notifica, ne sopprimere la diagnostica nativa del browser.

**REQ-ERR-002 - Backend error contract.**
- Criteri: ErrorId univoco, status coerente, messaggio utente non tecnico.
- JSON uniforme `{ errorId, requestId, message }` e header `X-Request-Id`, correlati al log. Comprende binding/validazione MVC, risultati HTTP falliti, route/risorse mancanti, metodo/media type non supportato, payload troppo grande ed eccezioni propagate. OpenAPI deve documentare gli errori degli endpoint insieme ai successi.
- HTTP `416` usa ErrorResponse e lo stesso ErrorId nei log, mantenendo `Content-Range: bytes */<lunghezza>`; HTTP `206` mantiene il contenuto binario parziale. Il middleware di completamento HTTP usa il logger Serilog dell'host via DI, non il logger statico.
- Limiti di trasporto: risposta gia iniziata non riscrivibile, da interrompere dopo logging; cancellazione client non tradotta in `500`; errori di proxy/trasporto prima della pipeline fuori dal controllo applicativo. Non dichiarare uniformita universale per tali casi.

**REQ-ERR-003 - Nessuna esposizione dettagli tecnici.**
- Criteri: assenza stack trace/path/config in risposte utente.
- Frontend: solo messaggi applicativi sicuri, mai `message` remoto/HTML/JSON arbitrario o proprieta grezze dell'eccezione. Conservare solo identificativi validati; `AppError` usa contesto limitato e sanitizzato. Non inoltrare stack, URL, payload o dettagli sensibili al reporter.

**REQ-ERR-004 - Copertura categorie errori frontend.**
- Criteri: copertura JS, REST/HTTP, model load/parsing, three.js, Rapier, export immagine, UI.
- Categorie disponibili nel codice: `Unknown`, `JavaScript`, `Network`, `Http`, `Parsing`, `AssetLoad`, `Configuration`, `Rendering`, `Physics`, `Export`, `UI`. La presenza nell'unione di tipi non prova classificazione o intercettazione di ogni ramo: globali e callback possono ancora produrre `Unknown`. Vale l'eccezione di release della sezione ERR.

**REQ-ERR-005 - Isolamento errori locali.**
- Criteri: errore su singola hold non blocca il resto quando possibile.
- Guasti recuperabili devono rilasciare risorse/stato parziale; se un callback compromette la coerenza della scena, fermare il flusso coinvolto e comunicare il problema in sicurezza, senza promettere prosecuzione illimitata. Blocco collisionale e target invalido attesi sono feedback, non errori da notificare per frame.

## LOG - Logging

Le limitazioni di logging e diagnostica sono eccezioni di release accettate per v0.0.1 (`DEC-029`), descritte in [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md). Restano obbligatori sanitizzazione, dati non sensibili e comportamento bounded; l'accettazione non promette consegna o riconoscimento universale dei dati sensibili.

**REQ-LOG-001 - Logging server-side asincrono non bloccante.**
- Criteri: consumer backend bounded (default `2048` eventi), overflow scarta nuovi eventi senza attendere I/O; scrittura/retention sul consumer, drain in shutdown. `202` indica accettazione best-effort, non garanzia di persistenza contro filtri, overflow o guasti I/O.

**REQ-LOG-002 - Frontend senza persistenza log locale.**
- Criteri: `ErrorReporter` solo in memoria, coda massima `20`, deduplica massima `100` chiavi per `30 s`; un invio alla volta, throttle `1 s`, massimo `3` tentativi totali, backoff esponenziale base `1 s` con tetto `8 s`, timeout invio `5 s`. Rete/timeout e HTTP `408`/`429`/`5xx` ritentabili; altri rifiuti scartati. Overflow/tentativi esauriti scartano senza bloccare la UI; dispose rimuove listener, timer, coda/cache e annulla l'invio. Il trasporto log non segnala i propri fallimenti al reporter.

**REQ-LOG-003 - Logging JSON strutturato.**
- Criteri: campi minimi timestamp/livello/categoria/messaggio/componente + RequestId/ErrorId quando disponibili.
- `POST /api/logs`: obbligatori `level` (`Trace..Critical`, non `None`), `category` e `component` (1..80 caratteri), `message` (1..2000); opzionali `errorId` GUID, `requestId` (1..128 caratteri ASCII alfanumerici o `._:-`) e `context` dizionario stringa/stringa (massimo 20 voci, chiavi <=80, valori <=500; niente JSON annidato). Limite body `32768` byte.
- Risposta `202` esattamente `{ errorId, requestId }`: per Error/Critical preserva ErrorId fornito o ne genera uno, per altri livelli `null`; RequestId originale fornito o quello di ingestione. `X-Request-Id` e `IngestionRequestId` identificano sempre la richiesta di ingestione; la ricevuta non sostituisce la correlazione originale nel frontend. Il reporter corrente invia eventi di livello `Error`.

**REQ-LOG-004 - Soglia configurabile.**
- Criteri: default `Information` in `appsettings.json`.
- `Logging:LogLevel` usa livelli .NET `Trace..Critical` e `None` per disabilitare, con override arbitrari di categoria a prefisso piu lungo. Mapping Serilog coerente: `Verbose` -> `Trace`, `Fatal` -> `Critical` nell'output JSON; nessun uso di `None` come livello evento.

**REQ-LOG-005 - Rotazione/retention.**
- Criteri: file giornaliero, retention 7 giorni.
- Eta effettiva da `LastWriteTimeUtc < utcNow - 7 giorni`, non conteggio file; selezionare solo il pattern rolling configurato, preservando file estranei. Pulizia all'avvio consumer e al primo ciclo dopo cambio data UTC, anche con timer idle di un minuto; errori di accesso/I/O gestiti best-effort tramite SelfLog, non garanzia di cancellazione quando il filesystem la impedisce.

**REQ-LOG-006 - Sanitizzazione.**
- Criteri: assenza dati sensibili nei log.
- Sanitizzare ricorsivamente valori strutturati prima del rendering del messaggio e applicare limiti. Contesto browser sconosciuto oscurato; allowlist backend: `operation`, `assetId`, `holdId`, `status`, `statusCode`, `errorType`, `retryCount`, `phase`, `resource`, `errorClass`, `event`. Anche i valori ammessi sono sanitizzati e limitati.
- I chiamanti devono inviare solo sintesi diagnostiche non sensibili, non payload grezzi. Le euristiche correnti non garantiscono riconoscimento di ogni dato personale arbitrario non etichettato; vale l'eccezione di release della sezione LOG, senza autorizzare l'invio di dati sensibili.

**REQ-LOG-007 - Stack logging vincolato.**
- Criteri: uso Serilog nel backend.

## TST - Test automatici

La copertura non esaustiva e i casi limite sono attenzioni accettate, non bloccanti per la chiusura di v0.0.1: [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md). Restano le suite e i criteri seguenti; test falliti o non eseguiti non diventano superati per effetto dell'accettazione.

**REQ-TST-001 - CI fail-on-test-failure.**
- Criteri: un test obbligatorio fallito deve far fallire la pipeline. Edge/Firefox sono verifiche esplorative separate, non gate di release (`REQ-ARC-007`, `DEC-029`); i relativi esiti vanno conservati come tali.

**REQ-TST-002 - Unit test backend xUnit.**

**REQ-TST-003 - Test hull obbligatori.**
- Criteri: mancante->generato; coerente->no rigenerazione; GLB modificato->rigenerazione.

**REQ-TST-004 - Integrazione REST.**

**REQ-TST-005 - E2E Playwright flussi principali.**
- Criteri: verifiche di release sul target ufficiale Chrome; Chromium puo fornire regressioni di supporto, senza sostituire la verifica del browser ufficiale.

**REQ-TST-006 - Test fisica headless completi (Vitest).**
- Criteri: copertura dei 5 scenari obbligatori da app_definition.md:
  1) hold non attraversa parete;
  2) due hold non compenetrano;
  3) hold posizionabile correttamente in assenza collisioni;
  4) rimozione hold libera spazio;
  5) comportamento collisioni invariato dopo modifiche (regressione).

**REQ-TST-007 - Determinismo test fisici.**

**REQ-TST-008 - Test snap e degeneri completi.**
- Stato: requisito storico della fase 8 congelata, escluso dai 101 requisiti attivi. Le verifiche dell'interazione corrente sono definite in `REQ-TST-010`; i comportamenti legacy seguenti non sono normativi.
- Criteri storici: no snap oltre 5 cm, snap entro 5 cm, normale del punto di contatto corretta, rotazione post-snap attorno alla normale, movimento tangenziale post-snap, fallback normale deterministico, tie-break deterministico.

**REQ-TST-009 - Verifica lockfile CI.**
- Criteri: CI usa lockfile, fallisce con drift dipendenze.

**REQ-TST-010 - Test interazione contestuale 9UX.**
- Criteri: copertura automatica popup, stati, targeting, superficie dominante, target invalido, aggancio diretto, sgancio progressivo e click incrementali.
- Criteri drag: shadow creata senza richieste PNG/GLB/asset; geometrie e texture condivise; nessun rigid body/collider; shadow esclusa dal picking; hold reale, collider, contact point, normale e twist immutati durante pointermove; nessuna `validatePose`, `contactShape` o shape-cast Convex Hull durante pointermove; contact point sotto al mouse nel drag libero; passaggio fra pannelli e adeguamento alla nuova normale; rotazione quantizzata a 1 grado; linea/arco coerenti; nessun limite totale alla distanza richiesta; esattamente una query applicativa endpoint al pointerup solo per candidato cambiato e disponibile, zero per no-change/no-hit/annullamento; endpoint valido committato una sola volta; endpoint invalido con rollback totale di tutti gli stati; endpoint libero oltre ostacolo intermedio accettato; cleanup pointer/materiali/preview; camera congelata; shadow esclusa dall'export; nessuna perdita risorse dopo drag ripetuti.

## DOC - Documentazione

**REQ-DOC-001 - Documentazione inline esaustiva in italiano.**
- Criteri: tutte le classi e tutti i metodi backend/frontend documentati in italiano.
- I gate strutturali non certificano da soli lingua o qualita semantica della documentazione; resta richiesto il controllo del contenuto.

**REQ-DOC-002 - Documento applicativo completo.**
- Criteri: descrive logica completa, struttura software, avvio live/debug e separa esplicitamente baseline storica 0-9 dalla UX attiva dalla fase 9UX.

**REQ-DOC-003 - Diagrammi obbligatori.**
- Criteri: presenti 6 diagrammi richiesti (architettura, cartelle, API, lifecycle hold, flusso UI, responsabilita backend/frontend).

**REQ-DOC-004 - Documento test completo.**
- Criteri: copre scopi, risultati attesi, framework, strumenti.

**REQ-DOC-005 - Cartella documentazione dedicata.**
- La guida italiana [backend-contracts.md](../docs/backend-contracts.md) documenta i contratti backend; documentazione applicativa in `docs`, report originali di fase storici.

## DEP - Gestione dipendenze

**REQ-DEP-001 - Versioni esatte pin-nate.**

**REQ-DEP-002 - Lockfile obbligatori versionati.**

**REQ-DEP-003 - Vietate versioni floating (`^`, `~`, wildcard).**

**REQ-DEP-004 - Baseline versioni stabili (no prerelease).**
- Frontend runtime: `three@0.161.0`, `@dimforge/rapier3d-compat@0.12.0`.
- Frontend tooling: `vite@5.2.0`, `typescript@5.4.5`.
- Frontend test: `vitest@1.6.0`, `@playwright/test@1.44.0`.
- Backend runtime: `Serilog.AspNetCore@8.0.1`, `Serilog.Sinks.File@5.0.0`, `SharpGLTF.Core@1.0.0`, `MIConvexHull@1.1.19.504`.
- Backend test: `xunit@2.7.1`, `Microsoft.AspNetCore.Mvc.Testing@8.0.5`.
- Framework target: `.NET 8` LTS; SDK `8.0.424`.
- Toolchain frontend: `Node.js 22.18.0` LTS con `npm 10.9.3`.
- Versioni NuGet dirette espresse come intervalli esatti (esempio: `[1.1.19.504]`).
- Criteri: nessuna dipendenza prerelease (`-alpha`, `-beta`, `-rc`) in baseline/CI.
