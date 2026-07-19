---
phase: 05-route-maps
plan: 03
subsystem: route-maps
tags: [leaflet, maps, astro-component, client-side, voyage-index, accessibility, security]

# Dependency graph
requires:
  - 05-01: src/data/route-track.json (empty-LineString stub imported at build time)
  - 05-01: leaflet@1.9.4 installed in package.json
provides:
  - "src/components/VoyageMap.astro — full-route Leaflet map: Stadia tiles, polyline, 68 stop markers with rich popups, auto fitBounds"
  - "src/pages/voyages/great-loop/index.astro (modified) — VoyageMap rendered above post list"
affects:
  - /voyages/great-loop/ (voyage index page — map now appears above post list)
  - 05-04 (visual verification checkpoint depends on this component)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "<script type='application/json'> data islands for bridging build-time data to client-side Leaflet"
    - "serialize() with .replace(/</g, '\\u003c') for T-05-06 data island XSS prevention"
    - "L.divIcon with inline SVG for Vite-safe markers (no default PNG asset-hash breakage)"
    - "L.featureGroup fallback fitBounds when route coords are empty"
    - "if(mapEl){} guard instead of top-level return in Astro <script> block"

key-files:
  created:
    - src/components/VoyageMap.astro
  modified:
    - src/pages/voyages/great-loop/index.astro

decisions:
  - "Data islands via <script type='application/json' set:html={serialize(...)}> chosen over data-* attributes — route JSON can be large; inline JSON is more reliable for complex data than URI-encoded attribute values"
  - "serialize() escapes < to \\u003c (T-05-06) — prevents </script> in any title/excerpt from breaking out of the data island"
  - "Top-level return replaced with if(mapEl){} guard — Astro/Rolldown treats top-level return outside a function as CompilerError"
  - "VoyageMap fetches its own data via getCollection() in frontmatter — no props needed (matches UI-SPEC contract)"

metrics:
  duration: "~20 minutes"
  completed: "2026-07-19"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
requirements_satisfied: [MAP-01, MAP-02, MAP-03, MAP-05, SITE-02]
---

# Phase 05 Plan 03: VoyageMap Summary

**One-liner:** Full-route Leaflet map with Stadia Outdoors tiles, navy polyline, 68 red divIcon stop markers with cover photo + rich popup, and auto-fitBounds fallback — rendered above the post list on the voyage index page.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create VoyageMap.astro | 2e2f36c | src/components/VoyageMap.astro (created) |
| 2 | Insert VoyageMap into voyage index + fix top-level return bug | 850c48a | src/components/VoyageMap.astro (modified), src/pages/voyages/great-loop/index.astro (modified) |

---

## What Was Built

### `src/components/VoyageMap.astro`

A self-contained Astro component that renders a 400px full-width interactive Leaflet map on the voyage index page.

Key implementation details:

**Frontmatter (build-time):**
- Imports `routeData` from `../data/route-track.json` (empty-LineString stub committed by 05-01)
- Calls `getCollection('blog', ...)` filtered to `voyage === 'great-loop' && !draft && lat !== undefined && lon !== undefined`
- `serialize()` function escapes `<` to `<` (T-05-06 mitigation)
- Builds `stops` array: `{ lat, lon, title, excerpt, coverPhoto: p.data.coverPhoto ?? null, href: '/blog/${p.id}' }`

**HTML structure:**
- Two `<script type="application/json">` data islands: `#route-track` and `#voyage-stops`
- Map container: `<div id="voyage-map" class="h-[400px] w-full mb-12" style="z-index: 0;" aria-label="Interactive route map of the Great Loop voyage">`
- Static fallback text overwritten by Leaflet on successful init

