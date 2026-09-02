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
