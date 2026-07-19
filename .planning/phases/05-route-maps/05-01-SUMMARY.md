---
phase: 05-route-maps
plan: 01
subsystem: data-pipeline
tags: [gpx, geojson, leaflet, togeojson, simplify-js, xmldom, astro-integration]

# Dependency graph
requires:
  - phase: 04-data-pipeline
    provides: MDX posts with lat/lon frontmatter that VoyageMap will later consume
provides:
  - "scripts/simplify-gpx.mjs — Nebo GPX -> simplified GeoJSON LineString converter with 500 KB size gate and graceful stub fallback"
  - "src/data/route-track.json — committed empty-LineString stub; consumed by VoyageMap.astro at build time"
  - "astro.config.mjs simplifyGpxPlugin — astro:build:start hook that auto-runs GPX simplification when .planning/data/gpx/ exists"
  - "leaflet, @tmcw/togeojson, simplify-js, @xmldom/xmldom — all GPX/map npm packages installed and in package.json"
affects:
  - 05-02 (VoyageMap.astro imports src/data/route-track.json produced by this plan)
  - 05-03 (PostMiniMap.astro depends on leaflet installed here)
  - 05-04 (GPX export + finalization runs simplify-gpx.mjs installed here)

# Tech tracking
tech-stack:
  added:
    - "leaflet@1.9.4 (browser map rendering, installed ahead of plan 02/03 use)"
    - "@tmcw/togeojson@7.1.2 (GPX -> GeoJSON conversion)"
    - "simplify-js@1.2.4 (Douglas-Peucker polyline simplification)"
    - "@xmldom/xmldom@0.9.10 (Node.js DOM parser for @tmcw/togeojson, T-05-SC pre-approved)"
  patterns:
    - "GPX-to-GeoJSON conversion: @xmldom/xmldom DOMParser -> @tmcw/togeojson gpx() -> simplify-js simplify()"
    - "Astro integration as local inline object (not external package) for build hooks"
    - "astro:build:start hook guards on existsSync before invoking node script"
    - "Committed stub pattern: empty GeoJSON Feature ensures build never fails before real data exists"

key-files:
  created:
    - scripts/simplify-gpx.mjs
    - src/data/route-track.json
  modified:
    - astro.config.mjs
    - package.json
    - package-lock.json

key-decisions:
  - "src/data/route-track.json chosen over .planning/data/ for Vite import compatibility (RESEARCH.md A2 resolved)"
  - "Empty-stub committed to git so astro build always succeeds before Nebo GPX export (human prerequisite D-10)"
  - "simplifyGpxPlugin integrated inline in astro.config.mjs (not as separate npm package) — correct for project-local hooks"
  - "TOLERANCE=0.001 (~110m) chosen as starting point; size gate at 500 KB enforces MAP-02 success criteria"
  - "@xmldom/xmldom added as devDependency (build-script only); @tmcw/togeojson and simplify-js as regular dependencies (will be imported in browser bundle via VoyageMap in plan 02)"

patterns-established:
  - "GPX simplification script follows scripts/01-build-timeline.mjs conventions: shebang, block comment, node: imports, __dirname, section separators, aligned console.log"
  - "Astro integration hook pattern: const plugin = { name, hooks: { 'astro:build:start': ({logger}) => ... } }; add to integrations array"

requirements-completed: [MAP-02]

# Metrics
duration: 15min
completed: 2026-07-19
---

# Phase 05 Plan 01: GPX Pipeline — Build-Time Route Track Infrastructure Summary

**GPX-to-GeoJSON pipeline with 500 KB size gate, committed empty-LineString stub, and astro:build:start auto-run hook via inline simplifyGpxPlugin integration**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-19T17:33:00Z
- **Completed:** 2026-07-19T17:37:40Z
- **Tasks:** 2 (Task 1 was a checkpoint pre-approved by human orchestrator)
- **Files modified:** 5

## Accomplishments

