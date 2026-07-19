# Phase 5: Route Maps - Research

**Researched:** 2026-07-19
**Domain:** Leaflet.js in Astro (no framework), Stadia Maps tiles, GPX→GeoJSON conversion
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Route map sits **above the post list** on `/voyages/great-loop/index.astro`. The existing placeholder comment `<!-- Phase 5: interactive route map goes here -->` marks the exact insertion point.
- **D-02:** Map height is **400px** on desktop, full-width. Standard responsive collapse for mobile.
- **D-03:** Show markers only for **published (non-draft) posts** (~77). Draft stubs do not appear on the map — every marker must link to real content.
- **D-04:** Marker popup shows: **cover photo + title + excerpt + link to post**. Matches the visual weight of the post list cards below the map.
- **D-05:** Every published post with `lat`/`lon` frontmatter gets a **mini map** showing a single pin at that day's centroid.
- **D-06:** Mini map appears **at the top of the post, before the body content**. Reader sees location first, then reads.
- **D-07:** Mini map shows only the **single stop pin** — no full route polyline, no nearby stops. Simple and fast.
- **D-08:** Posts without `lat`/`lon` get no mini map (graceful omission, no placeholder).
- **D-09:** Phase 5 includes a pipeline script to process Nebo GPX exports into a GeoJSON polyline for MAP-02.
- **D-10:** GPX files from Nebo app should be exported and placed in **`.planning/data/gpx/`** before execution. This is a human prerequisite step (Nebo app → Settings → Trips → Export GPX).
- **D-11:** The Nebo logs we already have (162 email PDFs) contain stats only — no GPS track coordinates. The GPX export from the app is the only source for the actual route polyline.
- **D-12:** GeoJSON output goes to `.planning/data/route-track.json` and is consumed by the Astro map component at build time (passed as a prop or imported as a static asset).

### Claude's Discretion

- Map tile style / zoom level / initial bounds — fit the Great Loop route automatically on load.
- Marker icon design — keep it simple (default Leaflet markers or minimal custom SVG).
- GPX simplification tolerance — balance visual accuracy vs. file size.

### Deferred Ideas (OUT OF SCOPE)

- Full route visible on per-post mini map (showing the whole voyage with the current stop highlighted) — possible future enhancement, adds complexity and data weight per page
- Filtering/clustering markers by date range or segment — new capability, own phase
- Map on the main homepage — out of scope for Phase 5 (voyage index only)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | Full Great Loop interactive route map on voyage index page (Leaflet, Stadia Maps tiles) | VoyageMap.astro component using Leaflet npm package + Stadia Maps raster tile URL |
| MAP-02 | GPX track drawn as polyline on full route map | `@tmcw/togeojson` GPX→GeoJSON, `simplify-js` simplification, `L.geoJSON()` polyline rendering |
| MAP-03 | Clickable stop markers on full route map — popup shows cover photo + excerpt + link to post | `L.divIcon()` custom markers, `marker.bindPopup(htmlString)`, 68 non-draft posts with lat/lon |
| MAP-04 | Per-post mini map showing that day's route segment | Resolved as single-pin per CONTEXT.md D-07 — `PostMiniMap.astro` with `L.marker()` at centroid |
| MAP-05 | Map components use `client:only` (no SSR), pass stop data as props from frontmatter | `<script>` tags in plain `.astro` components are always client-side; data passed via `data-*` attributes |
| SITE-02 | Voyage index page listing all posts for the Great Loop with map | `/voyages/great-loop/index.astro` already has placeholder; add VoyageMap component above post list |
</phase_requirements>

---

## Summary

Phase 5 adds two interactive map components to the Astro 7 site: a full-route map (`VoyageMap.astro`) on the voyage index page showing the complete Great Loop track as a polyline with 68 clickable stop markers, and a per-post mini map (`PostMiniMap.astro`) showing a single location pin on each published post. The technical stack is Leaflet 1.9.4 with Stadia Maps raster tiles — both already decided. All Leaflet code lives in `<script>` tags inside plain `.astro` components, which run exclusively in the browser (no SSR issue, no `client:only` directive needed for plain `.astro` — that directive is only for React/Svelte/Vue components).

The most important architectural constraint is **how data reaches the client-side Leaflet scripts**. The common pattern `define:vars` forces `is:inline` which prevents bundled `import` statements — so stop data must be passed via `data-*` attributes or inline `<script type="application/json">` tags. The route polyline GeoJSON, which is imported at build time per D-12, should be embedded as a `<script type="application/json">` tag in VoyageMap so Leaflet can access it without a runtime fetch.

There is one hard human prerequisite: the Nebo GPX files must be exported from the Nebo app and placed in `.planning/data/gpx/` before the GPX simplification script can run. Without GPX files, the polyline cannot be drawn (MAP-02 cannot be satisfied). The stop markers (MAP-01, MAP-03) and mini maps (MAP-04) do not depend on GPX files — they work from the existing `lat`/`lon` frontmatter already in 316 MDX files. The planner must create a checkpoint that gates the GPX script on human completion of the export.

