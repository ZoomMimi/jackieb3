# Phase 2: Blogger Migration - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Import all 72 existing Blogger posts into Astro as MDX files — preserving HTML content, metadata, and photo/video URLs — with 301 Netlify redirects from old Blogger URLs to new Astro URLs, and Gallery.astro + VideoEmbed.astro media components. The existing Blogger blog remains live throughout; no DNS changes. Quality reformatting is Phase 3's job — Phase 2 is raw import only.

</domain>

<decisions>
## Implementation Decisions

### Import Method
- **D-01:** Use both the Atom JSON API (primary) and the Blogger XML export (validation). The Atom API pipeline in `blog-viewer.mjs` is the primary data source — extend it into the full importer. The Blogger XML export is used to validate coverage (post count, slug completeness). Check if an XML file already exists in the project; if not, the plan should note where to download it (Blogger admin → Settings → Manage blog → Back up content).
- **D-02:** The Atom JSON API delivers full post HTML (`entry.content.$t`), `blogger.googleusercontent.com` image URLs, and `blogger.com/video.g?token=` video tokens. These are the canonical source of truth for Phase 2.

### HTML Content Fidelity
- **D-03:** Preserve raw Blogger HTML in the MDX body. `migrated: true` in frontmatter flags it as a raw import. All prose reformatting, structural cleanup, and quality lifting is deferred to Phase 3.
- **D-04:** During import, sanitize ONLY tags that would break MDX compilation (unclosed tags, script blocks, Blogger-specific components that MDX cannot parse). Do not touch prose, image tags, or structural HTML.

### Photo Placement
- **D-05:** Leave photos inline in the HTML body where Blogger originally placed them. Do not extract to a frontmatter `images:` array. The existing `<img>` tags in the HTML body are the primary photo representation for migrated posts.
- **D-06:** `coverPhoto` frontmatter field is left empty on all Phase 2 imports. Cover photo selection happens during Phase 3 quality lift (Barbara reviews each post and picks the right photo).

### Blogger Video Handling
- **D-07:** Replace Blogger-native video iframes (`blogger.com/video.g?token=...`) with HTML comment stubs: `<!-- video: [original-token-or-src] -->`. These tokens are opaque and it's unclear if they embed outside Blogger. Video migration (finding the YouTube URL or re-uploading) is a Phase 3 / human task.
- **D-08:** `VideoEmbed.astro` supports YouTube URLs only. It accepts a `url` prop (YouTube URL) and renders a responsive 16:9 iframe. No Blogger token handling — that's deferred.

### Claude's Discretion
- Slug format for new Astro URLs: the ROADMAP says `/voyages/great-loop/YYYY-MM-DD-slug/` — Claude's discretion on exact slug normalization (e.g., removing special characters, handling duplicate dates)
- Netlify redirect block format: `[[redirects]]` in `netlify.toml` vs. `_redirects` file — Claude picks based on existing `netlify.toml` structure
- MDX-breaking-tag sanitization implementation: which specific tags to strip (beyond the obvious) — Claude's discretion based on what the Atom API actually returns
- Astro content collection ID format: the filename becomes the `post.id` (e.g., `2022-04-16-getting-ready-to-go.mdx`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — MIG-01, MIG-02, MIG-03, MIG-04, MIG-05, MEDIA-01, MEDIA-02, MEDIA-03 (all Phase 2 requirements)

### Project context
- `.planning/PROJECT.md` — multi-voyage architecture, hosting constraints, photo URL strategy
- `.planning/STATE.md` — key decisions: plain `<img>` tags, no Astro Image optimizer, photos stay cloud-hosted

### Existing code
- `src/content.config.ts` — Zod schema for the `blog` collection; all imported MDX must satisfy this schema
- `src/layouts/BlogPost.astro` — the layout all posts render through; understand what frontmatter it consumes
- `src/pages/blog/[...id].astro` — how content collection IDs map to URLs
- `netlify.toml` — existing Netlify config; redirect rules go here or in `_redirects`

### Existing data
- `.planning/data/blog-image-urls.json` — all 72 posts with their `blogger.googleusercontent.com` image URLs and video tokens; this is the primary reference for what each post contains
- `scripts/blog-viewer.mjs` — the Atom JSON API fetcher to extend into the importer; understand how it fetches `entry.content.$t` and extracts images/videos

### Roadmap
- `.planning/ROADMAP.md` § Phase 2 — planned plan breakdown, success criteria, risks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/blog-viewer.mjs` — already connects to the Blogger Atom JSON API and fetches all posts with HTML content, image URLs, and video tokens. The `fetchAllPosts()` function is the core to reuse.
- `src/content.config.ts` — Zod schema with all required and optional frontmatter fields; imported MDX must produce valid frontmatter or `npm run build` will fail
- `src/layouts/BlogPost.astro` — BlogPost layout ready; Phase 2 just needs to create MDX files that satisfy it

### Established Patterns
- Content collection IDs are the filename without extension (e.g., `2022-04-16-getting-ready-to-go.mdx` → `id: "2022-04-16-getting-ready-to-go"`)
- URLs: Astro resolves `/blog/[...id]` from the collection ID, so `src/pages/blog/[...id].astro` handles routing automatically
- `migrated: true` (boolean) is the Phase 2 flag; Phase 3 changes it to something else (TBD in Phase 3 context)
- Photos: `<img loading="lazy" decoding="async">` — no Astro Image optimizer (from Phase 1 / PROJECT.md)

### Integration Points
- `src/content/blog/great-loop/` — all 72 MDX files land here
- `netlify.toml` — 72 `[[redirects]]` blocks added; from `blogger.com/YYYY/MM/slug.html` to `/blog/YYYY-MM-DD-slug/`
- `src/components/Gallery.astro` — new component (Phase 2 creates it, even if migrated posts don't use it yet — needed for MEDIA-01)
- `src/components/VideoEmbed.astro` — new component, YouTube URL only (Phase 2 creates it)

</code_context>

<specifics>
## Specific Ideas

- The Atom API pagination: `feeds/posts/default?alt=json&max-results=25&start-index=N&orderby=published` — `blog-viewer.mjs` already handles pagination. The importer should reuse this.
- Old Blogger URL pattern: `https://jackiebiiigoingloopy.blogspot.com/YYYY/MM/slug.html` — redirects from this to `/blog/YYYY-MM-DD-slug/`
- Image URL normalization: `blog-viewer.mjs` already normalizes image URLs to `/s1600/` size. Keep that behavior.
- Blogger video comment stub format: `<!-- video: https://www.blogger.com/video.g?token=XXX -->` — consistent format so Phase 3 can find them with a grep

</specifics>

<deferred>
## Deferred Ideas

- Video migration (finding YouTube URLs for Blogger-hosted videos) — Phase 3 human task
- Cover photo selection — Phase 3 quality lift
- Photo gallery restructuring (extracting inline images to Gallery component) — Phase 3
- `migrated` flag lifecycle beyond `true` (e.g., `"lifted"`, `false`) — Phase 3 context

</deferred>

---

*Phase: 02-blogger-migration*
*Context gathered: 2026-07-07*
