# Phase 2: Blogger Migration - Research

**Researched:** 2026-07-07
**Domain:** Blogger Atom JSON API → Astro 7 MDX content collection migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use both the Atom JSON API (primary) and the Blogger XML export (validation). The Atom API pipeline in `blog-viewer.mjs` is the primary data source — extend it into the full importer. The Blogger XML export is used to validate coverage (post count, slug completeness). Check if an XML file already exists in the project; if not, the plan should note where to download it (Blogger admin → Settings → Manage blog → Back up content).
- **D-02:** The Atom JSON API delivers full post HTML (`entry.content.$t`), `blogger.googleusercontent.com` image URLs, and `blogger.com/video.g?token=` video tokens. These are the canonical source of truth for Phase 2.
- **D-03:** Preserve raw Blogger HTML in the MDX body. `migrated: true` in frontmatter flags it as a raw import. All prose reformatting, structural cleanup, and quality lifting is deferred to Phase 3.
- **D-04:** During import, sanitize ONLY tags that would break MDX compilation (unclosed tags, script blocks, Blogger-specific components that MDX cannot parse). Do not touch prose, image tags, or structural HTML.
- **D-05:** Leave photos inline in the HTML body where Blogger originally placed them. Do not extract to a frontmatter `images:` array. The existing `<img>` tags in the HTML body are the primary photo representation for migrated posts.
- **D-06:** `coverPhoto` frontmatter field is left empty on all Phase 2 imports. Cover photo selection happens during Phase 3 quality lift (Barbara reviews each post and picks the right photo).
- **D-07:** Replace Blogger-native video iframes (`blogger.com/video.g?token=...`) with HTML comment stubs: `<!-- video: [original-token-or-src] -->`. These tokens are opaque and it's unclear if they embed outside Blogger. Video migration (finding the YouTube URL or re-uploading) is a Phase 3 / human task.
- **D-08:** `VideoEmbed.astro` supports YouTube URLs only. It accepts a `url` prop (YouTube URL) and renders a responsive 16:9 iframe. No Blogger token handling — that's deferred.

### Claude's Discretion
- Slug format for new Astro URLs: the ROADMAP says `/voyages/great-loop/YYYY-MM-DD-slug/` — Claude's discretion on exact slug normalization (e.g., removing special characters, handling duplicate dates)
- Netlify redirect block format: `[[redirects]]` in `netlify.toml` vs. `_redirects` file — Claude picks based on existing `netlify.toml` structure
- MDX-breaking-tag sanitization implementation: which specific tags to strip (beyond the obvious) — Claude's discretion based on what the Atom API actually returns
- Astro content collection ID format: the filename becomes the `post.id` (e.g., `2022-04-16-getting-ready-to-go.mdx`)

### Deferred Ideas (OUT OF SCOPE)
- Video migration (finding YouTube URLs for Blogger-hosted videos) — Phase 3 human task
- Cover photo selection — Phase 3 quality lift
- Photo gallery restructuring (extracting inline images to Gallery component) — Phase 3
- `migrated` flag lifecycle beyond `true` (e.g., `"lifted"`, `false`) — Phase 3 context
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MIG-01 | All existing Blogger posts extracted from XML export and converted to MDX | Atom API + caching pattern from blog-viewer.mjs; 72 posts confirmed in blog-image-urls.json |
| MIG-02 | Post metadata preserved: publish date, slug, labels/tags | `entry.published.$t`, `entry.link[rel=alternate].href` (slug), `entry.category[]` (labels) all available in Atom JSON API |
| MIG-03 | Photo URLs from existing posts preserved and rendering correctly | `blogger.googleusercontent.com` URLs confirmed live (HTTP 200 on 3 tested); normalization to `/s1600/` already done by blog-viewer.mjs |
| MIG-04 | Netlify 301 redirects generated from old Blogger URLs to new Astro URLs | `public/_redirects` file, 72 lines, format confirmed below |
| MIG-05 | Existing blog remains live during migration (no DNS changes until site is ready) | Import is write-only to new Astro repo; Blogger blog untouched |
| MEDIA-01 | Per-post photo galleries rendering from cloud-hosted URLs (plain `<img>` with lazy loading) | Gallery.astro: CSS grid + `<img loading="lazy" decoding="async">` |
| MEDIA-02 | Video embeds supported (cloud-hosted or YouTube) | VideoEmbed.astro: YouTube URL → `/embed/ID` iframe, 16:9 ratio |
| MEDIA-03 | Gallery layout is responsive and touch-friendly on mobile | CSS `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` |
</phase_requirements>

---

## Summary

The Atom JSON API (`/feeds/posts/default?alt=json&max-results=25`) is confirmed to provide all required data for migration: full HTML content in `entry.content.$t`, Blogger slugs via `entry.link[rel=alternate].href`, publish dates, and Blogger labels via `entry.category[]`. The existing `blog-image-urls.json` cache has image URLs and video tokens for all 72 posts, but does NOT include the raw HTML content — the import script must fetch the full content from the API and cache it in a new `blog-posts-full.json` file.

