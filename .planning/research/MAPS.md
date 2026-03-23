# Interactive Maps Research: Jackie B III Going Loopy

**Domain:** Interactive route maps on Astro SSG (nautical/cruise route blog)
**Researched:** 2026-03-23
**Knowledge cutoff:** August 2025 (web tools unavailable — all findings from training data)
**Overall confidence:** MEDIUM — core library APIs are stable and well-documented, Astro integration
patterns are established, but exact current versions and any post-August-2025 changes should
be verified before implementation.

---

## Executive Summary

For a static Astro blog showing a nautical cruise route with clickable stops, **Leaflet.js is the
right choice**. It is free, requires no API key, renders well on mobile, has a mature plugin
ecosystem for GPX parsing, and integrates cleanly with Astro's `client:only="svelte"` (or plain
`client:only`) hydration pattern. MapLibre GL is more powerful but significantly more complex and
heavier for a use case that does not need 3D or vector-tile styling. Mapbox is commercial and
adds cost and API-key management overhead that a personal blog does not need.

The recommended tile provider is **OpenStreetMap via OpenFreeMap or Stadia Maps free tier** for
general coastal/waterway rendering. For a nautical "chart" aesthetic, **OpenSeaMap** tiles can be
overlaid on top of any OSM base layer.

GPX files from Nebo Gold export as standard GPX 1.1. The `leaflet-gpx` plugin parses them
directly in the browser — no server-side processing needed.

The full-trip route map is a single Astro component with `client:only="vanilla"` (no framework
needed). Per-post mini maps share the same component with a filtered bounding box.

---

## 1. Library Comparison: Leaflet vs MapLibre GL vs Mapbox

### Quick Decision Matrix

| Criterion | Leaflet.js | MapLibre GL JS | Mapbox GL JS |
|-----------|-----------|---------------|-------------|
| Cost | Free, no key | Free, no key | Free tier (50k loads/mo), then paid |
| Bundle size | ~150 KB (minified+gzipped ~40 KB) | ~600 KB+ minified | ~600 KB+ minified |
| 3D / vector tiles | No (raster tiles only) | Yes | Yes |
| GPX support | Via `leaflet-gpx` plugin | Manual GeoJSON conversion | Manual GeoJSON conversion |
| Popup / marker API | Simple, well-documented | Moderate complexity | Moderate complexity |
| Astro SSG compatibility | Excellent — no SSR needed | Good but heavier | Good but needs API key |
| Mobile responsiveness | Built-in touch/pinch | Built-in touch/pinch | Built-in touch/pinch |
| Nautical tile support | OSM + OpenSeaMap overlay | OSM + custom style | Custom style required |
| Community maturity | Very mature (since 2011) | Growing (fork of Mapbox GL) | Mature but commercial |
| Learning curve | Low | Medium | Medium |

**Recommendation: Leaflet.js**

Rationale: The Great Loop route is a 2D polyline with clickable markers. There is no need for 3D
terrain, vector-tile styling, or GPU rendering. Leaflet solves this problem with 1/4 the bundle
size, zero API key management, and a plugin that parses GPX files directly. MapLibre is the right
choice when you need vector tiles + custom cartography + 3D; that is not this use case.

Confidence: HIGH — these tradeoffs are stable and well-established in the mapping community.

---

## 2. Free Tile Providers

### Options Evaluated

| Provider | URL Template | License | Quality | Notes |
|----------|-------------|---------|---------|-------|
| OpenStreetMap (direct) | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | ODbL | Good | OSM ToS requires attribution; direct use acceptable for low-traffic personal sites |
| OpenFreeMap | `https://tiles.openfreemap.org/...` | Free | Good | Newer service, no key needed, uses OpenMapTiles schema |
| Stadia Maps | `https://tiles.stadiamaps.com/tiles/...` | Free tier: 200k tiles/mo | Excellent | Clean cartography, multiple styles, free tier generous for a blog |
| Stamen Watercolor/Toner | Archived on Stadia | Artistic | Beautiful | Watercolor style is distinctive but may obscure route detail |
| MapTiler free tier | `https://api.maptiler.com/...` | 100k requests/mo free | Good | Requires API key even for free tier |
| OpenSeaMap overlay | `https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png` | Free | Nautical marks | Overlay only — shows buoys, channels; use ON TOP of any base layer |

### Recommendation for Nautical Route

