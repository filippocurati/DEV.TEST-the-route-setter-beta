# APPLICAZIONE PER TRACCIATURE VIE CLIMBING INDOOR

## STATO E PREVALENZA DOCUMENTALE

Questo documento e i requisiti correnti in `sdd-specs/01-specifica-requisiti.md`, entro i vincoli di `sdd-specs/00-costituzione.md` e le decisioni esplicite in `sdd-specs/05-open-decisions-guidate.md`, definiscono il comportamento richiesto. Il design distingue soluzione prevista e implementazione osservata; codice, report e test non modificano implicitamente i requisiti. I report sono evidenze del rispettivo perimetro e momento, non certificazioni dell'intera applicazione.

Lo sviluppo di **v0.0.1 e CHIUSO e ACCETTATO dall'utente con limiti noti** (`DEC-029`). Il bug originale resta chiuso; le scelte approvate in `DEC-028` (prefisso dei click senza sliding e indici hull obbligatori) restano valide. La chiusura sostituisce lo stato bloccante precedente, non certifica garanzie universali ne corregge implicitamente i limiti tecnici.

[06-stato-versione-v0.0.1.md](sdd-specs/06-stato-versione-v0.0.1.md) e l'unica fonte dello stato di versione, dei rischi, delle eccezioni accettate e degli esiti con relativa provenienza. I requisiti funzionali restano in vigore, con le eccezioni di release esplicitamente accettate in `DEC-029`; le attenzioni residue non bloccano la chiusura di v0.0.1. I report originali di fase restano storici.

## DESCRIZIONE DELL'APPLICAZIONE

L'applicazione che devi generare è un'applicazione che serve per assistere i tracciatori di vie di climbing indoor su pareti di arrampicata in palestre indoor.
La tracciatura delle vie di arrampicata in palestre di climbing indoor consiste nel sistemare le prese sulla parete in modo da creare una sequenza utilizzabile per una persona per poter risalire l'intera parete utilizzando solo mani e piedi.
Utilizza la tua conoscenza generale in ambito di climbing e climbing indoor per capire le dinamiche dell'arrampicata, delle prese e della tracciatura delle vie.

## STRUMENTI PER LO SVILUPPO

L'applicazione che voglio sviluppare deve seguire questa architettura tecnica:
- L'applicazione deve avere una parte backend realizzata con il linguaggio C# ASP.NET Core Web API
- Il frontend deve essere implementato tramite il motore grafico three.js, il rendering deve essere completamente lato frontend, non deve esserci rendering lato server
- backend e frontend devono comunicare tra loro tramite REST API ed il linguaggio utilizzato per la comunicazione deve essere il JSON. Le API devono essere sviluppate secondo gli standard di progettazione OpenAPI, con separazione Controller/Service e swagger documentativo
- Rapier deve essere il motore fisico da utilizzare per implementare tutte le regole fisiche di un mondo reale (nello specifico la realtà di una via di arrampicata indoor) applicabili ai modelli. Rapier deve essere integrato lato frontend tramite il binding ufficiale JavaScript/WebAssembly (pacchetto npm @dimforge/rapier3d-compat), eseguito interamente nel browser insieme a three.js. Il backend non deve contenere alcuna logica di simulazione fisica né dipendenze da Rapier: il suo ruolo è limitato a servire i modelli statici, il manifest del catalogo e a ricevere gli eventi di log. Questa scelta è necessaria per garantire il feedback immediato richiesto durante lo spostamento delle prese, senza effettuare chiamate REST ad ogni aggiornamento della posizione. Questo vincolo riguarda esclusivamente la simulazione fisica interattiva. La generazione dei collider Convex Hull delle prese, descritta nella sezione "Movimenti e collisioni tra gli oggetti in scena", è un'operazione di calcolo geometrico statico indipendente da Rapier e non rientra in questo vincolo.
- Three.js deve essere utilizzato esclusivamente per il rendering della scena 3D. Rapier deve essere utilizzato, sempre lato client, come motore fisico responsabile della gestione delle collisioni, dei contatti e dei vincoli di movimento.
- L'applicazione deve essere utilizzabile esclusivamente via browser, senza installare software o librerie aggiuntive. Per v0.0.1 il solo browser ufficialmente supportato e Chrome Stable desktop con WebGL 2.0; l'ultima versione testata e Chrome 152. Non e una promessa di compatibilita automatica con ogni futura versione Stable del vendor. Edge e Firefox sono esplorativi, non target ufficiali ne blocchi di release (`DEC-029`, `REQ-ARC-007`, `C12`).

### Gestione file dei modelli

Nel backend saranno previste delle cartelle contenenti i modelli GLB statici da caricare, sia per la parete su cui avverranno le tracciature, che per tutte le singole prese.
Nella cartella "main-wall" sarà presente il modello 3D della parete su cui tracciare.
Nella cartella "holds" saranno presenti una cartella per ciascun modello di presa, ogni cartella ha nome "Hold" seguito da un suffisso numerico, ogni cartella contiene i file per la visualizzazione del modello stesso. 
Per le prese potrebbero esserci solo i file GLB o anche i file delle texture o altri file necessari per tutte le caratteristiche del modello, l'applicazione deve gestire il caricamento di solo i file che vengono trovati (non importa che ci siano o meno le texture). Ogni cartella "Hold" conterrà inoltre un file addizionale contenente il collider Convex Hull pre-calcolato per quella presa, generato e gestito dal backend secondo quanto descritto nella sezione "Movimenti e collisioni tra gli oggetti in scena".
Per le prese (sempre nella cartella Hold) sarà disponibile anche un file con prefisso "PREV_" di tipo immagine, questo file deve essere considerato come l'anteprima da visualizzare per la presa.
Tutti i file descritti devono essere considerati come file statici da caricare in locale.


## IMPOSTAZIONE E FUNZIONAMENTO DELL'APPLICAZIONE