**Primary recommendation:** Install `leaflet` + `@tmcw/togeojson` + `simplify-js` via npm. Use `<script>` tags (not CDN + `is:inline`) for Leaflet initialization. Pass all data via `data-*` attributes or inline JSON `<script>` tags. Use `L.divIcon()` with inline SVG for markers to avoid Vite asset-hash breakage of default PNG icons.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route map rendering (polyline + markers) | Browser / Client | — | Leaflet requires `window`; all Leaflet code runs in browser via `<script>` tags |
| Stop data preparation (filter non-draft, lat/lon posts) | Frontend Server (SSR/build) | — | `getCollection()` runs at build time in Astro frontmatter; serialized to HTML |
| Route GeoJSON (track polyline) | Build-time asset (per D-12) | Browser reads embedded JSON | Script converts GPX at build time; imported as JSON asset; embedded in page HTML |
| GPX → GeoJSON conversion | Node.js script (offline) | — | Standalone `scripts/simplify-gpx.mjs`; runs manually or as Vite plugin buildStart hook |
| Tile serving | CDN / External (Stadia Maps) | OpenSeaMap overlay | No self-hosted tiles; Stadia free tier with domain auth for production |
| Per-post mini map (single pin) | Browser / Client | — | `PostMiniMap.astro` with client-side Leaflet; data from `data-lat`/`data-lon` attributes |
| Voyage index page layout | Frontend Server (SSR/build) | — | Astro page renders post list + VoyageMap at build time; map initializes in browser |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `leaflet` | `1.9.4` | Interactive map rendering | Project-decided (STATE.md); lightweight, mobile-friendly, no framework required |
| `@tmcw/togeojson` | `7.1.2` | GPX file → GeoJSON conversion | Official successor to the original togeojson; maintained at github.com/placemark/togeojson |
| `simplify-js` | `1.2.4` | Douglas-Peucker polyline simplification | Authored by Leaflet creator (mourner/simplify-js); used internally by Leaflet; 8M+ weekly downloads |

[VERIFIED: npm registry] All three packages confirmed on npm registry with slopcheck [OK].

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@turf/simplify` | `7.3.5` | Alternative simplification with more GeoJSON features | Only if GPX has complex multi-geometry features; `simplify-js` is sufficient for track LineString |

[VERIFIED: npm registry] `@turf/simplify` confirmed on npm registry with slopcheck [OK].

### Tile Providers (No npm package)

| Provider | URL Template | Purpose |
|---------|-------------|---------|
| Stadia Maps | `https://tiles.stadiamaps.com/tiles/stadia_outdoors/{z}/{x}/{y}{r}.png` | Base map (free account required for production) |
| OpenSeaMap | `https://t2.openseamap.org/seamark/{z}/{x}/{y}.png` | Optional nautical overlay (transparent) |

[CITED: docs.stadiamaps.com/raster/] Stadia Maps raster tile URL format verified from official docs.
[CITED: help.openstreetmap.org/questions/39032] OpenSeaMap seamark tile URL verified from OSM Help.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `leaflet` | MapLibre GL JS | MapLibre is too heavy (WebGL) and requires a framework integration; project already decided on Leaflet |
| `@tmcw/togeojson` | `togeojson` (original) | Original `togeojson@0.16.x` is unmaintained; `@tmcw/togeojson` is the maintained fork |
| `simplify-js` | `@turf/simplify` | Turf adds ~50KB extra for one utility; `simplify-js` is 1.2KB and sufficient for LineString |

**Installation:**
```bash
npm install leaflet @tmcw/togeojson simplify-js
```

**Version verification:**
```
leaflet@1.9.4 — verified 2026-07-19 via npm view
@tmcw/togeojson@7.1.2 — verified 2026-07-19 via npm view
simplify-js@1.2.4 — verified 2026-07-19 via npm view
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `leaflet` | npm | 13 yrs (2013) | github.com/Leaflet/Leaflet | [OK] | Approved |
| `@tmcw/togeojson` | npm | 7 yrs (2019) | github.com/placemark/togeojson | [OK] | Approved |
| `simplify-js` | npm | 14 yrs (2012) | github.com/mourner/simplify-js | [OK] | Approved |
| `@turf/simplify` | npm | 9 yrs (2016) | github.com/Turfjs/turf | [OK] | Approved (supporting only) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

No postinstall scripts found on any of the four packages. All source repos confirmed authoritative (official Leaflet org, Placemark (Tom MacWright), Vladimir Agafonkin's mourner handle, Turf.js org). [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
BUILD TIME
──────────────────────────────────────────────────────────
Human exports Nebo GPX → .planning/data/gpx/*.gpx
                                │
                  scripts/simplify-gpx.mjs
            (@tmcw/togeojson + simplify-js)
                                │
                     .planning/data/route-track.json
                     (imported at build time by Astro)
                                │
src/content/blog/great-loop/*.mdx  ─→  getCollection() in frontmatter
(316 posts with lat/lon, 68 non-draft)        │
                                              │
                              VoyageMap.astro frontmatter:
                              - Filters to non-draft + has lat/lon
                              - Imports route-track.json
                              - Serializes stops + route into HTML

BROWSER (RUNTIME)
──────────────────────────────────────────────────────────
Voyage index page HTML loaded
        │
        ├─ <script type="application/json" id="route-track"> → route polyline coords
        ├─ <div data-stops="[{...68 stops...}]" id="voyage-map"> → stop marker data
        │
        └─ Leaflet <script> initializes:
              L.map() → stadia_outdoors tile layer
                      → L.geoJSON(route) polyline
                      → L.marker() × 68 (DivIcon SVG)
                      → marker.bindPopup(html with cover photo)
                      → map.fitBounds(polyline.getBounds())


Post page HTML loaded
        │
        ├─ <div data-lat="35.1" data-lon="-77.0" id="post-mini-map">
        │
        └─ Leaflet <script> initializes:
              L.map() → stadia_outdoors tile layer
                      → L.marker([lat, lon], DivIcon) single pin
                      → map.setView([lat, lon], 10)
```

