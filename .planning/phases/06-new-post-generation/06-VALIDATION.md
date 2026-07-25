---
phase: 6
slug: new-post-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-* | 01 | 0 | POST-01 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |
| 06-02-* | 02 | 1 | POST-01/02 | T-06-01 | R2 creds via env vars only | schema+script | `npm run build` + in-scope-range draft count | ❌ W0 | ⬜ pending |
| 06-03-* | 03 | 2 | POST-02/03 | — | N/A | manual | Barbara review sign-off, human gate | ✅ | ⬜ pending |
| 06-04-* | 04 | 3 | POST-03/05 | — | N/A | build+script | `npm run build` + zero `draft: true` in-scope + zero `file://` in Gallery arrays | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] A scoped verification script/one-liner counting `draft: true` posts within exactly the two in-scope date ranges (not a blanket repo-wide grep, which would false-positive against the ~187 out-of-scope stubs per D-05)
- [ ] A verification step confirming no `file://` URLs remain in any of the ~101 in-scope posts' Gallery arrays after the R2 upload script runs (concrete symptom if the R2 rewrite step is skipped or fails silently)

*No test framework install needed — Astro's built-in Zod schema validation plus these two targeted scripts cover this phase's verification surface.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Narrative reads as authentic first-person voice, no AI artifact text visible | POST-03, POST-05 | Voice/quality judgment can't be automated | Barbara reads each full-narrative draft in place, edits directly in MDX, flips `draft: true` → `false` when satisfied |
| Voyage index has no unexplained date gaps > 1 day in the two in-scope ranges | Phase success criteria | Requires visual/contextual judgment of what counts as "explained" | Visual check of voyage index page after final publication, cross-referenced against the two in-scope date ranges |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
