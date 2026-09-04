# Fase 10 - Test completo e quality gates completati

## 1. Stato

La FASE 10 e completata. La suite automatica e stata consolidata con:

- workflow GitHub Actions fail-on-test-failure;
- restore npm e NuGet vincolati ai lockfile;
- report JUnit per Vitest;
- report JUnit e HTML per Playwright in CI;
- report TRX per xUnit;
- controllo automatico della tracciabilita requisito-test;
- completamento degli scenari fisici obbligatori;
- verifiche E2E piu forti per il drag transazionale 9UX.

La FASE 11 e il relativo benchmark di 60 secondi con 40 hold restano fuori ambito.

## 2. File modificati

### CI e quality gate

- `.github/workflows/ci.yml`
- `.gitignore`
- `source/frontend/package.json`
- `source/frontend/playwright.config.ts`
- `source/scripts/check-test-traceability.mjs`
- `source/test-traceability.json`

### Test e diagnostica

- `source/frontend/tests/physics/setup.smoke.test.ts`
- `source/frontend/tests/e2e/selection-input.spec.ts`
- `source/frontend/src/scene/wallScene.ts`

### Tracciabilita

- `sdd-specs/04-tracciabilita.md`
- `phases-outcome/Phase_10_implementation_done.md`

## 3. Requisiti coperti

| Requisito | Evidenza |
|---|---|
| `REQ-TST-001` | Workflow `.github/workflows/ci.yml`; ogni restore, build, test e check mantiene exit code bloccante. |
| `REQ-TST-002` | Suite xUnit backend, 33 test, report TRX. |
| `REQ-TST-003` | Test hull mancante-generato, coerente-riusato e GLB modificato-rigenerato. |
| `REQ-TST-004` | Test integrazione REST per health, asset, manifest, logging ed error contract. |
| `REQ-TST-005` | Suite Playwright completa sui flussi principali, 26 test, report JUnit/HTML in CI. |
| `REQ-TST-006` | Suite fisica headless ampliata a 16 test, inclusi rimozione che libera spazio e regressione collisioni. |
| `REQ-TST-007` | Scenario fisico ricreato dieci volte con risultato identico, oltre ai test deterministici di spawn e targeting. |
| `REQ-TST-009` | `npm ci`, `dotnet restore --locked-mode` e verifica diff dei tre lockfile nel workflow. |
| `REQ-TST-010` | Unit ed E2E 9UX, inclusi invarianti completi durante pointermove, assenza richieste asset, singola validazione endpoint e cleanup pointercancel. |

`REQ-TST-008` resta escluso dal gate normativo in quanto requisito storico della fase 8, come indicato dalla specifica.

## 4. Implementazione quality gate

Il workflow usa due job indipendenti:

- `backend`: SDK da `global.json`, restore locked, build Release, xUnit con TRX, verifica lockfile NuGet;
- `frontend`: Node `22.18.0`, `npm ci`, Chromium Playwright, build, tracciabilita, Vitest con JUnit, Playwright con JUnit/HTML, verifica lockfile npm.

Gli artifact dei test vengono caricati anche in caso di fallimento tramite `if: always()`. Le directory generate `test-results/` e `playwright-report/` sono escluse dal versionamento.

Il comando frontend aggregato e:

```powershell
npm run test:ci
```

Esegue in sequenza build, tracciabilita, unit test con report ed E2E con reporter configurato dall'ambiente CI.

## 5. Controllo tracciabilita

`source/scripts/check-test-traceability.mjs` verifica che:

- ogni `REQ-*` dichiarato nella specifica requisiti compaia nella matrice Markdown;
- `REQ-TST-001..007`, `REQ-TST-009` e `REQ-TST-010` abbiano evidenze esplicite;
- ogni percorso registrato in `source/test-traceability.json` esista;
- `REQ-TST-008` non venga reintrodotto nel gate normativo corrente.

Esito finale: 102 requisiti presenti nella matrice e 9 requisiti della FASE 10 collegati a evidenze esistenti.

## 6. Copertura fisica aggiunta

Sono stati aggiunti due scenari a `setup.smoke.test.ts`:

