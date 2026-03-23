# Phase 1: Scaffolding - Research

**Researched:** 2026-03-23
**Domain:** Astro 6.x static site scaffolding, content collections, Netlify deploy, Tailwind CSS 4, Google Fonts
**Confidence:** HIGH — core findings verified against live official documentation (docs.astro.build, tailwindcss.com, docs.netlify.com)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Tailwind CSS — utility classes, no custom CSS files. Use the official Astro blog template which ships with Tailwind pre-configured. *(Note: the blog template does NOT include Tailwind by default — must be added separately. See Standard Stack.)*
- **D-02:** Nautical-themed visual aesthetic — navy blues, warm whites, brass/gold accents. Not overly themed with rope/anchor clipart, but clearly maritime in color and feel.
- **D-03:** Color palette: deep navy primary (`#1a2e4a` or equivalent), warm off-white background (`#faf9f6` or equivalent), brass/gold accent for links and highlights (`#c9a84c` or equivalent). Exact values are Claude's discretion within this direction.
- **D-04:** Serif body font + sans-serif headings. Serif (e.g., Lora, Playfair Display, or Georgia) for long-form post body text. Clean sans-serif (e.g., Inter or system-ui) for headings, nav, and UI chrome.
- **D-05:** Google Fonts for web fonts — loaded via Astro's standard font loading. Performance is Claude's discretion.
- **D-08:** `lat` and `lon` are optional — some stops may lack GPS data.
- **D-09:** `coverPhoto` is optional — not all posts will have a designated cover image.
- **D-10:** `anchorage` / `marina` is optional string — free text, not an enum.
- **D-11:** All other frontmatter fields are required: `title`, `date`, `voyage` (string slug e.g. `"great-loop"`), `location` (string, human-readable place name), `excerpt` (string), `migrated` (boolean, defaults to `false`).

### Claude's Discretion

- Exact Tailwind color token names and CSS variable setup
- Specific Google Font choices within the serif/sans direction
- Homepage component structure and markup
- Nav component implementation details
- Zod `.optional()` vs `.nullable()` for optional fields

### Deferred Ideas (OUT OF SCOPE)

- Interactive route map on homepage — Phase 5
- Photo gallery components — Phase 2/3
- Search, filtering — v2 backlog
- Video embed component — Phase 2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Astro project scaffolded with content collections schema (multi-voyage architecture) | Content Layer API glob loader with `src/content/blog/great-loop/` subdirectory structure |
| FOUND-02 | Content collection frontmatter schema covers: title, date, voyage, location, lat/lon, anchorage/marina, cover photo, excerpt, migrated flag | Zod schema with required/optional fields documented; see Architecture Patterns |
| FOUND-03 | Site deployed to Netlify free tier from git repository | Static output, no adapter, netlify.toml configuration documented |
| FOUND-04 | Responsive layout with consistent typography, heading hierarchy, and visual style across all posts | Tailwind 4 via Vite plugin, Google Fonts via Astro built-in Fonts API |
| SITE-01 | Public site, no login or authentication | Static SSG output by default — no auth layer needed |
| SITE-03 | Individual post pages with consistent layout | `src/pages/blog/[id].astro` with `getStaticPaths()` + `getCollection()` |
| SITE-04 | About page (Jackie B III, the crew, the Great Loop) | Static page at `src/pages/about.astro` |
| SITE-05 | Site architecture supports adding future voyages without restructuring | `voyage` field as string slug + subdirectory-per-voyage in content |
</phase_requirements>

---

## Summary

Phase 1 delivers the working infrastructure every subsequent phase builds on: an Astro 6.x static site deployed to Netlify with a validated content collection schema, responsive layout, and stub pages. The content is intentionally empty of real posts — this phase establishes the skeleton.

