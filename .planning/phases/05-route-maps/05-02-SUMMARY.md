---
phase: 05-route-maps
plan: 02
subsystem: route-maps
tags: [leaflet, maps, astro-component, client-side, accessibility]
dependency_graph:
  requires: [leaflet@1.9.4 (installed in main repo)]
  provides: [PostMiniMap.astro, conditional mini map in BlogPost.astro]
  affects: [src/layouts/BlogPost.astro, all published blog post pages]
tech_stack:
  added: [Leaflet client-side map via <script> import, Stadia Outdoors tiles, L.divIcon SVG marker]
  patterns: [data-* attribute data bridging, Number.isFinite coordinate guard, conditional Astro component render]
key_files:
  created: [src/components/PostMiniMap.astro]
  modified: [src/layouts/BlogPost.astro]
decisions:
  - "Leaflet initialized from data-lat/data-lon attributes (not define:vars) to allow bundled import L from 'leaflet' inside <script> tag"
  - "L.divIcon with inline SVG instead of default PNG marker to avoid Vite asset-hash breakage"
  - "Guard lives in BlogPost.astro (caller), not PostMiniMap.astro (callee) — component props are required, not optional"
  - "Number.isFinite guard on lat/lon before Leaflet init (T-05-03 mitigation)"
  - "node_modules symlinked from main repo to worktree to enable build verification (worktree has no independent node_modules)"
metrics:
  duration: "~18 minutes"
  completed: "2026-07-19"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
requirements_satisfied: [MAP-04, MAP-05]
---

# Phase 5 Plan 02: PostMiniMap Summary

**One-liner:** Single-pin static Leaflet mini map above post body using data-* attribute bridging, Stadia Outdoors tiles, and L.divIcon SVG marker with Number.isFinite coordinate guard.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create PostMiniMap.astro | 88ea6e8 | src/components/PostMiniMap.astro (created) |
| 2 | Render PostMiniMap in BlogPost.astro | fd43b74 | src/layouts/BlogPost.astro (modified) |

---

## What Was Built

### `src/components/PostMiniMap.astro`

A self-contained Astro component that renders a 192px (`h-48`) full-width Leaflet map with a single location pin at the post's `[lat, lon]` coordinates.

Key implementation details:
- Container div `id="post-mini-map"` carries `data-lat` and `data-lon` attributes, bridging SSR-rendered data to the client-side Leaflet script
- `<script>` tag (not `is:inline`) uses `import L from 'leaflet'` — runs in the browser via Vite bundling, never during SSR
- Map options: `dragging: false, zoomControl: false, scrollWheelZoom: false, attributionControl: true` — static location indicator, no scroll hijacking on mobile
- Tile: Stadia Outdoors (`stadia_outdoors`) with full required attribution string
- Marker: `L.divIcon` with 14x14 inline SVG (`#b91c1c` fill, `white` stroke, `className: ''` to remove default white box)
- `Number.isFinite` guard on both lat and lon before any Leaflet API calls (T-05-03 mitigation)
- Static fallback text ("Map could not load. Refresh the page to try again.") that Leaflet overwrites on successful init

### `src/layouts/BlogPost.astro`

Additive changes only — no existing markup altered:
- Added `import PostMiniMap from '../components/PostMiniMap.astro'` to frontmatter imports
- Added `lat, lon` to the existing destructure (Props interface already declared them as `lat?: number` and `lon?: number`)
- Inserted conditional render between the meta-row div and `<div class="post-body">`: `{lat !== undefined && lon !== undefined && <PostMiniMap lat={lat} lon={lon} location={location} />}`

---

## Verification Results

- `npm run build` exits 0 after both changes (77 pages built, no errors)
- 72 published posts with lat/lon render the mini map container div in HTML output
- Voyage index (`/voyages/great-loop/index.html`) has no `post-mini-map` in output
- Posts without lat/lon (4 non-rendered placeholder files) would produce no map via the guard
- No `define:vars` anywhere in PostMiniMap.astro
- All acceptance criteria met

---

## Deviations from Plan

### Auto-fixed: node_modules not present in worktree

**Found during:** Task 1 pre-flight (build verification)
**Issue:** The git worktree has no `node_modules` directory; the `leaflet` package exists only in the main repo's node_modules (installed via uncommitted changes to the main repo's package.json).
**Fix:** Created a symlink `worktree/node_modules -> /main-repo/node_modules`. This is safe — node_modules is in `.gitignore` and the symlink is not tracked by git. The worktree's package.json was not modified (plan 01 owns package.json changes).
**Files modified:** None (symlink only, not tracked)

---

## Threat Flags

No new security surface introduced beyond the plan's threat model. T-05-03 (lat/lon injection) is mitigated by `Number.isFinite` guard. T-05-04 (tile URL) is a hardcoded constant. T-05-08 (location in aria-label) is an attribute value, not innerHTML.

---

## Self-Check

Verifying files and commits exist:

| Item | Status |
|------|--------|
| src/components/PostMiniMap.astro | FOUND |
| src/layouts/BlogPost.astro | FOUND |
| .planning/phases/05-route-maps/05-02-SUMMARY.md | FOUND |
| commit 88ea6e8 (Task 1) | FOUND |
| commit fd43b74 (Task 2) | FOUND |

## Self-Check: PASSED
