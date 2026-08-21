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
