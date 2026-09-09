# Decisioni e regole operative

Baseline v0.0.1: sviluppo CHIUSO e ACCETTATO dall'utente con limiti noti (`DEC-029`). Le voci `OPEN-002` e `OPEN-003` conservano gli identificativi delle regole per evoluzioni future, non decisioni pendenti per questa release.

Costituzione e requisiti correnti restano normativi con le revisioni e le eccezioni di release approvate esplicitamente. Le decisioni non certificano automaticamente implementazione o copertura universali. [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md) e l'unica fonte di stato, rischi, eccezioni ed evidenze con provenienza; i report originali di fase restano storici.

Prevalenza: `DEC-028` approva prefisso dei click senza sliding e indici hull obbligatori; `DEC-029` sostituisce lo stato bloccante della release descritto in precedenza da `DEC-027/028`. Le decisioni precedenti conservano l'evoluzione tecnica rilevante, non elenchi di attivita ancora necessarie per chiudere v0.0.1.

## DEC-001 - Shortcut tastiera trasformazioni

Stato: CHIUSA dalla fase 9UX.

Decisione:
- rimuovere tutte le shortcut globali per movimento e rotazione hold;
- usare `Escape` per annullare targeting e modalita, deselezionare la hold e nascondere il popup;
- mantenere accessibilita standard dei pulsanti popup con `Tab`, `Enter`, `Space`;
- mantenere mouse-only gli handle che producono trasformazioni.

## OPEN-002 - Estensione endpoint REST

Stato: REGOLA APPROVATA per evoluzioni future, non blocco di v0.0.1.

Vincoli:
- gli endpoint baseline di `02-design-tecnico.md` §4 restano obbligatori;
- endpoint aggiuntivi consentiti solo se necessari;
- nessun endpoint che introduca persistenza tracciature o autenticazione;
- aggiornare OpenAPI e test integrazione.

## OPEN-003 - Aggiornamento versioni package nel tempo

Stato: REGOLA APPROVATA per manutenzione futura, non blocco di v0.0.1.

Vincoli:
- baseline iniziale chiusa in `REQ-DEP-004`;
- aggiornamenti versioni consentiti solo mantenendo pinning+lockfile;
- ogni aggiornamento deve superare suite test completa;
- aggiornare documentazione compatibilita e changelog tecnico.

## DEC-004 - Baseline congelata

Stato: CHIUSA.

Decisione:
- fasi 0-9 e report associati restano congelati come storico;
- fase 9UX e fasi successive usano esclusivamente i requisiti aggiornati;
- nessun obbligo di riscrivere retroattivamente report o implementazioni storiche.

## DEC-005 - Popup e modalita

Stato: CHIUSA.

Decisione:
- popup sempre completo con azioni abilitate per stato;
- popup nascosto in targeting;
- modalita `moving` e `rotating` restano attive fino a `Escape`;
- click esterno non deseleziona e non chiude tali modalita;
- dopo aggancio valido il popup ricompare in stato attached.

## DEC-006 - Aggancio diretto e target

Stato: CHIUSA.

Nota di prevalenza: la sola visualizzazione DOM/SVG riportata nella decisione storica sotto e superata da `DEC-020` (shadow 3D, footprint invisibile per i campioni). Il contenuto storico resta invariato.

Decisione:
- `Aggancia` teletrasporta editorialmente la hold al target;
- validare la posa finale, non il percorso detached-target;
- target DOM/SVG derivato dalla base della hold con limiti 48-160 px;
- 37 campioni deterministici e nessuna percentuale minima di copertura;
- se il centro cade in un foro, gli altri campioni validi determinano comunque il gruppo dominante;
- tutta la geometria e candidabile, ma una posa collisionale e rifiutata.

## DEC-007 - Surface lock

Stato: CHIUSA; applicabile ai soli click incrementali, come precisato da `DEC-024` e `C19`.

Decisione:
- la hold segue piccole variazioni curve;
- confronto sempre con la normale memorizzata all'aggancio;
- tolleranza iniziale 5 gradi;
- oltre soglia il movimento si arresta, senza transizione automatica;
- per cambiare superficie usare il drag globale endpoint-only oppure `Sgancia` e nuovo `Aggancia`.

