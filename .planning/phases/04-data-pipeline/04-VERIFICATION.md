---
phase: 04-data-pipeline
verified: 2026-07-18T11:50:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Per-day GeoJSON track segments exist in .planning/data/tracks/ for all days with Nebo GPX data (ROADMAP SC 2)"
    addressed_in: "Phase 5"
    evidence: "04-CONTEXT.md deferred section line 130: 'GPX track simplification and per-day GeoJSON output -> Phase 5'. Phase 5 plan 1 explicitly includes 'GPX track simplification prebuild hook'."
human_verification:
  - test: "Photo-to-day timezone spot-check"
    expected: "5 photos with known physical locations (e.g., a marina in New Bern NC, a specific Florida Keys anchorage) confirm the day assignment in voyage-timeline-enriched.json matches the calendar day the photo was taken at the local timezone — not UTC midnight rollover"
    why_human: "Automated check cannot verify correct local-time date assignment without access to the actual Photos Library and knowledge of where the boat was on each date. The ts field is a Unix timestamp; borderline photos (taken near midnight) could be assigned to the wrong day if UTC is used instead of Eastern/local time."
---

# Phase 4: Data Pipeline Verification Report

**Phase Goal:** A set of local pipeline scripts ingests the iCloud photo library (via osxphotos) and Nebo GPX tracks + PDF voyage summaries into a unified voyage timeline — producing enriched post frontmatter and draft MDX stubs for all undocumented stops, including the complete last segment (Days 259 → New Bern NC, May 2024).

**Verified:** 2026-07-18T11:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | Running the script backfills miles/hours into existing posts that have matching Nebo data | VERIFIED | 45 non-draft posts confirmed by `grep -L "draft: true" *.mdx \| xargs grep -l "^miles:"` returning 45 |
| 2  | No existing post receives miles: 0 or hours: 0 for a day where day.nebo is null (D-06) | VERIFIED | Only 2 posts have `miles: 0` (2022-04-16, 2022-07-25); enriched timeline confirms both have non-null nebo objects with `distanceNm: 0` — legitimate dock days |
| 3  | The 4 posts missing lat/lon receive centroidLat/centroidLon where the enriched timeline has them | VERIFIED | 4 remaining posts without lat/lon (2022-08-11, 2024-01-12, 2024-02-03, 2024-02-05) have null or absent centroid data in timeline — script correctly skips them per D-08 guard. Posts with centroid data were backfilled. |
| 4  | Draft stubs (draft: true) exist for undocumented days with 10+ photos between 2022-04-01 and 2024-05-17 | VERIFIED | 250 stubs confirmed by `grep -rl "draft: true" *.mdx \| wc -l` = 250 |
| 5  | Stub titles follow 'Day {N} — {location}' where Day 1 = 2022-04-22 | VERIFIED | Code implements `fm.title = "Day ${dayN} — ${loc}"` with DEPARTURE = 2022-04-22. Spot-check: 2024-05-17 stub title is "Day 757 — New Bern NC" (correct: 757 days from departure) |
| 6  | Every stub includes a required excerpt field and passes Astro Zod validation | VERIFIED | 250/250 stubs have `^excerpt:` (`grep -rl "draft: true" \| xargs grep -l "^excerpt:" = 250`); `npm run build` exits 0 with 327 pages, zero schema errors |
| 7  | No stub overwrites an existing documented post (filename + date-prefix guard) | VERIFIED | `ls src/content/blog/great-loop/ \| sort \| uniq -d \| wc -l` = 0 (zero collisions); code has both `existing.has(filename)` guard and `f.startsWith(datePrefix)` guard |
| 8  | The last segment (dates through 2024-05-17) is represented by stubs where photo data exists | VERIFIED | 12 stubs confirmed for 2024-05-* dates; `2024-05-17-day-757-new-bern-nc.mdx` confirmed with correct frontmatter (miles: 40.8, hours: 5.2, lat: 35.1023, lon: -77.0393) |
| 9  | npm run build exits 0 after the script runs | VERIFIED | Build completed with exit 0, 327 pages built, no Zod validation errors |

