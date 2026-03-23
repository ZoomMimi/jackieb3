# Technology Stack

**Project:** Jackie B III Going Loopy — Great Loop Cruise Blog
**Researched:** 2026-03-23
**Knowledge cutoff:** August 2025 (Astro 4.x / early 5.x era)
**Overall confidence:** MEDIUM — all findings from training data; no live docs verified this session due to tool restrictions. Flag each section before implementation.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Astro | 5.x (latest stable) | Static site generator + routing | SSG mode produces zero-JS-by-default HTML; content collections are first-class; already used on reunion-website so team has context |
| Node.js | 20 LTS | Build runtime | Astro 5.x minimum requirement |

**Confidence: MEDIUM.** Astro 5.0 shipped in late 2024. The Content Layer API (replacing the old content collections loader) landed in 5.x. Verify current stable version before scaffolding.

---

### Deployment

| Technology | Purpose | Why |
|------------|---------|-----|
| Netlify (free tier) | Hosting + CI/CD | Static output fits free tier limits; deploy previews on every PR; project constraint |

**No Netlify adapter needed for static output.** Use `output: 'static'` in `astro.config.mjs`. The `@astrojs/netlify` adapter is only required for SSR (server-rendered) mode. For a public read-only blog, pure static output is correct.

Netlify build settings for Astro:
- Build command: `npm run build` (or `astro build`)
- Publish directory: `dist`
- Node version: set via `.nvmrc` or Netlify environment variable `NODE_VERSION=20`

**Confidence: HIGH.** This pattern is stable and well-established.

---

### Content

| Technology | Purpose | Why |
|------------|---------|-----|
| Astro Content Collections (MDX) | Blog posts | Schema-validated frontmatter; type-safe queries; supports rich travel metadata |
| Zod | Frontmatter schema validation | Ships with Astro; catches missing fields at build time |
| MDX | Post format | Allows embedding Astro components (galleries, video players, maps) inline in post content |

**Confidence: HIGH** for content collections + Zod. **MEDIUM** for MDX — MDX adds build complexity; plain Markdown + layout components is simpler but loses inline component embedding.

---

### Mapping

| Technology | Purpose | Why |
|------------|---------|-----|
| Leaflet.js | Interactive route map | Open-source, no API key required, well-supported; renders GPX/GeoJSON route lines and clickable markers |
| Astro Island (`client:load`) | Hydrate map component | Map must be interactive; Astro islands isolate the JS to just the map component |

**Alternative considered: Mapbox GL JS.** Richer visual quality and better mobile touch handling, but requires an API key (free tier has usage limits). For a completed-trip static map with ~100 stops, Leaflet is sufficient and has zero ongoing cost.

**Alternative considered: Google Maps Embed API.** Simplest to set up, but API key required, usage quotas apply, and customization is limited.

**Use Leaflet + OpenStreetMap tiles.** No key, no quota, full control over stop markers and popup content.

**Confidence: HIGH** for Leaflet pattern on static Astro sites.

---

### Image Handling

| Technology | Purpose | Why |
|------------|---------|-----|
| Standard `<img>` tags with `loading="lazy"` | Reference cloud-hosted photos | Astro's `<Image>` component optimizes local images; cloud-hosted URLs bypass Astro's optimizer entirely — use native HTML |
| Inline MDX gallery component | Per-post photo galleries | Wrap a list of cloud URLs in a `<Gallery>` component; no build-time image processing needed |

**Critical detail:** Astro's `<Image />` component (from `astro:assets`) performs build-time optimization of *local* images. For external URLs (Blogger CDN, Google Photos, iCloud, etc.), it passes them through unchanged but still requires you to specify `width` and `height` props — which you likely won't know for every photo. Use a plain `<img loading="lazy" />` or a custom gallery component that renders `<img>` tags for all cloud-hosted images.

If you need Astro's `<Image>` with remote URLs, you must allowlist the domain in `astro.config.mjs`:
```js
// astro.config.mjs
export default defineConfig({
  image: {
    domains: ['lh3.googleusercontent.com', 'blogger.googleusercontent.com'],
  },
});
```
But even allowlisted, remote image optimization at build time fetches every image — slow and fragile for 80+ posts. Avoid it. Plain `<img loading="lazy">` is the right call here.

**Gallery pattern:** Create a reusable `Gallery.astro` component that takes an array of `{ url, caption }` objects and renders a CSS grid. Use `loading="lazy"` and `decoding="async"` on each `<img>`. No JavaScript required for a basic grid gallery. Add a lightbox (e.g., Glightbox or PhotoSwipe) as an Astro island if click-to-enlarge is needed.

**Confidence: HIGH** for the plain img + lazy loading pattern. **MEDIUM** for lightbox library choice — verify current maintenance status of Glightbox and PhotoSwipe before picking.

---

### Video Embeds

