# Costituzione del progetto
## Applicazione per tracciatura vie climbing indoor

Questo documento definisce i principi non negoziabili validi in ogni fase.
Se un task sembra in conflitto con questi principi, prevale la costituzione.

Le fasi 0-9 sono una baseline storica congelata. Le regole `C16..C21`, introdotte per la fase 9UX, prevalgono sulle precedenti prescrizioni di interazione quando si implementano la fase 9UX e tutte le fasi successive.

La costituzione vincola `app_definition.md` e i requisiti correnti; le decisioni esplicite ne chiariscono la prevalenza. Il design distingue soluzione richiesta e codice osservato. Codice e report non derogano implicitamente ai requisiti.

Per approvazione esplicita dell'utente (`DEC-029`), lo sviluppo di **v0.0.1 e CHIUSO e ACCETTATO con limiti noti**. Sono approvati il supporto ufficiale solo Chrome (`C12`) e le eccezioni di release, senza rimuovere i requisiti funzionali o dichiarare risolti i limiti. [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md) e l'unica fonte di stato, rischi, eccezioni ed evidenze; le attenzioni accettate non sono blocchi di chiusura. `DEC-028` resta valida per prefisso dei click e indici hull; gli esiti originali di fase restano storici.

---

**C1 - Rendering solo client-side.**
Il rendering 3D avviene solo nel browser tramite three.js.

**C2 - Fisica interattiva solo client-side.**
Rapier gira solo nel frontend (`@dimforge/rapier3d-compat`).
Il backend non contiene Rapier e non esegue simulazione fisica interattiva.

**C3 - Nessuna chiamata REST ad alta frequenza.**
Nessuna chiamata per frame, mouse move o aggiornamenti continui di posizione.
Il watcher readiness seriale con intervallo base `1 s`, limitato a `Pending`/`Missing`, e il reporter errori bounded/throttled sono indipendenti dal loop grafico e fisico; non autorizzano traffico per interazione continua.

**C4 - Nessuna persistenza tracciature.**
Nessun salvataggio/storicizzazione di sessioni, prese posizionate o layout via.

**C5 - Nessuna autenticazione in questa versione.**
Non introdurre login, token, ruoli o autorizzazione applicativa.

**C6 - Separazione mesh/collider obbligatoria.**
Ogni oggetto fisico reale in scena (parete o istanza di presa) ha mesh grafica e collider fisico separati.
La mesh non e usata per collisioni.
Shadow e overlay sono esclusivamente visuali, senza collider o rigid body, e non sono ulteriori oggetti fisici (`C20`, `C21`).

**C7 - Convex Hull hold pre-calcolato lato backend.**
I collider delle prese sono generati lato backend come calcolo geometrico statico.
Il contratto corrente richiede vertici e indici triangolari dell'hull (`REQ-HUL-003`, `DEC-028`); nessuna generazione hull frontend, migrazione o retrocompatibilita senza indici richiesta.

**C8 - Parete con TriMesh lato frontend.**
Il collider parete e TriMesh derivato dalla geometria parete e creato lato client.

**C9 - Unita e sistema di riferimento.**
Sistema destrorso coerente con three.js; 1 unita = 1 metro.

**C10 - Errori senza dettagli tecnici al client.**
Niente stack trace/path/configurazioni in risposta utente.
Errori correlabili con ErrorId lato server.

**C11 - Logging centralizzato server-side.**
Logging strutturato JSON, asincrono, sanitizzato, con rotazione giornaliera e retention 7 giorni.

**C12 - Compatibilita browser target.**
Per v0.0.1 solo Chrome Stable desktop con WebGL 2.0 e ufficialmente supportato, senza installazioni aggiuntive lato utente (`DEC-029`, `REQ-ARC-007`). Ultima versione testata: Chrome 152; nessuna promessa automatica per ogni futura Stable del vendor. Edge e Firefox sono esplorativi e non bloccano la release.

**C13 - Stack tecnico vincolato.**
Frontend: TypeScript + Vite.
Backend: ASP.NET Core Web API.
Parsing GLB backend: SharpGLTF.
Libreria Convex Hull backend: MIConvexHull.
Logging backend: Serilog.

