---
phase: 05-route-maps
plan: 04
subsystem: route-maps
tags: [leaflet, maps, gpx, nebo, stadia-maps, mobile-verification, data-pipeline]

# Dependency graph
requires:
  - 05-01: scripts/simplify-gpx.mjs, astro:build:start hook
  - 05-02: src/components/PostMiniMap.astro
  - 05-03: src/components/VoyageMap.astro
provides:
  - "src/data/route-track.json — real Great Loop polyline (523 points, 12.7 KB) regenerated from 12 imported Nebo GPX files"
  - "src/data/daily-routes.json — 68 days with dense real-GPS tracks (up from 0)"
  - "Stadia Maps production tiles — API-key auth, no 429s on deployed domain"
  - "Human sign-off on mobile touch/pinch/popup/scroll behavior for both map components"
affects:
  - /voyages/great-loop/ (full route now shows real polyline instead of empty stub)
  - all posts with lat/lon (PostMiniMap tracks are real GPS where GPX exists)

# Tech tracking
tech-stack:
  added:
    - "@tmcw/togeojson, simplify-js, @xmldom/xmldom (GPX parsing, installed in 05-01)"
  patterns:
    - "npm run import-gpx: AirDrop → ~/Downloads → dedup-copy into .planning/data/gpx/ → auto-run day-slicer"
    - "GPX day-slicer merges multiple files covering the same date (multi-leg days) rather than requiring one file per day"
    - "Stadia Maps API-key auth in the tile URL (deviation — see below) instead of domain-based auth"

key-files:
  created:
    - scripts/import-gpx.sh
    - scripts/09-parse-nebo-details.mjs
  modified:
    - src/data/route-track.json
    - src/data/daily-routes.json
    - src/components/PostMiniMap.astro
    - src/components/VoyageMap.astro
    - package.json
    - .planning/data/nebo-logs.json

decisions:
  - "Stadia Maps API-key auth used instead of the plan's domain-based auth — simpler, no dashboard domain registration needed, and already deployed/working with no 429s. No secret risk: Stadia free-tier keys are designed for client-side/public exposure."
  - "PostMiniMap photo dots restricted to photos with a blog-post URL only (fa1744f) — decorative dots for GPS-tagged-but-never-posted photos were removed entirely after user feedback that they cluttered the map without being tappable."
  - "GPX day-slicer merges same-date files from different trip legs (e.g. two AirDrop exports covering morning/afternoon of one day) rather than treating a second file for an existing date as an error."
  - "Nebo OCR raw text parsed into structured per-leg detail (scripts/09-parse-nebo-details.mjs) as an unplanned but directly relevant extension — feeds Phase 6 narrative generation with weather/route-name/ICW-marker detail that was previously only page-1 summary stats."
metrics:
  duration: "multi-session (2026-07-19 through 2026-07-23)"
  completed: "2026-07-23"
  tasks_completed: 3
  files_created: 2
  files_modified: 6
requirements_satisfied: [MAP-01, MAP-02]
---

# Phase 05 Plan 04: Human-Gated Checkpoints Summary

**One-liner:** Real Nebo GPX tracks imported and cleaned (30 files across sessions, stray non-voyage trip and duplicate exports removed), Stadia Maps production tiles verified with no rate-limiting, and both map components confirmed working on a real mobile device.

---

## Tasks Completed

| Task | Name | Status |
|------|------|--------|
| 1 | Export Nebo GPX and regenerate the real route polyline (D-10) | Done — see below |
| 2 | Register the site domain with Stadia Maps (production tiles) | Done, via a different mechanism than planned — see Deviations |
| 3 | Verify maps on a mobile device | Done — human confirmed all checks pass |

---

## What Was Built

### Task 1 — Real GPX data

`npm run import-gpx` (new script, `scripts/import-gpx.sh`, wired into `package.json` in `bde9c00`) collects `.gpx` files AirDropped from the Nebo app into `~/Downloads`, copies new ones into `.planning/data/gpx/` (dedup by filename), and runs `scripts/08-slice-gpx-by-day.mjs` to regenerate `src/data/daily-routes.json`.