- Installed all four Phase 5 GPX/map packages (leaflet, @tmcw/togeojson, simplify-js, @xmldom/xmldom) with all packages audit-approved in RESEARCH.md
- Created `scripts/simplify-gpx.mjs` — converts any Nebo GPX files in `.planning/data/gpx/` into a single simplified GeoJSON LineString under 500 KB; writes a valid empty-coordinates stub when no GPX files are present; enforces hard 500 KB size gate with `process.exit(1)` (T-05-01 mitigation)
- Committed `src/data/route-track.json` as the empty-LineString stub so `astro build` never fails on the VoyageMap import before real GPX data arrives
- Wired `simplifyGpxPlugin` Astro integration into `astro.config.mjs` — fires on `astro:build:start`, skips with `logger.warn` when `.planning/data/gpx/` is absent, calls `node scripts/simplify-gpx.mjs` when GPX files are present
- `npm run build` exits 0 and emits the expected `[WARN][simplify-gpx]` stub-warning

## Task Commits

1. **Task 1: Package legitimacy gate** — pre-approved checkpoint (skipped by orchestrator instruction)
2. **Task 2: Install packages + write simplify-gpx.mjs + stub** — `6df78a6` (feat)
3. **Task 3: Wire simplifyGpxPlugin into astro.config.mjs** — `780baeb` (feat)

**Plan metadata:** see final-commit below

## Files Created/Modified

- `scripts/simplify-gpx.mjs` — GPX -> GeoJSON converter with stub fallback, 500 KB size gate, --dry-run flag
- `src/data/route-track.json` — committed empty `{ type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} }` stub (84 bytes)
- `astro.config.mjs` — added `import { execSync }` + `import { existsSync }`, added `simplifyGpxPlugin` integration object, added to `integrations` array as third entry
- `package.json` — added leaflet, @tmcw/togeojson, simplify-js to dependencies; @xmldom/xmldom to devDependencies
- `package-lock.json` — updated with all new package lock entries

## Decisions Made

- `src/data/route-track.json` is the output path (not `.planning/data/`) — this is the Vite-conventional location for build-time JSON imports from component frontmatter
- Stub committed to git rather than generated at build time — ensures `astro build` works on a fresh clone before any GPX processing
- `leaflet` installed as a regular dependency (not devDependency) because it will be bundled into the browser build in plans 02/03
- `simplifyGpxPlugin` implemented as an inline config object (not published npm package) — correct pattern for project-local Astro integrations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @tmcw/togeojson and simplify-js (plan assumed pre-installed)**
- **Found during:** Task 2 (write simplify-gpx.mjs)
- **Issue:** Plan `read_first` note says "confirm leaflet, @tmcw/togeojson, simplify-js already present" but package.json had none of them — the script would fail at runtime with MODULE_NOT_FOUND
- **Fix:** `npm install leaflet @tmcw/togeojson simplify-js` — all three packages are audit-approved in RESEARCH.md with `[OK]` / `Approved` disposition; no human gate required
- **Files modified:** package.json, package-lock.json (included in Task 2 commit)
- **Verification:** `node scripts/simplify-gpx.mjs` exits 0; npm run build exits 0
- **Committed in:** 6df78a6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing npm packages)
**Impact on plan:** Necessary for plan to function; all packages were already audit-approved; no scope creep.

## Issues Encountered

None — build passed first try after packages were installed.

## Known Stubs

- `src/data/route-track.json` — intentional empty-LineString stub. This is the designed behavior: the file is committed with zero coordinates and will be replaced by real GPX data when the human exports Nebo GPS tracks (D-10, prerequisite gated in plan 05-04). `VoyageMap.astro` (plan 05-02) must handle empty coordinates gracefully (no polyline drawn).

## User Setup Required

None for this plan — GPX export from Nebo app (D-10) is a human prerequisite handled in plan 05-04.

## Next Phase Readiness

- `src/data/route-track.json` is in place — plan 05-02 (VoyageMap.astro) can safely `import routeData from '../data/route-track.json'` at build time
- All four npm packages are installed — plans 02, 03, 04 can import leaflet and @tmcw/togeojson without additional installs
- `scripts/simplify-gpx.mjs` is ready — when Nebo GPX files are exported to `.planning/data/gpx/`, the next `npm run build` will auto-process them via the hook
- No blockers for plans 05-02 and 05-03 (VoyageMap + PostMiniMap components)

---
*Phase: 05-route-maps*
*Completed: 2026-07-19*