L'applicazione dovrà presentare un ambiente 3D in cui le pareti su cui tracciare le vie e le prese da utilizzare per la tracciatura sono modelli 3D.
La versione corrente dell'applicazione deve gestire una sola parete per sessione, quindi un solo modello 3d della parete. La parete deve essere caricata automaticamente all'avvio dell'applicazione utilizzando il modello disponibile nella cartella "main-wall".
L'utente dovrà poter scegliere le prese da utilizzare da un catalogo e gestirle tramite un menu contestuale visualizzato in prossimita della presa selezionata.
Le prese saranno tutte disponibili in un apposito menu che consiste nel catalogo delle prese. Quando l'utente seleziona una presa e la aggiunge alla scena, questa presa verrà rimossa dal catalogo e renderizzata nella scena.
L'utente deve avere la possibilità di rimuovere dalla scena una presa, selezionandola nella scena con il mouse e cliccando su un apposito bottone che la rimuoverà dalla scena riportandola nel catalogo.
L'inclinazione della presa rispetto alla superficie della parete non è modificabile direttamente dall'utente, poiché deve essere determinata automaticamente dalla normale della superficie nel punto di aggancio.
Alla selezione della presa deve comparire un popup contestuale compatto, semitrasparente e ancorato alla sua posizione visibile, con le azioni `Dettagli`, `Aggancia`, `Sgancia`, `Ruota`, `Sposta` e `Rimuovi`. `Dettagli` apre lo stesso viewer 3D ingrandito e interattivo disponibile dal catalogo, riferito alla presa selezionata. Tutte le azioni restano visibili e sono abilitate o disabilitate in funzione dello stato della presa. Il popup deve seguire la presa durante movimento, orbit, zoom, pan e resize; deve essere nascosto durante la modalita di targeting, dopo una deselezione e durante l'esportazione dell'immagine.
Una presa non agganciata abilita `Aggancia` e `Rimuovi`. Una presa agganciata abilita `Sgancia`, `Ruota`, `Sposta` e `Rimuovi`. Le modalita di interazione sono mutuamente esclusive e sono `idle`, `attach-targeting`, `moving` e `rotating`.
Non devono esistere shortcut globali da tastiera per spostare o ruotare le prese. I pulsanti del popup (`Dettagli`, `Aggancia`, `Sgancia`, `Ruota`, `Sposta`, `Rimuovi`) devono comunque essere raggiungibili tramite tastiera con i normali meccanismi di accessibilita del browser (`Tab`, `Enter`, `Space`): si tratta di azioni semantiche, anche quando producono un cambio di stato o un riposizionamento diretto. Sono invece mouse-only le trasformazioni incrementali prodotte dalle frecce di movimento e dal gizmo di rotazione. Il tasto `Escape` annulla la modalita attiva, deseleziona la presa e nasconde il popup; un hint visibile deve comunicare questa possibilita.
L'utente può aggiungere qualsiasi presa una sola volta , e può anche rimuoverle dalla parete.

### Gestione della fisica e del movimento

Per la gestione dei modelli nello spazio tridimensionale, deve essere utilizzato un sistema di coordinate cartesiane destrorso coerente con Three.js.
Tutti i modelli devono essere espressi in metri. 
1 unità di Three.js è uguale a 1 metro.

Il movimento delle prese sulle pareti deve essere regolato tramite le seguenti regole fisiche:
- la gravità deve essere disabilitata
- le prese devono essere considerate corpi rigidi cinematici durante il posizionamento
- la collision detection deve essere continua per le trasformazioni committate incrementalmente tramite click; la preview shadow del drag e il percorso non committato sono esclusi e viene validato soltanto l'endpoint al rilascio
- non deve essere presente nessuna simulazione dinamica
- non deve essere presente nessuna inerzia
- non deve essere presente nessun rimbalzo
- non deve essere previsto nessun attrito
- deve essere prevista solo la rilevazione collisioni
- le prese non possono sovrapporsi oltre le tolleranze nelle pose committate. Il contatto superficiale con la parete e valido. La tolleranza geometrica verso la parete e configurabile da `1` a `10 mm` inclusi, anche decimali, con default `5 mm`; fra prese resta immutabile a `1 mm`. Nei click incrementali, quando movimento o rotazione supererebbero la soglia del relativo contatto, la trasformazione deve fermarsi all'ultima posa valida. Nei drag la shadow puo attraversare visivamente ostacoli perche non e una posa fisica; al rilascio un endpoint invalido annulla integralmente il drag. L'intero modello della parete, indipendentemente da forma, inclinazione, prominenza, curvatura o cavita, e un ostacolo fisico per ogni posa reale committata, entro le tolleranze dichiarate. Il retro non viene distinto semanticamente e il comportamento di aggancio sul retro resta fuori ambito.

I click incrementali delle prese devono essere implementati come movimento cinematico vincolato dalle collisioni: quando la posizione desiderata genera una collisione, il sistema calcola la massima posizione consentita senza compenetrazione. I drag sono invece transazioni editoriali endpoint-only: durante la preview non si applicano collision response o posizioni parziali e, se l'endpoint e invalido, l'intera operazione viene annullata.

Per l'implementazione di questo comportamento devono essere utilizzate le query cinematiche native di Rapier, incluse shape-cast/contact query per validare trasformazioni, rotazioni o posizionamenti diretti. Il KinematicCharacterController resta una fondazione legacy/opzionale, non un passaggio obbligatorio dei click attivi. Autostep e snap-to-ground devono essere disabilitati. La logica custom deve coordinare le query native senza introdurre dinamica, impulsi o risposta fisica non richiesta; restano invariati architettura client-side e separazione mesh/collider.

Per `DEC-028`, `REQ-FIS-004` richiede il prefisso conservativo valido lungo la direzione del click richiesto, entro riproiezione e surface-lock locali: al blocco non devono essere estratte componenti libere per aggirare l'ostacolo, ne introdotto move-and-slide automatico. Vale anche l'arresto conservativo della rotazione incrementale; un intervallo irrisolto non autorizza ulteriore avanzamento. Il drag resta endpoint-only.

