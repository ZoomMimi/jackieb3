---
phase: 04
slug: data-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Node.js script + Astro build validation |
| **Config file** | none |
| **Quick run command** | `node scripts/04-generate-stubs.mjs --dry-run` |
| **Full suite command** | `node scripts/04-generate-stubs.mjs && npm run build` |
| **Estimated runtime** | Script: ~5s; `npm run build` on 325+ MDX files: ~90–180s |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/04-generate-stubs.mjs --dry-run` (if dry-run flag exists) or inspect output counts
- **After every plan wave:** Run `npm run build` — must exit 0 with zero schema errors
- **Before `/gsd:verify-work`:** Full suite (script run + build) must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 04-01-01 | 01 | 1 | DATA-02, DATA-03 | manual | Inspect output JSON count and sample entry | ⬜ pending |
| 04-01-02 | 01 | 1 | DATA-05 | manual | `grep -l "^miles:" src/content/blog/great-loop/*.mdx \| wc -l` → ≥45 | ⬜ pending |
| 04-01-03 | 01 | 1 | DATA-01, DATA-03 | manual | `ls src/content/blog/great-loop/ \| wc -l` → ≥(72 + expected stubs) | ⬜ pending |
| 04-01-04 | 01 | 1 | all | build | `npm run build` → exit 0, zero Zod errors | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing posts not overwritten | DATA-05 | No automated test harness | Verify `git diff` shows only frontmatter additions (miles/hours), not content changes |
| Stubs have correct Day N titles | DATA-01 | Requires date math verification | Spot-check 3 stubs: Day 1 = April 22 2022, count matches |
| No slug collisions with existing posts | DATA-01 | Requires filename inspection | `ls src/content/blog/great-loop/ \| sort \| uniq -d` → empty |
| Photos in Gallery are real files | DATA-02 | Requires local file path check | Spot-check 2 stubs: verify `file:///` paths exist on disk |
| excerpt field present on all stubs | Schema | Zod required field | `npm run build` → zero "required" errors |

---

## Validation Sign-Off

- [ ] All tasks have verify steps or manual checks documented
- [ ] Existing posts verified unmodified (content-only; only frontmatter additions)
- [ ] `npm run build` exits 0 after script run
- [ ] Stub count logged by script matches expected (~253)
- [ ] Backfill count logged by script matches expected (~45)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
