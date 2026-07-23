# Phase 5: Route Maps - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 7 (3 new components/data, 1 new script, 1 new data file, 2 modified pages/layouts)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/VoyageMap.astro` | component | batch → request-response | `src/pages/voyages/great-loop/index.astro` + `src/components/VoyageStats.astro` | role-match (composite) |
| `src/components/PostMiniMap.astro` | component | request-response | `src/components/VoyageStats.astro` + `src/components/VideoEmbed.astro` | role-match (composite) |
| `src/data/route-track.json` | data asset | transform output | `.planning/data/` JSON files (e.g., `voyage-timeline-enriched.json`) | data-match |
| `scripts/simplify-gpx.mjs` | utility | file-I/O transform | `scripts/01-build-timeline.mjs` | exact |
| `astro.config.mjs` | config | build hook | `astro.config.mjs` (self — additive only) | self |
| `src/pages/voyages/great-loop/index.astro` | page | request-response | self (additive only) | self |
| `src/layouts/BlogPost.astro` | layout | request-response | self (additive only) | self |

---

## Pattern Assignments

### `src/components/VoyageMap.astro` (component, batch → request-response)

**Primary analog:** `src/pages/voyages/great-loop/index.astro` (getCollection + filter pattern)
**Secondary analog:** `src/components/VoyageStats.astro` (props interface + graceful missing data)

**Imports / frontmatter pattern** — from `src/pages/voyages/great-loop/index.astro` lines 1–7:
```astro
---
import { getCollection } from 'astro:content';
import Layout from '../../../layouts/Layout.astro';

const posts = await getCollection('blog', ({ data }) => data.voyage === 'great-loop');
const sortedPosts = posts.sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());
---
```

**For VoyageMap, extend the filter to exclude drafts and require lat/lon** (new component, no analog):
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
```

**Container sizing pattern** — from `src/pages/voyages/great-loop/index.astro` lines 14–16 (Tailwind utility classes):
```astro
<div class="max-w-[720px] mx-auto px-6 py-12">
```
Apply the same pattern to the map wrapper; the map `div` itself uses `class="h-[400px] w-full mb-10"` (arbitrary value bracket notation, consistent with `text-[28px]`, `text-[14px]` used throughout the index page).

**Data-to-client-script passing pattern** — no existing analog in this codebase. Use the RESEARCH.md Pattern 2 approach: embed JSON in `<script type="application/json">` tags, then read in the `<script>` block via `document.getElementById(...).textContent`. Critical: never use `define:vars` with Leaflet imports.

**Client-side script import pattern** — no existing analog (no Leaflet yet in codebase). Follow RESEARCH.md Pattern 1: `<script>` tag (not `is:inline`) imports npm package directly:
```astro
<script>
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  // ... all Leaflet code here
</script>
```

**Graceful missing-data guard** — from `src/components/VoyageStats.astro` lines 12–18:
```astro
const hasData =
  miles !== undefined ||
  hours !== undefined ||
  ...

{hasData && (
  <footer class="voyage-stats">
    ...
  </footer>
)}
```
Apply to VoyageMap: if `stops.length === 0`, render nothing. If `routeData.geometry.coordinates.length === 0`, skip polyline rendering and fall back to `map.fitBounds(group.getBounds())` over the stop markers instead.

---

### `src/components/PostMiniMap.astro` (component, request-response)

**Primary analog:** `src/components/VoyageStats.astro` (optional props interface, renders nothing when data absent)
**Secondary analog:** `src/components/VideoEmbed.astro` (conditional render based on prop validity)

**Props interface pattern** — from `src/components/VoyageStats.astro` lines 1–10:
```astro
---
interface Props {
  miles?: number;
  hours?: number;
  stops?: number;
  startLocation?: string;
  endLocation?: string;
}
const { miles, hours, stops, startLocation, endLocation } = Astro.props;
```
For PostMiniMap, the props are `lat: number` and `lon: number` (required, not optional — the caller in `BlogPost.astro` only renders this component when both are present per D-08).

**Conditional render guard** — from `src/components/VideoEmbed.astro` lines 10–21:
```astro
const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;
---