**Critical version update:** The prior project research (from Aug 2025 training data) assumed Astro 5.x and Node 20. Current state as of March 2026: **Astro 6.0.8 is the latest stable release, requiring Node.js >=22.12.0.** The project decision of "Astro 5.x" should be upgraded to Astro 6.x — there is no technical reason to pin to 5.x, and Astro 6.x uses the same content collections API. The planner should recommend Astro 6.x.

**Two other critical API changes from 5.x to 6.x that affect Phase 1:** (1) The content config file is now `src/content.config.ts` (not `src/content/config.ts`). (2) Tailwind CSS 4 is the current version, installed via `astro add tailwind` (not `@astrojs/tailwind` which is deprecated). (3) Astro 6 includes a built-in Fonts API — recommended over raw `<link>` tags for Google Fonts.

**The official blog template** (`npm create astro@latest -- --template blog`) scaffolds Astro 6.x with MDX, RSS, and Sitemap but does NOT include Tailwind. Tailwind must be added explicitly with `npx astro add tailwind` after project creation.

**Primary recommendation:** Scaffold with `npm create astro@latest -- --template blog`, add Tailwind via `npx astro add tailwind`, configure content collections with the subdirectory-per-voyage structure, configure Netlify with a `.nvmrc` of `22`, deploy and confirm HTTPS preview URL before closing this phase.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| astro | ^6.0.8 | Static site generator, routing, content collections | Latest stable; zero-JS default; SSG mode fits Netlify free tier |
| @astrojs/mdx | ^5.0.2 | MDX support in content collections | Required for embedding Astro components in post content in later phases |
| tailwindcss | ^4.2.2 | Utility CSS — locked by D-01 | Tailwind 4 is current; no config file needed, CSS-native design tokens |
| @tailwindcss/vite | ^4.2.2 | Tailwind 4 Vite plugin | Astro uses Vite; `@astrojs/tailwind` is deprecated for Tailwind 4 |
| Node.js | >=22.12.0 | Build runtime | Astro 6 hard requirement; Node 20 is NOT supported |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @astrojs/sitemap | ^3.7.1 | Auto-generated sitemap | Included in blog template; useful for SEO |
| @astrojs/rss | ^4.0.17 | RSS feed | Included in blog template; nice-to-have for travel blog audience |
| sharp | ^0.34.3 | Image processing (local images) | Included in blog template; not used for cloud photos (plain `<img>`) |
| zod | (ships with astro) | Frontmatter schema validation | Import from `astro/zod` in Astro 6 (not `astro:content`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Astro built-in Fonts API | Raw `<link rel="preload">` Google Fonts | Built-in API downloads fonts locally, better privacy + performance |
| Tailwind 4 via Vite plugin | Tailwind 3 + `@astrojs/tailwind` | `@astrojs/tailwind` is deprecated; Tailwind 4 is the current version |
| `src/content.config.ts` | `src/content/config.ts` | Old location (Astro 4.x); Astro 5.x+ uses `src/content.config.ts` |
| Astro 6.x | Astro 5.x | 6 is stable, same content API, requires Node 22 — no reason to stay on 5 |

### Installation

```bash
# 1. Scaffold with official blog template (installs Astro 6, MDX, RSS, Sitemap)
npm create astro@latest -- --template blog

# 2. Add Tailwind CSS 4 via Vite plugin
npx astro add tailwind

# 3. Verify Astro version
npx astro --version
```

**Version verification (confirmed against npm registry 2026-03-23):**
- `astro`: 6.0.8
- `@astrojs/mdx`: 5.0.2
- `tailwindcss`: 4.2.2
- `@tailwindcss/vite`: 4.2.2

---

## Architecture Patterns

### Recommended Project Structure

```
/
├── .nvmrc                      # "22" — pins Node 22 for Netlify
├── netlify.toml                # build command + publish directory
├── astro.config.mjs            # site config, integrations, fonts
├── src/
│   ├── content.config.ts       # content collection schemas (NOT src/content/config.ts)
│   ├── content/
│   │   ├── blog/
│   │   │   └── great-loop/     # all Great Loop MDX posts land here (Phase 2)
│   │   └── voyages/
│   │       └── great-loop.md   # voyage-level metadata
│   ├── components/
│   │   ├── BaseHead.astro      # <head> with meta, fonts, CSS
│   │   ├── Header.astro        # nav component
│   │   └── Footer.astro        # footer component
│   ├── layouts/
│   │   ├── Layout.astro        # base page layout (wraps all pages)
│   │   └── BlogPost.astro      # individual post layout
│   ├── pages/
│   │   ├── index.astro         # homepage
│   │   ├── about.astro         # About page (SITE-04)
│   │   ├── blog/
│   │   │   └── [...id].astro   # individual post dynamic route (SITE-03)
│   │   └── voyages/
│   │       └── great-loop/
│   │           └── index.astro # voyage index stub (map added Phase 5)
│   └── styles/
│       └── global.css          # @import "tailwindcss"; + CSS custom properties
└── public/                     # static assets
```

### Pattern 1: Content Layer API — Subdirectory-Per-Voyage

Astro 5.x introduced the Content Layer API (replacing the old 4.x content collections). The config file is at `src/content.config.ts`. Use `glob()` loader targeting the `great-loop/` subdirectory for the blog collection.

```typescript
// src/content.config.ts
// Source: https://docs.astro.build/en/guides/content-collections/
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';  // NOTE: import from 'astro/zod', NOT 'zod' directly in Astro 6

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog/great-loop',
  }),
  schema: z.object({
    // Required fields (D-11)
    title: z.string(),
    date: z.coerce.date(),
    voyage: z.string(),           // slug: "great-loop"
    location: z.string(),         // human-readable: "Dismal Swamp Canal, VA"
    excerpt: z.string(),
    migrated: z.boolean().default(false),

    // Optional fields (D-08, D-09, D-10)
    lat: z.number().optional(),
    lon: z.number().optional(),
    coverPhoto: z.string().optional(),     // URL string
    anchorage: z.string().optional(),      // free text (D-10: not enum)
    marina: z.string().optional(),         // free text
  }),
});

const voyages = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/voyages',
  }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    description: z.string(),
  }),
});

export const collections = { blog, voyages };
```

**Why subdirectory (not flat collection):** When a second voyage is added, `src/content/blog/voyage-2/` is created and the glob pattern `**/*.{md,mdx}` picks it up automatically. No schema changes, no collection renames. Filter by `data.voyage === 'great-loop'` to scope queries. This satisfies SITE-05 without any future restructuring.

### Pattern 2: Dynamic Post Routes with getStaticPaths

```astro
---
// src/pages/blog/[...id].astro
// Source: https://docs.astro.build/en/reference/routing-reference/#getstaticpaths
import { getCollection, render } from 'astro:content';
import BlogPost from '../../layouts/BlogPost.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---
<BlogPost {...post.data}>
  <Content />
</BlogPost>
```

Note: In Astro 5.x+ Content Layer API, the unique identifier is `post.id` (not `post.slug` as in Astro 4.x).

### Pattern 3: Tailwind 4 Configuration in astro.config.mjs

```javascript
// astro.config.mjs
// Source: https://docs.astro.build/en/guides/styling/#tailwind
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://your-site.netlify.app',
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

No `tailwind.config.mjs` needed — Tailwind 4 reads configuration from CSS.

```css
/* src/styles/global.css */
@import "tailwindcss";

/* Custom color tokens for nautical theme (D-03) */
@theme {
  --color-navy: #1a2e4a;
  --color-offwhite: #faf9f6;
  --color-brass: #c9a84c;
}
```

### Pattern 4: Google Fonts via Astro Built-in Fonts API

Astro 6 ships with a native Fonts API that downloads fonts locally (better performance and privacy than loading from Google's CDN directly).

```javascript
// astro.config.mjs
import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
  experimental: {
    fonts: [{
      provider: fontProviders.google(),
      name: 'Lora',           // serif body (D-04)
      cssVariable: '--font-lora',
      weights: ['400', '700'],
      styles: ['normal', 'italic'],
    }, {
      provider: fontProviders.google(),
      name: 'Inter',          // sans-serif headings/UI (D-04)
      cssVariable: '--font-inter',
      weights: ['400', '600', '700'],
    }],
  },
  // ...
});
```

```astro
---
// src/components/BaseHead.astro
import { Font } from 'astro:assets';
---
<Font cssVariable="--font-lora" preload />
<Font cssVariable="--font-inter" preload />
```

Then in global CSS:
```css
body { font-family: var(--font-lora); }
h1, h2, h3, nav { font-family: var(--font-inter); }
```

**Note:** As of March 2026, Astro's Fonts API may still be marked `experimental`. If not yet stable, fall back to the standard `<link>` preconnect pattern:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
```