**Base layer: Stadia Maps "Alidade Smooth" or "OSM Bright"** — clean, readable, good coastal
rendering, generous free tier for a personal blog.

**Nautical overlay: OpenSeaMap** — add as a second tile layer in Leaflet. Shows navigation
marks, channel markers, depth contours. Toggle-able by the user if desired.

**Attribution:** All OSM-derived tiles require attribution text "© OpenStreetMap contributors"
on the map. Stadia requires "© Stadia Maps". Both handled via Leaflet's built-in attribution
control.

Confidence: MEDIUM — Stadia Maps free tier limits and OpenSeaMap availability verified as of
August 2025. Tile service URLs should be confirmed against current documentation before
implementation (services occasionally change URL schemas).

---

## 3. GPX Track Rendering

### Nebo Gold GPX Export

Nebo Gold exports standard GPX 1.1 files with:
- `<trk>` elements containing `<trkseg>` and `<trkpt>` waypoints
- Lat/lon/elevation/timestamp per point
- Typical day's track: 200-2,000 trackpoints depending on trip length and recording interval

The Great Loop is ~6,000 miles. A full trip GPX with all tracks could contain 5,000-50,000+
points depending on recording resolution.

### Option A: leaflet-gpx Plugin (Recommended)

```
npm install leaflet-gpx
```

The `leaflet-gpx` plugin:
- Parses GPX files directly in the browser (no server preprocessing)
- Draws track as a `Polyline` layer
- Extracts waypoints as markers
- Emits events: `gpx_loaded`, `addline`, `addwpt`
- Supports custom marker icons and popup content
- Handles multiple `<trkseg>` segments (e.g., separate days) as one connected line

Basic usage pattern:
```javascript
import 'leaflet';
import 'leaflet-gpx';

const map = L.map('map').setView([35, -80], 7);
L.tileLayer('...').addTo(map);

new L.GPX('/tracks/great-loop.gpx', {
  async: true,
  marker_options: {
    startIconUrl: '/icons/start.png',
    endIconUrl: '/icons/end.png',
    shadowUrl: null
  }
}).on('loaded', (e) => {
  map.fitBounds(e.target.getBounds());
}).addTo(map);
```

Confidence: HIGH — `leaflet-gpx` is a stable, widely-used plugin with this exact API.

### Option B: Manual GPX Parsing to GeoJSON

Parse the GPX file at Astro build time using a Node.js script (e.g., with `togeojson` npm
package), output as a `.json` file, and load the GeoJSON client-side via Leaflet's built-in
`L.geoJSON()`.

**Advantage:** Smaller client-side payload (no XML parser), can preprocess and simplify the
track at build time, track data baked into static assets.

**Disadvantage:** Adds a build step.

For a blog with one full-trip GPX and ~6,000 miles of track, build-time preprocessing is worth
considering for performance (see Section 6).

### Recommendation

Start with `leaflet-gpx` for simplicity. If the full-trip GPX file exceeds ~1 MB or has
performance issues, switch to build-time GeoJSON conversion with optional point simplification
(Douglas-Peucker algorithm via `@turf/simplify`).

---

## 4. Clickable Waypoint Markers with Pop-up Cards

### Waypoint Data Model

Each stop needs:
```typescript
interface WaypointStop {
  name: string;          // e.g., "Chicago, IL"
  lat: number;
  lng: number;
  date: string;          // ISO date of stop
  excerpt: string;       // 1-2 sentence preview
  photo: string;         // URL to cloud-hosted photo
  postSlug: string;      // Astro post slug for link
}
```

This data lives in a JSON file at build time (generated from the content collection frontmatter).

### Popup Pattern with Leaflet

```javascript
const marker = L.marker([stop.lat, stop.lng], {
  icon: customIcon
});

marker.bindPopup(`
  <div class="map-popup">
    <img src="${stop.photo}" alt="${stop.name}" />
    <h3>${stop.name}</h3>
    <p>${stop.excerpt}</p>
    <a href="/voyages/great-loop/${stop.postSlug}/">Read more →</a>
  </div>
`, {
  maxWidth: 280,
  className: 'great-loop-popup'
});

marker.addTo(map);
```

Pop-up content is plain HTML — photos, text, and links all work. Style via CSS class on the
popup container.

### Custom Marker Icons

For a nautical blog, use a custom SVG anchor icon or a simple circle marker:

```javascript
const anchorIcon = L.icon({
  iconUrl: '/icons/anchor.svg',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16]
});
```