La validazione corrente misura la posa originale tramite `collider.contactShape` sull'intero TriMesh, senza spostarla verso l'esterno lungo la normale; i contatti negativi richiedono conferma di intersezione. La broadphase AABB nativa seleziona i candidati con semiestensione `raggio + prediction`; in assenza di una violazione accertata, risposte contraddittorie producono `uncertain` e feedback `path-unresolved`, non collisione accertata. Una violazione confermata prevale sull'incertezza di un altro collider: blocker, handle, penetrazione, tolleranza e `uncertain: false` restano coerenti con il contatto selezionato. `PhysicsWorld` aggrega il minimo per contatto di `distance + tolerance`, non la distanza grezza piu profonda seguita da una soglia unica: parete configurata in metri, altre prese `0.001 m`. L'epsilon numerico separato resta invariato a `2e-6 m`, sia per gli endpoint sia per gli intervalli dei click. Solo le query fra coppie convesse supportate usano copie normalizzate di fattore `100`, con gli stessi vertici dell'hull precalcolato: nessuna generazione hull frontend o modifica degli asset/collider nel mondo. I click combinano shape cast solo a rotazione fissa e da partenza separata fino al primo contatto e suddivisione ricorsiva degli intervalli, confrontando il margine per contatto e il massimo moto dei punti (traslazione piu raggio per angolo); i contatti iniziali sono gestiti dagli intervalli. Gli sweep restano conservativi: da partenza separata si fermano prima di toccare anche il pavimento, senza consumare la tolleranza di penetrazione. Budget `512`, bound minimo `2e-6 m`, arresto conservativo degli intervalli irrisolti.

La configurazione runtime risiede in `source/frontend/public/physics-config.json`, con contenuto iniziale `{"wallPenetrationToleranceMm":5}`: numero JSON senza virgolette, punto per i decimali, nessun commento o altra chiave. Il frontend legge il file una sola volta al bootstrap con `cache: 'no-store'`. File invalido o indisponibile impedisce l'avvio, senza default silenzioso; l'errore e gestito e mostrato nella pagina, senza `pageerror` non gestiti. Per applicare una modifica serve il reload della pagina, non il riavvio backend. In sviluppo Vite serve direttamente `public`: nessun riavvio frontend o compilazione; puo pero ricaricare automaticamente la pagina appena si modifica il file. Esportare quindi prima di modificare: il reload perde la sessione e il JPG e solo un riferimento visivo, non un salvataggio riapribile della tracciatura. In produzione occorre prima installare/compilare e distribuire la versione con questa funzionalita; in seguito modificare il `dist/physics-config.json` effettivamente distribuito e ricaricare non richiede rebuild o riavvio di un server statico. Modificare soltanto il sorgente `public` richiede invece rebuild o copia nel deploy; il build successivo sovrascrive `dist`, quindi mantenere il valore permanente nel sorgente. Configurare anche server/proxy/cache per rispettare `no-store` su questo file. Procedura e debug in `docs/applicazione.md`.

Eccezione di release approvata in `DEC-029`: v0.0.1 mantiene Rapier `0.12.0` e i suoi limiti noti, descritti in [06-stato-versione-v0.0.1.md](sdd-specs/06-stato-versione-v0.0.1.md). I controlli di collisione sull'intero hull e le soglie sopra restano obbligatori per le pose committate; non costituiscono una garanzia universale di impenetrabilita o agganciabilita su geometrie arbitrarie. L'accettazione non implica una soluzione generale implementata, un upgrade del motore o una correzione degli asset.

## GESTIONE PRESE E PARETI

### Catalogo prese ed istanze

Il catalogo delle prese è l'elenco delle prese disponibili per la tracciatura, e deve essere previsto e renderizzato nella parte sinistra dell'interfaccia grafica dell'applicazione.
Il catalogo deve caricare, all'avvio dell'applicazione, l'elenco di tutte le prese disponibili dalle cartelle presenti sul server, insieme alla relativa immagine di anteprima (file "PREV_"). Questi dati, leggeri rispetto al modello 3D completo, devono essere mantenuti in cache lato frontend per l'intera sessione, in modo da effettuare il caricamento dell'elenco e delle anteprime una sola volta. Il modello 3D completo (GLB) di una presa deve invece essere caricato solo nel momento in cui viene effettivamente utilizzato: quando l'utente clicca "Utilizza" per aggiungerla alla scena, oppure quando apre il pannello "Dettagli" per visualizzarla, coerentemente con quanto già descritto per tale pannello.
La readiness dei collider e separata dai metadati statici e dalle preview immutabili in cache. `GET /api/holds/status` restituisce solo `id`, `colliderStatus` e `colliderUrl` (`null` salvo `Ready`), con `no-store`. Il watcher `SessionCatalog.watchReadiness` interroga serialmente questo endpoint dopo `1 s` e poi a intervalli di `1 s` dalla conclusione della richiesta, solo finche esistono prese `Pending`/`Missing`; aggiorna soltanto tali prese e si arresta quando sono tutte `Ready`/`Failed` oppure alla distruzione della sessione. Errori transitori mantengono l'ultimo stato e attivano retry con backoff esponenziale fino a `30 s`, azzerato al successo; timeout della richiesta `10 s`, abort e cancellazione timer su dispose. Non ricarica manifest, preview o GLB, non aggiunge nuovi modelli alla sessione e non dipende da frame o movimento mouse. Dopo la discovery iniziale, un ID mai accodato nel job store e `Failed`, anche se la directory torna leggibile o contiene un collider non verificato; il worker elabora il backlog iniziale, non esegue hot reload.
I modelli delle prese presenti nel catalogo devono essere mantenuti separati dalle istanze utilizzate nella scena 3D. Il catalogo rappresenta esclusivamente l'insieme dei modelli disponibili, mentre ogni presa posizionata sulla parete deve essere rappresentata come un'istanza indipendente che mantiene un riferimento al modello originale e memorizza esclusivamente il proprio stato nella scena (posizione, orientamento e altri attributi necessari al posizionamento). L'architettura deve mantenere questa separazione anche se, nella versione corrente dell'applicazione, ogni modello può essere utilizzato una sola volta.
Il catalogo dovrà mostrare un box per ciascuna presa, in ciascun box dovranno essere presenti i seguenti elementi:
- Visualizzazione dell'immagine di anteprima della presa (file di tipo immagine con prefisso "PREV_" presente nella cartella della presa stessa)
- Bottone "Utilizza" per utilizzare il modello della presa nella scena
- Bottone "Dettagli", al click di questo bottone dovrà essere visualizzato in un pannello modale il modello 3D della presa selezionata caricato sul momento dalla cartella della presa stessa in modo che l'utente possa visualizzarne i dettagli in 3D. Alla chiusura del pannello modale deve essere liberato anche il modello per non occupare contesto.


