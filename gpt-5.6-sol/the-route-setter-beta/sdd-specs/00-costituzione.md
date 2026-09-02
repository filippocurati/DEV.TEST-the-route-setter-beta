# Costituzione del progetto
## Applicazione per tracciatura vie climbing indoor

Questo documento definisce i principi non negoziabili validi in ogni fase.
Se un task sembra in conflitto con questi principi, prevale la costituzione.

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

**C8 - Parete continua con TriMesh lato frontend.**
Il collider parete e un TriMesh statico derivato dall'intera geometria della parete e creato lato client.
Collisioni, punto piu vicino, snap e movimento post-snap devono usare la forma reale del TriMesh.
E vietato sostituire la parete con un piano globale, un unico Convex Hull, una profondita costante o una normale fissa.

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

**C16 - Transizioni locali sulla superficie.**
La parete e trattata come una superficie continua. Una presa agganciata puo passare a una faccia con inclinazione diversa soltanto quando il movimento raggiunge il bordo condiviso o il primo contatto fisico con una superficie geometricamente contigua, entro la tolleranza configurata. Non sono consentiti trasferimenti a distanza o dipendenti dalla camera.

**C17 - Percorso e posa non compenetranti.**
Traslazione e variazione di orientamento devono essere validate usando l'intero Convex Hull della presa. Se una transizione non e completamente valida, deve essere applicata la massima trasformazione non compenetrante e il movimento residuo deve arrestarsi.

**C18 - Termine del supporto e retro fuori ambito.**
La presa deve arrestarsi quando termina il supporto operativo o non esiste una posa contigua non compenetrante. Il retro del modello e fuori dall'operativita garantita: non e richiesta classificazione automatica e il comportamento non e definito se l'utente forza un percorso geometricamente connesso verso il retro o porta intenzionalmente una presa dietro il modello.
