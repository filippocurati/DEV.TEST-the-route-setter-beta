# Aggiornamento specifiche per FASE 6 e FASE 7

Questo documento descrive cosa deve essere aggiornato nell'implementazione gia esistente di FASE 6 e FASE 7 per allinearsi alle nuove specifiche.

## 1) Contesto delle modifiche

Sono stati introdotti nuovi requisiti e aggiornamenti che impattano il comportamento delle hold in scena:

- `REQ-SCN-005`: spawn iniziale hold in stato pre-snap a `2.0 m` dal centro geometrico della parete.
- `REQ-FIS-015`: comandi avanti/indietro in pre-snap lungo normale locale parete.
- `REQ-FIS-007` aggiornato: in post-snap, avanti non fa nulla; indietro esegue sgancio controllato.
- `REQ-UI-004` aggiornato: shortcut obbligatorie `SHIFT+Freccia Su` (avanti), `SHIFT+Freccia Giu` (indietro).

## 2) Interventi richiesti su FASE 6

La FASE 6 rimane responsabile di catalogo, lazy-load e gestione istanze, ma ora deve includere lo spawn iniziale conforme.

Interventi da fare:

1. Quando l'utente preme `Utilizza`, creare l'istanza in stato `pre-snap`.
2. Calcolare il riferimento frontale della parete in modo deterministico: centro geometrico del bounding box proiettato sul fronte lungo direzione globale `+Z`.
3. Definire il primo candidato di spawn a distanza `2.0 m` dal punto frontale valido, verso l'esterno lungo `+Z`.
4. Se il primo candidato non e valido, eseguire fallback su griglia deterministica nel piano frontale (passo `0.30 m`) mantenendo offset costante `2.0 m` lungo `+Z`.
5. Usare assi locali del piano frontale e ordine candidati stabile per distanza crescente (alto, destra, basso, sinistra, poi diagonali in senso orario a parita di distanza).
6. Limitare la ricerca al bounding frontale della parete esteso da margine configurabile.
7. Validare ogni candidato con Rapier rispetto a parete e hold presenti, selezionando il primo non compenetrante.
8. Annullare inserimento solo dopo esaurimento deterministico di tutti i candidati nel dominio di ricerca.
9. Evitare snap automatico immediato allo spawn.
10. Mantenere invariati i vincoli esistenti di FASE 6 (lazy-load GLB, cache manifest/preview, separazione modello/istanza, unicita uso hold).

Test minimi da aggiungere/aggiornare per FASE 6:

- verifica primo candidato frontale a `2.0 m` dal punto frontale di riferimento in pre-snap;
- verifica assenza compenetrazione allo spawn;
- verifica fallback su griglia con passo `0.30 m` e ordine deterministico candidati;
- verifica spawn multiplo senza compenetrazione;
- verifica annullamento inserimento solo dopo esaurimento candidati nel dominio (bounding frontale + margine);
- verifica assenza snap immediato dopo creazione istanza.

## 3) Interventi richiesti su FASE 7

La FASE 7 mantiene selezione/rimozione/comandi base e deve ora includere i comandi di traslazione lungo normale locale in stato pre-snap.

Interventi da fare:

1. Aggiungere input `SHIFT+Freccia Su` per avanzare la hold lungo normale locale parete (`1 cm/click` + pressione continua).
2. Aggiungere input `SHIFT+Freccia Giu` per arretrare la hold lungo normale locale parete (`1 cm/click` + pressione continua).
3. Applicare anti-collisione/anti-compenetrazione anche durante avanti/indietro.
4. Mantenere invariati i controlli gia presenti di FASE 7 (rotazione, traslazione tangenziale, selezione, rimozione, equivalenza input).

Test minimi da aggiungere/aggiornare per FASE 7:

- input test click + pressione continua per `SHIFT+Freccia Su/Giu` in pre-snap;
- test blocco compenetrazione durante avanti/indietro;
- test coerenza shortcut/documentazione UI.

## 4) Nota di coordinamento con FASE 8

Le modifiche introdotte su FASE 6/7 richiedono continuita in FASE 8 (snap e post-snap):

- in `post-snap`, comando avanti = no-op;
- in `post-snap`, comando indietro = sgancio controllato;
- allo sgancio: ripristino orientamento iniziale completo dell'istanza (quello al caricamento in scena) e riposizionamento a `0.25 m` dalla parete lungo la normale locale.

Questa parte e definita nelle specifiche aggiornate ma va implementata nella fase dedicata a snap/post-snap.

## 5) Riferimenti specifiche aggiornate

- `sdd-specs/01-specifica-requisiti.md`
- `sdd-specs/02-design-tecnico.md`
- `sdd-specs/03-piano-implementazione.md`
- `sdd-specs/04-tracciabilita.md`