**C14 - Regola di tracciabilita.**
Ogni funzionalita implementata deve riferirsi a requisiti e test verificabili.

**C15 - Versionamento dipendenze deterministico.**
Le dipendenze npm/NuGet devono essere pin-nate a versione esatta.
Devono essere versionati i file di lock (`package-lock.json` o equivalente e lock NuGet) per garantire build ripetibili.
Le versioni iniziali di riferimento sono definite nei requisiti `REQ-DEP-004`.

**C16 - Posizionamento diretto esplicito.**
Dalla fase 9UX l'aggancio avviene esclusivamente tramite azione `Aggancia` e targeting mouse sulla parete. Non esistono snap automatico per prossimita ne comandi avanti/indietro. Il percorso dalla posa detached al target non viene simulato; la posa finale deve essere integralmente valida.

**C17 - Parete interamente fisica e controlli di impenetrabilita.**
Tutti i triangoli del modello parete sono candidabili come target e partecipano alle collisioni, indipendentemente da forma, inclinazione, prominenza, curvatura o cavita. Il retro non viene classificato semanticamente ed e fuori ambito per l'aggancio, ma non deve essere escluso dal collider fisico.
La candidabilita di ogni triangolo non implica che ogni posa sia valida: l'intero hull deve superare i controlli di collisione con le soglie di `C18`. L'impenetrabilita resta l'obiettivo funzionale, non una garanzia universale. L'eccezione di release `DEC-029` accetta i limiti di Rapier `0.12.0` senza dichiararli corretti: riferimento comune per `C17`/`C18` in [06-stato-versione-v0.0.1.md](06-stato-versione-v0.0.1.md).

**C18 - Validazione del Convex Hull.**
Aggancio, sgancio, spostamento e rotazione devono usare l'intero Convex Hull della presa nelle pose committate. Aggancio, sgancio e drag di spostamento/rotazione sono azioni editoriali endpoint-only: validano la sola posa finale e non il percorso. Durante il drag la presa reale resta immutata; una posa endpoint invalida annulla integralmente l'operazione senza commit parziale. I soli click incrementali continuano ad arrestarsi all'ultima posa valida.
La non compenetrazione si valuta con soglie separate approvate in `DEC-026`: parete configurabile `1..10 mm`, decimali inclusi, default `5 mm`; fra prese `1 mm` immutabile; epsilon numerico `2e-6 m` invariato. Questo non modifica il surface-lock dei click (`5 gradi`, gap `5 mm`) ne autorizza gli sweep da partenza separata a oltrepassare il primo contatto.
Per i drag, esattamente una query applicativa endpoint al rilascio solo con candidato cambiato e disponibile; nessuna per no-change, no-hit o annullamento. I controlli restano obbligatori con l'eccezione di release richiamata in `C17`. `DEC-028` prescrive in `REQ-FIS-004` il prefisso valido nella direzione richiesta, entro i vincoli locali, senza move-and-slide o scorrimento automatico delle componenti libere. Query native Rapier obbligatorie; KCC fondazione legacy/opzionale, non obbligatorio nel percorso attivo.

**C19 - Blocco al cambio di superficie nei soli click incrementali.**
Nei click incrementali una presa agganciata puo seguire soltanto piccole variazioni della superficie locale entro 5 gradi rispetto alla normale di aggancio. Diedri, spigoli, prominenze e cambi di inclinazione oltre soglia sono bloccanti. Il drag di movimento e invece globale ed endpoint-only: puo cambiare pannello e aggiorna la normale di aggancio al commit, senza validare il percorso intermedio (`DEC-024`).

**C20 - Interazione contestuale pointer-based.**
Le azioni hold sono fornite da un popup contestuale e da overlay DOM/SVG. Non sono previste shortcut globali per trasformare le prese. Le modalita di targeting, spostamento e rotazione sono mutuamente esclusive e annullabili con `Escape`; la stessa azione deseleziona la hold e nasconde il popup. I drag di spostamento e rotazione usano una shadow 3D runtime priva di collider; nessun file preview aggiuntivo e richiesto.

**C21 - Overlay esclusi dall'export.**
Popup, target, hint, gizmo, linee, archi e shadow 3D di preview non fanno parte della scena esportata e devono essere nascosti o esclusi durante la generazione dell'immagine.
