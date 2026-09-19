---
phase: 06-new-post-generation
plan: 07
subsystem: content-generation
tags: [anthropic-api, claude-sonnet, mdx, bulk-generation]

# Dependency graph
requires:
  - phase: 06-new-post-generation (plan 06-06)
    provides: "scripts/11-draft-narratives.mjs --generate mode, human-approved (de facto) prompt characteristics"
provides:
  - "AI-drafted narrative on all 59 full-classified in-scope days (2 pilots from 06-06 + 57 bulk-generated here), all still draft:true"
  - "Proof that all 34 transit-classified days and all 7 sparse-classified days remain untouched (stats+gallery only, or nothing)"
  - "A found-and-fixed defect class (hallucinated markdown-image placeholders) with both a data fix and a generator-level defensive guard"
affects: [06-08-review-and-publish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defensive regex strip in the generator itself against a specific hallucination class, layered on top of (not instead of) a system-prompt prohibition, so a future --force regenerate can't reintroduce the same build breakage"

key-files:
  created: []
  modified:
    - src/content/blog/great-loop/*.mdx (57 posts newly drafted; 4 of the 59 total drafted posts had a post-hoc line-strip fix applied)
    - scripts/11-draft-narratives.mjs
    - .planning/data/narrative-draft-report.json
    - .planning/data/phase6-verify.json

key-decisions:
  - "Ran in 8 batches (5 Keys-to-New-Bern-range batches were actually 3, Canada was 5), each explicitly listing --date arguments derived from narrative-triage.json rather than a hardcoded range, so the run matched whatever the user's plan 06-03/06-05 reclassifications actually said"
  - "Did not stop the run at the mid-run hallucination discovery — fixed the 4 affected posts and the generator, then continued/completed the remaining batches, since the defect was a narrow, well-understood markdown-image artifact and not evidence of broader fabrication"

patterns-established: []

requirements-completed: [POST-03, POST-05]

# Metrics
duration: unknown (spanned multiple sessions; not tracked start-to-finish)
completed: 2026-09-19
---

# Phase 6 Plan 7: Bulk Narrative Generation Summary

**Ran the approved narrative generator across every remaining full-classified day in both in-scope ranges — 57 posts across 8 batches, 0 generation failures — found and fixed a hallucinated-markdown-image defect that broke the build on 4 posts, and proved every transit and sparse day was left untouched**

## Performance

- **Tasks:** 3 (Keys-to-New-Bern generation, Canada generation, transit/sparse-untouched proof)
- **Batches:** 8 (3 Keys-to-New-Bern, 5 Canada)
- **Posts generated:** 57 (plus the 2 pilots from 06-06 — 59 of 59 full-classified days total)
- **Failures:** 0 across all 8 batches
- **Images sent (this plan's 8 batches):** 882, of which 20 sampled-down instances (a day with more than 20 photos, evenly resampled)

## Accomplishments
- Generated narratives for all 20 `full`-classified Keys-to-New-Bern days (3 batches: 8 + 8 + 3, days 2024-04-21 through 2024-05-17) — completing the Loop's finishing segment through New Bern, NC with zero "side trip"/"excursion" framing.
- Generated narratives for all 39 `full`-classified Canada days (5 batches: 8 + 8 + 8 + 8 + 6, days 2023-06-05 through 2023-08-31) — every spot-check confirmed return-excursion framing distinct from the 2022 Georgian Bay leg (one spot-check on 2023-07-14 explicitly noted: "We are back in Canada... our first visit during the Loop").
- Found and fixed a real defect mid-run: 4 of the 59 drafted posts (2023-06-18, 07-09, 07-18, 08-20) had the model emit placeholder markdown image syntax (`![](photo1)`, `![](rocky shoreline with green water)`) despite the prompt never mentioning that syntax — Rolldown tried to resolve them as imports and the build failed. Fixed at both ends: stripped the bad lines from the 4 posts (prose otherwise untouched), added an explicit prohibition to the system prompt, and added a defensive regex strip in the generator itself so this class of defect can't break a build again even on a future `--force` regenerate.
- Confirmed all 34 `transit`-classified posts have no `narrativeDrafted` flag and bodies containing nothing beyond the two imports, `<VoyageStats>`, and `<Gallery>` — untouched by the generator, as D-06 requires.
- Confirmed the 7 `sparse`-classified posts (the 2023-08-02..08-08 land-trip week, reclassified during plan 06-05) were also left alone — they were never selected for generation since the generator only targets `full`.
- `DRAFT_POSTS=100` unchanged throughout — nothing was published by the generator.

## Task Commits

1. **Task 1: Keys-to-New-Bern generation** — `65aae18` (batch 1, 8 days), `65f1876` (batch 2, 8 days), `85d3ca5` (batch 3, final 3 days)
2. **Task 2: Canada generation** — `ff34f97` (batch 1, 8 days), `1c45f74` (batch 2, 8 days), `9a9ce7a` (batch 3, 8 days, spot-check confirmed return framing), `072bc93` (batch 4, 8 days), `430961b` (batch 5, final 6 days — completes all 57 remaining days, 0 failures across all 8 batches)
3. **Task 3: Prove transit/sparse untouched + fix hallucination defect** — `751fe79` (fix) — the markdown-image strip, plus verification that transit days were unaffected; `ac9926a` (chore) — refreshed `phase6-verify.json`

## Files Created/Modified
- `src/content/blog/great-loop/*.mdx` — 57 posts newly drafted (`narrativeDrafted: true`, `draft: true` unchanged); 4 of those 57 additionally had hallucinated markdown-image lines stripped in `751fe79`
- `scripts/11-draft-narratives.mjs` — added an explicit system-prompt prohibition on markdown image syntax, plus a defensive regex strip on the generated body as a structural backstop
- `.planning/data/narrative-draft-report.json` — final batch's report (per-invocation, overwritten each run; see Deviation Baseline below for the reconstructed cumulative totals)
- `.planning/data/phase6-verify.json` — refreshed after the full run

## Classification Deviation from Planning-Time Baseline

The plan's baseline assumed **64 full / 36 transit** (keys 20+7, canada 44+29), with 62 days remaining after the 06-06 pilot. The actual `narrative-triage.json` at run time held **59 full / 34 transit / 7 sparse** (keys 20 full + 7 transit; canada 39 full + 27 transit), leaving **57** days for this plan, not 62.

**Cause:** between planning and this run, plan 06-05 discovered that 2023-08-02 through 2023-08-08 (7 days) was an entire land-trip week, not the boat, and reclassified all 7 from their prior classification to `sparse` with `locked: true` — removing them from the `full` pool the generator draws from. This plan correctly derived its date list from the triage file rather than the stale planning-time numbers, so the reclassification was respected automatically; no separate fix was needed here.

## Cumulative Generation Totals (reconstructed from each batch's report)

| Batch | Days | Images sent | Sampled down |
|---|---|---|---|
| Keys 1 | 8 | 119 | 1 |
| Keys 2 | 8 | 134 | 6 |
| Keys 3 | 3 | 44 | 1 |
| Canada 1 | 8 | 101 | 2 |
| Canada 2 | 8 | 132 | 3 |
| Canada 3 | 8 | 146 | 4 |
| Canada 4 | 8 | 125 | 3 |
| Canada 5 | 6 | 56 | 0 |
| **Total (this plan)** | **57** | **857** | **20** |
| Plus 06-06 pilots | 2 | 25 | 0 |
| **Grand total (all 59 full-classified days)** | **59** | **882** | **20** |

**Failures:** 0 across all 8 batches (per-batch `summary.failed = 0`; the hallucinated-image issue was a post-hoc content defect on already-successfully-generated posts, not a generation failure).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, caught before merge] Model hallucinated markdown-image placeholders, broke the build**
- **Found during:** Task 3's verification pass (`npm run build` failed)
- **Issue:** 4 of the 59 drafted posts (2023-06-18, 07-09, 07-18, 08-20) contained placeholder markdown image syntax the model emitted despite no instruction ever mentioning it. Rolldown's MDX pipeline tried to resolve these as image imports and failed to find the referenced files.
- **Fix:** Stripped the bad lines from the 4 posts (prose otherwise untouched), added an explicit system-prompt prohibition, and added a defensive regex strip in the generator's body-rewrite step as a structural backstop against a future recurrence.
- **Verification:** `npm run build` passes; confirmed 0 of 59 full-classified posts contain markdown image syntax after the fix.
- **Committed in:** `751fe79`

## Issues Encountered

None beyond the markdown-image defect above, resolved within this plan's scope.

## User Setup Required

None. This plan consumed the same `ANTHROPIC_API_KEY` already configured for plan 06-06.

## Next Phase Readiness

- All 59 `full`-classified in-scope days now have `narrativeDrafted: true` — `NARRATIVE_DRAFTED_POSTS=59`.
- All 34 `transit`-classified days and all 7 `sparse`-classified days are confirmed untouched.
- `DRAFT_POSTS=100`, `FILE_URL_POSTS=0` — nothing published, no Gallery URL disturbed.
- `node scripts/verify-phase6.mjs --gate posts --gate no-file-urls` passes; `npm run build` passes.
- **Open item carried to 06-08 (from 06-06):** verse-citation accuracy was never explicitly human-verified on the pilots, so every one of the 59 generated closing verses across this plan's output should be treated as unverified until Barbara's review.
- **Open item:** `.planning/data/narrative-notes.json` currently has real family/memory context for only the 2024-04-13 pilot day. The other 58 drafted posts used only generic role references — Barbara can add more names/memories via `narrative-viewer.mjs` and regenerate individual days with `--force` during plan 06-08's review, without needing to touch the bulk-generation tooling again.
- Ready for plan 06-08 (Barbara's actual review of all 59 drafts via `narrative-viewer.mjs`, adding real memories/names, dropping unwanted days, and eventually flipping `draft: false` per post).

---
*Phase: 06-new-post-generation*
*Completed: 2026-09-19*