## DEC-008 - Sgancio

Stato: CHIUSA.

Decisione:
- primo candidato a 0.50 m lungo la normale uscente;
- incremento di 0.10 m fino al primo candidato valido;
- dominio massimo 10 m per garantire terminazione;
- nessun ritorno allo spawn iniziale;
- se non esiste spazio, hold ancora attached e feedback utente.

## DEC-009 - Input e camera

Stato: CHIUSA.

Nota di prevalenza: per la camera durante il drag prevale `DEC-015`, che congela completamente OrbitControls, zoom e pan, non soltanto il pointer corrente. Il contenuto storico sotto resta invariato.

Decisione:
- fase 9UX mouse desktop;
- click sinistro riservato al target durante attach-targeting;
- tasto destro per orbit/pan e rotella per zoom restano disponibili;
- drag gizmo usa pointer capture e blocca OrbitControls sullo stesso pointer;
- touch non e richiesto.

## DEC-010 - Retro

Stato: CHIUSA.

Decisione:
- il retro non viene classificato semanticamente;
- un tentativo intenzionale di aggancio sul retro e fuori ambito;
- il retro resta parte del TriMesh e quindi ostacolo fisico nei flussi ordinari.

## DEC-011 - Reimplementazione 9UX-bis

Stato: CHIUSA.

Decisione:
- il drag-and-drop e una revisione della stessa FASE 9UX, non una nuova fase;
- il report `Phase_9UX_implementation_done.md` resta storico e non viene eliminato;
- la nuova implementazione produce `phases-outcome/Phase_9UX-bis_implementation_done.md`.

## DEC-012 - Shadow runtime

Stato: CHIUSA.

Decisione:
- la preview usa un clone grafico 3D creato a runtime dalla hold selezionata;
- geometrie e texture vengono condivise; sono creati solo materiali preview trasparenti;
- nessun PNG, GLB o asset aggiuntivo e richiesto;
- la shadow non possiede collider o rigid body, non e selezionabile ed e esclusa dall'export.

## DEC-013 - Semantica drag endpoint-only

Stato: CHIUSA.

Precisazione applicativa corrente: esattamente una query applicativa endpoint (`validatePose`) al pointerup solo per un candidato cambiato e disponibile. No-change, no-hit/candidato indisponibile e annullamento non eseguono query endpoint ne commit. Una validazione puo contenere piu query native contro i collider. La decisione storica sotto non impone query sui no-op.

Decisione:
- durante il drag la hold reale e il collider restano invariati;
- nessuna collision query viene eseguita durante pointermove;
- al pointerup viene validata soltanto la posa endpoint;
- il percorso puo attraversare ostacoli e non viene considerato;
- endpoint valido: commit atomico;
- endpoint invalido: rollback totale, nessun prefisso parziale.

## DEC-014 - Movimento drag aderente

Stato: CHIUSA.

Nota di prevalenza: ogni precedente surface-lock del drag e superato da `DEC-024`; resta locale soltanto il click. Non reintrodurre tracking della patch iniziale o sottopassi locali nel drag globale.

Decisione:
- il drag parte da una delle quattro frecce e resta vincolato alla relativa direzione screen-space;
- la shadow viene raycastata e mantenuta aderente alla parete durante tutta la preview;
- il surface lock a 5 gradi si applica ai click incrementali; per il drag di traslazione questa regola e superata da `DEC-024`;
- nel drag la shadow segue il primo punto visibile richiesto e puo cambiare pannello;
- traiettoria indicata da linea/freccia retta;
- nessun limite massimo alla distanza richiesta.

## DEC-015 - Click e camera durante drag

Stato: CHIUSA.