### Pattern 5: Netlify Deployment Configuration

```toml
# netlify.toml (repo root)
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
```

Also add `.nvmrc` at repo root (highest priority on Netlify):
```
22
```

### Anti-Patterns to Avoid

- **`src/content/config.ts` (old path):** Astro 5.x+ moved the config to `src/content.config.ts`. Using the old path silently fails to register collections.
- **`import { z } from 'zod'`:** In Astro 6, import Zod from `astro/zod` to ensure schema compatibility.
- **`@astrojs/tailwind` integration:** Deprecated for Tailwind 4. Using it installs Tailwind 3 and causes class conflicts. Use `@tailwindcss/vite` instead.
- **Node 20 in .nvmrc:** Astro 6 requires Node >=22.12.0. Node 20 will fail.
- **`post.slug` in routes:** Astro 5.x Content Layer API uses `post.id`, not `post.slug`.
- **Flat `src/content/blog/` structure:** All posts in a flat directory means restructuring when voyage 2 arrives. Use `src/content/blog/great-loop/` from day one.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frontmatter type safety | Custom TypeScript types | Zod schema in `content.config.ts` | Astro generates types automatically from schema; build-time validation |
| Font loading optimization | Manual `<link>` preload logic | Astro Fonts API (or standard `<link>` pattern) | Handles preconnect, preload, swap correctly |
| Sitemap generation | Custom sitemap script | `@astrojs/sitemap` | Already in blog template; zero config needed |
| RSS feed | Custom XML generation | `@astrojs/rss` | Already in blog template; handles edge cases |
| Dynamic route generation | Manually listing slugs | `getStaticPaths()` + `getCollection()` | Astro builds the page list at build time from actual content |
| CSS reset / base styles | Custom normalize.css | Tailwind's preflight (included automatically) | Tailwind 4 includes preflight by default |