### Movimenti e collisioni tra gli oggetti in scena

L'utente potrà selezionare le prese da muovere o rimuovere dalla scena tramite il click del mouse sulla presa stessa in scena.
Tutti i modelli delle prese devono avere l'origine del sistema di coordinate locale posizionata nel centro geometrico della superficie posteriore della presa, cioè nel punto di contatto con la parete.

L'aggancio deve essere richiesto esplicitamente dall'utente tramite il popup contestuale e il targeting descritto di seguito. La presa deve orientarsi automaticamente seguendo la normale stabilizzata della superficie scelta, mantenendo la base aderente alla parete. Dopo l'aggancio l'utente deve poter ruotare la presa attorno alla normale di aggancio e spostarla tramite click sulla stessa superficie locale entro la tolleranza angolare prevista, oppure tramite drag globale endpoint-only.
La normale utilizzata per l'orientamento deve essere calcolata nella zona di contatto scelta dall'utente.
Come base della presa deve essere considerata la parte piatta di fondo della presa stessa, ogni presa è composta da una parte piatta che aderisce alla parete ed una parte variabile di qualsiasi forma che consiste nella parte utilizzata dall'arrampicatore durante l'arrampicata.

### Aggancio contestuale tramite targeting

Dalla fase 9UX lo snap automatico per avvicinamento e i comandi avanti/indietro sono sostituiti dall'azione esplicita `Aggancia`. Premendo `Aggancia`, l'applicazione entra nella modalita `attach-targeting`: il popup viene nascosto, il puntatore sinistro e riservato alla selezione del target, mentre rotazione/pan tramite tasto destro e zoom tramite rotella restano disponibili. Il posizionamento e diretto: non deve essere simulato ne validato il percorso fra la posizione detached e il target, ma devono essere validate integralmente la posa finale e le collisioni.

Muovendo il mouse sulla parete deve comparire una shadow 3D trasparente della presa selezionata, creata a runtime dalla stessa istanza grafica e senza file aggiuntivi. La shadow deve avere il pivot sul punto colpito, allineare la propria base alla normale locale e mostrare quindi posizione, prospettiva e inclinazione effettive rispetto alla camera. Il footprint della base continua a definire internamente l'area dei 37 campioni, ma non viene piu visualizzato come cerchio o ellisse. La shadow e gialla durante il targeting ordinario, diventa rossa dopo un tentativo invalido e non deve comparire nell'immagine esportata.

Al click, il footprint invisibile viene campionato mediante 37 raggi deterministici dalla camera verso la parete. Tutti i triangoli del modello sono candidabili, indipendentemente da inclinazione, forma, curvatura, prominenza o cavita. Gli hit sono raggruppati per prossimita, continuita locale e compatibilita delle normali. Se il campione centrale colpisce una superficie valida, vince il gruppo che lo contiene affinche shadow visibile e posa committata descrivano la stessa patch; se il centro cade in un foro, vince il gruppo con il maggior numero di campioni validi. Non e richiesta una percentuale minima di copertura. I tie-break successivi sono distanza dalla camera e identificatore stabile piu basso.

Il punto candidato appartiene al gruppo dominante ed e scelto in modo deterministico vicino al centro del footprint. La normale e stabilizzata sui campioni del gruppo localmente compatibili con la normale del punto candidato e deve restare entro 5 gradi da quest'ultima: punto e normale descrivono quindi la stessa patch locale anche quando la chiusura transitiva attraversa un raccordo. L'asse locale `+Z` della presa rappresenta la direzione uscente dalla base e deve essere allineato alla normale candidata; il twist corrente deve essere conservato. Targeting, click incrementale e drag applicano la stessa politica di orientamento e fallback delle normali.

Tutta la geometria della parete e candidabile all'aggancio, ma la posa e accettata soltanto se l'intero Convex Hull della presa supera la validazione contro parete e altre prese. Il contatto superficiale e valido; valgono le soglie separate parete `1..10 mm` (default `5 mm`) e prese `1 mm`, con epsilon e limiti implementativi descritti in "Gestione della fisica e del movimento". Se la posa e invalida, la shadow diventa rossa e l'aggancio viene annullato senza spostare la presa; la modalita resta attiva e al successivo movimento del mouse la shadow torna gialla. `Escape` annulla la modalita senza modificare la presa.

### Sgancio contestuale

`Sgancia` e disponibile soltanto per una presa agganciata. Il sistema ripristina l'orientamento detached iniziale e cerca una posa lungo la normale uscente del punto di aggancio, iniziando a 0,50 m dalla parete. Se la posa non e valida, deve arretrare di ulteriori 0,10 m e ripetere la verifica fino a 10 m. Se nessuna posa valida e disponibile entro tale dominio, la presa resta agganciata e viene mostrato un messaggio non tecnico. Non deve essere usata come fallback la posizione iniziale di aggiunta alla scena.

