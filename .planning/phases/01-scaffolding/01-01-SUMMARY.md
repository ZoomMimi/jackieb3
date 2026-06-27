---
phase: 01-scaffolding
plan: "01"
subsystem: astro-scaffold
tags: [astro, tailwind, content-collections, google-fonts, schema]
dependency_graph:
  requires: []
  provides:
    - astro-7-project-root
    - content-schema-blog-voyages
    - nautical-theme-tokens
    - google-fonts-lora-inter
  affects:
    - all-subsequent-plans
tech_stack:
  added:
    - astro@7.0.3
    - "@astrojs/mdx@7.0.0"
    - "@astrojs/sitemap@3.7.3"
    - "@astrojs/rss@4.0.18"
    - tailwindcss@4.3.1
    - "@tailwindcss/vite@4.3.1"
    - sharp@0.34.3
    - "@anthropic-ai/sdk@0.52.0 (pre-existing, preserved)"
  patterns:
    - Astro 7 Content Layer API with glob() loader
    - Tailwind 4 via Vite plugin (no tailwind.config.mjs)
    - Google Fonts via Astro fonts: top-level key with fontProviders.google()
    - Zod schemas imported from astro/zod (not zod)
    - Subdirectory-per-voyage content structure (great-loop/)
key_files:
  created:
    - astro.config.mjs
    - package.json
    - package-lock.json
    - tsconfig.json
    - .nvmrc
    - .gitignore
    - src/content.config.ts
    - src/styles/global.css
    - src/content/blog/great-loop/.gitkeep
    - src/content/voyages/.gitkeep
    - src/content/blog/great-loop/2024-01-01-test-scaffold.mdx
  modified:
    - src/components/BaseHead.astro
    - src/layouts/BlogPost.astro
    - src/pages/about.astro
    - src/pages/blog/index.astro
    - src/pages/rss.xml.js
decisions:
  - "Use Astro 7.0.3 (plan updated from research 6.x — plan note confirms 7.x is correct)"
  - "Rolldown 1.x prerender env workaround: vite.environments.prerender.build.rolldownOptions.tsconfig = false"
  - "Inline all tsconfig.json compilerOptions (no extends) to avoid Rolldown native resolver issues"
  - "Template pages updated minimally to use new schema fields (plan 02 will replace pages entirely)"
metrics:
  duration: "~32 minutes"
  completed: "2026-06-27T19:06:25Z"
  tasks_completed: 2
  files_created: 11
  files_modified: 5
---

# Phase 01 Plan 01: Astro 7 Scaffold + Content Schema Summary

**One-liner:** Astro 7 project scaffolded with Tailwind 4 Vite plugin, Google Fonts (Lora/Inter) via fontProviders.google(), and a multi-voyage blog content schema with subdirectory-per-voyage glob loader and nautical @theme CSS tokens.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Scaffold Astro 7 + Tailwind 4 + Google Fonts | 5a7f121 | astro.config.mjs, package.json, .nvmrc, .gitignore, src/, public/ |
| RED | Failing schema validation test post | 6ab78c6 | src/content/blog/great-loop/2024-01-01-test-scaffold.mdx |
| 2 (GREEN) | Content schema + nautical theme tokens | ef78d5f | src/content.config.ts, src/styles/global.css, tsconfig.json |

## Acceptance Criteria — All Passed

- `npx astro --version` reports 7.0.3
- package.json contains astro@^7, @astrojs/mdx, @tailwindcss/vite@^4, tailwindcss@^4
- package.json retains @anthropic-ai/sdk and assess-photos/photo-viewer scripts
- `.nvmrc` contains `22`
- No `tailwind.config.mjs`
- No `@astrojs/tailwind`
- astro.config.mjs has top-level `fonts:` with fontProviders.google() for Lora and Inter
- `src/content.config.ts` exists at project root (NOT src/content/config.ts)
- Imports z from `astro/zod`
- Blog loader base is `./src/content/blog/great-loop`
- All 6 required fields + 5 optional fields declared
- `src/styles/global.css` has `@import "tailwindcss"` and `@theme` block
- Color tokens: --color-navy #1a2e4a, --color-offwhite #faf9f6, --color-brass #c9a84c
- `npm run build` exits 0 with zero errors

## TDD Gate Compliance

