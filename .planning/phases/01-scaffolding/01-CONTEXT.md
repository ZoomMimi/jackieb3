# Phase 1: Scaffolding - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A working Astro 5.x project deployed to Netlify with content collection schema, routing structure, and visual layout — blank of content but fully operational as infrastructure. This phase delivers the foundation every subsequent phase builds on. Creating, migrating, or enriching posts is out of scope.

</domain>

<decisions>
## Implementation Decisions

### CSS Tooling
- **D-01:** Tailwind CSS — utility classes, no custom CSS files. Use the official Astro blog template which ships with Tailwind pre-configured.

### Visual Aesthetic
- **D-02:** Nautical-themed — navy blues, warm whites, brass/gold accents. Not overly themed with rope/anchor clipart, but clearly maritime in color and feel.
- **D-03:** Color palette: deep navy primary (`#1a2e4a` or equivalent), warm off-white background (`#faf9f6` or equivalent), brass/gold accent for links and highlights (`#c9a84c` or equivalent). Exact values are Claude's discretion within this direction.

### Typography
- **D-04:** Serif body font + sans-serif headings. Serif (e.g., Lora, Playfair Display, or Georgia) for long-form post body text. Clean sans-serif (e.g., Inter or system-ui) for headings, nav, and UI chrome.
- **D-05:** Google Fonts for web fonts — loaded via Astro's standard font loading. Performance is Claude's discretion.

### Homepage Layout
- **D-06:** Claude's discretion — a sensible landing page for a travel blog. Reasonable defaults: brief voyage intro/hero, recent posts listing, link to full voyage index. Keep it simple for Phase 1; Phase 5 adds the interactive map.

### Navigation
- **D-07:** Claude's discretion — standard blog nav. Reasonable defaults: site name/logo text left, links to Home, Voyage (Great Loop index), About right. Mobile-responsive hamburger or stacked layout on small screens.

### Content Schema Optionality (Zod)
- **D-08:** `lat` and `lon` are **optional** — some stops may lack GPS data (especially early Blogger posts).
- **D-09:** `coverPhoto` is **optional** — not all posts will have a designated cover image.
- **D-10:** `anchorage` / `marina` is **optional** string — free text, not an enum. Some stops are neither anchoring nor marina.
- **D-11:** All other frontmatter fields are **required**: `title`, `date`, `voyage` (string slug, e.g. `"great-loop"`), `location` (string, human-readable place name), `excerpt` (string), `migrated` (boolean, defaults to `false`).

### Claude's Discretion
- Exact Tailwind color token names and CSS variable setup
- Specific Google Font choices within the serif/sans direction
- Homepage component structure and markup
- Nav component implementation details
- Zod `.optional()` vs `.nullable()` for optional fields

</decisions>

<specifics>
## Specific Ideas

- The Astro blog starter template (`npm create astro@latest -- --template blog`) is the starting point. Customize it — don't fight it.
- The multi-voyage architecture must be visible in routing from day one: `src/content/blog/great-loop/` as the content directory, not a flat `src/content/blog/`.
- A dummy MDX post in `src/content/blog/great-loop/` with all frontmatter fields must pass Zod validation as part of Phase 1 success criteria.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — FOUND-01, FOUND-02, FOUND-03, FOUND-04, SITE-01, SITE-03, SITE-04, SITE-05 (all Phase 1 requirements)

### Project context
- `.planning/PROJECT.md` — Stack decisions, constraints, multi-voyage architecture rationale
- `.planning/STATE.md` — Key decisions already locked (Astro 5, Netlify, plain `<img>`, no Astro Image optimizer)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — fresh project, no existing code

### Established Patterns
- Astro blog template conventions (content collections, layouts, pages) are the baseline pattern
- `client:only` hydration strategy already decided for interactive components (relevant for Phase 5 maps, not Phase 1)

### Integration Points
- `src/content/blog/great-loop/` — all Phase 2 migrated MDX posts land here; schema must be set correctly
- `netlify.toml` — build config established here, used by all future deploys

</code_context>

<deferred>
## Deferred Ideas

- Interactive route map on homepage — Phase 5
- Photo gallery components — Phase 2/3
- Search, filtering — v2 backlog
- Video embed component — Phase 2

</deferred>

---

*Phase: 01-scaffolding*
*Context gathered: 2026-03-23*
