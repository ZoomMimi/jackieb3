---
phase: 01-scaffolding
plan: "02"
subsystem: astro-layout-pages
tags: [astro, tailwind, layout, nav, responsive, content-collection]
dependency_graph:
  requires:
    - astro-7-project-root
    - content-schema-blog-voyages
    - nautical-theme-tokens
    - google-fonts-lora-inter
  provides:
    - base-layout-shell
    - nautical-nav-responsive
    - homepage-hero-recent-posts
    - dynamic-post-route
    - voyage-index-stub
    - about-page-stub
    - 404-page
  affects:
    - all-subsequent-phases
tech_stack:
  added: []
  patterns:
    - Layout.astro base shell wrapping BaseHead/Header/slot/Footer
    - BlogPost.astro single-column 720px prose layout with scoped CSS
    - getStaticPaths + getCollection('blog') dynamic route using post.id
    - Tailwind 4 arbitrary value utilities (text-[36px], max-w-[720px], bg-[#233d61])
    - details/summary no-JS mobile hamburger nav
    - aria-current="page" active nav link with brass underline
key_files:
  created:
    - src/layouts/Layout.astro
    - src/pages/404.astro
    - src/pages/blog/[...id].astro
    - src/pages/voyages/great-loop/index.astro
  modified:
    - src/components/BaseHead.astro
    - src/components/Header.astro
    - src/components/Footer.astro
    - src/layouts/BlogPost.astro
    - src/pages/index.astro
    - src/pages/about.astro
    - src/pages/blog/index.astro
    - src/content/blog/great-loop/2024-01-01-test-scaffold.mdx
decisions:
  - "Removed old [...slug].astro (Astro 4 pattern) and created [...id].astro using post.id (Content Layer API)"
  - "BlogPost.astro uses scoped <style> for prose instead of Tailwind prose plugin — keeps nav unaffected"
  - "Blog index (/blog/) updated to use Layout component — was using old inline HTML shell from template"
  - "details/summary mobile nav uses position:absolute dropdown panel with z-50 to overlay content"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-27T15:15:00Z"
  tasks_completed: 2
  files_created: 4
  files_modified: 8
---

# Phase 01 Plan 02: Layout Shell, Nav, and Stub Pages Summary

**One-liner:** Nautical-themed Astro site shell built — navy/off-white/brass palette, responsive Header with details/summary hamburger, BlogPost 720px prose layout, Homepage hero + recent posts, voyage index stub, About, 404, and dynamic /blog/[...id] route from getStaticPaths.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Layout shell, nav, footer, font/head plumbing | 69146e7 | BaseHead.astro, Header.astro, Footer.astro, Layout.astro, BlogPost.astro |
| 2 | Pages, dynamic post route, and dummy validation post | d3705c2 | index.astro, about.astro, 404.astro, blog/[...id].astro, voyages/great-loop/index.astro, 2024-01-01-test-scaffold.mdx |

## Acceptance Criteria — All Passed

- BaseHead.astro imports `{ Font }` from `astro:assets` — renders Font for `--font-lora` and `--font-inter`
- Header.astro has `<nav aria-label="Main"`, links to `/`, `/voyages/great-loop/`, `/about/`
- Header.astro uses `<details` for mobile hamburger (no JS required)
- Footer.astro contains "Jackie B III Going Loopy" copyright
- Layout.astro imports/renders Header and Footer, contains `<slot`
- BlogPost.astro contains `max-w-[720px]` and `<h1`
- Dynamic route `src/pages/blog/[...id].astro`: getStaticPaths, getCollection('blog'), post.id
- Homepage: "Going Loopy", "Read the voyage", filters voyage === 'great-loop'
- Voyage index: "Great Loop", "2022–2024 · 5,424 nm", posts sorted ASC
- About: `<h1` "About Jackie B III", single column
- 404: "Page not found — navigate home or browse the Great Loop."
- MDX test post: all 11 frontmatter fields, H1 and H2 headings
- `npm run build` exits 0 — 6 pages built, zero errors, zero schema warnings
- dist/ contains: index.html, about/index.html, voyages/great-loop/index.html, 404.html, blog/2024-01-01-test-scaffold/index.html

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed conflicting [...slug].astro catch-all route**
- **Found during:** Task 2 page creation
- **Issue:** The template shipped `src/pages/blog/[...slug].astro` using `params: { slug: post.id }`. The new `[...id].astro` uses `params: { id: post.id }`. Two catch-all routes in the same directory would conflict — Astro would throw an ambiguous route error.
- **Fix:** Deleted `src/pages/blog/[...slug].astro`. The new `[...id].astro` handles all blog post routes using `post.id` per Content Layer API convention.
- **Files modified:** src/pages/blog/[...slug].astro (deleted)
- **Commit:** d3705c2

**2. [Rule 2 - Missing critical functionality] Updated blog/index.astro to use Layout component**
- **Found during:** Task 2 — blog index still used the inline HTML shell from the template
- **Issue:** The template's `blog/index.astro` rendered its own `<html>/<head>/<body>` shell without the new Header/Footer components. This would leave `/blog/` with the wrong nav and footer.
- **Fix:** Replaced inline HTML shell with `<Layout>` component + consistent post card pattern.
- **Files modified:** src/pages/blog/index.astro
- **Commit:** d3705c2

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| src/content/blog/great-loop/2024-01-01-test-scaffold.mdx | all | Schema validation post — must be deleted before launch |
| src/pages/about.astro | 18-20 | Placeholder paragraphs: "Stub content only — full About page coming in a later phase." Intentional — real About content is a later phase task |
| src/pages/voyages/great-loop/index.astro | 20 | HTML comment "Phase 5: interactive route map goes here" — map deferred to Phase 5 |

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All pages are static SSG output. T-01-05 mitigated — no auth layer anywhere (SITE-01 confirmed). MDX rendering uses astro:content's `render()` function (T-01-03 accepted — content is in-repo, not user-submitted).

## Self-Check: PASSED

- src/layouts/Layout.astro: FOUND
- src/layouts/BlogPost.astro: FOUND
- src/components/BaseHead.astro: FOUND
- src/components/Header.astro: FOUND
- src/components/Footer.astro: FOUND
- src/pages/index.astro: FOUND
- src/pages/about.astro: FOUND
- src/pages/404.astro: FOUND
- src/pages/blog/[...id].astro: FOUND
- src/pages/voyages/great-loop/index.astro: FOUND
- src/content/blog/great-loop/2024-01-01-test-scaffold.mdx: FOUND
- dist/index.html: FOUND
- dist/about/index.html: FOUND
- dist/voyages/great-loop/index.html: FOUND
- dist/404.html: FOUND
- dist/blog/2024-01-01-test-scaffold/index.html: FOUND
- Commit 69146e7: FOUND (feat: layout shell)
- Commit d3705c2: FOUND (feat: pages, routes, dummy post)
- npm run build exit 0: CONFIRMED (6 pages built)

## Post-Checkpoint Deviation

**Accent color changed:** User requested red instead of brass during visual review.
- `--color-brass` value changed from `#c9a84c` to `#b91c1c`
- `--color-danger` removed (now redundant — same value as accent)
- Hardcoded hover hex `#a88a3d` → `#991515` across all pages
- Tailwind utilities `text-brass`, `ring-brass` etc. auto-update via CSS variable
