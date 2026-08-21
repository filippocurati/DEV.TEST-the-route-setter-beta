# APPLICAZIONE PER TRACCIATURE VIE CLIMBING INDOOR

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
- L'applicazione deve essere utilizzabile dagli utenti esclusivamente via browser, gli utenti non devono installare nessun software o nessuna libreria per poterla utilizzare, l'applicazione deve essere compatibile con le ultime versioni stabili di Chrome, Edge e Firefox con supporto WebGL 2.0.

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
L'utente dovrà poter scegliere le prese da utilizzare da un catalogo, e tramite appositi bottoni, spostarle sulle pareti adeguando posizione e rotazione sulla parete.
Le prese saranno tutte disponibili in un apposito menu che consiste nel catalogo delle prese. Quando l'utente seleziona una presa e la aggiunge alla scena, questa presa verrà rimossa dal catalogo e renderizzata nella scena.
L'utente deve avere la possibilità di rimuovere dalla scena una presa, selezionandola nella scena con il mouse e cliccando su un apposito bottone che la rimuoverà dalla scena riportandola nel catalogo.
L'inclinazione della presa rispetto alla superficie della parete non è modificabile dall'utente, poiché deve essere determinata automaticamente dalla normale della superficie nel punto di contatto.
L'utente può invece ruotare liberamente la presa attorno alla normale della superficie della parete. La rotazione deve essere controllabile tramite due appositi pulsanti, uno per la rotazione oraria e uno per la rotazione antioraria, con incremento di 1 grado per ogni click e modalità di rotazione continua quando il pulsante rimane premuto.
Lo spostamento della presa lungo la superficie della parete deve essere controllabile tramite quattro appositi pulsanti direzionali (su, giù, sinistra, destra), che muovono la presa lungo gli assi tangenti alla superficie della parete nel punto di contatto corrente. Ogni click deve produrre uno spostamento di 1 centimetro nella direzione selezionata, con modalità di movimento continuo quando il pulsante rimane premuto, in modo coerente con il comportamento già definito per la rotazione. La direzione "su/giù" e "sinistra/destra" deve essere calcolata proiettando gli assi verticale e orizzontale della vista corrente sul piano tangente alla parete nel punto di contatto, in modo che il movimento risulti sempre intuitivo rispetto a ciò che l'utente vede a schermo, indipendentemente dall'orientamento della parete o della posizione della camera. Anche questi comandi devono essere disponibili tramite shortcut da tastiera, coerenti con quelli già previsti per la rotazione.
Gli stessi comandi disponibili tramite i bottoni devono essere disponibili anche tramite shortcut da tastiera, prevedi tu l'associazione tra gli shortcut migliori ed i bottoni.
L'utente può aggiungere qualsiasi presa una sola volta , e può anche rimuoverle dalla parete.

### Gestione della fisica e del movimento

Per la gestione dei modelli nello spazio tridimensionale, deve essere utilizzato un sistema di coordinate cartesiane destrorso coerente con Three.js.
Tutti i modelli devono essere espressi in metri. 
1 unità di Three.js è uguale a 1 metro.

Il movimento delle prese sulle pareti deve essere regolato tramite le seguenti regole fisiche:
- la gravità deve essere disabilitata
- le prese devono essere considerate corpi rigidi statici durante il posizionamento
- la collision detection deve essere continua
- non deve essere presente nessuna simulazione dinamica
- non deve essere presente nessuna inerzia
- non deve essere presente nessun rimbalzo
- non deve essere previsto nessun attrito
- deve essere prevista solo la rilevazione collisioni
- le prese non possono sovrapporsi, ovvero quando a seguito del movimento di una presa da parte dell'utente, questa entra a contatto con la parete o con altre prese, quella stessa presa non potrà più proseguire il suo movimento nella direzione che porta all'oggetto con cui è entrata in contatto. Una volta agganciata alla parete, la presa può essere traslata esclusivamente lungo la superficie della parete. 

Il movimento delle prese deve essere implementato come movimento cinematico vincolato dalle collisioni. Quando la posizione desiderata genera una collisione, il sistema deve calcolare la massima posizione consentita nella direzione di movimento senza generare compenetrazione, mantenendo disponibili le componenti di movimento nelle direzioni che non generano collisione.

