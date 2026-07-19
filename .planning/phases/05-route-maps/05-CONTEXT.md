# Phase 5: Route Maps - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an interactive full-route map to the voyage index page and a per-post mini map pin to each individual blog post. All map components use `client:only` hydration (Leaflet + Stadia Maps tiles, already decided). Includes a one-time GPX processing script to produce a GeoJSON route polyline from Nebo app exports.

</domain>

<decisions>
## Implementation Decisions

### Map Placement & Layout
- **D-01:** Route map sits **above the post list** on `/voyages/great-loop/index.astro`. The existing placeholder comment `<!-- Phase 5: interactive route map goes here -->` marks the exact insertion point.
- **D-02:** Map height is **400px** on desktop, full-width. Standard responsive collapse for mobile.

### Stop Markers (Full Route Map)
- **D-03:** Show markers only for **published (non-draft) posts** (~77). Draft stubs do not appear on the map — every marker must link to real content.
- **D-04:** Marker popup shows: **cover photo + title + excerpt + link to post**. Matches the visual weight of the post list cards below the map.

### Per-Post Mini Map
- **D-05:** Every published post with `lat`/`lon` frontmatter gets a **mini map** showing a single pin at that day's centroid.
- **D-06:** Mini map appears **at the top of the post, before the body content**. Reader sees location first, then reads.
- **D-07:** Mini map shows only the **single stop pin** — no full route polyline, no nearby stops. Simple and fast.
- **D-08:** Posts without `lat`/`lon` get no mini map (graceful omission, no placeholder).

### GPX Track / Route Polyline
- **D-09:** Phase 5 includes a pipeline script to process Nebo GPX exports into a GeoJSON polyline for MAP-02.
- **D-10:** GPX files from Nebo app should be exported and placed in **`.planning/data/gpx/`** before execution. This is a human prerequisite step (Nebo app → Settings → Trips → Export GPX).
- **D-11:** The Nebo logs we already have (162 email PDFs) contain stats only — no GPS track coordinates. The GPX export from the app is the only source for the actual route polyline.
- **D-12:** GeoJSON output goes to `src/data/route-track.json` (originally `.planning/data/route-track.json` — path updated during planning: Vite handles `src/data/` as a build-time import cleanly, while `.planning/data/` would require a `public/` copy step; the intent of build-time consumption is unchanged) and is consumed by the Astro map component at build time via `import routeData from '../data/route-track.json'`.

### Claude's Discretion
- Map tile style / zoom level / initial bounds — fit the Great Loop route automatically on load.
- Marker icon design — keep it simple (default Leaflet markers or minimal custom SVG).
- GPX simplification tolerance — balance visual accuracy vs. file size.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §MAP-01 through MAP-05 — Full map requirements (Leaflet, Stadia, client:only, clickable markers, per-post mini map)

### Existing Code — Integration Points
- `src/pages/voyages/great-loop/index.astro` — Route map insertion point (placeholder comment line); already loads all non-draft great-loop posts with lat/lon/excerpt/location
- `src/pages/blog/[...id].astro` — Post page; renders `<BlogPost>` layout; mini map component slots in here
- `src/layouts/BlogPost.astro` — Read to find where mini map fits in the post layout
- `src/content.config.ts` — Confirms `lat`, `lon`, `draft`, `excerpt`, `coverPhoto` field names and types

### Data Sources
- `.planning/data/voyage-timeline-enriched.json` — 560 days with `centroidLat`/`centroidLon`; used to verify lat/lon coverage
- `.planning/data/gpx/` — **Prerequisite:** Nebo GPX exports land here before execution (directory may not exist yet)

### Prior Phase Decisions
- `.planning/phases/04-data-pipeline/04-CONTEXT.md` — D-08 (lat/lon backfill), D-09 (stub structure); confirms which posts now have lat/lon

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Gallery.astro` — Pattern for `client:only`-style component with props passed from MDX; Leaflet map components follow the same `client:only="react"` (or `svelte`) pattern
- `src/components/VoyageStats.astro` — Example of a component that gracefully handles missing data (renders nothing when props absent); mini map should do the same for posts without lat/lon

### Established Patterns
- **`client:only` for interactive components** — decided in Phase 1/ROADMAP (MAP-05). All Leaflet components must use this directive; no SSR.
- **Tailwind for layout** — all pages use Tailwind utility classes; map container sizing (`h-[400px] w-full`) follows this pattern
- **No self-hosted images** — photos are `file://` local paths currently (to be migrated in Phase 6); cover photos in map popups will need to reference whatever the `coverPhoto` frontmatter field contains

### Integration Points
- Full route map component slots into `voyages/great-loop/index.astro` at the placeholder comment
- Mini map component slots into `blog/[...id].astro` or `layouts/BlogPost.astro` above `<Content />`
- Route GeoJSON (`.planning/data/route-track.json`) imported as a static asset or fetched at runtime by the Leaflet component

</code_context>

<specifics>
## Specific Ideas

- Map above list at 400px height is the canonical layout — no sidebar variant
- Every map marker must link to a real post (no stub markers)
- Popup is rich: photo + title + excerpt + link (not minimal)
- Mini map = single pin only, no context route — keep it fast

</specifics>

<deferred>
## Deferred Ideas

- Full route visible on per-post mini map (showing the whole voyage with the current stop highlighted) — possible future enhancement, adds complexity and data weight per page
- Filtering/clustering markers by date range or segment — new capability, own phase
- Map on the main homepage — out of scope for Phase 5 (voyage index only)

</deferred>

---

*Phase: 5-Route Maps*
*Context gathered: 2026-07-18*
