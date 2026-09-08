# Primo gruppo: fisica, diagnostica e regressioni

Data: 2026-09-08. Perimetro approvato: prima parte degli interventi, senza modificare GLB o collider originali. Non e una dichiarazione di conformita completa dell'applicazione.

## Modifiche

- La validazione endpoint non trasla piu la presa di 1 mm lungo la normale di aggancio. Interroga la posa originale contro il TriMesh e le altre prese tramite Rapier.
- Tolleranza geometrica: 0.001 m. Epsilon separato per arrotondamento float32: 0.000002 m. Test su contatto, uguaglianza della soglia, penetrazioni inferiori e superiori, winding e trasformazioni rigide.
- Contatti e intersezioni nativi incoerenti producono un rifiuto conservativo, con `lastPoseDiagnostic.uncertain`; non sono esposti come collisioni certe.
- Le query fra convex supportati usano copie scalate di fattore 100, posizioni relative e conversione delle distanze in metri. I vertici e gli indici del collider backend restano gli stessi: nessuna generazione dell'hull nel frontend, nessuna modifica della scala in scena.
- Broad phase nativa AABB prima delle query precise; cache dei raggi e delle copie geometriche, ripulite alla rimozione.
- Click: rimosso il fast path che accettava un endpoint libero senza esaminare il percorso. Shape cast per traslazioni a orientamento fisso da partenza separata; suddivisione adattiva con bound del moto dei punti per traslazione e rotazione. Un intervallo ambiguo o oltre budget arresta il movimento. Gli endpoint vengono ricontrollati prima del commit.
- Le pose parziali di movimento vengono riproiettate e riverificate prima del commit. Punto, normale e feature ID vengono aggiornati insieme. Le rotazioni possono fermarsi a una frazione del grado richiesto.
- Drag ancora endpoint-only: nessuna collision query durante preview, nessuna rete per frame. Shadow nascosta quando manca l'hit, feature ID aggiornato sul candidato, no-op distinto da collisione.
- `lastActionResult.reason` distingue collisione parete/presa, assenza superficie, discontinuita, limite angolare, no-change e percorso non risolto. Snapshot diagnostico read-only, non logging persistente.
- Allineati C19, offset del drag libero, design, piano e tracciabilita. DEC-025 registra implementazione e limiti aperti.

## Verifiche

| Verifica | Esito |
|---|---|
| TypeScript / build frontend | Superati; warning Vite sulle dimensioni dei chunk |
| Vitest | 215/215, 11 file |
| Playwright Chromium headless | 31/31, senza retry nella verifica finale |
| Trace E2E | Nessun pageerror, console error o errore HTTP |
| Gate documentazione/tracciabilita | Superati, 102 requisiti nella matrice |
| Asset originali/copie runtime | Hash invariati |
| Backend | Non modificato; 33/33 verificati nell'analisi precedente, non nuova build certificativa |

I due nuovi file unit sono `poseValidation.test.ts` (138 casi) e `realWall.test.ts` (27 casi). Comprendono diedro a 90 gradi, soglia inclusiva, rotazione della configurazione, percorsi con endpoint liberi e ostacolo intermedio, appoggio e pinna nello stesso TriMesh, ambiguita native, assenza mutazioni/rete, esclusione dei collider lontani e ripetibilita sugli asset reali.

Le regressioni GLB bloccano l'hash della parete e verificano gli hash sorgente dei collider delle prese. Tre pannelli frontali accettati per entrambe le prese; sequenza laterale a y=7 con raggi da x=20: z=-4.25, -3.5, -3.25 accettati; z=-4.1, -4, -3.75, -3, -2.75, -2.5 rifiutati. Le penetrazioni reali dovute alla non planarita non vengono nascoste.

Durante lo sviluppo i test hanno rilevato problemi numerici con collider millimetrici, falsi sweep tangenti e una preselezione mancante nel nuovo E2E di collisione. Sono state aggiunte normalizzazione delle query, gestione dei contatti iniziali e selezione esplicita nel test. I vecchi eventi pointer sintetici sono stati sostituiti da click reali e controllo delle eccezioni pagina.

## Prestazioni misurate

Microbenchmark Node 22.18.0 su Intel Core Ultra 7 155H, 40 istanze con hull reali, layout distante e denso, 10 misure dopo warmup:

- Endpoint: mediane circa 1.7-6.3 ms, massimo circa 8.4 ms.
- Click traslazione/rotazione: mediane circa 24-59 ms, massimo circa 84 ms.
- Il layout denso non rappresenta 40 prese tutte agganciate; alcune pose invalide urtano anche una presa vicina. I tempi non includono DOM/rendering e non certificano il budget interattivo hardware.

Il benchmark grafico headless esistente e FALLITO: mediana 3 FPS contro 30 richiesti, renderer software SwiftShader, long task massimo 829 ms, heartbeat p95 circa 748 ms. Commit endpoint 10.7 ms in un campione. Non e prova del comportamento su GPU integrata, ne una certificazione positiva; occorre riesecuzione headed con accelerazione hardware.

Artefatti runtime e misure fuori repository: `C:\Users\FCurati\AppData\Local\Temp\opencode\route-runtime-20260908-final-broadphase`. Processi di verifica terminati.

## Limiti e prossimi passi

- Rapier 0.12 puo sottostimare contatti presso giunzioni interne di triangoli, soprattutto con collider molto sottili. La corroborazione booleana e la suddivisione non garantiscono l'accuratezza di ogni distanza nativa. Non si dichiara una prova generale di collisione continua per ogni geometria arbitraria.
- Un oggetto completamente contenuto in un TriMesh chiuso, senza attraversarne la superficie nella posa endpoint, non e riconosciuto come contenuto in un solido. La semantica volumetrica richiede una decisione e verifica separate.
- Quando il collider parete e gia in contatto, il percorso usa gli intervalli e non uno sweep dell'intero collider. I test appoggio/pinna passano, ma restano i limiti delle query native alle giunzioni.
- Le verifiche Chrome/Edge/Firefox stabili e la nuova certificazione prestazionale hardware restano da effettuare.
- Catalogo Pending/Ready, gestione globale errori, sanitizzazione e retention backend appartengono al secondo gruppo e non sono stati implementati qui.
- Prossimo passo consigliato: riprodurre il gesto segnalato con la nuova diagnostica, misurare su browser hardware e affrontare i casi numerici residui (eventuale upgrade Rapier con approvazione). Poi valutare una copia planare dei raccordi, preservando originale e test prima/dopo.

Non sono stati modificati modelli, asset backend o dipendenze, ne creati commit Git. Le cancellazioni e il file non tracciato preesistenti sono stati preservati.
