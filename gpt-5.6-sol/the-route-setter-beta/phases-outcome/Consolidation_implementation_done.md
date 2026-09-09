# Esito Del Consolidamento

**Stato storico superato:** TheRouteSetter v0.0.1 e CHIUSA per accettazione dell'utente con limiti noti; prevale lo [stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md). Esiti, conteggi e descrizioni seguenti restano la fotografia precedente alla chiusura, non nuove verifiche.

Data: `2026-09-09`. Report corrente del consolidamento implementativo, successivo all'audit del `2026-09-08` sulla baseline `45eaefd`, non attestazione di un nuovo commit. L'intervento comprende modifiche a codice applicativo, test, tooling e documentazione. Le [verifiche definitive](Consolidation_verification_results.json) sono persistite con comandi, runtime, percorsi artifact e hash SHA-256 delle evidenze. Nessun esito storico di fase e stato riscritto.

## Esito

**Nucleo di sviluppo software implementato:** CON01..CON05, con riconciliazione normativa CON06 chiusa da DEC-028 e inline/mappatura CON08 implementati nel perimetro dichiarato. **Chiusura complessiva ancora pendente:** CON09 PARZIALE, con analisi completata e soluzione generale non implementata; tre fallimenti Edge precedenti, Firefox Stable e accettazione prestazionale completa sul codice finale con criteri residui. Le suite finali Chromium/Chrome/Firefox pinned sono passate. CI remota non eseguita e un'informazione, non un nuovo blocco di chiusura. Il nome del file non dichiara completa l'intera applicazione.

Il bug originale di aggancio alla parete resta CHIUSO per conferma dell'utente, con default parete `5 mm`, hold `1 mm` e configurazione approvata DEC-026. Le garanzie fisiche generali restano PARZIALI per motivi nativi concreti, non per una riapertura del bug accettato.

## Implementazione Riscontrata

| Gruppo | Esito nel perimetro corrente |
|---|---|
| CON01 | Readiness seriale solo con Pending/Missing, timeout/backoff, Ready/Failed terminali, no refetch manifest/preview; endpoint leggero e discovery isolata/terminale. |
| CON02 | Reporter main/API/globali, messaggi pubblici e ID validati, coda/deduplica/throttle/retry/timeout limitati, privacy, errori preview segnalati; nessuna rete per frame. |
| CON03 | ErrorResponse uniforme nella pipeline, binding/validazione/status e HTTP 416 con Content-Range; OpenAPI e correlazione, logger HTTP Serilog dell'host via DI. |
| CON04 | Race dettagli, rollback bootstrap/inserimento, fail-closed dopo fault irreversibile, RAF anche drag libero, resize differito/retarget, popup/bounds ed export camera esatta. |
| CON05 | Livelli .NET/override, sanitizzazione ricorsiva prima del rendering, retention per eta reale e pattern sul consumer, controllo idle/cambio giorno. |
| CON06 | CHIUSO: prefisso conservativo del click senza sliding e indici collider obbligatori, DEC-028; drag endpoint-only invariato. |
| CON08 | Inline e gate ricorsivo su tutto il perimetro TS dichiarato, audit XML backend manuale, 101 record attivi con mapping/stato, guide aggiornate. |

Verificati i sorgenti dei percorsi prima delle affermazioni. Il blocco fail-closed non permette di continuare a mutare una scena non piu visibile dopo un fault irreversibile: ferma frame/interazioni e rifiuta ulteriori comandi, aggiunte ed export. Gli errori locali recuperabili mantengono rollback e operazioni indipendenti, senza promettere recupero universale.

## Verifiche Applicative

Esiti definitivi del batch `route-consolidation-final-20260909`, eseguito nel workspace e registrato nel [JSON](Consolidation_verification_results.json), non conteggi riferiti dall'utente:

| Verifica | Ultima evidenza disponibile | Stato finale |
|---|---|---|
| Build backend Release | Zero warning e zero errori | Pass |
| Build frontend produzione | `tsc && vite build`, avviso chunk oltre 500 kB | Pass |
| Backend xUnit Release | `110/110` | Zero fail/skip/retry |
| Frontend Vitest | `447/447` in 18 file | Zero fail/skip/retry |
| Test tool Node | `14/14` | Zero fail/skip/cancelled/retry |
| Chromium `125.0.6422.26` completo | `57/57` | Zero fail/skip/flaky/retry |
| Chrome `152.0.7977.76` completo | `57/57` | Zero fail/skip/flaky/retry |
| Firefox pinned `125.0.1`, build 1449, completo | `57/57`, regressione stream JPEG passata | Zero fail/skip/flaky/retry |
| Edge `152.0.4191.66` precedente | `54 pass / 3 fail`, non rieseguito | TargetClosed in teardown/download, non pass finale |

Totale del batch corrente: **742/742 test**, zero fail/skip/retry, esclusi Edge e performance precedenti, build e gate strutturali. E2E completi sequenziali in headless, un worker, nessuna esclusione grep e trace attivi; API Release ricompilata, tre root asset indipendenti, frontend Vite dev server e build produzione verificata separatamente. Sorgenti applicativi/test e asset originali invariati durante la sola esecuzione finale, non durante l'intero intervento implementativo.

Il precedente Firefox `56 pass / 1 fail` resta storia ma non descrive piu l'esito corrente. Gli errori Edge non sono convertiti in pass e non provano da soli un bug applicativo: riguardano export ripetuto, JPG e download modello. La diagnostica registrava tre export completati, risorse stabili e pagina/browser aperti a fine corpo test; teardown/download e plausibile, non causa accertata. Firefox pinned non e Firefox Stable corrente e la release vendor piu recente non e stata verificata. `E2E_BROWSERS` legge una matrice opzionale, default Chromium, e fallisce per browser richiesti ma indisponibili; presenza del progetto non equivale a certificazione Stable.

CI remota e deployment operativo non eseguiti: indicazioni informative, non nuovi obblighi di run, commit o PR o condizioni aggiuntive di chiusura.

## Performance

Evidenza su **snapshot precedente agli ultimi fix**, non rieseguita nel batch finale: due profili passati senza skip/retry. La sintesi e persistita in `priorPerformanceEvidence` del [JSON definitivo](Consolidation_verification_results.json), insieme alla provenienza e alla conservazione di 39 file JSON/log in copie a hash identico, senza sovrascrivere gli originali. I raw originali sono sotto `C:/Users/FCurati/AppData/Local/Temp/opencode/route-con07-performance-certification`; dettagli da `summary.json` e profili tipico/complesso. Non e ricertificazione prestazionale del codice finale.

Chrome `152.0.7977.76` headed, WebGL 2.0 Intel integrata `0x00007DD5`/ANGLE D3D11, workstation condivisa, 22 processori logici e memoria browser dichiarata 16 GiB. Viewport `1920x1080`, DPR `1.0000000149011612`, canvas CSS `1616x1004.325`, drawing buffer `1616x1004`. Due modelli reali alternati, non 40 geometrie distinte.

| Misura | Tipico | Complesso |
|---|---:|---:|
| Hold attached / corpi / collider | 8 / 9 / 9 | 40 / 41 / 41 |
| Rendering sintetico ms / FPS mediani | 60020.3 / 60 | 60006.9 / 60 |
| Input ms / render effettivi | 60253.3 / 1179 | 85610.0 / 1603 |
| Selezioni / hold distinte | 59 / 8 | 80 / 40 |
| Commit movimento / rotazione | 59 / 59 | 80 / 80 |
| Campioni endpoint/solver | 118 | 160 |
| Solver p50 / max ms | 2.5 / 5.8 | 2.7 / 5.1 |
| Dispatch pointerup p50 / max ms | 3.1 / 7.0 | 3.4 / 5.9 |
| Render input p95 ms | 7.1 | 6.3 |
| Long task input max ms | 50 | 0 osservati |
| Heartbeat input p95 ms | 6.6 | 11.1 |