Per l'implementazione di questo comportamento deve essere utilizzato il KinematicCharacterController messo a disposizione nativamente da Rapier, che implementa già la logica di "move and slide" richiesta: blocco della componente di movimento che genererebbe compenetrazione, mantenimento libero delle componenti di movimento che non generano collisione, gestione della tolleranza di contatto tra le superfici. Non deve essere implementata una logica di collision-response custom, salvo che le funzionalità native del controller risultino insufficienti rispetto ai casi descritti in questo documento. Poiché il controller è pensato in origine anche per personaggi soggetti a gravità (con funzionalità come autostep o snap-to-ground), deve essere configurato escludendo tali comportamenti, non pertinenti al caso d'uso descritto in cui non è prevista gravità. Si raccomanda di fare riferimento alla documentazione ufficiale di Rapier.js aggiornata per la sintassi esatta dell'API, che può variare tra le versioni della libreria.

## GESTIONE PRESE E PARETI

### Catalogo prese ed istanze

Il catalogo delle prese è l'elenco delle prese disponibili per la tracciatura, e deve essere previsto e renderizzato nella parte sinistra dell'interfaccia grafica dell'applicazione.
Il catalogo deve caricare, all'avvio dell'applicazione, l'elenco di tutte le prese disponibili dalle cartelle presenti sul server, insieme alla relativa immagine di anteprima (file "PREV_"). Questi dati, leggeri rispetto al modello 3D completo, devono essere mantenuti in cache lato frontend per l'intera sessione, in modo da effettuare il caricamento dell'elenco e delle anteprime una sola volta. Il modello 3D completo (GLB) di una presa deve invece essere caricato solo nel momento in cui viene effettivamente utilizzato: quando l'utente clicca "Utilizza" per aggiungerla alla scena, oppure quando apre il pannello "Dettagli" per visualizzarla, coerentemente con quanto già descritto per tale pannello.
I modelli delle prese presenti nel catalogo devono essere mantenuti separati dalle istanze utilizzate nella scena 3D. Il catalogo rappresenta esclusivamente l'insieme dei modelli disponibili, mentre ogni presa posizionata sulla parete deve essere rappresentata come un'istanza indipendente che mantiene un riferimento al modello originale e memorizza esclusivamente il proprio stato nella scena (posizione, orientamento e altri attributi necessari al posizionamento). L'architettura deve mantenere questa separazione anche se, nella versione corrente dell'applicazione, ogni modello può essere utilizzato una sola volta.
Il catalogo dovrà mostrare un box per ciascuna presa, in ciascun box dovranno essere presenti i seguenti elementi:
- Visualizzazione dell'immagine di anteprima della presa (file di tipo immagine con prefisso "PREV_" presente nella cartella della presa stessa)
- Bottone "Utilizza" per utilizzare il modello della presa nella scena
- Bottone "Dettagli", al click di questo bottone dovrà essere visualizzato in un pannello modale il modello 3D della presa selezionata caricato sul momento dalla cartella della presa stessa in modo che l'utente possa visualizzarne i dettagli in 3D. Alla chiusura del pannello modale deve essere liberato anche il modello per non occupare contesto.


### Movimenti e collisioni tra gli oggetti in scena

L'utente potrà selezionare le prese da muovere o rimuovere dalla scena tramite il click del mouse sulla presa stessa in scena.
Tutti i modelli delle prese devono avere l'origine del sistema di coordinate locale posizionata nel centro geometrico della superficie posteriore della presa, cioè nel punto di contatto con la parete.

Quando una presa viene avvicinata alla parete, il sistema deve agganciarla automaticamente alla superficie della parete utilizzando il punto di contatto più vicino. La distanza di attivazione dello snap di aggancio alla parete deve essere di 5 CM. La presa deve orientarsi automaticamente seguendo la normale della superficie della parete, mantenendo la base perfettamente aderente alla parete. Dopo l'aggancio automatico l'utente deve poter modificare liberamente la rotazione della presa attorno alla normale della parete e la sua posizione lungo la parete stessa.
La normale utilizzata per l'orientamento deve essere calcolata nel punto esatto di contatto della presa con la parete.
Come base della presa deve essere considerata la parte piatta di fondo della presa stessa, ogni presa è composta da una parte piatta che aderisce alla parete ed una parte variabile di qualsiasi forma che consiste nella parte utilizzata dall'arrampicatore durante l'arrampicata.

