---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-27T18:41:49.592Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Every stop on the Great Loop is documented with consistent, professional quality — readable by someone who wasn't there, discoverable by the boating community, and ready to host future voyages.
**Current focus:** Phase 01 — scaffolding

## Current Position

Phase: 01 (scaffolding) — EXECUTING
Plan: 1 of 3
**Milestone:** v1.0 — Great Loop Blog
**Phase:** 0 / 6 complete
**Status:** Executing Phase 01

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

## Data Sources (Confirmed)

- **Photos:** iCloud Photos library on Mac — extract via `osxphotos` (GPS + timestamp on every photo)
- **GPS tracks:** Nebo app — export GPX per-trip from app (Settings → Trips → Export GPX); covers full voyage
- **Nebo summaries:** Auto-emailed PDF at end of each trip + monthly summaries; parse from email archive
- **Coverage:** Full voyage from Day 1 (Apr 2022) through return to New Bern NC (May 2024)

## Open Questions (Need Real Data)

- Nebo GPX export: one file per trip session or one per day? Does it include `<time>` on each trackpoint?
- Photo count and GPS coverage rate (run osxphotos query to determine)
- Are iPhone photos primarily HEIC or JPEG?
- How many total posts in Blogger XML export?
- Is the Nebo PDF email archive in Gmail/Mail.app? What format (HTML email, attached PDF, or inline)?

## Session Continuity

Last session: 2026-06-27T18:38:08.198Z

## Pipeline Status (scripts/ directory)

| Script | Status | Output |
|--------|--------|--------|
| `scripts/00-index-photos.mjs` | ✅ WORKING | `.planning/data/photo-index.json` (9,489 photos, 89% GPS) |
| `scripts/01-build-timeline.mjs` | ✅ WORKING | `.planning/data/voyage-timeline.json` (complete route reconstructed) |
| `scripts/02-fetch-nebo-logs.mjs` | ✅ WORKING | `.planning/data/nebo-logs.json` (162/171 logs OCR'd, 5,424nm total) |
| `scripts/03-correlate.mjs` | ✅ WORKING | `.planning/data/voyage-timeline-enriched.json` (625 dates, 619 with photos, 162 with Nebo) |
| `scripts/photo-viewer.mjs` | ✅ WORKING | Local photo review UI at http://localhost:3000 — cycle include/exclude/cover per photo, selections saved to photo-selections.json |
| `scripts/04-generate-stubs.mjs` | ❌ NOT BUILT YET | Generate MDX post stubs |

## Key Findings

- **9,489 photos** in voyage range (Apr 2022–May 2024), 89% GPS-tagged
- **Complete voyage arc** reconstructed from photo GPS centroids
- **Last segment confirmed**: Keys → Fort Lauderdale → Miami → West Palm → Vero Beach → Cape Canaveral → Daytona → St. Augustine → Jacksonville → Savannah → Beaufort SC → Charleston (3 days, 122 photos) → Myrtle Beach → Morehead City NC → **New Bern May 17, 2024**
- **Nebo emails**: 100+ voyage logs in Gmail (bruhnmichaell@gmail.com), subject "The Jackie B III Voyage Log - {date}"
- **Nebo PDF format**: 3 pages per log — Page 1: summary stats (distance nm, hours, avg speed, max speed) + map; Pages 2-3: per-voyage detail with GPS coords, ICW mile markers, weather, timestamps
- **OCR pipeline**: macOS Vision framework via PyObjC works — tested on May 17 2024 log (40.8nm, 4:17 underway, 9.5 kts avg, Beaufort NC → New Bern)
- **Photos library**: `~/Pictures/Photos Library.photoslibrary/database/Photos.sqlite` — Node.js `node:sqlite` reads it directly
- **Photo file paths**: `~/Pictures/Photos Library.photoslibrary/originals/{first-uuid-char}/{UUID}.heic` (many iCloud-only — originals not downloaded)
- **Photo thumbnails**: `~/Pictures/Photos Library.photoslibrary/resources/derivatives/{first-uuid-char}/{UUID}_1_105_c.jpeg` — 1022×768 JPEG, ~74% cached locally, used by photo-viewer.mjs

## Next Actions (in order)

1. ~~**Build `scripts/02-fetch-nebo-logs.mjs`**~~ ✅ DONE
2. ~~**Run `scripts/00-index-photos.mjs`**~~ ✅ DONE
3. ~~**Run `scripts/01-build-timeline.mjs`**~~ ✅ DONE
4. ~~**Build `scripts/03-correlate.mjs`**~~ ✅ DONE — `voyage-timeline-enriched.json` (625 dates, 156 with both photos + Nebo)
5. ~~**Build `scripts/photo-viewer.mjs`**~~ ✅ DONE — `node scripts/photo-viewer.mjs` opens browser at localhost:3000; saves to `photo-selections.json`

6. **Use photo-viewer to curate photos**: for each day, mark photos include/exclude/cover; mark day reviewed when done
7. **Build `scripts/04-generate-stubs.mjs`**: for each undocumented day, generate MDX stub with frontmatter + photo list + Nebo stats
8. **Start Phase 1 Scaffolding** (Astro project)

## Gmail Access

- Gmail MCP tools loaded and working
- Account: bruhnmichaell@gmail.com
- Search query for Nebo logs: `from:nebo subject:"Voyage Log" after:2022/4/1 before:2024/6/1`
- 100 messages returned in first page (Nov 2023–May 2024); need more pages for Apr 2022–Oct 2023

## Nebo OCR Details

The OCR pipeline uses:

```python
sys.path.insert(0, '/Users/bruhnhome/Library/Python/3.9/lib/python/site-packages')
import Quartz, Vision
from Foundation import NSURL
```

Page 1 extracts: date, voyages count, underway hours, max speed, duration, distance (nm), average speed
Pages 2-3 extract: per-voyage GPS coords, departure/arrival times, weather, ICW mile markers, waypoints

Next action: `/gsd:plan-phase 1` OR continue building Nebo fetch pipeline