The `blogger.googleusercontent.com` image URLs are confirmed live (HTTP 200 on 3 independent tests). No new npm packages are needed — the import script can be implemented with pure Node.js builtins following the existing project pattern. The only MDX compilation risks from Blogger HTML are void elements (`<br>`, `<img>`, `<hr>` without self-closing slash), bare curly braces in text, and `<script>`/`<style>` blocks; all fixable with simple regex transforms.

**Primary recommendation:** Write `scripts/import-blogger.mjs` extending `fetchAllPosts()` from `blog-viewer.mjs`; sanitize HTML with 6 targeted regex transforms; write 72 MDX files to `src/content/blog/great-loop/`; write 72 redirect rules to `public/_redirects`; then build to confirm Zod schema validates all posts.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch Blogger post data | Script (Node.js) | — | Runs at import time, not at build time; extends existing blog-viewer.mjs pattern |
| HTML sanitization | Script (Node.js) | — | Pre-processing step before MDX is written; not a runtime concern |
| MDX file generation | Script (Node.js) | — | Write-once content generation; Astro builds from the output files |
| Frontmatter validation | Astro build (Zod) | — | content.config.ts schema runs at `npm run build`; catches missing required fields |
| Photo serving | CDN (blogger.googleusercontent.com) | — | Photos stay cloud-hosted; site just references URLs |
| Redirect enforcement | Netlify (CDN edge) | — | `public/_redirects` processed by Netlify at edge; 301 permanent redirects |
| Post rendering | Astro (SSG) | BlogPost.astro layout | `[...id].astro` generates static HTML from MDX at build time |
| Gallery display | Browser (static HTML) | Gallery.astro | `<img loading="lazy">` rendered as static HTML; no JS needed |
| Video display | Browser (static HTML) | VideoEmbed.astro | YouTube iframe rendered as static HTML |

---

## Standard Stack

### Core (No New Packages)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `node:fetch` | Node 22 built-in | Atom JSON API requests | Already used by all project scripts |
| `node:fs` | Node 22 built-in | Write MDX files and `_redirects` | Already used by all project scripts |
| `new URL(postUrl)` | Node 22 built-in | Extract slug from Blogger post URL | Zero deps, correct parsing |
| Regex (no library) | — | HTML sanitization (6 transforms) | Sufficient for targeted transforms; project avoids npm deps in scripts |
| YAML string template | — | Frontmatter generation | Simple key:value; no library needed for this schema |

### Supporting (Already in node_modules as transitive deps — DO NOT add without declaring)

| Library | Version in node_modules | Purpose | When to Use |
|---------|------------------------|---------|-------------|
| `fast-xml-parser` | 5.9.3 | Blogger XML export parsing (coverage validation only) | Only if Blogger XML export is downloaded and diff-checked against MDX output |

### New Astro Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Gallery.astro` | `src/components/Gallery.astro` | Responsive image grid from array of cloud URLs (MEDIA-01, MEDIA-03) |
| `VideoEmbed.astro` | `src/components/VideoEmbed.astro` | Responsive 16:9 YouTube iframe (MEDIA-02) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex HTML sanitization | `node-html-parser` | Parser is more robust but adds a dependency; regex covers all 6 known Blogger patterns |
| `public/_redirects` | `[[redirects]]` in netlify.toml | netlify.toml approach works but makes config file 292 lines; `_redirects` keeps them separate |
| Atom JSON API | Blogger XML export | XML requires namespace-aware parsing; JSON API already proven in blog-viewer.mjs |

**No install command needed**: all implementation uses Node.js builtins or existing project deps.

---

## Package Legitimacy Audit

No new npm packages are recommended for this phase. The import script uses only Node.js built-in modules, following the established project pattern. `fast-xml-parser` is noted as a transitive dep already on disk (not to be `require()`-d without adding to `package.json`).

Gallery.astro and VideoEmbed.astro are Astro components (`.astro` files) — they are not npm packages.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**New npm packages requiring install:** none

*Note: slopcheck was unavailable at research time. Since no new packages are being installed, no audit entries are required.*

---

## Architecture Patterns

### System Architecture Diagram

```
Blogger Atom JSON API
        |
        v (fetchAllPosts() — 3 pages × 25 posts)
.planning/data/blog-posts-full.json  ← cache (new)
        |
        v (import-blogger.mjs)
   [for each post]
        |
        +-- sanitizeHtml(html)
        |     - <br> → <br />
        |     - <img ...> → <img ... />
        |     - <hr> → <hr />
        |     - { → &#123; } → &#125;  (in text only)
        |     - <script>...</script> → (removed)
        |     - <style>...</style> → (removed)
        |     - Blogger video iframe → <!-- video: url -->
        |
        +-- buildFrontmatter(entry)
        |     - title, date, voyage="great-loop"
        |     - location (first label || "Great Loop")
        |     - excerpt (strip HTML, first 200 chars)
        |     - migrated: true
        |
        +-- extractSlug(postUrl)
        |     e.g. /2022/04/getting-ready-to-go.html → getting-ready-to-go
        |
        +-- Write MDX → src/content/blog/great-loop/YYYY-MM-DD-slug.mdx
        |
        +-- Append redirect line → public/_redirects
              /YYYY/MM/slug.html /blog/YYYY-MM-DD-slug/ 301

        [end loop]
        |
        v
  npm run build
        |
   Astro Zod schema validates all 72 posts
   build output → dist/
        |
   Netlify deploy (git push)
        |
   CDN edge: _redirects active at 301 rules
```

