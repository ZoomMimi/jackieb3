---
phase: 04-data-pipeline
plan: "01"
subsystem: data-pipeline
tags: [node-esm, mdx, frontmatter, astro, great-loop, voyage-timeline]

requires:
  - phase: 03-quality-lift
    provides: enriched MDX posts with lifted:true frontmatter + voyage-timeline-enriched.json

provides:
  - scripts/04-generate-stubs.mjs — backfill + stub generation from enriched timeline
  - 45 existing MDX posts enriched with miles/hours/lat/lon frontmatter
  - 250 draft:true MDX stubs for undocumented voyage days with 10+ photos (2022-04-01 to 2024-05-17)

affects: [phase-05-route-maps, phase-06-post-generation]

tech-stack:
  added: []
  patterns:
    - "Node.js ESM script with node:fs/path/url only — no npm packages"
    - "splitFrontmatter/parseFrontmatter/serializeFrontmatter copied verbatim from 07-quality-lift.mjs"
    - "Body-preserving write-back using raw.slice(fmEnd+4) to avoid template-induced drift"
    - "Idempotency via full-fields gate (miles AND hours AND lat AND lon all present = skip)"
    - "Conflict guard: existing.has(filename) + date-prefix startsWith(day.date) before any write"
    - "Dry-run flag --dry-run guards all writeFileSync calls with WOULD prefix logging"