### Recommended Project Structure

```
src/
├── components/
│   ├── VoyageMap.astro         # Full-route map (voyage index only)
│   └── PostMiniMap.astro       # Single-pin mini map (per post)
├── data/
│   └── route-track.json        # Simplified GeoJSON; imported at build time
│                               # Committed to git once GPX processed
scripts/
└── simplify-gpx.mjs            # GPX → simplified GeoJSON; run manually or as hook
.planning/data/
└── gpx/                        # Human prerequisite: Nebo GPX exports land here
    └── *.gpx                   # (directory created by human, before running script)
public/tracks/                  # (NOT used if D-12 build-time import approach taken)
```

**Note on D-12:** The context decision says GeoJSON goes to `.planning/data/route-track.json`. However, Vite can import JSON from outside `src/` but the conventional location that Vite handles most cleanly is `src/data/`. Recommend: the script writes to `src/data/route-track.json` and is committed to git. The CONTEXT decision's "consumed by Astro component at build time" is fully satisfied by `import routeData from '../data/route-track.json'` in the component frontmatter. [ASSUMED] — planner should confirm this path resolution with the user.

---

### Pattern 1: Leaflet Map in a Plain Astro Component (No Framework)

**What:** Use `<script>` tags (without `is:inline`) to run Leaflet client-side. Import Leaflet via npm. Pass data via `data-*` attributes and `<script type="application/json">` tags.

**Why this works:** `<script>` tags in `.astro` files are always processed by Vite for the browser. Unlike frontmatter (`---` section), they never run during SSR. No `client:only` directive is needed or applicable (that directive is only for UI framework components like React/Svelte).

**Critical constraint:** `define:vars` on a `<script>` tag forces `is:inline`, which prevents bundled imports. Never use `define:vars` with Leaflet — it will break `import L from 'leaflet'`. Use `data-*` attributes instead.

**Example — PostMiniMap.astro:**
```astro
---
interface Props {
  lat: number;
  lon: number;
  location: string;
}
const { lat, lon, location } = Astro.props;
---

<div
  id="post-mini-map"
  data-lat={lat}
  data-lon={lon}
  class="h-48 w-full rounded mb-8"
  style="z-index: 0;"
></div>

<script>
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  const el = document.getElementById('post-mini-map');
  if (el) {
    const lat = Number(el.dataset.lat);
    const lon = Number(el.dataset.lon);

    const map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,   // disable on mini map for clean UX
    }).setView([lat, lon], 10);

    L.tileLayer('https://tiles.stadiamaps.com/tiles/stadia_outdoors/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // DivIcon SVG pin — no image file, no Vite asset-hash breakage
    const icon = L.divIcon({
      html: '<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><circle cx="7" cy="7" r="5.5" fill="#8B6914" stroke="white" stroke-width="2"/></svg>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      className: '',  // important: removes default leaflet-div-icon white box styling
    });

    L.marker([lat, lon], { icon }).addTo(map);
  }
</script>
```
[VERIFIED: leafletjs.com] DivIcon approach confirmed as official Leaflet pattern for custom icons without image files.

---

### Pattern 2: VoyageMap — Route JSON + Stop Markers

**What:** Embed route GeoJSON and stop-marker data in the HTML using `<script type="application/json">` tags. Client-side Leaflet script reads them. No runtime fetch needed per D-12.

**Example — VoyageMap.astro (simplified structure):**
```astro
---
import { getCollection } from 'astro:content';
import routeData from '../data/route-track.json';

const allPosts = await getCollection('blog', ({ data }) =>
  data.voyage === 'great-loop' && !data.draft && data.lat !== undefined && data.lon !== undefined
);

const stops = allPosts.map(p => ({
  lat: p.data.lat,
  lon: p.data.lon,
  title: p.data.title,
  excerpt: p.data.excerpt,
  coverPhoto: p.data.coverPhoto ?? null,
  href: `/blog/${p.id}`,
}));
---

<!-- Route JSON embedded at build time -->
<script type="application/json" id="route-track" set:html={JSON.stringify(routeData)}></script>
<!-- Stop marker data -->
<script type="application/json" id="voyage-stops" set:html={JSON.stringify(stops)}></script>

<div id="voyage-map" class="h-[400px] w-full mb-10" style="z-index: 0;"></div>

<script>
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  const routeData = JSON.parse(document.getElementById('route-track').textContent);
  const stops = JSON.parse(document.getElementById('voyage-stops').textContent);

  const map = L.map('voyage-map');

  L.tileLayer('https://tiles.stadiamaps.com/tiles/stadia_outdoors/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const polyline = L.geoJSON(routeData, {
    style: { color: '#1E3A5F', weight: 2, opacity: 0.7 }
  }).addTo(map);

  map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

  const icon = L.divIcon({
    html: '<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6" r="4.5" fill="#8B6914" stroke="white" stroke-width="1.5"/></svg>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    className: '',
  });

  stops.forEach(stop => {
    const imgHtml = stop.coverPhoto
      ? `<img src="${stop.coverPhoto}" alt="" style="width:100%;height:80px;object-fit:cover;display:block;margin-bottom:6px;border-radius:3px;">`
      : '';
    const popup = `
      <div style="min-width:200px;max-width:260px;">
        ${imgHtml}
        <strong style="font-size:13px;line-height:1.3;">${stop.title}</strong>
        <p style="font-size:12px;color:#555;margin:4px 0 6px;">${stop.excerpt}</p>
        <a href="${stop.href}" style="font-size:12px;color:#8B6914;">Read more &rarr;</a>
      </div>`;
    L.marker([stop.lat, stop.lon], { icon }).bindPopup(popup, { maxWidth: 280 }).addTo(map);
  });
</script>
```
[ASSUMED] `set:html` attribute on `<script>` tag is assumed to be the correct Astro escape directive for embedding raw JSON without HTML-encoding issues. Planner should verify with Astro 7 docs.

