# Open decisions guidate

In V3 i punti OPEN sono ridotti al minimo e non devono alterare il comportamento richiesto.

## DEC-001 - Shortcut tastiera trasformazioni

Stato: CHIUSA dalla fase 9UX.

Decisione:
- rimuovere tutte le shortcut globali per movimento e rotazione hold;
- usare `Escape` per annullare targeting e modalita, deselezionare la hold e nascondere il popup;
- mantenere accessibilita standard dei pulsanti popup con `Tab`, `Enter`, `Space`;
- mantenere mouse-only gli handle che producono trasformazioni.

## OPEN-002 - Estensione endpoint REST

Stato: OPEN GUIDATO.

Vincoli:
- gli endpoint baseline di `02-design-tecnico.md` §4 restano obbligatori;
- endpoint aggiuntivi consentiti solo se necessari;
- nessun endpoint che introduca persistenza tracciature o autenticazione;
- aggiornare OpenAPI e test integrazione.

## OPEN-003 - Aggiornamento versioni package nel tempo

Stato: OPEN GUIDATO (residuo operativo).

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

Decisione:
- durante il drag la hold reale e il collider restano invariati;
- nessuna collision query viene eseguita durante pointermove;
- al pointerup viene validata soltanto la posa endpoint;
- il percorso puo attraversare ostacoli e non viene considerato;
- endpoint valido: commit atomico;
- endpoint invalido: rollback totale, nessun prefisso parziale.

## DEC-014 - Movimento drag aderente

Stato: CHIUSA.

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

Decisione:
- il drag diretto sulla hold e disponibile soltanto dopo aver attivato `Sposta`;
- il click ordinario continua a selezionare la hold;
- il drag dalla hold e libero in due dimensioni screen-space; per `DEC-024` il contact point coincide col puntatore senza conservare l'offset iniziale;
- il drag dalle frecce resta vincolato alla rispettiva direzione;
- click singoli sulle frecce restano micro-spostamenti da 1 cm.

## DEC-018 - Target orientato

Stato: CHIUSA.

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

Stato: perimetro del primo gruppo DEFINITO su richiesta utente; build e verifiche funzionali finali CONFERMATE, follow-up numerico APERTO. Suite prestazionale headless FALLITA, certificazione hardware non disponibile. Non attesta la chiusura di tutti i difetti fisici.

Prevalenza corrente: `DEC-026` sostituisce soltanto la prescrizione di tolleranza geometrica unica `1 mm` riportata sotto. Il resto della decisione, l'epsilon e tutti gli esiti storici restano invariati.

Decisione:
- includere tolleranza/diedri, continuita dei click di traslazione e rotazione, diagnostica locale e regressioni; differire interventi backend/catalogo e gestione globale errori;
- allineare `C19` ai soli click; mantenere drag globale endpoint-only e contact point sotto al puntatore nel drag libero, senza offset iniziale;
- validare la posa originale tramite `collider.contactShape` contro l'intero TriMesh, senza shift uscente; corroborare i contatti negativi con intersezione nativa;
- mantenere tolleranza geometrica `0.001 m` ed epsilon numerico distinto `2e-6 m`; usare normalizzazione di fattore `100` solo nelle query fra coppie convesse supportate, con gli stessi vertici hull e indici precalcolati, senza generazione frontend o modifica della geometria;
- per i click usare shape cast solo a rotazione fissa e da partenza separata, con arresto al primo contatto; contatti iniziali e rotazione sono gestiti dagli intervalli ricorsivi basati su clearance contro massimo moto dei punti (traslazione piu raggio per angolo). Budget `512`, bound minimo `2e-6 m`, prefisso conservativo se irrisolto, non semplice campionamento di endpoint;
- usare la broadphase AABB nativa con semiestensione `raggio + prediction` per le query di posa; esporre `lastActionResult.reason` e `lastPoseDiagnostic.uncertain` nello snapshot read-only, senza sentinelle infinite, log persistenti o rete per frame. Esito incerto -> `path-unresolved` nella UI, non collisione accertata;
- associare `poseValidation.test.ts` e `realWall.test.ts` ai requisiti esistenti: casi sintetici, pavimento/pinna nello stesso collider con contatto iniziale, 40 collider lontani senza narrowphase aggiuntiva, determinismo, query senza mutazioni/rete e asset reali invariati. Esiti finali confermati: 215/215 unitari in 11 file, 31/31 E2E, zero errori pageerror/console/HTTP nella traccia e build frontend superata; backend invariato, 33/33 dalla verifica precedente;
- distinguere il benchmark Node su 40 hold reali (mediane endpoint 1.7-6.3 ms, massimo 8.4 ms; mediane click 24-59 ms, massimo 84 ms) dalla suite prestazionale headless SwiftShader FALLITA: 3 FPS contro target 30, long task massimo 829 ms, heartbeat 748 ms. Rendering software, nessuna evidenza su hardware target; nessuna delle due misure certifica le prestazioni richieste.

