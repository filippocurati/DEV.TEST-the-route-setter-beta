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
| REQ-FIS-001..005 | 02 §6 | Physics suite headless |
| REQ-FIS-006..007 | 02 §7.3, §7.4 | E2E aggancio diretto + sgancio progressivo |
| REQ-FIS-008..010 | 02 §7.5..7.9, §8 | Unit click/drag math + E2E gizmo e shadow |
| REQ-FIS-011..014 | 02 §6, §7.2, §7.3, §7.7 | Physics headless + targeting tests |
| REQ-FIS-015 | 02 §7.5..7.6 | Physics surface-lock + E2E shadow aderente e blocco cambio inclinazione |
| REQ-HUL-001..006 | 02 §5 | Hull tests xUnit + integration |
| REQ-HUL-007 | 02 §5 | Build guard + test suite hull |
| REQ-UI-001..004 | 02 §8 | E2E UI, accessibilita ed eliminazione shortcut legacy |
| REQ-UX-001..002 | 02 § Stato fisico e modalita, §7.6..7.8, §8.1..8.2 | E2E popup, macchina a stati e sessione drag |
| REQ-UX-003..005 | 02 §7.1..7.3 | Unit proiezione ellisse/targeting/clustering + E2E aggancio |
| REQ-UX-006..009 | 02 §7.6..7.9, §8.3..8.5 | Unit pointer/preview math + E2E shadow mouse desktop |
| REQ-UX-010 | 02 §8.2 | Unit result contract + E2E feedback |
| REQ-IMG-001..004 | 02 §9 | E2E equivalenza vista corrente + esclusione shadow/overlay + export JPG |
| REQ-PRF-001..006 | 02 §11 | Benchmark scena + preview drag + latenza commit endpoint |
| REQ-ERR-001..005 | 02 §10 | Error tests backend/frontend |
| REQ-LOG-001..007 | 02 §10 | Logging structure/sanitization/rotation tests |
| REQ-TST-001..007 | 03 FASE 10 | CI suite normativa attiva |
| REQ-TST-008 | 03 FASE 8 congelata | Test storici snap automatico, sostituiti dalla FASE 9UX |
| REQ-TST-009 | 02 §12, 03 FASE 0/10 | CI dependency lock check |
| REQ-TST-010 | 02 §7..8, 03 FASE 9UX/10 | Unit UX + shadow runtime + E2E drag transazionale completo |
| DEC-011..019 | 02 §7.1, §7.6..7.9, §8.1..8.4, §9, 03 FASE 9UX | Test report 9UX-bis: report preservato, shadow runtime, endpoint-only, drag libero/vincolato, target orientato, verso rotazione, camera congelata ed export disabilitato |
| REQ-DEP-001..003 | 02 §12 | Restore/build deterministico in CI |
| REQ-DEP-004 | 02 §12, 03 FASE 0 | Dependency baseline verification |
| REQ-DOC-001..005 | 03 FASE 12 | Document verification checklist |

Regola: ogni nuova modifica deve aggiornare questa matrice quando impatta requisiti o test.