Or use `L.circleMarker` for a cleaner look without an image asset:
```javascript
const dot = L.circleMarker([lat, lng], {
  radius: 7,
  color: '#1a6b9a',
  fillColor: '#2e9cca',
  fillOpacity: 0.9
});
```

Confidence: HIGH — standard Leaflet popup and marker API, stable for years.

---

## 5. Astro Integration Patterns

### The Core Problem

Leaflet requires a real browser DOM and the `window` / `document` globals. Astro's default
rendering is server-side (static HTML). A Leaflet component rendered at build time will crash
because `window` does not exist in Node.js.

### Solution: client:only Directive

The correct pattern is an Astro component with `client:only`:

```astro
---
// MapComponent.astro — wrapper that defers to client
---
<div id="map-container" style="height: 500px; width: 100%;">
  <noscript>Enable JavaScript to view the interactive map.</noscript>
</div>

<script>
  // All Leaflet code here runs only in the browser
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  // ... map initialization
</script>
```

Or as a framework component (e.g., a plain `.js` module used via `<script>`):

```astro
<!-- In a .astro page -->
<div id="trip-map" style="height:600px"></div>
<script src="/scripts/trip-map.js" type="module"></script>
```

The `<script>` tag in an `.astro` file is automatically bundled by Vite and runs only on the
client. This is the **simplest and most reliable** approach for vanilla JS libraries like Leaflet.

### Framework Component Alternative

If using React or Svelte in the project, create a `<TripMap />` framework component:

```tsx
// TripMap.tsx (React)
import { useEffect, useRef } from 'react';

export default function TripMap({ stops }) {
  const mapRef = useRef(null);

  useEffect(() => {
    // Import Leaflet dynamically to avoid SSR issues
    import('leaflet').then(L => {
      const map = L.map(mapRef.current);
      // ... setup
    });

    return () => map?.remove(); // Cleanup on unmount
  }, []);

  return <div ref={mapRef} style={{ height: '500px' }} />;
}
```

Used in Astro with:
```astro
<TripMap stops={stops} client:only="react" />
```

`client:only` means: render nothing on the server, hydrate fully on the client. This is the
correct directive for any component that cannot function without browser APIs.

**Do NOT use `client:load` for Leaflet** — `client:load` renders on the server first (for HTML),
then hydrates. Leaflet will throw during server render. `client:only` skips server rendering
entirely.

### Recommended Approach for This Project

Given the project uses plain Astro (no React confirmed), the **inline `<script>` tag in an
`.astro` component** is the cleanest pattern:

```astro
---
// src/components/TripMap.astro
const { stops, voyageSlug } = Astro.props;
---

<div id="trip-map" class="trip-map-container" aria-label="Interactive voyage route map"></div>

<script define:vars={{ stops, voyageSlug }}>
  // This block runs only in the browser (Astro guarantees this)
  // `stops` is serialized from props by define:vars

  import('/scripts/init-trip-map.js').then(({ initMap }) => {
    initMap('trip-map', stops, voyageSlug);
  });
</script>

<style>
  .trip-map-container {
    height: 500px;
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
  }
  @media (max-width: 640px) {
    .trip-map-container { height: 320px; }
  }
</style>
```

Note: `define:vars` serializes props to JSON and makes them available as JS variables inside
the `<script>` block. This is the canonical Astro pattern for passing server-side data to
client-side scripts.

Confidence: HIGH — this is documented Astro behavior, stable since Astro 2.x.

### Leaflet CSS

Leaflet requires its CSS to be loaded. In Astro, add to the component or layout:

```astro
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

Or install locally and import:
```javascript
import 'leaflet/dist/leaflet.css';
```

The local import is preferred for production (no CDN dependency at runtime).

---

## 6. Performance — Large GPX Files

### Problem Scope

The Great Loop is ~6,000 miles. If Nebo records at 1 point/10 seconds at ~7 knots, that is
approximately:
- 6,000 miles / 7 knots = ~857 hours of engine time
- 857 hours × 360 points/hour = ~308,000 trackpoints (worst case)
- Typical GPX XML: ~40-80 bytes/point = 12-24 MB raw GPX

A 15 MB GPX file loaded in the browser and rendered as a Leaflet polyline will cause visible
lag, especially on mobile.

### Solutions

**1. Build-time Track Simplification (Recommended)**

Run a simplification script during `astro build` using the Douglas-Peucker algorithm:
- `@turf/simplify` (npm) — simplifies GeoJSON by removing collinear points within a tolerance
- Convert GPX → GeoJSON at build time using `@tmcw/togeojson` (npm)
- Simplify with tolerance ~0.001 degrees (retains shape, removes redundant points)
- A 300k-point track can typically be reduced to 5,000-15,000 points with no visible loss of
  route shape at map zoom levels used for trip overviews
- Output as `/public/tracks/great-loop-simplified.geojson`

Build script outline:
```javascript
// scripts/simplify-gpx.mjs
import { readFileSync, writeFileSync } from 'fs';
import { DOMParser } from '@xmldom/xmldom';
import toGeoJSON from '@tmcw/togeojson';
import simplify from '@turf/simplify';