### Recommended Project Structure (Phase 2 additions)

```
scripts/
├── blog-viewer.mjs          # EXISTING — reuse fetchAllPosts()
├── import-blogger.mjs       # NEW — primary import script
└── (other existing scripts)

src/
├── components/
│   ├── Gallery.astro        # NEW — responsive image grid
│   └── VideoEmbed.astro     # NEW — YouTube iframe
└── content/
    └── blog/
        └── great-loop/
            ├── 2024-01-01-test-scaffold.mdx   # DELETE before import
            └── YYYY-MM-DD-slug.mdx            # 72 NEW files

public/
└── _redirects               # NEW — 72 Netlify 301 rules

.planning/data/
└── blog-posts-full.json     # NEW cache — full HTML content from API
```

### Pattern 1: Atom API Fetch (extend from blog-viewer.mjs)

```javascript
// Source: scripts/blog-viewer.mjs (existing, confirmed working)
// The full entry object from the API includes additional fields not in blog-image-urls.json:

const entry = feed.feed.entry[i];
const title      = entry.title?.$t ?? '(untitled)';
const published  = (entry.published?.$t ?? '').slice(0, 10);  // "YYYY-MM-DD"
const postUrl    = entry.link?.find(l => l.rel === 'alternate')?.href ?? '';
const html       = entry.content?.$t ?? '';
const labels     = (entry.category ?? [])
                     .filter(c => c.scheme === 'http://www.blogger.com/atom/ns#')
                     .map(c => c.term);
const posterId   = entry.id?.$t ?? '';  // Blogger post ID (for idempotency key)
```

### Pattern 2: Slug Extraction (no library)

```javascript
// Source: derived from confirmed postUrl pattern (72 posts verified)
// Blogger URL: https://jackiebiiigoingloopy.blogspot.com/2022/04/getting-ready-to-go.html
function extractSlug(postUrl) {
  const pathname = new URL(postUrl).pathname;  // /2022/04/getting-ready-to-go.html
  const parts = pathname.split('/');
  const filename = parts[parts.length - 1];    // getting-ready-to-go.html
  return filename.replace(/\.html$/, '');      // getting-ready-to-go
}

function buildFilename(dateStr, slug) {
  return `${dateStr}-${slug}.mdx`;             // 2022-04-16-getting-ready-to-go.mdx
}

function buildRedirectLine(dateStr, year, month, slug) {
  const astroPath = `/blog/${dateStr}-${slug}/`;
  return `/${year}/${month}/${slug}.html ${astroPath} 301`;
}
```

### Pattern 3: MDX Frontmatter Template

```javascript
// Required fields per src/content.config.ts (Zod schema verified)
function buildMdx(frontmatter, sanitizedHtml) {
  const title = frontmatter.title.replace(/"/g, '\\"');
  const location = frontmatter.location.replace(/"/g, '\\"');
  const excerpt  = frontmatter.excerpt.replace(/"/g, '\\"');

  return `---
title: "${title}"
date: ${frontmatter.date}
voyage: "great-loop"
location: "${location}"
excerpt: "${excerpt}"
migrated: true
---

${sanitizedHtml}
`;
}
```

### Pattern 4: HTML Sanitization (6 targeted regex transforms)

```javascript
// Source: [ASSUMED] — based on known Blogger HTML patterns + MDX v3 compilation rules
// Applied in this order to avoid double-processing

function sanitizeHtml(html) {
  return html
    // 1. Replace Blogger video iframes with comment stubs (D-07)
    .replace(
      /<iframe[^>]+src=['"][^'"]*blogger\.com\/video\.g\?token=([^'"&\s]+)[^'"]*['"][^>]*>[\s\S]*?<\/iframe>/gi,
      (_, token) => `<!-- video: https://www.blogger.com/video.g?token=${token} -->`
    )
    // 2. Remove <script> blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // 3. Remove <style> blocks entirely
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // 4. Self-close void elements that MDX parser requires closed
    .replace(/<br(\s[^>]*)?\s*(?!\/)>/gi, '<br$1 />')
    .replace(/<hr(\s[^>]*)?\s*(?!\/)>/gi, '<hr$1 />')
    .replace(/<img(\s[^>]*)?\s*(?!\/)>/gi, '<img$1 />')
    // 5. Escape bare { and } in text nodes (outside of HTML tags)
    //    Replace { that is NOT part of an HTML tag or attribute
    .replace(/(?<!<[^>]*)\{/g, '&#123;')
    .replace(/(?<!<[^>]*)\}/g, '&#125;')
    .trim();
}
```

> **Important:** The curly-brace escaping regex (step 5) is approximate. After running on all 72 posts,
> do a spot-check build. If any post causes MDX compile errors with `Unexpected token`, inspect that
> post's raw HTML for unusual brace usage and add a targeted fix. The other 5 transforms are
> well-bounded and low-risk.

### Pattern 5: Gallery.astro

```astro
---
// Source: [ASSUMED] — consistent with MEDIA-01 spec (plain <img>, no Astro Image)
interface Props {
  images: string[];
  caption?: string;
}
const { images, caption = '' } = Astro.props;
---
<div class="gallery-grid">
  {images.map((src, i) => (
    <img
      src={src}
      alt={caption ? `${caption} (${i + 1})` : `Photo ${i + 1}`}
      loading="lazy"
      decoding="async"
    />
  ))}
