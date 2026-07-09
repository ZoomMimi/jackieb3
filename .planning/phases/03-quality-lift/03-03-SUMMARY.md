---
phase: 03-quality-lift
plan: "03"
subsystem: content-pipeline
tags: [node-script, voyage-timeline, enrichment, gallery, gps, location, mdx]

requires:
  - phase: 03-quality-lift
    plan: "02"
    provides: "72 MDX posts with lifted: true and VoyageStats footers"
  - file: .planning/data/voyage-timeline-enriched.json
    provides: "634 dated entries with location, GPS centroids, and iCloud photo clusters"

provides:
  - "enrichPosts() function in scripts/07-quality-lift.mjs"
  - "72 posts enriched with enriched: true frontmatter flag"
  - "68 posts updated with centroid lat/lon GPS coordinates"
  - "45 early posts (2022-04-16..2022-08-04) with Gallery placeholder + import"
  - "Location field updated to human-readable place names where timeline provides one"

affects:
  - "src/content/blog/great-loop/*.mdx — all 72 posts rewritten with enrichment"
  - "03-04 (Barbara review pass) can now see real locations and Gallery placeholders"
  - "Phase 6 (photo hosting) will replace file:/// paths in Gallery with web URLs"

tech-stack:
  added: []
  patterns:
    - "Lazy API key initialization: getClient() only called when posts need lifting"
    - "isPlaceName() regex filter: /\\d+\\.\\d+°[NS]/ detects coordinate-format strings"
    - "enriched: true frontmatter flag for idempotency (separate from lifted: true)"
    - "Gallery import injected after VoyageStats import via string replace"
    - "file:///Photos Library.photoslibrary/originals/{dir}/{filename} placeholder format"