{embedUrl ? (
<div class="video-embed">
  ...
</div>
) : null}
```
For PostMiniMap in `BlogPost.astro`, the guard lives in the layout, not the component: only pass `<PostMiniMap>` when `lat !== undefined && lon !== undefined`.

**Data attribute pattern for client-side scripts** — no existing analog. From RESEARCH.md Pattern 1:
```astro
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
    // ... initialize map
  }
</script>
```

**Style scoping pattern** — from `src/components/VoyageStats.astro` lines 51–91 (scoped `<style>` block at bottom of component):
```astro
<style>
  .voyage-stats {
    border-top: 2px solid var(--color-navy);
    ...
  }
</style>
```
PostMiniMap should use the same pattern: scoped `<style>` block at the bottom. Avoid global CSS for the map container.

**CSS variable usage** — from `src/components/VoyageStats.astro` (uses `var(--color-navy)`, `var(--color-muted)`, `var(--color-brass)`). Use the same color variables in PostMiniMap's marker SVG fill for brand consistency: `fill="#8B6914"` is `--color-brass` (verified in VoyageStats line 74 label color = `--color-muted`, navy border = `--color-navy`; brass hex confirmed from `src/pages/voyages/great-loop/index.astro` line 45: `text-brass`).

---

### `scripts/simplify-gpx.mjs` (utility, file-I/O transform)

**Analog:** `scripts/01-build-timeline.mjs` (closest match — same role: reads from `.planning/data/`, transforms data, writes output JSON)

**File header pattern** — from `scripts/01-build-timeline.mjs` lines 1–13:
```javascript
#!/usr/bin/env node
/**
 * scripts/01-build-timeline.mjs
 *
 * Reads photo-summary.json and produces voyage-timeline.json:
 * ...
 *
 * Usage:
 *   node scripts/01-build-timeline.mjs
 */