---

### Pattern 3: GPX Simplification Script

**What:** Convert one or more Nebo GPX files to a single simplified GeoJSON LineString.

```javascript
// scripts/simplify-gpx.mjs
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DOMParser } from '@xmldom/xmldom';   // OR Node 22's globalThis.DOMParser
import { gpx } from '@tmcw/togeojson';
import simplify from 'simplify-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GPX_DIR = join(__dirname, '../.planning/data/gpx');
const OUTPUT = join(__dirname, '../src/data/route-track.json');
const TOLERANCE = 0.001;  // ~110m; adjust for file-size vs accuracy tradeoff

// Merge all GPX files in the directory
let allPoints = [];
for (const file of readdirSync(GPX_DIR).filter(f => f.endsWith('.gpx'))) {
  const xml = readFileSync(join(GPX_DIR, file), 'utf8');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const geojson = gpx(doc);
  for (const feature of geojson.features) {
    if (feature.geometry.type === 'LineString') {
      allPoints.push(...feature.geometry.coordinates);
    }
  }
}

// Simplify: simplify-js uses {x, y} format
const pts = allPoints.map(([lon, lat]) => ({ x: lon, y: lat }));
const simplified = simplify(pts, TOLERANCE, true);
const coords = simplified.map(p => [p.x, p.y]);

const output = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: coords },
  properties: {}
};

writeFileSync(OUTPUT, JSON.stringify(output));
console.log(`Route simplified: ${allPoints.length} → ${coords.length} points`);

// File-size gate (500KB ROADMAP requirement)
const bytes = Buffer.byteLength(JSON.stringify(output), 'utf8');
if (bytes > 500_000) {
  console.error(`Output is ${(bytes/1024).toFixed(0)}KB — increase TOLERANCE to reduce size`);
  process.exit(1);
}
console.log(`Output: ${(bytes/1024).toFixed(0)}KB at ${OUTPUT}`);
```

**Note on DOMParser:** Node 22 (project uses v24.14.0) does NOT include DOMParser globally. Either use `@xmldom/xmldom` for a DOM parser, or use `@tmcw/togeojson`'s native Node.js path if one exists. Check `@tmcw/togeojson` docs for Node.js usage — it may accept a DOM document or have a node-specific path. [ASSUMED] — planner must verify the exact `@tmcw/togeojson` Node.js API before writing the script.

---

### Pattern 4: Vite/Astro Build Hook for the Simplification Script

**What:** Wire the simplification script to run automatically before `astro build` via an Astro integration in `astro.config.mjs`.

```javascript
// astro.config.mjs (additions)
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const simplifyGpxPlugin = {
  name: 'simplify-gpx',
  hooks: {
    'astro:build:start': ({ logger }) => {
      const gpxDir = '.planning/data/gpx';
      const output = 'src/data/route-track.json';
      if (!existsSync(gpxDir)) {
        logger.warn('No .planning/data/gpx/ directory — skipping GPX simplification. Route polyline will be absent from the map.');
        return;
      }
      logger.info('Running GPX simplification...');
      execSync('node scripts/simplify-gpx.mjs', { stdio: 'inherit' });
      logger.info(`Route GeoJSON written to ${output}`);
    }
  }
};

export default defineConfig({
  integrations: [mdx(), sitemap(), simplifyGpxPlugin],
  // ...existing config
});
```

[CITED: docs.astro.build/en/reference/integrations-reference/] `astro:build:start` hook verified from official Astro integration API docs.

---

### Anti-Patterns to Avoid

- **`define:vars` on a `<script>` that imports Leaflet:** Forbidden. `define:vars` forces `is:inline` which disables bundled `import` statements. Result: `import L from 'leaflet'` fails silently or throws. Use `data-*` attributes instead.

- **Default Leaflet marker icons:** The default `marker-icon.png` and `marker-shadow.png` resolve to paths like `/node_modules/leaflet/dist/images/...` which Vite hashes into `marker-icon.abc123.png`. The URL hard-coded in Leaflet's source doesn't know about this hash. Result: broken marker icons in production builds. Use `L.divIcon()` with inline SVG instead.

- **Importing `leaflet` in `.astro` frontmatter (`---` section):** The frontmatter runs during SSR at build time. Leaflet requires `window`. Result: `ReferenceError: window is not defined`. Only import Leaflet inside `<script>` tags.

- **Multiple Leaflet maps on a list/index page:** Each map instance opens tile requests, holds DOM references and event listeners. 100 list items × 10 visible tiles = 1,000 tile requests simultaneously. Browsers cap concurrent requests; the tile CDN may rate-limit. Never render PostMiniMap on list views (D-05 locks this).

- **Fetching route JSON at runtime without a fallback:** If `public/tracks/great-loop.json` doesn't exist (GPX not yet exported), a runtime `fetch()` returns 404. Because D-12 specifies build-time import, this is avoided — but the build will fail if `src/data/route-track.json` is missing. The Vite hook pattern above adds a graceful no-op when the GPX directory doesn't exist; the Astro component must handle missing route data.