**Key insight:** The blog template gives you sitemap, RSS, and MDX for free. Don't remove them even if Phase 1 doesn't exercise them — Phase 2 needs MDX immediately, and sitemap/RSS are zero-maintenance.

---

## Common Pitfalls

### Pitfall 1: Wrong Content Config File Location

**What goes wrong:** Collections appear to be registered but `getCollection()` returns an empty array and the build produces no dynamic pages.
**Why it happens:** Developer creates `src/content/config.ts` (Astro 4.x location) instead of `src/content.config.ts` (Astro 5.x+ location). Astro silently ignores the wrong-path file.
**How to avoid:** Always create `src/content.config.ts` at the project root level, not inside `src/content/`.
**Warning signs:** `getCollection('blog')` returns `[]` even when MDX files exist in `src/content/blog/`.

### Pitfall 2: Node.js Version Mismatch on Netlify

**What goes wrong:** Netlify build fails with cryptic errors or produces unexpected output. Locally the build works (because local Node.js is 22).
**Why it happens:** Netlify defaults to an older Node.js version. Astro 6 requires >=22.12.0. Without explicit version pinning, Netlify may use 18 or 20.
**How to avoid:** Add `.nvmrc` containing `22` to the repo root. Also set `NODE_VERSION = "22"` in `netlify.toml` as backup.
**Warning signs:** Build log shows Node.js version < 22.