Load/attach/render senza long task osservati; heartbeat p95 rispettivamente `61.5/27.4/7.5 ms` nel tipico e `22.2/16.6/12.7 ms` nel complesso. Zero errori pagina ed endpoint rifiutati. Sono **118**, non 119, gli endpoint tipici: 59 movimenti e 59 rotazioni.

Rendering sintetico e input mouse sono fasi separate; 60 FPS non significa 60 FPS continui durante input on-demand. Dispatch pointerup include UI/solver, non round-trip Playwright o conferma GPU/paint. Entrambi gli artifact conservano `certified: false`: nome/flag `certification` e controlli passati non costituiscono accettazione universale. `PERF_SMOKE=true` permette workload ridotti, non certificazione; senza smoke la configurazione richiede almeno 40 hold e 60 s per fase, ma il profilo tipico resta da 8 hold.

Primo smoke complesso fallito sulla selezione Hold38, poi harness corretto e smoke `2/2`/profili `2/2`. Il FAIL storico SwiftShader (3 FPS, long task 829 ms, heartbeat 748 ms) resta tale. Non e una misura del profilo GPU hardware e non viene cancellato dai pass successivi. Il riscontro Intel hardware e acquisito per quella run, non esteso a tutti i PC. Resta l'accettazione prestazionale completa sul codice finale, spiegando il metodo split-phase senza equipararlo a 60 FPS continui durante input.

## Gate Documentali

Il JSON definitivo conserva un fallimento del gate documentale al ricontrollo: il link da `06-stato-conformita.md` a questo report allora non esisteva, pur con JSDoc 264/264. Il report ora e presente; documentazione e tracciabilita sono state rieseguite dopo l'allineamento ai risultati definitivi il `2026-09-09`, entrambe con exit code 0. Questo esito successivo non riscrive o nasconde il fallimento registrato nel JSON.

- `node scripts/check-documentation.mjs`: **264/264** dichiarazioni documentate in **24** file TS; 11 documenti obbligatori e 9 diagrammi. Il precedente inventario 261/261 e superato dalle nuove dichiarazioni; discovery ricorsiva, non lista fissa di cinque file.
- `node scripts/check-test-traceability.mjs`: **101/101** requisiti attivi con record, 101 record controllati, nessun mancante; 102 ID nella matrice incluso lo storico escluso, tutti i percorsi richiesti sono file. Mapping/stati del piano non equivalgono a completezza semantica.
- Test tool Node: **14/14 pass**, zero fail/skip/cancelled/retry nel batch definitivo; comando e quattro file di test registrati nel JSON. Non rieseguiti durante questo ultimo allineamento documentale e separati da Vitest/backend/E2E.
- `git diff --check` sui percorsi documentali modificati: pass, soli avvisi di normalizzazione LF/CRLF; per i file nuovi non tracciati e stata verificata separatamente l'assenza di whitespace finale e la validita dei link locali.
- XML backend: audit manuale sui 28 file elencati nel piano; nessun nuovo gate XML automatico.

Il gate AST include funzioni/classi con nome, interfacce, costruttori espliciti, metodi/firme e accessori; esclude `.d.ts`, arrow/function expression e test fuori `src`. Conta descrizioni JSDoc, non certifica italiano o correttezza semantica. Il piano macchina mantiene gli stati dei 101 attivi, senza percentuali di conformita o duplicazione di distribuzioni superate. `REQ-DOC-004` e implementato: guida test e report corrente sono allineati ai risultati definitivi e alle evidenze residue. CON08 inline/mappatura e implementato nel perimetro dichiarato, ma i file citati non dimostrano da soli ogni asserzione: mapping e gate non sono certificazione semantica.

## Analisi CON09

La [verifica dei limiti fisici residui](../sdd-specs/06-stato-versione-v0.0.1.md) completa l'analisi di fattibilita e le riproduzioni sul `PhysicsWorld` corrente, richiamato direttamente senza mock o step dinamici. **Stato PARZIALE: soluzione generale non implementata.** Le prove non sono pass di accettazione della proprieta generale e non alterano i conteggi `447/110/57` delle suite definitive.