Limiti e follow-up:
- Rapier `0.12.0` puo sottostimare la profondita per faccia vicino alle giunzioni interne dei triangoli; la corroborazione di intersezione non corregge necessariamente tale profondita;
- il contenimento completo di una presa in un TriMesh chiuso, senza intersecarne la superficie, non viene rilevato: il TriMesh non fornisce qui un test generale di volume solido;
- il bound del moto e l'arresto conservativo degli intervalli irrisolti non certificano l'accuratezza delle query native su geometrie arbitrarie degeneri, ne risolvono tutti i casi numerici. La regressione pavimento/pinna passa, ma non elimina il limite nativo dei cast da contatto iniziale, gestiti tramite intervalli;
- riprodurre e valutare separatamente gli edge case residui prima di dichiararli risolti. Se occorre un upgrade Rapier o un cambio di rappresentazione fisica, richiedere approvazione utente prima di ampliare il perimetro; per upgrade mantenere PR dedicata, pinning, lockfile, nota compatibilita e suite completa secondo `OPEN-003`;
- non sovrascrivere report storici; il report previsto e `phases-outcome/Physics_diagnostics_group_1_done.md`, da produrre separatamente da questo aggiornamento documentale.

## DEC-026 - Tolleranza parete configurabile e separata dalle prese

Stato: decisione APPROVATA, implementazione e verifiche finali CONFERMATE dall'utente: unitari `331/331` in `12` file, E2E `43/43` superati. Verificata anche la configurazione su build produzione in dist temporanea, modificando il file reale `5 -> 3 -> 5` e ricaricando senza rebuild fra le modifiche. Gli esiti del primo gruppo e delle fasi precedenti non vengono riscritti; il follow-up numerico resta aperto.

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
- proporre all'utente prove a `1 mm` (baseline), `3 mm` (conservativa), `5 mm` (raccomandata), `7.5` e `10 mm` (esplorative). Non aumentare la soglia fra prese o il limite angolare per mascherare difetti.

Evidenze reali verificate e comunicate dall'utente, con asset e collider Hold1/Hold2 invariati:

| Parete mm | Baseline laterale accettata, su 9 pose per hold | Griglia accettata, su 52 pose per hold (Hold1 / Hold2) |
|---|---|---|
| 1 | 3 / 9 ciascuna | 8 / 7 |
| 3 | 7 / 9 ciascuna | 29 / 29 |
| 5 | 9 / 9 ciascuna | 45 / 45 |
| 10 | 9 / 9 ciascuna | 46 / 46 |

Gli scontri profondi parete di circa `120 mm` (Hold1) e `200 mm` (Hold2) restano bloccati a tutte le soglie verificate. Sui target prima rifiutati con profondita circa `4 mm`, passi locali `+/-1 cm` e twist `+/-1 grado` falliscono a `1` e `3 mm`, passano a `5` e `10 mm`. La griglia e una misura comunicata dall'utente, non una dichiarazione di copertura integrale della suite o di ogni superficie; risultati e provenienza in `docs/test-automatici.md`.

Limiti: nessuna garanzia di agganciabilita di tutte le superfici o di compensazione di tutte le imperfezioni di modelli da foto/fotogrammetria. Restano i limiti Rapier e il follow-up di `DEC-025`; nessun upgrade, modifica asset o intervento generale backend implicito. Il report finale e `phases-outcome/Wall_tolerance_configuration_done.md`; backend non modificato, `33/33` resta solo risultato storico. I report storici restano intatti.
