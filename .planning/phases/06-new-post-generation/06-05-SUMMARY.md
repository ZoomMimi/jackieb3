---
phase: 06-new-post-generation
plan: 05
subsystem: data-pipeline
tags: [cloudflare-r2, osxphotos, sharp, aws-sdk-client-s3, gps-filter, data-integrity]

# Dependency graph
requires:
  - phase: 06-new-post-generation (plan 06-04)
    provides: "scripts/10-upload-r2.mjs (GPS-filtered, TCC-fixed), human approval, no-derivative-fallback decision"
provides:
  - "All 100 in-scope posts free of file:// URLs — 93 with real R2-hosted galleries, 7 with no gallery at all (discovered land-trip contamination; separately, 2023-08-09 is a pre-existing gap with no post file, not counted among these 100)"
  - "scripts/10-upload-r2.mjs hardened: auto-clears stale staging dirs before every export attempt, no longer needs manual rm -rf on retry"
  - "A second, more severe class of the Wave-3 GPS-mismatch defect: whole days (not just individual outliers) can be entirely non-voyage photos with real-but-irrelevant GPS, discovered via cross-referencing milesFromPrev against physically plausible boat speed"
affects: [06-06-narrative-generation, 06-08-final-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stale staging dir auto-clear: rm -rf the day's staging directory before mkdirSync/export, not just on success — osxphotos refuses to proceed non-interactively past a leftover export db from a prior failed attempt"
    - "Land-trip / non-voyage-day detection: a day's photos can all carry real, self-consistent GPS and still be wrong — cross-check milesFromPrev in voyage-timeline-enriched.json against plausible daily boat range (~40-80nm); an out-and-back pattern across several consecutive days flanked by the same real anchor location (here: Holland MI on both sides) is strong confirmation"
    - "Never run two 10-upload-r2.mjs invocations concurrently — observed osxphotos itself crash with a KeyError in its own config-file handling when two instances raced"

key-files:
  modified:
    - scripts/10-upload-r2.mjs
    - src/content/blog/great-loop/*.mdx (93 posts: file:// → R2 https Gallery + r2Uploaded: true; 7 posts: Gallery removed entirely — 2023-08-02/03/04/05/06/07/08)
    - .planning/data/r2-upload-report.json

key-decisions:
  - "2023-08-02 through 2023-08-08 (7 dates, including 08-04 which was independently under investigation for a different reason before this pattern was seen) are a land trip, not the boat: milesFromPrev of 261/169/120/107/176 miles in single days is impossible for the actual boat (~40-80nm/day per Nebo logs), and the range starts and ends at Holland MI (the boat's real, static location that week). Confirmed with the project owner. All photos/videos on all 7 dates were removed from their Gallery arrays rather than uploaded; the already-uploaded copies (133 objects, ~3GB) were deleted from R2. These 7 posts now render with no gallery, and narrative-triage.json was corrected to reclassify all 7 as `sparse` (locked, so a future --triage rerun can't revert them using stale photo counts) rather than the `full`/`transit` they'd been classified as before this fix — they will not be sent to AI narrative generation."
  - "2023-08-03's one bad photo and 2023-08-25's one bad photo were individually mis-synced items (Messages/'Shared with You'-style syndication cache, iscloudasset:false, ismissing:true, no real original anywhere) rather than part of a wider day-level problem — removed individually, rest of those two days uploaded normally."
  - "Do not use --allow-derivative-fallback as a blanket policy (per 06-04's decision) — but it's a legitimate one-off tool for a single missing image with a real cached derivative (used successfully nowhere in this run once the syndication-cache cases turned out to have no derivative at all either)."

requirements-completed: [POST-02]

# Metrics
duration: ~4h across two sessions (paused mid-run 2026-08-10, resumed and completed 2026-09-18)
completed: 2026-09-18
---

# Phase 6 Plan 5: Full R2 Upload Summary

**Uploaded the remaining ~1,600 photos/videos for 98 posts to Cloudflare R2, fixed a recurring osxphotos retry crash at the code level, and caught a second, more severe form of the Wave-3 GPS-mismatch defect: an entire week's worth of photos on 7 posts turned out to be a land trip away from the boat, not voyage content — found by cross-referencing implausible daily mileage against the real anchor location on both sides of the gap**

## Performance

- **Duration:** ~4 hours of active work, split across a session paused 2026-08-10 (67/100 posts, conserving plan credits) and resumed/completed 2026-09-18
- **Completed:** 2026-09-18
- **Files modified:** 100 MDX posts + `scripts/10-upload-r2.mjs` + `.planning/data/r2-upload-report.json`

## Accomplishments
- Uploaded all remaining in-scope media: Keys-to-New-Bern range (26 posts) plus the Canada side-trip range in 8 batches, bringing the bucket to 1,532 objects / ~7.68 GB — comfortably under the 10 GB free-tier ceiling.
- Fixed the recurring "stale export-staging-directory" crash (previously only worked around by hand, see 06-05's earlier commit `7797ce5`) at the code level: `scripts/10-upload-r2.mjs` now `rm -rf`s each day's staging directory before every export attempt, not just on success.
- Discovered, diagnosed, and fixed a second and more severe instance of the Wave-3 GPS-mismatch defect (see `[[project_phase6_scope]]`/STATE.md 2026-08-09 entry for the first instance): 2023-08-02 through 2023-08-08 (minus 08-01/08-10, which anchor correctly at Holland MI on both sides) is an entire land-trip week mis-attributed to the voyage by calendar-date-only photo matching. Unlike the earlier defect, every one of these photos carries real, internally-consistent GPS — the tell was the day-to-day mileage (up to 261 miles/day, impossible for the boat) rather than missing GPS.
- Individually resolved two more one-off bad photos (2023-08-03, 2023-08-25) that turned out to be a different failure mode entirely: Messages/"Shared with You"-style syndication cache items with no real original anywhere (not iCloud-downloadable, no normal derivative fallback either).
- Deleted the 133 already-uploaded land-trip objects (~3 GB) from the public R2 bucket once the defect was confirmed, rather than leaving unrelated personal photos publicly hosted.

## Files Modified
- `scripts/10-upload-r2.mjs` — auto-clear stale staging dir before every export (not just on success)
- 93 posts — `file://` Gallery entries rewritten to R2 `https://` URLs, `r2Uploaded: true` set
- `2023-08-02-day-468-4128n-8154w.mdx`, `2023-08-03...`, `2023-08-04...`, `2023-08-05...`, `2023-08-06...`, `2023-08-07...`, `2023-08-08...` — Gallery block and its now-unused import removed entirely (land-trip content, no legitimate voyage photos exist for these dates)
- `.planning/data/r2-upload-report.json` — final run report

## Decisions Made

**Land-trip range (2023-08-02 – 2023-08-08, 7 dates, excl. 08-01/08-10):** Confirmed with the project owner that this was a drive home to the DC area while the boat stayed in Michigan. All Gallery content removed from these 7 posts; `narrative-triage.json` reclassified all 7 to `sparse` and locked, so they won't be picked up for AI narrative generation in 06-06/06-07. They remain in scope as draft stubs with `draft: true` and no photos. Frontmatter `title`/`location`/`lat`/`lon` on these posts still reflect the bogus DC-area centroid computed from the bad photos — not corrected in this plan (out of scope for a photo-upload plan), flagged here for whoever eventually decides what these posts should say.

**Individual syndication-cache exclusions (2023-08-03, 2023-08-25):** One photo removed from each post's Gallery array by hand after confirming via `osxphotos query` and direct filesystem checks that the asset has no real original (`ismissing: true`, `iscloudasset: false`, cached only under Photos' `scopes/syndication/` path used for Messages-shared content) and no usable derivative. Rest of both days uploaded normally.

**Concurrency:** Running two `10-upload-r2.mjs` processes at once is unsafe — osxphotos itself crashed (`KeyError: 'styles'` in its own config-file handling) when two instances raced, unrelated to this project's code. Batches were run sequentially after that was discovered.

## Verification

- `node scripts/verify-phase6.mjs --gate no-file-urls` → `GATE_PASS` (0 posts contain `file://`)
- `IN_SCOPE_POSTS=100, MISSING_POSTS=0, R2_UPLOADED_POSTS=93` (the other 7 are the land-trip posts, all legitimately with no gallery; 2023-08-09's pre-existing gap has no post file at all and isn't among these 100)
- `npm run build` → 77 pages built clean (one MDX regression from the land-trip Gallery removal — a lost blank line between an import and its JSX usage, breaking MDX parsing on 6 of the 7 files (08-04 was hand-edited and unaffected) — found and fixed in the same session before this build)

## Deviations from Plan

The plan's must-have "every in-scope post carries `r2Uploaded: true`" is not literally true: 7 newly-discovered land-trip posts have no gallery at all because no legitimate voyage photo exists for those dates. This is the correct outcome given the data, not a shortfall — the alternative would be uploading and publishing photos of an unrelated family land trip as if they were Great Loop content. The plan's other, load-bearing must-have (zero `file://` URLs anywhere) is fully met.
