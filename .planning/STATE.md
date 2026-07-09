---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
stopped_at: Phase 03 complete (4/4) — ready to discuss Phase 4
last_updated: 2026-07-09T14:28:20.842Z
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 10
  completed_plans: 10
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Every stop on the Great Loop is documented with consistent, professional quality — readable by someone who wasn't there, discoverable by the boating community, and ready to host future voyages.
**Current focus:** Phase 4 — data pipeline

## Current Position

Phase: 03 (quality-lift) — EXECUTING
Plan: Not started
**Milestone:** v1.0 — Great Loop Blog
**Phase:** 4
**Status:** Ready to plan

## Phase Overview

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Scaffolding | ✅ Complete | 3/3 |
| 2 | Blogger Migration | 📋 Planned | 3 plans |
| 3 | Quality Lift | ○ Pending | — |
| 4 | Data Pipeline | ○ Pending | — |
| 5 | Route Maps | ○ Pending | — |
| 6 | New Post Generation | ○ Pending | — |

## Recent Activity

- 2026-07-07: Phase 02 planned. 3 plans (Wave 1: import script + MDX + redirects; Wave 2: Gallery.astro + VideoEmbed.astro; Wave 3: verify + deploy). All 8 requirements covered. Research, VALIDATION.md, and PATTERNS.md complete.
- 2026-07-07: Session resumed. Phase 01 confirmed complete (all 3 plans done, site live on Netlify). Significant pipeline and blog inventory work completed since last STATE update.
- 2026-06-27: Last active session (STATE.md last updated).
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
- ~~Photo count and GPS coverage rate~~ ✅ ANSWERED: 9,489 photos, 89% GPS
- ~~Are iPhone photos primarily HEIC or JPEG?~~ ✅ ANSWERED: HEIC
- ~~How many total posts in Blogger XML export?~~ ✅ ANSWERED: 72 posts
- ~~Is the Nebo PDF email archive in Gmail/Mail.app?~~ ✅ ANSWERED: Gmail, compiled into nebo-emails-b1–b8.json

## Session Continuity

Last session: 2026-07-08T12:56:56.482Z
Stopped at: context exhaustion at 75% (2026-07-08)

## Pipeline Status (scripts/ directory)

| Script | Status | Output |
|--------|--------|--------|
| `scripts/00-index-photos.mjs` | ✅ WORKING | `.planning/data/photo-index.json` (9,489 photos, 89% GPS) |
| `scripts/01-build-timeline.mjs` | ✅ WORKING | `.planning/data/voyage-timeline.json` (complete route reconstructed) |
| `scripts/02-fetch-nebo-logs.mjs` | ✅ WORKING | `.planning/data/nebo-logs.json` (162/171 logs OCR'd, 5,424nm total) |
| `scripts/03-correlate.mjs` | ✅ WORKING | `.planning/data/voyage-timeline-enriched.json` (625 dates, 619 with photos, 162 with Nebo) |
| `scripts/photo-viewer.mjs` | ✅ WORKING | Local photo review UI at http://localhost:3000 — cycle include/exclude/cover per photo, selections saved to photo-selections.json |
| `scripts/05-assess-photos.mjs` | ✅ WORKING | `.planning/data/photo-assessments.json` |
| `scripts/06-inventory-blog.mjs` | ✅ WORKING | `.planning/data/blog-inventory.json` (72 posts, 802 images, 55 videos) |
| `scripts/blog-viewer.mjs` | ✅ WORKING | Local blog review UI |
| `scripts/merge-nebo-emails.mjs` | ✅ WORKING | Nebo emails compiled (nebo-emails-b1–b8.json + nebo-email-index.json) |
| `scripts/fetch-thumbnails.py` | ✅ WORKING | Missing thumbnails fetched |
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

## Next Actions

1. **Plan Phase 2 (Blogger Migration)** — 72 Blogger posts ready to import. Blog inventory data already exists in `blog-inventory.json` and `blog-posts-raw.json`. Run `/gsd:plan-phase 2`
2. (Optional pre-work) **Complete photo curation** using `photo-viewer.mjs` — marks include/exclude/cover per day before stub generation
3. **Build `scripts/04-generate-stubs.mjs`** — generate MDX stubs for undocumented days (Phase 4 territory, but data is ready)

## Gmail Access

- Gmail MCP tools loaded and working
- Account: bruhnmichaell@gmail.com
- Nebo email batches compiled: `nebo-emails-b1–b8.json` + `nebo-email-index.json`

## Nebo OCR Details

The OCR pipeline uses:

```python
sys.path.insert(0, '/Users/bruhnhome/Library/Python/3.9/lib/python/site-packages')
import Quartz, Vision
from Foundation import NSURL
```

Page 1 extracts: date, voyages count, underway hours, max speed, duration, distance (nm), average speed
Pages 2-3 extract: per-voyage GPS coords, departure/arrival times, weather, ICW mile markers, waypoints