Ogni oggetto presente nella scena deve essere composto da due elementi distinti:
- una mesh grafica utilizzata esclusivamente per il rendering tramite Three.js
- un collider fisico utilizzato esclusivamente dal motore Rapier per il calcolo delle collisioni

La mesh grafica non deve essere utilizzata per il calcolo della fisica. Tutte le collisioni devono essere gestite esclusivamente tramite i collider dedicati.

Per ogni modello 3D delle prese, deve essere generato automaticamente un collider Convex Hull da utilizzare esclusivamente per la simulazione fisica. Il collider deve essere indipendente dalla mesh grafica e deve essere utilizzato per il rilevamento delle collisioni tra prese e parete e le collisioni tra le prese stesse.
Il collider Convex Hull deve essere utilizzato esclusivamente per la simulazione fisica lato client. Poiché il catalogo delle prese è da considerarsi statico durante l'utilizzo dell'applicazione (le prese non cambiano durante una sessione di lavoro, e nuove prese vengono aggiunte solo tramite l'inserimento di nuove cartelle "Hold" lato server), la generazione del collider deve avvenire lato backend, non lato client.

All'avvio dell'applicazione, il backend deve analizzare tutte le cartelle presenti in "holds" e, per ciascun modello per cui non esiste ancora un collider pre-calcolato, generare l'inviluppo convesso a partire dai vertici della mesh GLB, salvando il risultato (vertici e, se disponibili, indici delle facce dell'hull) in un file dedicato all'interno della stessa cartella del modello. Questa generazione deve avvenire tramite una libreria di calcolo geometrico .NET indipendente da Rapier (ad esempio MIConvexHull o libreria equivalente), poiché è un'operazione di sola geometria statica e non richiede l'esecuzione del motore fisico. Il backend non deve quindi avere alcuna dipendenza da Rapier per questa funzionalità, coerentemente con quanto stabilito riguardo l'esecuzione di Rapier esclusivamente lato client.

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
In un menu generico disposto nella parte superiore dell'interfaccia grafica, devono essere previsti due bottoni:
- bottone "Genera immagine" per creare l'immagine guida per il tracciatore
-  bottone "Rimuovi presa" che rimuove la presa selezionata dalla scena e la riporta nel catalogo.

### Gestione della camera
La navigazione della scena deve essere implementata tramite OrbitControls di Three.js. L'utente deve poter ruotare liberamente attorno alla parete, effettuare lo zoom ed eseguire il pan della scena mantenendo sempre la parete come punto centrale dell'osservazione.

## SALVATAGGIO E STAMPA GUIDA PER IL TRACCIATORE

Al momento non deve essere presente nessun sistema di salvataggio delle tracciature realizzate dall'utente, ogni sessione di lavoro o di tracciatura dell'utente non deve al momento essere persistita o storicizzata.
L'applicazione deve mettere a disposizione un pulsante "Genera immagine". Alla pressione del pulsante deve essere generata automaticamente una vista dedicata esclusivamente alla stampa utilizzando una telecamera ortografica frontale. 
L'interfaccia utente deve essere nascosta e la parete deve essere renderizzata su sfondo bianco mantenendo tutte le proporzioni corrette. 
L'immagine deve essere esportata ad alta risoluzione in formato JPG. Lo scopo della tavola è fornire al tracciatore una rappresentazione chiara della disposizione delle prese da utilizzare come riferimento durante la realizzazione fisica della via.

## PRESTAZIONI DELL'APPLICAZIONE

L'applicazione deve essere progettata per funzionare su normali PC desktop e notebook domestici dotati di GPU integrata compatibile con WebGL 2.0, senza richiedere GPU dedicate o hardware professionale.
L'applicazione deve garantire:
- gestione contemporanea di almeno 40 prese 3D oltre alla parete
- tempo di risposta alle operazioni di selezione, spostamento e rotazione percepito come immediato
- mantenimento di una frequenza di rendering indicativamente pari ad almeno 30 FPS durante l'interazione e, quando possibile, prossima ai 60 FPS su hardware più performante
- assenza di blocchi dell'interfaccia durante il caricamento o il posizionamento delle prese

## TEST AUTOMATICI

L'applicazione deve includere una suite completa di test automatici eseguibili ad ogni compilazione o pipeline di integrazione continua.
La pipeline di build deve essere considerata fallita se uno qualsiasi dei test automatici fallisce.

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