```
Copy this exact header format for `simplify-gpx.mjs`.

**Node.js imports pattern** — from `scripts/01-build-timeline.mjs` lines 15–21:
```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '.planning', 'data');
```
Use identical `node:` prefixed imports and the `__dirname` pattern. For the GPX script, add `readdirSync` and also define `const GPX_DIR` and `const OUTPUT`.

**Read → transform → write pattern** — from `scripts/01-build-timeline.mjs` lines 174–227:
```javascript
const summary = JSON.parse(readFileSync(join(DATA_DIR, 'photo-summary.json'), 'utf8'));
// ... transform ...
const outPath = join(DATA_DIR, 'voyage-timeline.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote: ${outPath}`);
```
Apply the same pattern: `readFileSync` each GPX file, transform via `@tmcw/togeojson` + `simplify-js`, `writeFileSync` the output. Note: output goes to `src/data/route-track.json` (not `.planning/data/`) per A2 in RESEARCH.md.

**Section separator comment style** — from `scripts/01-build-timeline.mjs` lines 22–23:
```javascript
// ── Geographic region classifier ─────────────────────────────────────────────
// Ordered most-specific first. Returns first match.
```
Use the same `// ── Section name ──────` separator style for GPX script sections.

**Console logging pattern** — from `scripts/03-correlate.mjs` lines 44–46:
```javascript
console.log(`  Photo days:   ${photoByDate.size}`);
console.log(`  Nebo logs:    ${neboByDate.size}  (${...} skipped)`);
console.log(`  Timeline days: ${timelineByDate.size}`);
```
Use similar aligned console.log statements for the GPX script: point count before/after simplification, output file size.

---

### `astro.config.mjs` (config, build hook — additive modification)

**Analog:** `astro.config.mjs` itself (self, additive)

**Existing config structure** — from `astro.config.mjs` lines 1–46:
```javascript
// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://incomparable-cranachan-979404.netlify.app',
  integrations: [mdx(), sitemap()],
  fonts: [...],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // @ts-ignore - Workaround for Astro 7 + Vite 8 + Rolldown 1.x tsconfig resolution bug
      rolldownOptions: { tsconfig: false },
    },
    environments: {
      prerender: {
        build: {
          // @ts-ignore - Workaround for Rolldown tsconfig resolution in prerender env
          rolldownOptions: { tsconfig: false },
        },
      },
    },
  },
});
```

**Integration hook addition** — add before `export default defineConfig`:
```javascript
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const simplifyGpxPlugin = {
  name: 'simplify-gpx',
  hooks: {
    'astro:build:start': ({ logger }) => {
      const gpxDir = '.planning/data/gpx';
      if (!existsSync(gpxDir)) {
        logger.warn('No .planning/data/gpx/ — skipping GPX simplification. Route polyline absent.');
        return;
      }
      logger.info('Running GPX simplification...');
      execSync('node scripts/simplify-gpx.mjs', { stdio: 'inherit' });
    },
  },
};
```
Then add `simplifyGpxPlugin` to the `integrations` array: `integrations: [mdx(), sitemap(), simplifyGpxPlugin]`.
Keep all existing `// @ts-ignore` comments and `rolldownOptions` workarounds unchanged.

---

### `src/pages/voyages/great-loop/index.astro` (page — additive modification)

**Analog:** Self

**Existing insertion point** — from `src/pages/voyages/great-loop/index.astro` line 19:
```astro
<!-- Phase 5: interactive route map goes here -->
```
Replace this comment with the `<VoyageMap>` component import and usage. Add to the frontmatter imports at line 2:
```astro
import VoyageMap from '../../../components/VoyageMap.astro';
```
Replace line 19 with:
```astro
<VoyageMap />
```
The `getCollection` call in VoyageMap's own frontmatter handles all data fetching; the index page does not need to pass props.

**Existing filter pattern** — from `src/pages/voyages/great-loop/index.astro` line 5:
```astro
const posts = await getCollection('blog', ({ data }) => data.voyage === 'great-loop');
```
The index page currently shows ALL posts (including drafts). VoyageMap independently filters to non-draft + lat/lon present — the index page's own list does not need changing (decision D-03 applies only to map markers).

---

### `src/layouts/BlogPost.astro` (layout — additive modification)

**Analog:** Self

**Existing slot structure** — from `src/layouts/BlogPost.astro` lines 58–81:
```astro
<article>
  <!-- Post title -->
  <h1 class="font-inter font-bold text-[28px] text-ink leading-[1.2] mb-4">
    {title}
  </h1>

  <!-- Meta row: date + location -->
  <div class="flex gap-4 items-center mb-8">
    ...
  </div>

  <!-- Post body: MDX content -->
  <div class="post-body">
    <slot />
  </div>
</article>
```

**Mini map insertion point** — between the meta row (`mb-8` div, line ~75) and the `<div class="post-body">` (line ~78). Per D-06, the mini map appears before the body content:
```astro
<!-- Per-post mini map (Phase 5): only when lat/lon present -->
{lat !== undefined && lon !== undefined && (
  <PostMiniMap lat={lat} lon={lon} />
)}
```
Add `import PostMiniMap from '../components/PostMiniMap.astro';` to the frontmatter.

**Existing props destructuring** — from `src/layouts/BlogPost.astro` lines 9–22 (Props interface) and line 25:
```astro
const { title, date, location, excerpt, prev, next } = Astro.props;
```
Add `lat` and `lon` to the destructured props (they are already declared in the Props interface lines 16–17). The Props interface already declares `lat?: number` and `lon?: number` — no interface change needed, only destructuring update.

---

## Shared Patterns

### Tailwind Arbitrary Values
**Source:** `src/pages/voyages/great-loop/index.astro` (e.g., lines 14, 16, 42, 43)
**Apply to:** VoyageMap container, PostMiniMap container
```astro
class="h-[400px] w-full mb-10"      <!-- VoyageMap -->
class="h-48 w-full rounded mb-8"    <!-- PostMiniMap (Tailwind h-48 = 12rem = 192px) -->
```
Pattern: use `h-[400px]` for arbitrary pixel heights (VoyageMap), or Tailwind scale classes (`h-48`) for standard sizes (PostMiniMap). Both require explicit height or Leaflet renders blank.

### CSS Custom Properties (Design Tokens)
**Source:** `src/components/VoyageStats.astro` lines 52–91
**Apply to:** VoyageMap popup HTML, PostMiniMap marker SVG, any scoped styles
```css
var(--color-navy)   /* #1E3A5F approx — polyline color */
var(--color-brass)  /* #8B6914 — marker fill, popup link color */
var(--color-muted)  /* popup body text */
var(--color-ink)    /* popup title text */
var(--font-inter)   /* popup font-family */
```
Note: Leaflet popup HTML uses inline `style=""` (not Tailwind/CSS vars) because it is injected into Leaflet's own DOM. Use hex literals that match the project tokens: `#1E3A5F` for navy, `#8B6914` for brass.

### `node:` Protocol for Built-in Imports
**Source:** `scripts/01-build-timeline.mjs` line 15, `scripts/03-correlate.mjs` line 16
**Apply to:** `scripts/simplify-gpx.mjs`, `astro.config.mjs` additions
```javascript
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
```
All existing scripts use the `node:` prefix — maintain this convention.

### `getCollection` Filter Chaining
**Source:** `src/pages/blog/[...id].astro` line 6 (draft filter), `src/pages/voyages/great-loop/index.astro` line 5 (voyage filter)
**Apply to:** `src/components/VoyageMap.astro` frontmatter
```astro
// Blog post page — draft filter
const posts = await getCollection('blog', ({ data }) => !data.draft);

// Voyage index — voyage filter
const posts = await getCollection('blog', ({ data }) => data.voyage === 'great-loop');

// VoyageMap — combined filter (new)
const allPosts = await getCollection('blog', ({ data }) =>
  data.voyage === 'great-loop' && !data.draft && data.lat !== undefined && data.lon !== undefined
);
```

### Static Path Generation Pattern
**Source:** `src/pages/blog/[...id].astro` lines 3–16
**Apply to:** Not directly used in Phase 5 (no new dynamic routes), but note that `getCollection` in component frontmatter (VoyageMap) runs at build time the same way — no `export async function getStaticPaths()` needed in a component.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/data/route-track.json` (stub) | data asset | — | No GeoJSON data files exist yet in `src/`; the stub is a hand-authored empty GeoJSON Feature with empty LineString coordinates array |
| Leaflet `<script>` initialization block | client-side script | event-driven | No interactive client-side scripts exist in this codebase yet — all components are purely server-rendered Astro. The data-attribute + bundled `<script>` pattern is entirely new territory; planner must follow RESEARCH.md Pattern 1 and Pattern 2 verbatim |

---

## Critical Anti-Patterns (from RESEARCH.md — avoid in all new files)

1. **Never `define:vars` with Leaflet.** Forces `is:inline`, breaks `import L from 'leaflet'`. Use `data-*` attributes or inline JSON `<script>` tags instead.

2. **Never `import L from 'leaflet'` in `.astro` frontmatter** (`---` section). Frontmatter runs during SSR; `window` is not defined. Only import Leaflet inside `<script>` tags.

3. **Never use default Leaflet marker icons** (`L.marker()` without explicit `icon`). Vite hashes PNG filenames in production; default icon paths break. Always use `L.divIcon()` with inline SVG.

4. **Never render PostMiniMap on list/index pages.** One Leaflet instance per page maximum. PostMiniMap is exclusively for individual post pages (D-05).

---

## Metadata

**Analog search scope:** `src/components/`, `src/pages/`, `src/layouts/`, `scripts/`, `astro.config.mjs`, `src/content.config.ts`
**Files scanned:** 11
**Pattern extraction date:** 2026-07-19
