# Design tecnico
## Applicazione per tracciatura vie climbing indoor

Questo documento descrive come realizzare i requisiti di `01-specifica-requisiti.md`.

## 1. Architettura

Browser:
- three.js per rendering;
- Rapier WASM per fisica;
- UI catalogo/comandi;
- stato sessione e istanze;
- export immagine;
- client REST.

Backend ASP.NET Core Web API:
- discovery asset;
- manifest catalogo;
- serving file statici;
- generazione/invalidazione Convex Hull;
- gestione errori;
- logging Serilog JSON.

## 2. Stack vincolato

- Frontend: TypeScript + Vite.
- Backend: ASP.NET Core Web API.
- Rapier frontend: `@dimforge/rapier3d-compat`.
- Parsing GLB backend: SharpGLTF.
- Convex Hull backend: MIConvexHull.
- Logging backend: Serilog.
- Versionamento dipendenze: pinning esatto + lockfile obbligatori.

## 3. Struttura cartelle proposta

```text
/backend
  /src
    /Controllers
    /Services
      /Catalog
      /Wall
      /ConvexHull
      /Logging
    /Middleware
    /Models
  /Data
    /main-wall
    /holds
  /tests

/frontend
  /src
    /scene
    /physics
    /holds
    /catalog
    /api
    /errors
    /logging
    /export
  /tests
    /physics
    /e2e

/docs
```

## 4. API baseline (vincolante minima)

Mantenere almeno questi endpoint:
- `GET /api/wall`
- `GET /api/holds`
- `GET /api/holds/{id}/model`
- `GET /api/holds/{id}/collider`
- `POST /api/logs`

E consentito aggiungere endpoint ulteriori se necessari, senza alterare i vincoli dei requisiti.

Manifest hold: deve includere almeno id, previewUrl, modelUrl, colliderUrl e stato disponibilita collider.

## 5. Convex Hull backend

Flusso:
1. scansione cartelle `holds/Hold<number>` (es. `Hold1`, `Hold2`);
2. lettura GLB con SharpGLTF;
3. calcolo hull con MIConvexHull (.NET), indipendente da Rapier;
4. serializzazione `collider.json`:

```json
{
  "sourceHash": "sha256:...",
  "vertices": [0.0, 0.0, 0.0],
  "indices": [0, 1, 2]
}
```

5. invalidazione su hash;
6. generazione in background non bloccante;
7. hold esposte come utilizzabili quando collider pronto.

## 6. Fisica frontend

- mondo Rapier con gravita zero;
- parete: TriMesh statico client-side;
- hold: collider Convex Hull da backend;
- movimento: `KinematicCharacterController` per move-and-slide;
- no autostep/snap-to-ground.

## 7. Snap, pre-snap e degeneri (vincolante)

### 7.1 Pre-snap
- all'inserimento, hold in stato non agganciato;
- query locale verso parete per trovare contatto candidato.

### 7.2 Snap
- condizione: distanza minima <= 0.05 m;
- aggancio al punto di contatto piu vicino;
- orientamento con normale locale nel punto esatto;
- base hold aderente alla parete.

### 7.3 Degeneri
- se normale triangolo non valida: fallback su ultima normale valida;
- se assente: fallback su normale asse mondo configurata;
- contatti equivalenti: tie-break deterministico stabile;
- se nessuna posizione valida non compenetrante: annullare inserimento, messaggio utente non tecnico.

## 8. Movimento e input

- rotazione: +1/-1 grado per click + continuo a pressione;
- traslazione: +1/-1 cm per click + continuo a pressione;
- direzioni calcolate proiettando assi camera sul piano tangente;
- shortcut tastiera obbligatorie ma mappatura lasciata open guidata.

## 9. Export immagine

- camera ortografica frontale temporanea;
- UI nascosta;
- sfondo bianco;
- export JPG con lato lungo 2560 px, lato corto proporzionale, qualita 0.90;
- ripristino stato UI/camera al termine.

## 10. Error handling e logging

- middleware backend centralizzato con ErrorId;
- frontend intercetta categorie minime richieste e notifica backend quando possibile;
- Serilog JSON, livello minimo da `appsettings.json` (default `Information`), rotazione giornaliera, retention 7 giorni, sanitizzazione.

## 11. Benchmark prestazionale

Metodo vincolante:
- scena con 40 hold + parete;
- viewport 1920x1080;
- test 60 secondi con sequenza interazioni ripetibile;
- target pass: mediana FPS >= 30;
- risultato documentato nei report test/performance.

## 12. Gestione versioni dipendenze

- npm: usare versioni esatte e lockfile versionato.
- NuGet: usare versioni esatte espresse come intervalli chiusi (esempio: `[1.1.19.504]`) e lock file ripristino deterministico versionato.
- vietate versioni floating nei package applicativi.
- CI deve ripristinare da lock e fallire in caso di drift non intenzionale.

Versioni iniziali da adottare (vincolanti) come baseline:
- Frontend runtime: `three@0.161.0`, `@dimforge/rapier3d-compat@0.12.0`.
- Frontend build/tooling: `vite@5.2.0`, `typescript@5.4.5`.
- Frontend test: `vitest@1.6.0`, `@playwright/test@1.44.0`.
- Backend/runtime: `Serilog.AspNetCore@8.0.1`, `Serilog.Sinks.File@5.0.0`, `SharpGLTF.Core@1.0.0`, `MIConvexHull@1.1.19.504`.
- Backend test: `xunit@2.7.1`, `Microsoft.AspNetCore.Mvc.Testing@8.0.5`.
- Framework target: `.NET 8` LTS; SDK `8.0.424`.
- Toolchain frontend: `Node.js 22.18.0` LTS con `npm 10.9.3`.

Regola aggiornamenti:
- aggiornamenti ammessi solo tramite PR dedicata;
- obbligo di suite test completa verde prima del merge;
- aggiornamento lockfile e nota di compatibilita in documentazione tecnica.
