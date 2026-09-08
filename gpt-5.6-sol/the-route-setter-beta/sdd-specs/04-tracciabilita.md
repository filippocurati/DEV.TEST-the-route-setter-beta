# Tracciabilita requisiti

| Requisito | Design | Test principale |
|---|---|---|
| REQ-ARC-001..004 | 02 §1, §2 | Integration API + architecture checks |
| REQ-ARC-005..008 | 02 §1, §4, §6 | E2E reload/no persistence + network assertions |
| REQ-MOD-001..004 | 02 §3, §4 | Unit discovery + integration manifest |
| REQ-MOD-005 | 02 § Convenzione spaziale degli asset | E2E orientamento iniziale parete |
| REQ-CAT-001..007 | 02 §4, §8 | E2E catalog/use/remove/details |
| REQ-SCN-001..004 | 02 §1, §6, §8 | E2E scena e selezione |
| REQ-SCN-005 | 02 § Spawn iniziale detached | Unit griglia deterministica + E2E spawn multiplo senza compenetrazione |
| REQ-FIS-001..005 | 02 §6, §7.9 | Physics suite headless; `physics/poseValidation.test.ts` per continuita click fra endpoint liberi e rotazione |
| REQ-FIS-006..007 | 02 §7.3, §7.4 | E2E aggancio diretto + sgancio progressivo |
| REQ-FIS-008..010 | 02 §7.5..7.9, §8 | Unit click/drag math + E2E gizmo e shadow |
| REQ-FIS-011..014 | 02 §6, §7.2, §7.3, §7.7, §7.9 | `config/physicsConfig.test.ts`, `physics/poseValidation.test.ts` (soglie separate, minimo per contatto, endpoint/intervalli, violazione accertata prioritaria e diagnostica coerente), `physics/realWall.test.ts` (asset invariati, baseline e passi/twist reali), `e2e/physics-config.spec.ts` (bootstrap/reload/fallimenti, suite finale 43/43) + targeting tests; DEC-026 supera solo la tolleranza DEC-025, limiti numerici aperti |
| REQ-FIS-015 | 02 §7.5..7.6 | Physics surface-lock dei soli click + E2E shadow globale fra pannelli, esclusa dal lock |
| REQ-HUL-001..006 | 02 §5 | Hull tests xUnit + integration |
| REQ-HUL-007 | 02 §5 | Build guard + test suite hull |
| REQ-UI-001..004 | 02 §8 | E2E UI, accessibilita ed eliminazione shortcut legacy |
| REQ-UX-001..002 | 02 § Stato fisico e modalita, §7.6..7.8, §8.1..8.2 | E2E popup, macchina a stati e sessione drag |
| REQ-UX-003..005 | 02 §7.1..7.3 | Unit footprint/targeting/clustering, coerenza punto-normale + E2E shadow aggancio e raccordo laterale |
| REQ-UX-006..009 | 02 §7.6..7.9, §8.3..8.5 | Unit pointer/preview math + E2E shadow mouse desktop |
| REQ-UX-010 | 02 §7.3, §8.2 | Unit result contract, `physics/poseValidation.test.ts` (tolleranza contatto governante e priorita violazione accertata) + E2E `selection-input.spec.ts` e `physics-config.spec.ts`: reason, rollback, snapshot soglie; E2E DEC-025 storico 31/31, DEC-026 finale 43/43 |
| REQ-IMG-001..004 | 02 §9 | E2E equivalenza vista corrente + esclusione shadow/overlay + export JPG |
| REQ-PRF-001..006 | 02 §11, 03 FASE 11 | `tests/performance/phase11.spec.ts` + `Phase_11_performance_results.json`: 40 hold, 1920x1080, 60 s, FPS, long task, heartbeat e latenza endpoint |
| REQ-ERR-001..005 | 02 §7.3, §10 | Error tests backend/frontend; `config/physicsConfig.test.ts` + `e2e/physics-config.spec.ts` per errore config gestito e avvio bloccato (suite E2E finale 43/43), non completamento gestione globale errori |
| REQ-LOG-001..007 | 02 §10 | Logging structure/sanitization/rotation tests |
| REQ-TST-001 | 03 FASE 10 | `.github/workflows/ci.yml`: ogni comando mantiene il proprio exit code bloccante |
| REQ-TST-002 | 03 FASE 10 | xUnit `TheRouteSetter.Api.Tests` + report TRX CI |
| REQ-TST-003 | 03 FASE 2/10 | `ColliderProcessorTests`: generazione, riuso e rigenerazione hull |
| REQ-TST-004 | 03 FASE 3/10 | `ApiSmokeTests`, `AssetApiIntegrationTests`, `ErrorApiIntegrationTests` |
| REQ-TST-005 | 03 FASE 10 | Playwright `tests/e2e/*.spec.ts` + report JUnit/HTML CI |
| REQ-TST-006 | 03 FASE 6/10 | Vitest `physics/setup.smoke.test.ts`, `physics/poseValidation.test.ts`, `physics/realWall.test.ts`: scenari fisici, continuita click, pavimento/pinna con contatto iniziale, incertezza, broadphase senza narrowphase sui 40 collider lontani e asset reali |
| REQ-TST-007 | 03 FASE 10 | Ripetizioni in `physics/poseValidation.test.ts` e `physics/realWall.test.ts` + test tie-break e spawn deterministici |
| REQ-TST-008 | 03 FASE 8 congelata | Test storici snap automatico, sostituiti dalla FASE 9UX |
| REQ-TST-009 | 02 §12, 03 FASE 0/10 | `npm ci`, `dotnet restore --locked-mode` e verifica diff lockfile in CI |
| REQ-TST-010 | 02 §7..8, 03 FASE 9UX/10 | Unit UX + E2E drag transazionale, invarianti pointermove, singola validazione endpoint e cleanup pointercancel |
| DEC-011..023 | 02 §7.1, §7.6..7.9, §8.1..8.4, §9, 03 FASE 9UX | Test report 9UX-bis: report preservato, shadow runtime per targeting/drag, endpoint-only, drag libero/vincolato, verso rotazione, camera congelata, export disabilitato, popup compatto, dettagli condivisi, Escape con deselezione e coerenza punto-normale sui raccordi |
| DEC-024..025 | 02 §7.3, §7.6, §7.9, §8.2, 03 Primo gruppo precedente | `physics/poseValidation.test.ts`, `physics/realWall.test.ts`, `e2e/selection-input.spec.ts`: drag globale, tolleranza, continuita e diagnostica; esiti storici 215/215 unit e 31/31 E2E confermati, senza certificazione generale di giunzioni interne o contenimento solido; performance SwiftShader fallita, dettagli in `docs/test-automatici.md` |
| DEC-026 | 02 §7.3, §7.5, §7.9, 03 Configurazione tolleranza corrente | `config/physicsConfig.test.ts`, `physics/poseValidation.test.ts`, `physics/realWall.test.ts`, `e2e/physics-config.spec.ts`; finali unit 331/331 in 12 file ed E2E 43/43 comunicati dall'utente; produzione dist temporanea, file reale 5 -> 3 -> 5 al reload senza rebuild; griglia separata e limiti in `docs/test-automatici.md` e `phases-outcome/Wall_tolerance_configuration_done.md` |
| REQ-DEP-001..003 | 02 §12 | Restore/build deterministico in CI |
| REQ-DEP-004 | 02 §12, 03 FASE 0 | Dependency baseline verification |
| REQ-DOC-001..005 | 03 FASE 12 | `docs/applicazione.md`, `docs/test-automatici.md`, `docs/checklist-fase-12.md` e `npm run test:docs` |

Regola: ogni nuova modifica deve aggiornare questa matrice quando impatta requisiti o test.