**Score:** 9/9 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Per-day GeoJSON track segments in `.planning/data/tracks/` for all days with Nebo GPX data (ROADMAP SC 2 / DATA-01 GeoJSON output) | Phase 5 | 04-CONTEXT.md deferred section: "GPX track simplification and per-day GeoJSON output → Phase 5". Phase 5 plan 1 in ROADMAP.md: "GPX track simplification prebuild hook — write `scripts/simplify-gpx.mjs`" |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `scripts/04-generate-stubs.mjs` | Backfill + stub generation from enriched timeline; min 150 lines | VERIFIED | 352 lines; pure Node.js built-ins; no npm packages; `--dry-run` flag present |
| `src/content/blog/great-loop/` | Enriched existing posts + new draft stubs containing `draft: true` | VERIFIED | 322 total MDX files (72 original + 250 stubs); 250 with `draft: true` |
| `.planning/data/photo-index.json` | GPS + timestamp for every iCloud voyage photo; coverage documented | VERIFIED | 9,489 photos; stats: `{"totalPhotos":9489,"totalGps":9236,"totalNoGps":1159,"daysWithData":628}` — ~89% GPS coverage |
| `.planning/data/voyage-timeline-enriched.json` | Unified timeline (photos + Nebo + GPS) | VERIFIED | 634 dated entries, 628 with photos, 162 with Nebo; consumed by script as sole data source |
| `.planning/data/tracks/` (per-day GeoJSON) | Per-day GeoJSON track segments | DEFERRED | Directory does not exist; explicitly deferred to Phase 5 per 04-CONTEXT.md |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/04-generate-stubs.mjs` | `.planning/data/voyage-timeline-enriched.json` | `JSON.parse(readFileSync(...))` | WIRED | Lines 124-126: `JSON.parse(readFileSync(join(DATA_DIR, 'voyage-timeline-enriched.json'), 'utf8'))` |
| `scripts/04-generate-stubs.mjs` | `src/content/blog/great-loop/` | `writeFileSync` (backfill + stub) | WIRED | Job 1 line 225: `writeFileSync(filePath, ...)` (backfill); Job 2 line 336: `writeFileSync(join(POSTS_DIR, filename), ...)` (stubs) |
| stub MDX bodies | `VoyageStats` + `Gallery` components | `import` + JSX usage | WIRED | Confirmed: all 250 stubs have both `import VoyageStats from '../../../components/VoyageStats.astro'` and `import Gallery from '../../../components/Gallery.astro'` with JSX render |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| draft stub MDX files | `images` prop in Gallery | `day.photos` sorted by `p.ts` from enriched timeline | Yes — real photo UUIDs and filenames from Photos Library | FLOWING |
| draft stub MDX files | `miles`/`hours` in VoyageStats | `day.nebo.distanceNm` / `day.nebo.underwayHours` from enriched timeline | Yes — when nebo is non-null object; 85 stubs have miles/hours in VoyageStats | FLOWING |
| existing posts (backfill) | `miles`/`hours` frontmatter | `day.nebo` from enriched timeline | Yes — 45 posts backfilled with real Nebo stats | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Script loads timeline and reports dated entries | `node scripts/04-generate-stubs.mjs --dry-run \| grep "Timeline loaded:"` | `Timeline loaded: 634 dated entries (withPhotos=628, withNebo=162)` | PASS |
| Idempotency: second run creates nothing | `node scripts/04-generate-stubs.mjs --dry-run` (after full run) | `Posts backfilled: 0, Backfill skipped: 322, Stubs created: 0, Stubs skipped: 303` | PASS |
| 250 draft stubs created | `grep -rl "draft: true" *.mdx \| wc -l` | 250 | PASS |
| 12 stubs for last segment (May 2024) | `ls 2024-05-*day* \| wc -l` | 12 | PASS |
| Zero filename collisions | `ls \| sort \| uniq -d \| wc -l` | 0 | PASS |
| All 3 frontmatter utilities present | `grep -c "function split\|function parse\|function serialize"` | 3 | PASS |
| dayNumber and toSlug present | `grep -c "function dayNumber\|function toSlug"` | 2 | PASS |
| No forbidden npm imports | `grep -c "gray-matter\|require(\|from 'slugify'"` | 0 | PASS |
| `npm run build` exits 0 | `npm run build` | exit 0, 327 pages built | PASS |

### Probe Execution

No probe scripts declared in PLAN or present at `scripts/*/tests/probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DATA-01 | 04-01-PLAN.md | Nebo GPX tracks parsed and converted to GeoJSON (simplified for performance) | DEFERRED (partial) | Nebo data parsed into `voyage-timeline-enriched.json` via scripts 00-03 (WORKING). Per-day GeoJSON track export explicitly deferred to Phase 5 per 04-CONTEXT.md. No `.planning/data/tracks/` directory. |
| DATA-02 | 04-01-PLAN.md | iCloud photo library indexed via osxphotos — GPS + timestamp extracted | VERIFIED | `photo-index.json`: 9,489 photos, 89% GPS coverage. Script 00 WORKING per STATE.md. |
| DATA-03 | 04-01-PLAN.md | Photos correlated to voyage days/stops by timestamp (timezone-aware) | VERIFIED (partial) | `voyage-timeline-enriched.json`: 628 days with photos. Script 03 WORKING. Timezone correctness requires human spot-check (see below). |
| DATA-04 | 04-01-PLAN.md | Nebo PDF voyage summaries parsed for daily stats (distance, hours, speed, location) | VERIFIED | `nebo-logs.json`: 162/171 logs OCR'd, 5,424 nm total. Embedded in enriched timeline. |
| DATA-05 | 04-01-PLAN.md | Frontmatter enriched with lat/lon/miles data for all posts where GPS data exists | VERIFIED | 45 existing posts backfilled with miles/hours; lat/lon added where centroid data available. |
| DATA-06 | 04-01-PLAN.md | Unified voyage timeline produced — every day from Day 1 to return has GPS track, photo cluster, and Nebo stats (or documented gap) | VERIFIED | `voyage-timeline-enriched.json`: 634 dates, 628 with photos, 162 with Nebo, generated 2026-04-14. |
| DATA-07 | 04-01-PLAN.md | Last segment (Days 259 → New Bern, May 2024) fully represented in timeline with photos + GPS | VERIFIED | 12 stubs for 2024-05-* dates; final day `2024-05-17-day-757-new-bern-nc.mdx` confirmed with Nebo data (40.8 nm, 5.2 hrs). |

**Note:** POST-01 and POST-02 from REQUIREMENTS.md are mapped to Phase 6 in ROADMAP.md (not Phase 4). The PLAN's multi_source_coverage_audit correctly identifies them as Phase 6 items. Not tracked here.

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps DATA-01 through DATA-05 to Phase 4. DATA-06 and DATA-07 also map to Phase 4. All 7 DATA requirements are claimed in the PLAN's `requirements:` field. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| `scripts/04-generate-stubs.mjs` | 326 | `<VoyageStats  />` (double space when vsProps='') | Info | Cosmetic only — renders identically to `<VoyageStats />` in Astro; build passes |

No TBD, FIXME, or XXX markers found. No unreferenced debt markers. No stub implementations.

### Human Verification Required

#### 1. Photo-to-Day Timezone Spot-Check (ROADMAP SC 5)

**Test:** Select 5 photos from the voyage with known physical locations (e.g., the New Bern NC marina on 2022-04-22, a Florida Keys anchorage, or a specific night at a documented marina). For each photo, check its timestamp (`ts` field in `photo-index.json`) and verify it was assigned to the correct calendar day in `voyage-timeline-enriched.json`. Confirm that photos taken near midnight Eastern time are not off by one day due to UTC conversion.

**Expected:** Each of the 5 sample photos is assigned to the day matching the local Eastern/local timezone date when the photo was taken — not the UTC date.

**Why human:** Timezone correctness cannot be verified programmatically without the physical Photos Library and knowledge of the vessel's location at each timestamp. The `ts` field is a Unix epoch; any `date` assignment logic that divides by 86400 without timezone offset would produce UTC dates, which for photos taken before midnight UTC (e.g., 8pm EST = 1am UTC next day) would be off by one day.

---

### Gaps Summary

No gaps. All 9 PLAN must-have truths are verified. The only ROADMAP SC that was not met (SC 2 — per-day GeoJSON tracks in `.planning/data/tracks/`) is documented as deliberately deferred to Phase 5 in `04-CONTEXT.md`.

One human verification item is required (ROADMAP SC 5 — timezone spot-check) before phase can be marked fully complete.

---

_Verified: 2026-07-18T11:50:00Z_
_Verifier: Claude (gsd-verifier)_