Decisione:
- le stesse frecce conservano il click singolo da 1 cm e diventano origine del drag;
- le frecce circolari conservano il click singolo da 1 grado e diventano origine del drag;
- soglia iniziale click/drag `4 px`;
- durante il drag OrbitControls, zoom e pan sono completamente congelati;
- `Escape`, pointercancel, lost capture, blur, cambio selezione e rimozione annullano senza commit;
- preview composta da shadow piu linea/freccia per movimento e shadow piu arco/linea per rotazione.

## DEC-016 - Export durante drag

Stato: CHIUSA.

Decisione:
- `Genera immagine` e disabilitato mentre una sessione drag e attiva;
- l'export non annulla automaticamente il drag;
- dopo commit o cancel il comando viene riabilitato;
- il `previewGroup` resta comunque escluso dall'export come protezione aggiuntiva.

## DEC-017 - Drag libero dalla presa

Stato: CHIUSA.

Nota di prevalenza: ogni precedente conservazione dell'offset pointer-contact point e sostituita da `DEC-024`. Nel drag libero il contact point coincide con il puntatore; il vincolo di direzione delle frecce resta valido.

Decisione:
- il drag diretto sulla hold e disponibile soltanto dopo aver attivato `Sposta`;
- il click ordinario continua a selezionare la hold;
- il drag dalla hold e libero in due dimensioni screen-space; per `DEC-024` il contact point coincide col puntatore senza conservare l'offset iniziale;
- il drag dalle frecce resta vincolato alla rispettiva direzione;
- click singoli sulle frecce restano micro-spostamenti da 1 cm.

## DEC-018 - Target orientato

Stato: CHIUSA.

Nota di prevalenza: la visualizzazione disco/ellisse sotto e storica e superata da `DEC-020`. La shadow 3D e il target corrente; il footprint resta solo un supporto interno al campionamento.

Decisione:
- il target visualizza la proiezione prospettica di un disco tangente alla superficie;
- l'ellisse risultante comunica inclinazione e orientamento locale rispetto alla camera;
- il calcolo usa proiezioni Three.js e non introduce query fisiche aggiuntive.

## DEC-019 - Verso drag rotazione

Stato: CHIUSA.

Decisione:
- il segno del drag deve fare seguire al punto della hold piu vicino alla freccia selezionata il movimento del mouse;
- la convenzione tiene conto dell'asse Y dello schermo orientato verso il basso;
- il comportamento click da 1 grado resta invariato.

## DEC-020 - Shadow targeting aggancio

Stato: CHIUSA.

Decisione:
- il cerchio/ellisse visibile di targeting e sostituito dalla shadow 3D runtime della hold;
- il footprint proiettato resta usato internamente per i 37 campioni;
- la shadow e gialla normalmente e rossa dopo un endpoint invalido;
- posizione e inclinazione seguono il ray centrale e la normale locale;
- nessun asset aggiuntivo, collider o rigid body;
- shadow esclusa da picking ed export.

## DEC-021 - Escape e alleggerimento popup

Stato: CHIUSA.

Decisione:
- `Escape` annulla la sessione attiva senza commit, torna a `idle`, deseleziona la hold e nasconde il popup;
- il blur della finestra continua ad annullare l'interazione senza imporre la deselezione;
- il popup usa controlli piu piccoli e uno sfondo semitrasparente con blur leggero per ridurre l'occlusione della scena.

## DEC-022 - Dettagli dal popup e handle leggeri

Stato: CHIUSA.

Decisione:
- il popup della hold selezionata include `Dettagli`, sempre disponibile;
- `Dettagli` riusa il viewer 3D del catalogo e il manifest gia memorizzato, senza eager-load aggiuntivo;
- gli handle circolari di movimento e rotazione sono ridotti e semitrasparenti per limitare l'occlusione della scena.

## DEC-023 - Coerenza punto-normale sui raccordi

Stato: CHIUSA.

Nota di prevalenza: `DEC-024` sostituisce ogni precedente lock del drag alla superficie/patch iniziale; restano la coerenza locale punto-normale e il surface-lock dei soli click.