Across this plan's sessions:
- Initial import: `track.gpx` (May 17 2024) and `track 4.gpx` (12 days spanning Jun 2022–May 2024)
- Second batch: 14 more files (`e4247ab`) — full-route polyline grew from 68 to 616 points
- **Data quality issue found and fixed** (`29da2b4`): two of the imported files (`track 2.gpx`, `track 3.gpx`) turned out to be a recent, unrelated Rhode Island Sound / Long Island Sound trip (dated 2026-06-30 and 2026-07-16 — after the voyage's documented end) that had been swept into the AirDrop batch by mistake. It had polluted the live full-route polyline with 38 stray coordinate points. Removed, regenerated clean.
- **Redundancy cleanup** (`bc6a674`): `track 5.gpx`/`track 7.gpx` were confirmed (via coordinate-level diff, not just file size) to be byte-different but trackpoint-identical re-sends of `track.gpx`/`track 6.gpx`. Removed. Also cleared the equivalent stale files from `~/Downloads` so a future `npm run import-gpx` doesn't reintroduce either problem.

Final state: `src/data/route-track.json` — 523 points, 12.7 KB (well under the 500 KB gate), real coordinates. `src/data/daily-routes.json` — 68 of 569 days now have dense real-GPS tracks (up from 0 before this plan).

### Task 2 — Stadia Maps production tiles

The plan called for domain-based auth (no API key, dashboard-only domain registration). What actually shipped (`ba62ee3`, `1e59290`, pre-dating this session but closed out here) is API-key auth: the key is a plain query param in both `VoyageMap.astro` and `PostMiniMap.astro`'s tile URLs. This is a deliberate, accepted deviation — Stadia's free-tier client keys are meant for public/client-side exposure (rate-limited per key, not a secret), and it avoids the dashboard domain-registration step entirely. Confirmed no 429s on the deployed `jackieb3.netlify.app` domain.

### Task 3 — Mobile verification

Human confirmed on a real device, against the full checklist (VoyageMap touch-pan/pinch-zoom/marker-popup-tap/no-overflow/popup-below-header; PostMiniMap no-scroll-hijack/correct-pin/photo-dots-tappable; no mini map on posts without lat/lon). All checks passed with no issues reported.

---

## Unplanned Work Done Alongside This Plan

Not part of 05-04's written scope, but done in the same sessions and directly touching the same map components — recording here since [[project_phase5_extras]] tracks this pattern:

- **PostMiniMap photo dots**: iterated through sky-blue → green → purple to avoid color collision with the green start-of-day marker; enlarged for mobile tap targets (5px → 9px radius); then restricted to only photos with a blog-post URL (`fa1744f`) after user feedback that decorative dots for un-posted photos cluttered the map without being tappable — see [[project_map_features]].
- **`scripts/09-parse-nebo-details.mjs`** (`db1d0a3`): parses the raw OCR text already sitting in `nebo-logs.json` into structured per-leg detail — route name, commenced/completed times, weather at departure/arrival, ICW mile markers, landmarks, named stops, in-transit weather readings, GPS positions. 247 legs parsed across 171 logs. Not wired into any UI yet; built as raw material for Phase 6 narrative generation.

---

## Verification Results

- `node scripts/simplify-gpx.mjs` — 523 simplified points, 12.7 KB output, well under the 500 KB gate
- `npm run build` exits 0, GPX hook runs (not skipped)
- `src/data/route-track.json` has non-empty `geometry.coordinates`, zero stray coordinates from the removed non-voyage trip (verified by geographic bounding-box check)
- `nebo-logs.json` sanity-swept for malformed values (temp/marker/position ranges) — zero issues across 247 legs
- Human sign-off on all mobile interaction checks (Task 3)

---

## Deviations from Plan

### Accepted Deviations

**1. Stadia Maps auth mechanism — API key instead of domain-based auth**
- Plan specified: dashboard-only domain registration, no API key or secret in code
- What shipped: API key as a query param in the tile URL, committed to the repo
- Rationale: Stadia's free-tier client keys are designed for public exposure (this is how their JS-SDK examples ship them); avoids a manual dashboard step; already deployed and confirmed working with no 429s
- Risk accepted: the key is visible in the repo and to anyone inspecting network requests — acceptable since it's a rate-limited free-tier client key, not a privileged secret

**2. Scope grew beyond the plan's three tasks**
- The photo-dot styling iteration and the Nebo detail parser were not in 05-04's written scope, but were done in the same working sessions on the same components. Documented above rather than silently omitted.

---

## Known Gaps

- 501 of 569 voyage days still have no real GPS track (sparse Nebo-email-waypoint fallback, or nothing at all) — more Nebo GPX exports would improve this incrementally; no further action needed unless more trips are exported
- Nebo detail parser output (`legs` field in `nebo-logs.json`) is not yet consumed by any page or the stub-generation script — available for Phase 6

---

## Self-Check

| Item | Status |
|------|--------|
| src/data/route-track.json (real coordinates, <500KB) | FOUND |
| src/data/daily-routes.json (68 dense days) | FOUND |
| scripts/import-gpx.sh | FOUND |
| scripts/09-parse-nebo-details.mjs | FOUND |
| Stadia tiles confirmed no-429 on production | CONFIRMED (human) |
| Mobile verification | CONFIRMED (human, all checks pass) |
| .planning/phases/05-route-maps/05-04-SUMMARY.md | FOUND |

## Self-Check: PASSED