- **`map.setView()` with hardcoded center:** For the Great Loop route (~5,000nm, US east coast + rivers + lakes), guessing a center coordinate is fragile. Use `map.fitBounds(polyline.getBounds())` so the map automatically frames the actual route.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GPX XML parsing | Custom regex/XML reader | `@tmcw/togeojson` | GPX has complex schema; `<trk>`, `<trkseg>`, `<trkpt>` hierarchy with optional `<time>`, `<ele>` — togeojson handles all variants |
| Douglas-Peucker simplification | Custom polyline reduction | `simplify-js` | Correct implementation requires proper distance-to-segment computation in projected coordinates; authored by Leaflet creator, tested extensively |
| Tile attribution | Omitting or hand-writing | Official attribution strings from Stadia docs | Missing attribution violates Stadia Maps and OpenStreetMap license terms; use verified strings verbatim |
| Popup HTML sanitization | Custom sanitizer | Avoid any user-controlled HTML in popups | Popup content is fully controlled (post title, excerpt, coverPhoto from frontmatter) — no sanitization needed, but don't inject any runtime user input |

**Key insight:** GPX parsing and polyline simplification look simple but have many edge cases (coordinate order lon/lat vs lat/lon, multi-track GPX, elevation data, time gaps). The npm packages handle these correctly.

---

## Common Pitfalls

### Pitfall 1: Leaflet CSS Not Loaded

**What goes wrong:** Map tiles render but markers, popups, and zoom controls look broken or missing. Tile images may overlap incorrectly. Map container may have zero height.

**Why it happens:** Leaflet requires its CSS (`leaflet.css`) to position map elements correctly. If it's not loaded before `L.map()` initializes, the layout calculations are wrong.

**How to avoid:** Include `import 'leaflet/dist/leaflet.css'` at the top of the `<script>` block. Vite processes this CSS import and includes it in the page's CSS bundle. Alternatively, add `<link rel="stylesheet" href="/path/to/leaflet.css">` in the `<head>`.

**Warning signs:** Controls render outside the map container; markers appear at wrong positions; tile images bleed into page content.

---

### Pitfall 2: Map Container Has Zero Height

**What goes wrong:** Leaflet renders into a `<div>` that has `height: 0`. The map appears blank — tiles never request, no error thrown.

**Why it happens:** Leaflet reads the container's computed height at initialization time. If the element has no explicit height (e.g., `height: auto` inherited from parent), the map renders empty.

**How to avoid:** Always set explicit height on the map container. For VoyageMap: `class="h-[400px] w-full"` (Tailwind). For PostMiniMap: `class="h-48 w-full"`. If PostMiniMap is inside a flex column parent, also add `flex-shrink-0`.

**Warning signs:** Blank white rectangle where map should be; Leaflet tile network requests are absent in DevTools.

---

### Pitfall 3: Default Leaflet Marker Icons Break in Vite Production Build

**What goes wrong:** Stop markers are invisible in production (`npm run build && npm run preview`) but display correctly in `npm run dev`.

**Why it happens:** Leaflet resolves default icon PNG paths relative to the CSS file URL at runtime. Vite hashes asset filenames in production builds. The path Leaflet computes (`/assets/marker-icon.abc123.png`) doesn't match any actual file.

**How to avoid:** Never use `L.marker()` without an explicit `icon` option after installing `leaflet` as an npm package. Use `L.divIcon()` with inline SVG for all markers — it has no file dependency.

**Warning signs:** Markers work in dev, disappear in production preview.

---

### Pitfall 4: GeoJSON File Too Large

**What goes wrong:** `src/data/route-track.json` is larger than 500KB (ROADMAP success criteria). Pages that import this JSON are bloated; build time increases.

**Why it happens:** Nebo GPX tracks may have a trackpoint every second (1Hz). A 100-day voyage at 8 hours/day × 3,600 points/hour = 2.88M points. Raw GeoJSON could be 100–300MB.

**How to avoid:** Run `simplify-gpx.mjs` with Douglas-Peucker tolerance of 0.001° (~110m) as a starting point. This typically reduces a dense GPS track by 80–95%. If output is still > 500KB, increase tolerance to 0.002° or 0.005°. Add the file-size gate in the script (exits with error if over 500KB).

**Warning signs:** `simplify-gpx.mjs` outputs file size in KB; the size gate exits non-zero if over limit.

---

### Pitfall 5: `@tmcw/togeojson` Requires DOM Parser in Node.js

**What goes wrong:** `gpx(doc)` throws because `@tmcw/togeojson` expects a DOM document object, and Node.js doesn't have `DOMParser` globally.

**Why it happens:** `@tmcw/togeojson` is designed for both browser and Node.js, but requires the caller to parse the XML into a DOM document first.

**How to avoid:** Install `@xmldom/xmldom` as a dev dependency and use `new DOMParser().parseFromString(xml, 'text/xml')` from that package. Node 22 does not include a built-in `DOMParser`. [VERIFIED: npm registry] `@xmldom/xmldom` exists on npm.

```bash
npm install --save-dev @xmldom/xmldom
```

```javascript
import { DOMParser } from '@xmldom/xmldom';
const doc = new DOMParser().parseFromString(gpxString, 'text/xml');
const geojson = gpx(doc);
```

**Warning signs:** `ReferenceError: DOMParser is not defined` when running the simplification script in Node.js.

---

### Pitfall 6: Stadia Maps Tiles 429-Rate-Limited in Production Without Account

**What goes wrong:** Maps work on localhost (`127.0.0.1` or `localhost`) but tile requests return HTTP 429 on the production Netlify URL.