### Rotazione contestuale

`Ruota` e disponibile soltanto per una presa agganciata. Attivandolo vengono mostrate due frecce circolari DOM/SVG compatte e semitrasparenti attorno al bounding box proiettato della presa. Un click senza drag produce una rotazione di 1 grado nel verso indicato. Un drag avvia invece una transazione di preview: la presa reale e il collider restano invariati, viene creato a runtime un clone grafico 3D trasparente della presa e viene mostrato un arco/linea gialla con l'angolo richiesto. Il clone condivide geometrie e texture gia caricate e usa soltanto materiali preview dedicati; non richiede PNG, GLB o altri file aggiuntivi. Durante il drag non vengono eseguite collision query: la shadow viene ruotata attorno alla normale corrente e mostra il target richiesto. Al rilascio viene validata esclusivamente la posa endpoint. Se valida, la posa viene applicata atomicamente alla presa reale; se invalida, l'intera operazione viene annullata e la presa reale resta nella posa iniziale. La modalita resta attiva fino a `Escape`; durante il drag il pointer e catturato e la camera e completamente congelata.

### Movimento contestuale

`Sposta` e disponibile soltanto per una presa agganciata. Attivandolo vengono mostrate quattro frecce DOM/SVG ai bordi del bounding box proiettato della presa. Le frecce rappresentano alto, basso, destra e sinistra rispetto alla vista corrente. Un click senza drag muove di 1 cm; piu click singoli applicano piu passi indipendenti.

Un drag iniziato da una freccia avvia una transazione di preview vincolata alla relativa direzione: la componente del pointer perpendicolare alla freccia viene ignorata. In modalita `Sposta` il drag puo inoltre iniziare direttamente sulla presa selezionata; in questo caso il movimento e libero nelle due dimensioni dello schermo e segue il puntatore. In entrambi i casi la presa reale e il collider restano invariati, viene creato a runtime un clone grafico 3D trasparente della presa e viene mostrata una freccia/linea gialla retta fra il punto iniziale e il target richiesto dal mouse. Il clone condivide geometrie e texture gia caricate e usa soltanto materiali preview dedicati; non richiede PNG, GLB o altri asset.

Durante il drag la shadow viene mantenuta aderente alla prima superficie visibile sotto il contact point richiesto. Nel drag libero il contact point coincide esattamente con il puntatore; nel drag dalle frecce il target resta vincolato all'asse screen-space scelto. Il raycast considera l'intero modello, senza lock al pannello iniziale e senza limite di 5 gradi: la shadow puo passare fra pannelli e adatta posizione e orientamento alla nuova normale trasportando il twist con la rotazione minima. Il percorso intermedio non viene validato e non vengono eseguite collision query durante `pointermove`; al rilascio viene validata soltanto la posa endpoint.

Al rilascio viene validata esclusivamente la posa endpoint mostrata dalla shadow. Se valida, la posa e l'inclinazione candidate vengono applicate atomicamente alla presa reale. Se invalida, l'intera operazione viene annullata: non viene applicata alcuna posizione parziale e la presa reale resta nella posa iniziale. Il percorso fra origine ed endpoint non viene validato e puo attraversare ostacoli, per scelta editoriale esplicita. Non esistono movimenti avanti/indietro.

I click singoli da 1 cm restano locali alla superficie di aggancio e si fermano oltre 5 gradi, oltre il gap di riproiezione di `5 mm` o alla prima collisione. Soglia angolare e gap restano invariati e indipendenti dalla tolleranza parete configurabile. Il drag e invece un riposizionamento editoriale globale: puo attraversare un diedro e cambiare pannello, perche soltanto l'endpoint finale viene validato. La modalita resta attiva fino a `Escape`.

Durante qualsiasi drag di movimento o rotazione OrbitControls, zoom e pan devono essere completamente disabilitati. `pointercancel`, `lostpointercapture`, blur, cambio selezione, rimozione ed `Escape` annullano la transazione senza commit. La shadow e gli indicatori non devono essere selezionabili e devono essere esclusi dall'immagine esportata.

Per entrambi i drag, al rilascio si esegue esattamente una query applicativa di validazione collisionale dell'endpoint (`validatePose`) soltanto se il candidato e cambiato ed e disponibile. `no-change`, assenza di hit/superficie, sessione non disponibile o annullamento non eseguono tale query e non committano. La singola validazione puo interrogare piu collider tramite query native interne; non significa una sola chiamata Rapier complessiva.

Ogni oggetto fisico reale presente nella scena (parete o istanza di presa, non preview e overlay) deve essere composto da due elementi distinti:
- una mesh grafica utilizzata esclusivamente per il rendering tramite Three.js
- un collider fisico utilizzato esclusivamente dal motore Rapier per il calcolo delle collisioni

La mesh grafica non deve essere utilizzata per il calcolo della fisica. Tutte le collisioni devono essere gestite esclusivamente tramite i collider dedicati.
Le shadow sono rappresentazioni esclusivamente visuali, prive di collider e rigid body; non sono ulteriori oggetti fisici e non violano questa separazione.