key-files:
  created: []
  modified:
    - scripts/07-quality-lift.mjs
    - src/content/blog/great-loop/*.mdx (all 72 files)
    - .planning/data/quality-lift-report.json

key-decisions:
  - "enriched: true is a separate idempotency gate from lifted: true — enrichment runs on all posts including already-lifted ones"
  - "isPlaceName() filters coordinate-format strings like '35.02°N 79.11°W' — only real place names update the location field (D-10)"
  - "Gallery capped at 20 photos per post to keep file sizes manageable"
  - "API key made lazy: getClient() called inside loop — script runs enrichment-only without ANTHROPIC_API_KEY when all posts are lifted"
  - "VoyageStats startLocation/endLocation/stops skipped: nebo data does not expose parsed start/end locations (raw OCR text only)"
  - "2 posts without exact date matches (2022-08-11, 2024-02-05) skip location/lat/lon — no fallback used for timeline (only nebo-logs uses ±7-day fallback)"

patterns-established:
  - "Enrichment-only re-run possible without API key when all posts are lifted"
  - "isPlaceName() pattern reusable for any coordinate-vs-place-name distinction"
  - "file:/// placeholder path format for iCloud photos: dir+filename from voyage-timeline photos[] array"

requirements-completed: [QLFT-05, QLFT-03]

duration: ~10min
completed: 2026-07-09
---

# Phase 3 Plan 03: Frontmatter Enrichment + Gallery Placeholders Summary

**Enrichment pass added to scripts/07-quality-lift.mjs: all 72 posts now carry location/lat/lon from voyage-timeline-enriched.json; 45 early posts (Days 1-111) received Gallery component placeholders with iCloud photo paths**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-09T09:15:00Z
- **Completed:** 2026-07-09T13:33:00Z
- **Tasks:** 2
- **Files modified:** 74 (script + 72 MDX posts + report)

## Accomplishments

- Extended `scripts/07-quality-lift.mjs` with `enrichPosts()` function (178 lines added)
- Made API key guard lazy via `getClient()` — script runs enrichment-only without `ANTHROPIC_API_KEY` when all posts are already lifted
- Loaded `voyage-timeline-enriched.json` (634 dated entries) alongside existing nebo-logs
- Added `isPlaceName()` helper to filter coordinate-format strings (D-10 correctness requirement)
- 72 posts enriched; 70 date-matched to timeline; 68 gained centroid lat/lon frontmatter
- 45 early posts (2022-04-16 to 2022-08-04) with iCloud photos received Gallery import + `<Gallery images={[...]} />` placeholder (capped at 20 photos per post)
- Gallery import injected after existing VoyageStats import via string replacement
- `enriched: true` frontmatter flag ensures idempotent re-runs (D-03 pattern extended)
- `npm run build` exits 0 — 77 pages, no schema validation errors

## Task Commits

1. **Task 1: Add enrichment pass to lift script** - `0ee1ffb` (feat — 178 lines added to script)
2. **Task 2: Run enrichment and verify** - `2d96bb5` (feat — 72 MDX posts + report updated)

## Files Created/Modified

- `scripts/07-quality-lift.mjs` — Extended: lazy getClient(), timeline loading, isPlaceName(), enrichPosts() function, updated report schema
- `src/content/blog/great-loop/*.mdx` — All 72 posts: enriched: true flag + location/lat/lon where timeline matched; 45 early posts also have Gallery import + call
- `.planning/data/quality-lift-report.json` — Updated: enriched/enrichSkipped/enrichFailed counts added to report

## Sample Enriched Posts

| Post | Location Before | Location After | lat | Gallery |
|------|----------------|----------------|-----|---------|
| 2022-04-16 Getting Ready to Go | Great Loop | New Bern NC | 35.1029 | yes (9 photos) |
| 2022-04-22 The Adventure Begins | Great Loop | Great Loop | 35.1025 | yes (20 of 65 photos) |
| 2022-05-14 Day 23 Solomons Island | Great Loop | Annapolis MD | 38.976 | yes (37 photos) |
| 2022-07-09 Trent Gateway | Great Loop | Trent-Severn Waterway | 44.1455 | yes (20 of 51 photos) |
| 2023-10-07 Chicago | Great Loop | no match | none | no (after window) |

Note: 2022-04-22 kept `location: Great Loop` because the timeline entry has coordinate-format "35.10°N 76.74°W" — filtered by `isPlaceName()` per D-10.

## Enrichment Stats

- Posts enriched this run: 72
- Posts skipped (already enriched): 0
- Posts failed: 0
- Timeline exact-date matches: 70 (2 unmatched: 2022-08-11, 2024-02-05)
- Posts with lat/lon added: 68
- Early posts with Gallery placeholders: 45

## Deviations from Plan

### VoyageStats startLocation/endLocation/stops Not Added

**Rule applied:** None — data genuinely absent, not a bug

**Situation:** The plan asked to enrich VoyageStats with startLocation/endLocation/stops from timeline nebo data. Investigation of `voyage-timeline-enriched.json` shows the `nebo` sub-object has: `distanceNm`, `underwayHours`, `maxSpeedKts`, `avgSpeedKts`, `pdfUuid`, `raw[]`. No parsed `startLocation`, `endLocation`, or `stops` fields — these are buried in unstructured OCR raw text strings.

**Decision:** Skip VoyageStats startLocation/endLocation/stops enrichment — data not available in parsed form. QLFT-03 was already completed in plan 03-01 (VoyageStats component renders miles/hours). Parsing start/end from raw OCR would require a separate pass and is out of scope for Phase 3.

**Impact:** VoyageStats footers remain with only miles/hours. No regression.

### Two Posts Lack Timeline Matches

**Situation:** Posts dated 2022-08-11 and 2024-02-05 have no exact date match in voyage-timeline-enriched.json. Per D-10, these posts keep their existing location unchanged with no lat/lon added. This is expected behavior.

## Known Stubs

- **Gallery images (45 posts):** All Gallery calls use `file:///` local path placeholders pointing to `~/Pictures/Photos Library.photoslibrary/originals/{dir}/{filename}`. These render nothing in a browser — structural placeholders for Phase 6 (photo hosting) to replace with web-accessible URLs. Per D-12, this is intentional and expected.

## Threat Flags

No new threat surface beyond the plan's threat model:
- T-03-06 (confirmed): file:/// paths in Gallery placeholders — non-sensitive local library structure only, no secrets

## Self-Check

- [x] `scripts/07-quality-lift.mjs` exists and `node --check` passes — FOUND
- [x] `grep -q "voyage-timeline-enriched" scripts/07-quality-lift.mjs` — PASS
- [x] `grep -q "enriched" scripts/07-quality-lift.mjs` — PASS
- [x] `grep -rl "enriched: true" src/content/blog/great-loop/*.mdx | wc -l` = 72 — PASS
- [x] `grep -rl "<Gallery images" src/content/blog/great-loop/2022-0[4-8]*.mdx | wc -l` = 45 — PASS (>0)
- [x] `grep -rl "^lat:" src/content/blog/great-loop/*.mdx | wc -l` = 68 — PASS (>3)
- [x] `npm run build` exits 0 — PASS (77 pages)
- [x] Commits: 0ee1ffb (script), 2d96bb5 (enriched posts) — FOUND

## Self-Check: PASSED

---
*Phase: 03-quality-lift*
*Completed: 2026-07-09*