- RED gate: `test(01-01)` commit 6ab78c6 — dummy post with project fields fails old template schema (build errors on `description: Required`, `pubDate` mismatch)
- GREEN gate: `feat(01-01)` commit ef78d5f — new schema validates dummy post, build succeeds
- REFACTOR: Not needed — schema was correct from initial write

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rolldown 1.x native tsconfig resolver fails in prerender environment**
- **Found during:** Task 2 build verification
- **Issue:** Astro 7 + Vite 8.1.0 uses Rolldown 1.1.3 as bundler. The Rolldown native (Rust) tsconfig resolver fails for files in the prerender environment with `[TSCONFIG_ERROR] Failed to load tsconfig for 'src/pages/*.astro': Tsconfig not found`. This occurs even with a valid tsconfig.json at the project root. Root cause: the Astro prerender environment's `rolldownOptions` doesn't inherit from the top-level `build.rolldownOptions`, and Rolldown's native code fails to resolve the tsconfig when processing `.astro` files. Dev server (`astro dev`) works fine — only production build (`astro build`) is affected.
- **Fix:** Added `tsconfig: false` to `vite.environments.prerender.build.rolldownOptions` in astro.config.mjs. This disables Rolldown's native tsconfig auto-detection for the prerender build phase. Build succeeds cleanly.
- **Files modified:** astro.config.mjs
- **Commit:** ef78d5f (included in GREEN commit)

**2. [Rule 3 - Blocking] Template pages reference old schema fields after schema replacement**
- **Found during:** Task 2 build verification
- **Issue:** After replacing `src/content.config.ts` with the project schema, the template's pages (`BlogPost.astro`, `about.astro`, `blog/index.astro`, `rss.xml.js`) still referenced old schema fields: `pubDate`, `heroImage`, `updatedDate`, `description`. TypeScript type checking via Rolldown failed with TSCONFIG_ERROR (masked the actual TS errors, but removing those would expose them). Plan 02 will replace these pages entirely.
- **Fix:** Minimal updates to use new schema fields: `date` instead of `pubDate`, `excerpt` instead of `description`, removed `heroImage`/`updatedDate` from layouts. Also updated `src/components/BaseHead.astro` to use `--font-lora`/`--font-inter` instead of the template's `--font-atkinson`.
- **Files modified:** src/layouts/BlogPost.astro, src/pages/about.astro, src/pages/blog/index.astro, src/pages/rss.xml.js, src/components/BaseHead.astro
- **Commit:** ef78d5f

**3. [Rule 3 - Blocking] tsconfig.json `extends` path unresolvable by Rolldown native resolver**
- **Found during:** Task 2 build debugging
- **Issue:** Rolldown 1.x native tsconfig resolver cannot resolve `"extends": "astro/tsconfigs/strict"` (npm package paths). Inlining all compiler options directly (removing `extends`) was necessary.
- **Fix:** Replaced `extends: "astro/tsconfigs/strict"` with all compiler options inlined in tsconfig.json.
- **Files modified:** tsconfig.json
- **Commit:** ef78d5f

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| src/content/blog/great-loop/2024-01-01-test-scaffold.mdx | all | Schema validation post — must be deleted before launch. coverPhoto is a placeholder URL. |
| src/pages/about.astro | all | Stub content "Stub content — full About page coming in a later phase." Intentional placeholder for plan 02. |
| src/pages/index.astro | all | Original Astro template homepage content ("Hello, Astronaut!"). Intentional — plan 02 implements the Jackie B III homepage. |
| src/content/blog/first-post.md, second-post.md, third-post.md, markdown-style-guide.md, using-mdx.mdx | all | Template demo posts in src/content/blog/ (not in great-loop/ subdirectory). NOT picked up by the new schema's glob loader. Orphaned — plan 02 can delete them. |

## Self-Check: PASSED

- `astro.config.mjs`: FOUND
- `src/content.config.ts`: FOUND
- `src/styles/global.css`: FOUND
- `.nvmrc`: FOUND (content: 22)
- `package.json` with @tailwindcss/vite, @anthropic-ai/sdk: FOUND
- `npm run build` exit 0: CONFIRMED (4 pages built)
- Commit 5a7f121: FOUND (feat: scaffold)
- Commit 6ab78c6: FOUND (test: RED phase)
- Commit ef78d5f: FOUND (feat: GREEN phase)
