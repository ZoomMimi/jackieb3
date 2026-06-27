# JACKIE B III Going Loopy

## What This Is

A custom Astro blog site documenting the Jackie B III's Great Loop voyage, migrated from an existing Blogger blog at jackiebiiigoingloopy.blogspot.com. The site serves as the permanent, professional home for all Jackie B III voyages — the Great Loop is voyage one, with future adventures to follow. Audience is both family/friends who followed the trip and the broader Great Loop community.

## Core Value

Every stop on the Great Loop is documented with consistent, professional quality — readable by someone who wasn't there, discoverable by the boating community, and ready to host future voyages.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Migrate all existing Blogger content (posts + embedded photos) to Astro
- [ ] Quality-lift existing ~80% of posts: consistent headings, grammar, formatting, professional presentation matching auto-generated posts
- [ ] Auto-generate missing ~20% of posts from Nebo GPS tracks, iPhone EXIF photo metadata, and Nebo voyage summary emails
- [ ] Interactive route map of full Great Loop with clickable stops (pop-up preview with photo + snippet + link to full post)
- [ ] Per-post photo galleries pulling from cloud-hosted photos — clicking a photo opens a full-screen lightbox with prev/next navigation (GLightbox)
- [ ] Video embeds (cloud-hosted or Mac-local source)
- [ ] Public site, no login required
- [ ] Multi-voyage architecture — Great Loop is voyage one, site supports future trips
- [ ] Deployed on Netlify free tier

### Out of Scope

- User accounts / login — public read-only site, no auth needed
- Comments system — not a forum, keep it clean
- Future voyage content — architecture supports it, but not in v1 scope
- Real-time GPS tracking — trip is complete, static route data only

## Context

- **Existing blog:** jackiebiiigoingloopy.blogspot.com — ~80% of trip documented, trip is 100% complete
- **Tech stack:** Astro + Netlify (consistent with existing reunion-website project)
- **Data sources:**
  - Blogger XML export (all existing posts + photo URLs)
  - iPhone/iPad Photos library (EXIF metadata: timestamp + GPS coordinates)
  - Nebo Gold GPS tracks (voyage logs, exportable as GPX/CSV)
  - Nebo daily voyage summary emails (narrative context per day)
  - Videos: cloud-hosted or on Mac
- **Post quality goal:** Auto-generated posts from GPS/EXIF data set the quality bar. Existing posts must be reformatted to match — same heading structure, grammar standard, visual consistency
- **Route map UX:** Clicking a stop shows a clean pop-up (photo + excerpt) with link to full post; map stays visible alongside content

## Constraints

- **Hosting:** Netlify free tier — static site output required (Astro SSG mode)
- **Photos:** Cloud-hosted (not self-hosted) — site references URLs, does not serve images
- **Stack:** Astro — already established on reunion-website, no framework change
- **Data processing:** GPS/EXIF enrichment pipeline must run locally (photos, GPS files are local assets)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Astro + Netlify | Consistent with reunion-website, free tier sufficient, static output | — Pending |
| Multi-voyage architecture from day one | Site is permanent home for Jackie B III, not a single-trip microsite | — Pending |
| Auto-generate posts from GPS + EXIF + emails | Trip is complete, data exists — generate rather than write from scratch | — Pending |
| Quality-lift existing posts to match generated quality | Uniform presentation across full journey | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-23 after initialization*