const gpxDoc = new DOMParser().parseFromString(
  readFileSync('./src/data/great-loop.gpx', 'utf8'), 'text/xml'
);
const geojson = toGeoJSON.gpx(gpxDoc);
const simplified = simplify(geojson, { tolerance: 0.001, highQuality: false });
writeFileSync('./public/tracks/great-loop-simplified.geojson', JSON.stringify(simplified));
```

Run as a prebuild hook in `package.json`:
```json
{
  "scripts": {
    "prebuild": "node scripts/simplify-gpx.mjs",
    "build": "astro build"
  }
}
```

**2. Lazy Load the Map**

Do not initialize the map until it scrolls into view. Use the Intersection Observer API:

```javascript
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    initMap();
    observer.disconnect();
  }
}, { rootMargin: '200px' });

observer.observe(document.getElementById('trip-map'));
```

This keeps the initial page load fast — the map JS and tile requests only fire when the user
scrolls near the map.

**3. Separate GPX Files Per Day/Segment**

For per-post mini maps, load only that day's GPX segment (small file, fast). Store individual
day GPX files in `/public/tracks/[voyage]/[date].gpx`. The mini map component takes a `trackUrl`
prop and loads only that file.

**4. Tile Loading is Not a Problem**

Leaflet loads tiles lazily as the user pans/zooms. Tile loading does not block initial render.
The only performance concern is the track polyline data size.

Confidence: HIGH for the Intersection Observer approach and build-time simplification concepts.
MEDIUM for exact simplification tolerances — these need empirical tuning against the actual
Nebo GPX output.

---

## 7. Mobile Responsiveness

Leaflet is touch-native. Pinch-to-zoom and pan work out of the box on iOS and Android.

Key CSS considerations:
- Map container needs explicit `height` — `height: 100%` does not work without a height-defined
  parent. Use `height: 400px` minimum or a CSS custom property.
- On mobile, reduce default height to 300-350px (full viewport is too tall for a blog embed).
- Add `touch-action: none` to the map container if scrolling conflicts appear (Leaflet handles
  this internally but conflicts can arise in some scroll containers).
- Use media queries to reduce marker size on mobile.

Pop-up sizing:
```javascript
marker.bindPopup(html, {
  maxWidth: Math.min(280, window.innerWidth - 40)
});
```

For the full-trip map on mobile, consider adding a "fit route" button so users can reset the
view after panning. Leaflet's `map.fitBounds()` does this.

Confidence: HIGH — Leaflet mobile behavior is well-established.

---

## 8. Existing Astro Map Integrations Worth Knowing

### Community Packages

**`astro-leaflet`** — A thin wrapper providing an Astro component for Leaflet. As of mid-2025
this existed on npm but had sparse maintenance. Given the integration patterns are simple, it
is better to write the component directly rather than depend on an unmaintained wrapper.
Confidence: LOW — verify current maintenance status before considering.

**`@astrojs/react` + `react-leaflet`** — If the project adds React, `react-leaflet` is
battle-tested and provides React component wrappers around Leaflet. Adds significant bundle
weight. Not recommended for a project that doesn't already use React.

**`svelte-leaflet`** or `@svelte-leaflet`** — Same story as react-leaflet but for Svelte.
Not recommended unless already using Svelte.

### Recommendation

Write a plain Astro component with an inline `<script>` block. This has:
- Zero third-party wrapper dependencies
- Full control over Leaflet initialization
- No framework overhead
- Trivial to debug (no abstraction layers)

The implementation is straightforward enough that a wrapper adds no value.

---

## 9. Architecture: Full-Trip Map vs Per-Post Mini Map

### Full-Trip Map Component

```
src/components/VoyageMap.astro
  Props:
    - stops: WaypointStop[]   (all stops for the voyage)
    - trackUrl: string        (path to simplified GeoJSON)
    - voyageSlug: string      (e.g., "great-loop")

  Renders:
    - Full polyline route in voyage color
    - Numbered or anchor-icon markers for each stop
    - Popup per marker: photo + name + date + excerpt + "Read more" link
    - Fit-to-bounds on load
    - Lazy load via Intersection Observer
