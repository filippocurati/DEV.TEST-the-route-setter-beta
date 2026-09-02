# Costituzione del progetto
## Applicazione per tracciatura vie climbing indoor

Questo documento definisce i principi non negoziabili validi in ogni fase.
Se un task sembra in conflitto con questi principi, prevale la costituzione.

Le fasi 0-9 sono una baseline storica congelata. Le regole `C16..C21`, introdotte per la fase 9UX, prevalgono sulle precedenti prescrizioni di interazione quando si implementano la fase 9UX e tutte le fasi successive.

---

**C1 - Rendering solo client-side.**
Il rendering 3D avviene solo nel browser tramite three.js.

**C2 - Fisica interattiva solo client-side.**
Rapier gira solo nel frontend (`@dimforge/rapier3d-compat`).
Il backend non contiene Rapier e non esegue simulazione fisica interattiva.

**C3 - Nessuna chiamata REST ad alta frequenza.**
Nessuna chiamata per frame, mouse move o aggiornamenti continui di posizione.

**C4 - Nessuna persistenza tracciature.**
Nessun salvataggio/storicizzazione di sessioni, prese posizionate o layout via.

**C5 - Nessuna autenticazione in questa versione.**
Non introdurre login, token, ruoli o autorizzazione applicativa.

**C6 - Separazione mesh/collider obbligatoria.**
Ogni oggetto in scena ha mesh grafica e collider fisico separati.
La mesh non e usata per collisioni.

**C7 - Convex Hull hold pre-calcolato lato backend.**
I collider delle prese sono generati lato backend come calcolo geometrico statico.

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
Chrome, Edge, Firefox stabili con WebGL 2.0, senza installazioni lato utente.

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

**C17 - Parete interamente fisica e impenetrabile.**
Tutti i triangoli del modello parete sono candidabili come target e partecipano alle collisioni, indipendentemente da forma, inclinazione, prominenza, curvatura o cavita. Il retro non viene classificato semanticamente ed e fuori ambito per l'aggancio, ma non deve essere escluso dal collider fisico.

**C18 - Validazione del Convex Hull.**
Aggancio, sgancio, spostamento e rotazione devono usare l'intero Convex Hull della presa. Aggancio e sgancio sono azioni editoriali dirette che validano ciascuna posa finale candidata senza simulare il percorso. Spostamento e rotazione sono trasformazioni continue e devono arrestarsi all'ultima posa valida prima della compenetrazione con parete o altre prese.

**C19 - Blocco al cambio di superficie.**
Una presa agganciata puo seguire soltanto piccole variazioni della superficie locale entro la tolleranza angolare rispetto alla normale di aggancio. Diedri, spigoli, prominenze e cambi di inclinazione oltre soglia sono bloccanti; non e prevista transizione automatica fra superfici.

**C20 - Interazione contestuale pointer-based.**
Le azioni hold sono fornite da un popup contestuale e da overlay DOM/SVG. Non sono previste shortcut globali per trasformare le prese. Le modalita di targeting, spostamento e rotazione sono mutuamente esclusive e annullabili con `Escape`.

**C21 - Overlay esclusi dall'export.**
Popup, target, hint e gizmo di interazione non fanno parte della scena esportata e devono essere nascosti o esclusi durante la generazione dell'immagine.