Per ogni modello 3D delle prese, deve essere generato automaticamente un collider Convex Hull da utilizzare esclusivamente per la simulazione fisica. Il collider deve essere indipendente dalla mesh grafica e deve essere utilizzato per il rilevamento delle collisioni tra prese e parete e le collisioni tra le prese stesse.
Il collider Convex Hull deve essere utilizzato esclusivamente per la simulazione fisica lato client. Poiché il catalogo delle prese è da considerarsi statico durante l'utilizzo dell'applicazione (le prese non cambiano durante una sessione di lavoro, e nuove prese vengono aggiunte solo tramite l'inserimento di nuove cartelle "Hold" lato server), la generazione del collider deve avvenire lato backend, non lato client.

All'avvio dell'applicazione, il backend deve analizzare tutte le cartelle presenti in "holds" e, per ciascun modello per cui non esiste ancora un collider pre-calcolato, generare l'inviluppo convesso a partire dai vertici della mesh GLB, salvando il risultato (vertici e indici obbligatori delle facce triangolari dell'hull) in un file dedicato all'interno della stessa cartella del modello. Questa generazione deve avvenire tramite una libreria di calcolo geometrico .NET indipendente da Rapier (ad esempio MIConvexHull o libreria equivalente), poiché è un'operazione di sola geometria statica e non richiede l'esecuzione del motore fisico. Il backend non deve quindi avere alcuna dipendenza da Rapier per questa funzionalità, coerentemente con quanto stabilito riguardo l'esecuzione di Rapier esclusivamente lato client.

`DEC-028` rende obbligatori `sourceHash`, `vertices` e `indices` in `REQ-HUL-003`, coerentemente con `ColliderDocument` backend e `HoldColliderDocument` frontend consumato da `convexMesh`. Schema e validazioni sono descritti nel design §5. Non sono necessari migrazione o supporto retrocompatibile per collider senza indici; nessun fallback genera hull nel browser. La normale rigenerazione backend di un collider non valido non e una migrazione di contratto.

