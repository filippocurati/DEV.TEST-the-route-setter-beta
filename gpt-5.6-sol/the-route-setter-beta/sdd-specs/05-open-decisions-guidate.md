# Open decisions guidate

In V3 i punti OPEN sono ridotti al minimo e non devono alterare il comportamento richiesto.

## DEC-001 - Shortcut tastiera trasformazioni

Stato: CHIUSA dalla fase 9UX.

Decisione:
- rimuovere tutte le shortcut globali per movimento e rotazione hold;
- mantenere `Escape` per annullare targeting e terminare le modalita;
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

Stato: CHIUSA.

Decisione:
- la hold segue piccole variazioni curve;
- confronto sempre con la normale memorizzata all'aggancio;
- tolleranza iniziale 5 gradi;
- oltre soglia il movimento si arresta, senza transizione automatica;
- per cambiare superficie servono `Sgancia` e nuovo `Aggancia`.

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
- surface lock a 5 gradi rispetto alla normale di aggancio applicato durante la costruzione geometrica;
- la shadow si arresta all'ultimo candidato geometricamente ammissibile;
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
- il drag dalla hold e libero in due dimensioni screen-space e conserva l'offset pointer-contact point;
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