Decisione:
- la chiusura transitiva resta usata per selezionare il gruppo dominante;
- se il campione centrale e valido la relativa patch prevale, mentre la maggioranza resta il fallback per il centro in un foro;
- punto e normale finali devono appartenere alla stessa patch locale;
- la normale stabilizzata usa soltanto membri entro 5 gradi dalla normale del punto scelto e resta entro la stessa soglia;
- targeting, click e drag condividono orientamento e fallback delle normali;
- la tolleranza surface-lock resta 5 gradi e non viene aumentata per mascherare la triangolazione;
- il tracking topologico non viene usato dal drag globale; resta valida la coerenza locale punto-normale del targeting.

## DEC-024 - Drag globale sull'intero modello

Stato: CHIUSA.

Decisione:
- il drag attached usa il primo punto visibile sull'intero modello e puo passare fra pannelli, aggiornando la normale di aggancio al commit;
- il percorso intermedio non viene validato e la soglia di 5 gradi resta soltanto per i click incrementali;
- nel drag libero il contact point coincide col puntatore e l'orientamento viene trasportato sulla nuova normale con la rotazione minima;
- non viene introdotta una nuova modalita di movimento per le hold detached;
- spawn, camera e popup detached mantengono il comportamento consolidato precedente.

## DEC-025 - Primo gruppo fisica, diagnostica e limiti numerici

Stato: gruppo storico completato nel perimetro richiesto; non attesta la risoluzione generale dei limiti fisici, accettati per v0.0.1 da `DEC-029`.

Prevalenza: `DEC-026` sostituisce la tolleranza geometrica unica `1 mm` riportata sotto; `DEC-028` approva la semantica del prefisso. Gli esiti del gruppo restano nel [report storico](../phases-outcome/Physics_diagnostics_group_1_done.md).

Decisione:
- includere tolleranza/diedri, continuita dei click di traslazione e rotazione, diagnostica locale e regressioni; differire interventi backend/catalogo e gestione globale errori;
- allineare `C19` ai soli click; mantenere drag globale endpoint-only e contact point sotto al puntatore nel drag libero, senza offset iniziale;
- validare la posa originale tramite `collider.contactShape` contro l'intero TriMesh, senza shift uscente; corroborare i contatti negativi con intersezione nativa;
- mantenere tolleranza geometrica `0.001 m` ed epsilon numerico distinto `2e-6 m`; usare normalizzazione di fattore `100` solo nelle query fra coppie convesse supportate, con gli stessi vertici hull e indici precalcolati, senza generazione frontend o modifica della geometria;
- per i click usare shape cast solo a rotazione fissa e da partenza separata, con arresto al primo contatto; contatti iniziali e rotazione sono gestiti dagli intervalli ricorsivi basati su clearance contro massimo moto dei punti (traslazione piu raggio per angolo). Budget `512`, bound minimo `2e-6 m`, prefisso conservativo se irrisolto, non semplice campionamento di endpoint;
- usare la broadphase AABB nativa con semiestensione `raggio + prediction` per le query di posa; esporre `lastActionResult.reason` e `lastPoseDiagnostic.uncertain` nello snapshot read-only, senza sentinelle infinite, log persistenti o rete per frame. Esito incerto -> `path-unresolved` nella UI, non collisione accertata;
- associare `poseValidation.test.ts` e `realWall.test.ts` ai requisiti esistenti: casi sintetici, pavimento/pinna nello stesso collider con contatto iniziale, 40 collider lontani senza narrowphase aggiuntiva, determinismo, query senza mutazioni/rete e asset reali invariati.

Gli algoritmi conservativi non rendono infallibili le query native. Eventuali upgrade Rapier o cambi di rappresentazione fisica richiedono un perimetro approvato e le verifiche di `OPEN-003`, non sono impliciti nella chiusura v0.0.1.

## DEC-026 - Tolleranza parete configurabile e separata dalle prese

Stato: APPROVATA e IMPLEMENTATA nel perimetro della configurazione fisica. L'accettazione del bug e registrata in `DEC-027`; la chiusura della versione con i limiti noti e in `DEC-029`.