key-files:
  created:
    - scripts/04-generate-stubs.mjs
    - src/content/blog/great-loop/2022-04-01-day--20-new-bern-nc.mdx (first pre-departure stub)
    - src/content/blog/great-loop/2024-05-17-day-757-new-bern-nc.mdx (final day stub — last segment)
  modified:
    - src/content/blog/great-loop/*.mdx (45 files — miles/hours/lat/lon backfilled)

key-decisions:
  - "Body write-back uses raw.slice(fmEnd+4) not template ---\\n\\n${body}\\n to preserve original bytes exactly"
  - "Pre-departure dates (2022-04-01..2022-04-21) are within date range and qualify for stubs — day numbers are negative/zero but slugs remain unique"
  - "excerpt set to 'Photos from {location}' per plan discretion; intentional placeholder for Phase 6 editing"
  - "Draft stubs include draft: true in frontmatter even though field absent from Zod schema — Astro strips it before validation"

patterns-established:
  - "Backfill pattern: read → parse → mutate → write using raw body slice (not template)"
  - "Stub slug pattern: {YYYY-MM-DD}-day-{N}-{toSlug(location)}"
  - "toSlug: lowercase → strip non-[a-z0-9\\s-] → trim → collapse spaces to hyphens → collapse multiple hyphens"
  - "dayNumber: Day 1 = 2022-04-22 departure date"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07]

duration: 45min
completed: 2026-07-09
---

# Phase 4 Plan 01: Data Pipeline Output Stage Summary

**Node.js ESM script `04-generate-stubs.mjs` backfills 45 existing posts with Nebo voyage stats and generates 250 draft MDX stubs with Gallery + VoyageStats for all undocumented voyage days with 10+ photos from April 2022 through May 2024**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-09T20:00:00Z
- **Completed:** 2026-07-09T20:45:00Z
- **Tasks:** 3
- **Files modified:** 297 (1 script + 45 backfilled posts + 250 new stubs + 1 script update)

## Accomplishments

- Created `scripts/04-generate-stubs.mjs` (352 lines) — no npm packages, pure Node.js built-ins
- Backfilled `miles`/`hours` into 45 existing posts that have matching Nebo data (0 dock-day violations)
- Backfilled `lat`/`lon` into posts missing coordinates from timeline centroid
- Generated 250 `draft: true` MDX stubs with full frontmatter, VoyageStats, and Gallery components
- Last segment fully represented: 12 stubs for 2024-05-* including 2024-05-17 New Bern NC (Day 757)
- `npm run build` exits 0 — 327 pages built, zero Zod schema validation errors
- Full idempotency: second run produces backfilled=0, stubs_created=0

## Task Commits

1. **Task 1: Script foundation** - `868188a` (feat)
2. **Task 2: Job 1 — backfill miles/hours/lat/lon** - `c7114a3` (feat)
3. **Task 3: Job 2 — stub generation + build validation** - `d7fa22e` (feat)

## Files Created/Modified

- `scripts/04-generate-stubs.mjs` — 352-line ESM script; two jobs: backfill + stubs; --dry-run flag; integrity check; summary log
- `src/content/blog/great-loop/*.mdx` — 45 existing posts enriched with miles/hours/lat/lon
- `src/content/blog/great-loop/2022-04-01-day--20-new-bern-nc.mdx` through `2024-05-17-day-757-new-bern-nc.mdx` — 250 new draft stubs

## Decisions Made

- Body write-back uses `raw.slice(fmEnd+4)` not the `---\n\n${body}\n` template pattern. The template added one extra blank line and trailing newline (detected during Task 2 verification via `git diff` inspection). The raw slice preserves exact bytes.
- Pre-departure dates (2022-04-01 through 2022-04-21) fall within the D-03 date range and have 10+ photos, so they receive stubs. Day numbers are negative (Day -20 through Day -1) producing valid unique filenames like `2022-04-01-day--20-new-bern-nc.mdx`.
- `excerpt` field set to `Photos from {location}` per plan's discretion guidance. Intentional placeholder — Phase 6 will generate real narratives.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed body write-back template adding extra blank line**
- **Found during:** Task 2 (Job 1 backfill verification)
- **Issue:** Write-back template `---\n${fm}\n---\n\n${body}\n` added one extra blank line before body and extra trailing newline. `git diff` showed `+` line inserted in body area of first test-written file.
- **Fix:** Changed write-back to `---\n${serializeFrontmatter(fm)}\n---` + `raw.slice(fmEnd + 4)` where `fmEnd = raw.indexOf('\n---', 3)`. This preserves the exact original bytes from the closing `---` onwards.
- **Files modified:** `scripts/04-generate-stubs.mjs`
- **Verification:** `git diff src/content/blog/great-loop/2022-04-22-the-adventure-begins.mdx` shows only `+miles: 65.6` and `+hours: 7.2` — no blank line changes, no trailing newline change.
- **Committed in:** `c7114a3` (Task 2 commit)
- **Recovery:** Restored 45 incorrectly-written MDX files via `git checkout -- src/content/blog/great-loop/` before re-running fixed script.

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Critical fix — without it, every backfilled post would have had body content drift (extra blank line). Fix is a 1-line change; no scope creep.

## Known Stubs

The `excerpt` field in all 250 generated stubs contains `Photos from {location}` (e.g., `Photos from New Bern NC`). This satisfies the required Zod field and the Astro build, but is a placeholder — not final content.

- **Files:** all `src/content/blog/great-loop/*.mdx` with `draft: true`
- **Field:** `excerpt`
- **Pattern:** `Photos from {location}`
- **Reason:** Plan D-09 and Claude's Discretion. Phase 6 (New Post Generation) will replace these with AI-generated narrative excerpts.

These stubs are intentional draft placeholders, not blocking issues for Phase 4's goal.

## Issues Encountered

- Body drift detected during Task 2 manual verification (git diff inspection) before commit. Immediately fixed via Rule 1 and files restored from git. No unclean state entered the commit history.

## Next Phase Readiness

- Phase 5 (Route Maps): All 322 posts now have `lat`/`lon` coordinates (45 backfilled + existing + stubs with centroidLat/centroidLon). Map layer can use frontmatter lat/lon for all stops.
- Phase 6 (New Post Generation): 250 draft stubs ready for AI narrative generation. Barbara can identify posts to prioritize. Each stub has photos sorted by timestamp (Gallery component ready).
- The script is idempotent — can be re-run safely after any upstream pipeline changes without duplicating data.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `scripts/04-generate-stubs.mjs` exists | FOUND |
| `04-01-SUMMARY.md` exists | FOUND |
| `2024-05-17-day-757-new-bern-nc.mdx` exists (last segment) | FOUND |
| `2022-04-01-day--20-new-bern-nc.mdx` exists (pre-departure stub) | FOUND |
| Commit `868188a` exists (Task 1) | FOUND |
| Commit `c7114a3` exists (Task 2) | FOUND |
| Commit `d7fa22e` exists (Task 3) | FOUND |
| Posts with `miles:` (≥45) | 130 (45 backfilled existing + ~85 stubs with Nebo data) |
| Draft stubs created (≥200) | 250 |
| Total MDX files | 322 |
| Script line count (≥150) | 352 |

---
*Phase: 04-data-pipeline*
*Completed: 2026-07-09*
