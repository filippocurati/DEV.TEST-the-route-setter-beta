# Open decisions guidate

In V3 i punti OPEN sono ridotti al minimo e non devono alterare il comportamento richiesto.

## OPEN-001 - Shortcut tastiera

Stato: OPEN GUIDATO.

Vincoli:
- copertura completa dei comandi rotazione/traslazione;
- coerenza e usabilita;
- evitare conflitti con browser/OrbitControls quando possibile;
- mappatura documentata nella documentazione utente.

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

## DEC-004 - Parete continua senza metadati semantici

Stato: CHIUSA.

Decisione:
- la parete e un unico modello geometricamente connesso;
- non sono richiesti proxy, gruppi, materiali convenzionali o metadati GLB aggiuntivi;
- collisioni e supporto derivano dal TriMesh completo;
- il modello operativo non contiene pavimento;
- ogni foro rappresentato e una texture e non un'apertura geometrica.

## DEC-005 - Transizione locale fra superfici

Stato: CHIUSA.

Decisione:
- una hold post-snap puo passare automaticamente fra facce geometricamente contigue con inclinazioni differenti;
- il passaggio avviene soltanto al bordo condiviso o al primo contatto fisico con una superficie contigua, entro tolleranza;
- twist conservato e inclinazione aggiornata sulla nuova normale;
- nessuna transizione anticipata o verso superfici non raggiunte;
- se il Convex Hull non puo attraversare un diedro senza penetrazione, applicare la massima trasformazione valida e arrestare il residuo.

## DEC-006 - Bordo esterno e retro

Stato: CHIUSA.

Decisione:
- quando termina il supporto operativo o non esiste una posa contigua valida, la hold si arresta senza continuare nello spazio libero;
- il retro e fuori dall'operativita prevista e non viene classificato automaticamente;
- se il modello collega geometricamente lato e retro e l'utente forza tale percorso, oppure porta intenzionalmente una hold dietro il modello, transizione, collisioni, snap e compenetrazione non sono garantiti;
- non introdurre una barriera artificiale globale dietro la parete.