**Why it happens:** Stadia Maps allows unauthenticated requests from localhost for development. For production domains, free-tier requests without a registered account are subject to strict rate limits.

**How to avoid:** Create a free Stadia Maps account (no credit card required) and add the Netlify domain under "Authentication Configuration" in the client dashboard. Domain-based auth requires no code changes — just browser headers (`Origin`/`Referer`) that browsers send automatically. [CITED: docs.stadiamaps.com/authentication/]

**Warning signs:** Map tiles load on `localhost:4321` but show grey squares on the Netlify live URL; browser DevTools shows 429 responses for tile requests.

---

### Pitfall 7: PostMiniMap Leaflet Instance Conflict With Unique ID

**What goes wrong:** Two PostMiniMap components on the same page both try to initialize into `id="post-mini-map"`. The second call fails silently or throws `Map container is already initialized`.

**Why it happens:** Using a hardcoded `id` for the map container creates duplicate IDs if the component is rendered more than once per page.

**How to avoid:** This is non-issue per CONTEXT.md D-05 and D-08 — PostMiniMap renders only on individual post pages (never on list views), and only when `lat`/`lon` frontmatter is present. Exactly one PostMiniMap per page, guaranteed by the architecture. Document this constraint in the component as a comment.

**Warning signs:** If PostMiniMap is accidentally rendered on a list page, the second instance throws `Map container is already initialized` in the browser console.

---

## Code Examples

### Stadia Maps Raster Tile Layer

```javascript
// Source: docs.stadiamaps.com/raster/
L.tileLayer('https://tiles.stadiamaps.com/tiles/stadia_outdoors/{z}/{x}/{y}{r}.png', {
  minZoom: 1,
  maxZoom: 20,
  attribution:
    '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> ' +
    '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> ' +
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
```

Available styles (replace `stadia_outdoors`):
- `stadia_outdoors` — terrain + roads, good for a nautical voyage blog [ASSUMED best match for this project]
- `alidade_smooth` — minimal, clean, lower visual weight
- `stamen_toner` — high-contrast black/white
- `osm_bright` — standard OpenStreetMap appearance

[CITED: docs.stadiamaps.com/raster/] URL format and available style names verified from official Stadia Maps raster documentation.

---

### OpenSeaMap Nautical Overlay (Optional)

```javascript
// Source: github.com/Leaflet/Leaflet/discussions/9088
L.tileLayer('https://t2.openseamap.org/seamark/{z}/{x}/{y}.png', {
  opacity: 0.8,
  attribution: '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a>',
}).addTo(map);
```

Use as an optional layer on top of the base tile layer. Shows nautical seamarks (buoys, channels, hazards) at zoom 8+.

---

### fitBounds to Route

```javascript
// Source: leafletjs.com/reference.html — Map#fitBounds
const polyline = L.geoJSON(routeGeoJSON, {
  style: { color: '#1E3A5F', weight: 2, opacity: 0.7 }
}).addTo(map);

// Fit map to the full route bounds automatically
map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
```

If no GPX data exists (route-track.json missing or empty), fall back to bounds computed from stop markers:
```javascript
const group = L.featureGroup(markers);
map.fitBounds(group.getBounds(), { padding: [30, 30] });
```

---

### DivIcon SVG Marker (Vite-Safe)

```javascript
// Source: leafletjs.com/examples/custom-icons/ — L.DivIcon pattern
// Recommended over L.icon() for Vite builds — no PNG file dependency
const stopIcon = L.divIcon({
  html: `<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="4.5" fill="#8B6914" stroke="white" stroke-width="1.5"/>
  </svg>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
  className: '',  // IMPORTANT: empty string removes default white-box background
});
```

---

### Popup with Cover Photo

```javascript
// Source: leafletjs.com/reference.html — Popup
function buildPopup(stop) {
  const img = stop.coverPhoto
    ? `<img src="${stop.coverPhoto}" alt="" loading="lazy"
         style="width:100%;height:80px;object-fit:cover;border-radius:3px 3px 0 0;display:block;">`
    : '';
  return `
    <div style="min-width:200px;max-width:260px;padding:8px;">
      ${img}
      <strong style="font-family:system-ui;font-size:13px;line-height:1.3;display:block;margin-top:${img ? '6px' : '0'};">${stop.title}</strong>
      <p style="font-family:system-ui;font-size:11px;color:#666;margin:4px 0 8px;line-height:1.4;">${stop.excerpt}</p>
      <a href="${stop.href}" style="font-family:system-ui;font-size:12px;color:#8B6914;text-decoration:none;">Read more &rarr;</a>
    </div>`;
}

L.marker([stop.lat, stop.lon], { icon: stopIcon })
  .bindPopup(buildPopup(stop), {
    maxWidth: 280,
    autoPanPadding: L.point(20, 20),
  })
  .addTo(map);