Decisione:
- sostituire soltanto la parte tolleranza di `DEC-025`: parete configurabile `1..10 mm`, estremi inclusi e decimali ammessi, default `5 mm`; fra prese `1 mm` immutabile; epsilon numerico `2e-6 m` invariato;
- aggregare in `PhysicsWorld` il minimo per contatto di `distance + tolerance` sia negli endpoint sia negli intervalli click, non scegliere la distanza grezza piu profonda prima di applicare una soglia unica. La diagnostica `toleranceMeters` deve riferirsi al contatto governante, non necessariamente al piu profondo;
- precisazione diagnostica finale: una violazione accertata della soglia prevale sull'incertezza di un altro collider, con `blocker`, handle, penetrazione, tolleranza e `uncertain: false` riferiti allo stesso contatto. In assenza di violazioni accertate, l'incertezza resta bloccante con diagnostica coerente e `path-unresolved`; non e una collisione provata. Regressione confermata nei due ordini broadphase, anche rimuovendo il collider della violazione;
- mantenere gli sweep da partenza separata con arresto prima del primo contatto, anche verso il pavimento; non usare la tolleranza per avanzare oltre il TOI. Contatti iniziali e rotazione restano gestiti dagli intervalli; surface-lock `5 gradi`, gap `5 mm`, budget `512`, bound minimo `2e-6 m` e drag endpoint-only invariati;
- usare il file runtime `source/frontend/public/physics-config.json` con contenuto iniziale `{"wallPenetrationToleranceMm":5}`. Numero JSON finito senza virgolette, punto decimale (esempio `7.5`), niente commenti o altre chiavi; nessuna configurazione della soglia hold;
- leggere una sola volta al bootstrap con `cache: 'no-store'`; nessuna rilettura durante le interazioni. File invalido/indisponibile blocca l'avvio senza default silenzioso, con errore gestito nella pagina e senza `pageerror` non gestiti. La correzione e circoscritta al bootstrap della configurazione, non a backend/catalogo o gestione globale errori;
- in sviluppo modificare il file `public` servito da Vite e ricaricare, senza compilazione o riavvio backend/frontend. Vite puo ricaricare automaticamente alla modifica: esportare prima di editare. Reload perde la sessione; JPG conserva solo un'immagine, non una tracciatura editabile;
- in produzione installazione/build/deploy iniziali del codice sono necessari. Successivamente modificare il `dist/physics-config.json` distribuito e ricaricare non richiede rebuild/riavvio con server statico. Modificare soltanto il sorgente `public` richiede rebuild o copia nel deploy; mantenere li il valore permanente perche il build successivo sovrascrive `dist`. Configurare server/proxy/cache per rispettare `no-store`;
- esporre in sola lettura `window.__ROUTE_SETTER_SCENE__.collisionTolerancesMm`, normalmente `{ wall: 5, holds: 1 }`, e `lastPoseDiagnostic.toleranceMeters`; nessun controllo live tramite console o logging/rete per frame;
- non aumentare la soglia fra prese o il limite angolare per mascherare difetti.

Il [report DEC-026](../phases-outcome/Wall_tolerance_configuration_done.md) conserva gli esiti storici. Le prove automatiche e strumentali furono eseguite dall'agente, non dall'utente; la conferma dell'utente riguarda il funzionamento atteso. La configurazione non garantisce agganciabilita universale o compensazione di tutte le imperfezioni dei modelli.

## DEC-027 - Accettazione bug e riconciliazione applicazione

Stato: bug originale CHIUSO per conferma esplicita dell'utente. Il precedente stato bloccante della release e superato da `DEC-029`; le due scelte normative della riconciliazione sono state approvate in `DEC-028`.

Decisione storica:
- registrare la conferma del funzionamento atteso e della correzione richiesta, distinta dalle verifiche strumentali;
- avviare il consolidamento `CON01..CON09` senza eliminare requisiti o dedurre conformita dalla sola presenza di test;
- preservare soglie e configurazione `DEC-026`, separazione mesh/collider e drag endpoint-only;
- riconciliare esplicitamente la semantica dei click e il contratto degli indici hull, poi definiti da `DEC-028`.

