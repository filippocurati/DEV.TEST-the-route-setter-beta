# Movimento globale sull'intero modello completato

## Contesto

I primi tentativi di correzione del drag laterale avevano introdotto una normale locale coerente e, successivamente, un tracking topologico della patch iniziale. Quest'ultimo approccio e stato abbandonato perche manteneva il vincolo al pannello iniziale e poteva arrestare la shadow prima del puntatore sulle superfici laterali strette. Durante un'interruzione della conversazione erano inoltre state iniziate per errore funzionalita non approvate (`Movimento 3D` detached, gizmo a sei assi, spawn camera-facing e auto-framing): sono state rimosse integralmente.

La soluzione finale segue la semantica approvata in `MovimentoSuTuttoIlModello.md`.

## Semantica finale

- Il drag e disponibile per una presa `attached` in modalita `Sposta`.
- Nel drag libero il contact point coincide esattamente con il puntatore corrente: non viene applicato alcun offset derivato dal punto iniziale afferrato sulla mesh.
- Nel drag dalle frecce il contact point richiesto resta vincolato all'asse screen-space della freccia.
- Un raycast globale individua la prima superficie visibile dell'intero modello.
- La shadow viene posizionata sul punto colpito e orientata sulla nuova normale.
- La shadow puo passare fra pannelli e inclinazioni senza limite di 5 gradi.
- L'orientamento iniziale viene trasportato sulla nuova normale tramite la rotazione minima, preservando il twist visivo meglio del semplice riuso del valore angolare.
- La hold reale e il collider restano invariati durante il drag.
- Non viene validato il percorso intermedio.
- Al rilascio viene eseguita una sola validazione Convex Hull dell'endpoint.
- Endpoint valido: commit atomico di posizione, orientamento, contact point, normale di aggancio e feature ID.
- Endpoint invalido: rollback totale.
- Se il puntatore non colpisce la parete, l'endpoint corrente non e committabile.

Il limite di 5 gradi resta soltanto per i click incrementali da 1 cm.

## Correzioni preservate nel targeting

Restano valide le correzioni indipendenti applicate all'aggancio:

- il gruppo contenente il campione centrale prevale quando il centro e valido;
- la normale stabilizzata usa campioni localmente compatibili col punto scelto;
- punto e normale appartengono alla stessa patch locale.

## Modifiche estranee rimosse

Durante un'interruzione della conversazione erano state iniziate funzionalita non richieste:

- `Movimento 3D` per hold detached;
- gizmo a sei assi;
- spawn camera-facing;
- auto-framing camera;
- sweep collisionale detached.

Queste modifiche parziali sono state rimosse. Spawn, camera e popup detached mantengono il comportamento consolidato precedente.

## Test

- Unit: coerenza punto-normale e trasporto orientamento sulla nuova normale.
- E2E: contact point sotto al mouse, shadow su superficie con normale diversa oltre 5 gradi, hold reale immutata durante preview e commit della nuova attachment normal.
- Unit: trasporto orientamento sulla nuova normale e targeting punto-normale coerente.
- Suite unit corrente: `50/50` su 9 file.
- Suite E2E corrente: `27/27`, incluso cambio pannello con contact point sotto al mouse.
- Backend xUnit: `33/33`.

## Specifiche

- `app_definition.md`
- `sdd-specs/01-specifica-requisiti.md`
- `sdd-specs/02-design-tecnico.md`
- `sdd-specs/03-piano-implementazione.md`
- `sdd-specs/04-tracciabilita.md`
- `sdd-specs/05-open-decisions-guidate.md`

La decisione normativa finale e `DEC-024 - Drag globale sull'intero modello`.