1. una posa occupata da una seconda hold risulta invalida e diventa valida dopo la rimozione del collider bloccante;
2. lo stesso mondo fisico e la stessa coppia di pose vengono ricreati dieci volte, producendo sempre gli stessi risultati `hold` e `valid`.

La suite fisica headless passa da 14 a 16 test; la suite Vitest complessiva passa da 44 a 46 test.

## 7. Copertura 9UX aggiunta

Durante il drag movimento vengono ora verificati automaticamente:

- nessuna richiesta `.png`, `.glb` o `/model` per creare la shadow;
- posizione e rotazione della hold reale immutate durante `pointermove`;
- contact point, attachment normal e twist immutati durante `pointermove`;
- conteggio invariato di rigid body e collider;
- nessuna validazione della posa durante `pointermove`;
- esattamente una validazione endpoint al `pointerup`;
- cleanup di preview e ripristino camera su `pointercancel` senza commit.

Il contatore `poseValidationCount` e esposto esclusivamente nello snapshot diagnostico gia destinato ai test E2E e non modifica il comportamento runtime.

## 8. Storico esecuzioni

1. Audit iniziale: rilevate assenza di CI versionata, reporting, check tracciabilita e due scenari fisici espliciti.
2. Primo gate tracciabilita: superato, 102 requisiti nella matrice e 9 requisiti FASE 10 con evidenze.
3. Primo build dopo reporter CI: fallito per inferenza TypeScript `readonly` su `ReporterDescription[]`.
4. Correzione tipo reporter Playwright: build superata.
5. Test fisici mirati: 16/16 superati.
6. Vitest con report JUnit: 46/46 superati su 9 file.
7. Primo E2E `pointercancel`: fallito per uso di eventi sintetici senza pointer capture browser reale.
8. Correzione test con drag Playwright reale e `pointercancel` sul pointer catturato: 1/1 superato.
9. `npm ci`: superato senza modifica di `package-lock.json`.
10. Gate frontend aggregato `npm run test:ci`: superato.
11. Build frontend TypeScript/Vite: superata.
12. Vitest finale: 46/46 superati su 9 file, JUnit generato.
13. Playwright finale: 26/26 superati, JUnit e report HTML generati in modalita CI.
14. Restore NuGet locked con `ContinuousIntegrationBuild=true`: superato senza drift lockfile.
15. Build backend Release: 0 warning, 0 errori.
16. xUnit backend Release: 33/33 superati, TRX generato.
17. Verifica diff dei lockfile npm/NuGet: superata.
18. `git diff --check`: superato.

## 9. Limiti

- Il workflow e stato validato localmente con gli stessi comandi, ma l'esecuzione remota GitHub Actions richiede push del branch.
- Il runner E2E usa un solo worker per ridurre la variabilita WebGL e la contesa sulle porte.
- Il warning Vite per il bundle principale superiore a 500 kB resta noto e non blocca la fase.
- Il benchmark prestazionale normativo con 40 hold, viewport 1920x1080 e durata 60 secondi appartiene alla FASE 11.
- Le vulnerabilita npm transitive della baseline non sono state aggiornate per non modificare le versioni vincolanti fuori da una fase dedicata.

## 10. Verifica manuale

Dalla cartella `source/frontend`:

```powershell
npm ci
$env:CI = "true"
npm run test:ci
```

Dalla cartella `source`:

```powershell
$env:ContinuousIntegrationBuild = "true"
dotnet restore TheRouteSetter.sln --locked-mode
dotnet build TheRouteSetter.sln --configuration Release --no-restore
dotnet test TheRouteSetter.sln --configuration Release --no-build --no-restore --logger "trx;LogFileName=backend-tests.trx" --results-directory TestResults
```

Dalla radice Git:

```powershell
git diff --exit-code -- gpt-5.6-sol/the-route-setter-beta/source/frontend/package-lock.json gpt-5.6-sol/the-route-setter-beta/source/backend/src/TheRouteSetter.Api/packages.lock.json gpt-5.6-sol/the-route-setter-beta/source/backend/tests/TheRouteSetter.Api.Tests/packages.lock.json
git diff --check
```

Risultato atteso: 46 Vitest, 26 Playwright, 33 xUnit, tracciabilita completa e nessun drift dei lockfile.
