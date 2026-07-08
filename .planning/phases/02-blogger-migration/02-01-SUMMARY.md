---
phase: 02-blogger-migration
plan: "01"
subsystem: content
tags: [astro, mdx, blogger, migration, netlify, redirects]

# Dependency graph
requires:
  - phase: 01-scaffolding
    provides: Astro project with src/content/blog/great-loop/ content collection and Zod schema

provides:
  - 72 MDX files in src/content/blog/great-loop/ (YYYY-MM-DD-slug.mdx) with Zod-validated frontmatter
  - scripts/import-blogger.mjs with cache-or-fetch Atom API pipeline and HTML sanitizer
  - public/_redirects with 72 Netlify 301 rules from /YYYY/MM/slug.html to /blog/YYYY-MM-DD-slug/
  - .planning/data/blog-posts-full.json cache of full HTML content for all 72 posts
  - Zod build validation confirmed (npm run build exits 0, 77 pages)

affects:
  - 02-02 (Gallery.astro + VideoEmbed.astro — must integrate with migrated MDX post bodies)
  - 02-03 (verify + deploy — uses _redirects and MDX files built here)
  - 03-quality-lift (all 72 posts are raw migrated HTML; migrated: true flag marks them)
  - 04-data-pipeline (stubs phase will need MDX file list; great-loop collection established)

# Tech tracking
tech-stack:
  added: []  # No new packages — pure Node.js builtins
  patterns:
    - "Cache-or-fetch pattern (blog-posts-full.json) extended from blog-viewer.mjs"
    - "sanitizeHtml() 6-step regex pipeline: video stub → strip script/style → self-close void elements → escape braces"
    - "MDX frontmatter with double-quoted strings, bare YYYY-MM-DD date, migrated: true"
    - "Video placeholder div (class=video-placeholder data-src=...) instead of HTML comment stubs"

key-files:
  created:
    - scripts/import-blogger.mjs
    - public/_redirects
    - .planning/data/blog-posts-full.json
    - src/content/blog/great-loop/ (72 MDX files, YYYY-MM-DD-slug.mdx)
  modified:
    - src/content/blog/great-loop/2024-01-01-test-scaffold.mdx (deleted)

key-decisions:
  - "Video stubs use <div class=video-placeholder data-src=...> not <!-- --> (MDX v3 rejects HTML comments)"
  - "location field defaults to 'Great Loop' for all 72 posts (none had Blogger labels — expected)"
  - "void-element self-close uses lazy [^>]*? match to handle already-self-closed Blogger HTML"
  - "redirect lines generated for ALL 72 posts on every run (not just newly-written MDX files)"

patterns-established:
  - "sanitizeHtml: 6-step regex pipeline; apply in order to avoid double-processing"
  - "extractSlug: always from postUrl pathname, never from title (Pitfall 2)"
  - "buildMdx: double-quote ALL YAML string values, bare date, explicit migrated: true"
  - "video-placeholder: class + data-src attr for Phase 3 to locate Blogger videos"

requirements-completed: [MIG-01, MIG-02, MIG-03, MIG-04, MIG-05]

# Metrics
duration: 25min
completed: 2026-07-08
---

# Phase 02 Plan 01: Blogger Import Script + 72 MDX Files Summary

**72 Blogger posts imported as Zod-valid MDX via Node.js Atom API script with regex HTML sanitizer, 72 Netlify redirect rules in public/_redirects, npm build exits 0**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-08T06:56:00Z
- **Completed:** 2026-07-08T07:01:00Z
- **Tasks:** 2
- **Files modified/created:** 76 (1 script + 72 MDX files + 1 _redirects + 1 JSON cache + 1 deleted scaffold)

## Accomplishments

- Wrote scripts/import-blogger.mjs: paginated Atom API fetch (3 pages of 25), blog-posts-full.json cache, 6-step HTML sanitizer, extractSlug/buildFrontmatter/buildMdx/buildRedirectLine helpers, coverage validation vs blog-image-urls.json
- Generated 72 YYYY-MM-DD-slug.mdx files in src/content/blog/great-loop/ — all pass Zod validation at build time (npm run build: 77 pages, 0 errors)
- Generated public/_redirects with 72 Netlify 301 rules (/YYYY/MM/slug.html → /blog/YYYY-MM-DD-slug/)
- 10 sampled blogger.googleusercontent.com image URLs (2022, 2023, 2024 range) all return HTTP 200
- Coverage validation: 0 mismatches — all 72 slugs in blog-image-urls.json have corresponding MDX files

## Task Commits

1. **Task 1: Delete test scaffold + write import-blogger.mjs** - `5290e1d` (feat)
2. **Task 2: Execute import + validate output** - `3fb3cec` (feat)

## Files Created/Modified

