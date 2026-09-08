# Configurazione della tolleranza parete

Data: 2026-09-08. Esito finale del perimetro approvato `DEC-026`. Risultati funzionali e prova produzione verificati e comunicati dall'utente; non rieseguiti per questa finalizzazione documentale. I report storici restano invariati.

## Perimetro

- Parete: tolleranza configurabile da `1` a `10 mm` inclusi, anche decimali, default raccomandato `5 mm`.
- Fra prese: `1 mm` immutabile, senza chiave di configurazione. Epsilon numerico separato invariato a `2e-6 m`.
- `DEC-026` sostituisce soltanto la precedente tolleranza unica di `DEC-025`; non chiude i limiti numerici residui o il lavoro differito backend/catalogo/errori globali.
- Asset GLB e collider originali Hold1/Hold2 invariati; nessuna generazione hull frontend o modifica delle dipendenze.

## Comportamento

`PhysicsWorld` usa il minimo per contatto di `distance + tolerance` per endpoint e intervalli dei click, non la distanza grezza piu profonda seguita da una soglia unica. Una penetrazione parete di `4 mm` entro i suoi `5 mm` non puo nascondere una penetrazione fra prese di `2 mm` oltre il loro `1 mm`.

La diagnostica finale da priorita alla violazione accertata rispetto all'incertezza di un altro collider. `blocker`, `colliderHandle`, `penetrationMeters`, `toleranceMeters` e `uncertain: false` restano coerenti con il contatto selezionato. La regressione copre entrambi gli ordini broadphase, endpoint e percorso. Rimossa la hold che viola la soglia, la parete incerta torna governante con `uncertain: true` e `path-unresolved`: l'incertezza non viene accettata solo perche la distanza riportata e entro tolleranza.

Sweep da partenza separata ancora arrestati prima del primo contatto, anche verso il pavimento, senza consumare la tolleranza. Contatti iniziali e rotazione gestiti dagli intervalli; budget `512` e bound minimo `2e-6 m`. Surface-lock click `5 gradi` e gap di riproiezione `5 mm` invariati. Drag ancora endpoint-only, senza query di collisione durante la preview.

## Verifiche Finali

| Verifica | Esito e provenienza |
|---|---|
| Vitest | `331/331` superati in `12` file, risultato finale confermato dall'utente |
| Playwright | `43/43` superati, risultato finale confermato dall'utente |
| Produzione runtime | Build in dist temporanea, file reale servito `5 -> 3 -> 5`, valori applicati al reload senza rebuild fra le modifiche; verifica confermata dall'utente |
| Backend | Non modificato; `33/33` e build precedente restano solo evidenze storiche, non rieseguite qui |

La prova produzione modifica il JSON effettivamente servito, non una risposta intercettata: verifica separatamente dal routing simulato degli E2E che il valore non sia incorporato nel bundle. Gli E2E coprono caricamento unico, cambio al reload, hold sempre a `1 mm` ed errori di configurazione gestiti senza `pageerror` non gestiti. Gli errori HTTP/rete indotti dai casi negativi non sono una dichiarazione di traccia priva di errori HTTP.

Riferimenti automatici: `source/frontend/tests/config/physicsConfig.test.ts`, `source/frontend/tests/physics/poseValidation.test.ts`, `source/frontend/tests/physics/realWall.test.ts`, `source/frontend/tests/e2e/physics-config.spec.ts`. [Comandi e dettaglio test](../docs/test-automatici.md).

## Evidenze Parete Reale

Misure verificate e comunicate dall'utente. La baseline laterale contiene `9` pose per hold; la griglia separata contiene `52` pose per hold. La griglia e evidenza separata, non attribuita a un test automatico non presente.

| Tolleranza parete | Baseline Hold1 accettate / 9 | Baseline Hold2 accettate / 9 | Griglia Hold1 accettate / 52 | Griglia Hold2 accettate / 52 |
|---|---|---|---|---|
| `1 mm` | 3 | 3 | 8 | 7 |
| `3 mm` | 7 | 7 | 29 | 29 |
| `5 mm` | 9 | 9 | 45 | 45 |
| `10 mm` | 9 | 9 | 46 | 46 |

- Scontri profondi parete di circa `120 mm` (Hold1) e `200 mm` (Hold2): bloccati a tutte le soglie verificate.
- Target prima rifiutati con penetrazione circa `4 mm`: passi locali `+/-1 cm` e twist `+/-1 grado` falliscono a `1` e `3 mm`, passano a `5` e `10 mm`.
- Prove suggerite: `1 mm` baseline, `3 mm` conservativa, `5 mm` raccomandata, `7.5` e `10 mm` esplorative. I decimali sono ammessi; la tabella non attribuisce a `7.5 mm` una misura non effettuata.

## File Runtime

Istruzioni complete nella [guida alla configurazione runtime](../docs/applicazione.md#tolleranza-parete-runtime). File sorgente: `source/frontend/public/physics-config.json`.

```json
{
  "wallPenetrationToleranceMm": 5
}
```

Numero JSON finito in `1..10`, senza virgolette, punto decimale (esempio `7.5`), nessun commento o altra chiave. Una sola fetch al bootstrap con `cache: 'no-store'`, nessuna rilettura durante le interazioni. File invalido/indisponibile impedisce l'avvio con errore gestito nella pagina: nessun default fallback silenzioso, hold sempre `1 mm`.

1. Prima di modificare, esportare l'eventuale vista con `Genera immagine`: Vite puo ricaricare automaticamente alla modifica di `public`. Il reload perde la sessione; il JPG e un riferimento visivo, non salva una tracciatura editabile o ripristinabile.
2. In sviluppo modificare il file sorgente servito da Vite e ricaricare. Nessuna compilazione, riavvio frontend o backend necessario per il cambio del valore.
3. In produzione occorre prima installare/buildare/distribuire il codice della funzionalita. Poi modificare il `dist/physics-config.json` effettivamente distribuito e ricaricare: su server statico non occorrono rebuild o riavvio server/backend.
4. Se si modifica soltanto `source/frontend/public`, occorre rebuild/deploy oppure copia del JSON nel file servito. Conservare comunque il valore permanente nel sorgente: il build successivo sovrascrive `dist`.
5. Configurare server/proxy/CDN per rispettare `Cache-Control: no-store` sul file. Controllare in Network la risposta e leggere in console `window.__ROUTE_SETTER_SCENE__.collisionTolerancesMm`, normalmente `{ wall: 5, holds: 1 }`. Lo snapshot e diagnostico, non un controllo live; `lastPoseDiagnostic.toleranceMeters` e in metri e riguarda il contatto governante.

## Limiti

`5 mm` e il default raccomandato dalle misure, non una correzione di tutto il rumore o delle imperfezioni fotografiche/fotogrammetriche. La griglia non e interamente accettata neppure a `10 mm`; non si garantisce l'aggancio su tutte le superfici. Aumentare la tolleranza ammette maggiore penetrazione parete, non corregge la geometria o la precisione Rapier.

Restano sottostima della profondita presso giunzioni interne dei triangoli in Rapier `0.12.0`, contenimento completo in TriMesh chiuso senza intersezione superficiale e limiti delle query da contatto iniziale. Nessuna certificazione generale di geometrie degeneri o volumi solidi. Nessuna nuova certificazione prestazionale: il precedente fallimento headless SwiftShader resta storico e non viene convertito in pass. Backend/catalogo e gestione globale errori restano fuori perimetro.
