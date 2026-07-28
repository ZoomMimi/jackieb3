---
phase: 06-new-post-generation
plan: 03
subsystem: data-pipeline
tags: [node, mdx, content-triage, human-in-the-loop]

# Dependency graph
requires:
  - phase: 06-01
    provides: scripts/verify-phase6.mjs's in-scope date derivation, 100/101 in-scope posts stubbed, frontmatter round-trip helper convention
provides:
  - scripts/11-draft-narratives.mjs --triage mode — deterministic full/transit/sparse classifier
  - .planning/data/narrative-triage.json — user-approved, hand-editable per-day classification (D-07 satisfied)
  - --generate mode stub (real implementation deferred to plan 06-05)
affects: [06-05-full-r2-upload, 06-06-narrative-generation, 06-07-bulk-narratives]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic photo/Nebo-richness proxy classifier gated behind a human-reviewable JSON artifact before any AI spend (D-06/D-07)"
    - "locked:true per-day flag protects manual reclassification decisions across classifier re-runs, without needing a global threshold change"

key-files:
  created:
    - scripts/11-draft-narratives.mjs
    - .planning/data/narrative-triage.json
  modified: []

key-decisions:
  - "checkpoint:decision Task 2 resolved by the actual project owner (not the agent): option 'accept-as-is' — the computed 64 full / 36 transit split is approved with zero reclassification edits"
  - "Because the classifier is fully deterministic and no day was locked, accepting as-is required no edits to narrative-triage.json at all — re-running --triage reproduces byte-identical day data (only the generated timestamp differs, which was reverted to keep the committed artifact stable)"

patterns-established:
  - "Pattern 1 from 06-RESEARCH.md/06-PATTERNS.md (date-keyed Map construction from nebo-logs.json / voyage-timeline-enriched.json, mirroring scripts/07-quality-lift.mjs) applied verbatim in the triage classifier"

requirements-completed: [POST-02, POST-03]

# Metrics
duration: 55min
completed: 2026-07-28
---

# Phase 6 Plan 3: Deterministic Narrative Triage Classifier Summary

**scripts/11-draft-narratives.mjs `--triage` mode classifying all 100 in-scope posts (64 full-narrative / 36 transit / 0 sparse) via a photo-count + Nebo-richness proxy, reviewed and approved as-is by the project owner before any Claude API spend**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-28T12:00:00Z
- **Completed:** 2026-07-28T12:55:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 new script, 1 new data artifact)

## Accomplishments
- Built `scripts/11-draft-narratives.mjs` with a working `--triage` mode: derives the 101-date in-scope set the same way `scripts/verify-phase6.mjs` does (keys of `src/data/daily-routes.json` inside the two D-06 date ranges), maps each date to its MDX stub, and classifies every post into `full` / `transit` / `sparse` using the exact D-06 thresholds (photoCount>=10, or photoCount>=5 with neboRichness>=3).
- Computed `neboRichness` as the documented 6-signal sum (routeName, weatherDeparture, weatherArrival, icwMarkers, landmarks, namedStops.arrived) summed across each day's parsed Nebo legs from `scripts/09-parse-nebo-details.mjs`'s output.
- Wrote `.planning/data/narrative-triage.json`: 100 day entries (date, slug, range, location, photoCount, videoCount, distanceNm, hasNeboLog, neboRichness, routeName, classification, classificationReason, locked), plus a `skippedDates` array documenting the one known photoCount-0 gap (2023-08-09).
- Implemented locked-entry preservation: a day with `locked: true` keeps its `classification` across re-runs while every other field is recomputed fresh — verified with a manual test (locked 2023-06-06 to `full`, re-ran `--triage`, confirmed the lock held) before reverting that test edit.
- `--generate` is a stub that prints a pointer to plan 06-05 and exits 0, doing nothing; no flags prints usage and exits 2. Zero references to any Claude API credential env var in this script, confirmed by `grep`.
- Result matched the plan's pre-verified expectation exactly: 100 in-scope posts total (64 full, 36 transit, 0 sparse); keys-to-new-bern 27 posts (20 full / 7 transit); canada-side-trip 73 posts (44 full / 29 transit).
- Presented the complete 100-day triage list (grouped by range and classification) plus the borderline sets (transit days with photoCount 7-9; full days solely via photoCount>=10 with neboRichness 0) to the project owner via the blocking `checkpoint:decision` gate, exactly as D-07 requires — no AI narrative or Claude API call happened before this review.
- **Decision:** the project owner selected `accept-as-is` — the computed 64/36 split stands with no reclassifications. Since the classifier is deterministic and no day was locked, "accepting as-is" required zero edits to `narrative-triage.json`; a verification re-run confirmed the file is byte-identical (aside from the `generated` timestamp, which was reverted to keep the committed artifact stable).

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the triage classifier in scripts/11-draft-narratives.mjs** - `9dba696` (feat)
2. **Task 2: Present the triage list and take reclassification decisions** - checkpoint resolved by project owner (accept-as-is); no code/data changes required beyond what Task 1 already committed

**Plan metadata:** (this commit)

## Files Created/Modified
- `scripts/11-draft-narratives.mjs` - Triage classifier (`--triage`), stubbed `--generate`, usage-on-no-flags; no Anthropic API involvement
- `.planning/data/narrative-triage.json` - 100 per-day classifications + signals + `skippedDates`, approved as-is by the project owner

## Decisions Made
- **checkpoint:decision resolution (Task 2):** Project owner approved `accept-as-is` — 64 full-narrative / 36 transit, 0 sparse. No dates were promoted or demoted. This was a genuine editorial judgment call the executing agent explicitly did not make on the owner's behalf; the full 100-day list and borderline highlights were presented and the resume signal ("approved") was given directly by the project owner via the coordinating session.
- Reverted a transient `generated`-timestamp-only diff produced by a verification re-run, so the committed `narrative-triage.json` reflects exactly the state reviewed and approved (no incidental noise in the artifact's history).

## Deviations from Plan

None - plan executed exactly as written. The checkpoint:decision gate was handled per its designed protocol: the agent presented the full list and options without guessing, and resumed only after the actual project owner's explicit decision arrived.

## Issues Encountered

None. The worktree's initial HEAD was one commit behind the expected base (`fa42632`, "docs(phase-06): update tracking after wave 1") — corrected with a safe `git reset --hard` per the worktree-branch-check protocol before any task work began; no commits were lost since the worktree branch had no commits beyond that ancestor.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `scripts/11-draft-narratives.mjs --triage` is live, deterministic, and re-run-safe; `.planning/data/narrative-triage.json` is the approved, locked-in-spirit (though no explicit locks were needed) source of truth plan 06-05 will read for narrative generation.
- 64 posts are queued for full AI-drafted narrative; 36 for stats+gallery-only treatment — this split is final per the project owner's approval and must not be re-derived or second-guessed by plan 06-05.
- `--generate` mode remains a stub; plan 06-05 implements the actual Claude API narrative drafting against the approved triage file.
- No blockers. Ready for plan 06-05 (full R2 upload) and plan 06-06 (narrative generation + voice sign-off), per the phase's wave sequencing.

---
*Phase: 06-new-post-generation*
*Completed: 2026-07-28*
