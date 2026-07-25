---
phase: 6
slug: new-post-generation
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-25
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — static-site content pipeline, no unit/integration test suite. Astro's Zod content-collection schema (`src/content.config.ts`) validates every MDX file's frontmatter at build time; this is the project's de facto content-correctness check. |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~10-30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build` + a grep/script-based `draft: true` count scoped to the two in-scope date ranges (2024-04-13→2024-05-17, 2023-06-05→2023-08-31) — a blanket repo-wide grep would false-positive against the ~187 explicitly out-of-scope stubs (D-05)
- **Before `/gsd:verify-work`:** Full build must be green, zero `draft: true` in the two in-scope ranges, zero `file://` URLs remaining in in-scope posts' Gallery arrays
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Plan | Wave | Task | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 06-01 | 1 | T1 deps/env/schema contracts | POST-01/02 | T-06-01, T-06-SC | .env gitignored, audited package only | build+assert | `npm run build` + package/schema assertions | ⬜ pending |
| 06-01 | 1 | T2 verify-phase6.mjs | POST-01/02/03 | — | N/A | script | `node scripts/verify-phase6.mjs` counters + `--gate` exit codes | ⬜ pending |
| 06-01 | 1 | T3 40 missing stubs | POST-01/02 | T-06-02 | N/A | script+build | `--gate posts` + `npm run build` | ⬜ pending |
| 06-02 | 2 | T1 10-upload-r2.mjs | POST-02 | T-06-01/03/05 | env-only creds, per-UUID export, execFileSync array args | dry-run | `node scripts/10-upload-r2.mjs --dry-run` | ⬜ pending |
| 06-02 | 2 | T2 R2 provisioning (human) | POST-02 | T-06-04 | bucket-scoped Object Read & Write token | smoke test | PUT + `curl` HTTP 200 | ⬜ pending |
| 06-03 | 2 | T1 triage classifier | POST-02/03 | T-06-09 | no API key in triage path | script | `--triage` TRIAGE_* counters + JSON shape assert | ⬜ pending |
| 06-03 | 2 | T2 triage decision (human) | POST-03 | T-06-08 | locked classifications survive re-run | script | re-run `--triage`, compare counts | ⬜ pending |
| 06-04 | 3 | T1 PREVIEW_DRAFTS gate | POST-03 | T-06-10 | default-off, never in netlify.toml | build count | `npm run build` emits exactly 72 pages | ⬜ pending |
| 06-04 | 3 | T2 R2 pilot (2 days) | POST-02 | T-06-11 | all-or-nothing commit | script+curl | zero `file://`, all URLs HTTP 200, R2_UPLOADED_POSTS=2 | ⬜ pending |
| 06-04 | 3 | T3 render verify (human) | POST-02/03 | T-06-03 | human confirms photos belong to the day | manual+build | `npm run build` + R2_UPLOADED_POSTS=2 | ⬜ pending |
| 06-05 | 4 | T1 Keys range upload | POST-02 | T-06-03/11/12 | per-UUID scope, byte budget tracked | script+build | 27 posts flagged, zero `file://` | ⬜ pending |
| 06-05 | 4 | T2 Canada range upload | POST-02 | T-06-03/11/12 | same | script+build | R2_UPLOADED_POSTS=100 | ⬜ pending |
| 06-05 | 4 | T3 no-dead-URL gate | POST-02 | T-06-11 | same | gate | `--gate posts --gate no-file-urls` exit 0 | ⬜ pending |
| 06-06 | 5 | T1 --generate implementation | POST-03/05 | T-06-13/14/15 | lazy key guard, never sets draft, refuses published posts | dry-run | `--generate --dry-run` framing + image-list asserts | ⬜ pending |
| 06-06 | 5 | T2 two pilot narratives | POST-03/05 | T-06-17 | Gallery/VoyageStats byte-identical | script+build | git-show byte comparison, NARRATIVE_DRAFTED_POSTS=2 | ⬜ pending |
| 06-06 | 5 | T3 voice sign-off (human) | POST-03 | T-06-14 | human judges fabrication + verse accuracy | manual+build | DRAFT_POSTS=100 unchanged | ⬜ pending |
| 06-07 | 6 | T1 Keys narratives | POST-05 | T-06-14/15 | no --force, no draft flip | script+build | all full days flagged, no side-trip framing | ⬜ pending |
| 06-07 | 6 | T2 Canada narratives | POST-03 | T-06-14/15 | same | script+build | all full days flagged, draft:true retained | ⬜ pending |
| 06-07 | 6 | T3 transit-days-untouched gate | POST-03 | T-06-17 | Gallery URLs undisturbed | gate | transit body assert + FILE_URL_POSTS=0 | ⬜ pending |
| 06-08 | 7 | T1 review queue | POST-03 | — | N/A | script | checkbox count == triage day count | ⬜ pending |
| 06-08 | 7 | T2 Barbara review (human) | POST-03 | T-06-14/03 | human reviews every post before publish | gate | `--gate no-drafts` exit 0 | ⬜ pending |
| 06-08 | 7 | T3 final verify + descope flags | POST-01/02/03/05 | T-06-10/18 | production build emits 172 pages, no draft leak | gate+build | all three gates + `dist/blog` page count | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**POST-04:** intentionally unaddressed this phase (06-CONTEXT.md D-05). Flagged as DESCOPED in REQUIREMENTS.md by plan 06-08 Task 3; no verification row exists because no work is planned for it.

---

## Wave 0 Requirements

- [x] Scoped verification script counting `draft: true` posts within exactly the two in-scope date ranges — delivered as `scripts/verify-phase6.mjs` in plan 06-01 Task 2 (a blanket repo-wide grep would false-positive against the ~187 out-of-scope stubs per D-05)
- [x] Verification that no `file://` URLs remain in in-scope posts' Gallery arrays — delivered by the same script's `FILE_URL_POSTS` counter and `--gate no-file-urls`

Both Wave 0 gaps are closed by plan 06-01, the sole wave-1 plan; every later plan's automated verification depends on it.

*No test framework install needed — Astro's built-in Zod schema validation plus `scripts/verify-phase6.mjs` cover this phase's verification surface.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Narrative reads as authentic first-person voice, no AI artifact text visible | POST-03, POST-05 | Voice/quality judgment can't be automated | Barbara reads each full-narrative draft in place, edits directly in MDX, flips `draft: true` → `false` when satisfied |
| Voyage index has no unexplained date gaps > 1 day in the two in-scope ranges | Phase success criteria | Requires visual/contextual judgment of what counts as "explained" | Visual check of voyage index page after final publication, cross-referenced against the two in-scope date ranges |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-25 during /gsd:plan-phase 6
