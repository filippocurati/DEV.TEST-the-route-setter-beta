# Guida operativa per lo sviluppo SDD
## Validazione finale e istruzioni per agente AI

Questo documento descrive come usare il pacchetto `sdd-specs` per sviluppare l'applicazione in modalita Spec-Driven Development.

Cartella contenente le specifiche SDD: cartella `sdd-specs`.

Le specifiche SDD risultano coerenti con i vincoli principali richiesti:
- backend ASP.NET Core Web API e frontend browser-only;
- rendering three.js lato client;
- fisica Rapier lato client, nessuna simulazione fisica backend;
- separazione mesh/collider;
- Convex Hull hold lato backend con invalidazione hash;
- TriMesh parete lato frontend;
- assenza persistenza tracciature;
- gestione errori centralizzata;
- logging server-side strutturato;
- test automatici completi (backend, API, fisica headless, E2E);
- documentazione esaustiva in italiano;
- cartelle hold standardizzate: `holds/Hold<number>` (es. `Hold1`, `Hold2`).

## 1) Struttura del pacchetto sdd-specs

### `sdd_istructions.md`
Scopo del pacchetto e ordine di lettura. Definisce la regola d'uso: i vincoli sono obbligatori, gli OPEN sono guidati.

### `sdd-specs/00-costituzione.md`
Principi non negoziabili trasversali al progetto.
E il livello piu alto di priorita: in caso di conflitto, prevale sempre.

### `sdd-specs/01-specifica-requisiti.md`
Requisiti funzionali/non funzionali dettagliati con criteri di accettazione verificabili.
E il documento di riferimento per decidere cosa e corretto implementare.

### `sdd-specs/02-design-tecnico.md`
Traduzione dei requisiti in scelte architetturali e tecniche.
Definisce API baseline, flow Convex Hull, fisica, benchmark, versionamento dipendenze.

### `sdd-specs/03-piano-implementazione.md`
Roadmap incrementale a fasi con Definition of Done.
Usare questo file per implementare step-by-step senza salti.

### `sdd-specs/04-tracciabilita.md`
Mappa requisito -> design -> test.
Serve per verificare copertura completa e prevenire derive.

### `sdd-specs/05-open-decisions-guidate.md`
Elenco minimo dei punti ancora OPEN, ma con limiti precisi.
Non consente decisioni arbitrarie che alterino il comportamento richiesto.

## 2) Nomenclatura delle specifiche

### 2.1 Prefix file
- `00-...`: principi costituzionali.
- `01-...`: requisiti (cosa deve fare il sistema).
- `02-...`: design (come realizzarlo).
- `03-...`: piano esecutivo.
- `04-...`: tracciabilita.
- `05-...`: open decisions residue.

### 2.2 ID requisiti
Formato: `REQ-<DOMINIO>-<NUMERO>`.

Domini:
- `ARC`: architettura;
- `MOD`: gestione file modelli;
- `CAT`: catalogo hold;
- `SCN`: scena/istanze;
- `FIS`: fisica/snap/movimento;
- `HUL`: Convex Hull backend;
- `UI`: interfaccia;
- `IMG`: generazione immagine guida;
- `PRF`: prestazioni;
- `ERR`: error handling;
- `LOG`: logging;
- `TST`: test automatici;
- `DOC`: documentazione;
- `DEP`: dipendenze/versionamento.

### 2.3 Regole naming asset
- cartella principale hold: `holds`;
- cartella modello parete: `main-wall`;
- sottocartelle hold: `Hold<number>` (`Hold1`, `Hold2`, ...);
- preview: file con prefisso `PREV_`.

## 3) Come svolgere l'implementazione di ogni fase

### 3.1 Regola pratica per ogni fase
Per ogni fase del piano (`03-piano-implementazione.md`):
- identificare i `REQ-*` impattati;
- implementare codice minimo necessario;
- eseguire i test di fase;
- confermare Definition of Done;
- documentare eventuali decisioni OPEN prese (solo se consentite da `05-open-decisions-guidate.md`).

### 3.2 Verifica tecnica obbligatoria per fase
- conformita a `00-costituzione.md`;
- conformita a criteri di accettazione in `01-specifica-requisiti.md`;
- allineamento architetturale con `02-design-tecnico.md`;
- verifica copertura con `04-tracciabilita.md`.

Tutte i dettagli su come svolgere e validare ciascuna fase, e l'ordine di esecuzione delle fasi stesse sono riportati nel file `03-piano-implementazione.md`.