</div>
<style>
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
    margin: 1.5rem 0;
  }
  .gallery-grid img {
    width: 100%;
    aspect-ratio: 4/3;
    object-fit: cover;
    border-radius: 4px;
  }
</style>
```

### Pattern 6: VideoEmbed.astro

```astro
---
// Source: [ASSUMED] — D-08 spec (YouTube URL only, 16:9 responsive)
interface Props {
  url: string;
  title?: string;
}
const { url, title = 'Video' } = Astro.props;
const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
---
<div class="video-embed">
  <iframe
    src={embedUrl}
    title={title}
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
    loading="lazy"
  ></iframe>
</div>
<style>
  .video-embed {
    position: relative;
    padding-bottom: 56.25%;
    height: 0;
    overflow: hidden;
    margin: 1.5rem 0;
  }
  .video-embed iframe {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    border-radius: 4px;
    border: none;
  }
</style>
```

### Anti-Patterns to Avoid

- **Using `npm run build` as the only validation**: Build proves Zod validation passes but not that content is correct. Always spot-check 5–10 posts visually after build.
- **Generating slugs from the post title**: Titles have special characters (`'`, `–`, `+`). Always extract slug from the `postUrl` URL path — Blogger already has the URL-safe version.
- **Appending to netlify.toml for redirects**: 72 `[[redirects]]` blocks (288 lines) pollutes the build config file. Use `public/_redirects` — same effect, separated concerns.
- **Re-fetching the Atom API on every run**: Cache `blog-posts-full.json` and skip re-fetch unless `--refresh` flag is passed. Matches blog-viewer.mjs pattern.
- **Writing MDX files without idempotency check**: Check if the target file already exists. If it does and `--force` is not passed, skip it. This makes re-runs safe during debugging.
- **Placing redirects in `dist/`**: Netlify reads `public/_redirects` before build; don't write there directly. Astro copies `public/` to `dist/` during build.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-safe slug generation | Custom slug normalizer | Extract from `postUrl` pathname (built-in `URL` class) | Blogger already generated the URL-safe slug; extracting it is trivial and guaranteed correct |
| HTML entity decoding | Custom entity decoder | `html.replace(/&amp;/g, '&')...` or use built-in `document.createTextNode` | Only needs to handle the ~5 common HTML entities for excerpt generation |
| YAML escaping | Custom YAML serializer | Double-quote all string values and escape `"` as `\"` | The schema has no nested structures; simple string quoting covers all cases |
| Redirect rule generation | Template engine | String interpolation in JS | 72 identical-format lines; one-liner |
| Frontmatter schema inference | Auto-detect from HTML | Use the Zod schema directly as spec | The schema is already defined in `content.config.ts`; derive from it, don't infer |

**Key insight:** The Blogger API has already done the hard work of slug normalization, date formatting, and image URL management. The import script's job is copying data, not transforming it.

---

## Common Pitfalls

### Pitfall 1: YAML Special Characters in Post Titles
**What goes wrong:** Titles like `Nor'easter in Deltaville` or titles with colons (`A Visit: Day 42`) break YAML parsing when not properly quoted, causing frontmatter parse errors at build time.
**Why it happens:** YAML has special meanings for `'`, `:`, `#`, `|`, `>` characters at specific positions.
**How to avoid:** Double-quote ALL string frontmatter values and escape any `"` inside them as `\"`. This covers all edge cases.
**Warning signs:** Build error mentioning `YAMLException` or `could not parse frontmatter`.

### Pitfall 2: Duplicate Post Dates (5 known pairs)
**What goes wrong:** Two posts with the same publish date would generate the same MDX filename if using only the date, causing one to overwrite the other.
**Why it happens:** Blogger allows multiple posts on the same date.
**How to avoid:** Always use `YYYY-MM-DD-blogger-slug` (not just `YYYY-MM-DD-title`) for filenames. The slug comes from the Blogger `postUrl`, which IS unique (Blogger enforces uniqueness).
**Known duplicates (all have unique slugs already):**
- 2022-05-25: `colorado-wedding-trip-may-19-23` + `days-29-36-baltimore`
- 2022-05-31: `day-38-39-chesapeake-city` + `day-40-to-cape-may`
- 2022-06-20: `generator-and-final-days-in-cape-may` + `sandy-hook-day-63`
- 2022-07-01: `little-falls-day-72` + `to-sylvan-beach-days-73`
- 2022-07-12: `trent-severn-waterway-to-campbellford` + `trent-severn-going-to-hastings-day-82`