Il cuboide di semilati `0.02 m` al centro del cubo chiuso TriMesh `+/-0.1 m` restituisce `contact null`, `intersects false` e posa valida, anziche invalida se la parete rappresenta un volume solido. Il caso esterno e valido e quello che attraversa la superficie viene rifiutato con circa `10 mm` di profondita. Sulla giunzione di un piano a due triangoli, una presa sottile con penetrazione rispetto alla superficie intera di `10 mm` riceve circa `0.7071 mm`, accettati alla tolleranza `5 mm`; fuori giunzione circa `10 mm`, rifiutati.

I percorsi esterno-interno sono invece bloccati nei casi esaminati, con frazioni circa `0.39999` e `0.49752`. Sono errori delle query endpoint native riprodotti, **non un attraversamento riprodotto nella UI**, che usa raycast di superficie e controllo dei percorsi incrementali. Non riaprono il bug laterale corretto e accettato dall'utente.

Non e stata individuata una soluzione nativa generale minima nelle API Rapier installate; il solo cambio query/prediction, `containsPoint` o `projectPoint(solid=true)` non risolvono i casi. Half-space e convex solido non rappresentano una parete arbitraria concava. La valutazione di versione motore/rappresentazione resta separata: nessun upgrade implicito o garanzia che basti aggiornare Rapier. Il report registra 246 hash invariati, nessun cambio a motore, GLB o tolleranza e nessuna mutazione di corpi, target cinematici, rendering o maschere.

## Stati Aperti

1. **CON09, PARZIALE: analisi completata, soluzione non implementata.** Giunzione e contenimento sono riprodotti nelle query endpoint native, non nella UI; i percorsi sono bloccati nei casi esaminati. Resta valutazione/implementazione della soluzione generale e, se cambia dipendenza/contratto, decisione esplicita. Nessun upgrade o cambio mesh applicato.
2. **CON07, browser:** tre fallimenti Edge precedenti ancora aperti e Firefox Stable corrente non verificato. Nessun pendente fittizio sulle suite finali unitarie o Firefox pinned gia passate.
3. **CON07, performance e criteri residui:** accettazione completa sul codice finale, con rendering sintetico distinto dall'input on-demand e limiti della mappatura espliciti. Evidenza prestazionale gia persistita, ma precedente agli ultimi fix e non ricertificata; non trasformare metriche mancanti in zero o pass del profilo in conformita universale.

Nessuna rinuncia implicita ai requisiti aperti. I fix software implementati non sono tutti marcati parziali solo per questi residui; altrettanto, il loro completamento non chiude l'intera richiesta.

## File Documentali

- [docs/applicazione.md](../docs/applicazione.md): comportamento corrente, lifecycle, readiness, errori/logging, configurazione e limiti.
- [docs/test-automatici.md](../docs/test-automatici.md): comandi, matrice opzionale, isolamento, risultati e performance con provenienza.
- [docs/checklist-fase-12.md](../docs/checklist-fase-12.md): verifica documentale corrente separata dalle spunte storiche.
- [sdd-specs/06-stato-versione-v0.0.1.md](../sdd-specs/06-stato-versione-v0.0.1.md): stato canonico della versione, inclusa la riconciliazione CON01..CON09.
- [docs/backend-contracts.md](../docs/backend-contracts.md): guida italiana dei contratti che sostituisce il resoconto provvisorio `source/backend/CON01-CON03-CON05.md`.
- [Consolidation_verification_results.json](Consolidation_verification_results.json): evidenze definitive persistite, hash dei risultati, Edge e performance precedenti distinti dal batch finale.
- [Analisi fisica confluita nello stato della versione](../sdd-specs/06-stato-versione-v0.0.1.md): analisi e riproduzioni CON09 sul sorgente corrente, limiti e fattibilita; soluzione generale non implementata.
- Questo report corrente: implementazione, risultati e stati aperti. Il consolidamento ha modificato codice applicativo, test e tooling oltre alla documentazione; report storici e asset originali conservati, nessun upgrade motore o cambio mesh per CON09.