## DEC-028 - Prefisso dei click e indici hull obbligatori

Stato: CHIUSA, entrambe le scelte APPROVATE esplicitamente dall'utente. La decisione tecnica resta valida; lo stato di release precedentemente bloccante e superato dall'accettazione esplicita `DEC-029`.

Scelta 1, `REQ-FIS-004`:
- sostituire il precedente obbligo move-and-slide con il prefisso conservativo valido lungo la direzione del click richiesto, entro riproiezione e surface-lock locali; non mantenere separatamente componenti libere per scorrere automaticamente lungo un ostacolo o aggirarlo;
- preservare il percorso attivo `maximumValidPoseFraction`: click traslazione e rotazione arrestati al prefisso validato, arresto conservativo in caso irrisolto; drag e riposizionamenti editoriali restano endpoint-only;
- mantenere le query native Rapier come base della validazione e il KinematicCharacterController come foundation legacy/opzionale, non solver obbligatorio dei click attivi. Restano architettura client-side, mesh/collider separati, hull precalcolati, assenza di dinamica/impulsi, autostep e snap-to-ground disabilitati;
- nessun cambiamento a tolleranze, surface-lock, asset o versioni; i controlli di `REQ-FIS-003`/`REQ-FIS-011` restano richiesti con l'eccezione di release `DEC-029`, non una garanzia universale ottenuta dalla scelta.

Scelta 2, `REQ-HUL-003`:
- `sourceHash`, `vertices` e `indices` obbligatori e non null, con facce triangolari valide secondo lo schema del design §5; il backend genera e documenta gli indici e il frontend li consuma con `convexMesh`;
- nessuna migrazione o retrocompatibilita necessaria per collider senza indici, nessun fallback o generazione hull frontend (`REQ-HUL-006` invariato). La rigenerazione ordinaria di file invalidi resta parte del processore backend, non un programma di migrazione;
- contratto e OpenAPI allineati a `ColliderDocument`/`HoldColliderDocument`.

## DEC-029 - Chiusura v0.0.1 con supporto Chrome e limiti accettati

Stato: APPROVATA esplicitamente dall'utente. Sviluppo v0.0.1 COMPLETATO, CHIUSO e ACCETTATO con limiti noti.

Decisione:
- chiudere lo sviluppo di v0.0.1 e archiviare il consolidamento `CON01..CON09`; le attenzioni residue sono accettate e non bloccano questa release;
- aggiornare con approvazione dell'autore `C12`, `REQ-ARC-007` e `app_definition.md`: solo Chrome Stable desktop con WebGL 2.0 e ufficialmente supportato. Ultima versione testata Chrome 152; nessuna promessa automatica di compatibilita con ogni futura Stable del vendor. Edge e Firefox restano esplorativi, non target ufficiali ne gate di release;
- mantenere Rapier `0.12.0` con limiti noti accettati come eccezione di release: controlli di collisione sull'intero hull e soglie separate restano obbligatori, ma non costituiscono garanzia universale di CCD, impenetrabilita o agganciabilita. Nessuna soluzione generale, modifica degli asset o upgrade del motore e dichiarata o implicita;
- accettare le altre limitazioni e attenzioni documentate in [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md), unica fonte di stato e rischi della versione, senza duplicarne qui l'elenco. Le eccezioni non eliminano i requisiti funzionali: tutti i 101 requisiti attivi e l'ID storico restano conservati;
- mantenere le scelte tecniche `DEC-028`. Questa decisione supera il precedente stato di blocco della release di `DEC-027/028`, non la loro evoluzione tecnica valida e non riapre il bug originale;
- conservare esiti, limiti e provenienza delle verifiche: accettazione utente non significa esecuzione delle suite, test non eseguiti o falliti non diventano superati. I gate obbligatori mantengono il fallimento sui test falliti; le verifiche esplorative non sono blocchi di release;
- non imporre ulteriori sviluppi, upgrade, prove hardware o run CI remote come prerequisiti retroattivi della chiusura. Eventuali miglioramenti successivi richiedono un nuovo perimetro concordato.