### Pitfall 3: MDX Compilation Failure from Bare Curly Braces
**What goes wrong:** Blogger posts may contain `{` or `}` in prose text (e.g., "Here are the photos {Day 42}"). MDX v3 treats `{expr}` as a JavaScript expression. If the content inside braces is not valid JS, the build fails with `Unexpected token`.
**Why it happens:** MDX is not pure HTML — it's Markdown + JSX. The MDX parser scans for `{` even inside HTML blocks.
**How to avoid:** Replace bare `{` with `&#123;` and `}` with `&#125;` during sanitization (step 5 in Pattern 4). Spot-check the first 5 posts' HTML for brace usage before the full run.
**Warning signs:** `npm run build` fails with `Error: Could not parse expression with acorn` or `Unexpected token`.

### Pitfall 4: `location` Field Has No Structured Source
**What goes wrong:** `location: z.string()` is required in the Zod schema. The Blogger Atom API has no structured location field.
**Why it happens:** Blogger is a general blogging platform; the travel blog's location context is in the content, not metadata.
**How to avoid:** Use the first Blogger label from `entry.category[]` (scheme = `http://www.blogger.com/atom/ns#`) as the location. If no labels, fall back to `"Great Loop"`. Log which posts use the fallback so Phase 3 can fill them in.
**Warning signs:** Build error `Required` on the `location` field if the field is accidentally omitted.

