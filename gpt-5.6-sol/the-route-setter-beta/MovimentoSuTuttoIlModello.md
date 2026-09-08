# Movimento Su Tutto Il Modello

La soluzione proposta è utile e, considerando le tue preferenze, è probabilmente la più adatta.

## Semantica

La semantica sarebbe:

1. Il mouse indica un punto visibile della parete.
2. Un **raycast** individua la prima superficie visibile.
3. La **shadow** viene traslata su quel punto.
4. La **normale locale** determina la nuova inclinazione.
5. Il **twist** viene conservato.
6. Al rilascio viene validata la posa completa.
7. Se c’è spazio, posizione e orientamento vengono applicati.
8. Se non c’è spazio, il movimento viene annullato.

Questo equivale a un **teletrasporto editoriale continuo della preview, con commit endpoint-only**.

---

## Comportamento Ai Cambi Di Pannello

Passando da un pannello laterale a uno frontale:

```text
shadow sul laterale
→ mouse attraversa il raccordo
→ raycast colpisce il frontale
→ shadow si orienta sul frontale
```

Non è necessario calcolare un percorso fisico sul raccordo.

Questo è coerente con la semantica **endpoint-only** già adottata:

- la presa reale non si muove durante il drag;
- il percorso intermedio non viene validato;
- soltanto la posizione finale deve essere libera.

---

## Adattamento Dell’Inclinazione

La normale della nuova superficie definisce l’orientamento:

```text
asse locale +Z della presa
→ allineato alla nuova normale
```

Per il **twist** ci sono due strategie:

1. conservare lo stesso valore numerico di twist;
2. trasportare l’orientamento precedente sulla nuova normale minimizzando la rotazione visiva.

La seconda produce transizioni più naturali quando si passa tra pannelli molto inclinati, ma è leggermente più complessa.

---

## Validità Dello Spazio

La shadow può sempre mostrare la posa geometrica candidata.

Al rilascio:

- **Convex Hull libero:** commit;
- **compenetrazione:** rollback e feedback rosso.

È preferibile non eseguire la validazione **Convex Hull** a ogni `pointermove`, perché:

- la parete contiene molti triangoli;
- il drag diventerebbe meno fluido;
- la fase 9UX ha esplicitamente adottato la validazione **endpoint-only**.

---

## Vantaggi

- non richiede metadata sui pannelli;
- elimina il problema delle patch troppo piccole;
- shadow più fedele al puntatore;
- comportamento coerente su frontali e laterali;
- transizioni automatiche tra pannelli;
- costo per frame più basso;
- implementazione concettualmente più semplice;
- allineata alla natura editoriale dell’applicazione.

---

## Rischi

- cambio brusco di superficie vicino ai bordi;
- possibile salto su una superficie visibile dietro il bordo;
- twist da gestire attentamente;
- la prima superficie visibile dipende dal punto di vista della camera;
- una posizione visivamente plausibile può essere rifiutata dal Convex Hull.

Nel tuo scenario il punto di vista della camera è deliberatamente orientato verso il pannello da modificare. Questo riduce molto il rischio di scegliere accidentalmente una superficie indesiderata.

---

# Raccomandazione

Alla luce delle preferenze indicate, raccomanderei:

## Movimento Globale Endpoint-Only

- nessun lock al pannello iniziale;
- nessuna patch topologica durante il drag;
- nessun limite di **5°** fra posizione iniziale e candidata;
- un **raycast globale** sul punto corrente del mouse;
- shadow orientata sulla normale della superficie colpita;
- twist trasportato sulla nuova normale;
- una sola validazione **Convex Hull** al rilascio;
- commit con aggiornamento di:
  - posizione;
  - normale di aggancio;
  - contact point;
  - orientamento;
  - feature ID;
  - twist o riferimento equivalente.

Il limite di **5°** potrebbe restare per i click incrementali da **1 cm**, se si vuole evitare che un singolo click attraversi involontariamente un diedro.

Per il **drag libero globale**, invece, diventerebbe incompatibile con la possibilità di cambiare pannello.

---

# Decisione Da Formalizzare

Prima di implementare servirebbe formalizzare questa semantica:

> Durante il drag la shadow rappresenta la posa sulla prima superficie visibile sotto il contact point richiesto. Può passare fra pannelli e adattarsi alla nuova normale. Il percorso intermedio non viene validato. Al rilascio la posa endpoint viene applicata solo se il Convex Hull non compenetra parete o altre prese.

Questa soluzione non richiede modifiche al modello e affronta direttamente il problema residuo invece di tentare di inferire semanticamente i pannelli dalla triangolazione.