**Client-side `<script>` block:**
- `import L from 'leaflet'` + `import 'leaflet/dist/leaflet.css'`
- Reads and `JSON.parse`s both data islands
- Stadia Outdoors tile layer with verbatim attribution (required by Stadia Maps / OSM license)
- Polyline via `L.geoJSON(routeData, { style: { color: '#1a2e4a', weight: 2, opacity: 0.7 } })` when coordinates exist
- Shared `L.divIcon`: 12x12 SVG circle, `fill="#b91c1c"`, `stroke="white"`, `stroke-width="1.5"`, `className: ''`, `popupAnchor: [0,-8]`
- Per-stop popup: conditional cover photo (`<img>` 80px tall, omitted when `null`), title at 14px/700, excerpt at 14px/400 `#6b7280`, "Read more →" link at `#b91c1c`
- `maxWidth: 280`, `autoPanPadding: L.point(20, 20)` on all popups
- `fitBounds` with `padding: [30, 30]` over polyline when route has coords
- Fallback `fitBounds` over `L.featureGroup(markers)` when route is empty and stops exist
- `if(mapEl){} guard` wraps all Leaflet initialization (Rule 1 auto-fix for top-level return bug)

### `src/pages/voyages/great-loop/index.astro`

Additive changes only — no existing markup altered:
- Added `import VoyageMap from '../../../components/VoyageMap.astro'` to frontmatter imports
- Replaced `<!-- Phase 5: interactive route map goes here -->` with `<VoyageMap />`
- Post list, heading, subtitle, empty-state block, and `max-w-[720px]` wrapper unchanged

---

## Verification Results

- `npm run build` exits 0 — 77 pages built, no errors
- `dist/voyages/great-loop/index.html` contains `id="voyage-map"`
- All acceptance criteria passed:
  - `voyage-map` container present with `h-[400px] w-full mb-12` and `z-index: 0`
  - `aria-label="Interactive route map of the Great Loop voyage"` on container
  - `<` escape present in component (T-05-06)
  - No `define:vars` anywhere in component
  - `import L from 'leaflet'` only inside `<script>` tag
  - `#1a2e4a` (polyline), `#b91c1c` (marker + link), `maxWidth: 280`, `fitBounds`, `Read more →` all present
  - Cover photo `<img>` row conditional on `coverPhoto` (no broken image when null)
  - `<VoyageMap />` in index.astro; placeholder comment removed
  - Built voyage index HTML contains `id="voyage-map"`

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Top-level `return` in Astro `<script>` block**
- **Found during:** Task 2 build verification (after index.astro wire-up)
- **Issue:** `if (!mapEl) return;` at top level of `<script>` tag. Astro (via Rolldown/Vite compilation) treats scripts as modules where top-level `return` outside a function body is a `CompilerError`. Build failed with: `[CompilerError] A 'return' statement can only be used within a function body.`
- **Fix:** Replaced early-return guard with `if (mapEl) { ... }` wrapper around all Leaflet initialization code
- **Files modified:** `src/components/VoyageMap.astro`
- **Commit:** 850c48a (included in Task 2 commit)

---

## Known Stubs

None. The component is fully wired with live data:
- Stop markers are rendered from actual `getCollection()` output (non-draft, lat/lon posts)
- Route polyline is empty because `src/data/route-track.json` has zero coordinates (intentional stub from 05-01, awaiting Nebo GPX export in 05-04)
- The empty polyline is not a stub — it is the designed graceful fallback (silent, no error state; fallback fitBounds over stop markers activates)

---

## Threat Flags

No new security surface beyond the plan's threat model:
- T-05-06 mitigated: `serialize()` escapes `<` to `<` before `set:html`
- T-05-05 mitigated: popup HTML built from build-time frontmatter only; no runtime user input concatenated
- T-05-04 accepted: Stadia Maps tile URL is a hardcoded constant, no secrets transmitted

---

## Self-Check

Verifying files and commits exist:

| Item | Status |
|------|--------|
| src/components/VoyageMap.astro | FOUND |
| src/pages/voyages/great-loop/index.astro | FOUND (modified) |
| .planning/phases/05-route-maps/05-03-SUMMARY.md | FOUND |
| commit 2e2f36c (Task 1) | FOUND |
| commit 850c48a (Task 2) | FOUND |

## Self-Check: PASSED