### Pitfall 3: `@astrojs/tailwind` + Tailwind 4 Conflict

**What goes wrong:** Styles don't apply, or you get Tailwind 3 class names that conflict with Tailwind 4 CSS variables.
**Why it happens:** Developer runs `npx astro add tailwind` and sees the old integration installed, OR manually installs `@astrojs/tailwind` which installs Tailwind 3 as a peer dep.
**How to avoid:** Use `npx astro add tailwind` (which installs `@tailwindcss/vite` plugin in Astro >=5.2.0). Verify `package.json` shows `tailwindcss: ^4.x` not `^3.x`. Do NOT use `@astrojs/tailwind`.
**Warning signs:** `tailwind.config.mjs` is generated — that's a Tailwind 3 artifact. Tailwind 4 doesn't need a config file.

### Pitfall 4: Flat Content Directory (Multi-Voyage Regression)

**What goes wrong:** Site works for Phase 1-2, but adding voyage 2 in the future requires restructuring the content directory, breaking all post URLs.
**Why it happens:** Developer puts posts directly in `src/content/blog/*.mdx` (flat) instead of `src/content/blog/great-loop/*.mdx`.
**How to avoid:** The glob loader base is `./src/content/blog/great-loop` from day one, with a dummy post validating the schema. The content spec (from CONTEXT.md) explicitly requires this structure.
**Warning signs:** Phase 1 dummy MDX post is at `src/content/blog/dummy-post.mdx` — wrong. It must be at `src/content/blog/great-loop/dummy-post.mdx`.

### Pitfall 5: Zod Schema Import in Astro 6

**What goes wrong:** Build fails with Zod version mismatch or unexpected type errors in the content schema.
**Why it happens:** Astro 6 ships Zod 4 internally. If you `import { z } from 'zod'` directly, you may pull in a different Zod version from your `node_modules`.
**How to avoid:** Always `import { z } from 'astro/zod'` in `src/content.config.ts`. This uses Astro's bundled Zod version and guarantees compatibility.
**Warning signs:** Schema errors that work locally but fail on Netlify, or vice versa.

---

## Code Examples

Verified patterns from official sources:

### Dummy Validation Post (Phase 1 Success Criterion)

Place at `src/content/blog/great-loop/2024-01-01-test-scaffold.mdx`:

```mdx
---
title: "Scaffold Test Post"
date: 2024-01-01
voyage: "great-loop"
location: "Chesapeake Bay, MD"
excerpt: "This is a test post to validate the content collection schema compiles correctly."
migrated: false
lat: 38.9
lon: -76.4
coverPhoto: "https://example.com/placeholder.jpg"
anchorage: "test anchorage"
marina: "test marina"
---

# Scaffold Test Post

This post exists to validate Zod schema at build time. Delete before going live.
```

Running `npm run build` with this post and zero errors confirms FOUND-01 + FOUND-02.

### Querying Blog Posts for Homepage

```astro
---
// src/pages/index.astro
import { getCollection } from 'astro:content';

const posts = await getCollection('blog', ({ data }) =>
  data.voyage === 'great-loop' && !import.meta.env.PROD ? true : data.migrated !== undefined
);

const recentPosts = posts
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
  .slice(0, 5);
---
```

### Voyage Index Page Stub

