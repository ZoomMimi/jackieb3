# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Every stop on the Great Loop is documented with consistent, professional quality — readable by someone who wasn't there, discoverable by the boating community, and ready to host future voyages.
**Current focus:** Phase 1 — Scaffolding (not started)

## Current Position

**Milestone:** v1.0 — Great Loop Blog
**Phase:** 0 / 6 complete
**Status:** Initialized — ready for Phase 1 planning

## Phase Overview

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Scaffolding | ○ Pending | — |
| 2 | Blogger Migration | ○ Pending | — |
| 3 | Quality Lift | ○ Pending | — |
| 4 | Data Pipeline | ○ Pending | — |
| 5 | Route Maps | ○ Pending | — |
| 6 | New Post Generation | ○ Pending | — |

## Recent Activity

- 2026-03-23: Project initialized. Research complete (Astro stack, maps, data pipeline, Blogger migration). Requirements and roadmap created.

## Key Decisions

- Astro 5 + Netlify free tier (static output, no adapter)
- Leaflet.js for maps with `client:only` hydration (not MapLibre — too heavy)
- Stadia Maps tile provider (free tier, good cartography)
- Data pipeline runs as standalone Node.js scripts outside astro build
- Photos stay cloud-hosted (no self-hosting) — plain `<img>` tags, not Astro Image
- Claude API for AI-assisted quality lift of migrated posts
- `migrated` frontmatter flag tracks raw imports vs. quality-lifted posts

## Open Questions (Need Real Data)

- Nebo GPX export format — does it include `<time>` on trackpoints? (Required for photo correlation)
- Email archive format — mbox, .eml files, or HTML? (Affects email parser approach)
- Photo count and EXIF GPS coverage rate
- Are iPhone photos in HEIC or JPEG format?
- How many total posts in Blogger XML export?

## Session Continuity

Last session: 2026-03-23 — Project initialization complete
Next action: `/gsd:plan-phase 1`