```

### Per-Post Mini Map Component

```
src/components/PostMiniMap.astro
  Props:
    - segmentTrackUrl: string  (path to that day's GPX/GeoJSON)
    - currentStop: WaypointStop
    - prevStop?: WaypointStop  (previous day, dimmed marker)
    - nextStop?: WaypointStop  (next day, dimmed marker)

  Renders:
    - Single day's track segment
    - Bold marker for current stop
    - Ghost markers for prev/next context
    - Fit to segment bounds with slight padding
    - Smaller height: 250px desktop, 180px mobile
```

### Data Flow

```
Nebo GPX files
    → scripts/simplify-gpx.mjs (prebuild)
    → /public/tracks/great-loop-simplified.geojson    (full trip)
    → /public/tracks/great-loop/2023-06-15.geojson    (per day)

Blogger content + frontmatter
    → src/content/voyages/great-loop/*.md
    → Each file's frontmatter includes: lat, lng, date, photoUrl, excerpt

Astro build
    → Reads content collection
    → Passes stops[] to VoyageMap.astro
    → Per post page: reads frontmatter, passes to PostMiniMap.astro
```

Confidence: HIGH — this is a standard Astro content collection + component pattern.

---

## 10. OpenSeaMap Nautical Overlay

OpenSeaMap provides a free tile layer showing navigation aids: buoys, lights, channels, depth
contours, and marina symbols. Adding it as a Leaflet overlay layer:

```javascript
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19
});

const seamark = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
  attribution: '© OpenSeaMap contributors',
  opacity: 0.8
});

const map = L.map('map', { layers: [osm, seamark] });
```

Or add a layer toggle control to let users turn nautical marks on/off:
```javascript
const baseLayers = { 'Street Map': osm };
const overlays = { 'Nautical Marks': seamark };
L.control.layers(baseLayers, overlays).addTo(map);
```

The OpenSeaMap tiles are most detailed at zoom 10-16. At the full Great Loop overview zoom
(~5-7), they add minimal clutter.

Confidence: MEDIUM — OpenSeaMap tile URL confirmed as of August 2025; service is volunteer-run
and should be verified before use.

---

## 11. Implementation Checklist

Ordered by dependency:

1. **Install dependencies**
   ```bash
   npm install leaflet leaflet-gpx
   npm install -D @tmcw/togeojson @xmldom/xmldom @turf/simplify
   ```

2. **Write `scripts/simplify-gpx.mjs`** — converts Nebo GPX(s) to simplified GeoJSON files in
   `/public/tracks/`

3. **Add `prebuild` script** to `package.json`

4. **Add waypoint data** to content collection frontmatter:
   `lat`, `lng`, `stopPhoto`, `excerpt` fields in each post's YAML

5. **Write `src/components/VoyageMap.astro`** — full-trip map with all stops

6. **Write `src/components/PostMiniMap.astro`** — per-post segment map

7. **Add to main voyage page** — `<VoyageMap stops={allStops} trackUrl="..." voyageSlug="great-loop" />`

8. **Add to post layout** — `<PostMiniMap segmentTrackUrl={...} currentStop={...} />`

9. **Style popups** in global CSS or component `<style>` with `is:global`

10. **Test on mobile** — verify touch behavior, popup sizing, height constraints

---

## 12. Known Pitfalls

### Pitfall 1: Leaflet Icon 404s in Webpack/Vite Bundlers

**What goes wrong:** Leaflet's default marker icons use relative image paths that break when
Leaflet is imported via a bundler (Vite in Astro's case). Markers appear as broken images.

**Prevention:** Either use custom icons (recommended for a blog anyway) or delete the default
icon and reassign:
```javascript
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/icons/marker-2x.png',
  iconUrl: '/icons/marker.png',
  shadowUrl: '/icons/marker-shadow.png',
});
```

Or skip default icons entirely and use `L.circleMarker` for all stops.

### Pitfall 2: Map Renders in Zero-Height Container

**What goes wrong:** If the map container has no explicit height when Leaflet initializes, the
map renders correctly internally but displays as a 0px tall div. Tiles load but nothing is
visible. Very confusing.

**Prevention:** Always set explicit `height` on the map container before `L.map()` is called.
Never rely on a parent's `height: 100%` without ensuring the parent has a fixed height.

### Pitfall 3: Multiple Map Instances on One Page

**What goes wrong:** If PostMiniMap is used on a list page showing many posts, initializing
dozens of Leaflet instances will crash the browser with memory issues and tile request floods.

**Prevention:** On list pages, use a static image placeholder (e.g., a screenshot of the route)
instead of a live map. Only initialize live maps on individual post pages.

### Pitfall 4: define:vars Serialization Limits

**What goes wrong:** `define:vars` in Astro serializes props to JSON and embeds them in the HTML.
For a large `stops[]` array with photo URLs and excerpts, this can bloat the HTML significantly.

**Prevention:** For the full voyage map, fetch `stops.json` as a separate static file rather than
embedding it via `define:vars`. For per-post mini maps with 1-3 stops, `define:vars` is fine.

```astro
<script>
  fetch('/data/great-loop-stops.json')
    .then(r => r.json())
    .then(stops => initMap('trip-map', stops));
</script>
```

### Pitfall 5: SSR / Prerender Config Mismatch

**What goes wrong:** If any page accidentally enables SSR (Astro hybrid mode), Leaflet code
in `<script>` blocks still runs client-only (correct), but `define:vars` may behave differently.

**Prevention:** Ensure `output: 'static'` in `astro.config.mjs`. This project is SSG only.

### Pitfall 6: Tile Provider Rate Limits

**What goes wrong:** During development, repeated `astro dev` + browser refreshes hammer tile
servers. OSM directly has rate limits and may temporarily block your IP.

**Prevention:** Use Stadia Maps (generous free tier, account-based). During development, consider
a local tile cache or use lower zoom levels to reduce tile requests.

---

## 13. Recommended Final Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Map library | Leaflet.js 1.9.x | Lightest viable option, perfect for 2D raster route maps |
| GPX parsing | `leaflet-gpx` plugin (client) + `@tmcw/togeojson` (build) | Plugin for dev simplicity, build conversion for production perf |
| Track simplification | `@turf/simplify` (prebuild) | Reduces trackpoint count, keeps payload manageable |
| Base tiles | Stadia Maps "Alidade Smooth" | Clean coastal rendering, generous free tier, no key required for low traffic |
| Nautical overlay | OpenSeaMap (optional layer toggle) | Adds boating character, doesn't clutter at overview zoom |
| Astro integration | Inline `<script>` in `.astro` component, `define:vars` for small data, JSON fetch for large data | Minimal complexity, no framework needed |
| Stop data | Content collection frontmatter → static JSON at build | Clean separation of content and map data |

---

## Sources and Confidence Notes

All findings are from training data (knowledge cutoff August 2025). Web search and WebFetch
were unavailable during this research session.

| Claim | Confidence | Verification Needed |
|-------|------------|---------------------|
| Leaflet.js 1.9.x as current version | HIGH | Confirm latest release at leafletjs.com |
| `leaflet-gpx` plugin API | HIGH | Confirm at github.com/mpetazzoni/leaflet-gpx |
| Stadia Maps free tier limits | MEDIUM | Check current pricing at stadiamaps.com |
| OpenSeaMap tile URL | MEDIUM | Verify at openseamap.org |
| `define:vars` behavior in Astro | HIGH | Stable Astro feature, docs at docs.astro.build |
| `client:only` vs `client:load` distinction | HIGH | Stable Astro feature, docs at docs.astro.build |
| `@tmcw/togeojson` package API | MEDIUM | Verify at github.com/tmcw/togeojson |
| `@turf/simplify` API | HIGH | Stable Turf.js function, docs at turfjs.org |
| OpenFreeMap as a viable provider | LOW | Relatively new service — verify stability |

**Before implementation, verify:**
1. `https://leafletjs.com` — current version (expect 1.9.x or 2.x)
2. `https://stadiamaps.com/pricing` — current free tier limits
3. `https://openseamap.org` — tile service availability
4. `https://docs.astro.build/en/reference/directives-reference/#clientonly` — current `client:only` docs