```astro
---
// src/pages/voyages/great-loop/index.astro
import { getCollection } from 'astro:content';
import Layout from '../../../layouts/Layout.astro';

const posts = await getCollection('blog', ({ data }) =>
  data.voyage === 'great-loop'
);
const sortedPosts = posts.sort((a, b) =>
  a.data.date.valueOf() - b.data.date.valueOf()
);
---
<Layout title="Great Loop Voyage">
  <h1>Great Loop</h1>
  <!-- Phase 5: interactive map goes here -->
  <ul>
    {sortedPosts.map(post => (
      <li>
        <a href={`/blog/${post.id}`}>{post.data.title}</a>
        <span>{post.data.location}</span>
      </li>
    ))}
  </ul>
</Layout>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `src/content/config.ts` | `src/content.config.ts` | Astro 5.0 | Old path silently ignored — use new path |
| `@astrojs/tailwind` integration | `@tailwindcss/vite` plugin | Tailwind 4 / Astro 5.2+ | `@astrojs/tailwind` is deprecated; Tailwind 4 is current |
| `import { z } from 'astro:content'` | `import { z } from 'astro/zod'` | Astro 6.0 | Schema import path changed |
| `post.slug` | `post.id` | Astro 5.x Content Layer | `slug` no longer exists on content entries |
| `defineCollection({ type: 'content', schema })` | `defineCollection({ loader: glob(...), schema })` | Astro 5.x Content Layer | Loader is now required; `type` field removed |
| Node.js 20 LTS | Node.js 22 LTS (>=22.12.0) | Astro 6.0 | Node 18 and 20 dropped; 22 required |
| Astro 5.x (stable as of late 2024) | Astro 6.0.8 (stable as of early 2025) | Astro 6.0 | Content API unchanged; fonts API added; Zod 4 |

**Deprecated/outdated:**
- `@astrojs/tailwind`: Replaced by `@tailwindcss/vite` for Tailwind 4. Do not use.
- `src/content/config.ts`: Moved. Will silently fail.
- Tailwind `tailwind.config.mjs`: Not needed in Tailwind 4; all config is CSS-native via `@theme {}`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None yet — Wave 0 must install |
| Config file | None — see Wave 0 |
| Quick run command | `npm run build` (Astro build acts as integration test) |
| Full suite command | `npm run build && npx astro check` |

**Note:** For a Phase 1 scaffolding phase, the primary validation is the build itself. Astro's content collection schema validation runs at build time — a clean `npm run build` with the dummy post passing Zod validation is the meaningful test. Playwright or Vitest are not needed at this stage; they are relevant from Phase 2 onward.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | Astro project builds with multi-voyage content collection | Integration (build) | `npm run build` | Wave 0 |
| FOUND-02 | All frontmatter fields validated by Zod schema | Integration (build) | `npm run build` with dummy post | Wave 0 |
| FOUND-03 | Netlify deploy succeeds from git push | Smoke (manual) | Trigger Netlify deploy; check deploy log | N/A |
| FOUND-04 | Responsive layout renders on mobile widths | Smoke (manual) | Open deploy preview on mobile or DevTools | N/A |
| SITE-01 | No auth gate on any page | Smoke (manual) | Open site in incognito; all pages load | N/A |
| SITE-03 | Individual post route renders dummy post | Smoke (manual) | Visit `/blog/[dummy-post-id]` on preview | N/A |
| SITE-04 | About page exists and renders | Smoke (manual) | Visit `/about` on preview | Wave 0 |
| SITE-05 | Adding second voyage needs no schema change | Design review | Code review of `content.config.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run build` — catches schema errors and broken imports
- **Per wave merge:** `npm run build && npx astro check` — adds TypeScript type checking
- **Phase gate:** All manual smoke tests pass on the live Netlify preview URL

### Wave 0 Gaps

- [ ] `src/content.config.ts` — must be created (no equivalent in the blog template's default)
- [ ] `src/content/blog/great-loop/2024-01-01-test-scaffold.mdx` — dummy validation post
- [ ] `src/pages/about.astro` — stub About page (SITE-04)
- [ ] `src/pages/voyages/great-loop/index.astro` — stub voyage index (referenced by nav)
- [ ] `.nvmrc` — `22`
- [ ] `netlify.toml` — build config
- [ ] `src/styles/global.css` — with `@import "tailwindcss"` and `@theme {}` color tokens

---

## Open Questions

1. **Astro Fonts API stability in Astro 6.0.8**
   - What we know: The built-in Fonts API was introduced as `experimental` and provides Google Fonts with local download. The Astro 6 blog post mentions it as a key feature.
   - What's unclear: Whether it is stable (non-experimental) in 6.0.8, or still behind an `experimental` flag.
   - Recommendation: Attempt `fontProviders.google()` in `astro.config.mjs`. If it requires `experimental: { fonts: [...] }`, use that. If it causes a build error, fall back to standard `<link>` preconnect tags for Google Fonts — this is a minor implementation detail, not a blocker.

2. **Zod optional vs. nullable for optional fields (D-09, D-10)**
   - What we know: D-11 specifies `lat`, `lon`, `coverPhoto`, and `anchorage`/`marina` are optional. D-44 says "Claude's discretion" for `.optional()` vs `.nullable()`.
   - Recommendation: Use `.optional()` — it means the field can be absent from frontmatter entirely. Use `.nullable()` only if you want to allow `null` in the YAML (e.g., `lat: null`). For frontmatter, `.optional()` is the natural choice since absent fields are the common case.

3. **Astro blog template's default content collection vs. custom schema**
   - What we know: The blog template ships with its own `src/content.config.ts` (title, description, pubDate, updatedDate, heroImage). The Phase 1 schema is different (title, date, voyage, location, lat, lon, etc.).
   - Recommendation: Replace the template's `src/content.config.ts` entirely with the project schema. The template's schema is a starting-point example, not production code.

---

## Sources

### Primary (HIGH confidence — verified against live official documentation 2026-03-23)

- https://docs.astro.build/en/guides/content-collections/ — Content Layer API, glob loader, schema syntax
- https://docs.astro.build/en/install-and-setup/ — Node.js >=22.12.0 requirement confirmed
- https://docs.astro.build/en/guides/deploy/netlify/ — Static deploy, no adapter needed, netlify.toml
- https://docs.astro.build/en/guides/styling/#tailwind — Tailwind 4 via Vite plugin, `astro add tailwind`
- https://docs.astro.build/en/guides/fonts/ — Built-in Fonts API, `fontProviders.google()`
- https://tailwindcss.com/docs/installation/using-vite — `@tailwindcss/vite` plugin installation
- https://docs.netlify.com/configure-builds/manage-dependencies/#node-js-and-javascript — `.nvmrc` Node version pinning
- npm registry (2026-03-23): astro@6.0.8, @astrojs/mdx@5.0.2, tailwindcss@4.2.2, @tailwindcss/vite@4.2.2
- https://raw.githubusercontent.com/withastro/astro/main/examples/blog/package.json — Confirmed blog template dependencies (Astro 6, no Tailwind)

### Secondary (MEDIUM confidence)

- https://astro.build/blog/astro-6/ — Astro 6 release notes: Node 22 requirement, Zod 4, Fonts API
- https://docs.astro.build/en/reference/content-loader-reference/ — glob() loader pattern
- .planning/research/STACK.md — Prior project research (training data Aug 2025; superseded by live verification for version specifics)

### Tertiary (LOW confidence — not independently verified)

- Google Fonts font availability (Lora, Playfair Display, Inter) — verified as still active but page content partial

---

## Metadata

**Confidence breakdown:**
- Standard stack (versions): HIGH — verified against npm registry 2026-03-23
- Content Layer API patterns: HIGH — verified against live docs.astro.build
- Tailwind 4 setup: HIGH — verified against tailwindcss.com and docs.astro.build
- Netlify deploy config: HIGH — verified against docs.netlify.com
- Astro Fonts API stability: MEDIUM — feature confirmed in Astro 6 blog post but experimental flag status not confirmed
- Schema design (content.config.ts): HIGH — verified against live docs and template source

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (30 days — Astro and Tailwind release frequently; re-verify versions before starting implementation)