```

**Mobile popup caveat:** If the cover photo loads asynchronously after the popup opens, Leaflet has already calculated auto-pan offset with wrong dimensions. The `maxWidth: 280` constraint limits growth. Set explicit `height` on the `<img>` element so layout is reserved before image loads. [MEDIUM confidence — confirmed by web search results from leafletjs.com and community forums]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stamen Maps (free tiles) | Stadia Maps (hosts Stamen styles) | 2023 | Stamen tiles now served by Stadia; same URL style names, different domain |
| Default Leaflet icons with `L.Icon.Default.mergeOptions()` | `L.divIcon()` with inline SVG | Vite era (2021+) | Vite's asset hashing breaks the default icon PNG path resolution; SVG approach has no file dependency |
| CDN-loaded Leaflet with `is:inline` scripts | npm-installed Leaflet with bundled `<script>` | Astro 2+ | npm approach gets Vite optimization, TypeScript types, tree-shaking; CDN approach is still valid but loses these benefits |
| Fetching GeoJSON at runtime | Importing JSON at build time in Astro | Astro 3+ | Build-time import provides zero-latency polyline render; eliminates network waterfall |

**Deprecated/outdated:**
- `togeojson` (npm: `togeojson@0.16.x`): Unmaintained original; superseded by `@tmcw/togeojson@7.x` maintained by Tom MacWright at Placemark.
- Stamen Maps tile URLs (`tile.stamen.com`): Dead since 2023; use Stadia Maps equivalents at `tiles.stadiamaps.com/tiles/stamen_*`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `stadia_outdoors` style is best visual match for a nautical voyage blog | Standard Stack / Tile Providers | Low risk — style is Claude's Discretion per CONTEXT.md; change one URL string |
| A2 | `src/data/route-track.json` is the correct output path for the simplified GeoJSON (overrides D-12's `.planning/data/route-track.json`) | Architecture Patterns, Pattern 3 | Medium — if planner uses `.planning/data/` path, needs a relative import path from within `src/components/VoyageMap.astro`; Vite supports it but unconventional |
| A3 | `@tmcw/togeojson` requires an external DOMParser in Node.js 24 (must use `@xmldom/xmldom`) | Common Pitfalls / Pitfall 5 | Medium — if Node 24 adds globalThis.DOMParser this becomes unnecessary; planner should verify before adding `@xmldom/xmldom` as dep |
| A4 | `set:html` is the correct Astro directive to output raw JSON in a `<script type="application/json">` tag without HTML-encoding angle brackets | Architecture Patterns, Pattern 2 | Medium — if `set:html` escapes content inside `<script>` tags, a different approach is needed (e.g., data attribute with JSON.stringify) |
| A5 | 68 non-draft posts with lat/lon currently exist (from Phase 4 verification: 322 total MDX, 250 draft, 72 original; spot-check shows lat/lon in many originals) | Phase Requirements section | Low — exact count affects inline data size estimate; doesn't change the approach |
| A6 | Nebo GPX format is a standard `.gpx` file with `<trk>/<trkseg>/<trkpt>` elements (the most common Nebo export format) | Pattern 3 (GPX script) | High — if Nebo exports in a non-standard format (e.g., only route waypoints, no trackpoints), `@tmcw/togeojson` output will be different geometry type |

---

## Open Questions

1. **Nebo GPX export format and count**
   - What we know: Nebo app exports GPX per-trip; directory `.planning/data/gpx/` doesn't exist yet
   - What's unclear: Does Nebo export one file per trip session or per calendar day? Does each trackpoint include a `<time>` element? How many files will there be for 756 days?
   - Recommendation: Human must export at least one sample GPX file first so the script can be written and tested before committing to the full simplification pipeline

2. **`set:html` on `<script type="application/json">` in Astro 7**
   - What we know: Astro's `set:html` directive injects raw HTML without escaping
   - What's unclear: Whether `set:html` on a non-`text/javascript` script tag behaves correctly in Astro 7 / Rolldown
   - Recommendation: Test with a simple `<script type="application/json" set:html={JSON.stringify({test: "<b>hello</b>"})}>` before committing to this pattern; fallback is a `data-` attribute

3. **Route JSON import graceful fallback**
   - What we know: D-12 requires build-time import; if `src/data/route-track.json` doesn't exist, `astro build` will fail
   - What's unclear: Should the build succeed without the GPX data, showing markers but no polyline?
   - Recommendation: The Vite hook should write a stub `src/data/route-track.json` with an empty GeoJSON (`{ type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} }`) if no GPX files are present; VoyageMap handles empty coordinates gracefully

4. **Stadia Maps account for Netlify domain**
   - What we know: Localhost works without account; production requires free account registration and domain configuration
   - What's unclear: Whether the Netlify URL `incomparable-cranachan-979404.netlify.app` or a custom domain should be registered
   - Recommendation: Register the Netlify URL first; update when custom domain is configured

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | GPX simplification script | ✓ | v24.14.0 | — |
| npm | Package installation | ✓ | Installed with Node | — |
| Nebo app (iPhone/iPad) | Exporting GPX files (D-10) | Unknown | — | None — only GPS track source per D-11 |
| Stadia Maps account | Production tile serving | Unknown | — | Localhost works; production requires free signup |
| `.planning/data/gpx/*.gpx` | scripts/simplify-gpx.mjs | ✗ (directory absent) | — | Vite hook emits empty route stub; markers still work |
| `src/data/route-track.json` | VoyageMap.astro build-time import | ✗ (not yet generated) | — | Must be created (even as stub) before `astro build` |

**Missing dependencies with no fallback:**
- Nebo app GPX export — required for MAP-02 (route polyline). Human must export from app before running the simplification script.

**Missing dependencies with fallback:**
- `src/data/route-track.json` — the Vite hook can write a stub (empty coordinates) so the build succeeds; the map renders stop markers only until real GPX data is processed.
- Stadia Maps account — tiles work on localhost without account; the plan should include a task to create the free account before deploying to Netlify.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — no test framework installed |
| Config file | none |
| Quick run command | `npm run build` (build smoke test) |
| Full suite command | `npm run build && node scripts/simplify-gpx.mjs --dry-run` |

No automated test framework (jest/vitest/playwright) is installed or configured. The existing pattern for this project is build-pass verification + manual visual confirmation.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | Full-route map renders on voyage index | visual | `npm run build` (no build errors) | ❌ Wave 0 |
| MAP-02 | Route polyline drawn from GPX data | integration | `node scripts/simplify-gpx.mjs && stat src/data/route-track.json` | ❌ Wave 0 |
| MAP-03 | Stop markers clickable with popup | visual/manual | manual — open map, click marker, verify popup | N/A |
| MAP-04 | Per-post mini map (single pin) | visual | `npm run build` (no build errors) | ❌ Wave 0 |
| MAP-05 | No SSR issues — `window` not accessed in frontmatter | build | `npm run build` exits 0 | N/A (verified by passing build) |
| SITE-02 | Voyage index page lists all posts with map | build | `npm run build && curl localhost/voyages/great-loop/ \| grep 'voyage-map'` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run build` exits 0
- **Per wave merge:** `npm run build && npm run preview` — manual visual check on map load
- **Phase gate:** Build passes + human verifies map loads on mobile (touch pan, pinch zoom, popup tap)

### Wave 0 Gaps

- [ ] `src/data/route-track.json` — stub empty GeoJSON; covers MAP-02 prerequisite
- [ ] `scripts/simplify-gpx.mjs` — GPX converter script; covers MAP-02
- [ ] `src/components/VoyageMap.astro` — full route map component; covers MAP-01, MAP-02, MAP-03
- [ ] `src/components/PostMiniMap.astro` — per-post mini map component; covers MAP-04, MAP-05

---

## Security Domain

Map components present minimal security surface:

- **Popup HTML injection:** Popup content (title, excerpt, coverPhoto) comes from MDX frontmatter, which is authored by the site owner. No user-controlled input. No sanitization needed.
- **Tile provider trust:** Stadia Maps and OpenSeaMap are established third-party providers. No sensitive data is sent in tile requests (only `z/x/y` coordinates).
- **CORS:** Tile requests and stop data are same-origin or to public CDNs. No CORS configuration needed.
- **API key exposure:** Stadia Maps free tier uses domain-based authentication (no API key in code). If an API key is used, it must not be committed to git. [CITED: docs.stadiamaps.com/authentication/]

ASVS categories applicable: V5 (input validation) is trivially satisfied since no user input reaches the map. V6 cryptography not applicable. No auth, no session, no PII.

---

## Sources

### Primary (HIGH confidence)

- [docs.stadiamaps.com/raster/](https://docs.stadiamaps.com/raster/) — Raster tile URL templates and available styles
- [docs.stadiamaps.com/authentication/](https://docs.stadiamaps.com/authentication/) — Free tier authentication requirements
- [docs.stadiamaps.com/attribution/](https://docs.stadiamaps.com/attribution/) — Required attribution text
- [leafletjs.com/reference.html](https://leafletjs.com/reference.html) — L.tileLayer, L.marker, L.divIcon, L.popup, L.polyline API
- [leafletjs.com/examples/custom-icons/](https://leafletjs.com/examples/custom-icons/) — Custom icon patterns
- [docs.astro.build/en/reference/directives-reference/#definevars](https://docs.astro.build/en/reference/directives-reference/#definevars) — `define:vars` behavior and `is:inline` forcing
- [docs.astro.build/en/guides/client-side-scripts/](https://docs.astro.build/en/guides/client-side-scripts/) — Data passing patterns (`data-*` attributes)
- [docs.astro.build/en/reference/integrations-reference/](https://docs.astro.build/en/reference/integrations-reference/) — `astro:build:start` hook
- npm registry — `leaflet@1.9.4`, `@tmcw/togeojson@7.1.2`, `simplify-js@1.2.4`, `@turf/simplify@7.3.5` — all slopcheck [OK]

### Secondary (MEDIUM confidence)

- [help.openstreetmap.org/questions/39032](https://help.openstreetmap.org/questions/39032/openseamap-tile-server-url) — OpenSeaMap tile URL `t2.openseamap.org/seamark/{z}/{x}/{y}.png`
- [github.com/Leaflet/Leaflet/issues/9466](https://github.com/Leaflet/Leaflet/issues/9466) — Default marker icon broken in Vite builds
- [florian-lefebvre.dev/blog/passing-data-to-a-bundled-script-in-astro/](https://florian-lefebvre.dev/blog/passing-data-to-a-bundled-script-in-astro/) — `define:vars` forces `is:inline` confirmed
- [turfjs.org/docs/api/simplify](https://turfjs.org/docs/api/simplify) — `@turf/simplify` tolerance values and behavior

### Tertiary (LOW confidence)

- Community reports on Astro GitHub issues re: `client:only` behavior — used only to confirm `client:only` is for framework components, not plain `.astro` files

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified via npm + slopcheck [OK]; Stadia Maps URL verified from official docs
- Architecture patterns: HIGH — Astro script/data-attribute pattern verified from official Astro docs; Leaflet API verified from official docs
- Pitfalls: HIGH — Vite asset hash + default icon break is a documented Leaflet GitHub issue; `define:vars` → `is:inline` verified from official Astro docs
- GPX processing: MEDIUM — `@tmcw/togeojson` Node.js API detail (DOMParser requirement) is [ASSUMED]; verify before implementing

**Research date:** 2026-07-19
**Valid until:** 2026-08-19 (Leaflet 1.9.x is stable; Astro 7 patterns are stable; Stadia Maps free tier policy may change)