| Technology | Purpose | Why |
|------------|---------|-----|
| Custom `VideoEmbed.astro` component | YouTube and cloud video | Wraps iframe or `<video>` tag; handles responsive sizing |

**YouTube pattern** — use the nocookie domain and aspect-ratio CSS:
```astro
---
const { youtubeId } = Astro.props;
---
<div class="video-wrapper">
  <iframe
    src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
    title="YouTube video"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
    loading="lazy"
  ></iframe>
</div>

<style>
  .video-wrapper {
    position: relative;
    padding-bottom: 56.25%; /* 16:9 */
    height: 0;
    overflow: hidden;
  }
  .video-wrapper iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
```

**Cloud-hosted video (local Mac source converted to MP4):** Use `<video>` tag directly with `preload="metadata"` and a `poster` attribute for thumbnail. Host the MP4 on Cloudflare R2, Backblaze B2, or Bunny CDN — all free or near-free for low-traffic static sites.

**Netlify Large Media / Git LFS:** Do not commit MP4 files to the repo. Netlify's Large Media feature is deprecated. Store videos externally and reference by URL.

**Confidence: HIGH** for the iframe pattern. **MEDIUM** for external video hosting options — verify Cloudflare R2 free tier limits.

---

### Supporting Libraries

| Library | Purpose | When to Use | Confidence |
|---------|---------|-------------|------------|
| `astro-icon` or inline SVGs | UI icons | Navigation, metadata icons (anchor, camera, location pin) | MEDIUM |
| Glightbox or PhotoSwipe 5 | Lightbox for gallery click-to-enlarge | If you want click-through gallery UX | MEDIUM — verify maintenance |
| `leaflet` (npm) | Interactive map | Route map component | HIGH |
| `@types/leaflet` | TypeScript types for Leaflet | Dev dependency | HIGH |

---

## Content Collections Architecture

**Confidence: HIGH** for the schema design patterns below. **MEDIUM** for Astro 5.x Content Layer API specifics — the API changed between 4.x and 5.x.

### Collection Structure for Multi-Voyage Architecture

```
src/content/
  blog/
    great-loop/
      2023-05-15-leaving-chesapeake.mdx
      2023-05-16-norfolk-to-dismal-swamp.mdx
      ...
    voyage-2/          ← future, empty until needed
      ...
  voyages/
    great-loop.md      ← voyage metadata (dates, route, description)
    voyage-2.md        ← future
```

**Why one collection, subdirectory-per-voyage:** Astro content collections are flat by default, but you can filter by a `voyage` field in the frontmatter schema. This keeps all posts in one queryable collection while enabling per-voyage filtering, archive pages, and route maps scoped to a voyage.

### Recommended Frontmatter Schema

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    voyage: z.string(),                          // e.g. "great-loop"
    leg: z.number().optional(),                  // sequential stop number within voyage
    from: z.string().optional(),                 // departure location name
    to: z.string(),                              // arrival location name
    anchorage: z.boolean().default(false),       // anchored vs marina
    marina: z.string().optional(),               // marina name if applicable
    lat: z.number().optional(),                  // arrival GPS lat
    lon: z.number().optional(),                  // arrival GPS lon
    miles: z.number().optional(),                // nautical miles that day
    hours: z.number().optional(),                // hours underway
    photos: z.array(z.object({
      url: z.string().url(),
      caption: z.string().optional(),
    })).optional(),
    video: z.string().optional(),                // YouTube ID or cloud video URL
    coverImage: z.string().url().optional(),     // hero image URL
    excerpt: z.string().optional(),              // for map popups; falls back to first paragraph
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const voyages = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    description: z.string(),
    totalMiles: z.number().optional(),
  }),
});

export const collections = { blog, voyages };
```

**Key design decisions in this schema:**
- `voyage` as a string slug (not a reference) avoids collection-reference complexity while still enabling `getCollection('blog', ({ data }) => data.voyage === 'great-loop')` filtering.
- `lat`/`lon` on each post feeds the route map directly without a separate data file.
- `photos` as an inline array means frontmatter carries the gallery — no separate data file to maintain per post.
- `excerpt` supports the map popup without rendering the full post body.
- `draft: true` allows staging posts without publishing.

### Querying Pattern for Route Map

```typescript
// src/pages/voyages/[voyage]/map.astro
const posts = await getCollection('blog', ({ data }) =>
  data.voyage === voyage && !data.draft && data.lat !== undefined
);

const mapStops = posts
  .sort((a, b) => a.data.leg! - b.data.leg!)
  .map(post => ({
    lat: post.data.lat!,
    lon: post.data.lon!,
    title: post.data.title,
    to: post.data.to,
    excerpt: post.data.excerpt ?? '',
    coverImage: post.data.coverImage ?? '',
    slug: post.slug,
  }));