- `scripts/import-blogger.mjs` - Atom API fetcher, HTML sanitizer, MDX writer, redirect generator, coverage validator
- `src/content/blog/great-loop/` - 72 YYYY-MM-DD-slug.mdx files (Apr 2022 – Feb 2024)
- `public/_redirects` - 72 Netlify 301 redirect rules
- `.planning/data/blog-posts-full.json` - Full HTML cache for all 72 posts
- `src/content/blog/great-loop/2024-01-01-test-scaffold.mdx` - Deleted (Phase 1 artifact)

## Decisions Made

- **Video stub format:** Changed from `<!-- video: ... -->` (plan spec) to `<div class="video-placeholder" data-src="...">` because MDX v3 rejects HTML comment syntax with `Unexpected character '!'`. The div with `data-src` attribute achieves the same goal (Phase 3 can find videos via CSS class or attribute selector).
- **Void element regex:** Used lazy `[^>]*?` match with `\s*\/?\s*>` suffix instead of negative lookahead `(?!\/)>` because Blogger already returns self-closed `<br />` and `<img ... />` — the greedy `[^>]*` would consume the `/` and re-add it, producing `/ />` (invalid JSX).
- **Redirect generation for ALL posts:** Always builds redirect lines for all 72 posts (not just newly written MDX files), so `--force` re-runs don't produce an empty `_redirects` file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed void-element regex double-processing already-self-closed tags**
- **Found during:** Task 2 (npm run build failure)
- **Issue:** Blogger Atom API returns `<br />` and `<img ... />` already self-closed. The sanitizeHtml pattern `(<br(\s[^>]*)?\s*(?!\/)>)` used greedy `[^>]*` which captured the `/` in `/>`, then `(?!\/)` lookahead passed (next char was `>`), producing `<br / />` — invalid JSX in MDX v3
- **Fix:** Changed br/hr patterns to `/<br\s*\/?\s*>/gi → '<br />'` (handles both forms). Changed img pattern to `/<img(\s[^>]*?)\s*\/?\s*>/gi` (lazy match stops before trailing `\s*/?>`)
- **Files modified:** scripts/import-blogger.mjs (sanitizeHtml step 4a/4b/4c)
- **Verification:** 8 test cases pass; no `/ />` in any generated MDX file; build succeeded
- **Committed in:** 3fb3cec (Task 2 commit)

**2. [Rule 1 - Bug] Fixed HTML comment stubs causing MDX v3 parse failure**
- **Found during:** Task 2 (npm run build failure after br/img fix)
- **Issue:** Blogger video iframes were replaced with `<!-- video: ... -->` HTML comment stubs as specified in D-07. MDX v3 rejects `<!--` with `Unexpected character '!' before name` — MDX uses `{/* */}` for comments, not HTML comment syntax
- **Fix:** Changed video stub format from `<!-- video: url -->` to `<div class="video-placeholder" data-src="url"></div>`. This is valid HTML, valid MDX, and preserves enough information for Phase 3 video recovery (locate via `class="video-placeholder"` or `data-src` attribute)
- **Files modified:** scripts/import-blogger.mjs (sanitizeHtml step 1)
- **Verification:** No HTML comments (`grep -rl '<!--' src/content/blog/great-loop/ | wc -l == 0`); build succeeded
- **Committed in:** 3fb3cec (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for MDX v3 compilation. The video placeholder format change is a minor deviation from D-07 (comment stub spec) — semantics preserved via data attribute, Phase 3 recovery path unchanged. No scope creep.

## Known Stubs

| Type | Count | Location | Reason |
|------|-------|----------|--------|
| `<div class="video-placeholder">` | 32 posts | src/content/blog/great-loop/*.mdx | Blogger-hosted video tokens opaque outside Blogger (D-07); Phase 3 task to resolve |
| `location: "Great Loop"` | 72 posts | All MDX frontmatter | None of the 72 Blogger posts had labels in the Atom API response; Phase 3 quality lift will fill in locations |

Note: These are intentional per the plan (D-07 for videos, Pitfall 4 fallback for locations). They do not prevent the plan's goal (Zod validation passes, site builds, redirects work).

## Issues Encountered

Two npm build failures during Task 2, both diagnosed and auto-fixed as Rule 1 bugs:
1. `/ />` double-slash: Blogger already self-closes void elements; regex was double-processing them
2. `<!-- -->` HTML comments: MDX v3 parser rejects HTML comment syntax entirely

Both were caught at build time (Astro/MDX build), diagnosed in under 2 minutes each, and fixed by updating the sanitizeHtml regex patterns. Re-running with `--force` regenerated all 72 MDX files.

## User Setup Required

None — no external service configuration required. The import script uses the public Blogger Atom API with no authentication.

## Next Phase Readiness

- **Wave 1 complete:** 72 MDX files valid, build passes, redirects ready
- **Wave 2 ready:** Plan 02-02 (Gallery.astro + VideoEmbed.astro) can now proceed in parallel
- **Video recovery:** 32 posts have `<div class="video-placeholder">` — Phase 3 task
- **Location enrichment:** All 72 posts use "Great Loop" location fallback — Phase 3 quality lift task

---
*Phase: 02-blogger-migration*
*Completed: 2026-07-08*
