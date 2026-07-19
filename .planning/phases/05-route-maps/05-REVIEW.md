---
phase: 05-route-maps
reviewed: 2026-07-19T20:39:19Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - astro.config.mjs
  - scripts/simplify-gpx.mjs
  - src/components/PostMiniMap.astro
  - src/components/VoyageMap.astro
  - src/layouts/BlogPost.astro
  - src/pages/voyages/great-loop/index.astro
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: info-only
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-19T20:39:19Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files implementing the Phase 05 Route Maps feature were reviewed: the Astro config with the GPX simplification build hook, the GPX pipeline script, two Leaflet map components (PostMiniMap and VoyageMap), the BlogPost layout, and the voyage index page.

The implementation is well-structured overall. The data island pattern with `serialize()` escaping, the `Number.isFinite` guard on coordinates, and the fallback stub logic all show defensive thinking. However, two blockers were found:

1. The GPX pipeline silently drops all coordinates from multi-segment tracks because `@tmcw/togeojson` produces `MultiLineString` geometry for tracks with more than one `<trkseg>`, and the collection loop only handles `LineString`. Nebo GPX exports from real voyages are extremely likely to produce `MultiLineString` features, making this a data-loss bug that produces a silent empty route on first real use.

2. The size gate check runs AFTER the file has already been written to disk. When the check fails, the oversized file persists on disk and will be consumed silently by `astro dev` on subsequent runs.

Four additional warnings were found: a blank (unrecoverable) map when both route and stops are empty, raw HTML injection of frontmatter strings into Leaflet popup `innerHTML`, a placeholder Netlify preview URL baked into the production `site` field, and unguarded `JSON.parse` calls in the VoyageMap client script.

## Critical Issues

### CR-01: `MultiLineString` geometry silently dropped — route always empty for multi-segment GPX tracks

**File:** `scripts/simplify-gpx.mjs:71-75`
**Issue:** `@tmcw/togeojson` converts a GPX `<trk>` with more than one `<trkseg>` into a `MultiLineString` feature (confirmed in bundle: `geometry:1===r.length?{type:"LineString",…}:{type:"MultiLineString",…}`). The coordinate collection loop guards on `feature.geometry.type === 'LineString'` and silently skips any other geometry type. Nebo — the GPS app named in the script header — commonly logs multiple track segments per day (for pauses, restarts, or power cycles). When every feature in a GPX file is `MultiLineString`, `allPoints` stays empty, `simplified` is empty, and the script writes a valid-but-empty `route-track.json` with no error or warning emitted. The polyline on VoyageMap will be missing for the entire voyage.

**Fix:**
```javascript
for (const feature of geojson.features) {
  if (!feature.geometry) continue;
  if (feature.geometry.type === 'LineString') {
    allPoints.push(...feature.geometry.coordinates);
  } else if (feature.geometry.type === 'MultiLineString') {
    for (const segment of feature.geometry.coordinates) {
      allPoints.push(...segment);
    }
  }
}
```

---

### CR-02: Oversized file written to disk before size gate — constraint violated silently on next `astro dev`

**File:** `scripts/simplify-gpx.mjs:100-119`
**Issue:** The file is written unconditionally at line 102 (`writeFileSync(OUTPUT, json)`), and the 500 KB size gate runs at line 114. When the limit is exceeded, `process.exit(1)` causes `execSync` in the build hook to throw, correctly failing the `astro build`. However, the oversized file is already persisted to `src/data/route-track.json`. The next invocation of `astro dev` (which does not trigger `astro:build:start`) consumes the oversized file silently, violating the MAP-02 500 KB hard cap. The developer sees a passing dev server while the constraint is broken.

**Fix:** Reorder so the size check gates the write:
```javascript
// ── Size gate (check BEFORE writing) ─────────────────────────────────────────

if (bytes > SIZE_LIMIT) {
  console.error(
    `\nERROR: Output is ${(bytes / 1024).toFixed(0)} KB — exceeds 500 KB limit.\n` +
    `Raise TOLERANCE (currently ${TOLERANCE}) and re-run to reduce file size.`
  );
  process.exit(1);
}

// ── Write (unless dry-run) ────────────────────────────────────────────────────

if (!DRY_RUN) {
  mkdirSync(join(__dirname, '..', 'src', 'data'), { recursive: true });
  writeFileSync(OUTPUT, json);
}
```

---

## Warnings

### WR-01: Map initialized without `setView` — blank broken map when both route and stops are empty

**File:** `src/components/VoyageMap.astro:74,119-130`
**Issue:** `L.map('voyage-map')` is called at line 74 regardless of data availability. When `hasRouteCoords` is false and `markers.length === 0` (e.g., all posts are drafts, or no posts have coordinates), neither `fitBounds` branch runs. Leaflet initializes without a center or zoom level, replaces the fallback text in the `<div>` with its own DOM, and renders a gray rectangle with no tiles. The user loses both the static fallback message and a functional map. The code comment says "leave map at default view without throwing," but Leaflet has no "default view" without an explicit `setView()` call.