```

Pass `mapStops` as a serialized JSON prop to the Leaflet island component.

---

## Routing Structure

```
/                           → homepage (latest posts, voyage list)
/blog/                      → all posts paginated
/blog/[slug]/               → individual post
/voyages/                   → voyage index
/voyages/great-loop/        → great loop overview + map
/voyages/great-loop/map/    → full-screen interactive route map
/voyages/great-loop/stops/  → all stops in order (leg-by-leg index)
```

**Dynamic routes:** Use `getStaticPaths()` with `getCollection()` to generate all post and voyage pages at build time — this is standard Astro SSG pattern.

**Confidence: HIGH** for this routing structure. It maps cleanly to Astro's file-based routing.

---

## Netlify Configuration

### `netlify.toml` (place at repo root)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The redirect rule is a safety net for client-side navigation — not strictly needed for a fully static site, but harmless.

**Deploy previews:** Enabled by default on Netlify for all PRs/branches. No additional config required. Each deploy gets a unique URL for review before merging to `main`.

**Environment variables:** Set in Netlify dashboard under Site Settings > Environment Variables, not committed to repo. For this project (public read-only blog with cloud photo URLs), there should be no secrets needed.

**Build time:** Expect 60-120 seconds for a 100-post static build with no image optimization. If you add local image processing later, build times will increase significantly.

**Confidence: HIGH** for the netlify.toml pattern. **MEDIUM** for exact build time estimates.

---

## Astro Blog Starters Worth Knowing

**Confidence: MEDIUM** — starter landscape shifts; verify these still exist and are maintained.

| Starter | Relevance | Notes |
|---------|-----------|-------|
| `npm create astro@latest -- --template blog` | Official Astro blog template | Minimal, clean starting point; uses content collections; good baseline |
| `astro-theme-cactus` | Community theme | Minimal, content-collections-based; good typography; no travel-specific features but clean to customize |
| `astro-paper` | Community theme | Popular minimal blog; active maintenance as of mid-2025 |

**Recommendation:** Start from the official `blog` template, not a community theme. Themes add opinions and dependencies you'll fight against when building travel-specific layouts (leg-by-leg navigation, route maps, photo galleries). The official template gives you a working content collection and routing scaffold in ~50 lines, then you build on top.

**Do not start from scratch.** `create astro` with the blog template saves the initial boilerplate; the interesting work is all custom components anyway.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Astro | Next.js, Gatsby | Project constraint; Astro SSG is correct for read-only blog; no React required |
| Content | MDX in content collections | Sanity CMS, Contentful | No CMS overhead; all content lives in git; trip is complete so no ongoing editing workflow needed |
| Map | Leaflet + OSM | Mapbox GL JS | No API key, no cost, sufficient for completed-trip route |
| Map | Leaflet + OSM | Google Maps Embed | API key required, quota limits, poor customization |
| Image optimization | Plain `<img loading="lazy">` | Astro `<Image>` with remote URLs | Remote URL optimization is slow and fragile at build time for 80+ posts |
| Video hosting | External URL (R2/Backblaze) | Git LFS / Netlify Large Media | Netlify Large Media is deprecated; binary files in git repos are wrong |
| Lightbox | Glightbox or PhotoSwipe | None (grid-only) | Click-to-enlarge is a reasonable UX upgrade; pick whichever has better current maintenance |

---

## Installation (Starting Point)

```bash
# Scaffold with official blog template
npm create astro@latest jackieb3-website -- --template blog

# Add MDX support
npx astro add mdx

# Add Leaflet for route map
npm install leaflet
npm install -D @types/leaflet
```

No other adapters needed for static output on Netlify.

---

## Confidence Summary

| Area | Confidence | Basis |
|------|------------|-------|
| Content collections schema design | HIGH | Stable Astro API since 2.x; schema pattern is standard |
| Cloud image handling (plain img) | HIGH | Not Astro-specific; HTML fundamentals |
| Astro 5.x Content Layer API specifics | MEDIUM | API changed in 5.x from 4.x; verify current docs before implementing |
| Netlify static deploy config | HIGH | netlify.toml pattern unchanged for years |
| Leaflet + Astro island for map | HIGH | Standard pattern; well-documented |
| Video embed (YouTube iframe) | HIGH | Standard web pattern |
| Lightbox library choice | MEDIUM | Ecosystem shifts; verify maintenance before picking |
| Blog starter recommendations | MEDIUM | Starter landscape shifts frequently |

---

## Sources

All findings are from training data (knowledge cutoff August 2025). No live documentation was accessible in this session.

**Authoritative sources to verify before implementation:**
- Astro content collections: https://docs.astro.build/en/guides/content-collections/
- Astro images guide: https://docs.astro.build/en/guides/images/
- Astro Netlify deploy guide: https://docs.astro.build/en/guides/deploy/netlify/
- Astro 5.x Content Layer API (changed from 4.x): https://docs.astro.build/en/reference/content-loader-reference/
- Leaflet getting started: https://leafletjs.com/examples/quick-start/
- PhotoSwipe 5 docs: https://photoswipe.com/
- Glightbox: https://github.com/biati-digital/glightbox