### Pitfall 5: Existing Dummy Posts in `src/content/blog/great-loop/`
**What goes wrong:** `2024-01-01-test-scaffold.mdx` exists in the great-loop content directory. If not deleted before import, it will appear in the live site as a junk post.
**Why it happens:** Phase 1 created a validation post that is no longer needed.
**How to avoid:** Delete `src/content/blog/great-loop/2024-01-01-test-scaffold.mdx` as the first step of the import plan. (Note: `first-post.md`, `second-post.md`, etc. at `src/content/blog/` are NOT in the collection — glob pattern is `base: './src/content/blog/great-loop'` — so they don't need removal for Phase 2.)

### Pitfall 6: Atom API Pagination Overrun
**What goes wrong:** The `max-results=25&start-index=N` pattern breaks if Blogger returns fewer entries without the final page being exactly `<25`. The loop breaks on `entries.length < 25`, which is correct — but if the API returns exactly 25 on the last page, the loop fetches one more empty page before breaking.
**Why it happens:** Blogger's API is page-based, not cursor-based.
**How to avoid:** The `blog-viewer.mjs` pattern already handles this correctly (`if entries.length === 0 break`). Reuse the exact same loop. Do NOT modify the loop logic.

### Pitfall 7: `_redirects` File Not Copied to `dist/`
**What goes wrong:** If `_redirects` is written to the project root instead of `public/`, it won't be in the Netlify deploy.
**Why it happens:** Netlify expects `_redirects` in the publish directory (`dist/`). Astro copies `public/` → `dist/` during build.
**How to avoid:** Write to `public/_redirects`. Verify after `npm run build` that `dist/_redirects` exists.

### Pitfall 8: `<img>` tags in Blogger HTML have `border="0"` and deprecated attrs
**What goes wrong:** Blogger's WYSIWYG editor generates `<img border="0" data-original-height="3024" ...>` tags. These are valid HTML but the unclosed form (`<img ...>` without `/>`) breaks MDX.
**Why it happens:** HTML4-era void elements don't need closing; MDX/JSX requires them.
**How to avoid:** The sanitization regex in Pattern 4 (step 4) handles this. Ensure the regex captures all attributes: `/<img(\s[^>]*)?\s*(?!\/)>/gi`.

---

## Blogger API: Confirmed Data Available per Entry

From `entry.content.$t` and the Atom JSON API structure `[VERIFIED: direct code inspection of blog-viewer.mjs + confirmed working fetches]`:

| Field | API Path | Format | Notes |
|-------|----------|--------|-------|
| Title | `entry.title.$t` | String | May contain `'`, `"`, special chars |
| Publish date | `entry.published.$t` | ISO 8601 e.g. `"2022-04-16T..."` | Slice `[0,10]` for YYYY-MM-DD |
| HTML content | `entry.content.$t` | Raw HTML string | Full post body |
| Post URL | `entry.link[rel=alternate].href` | URL string | Contains Blogger slug |
| Blogger labels | `entry.category[]` | `[{scheme, term}]` | Filter by scheme=`http://www.blogger.com/atom/ns#` |
| Blogger post ID | `entry.id.$t` | String | Unique across all posts; useful for idempotency |
| Author | `entry.author[0].name.$t` | String | "Barbara" — not needed for Phase 2 |
| Updated | `entry.updated.$t` | ISO 8601 | Not needed for Phase 2 |

**NOT in current cache files:** `entry.content.$t` (HTML body), `entry.category[]` (labels), `entry.id.$t`. The import script must fetch and cache these.

---

## Blogger URL Structure: Confirmed Pattern

`[VERIFIED: direct inspection of all 72 postUrls in blog-image-urls.json]`

- Domain: `https://jackiebiiigoingloopy.blogspot.com`
- Path pattern: `/YYYY/MM/slug.html`
- Example: `/2022/04/getting-ready-to-go.html`
- All 72 posts follow this exact pattern. No custom domains, no alternate structures.
- Month is zero-padded (e.g., `/04/` not `/4/`)

**Redirect source → target mapping:**
```
/2022/04/getting-ready-to-go.html  →  /blog/2022-04-16-getting-ready-to-go/  301
/2022/04/happy-easter.html         →  /blog/2022-04-17-happy-easter/           301
```

Date in redirect target (`2022-04-16`) comes from `entry.published.$t`, NOT from the URL path. URL path only has YYYY/MM; the day comes from the API.

---

## Photo URL Stability

`[VERIFIED: direct HTTP tests of 3 URLs from blog-image-urls.json]`

- URL base: `https://blogger.googleusercontent.com/img/b/R29vZ2xl/[opaque-token]/s1600/[filename.ext]`
- HTTP status for 3 tested URLs: **200 ✓**
- Size parameter `/s1600/` is the normalized format from blog-viewer.mjs — keep this normalization
- URL stability depends on the Blogger blog remaining active (MIG-05 locks no DNS change, so blog stays live)
- `[ASSUMED]` that these URLs remain stable for the long term as long as the blogspot.com blog exists

---

## Content.config.ts Schema: Compliance Checklist

From `src/content.config.ts` Zod schema `[VERIFIED: direct file read]`:

| Field | Type | Phase 2 Value | Source |
|-------|------|--------------|--------|
| `title` | `z.string()` required | Post title | `entry.title.$t` |
| `date` | `z.coerce.date()` required | Publish date | `entry.published.$t.slice(0, 10)` |
| `voyage` | `z.string()` required | `"great-loop"` | Hardcoded |
| `location` | `z.string()` required | First label OR `"Great Loop"` | `entry.category[0].term` or fallback |
| `excerpt` | `z.string()` required | First ~200 chars stripped text | Strip HTML from `entry.content.$t` |
| `migrated` | `z.boolean().default(false)` | `true` | Hardcoded (D-03) |
| `lat` | `z.number().optional()` | Omit | Phase 4 |
| `lon` | `z.number().optional()` | Omit | Phase 4 |
| `coverPhoto` | `z.string().optional()` | Omit | Phase 3 (D-06) |
| `anchorage` | `z.string().optional()` | Omit | Phase 3 |
| `marina` | `z.string().optional()` | Omit | Phase 3 |

**Excerpt generation:** `html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim().slice(0, 200)`

---

## Netlify Redirect Format Decision

**Decision (Claude's Discretion):** Use `public/_redirects` file, not `[[redirects]]` in `netlify.toml`.

**Rationale:**
- `netlify.toml` is currently 4 lines (clean build config). Adding 288 redirect lines pollutes it.
- Netlify treats `public/_redirects` identically to `[[redirects]]` in `netlify.toml` — same priority, same behavior.
- Astro copies `public/` to `dist/` at build time; `dist/_redirects` is what Netlify reads.
- 72 lines in `_redirects` is machine-readable and easy to verify with `wc -l`.

**Format:**
```
# Blogger → Astro 301 redirects (auto-generated by scripts/import-blogger.mjs)
/2022/04/getting-ready-to-go.html /blog/2022-04-16-getting-ready-to-go/ 301
/2022/04/happy-easter.html /blog/2022-04-17-happy-easter/ 301
...
```

**Netlify limit:** Free tier supports up to 1,000 redirect rules. 72 is well within limit. `[ASSUMED]` — limit not verified against current Netlify free tier terms.

---

## MDX Compilation: Astro 7 + @astrojs/mdx 7 Specifics

`[VERIFIED: package.json inspection + node_modules check]`

- Astro version: 7.0.3
- `@astrojs/mdx` version: 7.0.0
- `@mdx-js/mdx` version: ^3.1.1 (MDX v3)
- `rehype-raw`: 7.0.0 — processes raw HTML blocks through HTML-aware parser

**What `rehype-raw` means for Blogger HTML:**
- HTML blocks (block-level HTML like `<div>`, `<a>`, etc.) go through rehype-raw
- This makes the pipeline more forgiving of legacy HTML attrs (`border="0"`, `align="center"`)
- But `{` and `}` in TEXT nodes are still processed by the MDX parser before rehype-raw runs — they can still break compilation

**What DOES NOT break with `rehype-raw`:**
- `<div>` wrappers (Blogger's image separator divs)
- Deprecated HTML attributes (`border`, `align`, `valign`, `cellpadding`)
- `&nbsp;`, `&amp;`, `&lt;` HTML entities
- YouTube iframes (valid block-level HTML)

**What STILL breaks even with `rehype-raw`:**
- `<br>` without self-closing slash → fix to `<br />`
- `<img ...>` without self-closing slash → fix to `<img ... />`
- Bare `{` and `}` in text → escape to `&#123;` / `&#125;`
- `<script>` blocks → remove (security + MDX compiler confusion)
- `<style>` blocks → remove
- Blogger video iframes → replace with comment stub (D-07)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gray-matter` npm pkg for YAML frontmatter | String template (no library) | Project convention | No new deps; template is sufficient for flat schema |
| Astro 4.x content collections (file-based) | Astro 5+/7 content layer with `glob()` loader | Astro 5 | Same behavior; glob() is now the standard import pattern |
| MDX v2 (less strict HTML) | MDX v3 via `@mdx-js/mdx` 3.1.1 | Astro 4+ | Stricter JSX in HTML blocks; void elements MUST be self-closed |
| `[[redirects]]` in netlify.toml | `public/_redirects` file | Netlify (always supported) | Cleaner separation; both valid |
| Manual YAML with `js-yaml` | String templates | Project convention | Zero deps |

**Deprecated/outdated:**
- `blog-viewer.mjs` as standalone tool: still valid for browsing; the import script re-uses `fetchAllPosts()` logic, not replaces it
- `2024-01-01-test-scaffold.mdx`: outdated Phase 1 test file; must be deleted before Phase 2 import

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `blogger.googleusercontent.com` URLs remain stable long-term (as long as blogspot.com blog exists) | Photo URL Stability | Photos break if Blogger deletes or rotates URLs; medium risk since blog stays live (MIG-05) |
| A2 | Netlify free tier supports at least 1,000 redirect rules in `_redirects` | Netlify Redirect Format | If limit is lower, some redirects would be silently ignored; unlikely given 72 rules |
| A3 | Blogger Atom API `entry.category[]` with scheme `http://www.blogger.com/atom/ns#` contains the post labels | Blogger API: Confirmed Data | If labels are absent or structured differently, `location` will always fall back to "Great Loop"; low impact |
| A4 | Regex step 5 (curly brace escaping) `(?<!<[^>]*)` lookbehind correctly identifies text-node braces vs. attribute values | Pattern 4: HTML Sanitization | A missed brace in text would cause MDX compile failure on that post; caught at build time |
| A5 | All 72 Blogger posts are of type "post" (not page/label/archive); no filtering needed | Architecture Patterns | If the feed contains non-post entries, they'd generate invalid MDX files; verify by checking final count == 72 |
| A6 | `_redirects` in Netlify processes only the PATH portion, not the host | Netlify Redirect Format | If Netlify also tries to match the blogspot.com domain, redirects may not activate; but since redirects are host-agnostic on Netlify, this is fine |

**If this table is empty, all claims were verified.** This table contains 6 assumptions that the planner and executor should confirm.

---

## Open Questions

1. **Does the Blogger Atom API include labels (`entry.category`) for all posts?**
   - What we know: The `entry.category` field exists in the Blogger Atom JSON spec
   - What's unclear: Not verified against this blog's actual API response (blog-viewer.mjs doesn't capture labels)
   - Recommendation: The import script should log label data for the first 5 posts during development to confirm the field structure. If labels are absent, `location` defaults to "Great Loop" without breaking anything.

2. **Is a Blogger XML export available on disk?**
   - What we know: `find` command found no `.xml` files except in `dist/` (Astro sitemap output). No XML export exists on disk.
   - What's unclear: Whether downloading it is feasible and worthwhile for validation
   - Recommendation: CONTEXT.md says to validate coverage. Since `blog-image-urls.json` already has the 72 post list (slugs + dates), the XML export is optional. Use the existing JSON cache for coverage validation. The plan should note: if 72 MDX files exist AND all slugs match `blog-image-urls.json`, coverage validation passes without needing the XML.

3. **Are there any YouTube iframes already in Blogger posts (not Blogger-native video)?**
   - What we know: `blog-image-urls.json` video tokens are ALL `blogger.com/video.g?token=...`. `blog-inventory.json` shows 55 videos while the token regex captured 44. The delta (11) may be YouTube embeds.
   - What's unclear: Whether 11 posts have YouTube iframes that the current regex doesn't capture
   - Recommendation: The import script should also log any `<iframe>` tags that match `youtube.com/embed` and leave them as-is (they're already valid HTML). Only Blogger token URLs need the comment stub treatment.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22 | Import script, all scripts | ✓ | 22.x (package.json engines) | — |
| `npm` | Package management | ✓ | Confirmed (npm view commands succeeded) | — |
| Internet / Blogger API | Import script (Atom fetch) | ✓ | HTTP 200 on all tested requests | Use `blog-image-urls.json` cache; HTML not in cache so must fetch |
| `public/` directory | `_redirects` output | ✓ | Exists (`public/favicon.ico` confirmed) | — |
| `src/content/blog/great-loop/` | MDX file output | ✓ | Exists (has test-scaffold.mdx) | — |
| Netlify deploy (git push) | Redirect activation | ✓ | Already configured in netlify.toml | — |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None (all required tooling confirmed available)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — Astro build-time Zod validation (no jest/vitest installed) |
| Config file | none |
| Quick run command | `npm run build` |
| Full suite command | `npm run build` + manual spot-checks |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MIG-01 | 72 MDX files in great-loop/ | Build check | `ls src/content/blog/great-loop/ | wc -l` == 72 | ❌ Wave 0: add to import script summary output |
| MIG-02 | Frontmatter has title, date, voyage, location, excerpt | Build (Zod) | `npm run build` (Zod validates all) | ✅ content.config.ts |
| MIG-03 | Photo URLs render (HTTP 200) | Manual spot-check | `curl -o /dev/null -w "%{http_code}" [url]` for 10 posts | ❌ Wave 0: add to import script smoke-check |
| MIG-04 | 72 redirect rules in public/_redirects | File count check | `grep -c "^/" public/_redirects` == 72 | ❌ Wave 0: generated by import script |
| MIG-05 | Blogger blog still live | Manual check | Visit jackiebiiigoingloopy.blogspot.com | — |
| MEDIA-01 | Gallery.astro renders `<img loading="lazy">` | Build smoke + visual | `npm run build && grep -r "loading=\"lazy\"" dist/` | ❌ Wave 0: create Gallery.astro |
| MEDIA-02 | VideoEmbed.astro renders YouTube iframe | Build smoke + visual | `npm run build` + visit a post with YouTube embed | ❌ Wave 0: create VideoEmbed.astro |
| MEDIA-03 | Gallery is responsive (CSS grid) | Visual (mobile viewport) | Browser DevTools: simulate 375px viewport | ❌ Wave 0: CSS in Gallery.astro |

### Sampling Rate
- **Per task commit:** `npm run build` (Astro Zod validation catches schema errors immediately)
- **Per wave merge:** `npm run build` + file count check + visual spot-check of 5 posts
- **Phase gate:** Full build green + `wc -l public/_redirects` == 72 + visual check of 10 redirects before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/import-blogger.mjs` — the primary import script; covers MIG-01, MIG-02, MIG-03, MIG-04
- [ ] `src/components/Gallery.astro` — covers MEDIA-01, MEDIA-03
- [ ] `src/components/VideoEmbed.astro` — covers MEDIA-02
- [ ] `public/_redirects` — generated by import script; verify count after run
- [ ] Delete `src/content/blog/great-loop/2024-01-01-test-scaffold.mdx` — must precede import

---

## Security Domain

`security_enforcement` is not set in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Public read-only site (SITE-01) |
| V3 Session Management | No | No sessions; static site |
| V4 Access Control | No | No auth; all content public |
| V5 Input Validation | Partial | Blogger HTML is external input — sanitization removes scripts/styles |
| V6 Cryptography | No | No secrets in this phase |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `<script>` in Blogger HTML injected into MDX | Spoofing/Tampering | Sanitization step 2: strip all `<script>` blocks before writing MDX |
| `<style>` blocks injecting CSS into page layout | Tampering | Sanitization step 3: strip all `<style>` blocks |
| Malicious Blogger image URL (unlikely since source is own blog) | Tampering | N/A — URLs are from own Blogger account, not user input |
| `{dangerousHtml}` MDX expressions injected via Blogger content | Tampering | Sanitization steps 4-5: void elements self-closed, braces escaped |

**Security verdict:** Phase 2 is low-risk. The import script processes content from the project owner's own Blogger account. Sanitization steps are defensive-in-depth, not primary security controls.

---

## Sources

### Primary (HIGH confidence)
- `scripts/blog-viewer.mjs` — source of truth for Atom API structure; fetchAllPosts() confirmed working
- `src/content.config.ts` — Zod schema spec; direct file read
- `src/layouts/BlogPost.astro` — frontmatter consumption; direct file read
- `src/pages/blog/[...id].astro` — URL routing; direct file read
- `netlify.toml` — existing build config; direct file read
- `.planning/data/blog-image-urls.json` — 72 posts with confirmed URLs; cache generated 2026-06-27
- `.planning/data/blog-inventory.json` — post count confirmation (72); generated 2026-06-27
- HTTP status tests — 3 `blogger.googleusercontent.com` URLs returned 200

### Secondary (MEDIUM confidence)
- `node_modules/@astrojs/mdx/package.json` — confirmed `@mdx-js/mdx ^3.1.1` and `rehype-raw ^7.0.0`
- `npm view fast-xml-parser version` — confirmed 5.9.3 in registry
- `npm view node-html-parser version` — confirmed 9.0.0 in registry (published 2026-07-06)
- `.planning/STATE.md` — project history and pipeline status

### Tertiary (LOW confidence / Assumed)
- Blogger Atom API `entry.category` structure — from training knowledge; not verified against live API response for this blog
- MDX v3 curly-brace behavior in text nodes inside HTML blocks — from training knowledge; may need empirical testing during import

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package versions verified in node_modules; no new packages needed
- Blogger API: HIGH — blog-viewer.mjs is confirmed working; data shapes verified in cache files
- MDX sanitization: MEDIUM — rehype-raw confirmed; curly-brace escaping regex is ASSUMED
- Redirects: HIGH — `public/_redirects` format is standard Netlify behavior
- Photo URLs: HIGH — HTTP 200 confirmed on 3 tests
- Astro routing: HIGH — `[...id].astro` and content.config.ts directly read

**Research date:** 2026-07-07
**Valid until:** 2026-08-07 (30 days for stable tech; Blogger API has been stable for years)