**Fix:** Add a defensive fallback after the bounds-fitting branches:
```javascript
  } else {
    // No data at all — destroy the Leaflet instance and restore fallback message
    map.remove();
    if (mapEl) {
      mapEl.textContent = 'Map could not load. Refresh the page to try again.';
    }
  }
```

Alternatively, initialize the map only after confirming at least one data source is non-empty.

---

### WR-02: Post titles and excerpts injected raw into Leaflet popup `innerHTML` — broken rendering on `<` in content

**File:** `src/components/VoyageMap.astro:101`
**Issue:** The popup HTML is built by direct template-literal interpolation of `stop.title`, `stop.excerpt`, and `stop.coverPhoto` into an HTML string that is then passed to `bindPopup()`. Leaflet inserts this string as `innerHTML`. If an author writes an excerpt such as `"Fog < 50 yards visibility"`, the `<` will be parsed as an opening HTML tag, silently consuming the remaining text. Similarly, a `"` in `coverPhoto` (a URL with an unencoded quote) breaks the `src` attribute. These are build-time author-controlled strings, so this is not an XSS risk to end-users, but it is a correctness bug: popup content will silently mangle common punctuation in the text.

**Fix:** Escape the text fields before interpolation:
```javascript
function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Then in the popup template:
const popupHtml = `<div style="min-width:200px;">${imgHtml}` +
  `<strong ...>${escHtml(stop.title)}</strong>` +
  `<p ...>${escHtml(stop.excerpt)}</p>` +
  `<a href="${escHtml(stop.href)}" ...>Read more →</a></div>`;
```

---

### WR-03: `site` is a Netlify deploy-preview URL, not a production domain

**File:** `astro.config.mjs:30`
**Issue:** `site: 'https://incomparable-cranachan-979404.netlify.app'` is a randomly-generated Netlify preview URL. This value propagates into the sitemap generated by `@astrojs/sitemap` and into any canonical `<link>` or OG `<meta>` tags that reference `Astro.site`. Once a real domain is established, every sitemap entry and canonical URL will point to the preview subdomain instead of the production host, which will hurt SEO and produce incorrect social-share metadata.

**Fix:** Replace with the real production domain once known. As an intermediate step, document the temporary value and add a TODO so it is not forgotten:
```javascript
// TODO: replace with production domain before launch
site: 'https://incomparable-cranachan-979404.netlify.app',
```

---

### WR-04: Unguarded `JSON.parse` in VoyageMap client script — uncaught exception crashes map on malformed island

**File:** `src/components/VoyageMap.astro:61,69`
**Issue:** Both `JSON.parse(routeEl.textContent || '{}')` and `JSON.parse(stopsEl.textContent || '[]')` are called without a try/catch. While these data islands are generated at build time (extremely low risk of malformation), any future change to the serialization path (e.g., Astro version upgrade changing how `set:html` is processed, or an escaping edge case) will throw an uncaught `SyntaxError`, preventing the entire client script from running — including map initialization. The map div will be left in its blank fallback-text state with no visible error.

**Fix:**
```javascript
let routeData: unknown = {};
let stops: Array<{ lat: number; lon: number; title: string; excerpt: string; coverPhoto: string | null; href: string; }> = [];

try {
  routeData = routeEl ? JSON.parse(routeEl.textContent || '{}') : {};
  stops = stopsEl ? JSON.parse(stopsEl.textContent || '[]') : [];
} catch (e) {
  console.warn('[VoyageMap] Failed to parse data islands:', e);
  // falls through: both default to empty, map renders with no data
}
```

---

## Info

### IN-01: Hardcoded `id="post-mini-map"` — second instance on same page silently fails

**File:** `src/components/PostMiniMap.astro:19,33`
**Issue:** The component uses a hardcoded element ID. If the D-05 constraint ("one instance per page maximum") is ever violated — e.g., a layout accidentally renders PostMiniMap twice — `document.getElementById('post-mini-map')` returns only the first element. The second map container is never initialized and its Leaflet fallback text is never cleared. No runtime error is produced, making the failure invisible during development.

**Fix:** No code change required while D-05 holds. Consider converting to a uniquely generated ID for future-proofing:
```javascript
const mapId = `post-mini-map-${Math.random().toString(36).slice(2)}`;
```
And pass `mapId` to the `<div id>` and `document.getElementById()` call.

---

### IN-02: Elevation data stripped without documentation

**File:** `scripts/simplify-gpx.mjs:83`
**Issue:** The coordinate mapping `allPoints.map(([lon, lat]) => ({ x: lon, y: lat }))` discards the elevation (z) component that `@tmcw/togeojson` preserves from GPX `<ele>` elements. The resulting `route-track.json` is a flat 2D LineString. This is correct for a 2D Leaflet map, but the destructuring silently drops altitude data that could be used for future elevation profiles. No comment explains the intentional data reduction.

**Fix:** Add a brief inline comment:
```javascript
// Map [lon, lat, ?ele] → {x, y} — elevation discarded; 2D map only
const pts = allPoints.map(([lon, lat]) => ({ x: lon, y: lat }));
```

---

_Reviewed: 2026-07-19T20:39:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