Agli avvii successivi, se il file del collider è già presente e risulta coerente con il modello GLB sorgente (verificato tramite un hash o timestamp del file GLB salvato all'interno del file del collider stesso), il backend deve riutilizzare il collider già calcolato senza rigenerarlo. Se il modello GLB risulta modificato rispetto all'ultima generazione, il collider deve essere ricalcolato automaticamente.

La generazione dei collider mancanti non deve bloccare la disponibilità dell'applicazione: deve essere eseguita in modo asincrono rispetto all'avvio del backend, rendendo disponibili nel catalogo le prese man mano che il rispettivo collider è pronto.

Il frontend, al caricamento di ciascun modello di presa, deve richiedere ed utilizzare il collider pre-calcolato così come fornito dal backend, senza eseguire alcun calcolo di generazione dell'hull lato client.

Il sistema deve mantenere separati collider e mesh grafica, e la scelta del Convex Hull deve privilegiare il rapporto tra accuratezza delle collisioni e prestazioni. Non è richiesto che il collider rappresenti ogni dettaglio geometrico della mesh.

La parete invece deve utilizzare un collider TriMesh derivato direttamente dalla geometria del modello 3D così com'è, senza necessità di precalcolo lato server: trattandosi di un utilizzo diretto dei vertici e triangoli della mesh (senza alcuna riduzione a inviluppo convesso), tale collider può continuare ad essere generato lato client al momento del caricamento della parete.
Il collider TriMesh della parete deve essere utilizzato esclusivamente come corpo statico e non deve partecipare a simulazioni dinamiche.


## STRUTTURA UI APPLICAZIONE

La UI dell'applicazione deve essere semplice e moderna.
Il pannello "Catalogo prese", posizionato sulla sinistra dello schermo, deve mostrare l'elenco delle prese disponibili una sotto l'altra, con i contenuti e i comandi già descritti nella sezione "Catalogo prese ed istanze".
Tutto il resto dello spazio disponibile nella UI deve essere utilizzato per visualizzare il modello 3D della parete su cui tracciare e muovere le prese.
Nel menu superiore deve essere presente il bottone `Genera immagine`. L'azione `Rimuovi` appartiene esclusivamente al popup contestuale della presa selezionata e rimuove mesh, collider e istanza, riportando la presa nel catalogo.

### Gestione della camera
La navigazione della scena deve essere implementata tramite OrbitControls di Three.js. L'utente deve poter ruotare liberamente attorno alla parete, effettuare lo zoom ed eseguire il pan della scena mantenendo sempre la parete come punto centrale dell'osservazione.

## SALVATAGGIO E STAMPA GUIDA PER IL TRACCIATORE

Al momento non deve essere presente nessun sistema di salvataggio delle tracciature realizzate dall'utente, ogni sessione di lavoro o di tracciatura dell'utente non deve al momento essere persistita o storicizzata.
L'applicazione deve mettere a disposizione un pulsante "Genera immagine". Alla pressione del pulsante deve essere esportata la vista corrente della scena cosi come inquadrata dall'utente.
L'esportazione deve mantenere posizione, orientamento, zoom, proiezione prospettica e proporzioni della camera interattiva corrente. Non deve essere utilizzata una camera ortografica dedicata.
L'immagine deve contenere esclusivamente la scena 3D, senza catalogo, menu, controlli o altri elementi dell'interfaccia. Lo sfondo deve corrispondere a quello visualizzato nella viewport.
L'immagine deve essere esportata ad alta risoluzione in formato JPG. Lo scopo della tavola è fornire al tracciatore una rappresentazione chiara della disposizione delle prese da utilizzare come riferimento durante la realizzazione fisica della via.

## PRESTAZIONI DELL'APPLICAZIONE

L'applicazione deve essere progettata per funzionare su normali PC desktop e notebook domestici dotati di GPU integrata compatibile con WebGL 2.0, senza richiedere GPU dedicate o hardware professionale.
L'applicazione deve garantire:
- gestione contemporanea di almeno 40 prese 3D oltre alla parete
- tempo di risposta alle operazioni di selezione, spostamento e rotazione percepito come immediato
- mantenimento di una frequenza di rendering indicativamente pari ad almeno 30 FPS durante l'interazione e, quando possibile, prossima ai 60 FPS su hardware più performante
- assenza di blocchi dell'interfaccia durante il caricamento o il posizionamento delle prese

Per v0.0.1 le limitazioni delle misure e della copertura prestazionale sono eccezioni di release accettate, non garanzie generalizzate a ogni hardware o asset: [06-stato-versione-v0.0.1.md](sdd-specs/06-stato-versione-v0.0.1.md).

## TEST AUTOMATICI

L'applicazione deve includere una suite completa di test automatici eseguibili ad ogni compilazione o pipeline di integrazione continua.
La pipeline di build deve essere considerata fallita se uno qualsiasi dei test automatici fallisce.
I test di release riguardano il target ufficiale Chrome; le esecuzioni esplorative Edge/Firefox conservano il proprio esito ma non bloccano la release. Le attenzioni di copertura accettate per v0.0.1 sono in [06-stato-versione-v0.0.1.md](sdd-specs/06-stato-versione-v0.0.1.md): la chiusura non converte test falliti o non eseguiti in test superati.

Devono essere realizzati:

- test unitari del backend (servizi, controller, logica di caricamento del catalogo, logging) tramite xUnit
- test unitari della generazione e dell'invalidazione dei collider Convex Hull lato backend, verificando che un collider mancante venga generato correttamente, che un collider già presente e coerente con il modello GLB sorgente non venga rigenerato inutilmente, e che una modifica del file GLB sorgente determini la rigenerazione del collider
- test di integrazione delle API REST con verifica delle richieste HTTP e dei dati restituiti
- test end-to-end dell'interfaccia utente tramite Playwright, verificando le principali funzionalità dell'applicazione
- test automatici delle regole fisiche, realizzati in ambiente JavaScript/Node (ad esempio con Vitest o Jest) utilizzando Rapier in modalità headless senza rendering, poiché la simulazione fisica è interamente lato frontend. Questi test devono validare che:
  - una presa non possa attraversare la parete
  - due prese non possano compenetrarsi
  - una presa possa essere posizionata correttamente quando non esistono collisioni
  - la rimozione di una presa liberi correttamente lo spazio occupato
  - il comportamento delle collisioni rimanga invariato dopo ogni modifica al codice

Tutti i test devono poter essere eseguiti automaticamente senza intervento manuale.
I test relativi alla fisica devono essere deterministici e non dipendere dal frame rate o dalla temporizzazione reale del browser.

## DOCUMENTAZIONE

Tutta l'applicazione deve essere completamente documentata, la documentazione deve essere implementata in due modi:
- il codice scritto sia lato frontend che lato backend deve essere interamente documentato, la documentazione deve essere scritta in lingua italiana e deve essere riportata in tutti i metodi e tutte le classi in modo che sia più semplice per un programmatore leggere ed interpretare il codice scritto
- deve essere realizzato un documento markdown di documentazione completa dell'intera applicazione, questo documento deve spiegare tutta l'applicazione nel dettaglio, il suo funzionamento e la sua logica, inoltre deve descrivere tutta la struttura software dettagliando ogni componente applicativo. In questa documentazione deve essere riportato anche come avviare ed eseguire l'applicazione sia live che in debug.
Sempre come documentazione devono essere realizzati i seguenti diagrammi in modo che sia chiaro comprendere ogni aspetto dell'applicazione:
- diagramma architetturale
- diagramma delle cartelle dei sorgenti
- diagramma delle API
- diagramma del ciclo di vita delle prese
- diagramma del flusso della UI
- diagramma della gestione dei compiti tra backend e frontend

Deve essere inoltre generato un file di documentazione che spieghi i test automatici implementati, i loro scopi, i loro risultati attesi, e descriva a grandi linee i framework e gli strumenti utilizzati per realizzarli.

Ad esclusione della documentazione all'interno del codice, tutta la documentazione richiesta deve essere generata e salvata in un'apposita cartella.

La guida italiana [backend-contracts.md](docs/backend-contracts.md) documenta i contratti backend. I gate documentali e di tracciabilita verificano la struttura, non certificano da soli la completezza semantica.

## GESTIONE DEGLI ERRORI

L'applicazione deve implementare una gestione centralizzata degli errori sia lato backend che lato frontend.

Tutti gli errori che si verificano durante l'esecuzione dell'applicazione devono essere intercettati e registrati nel sistema di logging lato server quando tecnicamente possibile.

### Errori lato backend

Il backend deve utilizzare un meccanismo centralizzato di gestione delle eccezioni, in modo che le eccezioni non gestite non vengano restituite direttamente al client e non vengano mai esposti all'utente dettagli tecnici relativi all'implementazione interna dell'applicazione.

Per ogni errore deve essere:

- intercettata l'eccezione;
- generato un identificativo univoco dell'errore;
- registrato nel log server-side il dettaglio completo dell'errore;
- restituita al frontend una risposta HTTP coerente con la natura dell'errore;
- restituito all'utente esclusivamente un messaggio comprensibile e non contenente informazioni tecniche o sensibili.

Il messaggio restituito all'utente non deve contenere stack trace, percorsi dei file, informazioni sulle eccezioni, dettagli dell'implementazione, configurazioni del server o altre informazioni utili a comprendere la struttura interna dell'applicazione.

L'identificativo univoco dell'errore deve essere restituito al frontend quando appropriato, in modo da consentire all'utente o al supporto tecnico di associare il messaggio visualizzato all'evento corrispondente presente nel log server-side.

Il contratto JSON applicativo uniforme e `{ errorId, requestId, message }`, con status HTTP coerente e `X-Request-Id`. Nel codice corrente `ApiErrors`, filtro MVC, status-code pages e middleware lo applicano a binding/validazione, risorse o route mancanti, metodi/media type non supportati, richieste troppo grandi ed eccezioni propagate. HTTP `416` usa lo stesso contratto e ErrorId nei log, conservando `Content-Range`; HTTP `206` resta binario. Il logging di completamento richiesta usa il logger Serilog dell'host via DI. Una risposta gia iniziata non e riscrivibile e viene interrotta dopo logging; la cancellazione client non diventa un errore interno. Errori di proxy/trasporto prima della pipeline non possono essere ricondotti universalmente a questo schema.

### Errori lato frontend

Gli errori che si verificano durante l'esecuzione del frontend devono essere intercettati e, quando tecnicamente possibile, notificati al backend per essere registrati nel sistema di logging server-side.

Devono essere gestiti almeno:

- errori JavaScript non gestiti;
- errori durante le chiamate REST;
- errori HTTP restituiti dal backend;
- errori durante il caricamento dei modelli 3D;
- errori durante il parsing o l'elaborazione dei modelli;
- errori relativi a Three.js;
- errori relativi a Rapier;
- errori durante la generazione dell'immagine;
- errori relativi alle funzionalità principali dell'interfaccia.

Il frontend deve evitare di interrompere l'intera applicazione a causa di un errore relativo ad una singola operazione quando sia possibile continuare l'esecuzione in uno stato coerente.

`AppError`/`toAppError`, `api/http.ts` ed `ErrorReporter` centralizzano messaggi sicuri, correlazione validata e segnalazioni: nessun testo remoto, stack, URL o payload grezzo deve essere mostrato come messaggio pubblico o inoltrato automaticamente. Listener globali `error`/`unhandledrejection` e boundary dei callback devono contenere i guasti senza ricorsione del reporter; non sopprimono la diagnostica nativa del browser. Le limitazioni di copertura e classificazione di `REQ-ERR-004` sono accettate per v0.0.1 in [06-stato-versione-v0.0.1.md](sdd-specs/06-stato-versione-v0.0.1.md), senza promettere intercettazione universale.

Il reporter usa solo memoria volatile: coda massima `20` eventi, cache deduplica massima `100` chiavi per `30 s`, un invio seriale con throttle `1 s`, massimo `3` tentativi totali per evento, retry esponenziale con tetto `8 s` e timeout per invio `5 s`. Retry su rete/timeout, HTTP `408`, `429` e `5xx`; altri rifiuti non sono ritentati. Overflow e tentativi esauriti scartano l'evento; dispose cancella listener, timer, richiesta e code. Il fallimento di `POST /api/logs` non genera nuovi log. Non e una garanzia di consegna e gli esiti fisici attesi (blocco/target invalido) restano feedback locali, non errori da inviare per frame.

## LOGGING E TROUBLESHOOTING

L'applicazione deve implementare un sistema di logging centralizzato completamente lato server, finalizzato al debug, al troubleshooting e all'analisi degli errori durante l'utilizzo dell'applicazione.

Il sistema di logging non deve introdurre un impatto significativo sulle prestazioni dell'applicazione. Il logging deve pertanto essere progettato in modo asincrono e deve evitare operazioni di I/O sincrone durante le normali operazioni dell'applicazione.

Il logging non deve bloccare il thread principale del backend durante le normali operazioni dell'applicazione.

Il frontend non deve effettuare chiamate REST al server per ogni frame, movimento del mouse o aggiornamento continuo della scena.

In caso di elevato volume di eventi, il sistema deve privilegiare la continuità del funzionamento dell'applicazione rispetto alla registrazione di eventi di log non essenziali.

### Principi generali

Tutti i log applicativi devono essere prodotti e conservati lato server.

Il frontend non deve mantenere un sistema di log persistente locale e non deve scrivere direttamente su file di log del client.

Il frontend deve comunicare al backend esclusivamente gli eventi applicativi che siano necessari per il troubleshooting e che non possano essere rilevati direttamente dal server.

I log non devono mai contenere dati sensibili (es. credenziali, token, dati personali) o informazioni riservate; ogni evento deve essere sanitizzato prima della registrazione, rimuovendo o mascherando tali informazioni quando presenti nei dati di contesto.

Il sistema deve utilizzare un logging strutturato, preferibilmente in formato JSON, in modo che ogni evento possa essere facilmente ricercato, filtrato e analizzato.

Ogni evento di log deve contenere, quando disponibili, almeno:

- timestamp;
- livello di severità, espresso secondo i livelli standard di logging di .NET (`LogLevel`): Trace, Debug, Information, Warning, Error, Critical;
- categoria dell'evento;
- messaggio;
- identificativo della richiesta HTTP quando l'evento è associato ad una richiesta;
- identificativo dell'errore quando l'evento rappresenta un errore;
- componente applicativo che ha generato l'evento;
- informazioni contestuali necessarie al troubleshooting.

Deve essere prevista una configurazione lato server per indicare il livello minimo di severità da loggare (default `Information`), sfruttando il meccanismo di filtraggio nativo di .NET tramite `appsettings.json`, in modo da non sovraccaricare il log di messaggi inutilmente.

Deve essere prevista una rotazione dei log in modo da non sovraccaricare il server con file di log, deve essere mantenuto un log per giornata, ed eliminati i file più vecchi di 7 giorni dalla data di salvataggio del nuovo file.

`POST /api/logs` richiede `level`, `category`, `component`, `message`; limiti, contesto opzionale e ricevuta `202` sono definiti nel design §10. I livelli evento sono `Trace..Critical` (`None` vietato); filtro configurabile .NET con default `Information` e override di categoria a prefisso piu lungo, output JSON `Trace`/`Critical` anziche `Verbose`/`Fatal`. La coda backend bounded (default `2048`) scarta gli eventi in eccesso senza attesa di I/O; la ricevuta non certifica persistenza. La retention usa eta effettiva `LastWriteTimeUtc`, non numero di file, e solo il pattern rolling configurato: controllo all'avvio del consumer e al primo ciclo dopo il cambio data UTC, con timer idle di un minuto. Sanitizzazione ricorsiva e limiti riducono l'esposizione, ma non garantiscono il riconoscimento di qualsiasi dato personale non etichettato: i chiamanti devono inviare solo sintesi diagnostiche. Le eccezioni di release per logging e diagnostica sono accettate in [06-stato-versione-v0.0.1.md](sdd-specs/06-stato-versione-v0.0.1.md), senza eliminare gli obblighi di sanitizzazione.
