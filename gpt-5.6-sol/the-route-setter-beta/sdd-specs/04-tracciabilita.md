# Tracciabilita requisiti

| Requisito | Design | Test principale |
|---|---|---|
| REQ-ARC-001..004 | 02 §1, §2 | Integration API + architecture checks |
| REQ-ARC-005..008 | 02 §1, §4, §6 | E2E reload/no persistence + network assertions |
| REQ-MOD-001..004 | 02 §3, §4 | Unit discovery + integration manifest |
| REQ-MOD-005 | 02 § Convenzione spaziale degli asset | E2E orientamento iniziale parete |
| REQ-MOD-006 | 02 § Convenzione spaziale degli asset, §7.4 | Asset contract + fixture parete connessa multi-superficie |
| REQ-CAT-001..007 | 02 §4, §8 | E2E catalog/use/remove/details |
| REQ-SCN-001..004 | 02 §1, §6, §8 | E2E scena e selezione |
| REQ-SCN-005 | 02 § Spawn iniziale pre-snap, §7.1 | Unit griglia deterministica + E2E spawn multiplo senza compenetrazione |
| REQ-FIS-001..005, REQ-FIS-008..009, REQ-FIS-012..013 | 02 §6, §8 | Physics suite headless |
| REQ-FIS-006..007, REQ-FIS-010..011 | 02 §7.1, §7.2, §7.4, §8 | Physics headless + E2E snap/movimento |
| REQ-FIS-014 | 02 §7 | Snap/degenerate tests dedicati |
| REQ-FIS-015 | 02 §8, § Traslazione normale e stato di aggancio | Physics headless + E2E avanti/indietro |
| REQ-FIS-016 | 02 §7.4 | Physics headless transizione facce contigue + E2E pannelli inclinati |
| REQ-FIS-017 | 02 §7.4 | Test spigolo convesso, diedro concavo e pose intermedie |
| REQ-FIS-018 | 02 §7.5 | Test arresto al termine del supporto; retro esplicitamente escluso dai test obbligatori |
| REQ-FIS-019 | 02 §7.6 | Test tolleranze, normali finite, no oscillazione e indipendenza frame rate |
| REQ-HUL-001..006 | 02 §5 | Hull tests xUnit + integration |
| REQ-HUL-007 | 02 §5 | Build guard + test suite hull |
| REQ-UI-001..004 | 02 §8 | E2E UI/input |
| REQ-IMG-001..004 | 02 §9 | E2E equivalenza vista corrente + export JPG |
| REQ-PRF-001..006 | 02 §11 | Benchmark scenario standard |
| REQ-ERR-001..005 | 02 §10 | Error tests backend/frontend |
| REQ-LOG-001..007 | 02 §10 | Logging structure/sanitization/rotation tests |
| REQ-TST-001..008 | 03 FASE 10 | CI suite |
| REQ-TST-009 | 02 §12, 03 FASE 0/10 | CI dependency lock check |
| REQ-TST-010 | 02 §7.4..7.6, 03 FASE 9A/10 | Fixture multi-superficie + E2E modello reale |
| REQ-DEP-001..003 | 02 §12 | Restore/build deterministico in CI |
| REQ-DEP-004 | 02 §12, 03 FASE 0 | Dependency baseline verification |
| REQ-DOC-001..005 | 03 FASE 12 | Document verification checklist |

Regola: ogni nuova modifica deve aggiornare questa matrice quando impatta requisiti o test.
