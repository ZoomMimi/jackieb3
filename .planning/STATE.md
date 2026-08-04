---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Phase 06 Wave 2 in progress — 06-01/06-03 complete, 06-02 blocked on human R2 bucket provisioning (Task 2 checkpoint)"
last_updated: "2026-08-01T00:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 23
  completed_plans: 17
  percent: 74
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Every stop on the Great Loop is documented with consistent, professional quality — readable by someone who wasn't there, discoverable by the boating community, and ready to host future voyages.
**Current focus:** Phase 06 — new-post-generation

## Current Position

Phase: 06 (new-post-generation) — EXECUTING
Plan: 3 of 8 complete (06-01, 06-02, 06-03) — Waves 1-2 done
**Milestone:** v1.0 — Great Loop Blog
**Phase:** 6
**Status:** Waves 1-2 complete. R2 bucket `jackieb3-photos` provisioned and smoke-tested. Ready for Wave 3 (06-04: draft-preview gate + 2-day R2 pilot + human render verify).

## Phase Overview

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Scaffolding | ✅ Complete | 3/3 |
| 2 | Blogger Migration | ✅ Complete | 3/3 |
| 3 | Quality Lift | ✅ Complete | — |
| 4 | Data Pipeline | ✅ Complete | — |
| 5 | Route Maps | ✅ Complete | 4/4 |
| 6 | New Post Generation | ● In Progress | 2/8 (06-02 partial) |

## Recent Activity

- 2026-08-01: Session resumed. Phase 06 execution paused waiting on the user to provision a Cloudflare R2 bucket + API token (plan 06-02's Task 2 blocking checkpoint) — this requires dashboard login and cannot be automated. 06-01 (foundation/stubs) and 06-03 (triage classifier, user approved the computed 64-full/36-transit split as-is) are both complete and merged to main. A tangent about hosting new photos via Blogger "mock pages" instead of R2 was raised and rejected (no bulk-upload API exists on Blogger, would abuse the legacy platform, and re-adds a dependency the project is migrating away from) — R2 remains the plan. Separately, a Stadia Maps "Professional" trial-ending email was resolved as no-action-needed: the site only uses free-tier-eligible basic map tiles, and the account reverts to Stadia's free plan automatically.
- 2026-07-26: Phase 06 planned — 8 plans across 7 waves (06-01 tooling/stubs → 06-02/06-03 R2 pipeline + triage → 06-04 pilot/render-verify → 06-05 full R2 upload → 06-06 narrative generation + voice sign-off → 06-07 bulk narratives → 06-08 Barbara review + final publish). Research (R2/osxphotos/sharp/Claude-vision stack) and pattern-mapping done first. Plan-checker found and the planner fixed one real blocker: draft posts were leaking onto the homepage, voyage index, and RSS feed unfiltered (only blog pages were being gated) — now all six post-enumerating surfaces filter `draft`, verified by a new `scripts/check-draft-leak.mjs`. Root cause of the 40 missing stubs confirmed: `04-generate-stubs.mjs`'s `photoCount < 10` guard skips them; fix is a per-date override, not a global threshold change. POST-04 formally flagged as descoped (out of scope per D-05) for the next `/gsd:transition`.
- 2026-07-25: Phase 06 scope substantially tightened. Original 72 blog posts frozen (no new photos) — removed the 45 broken Phase-4-added Gallery blocks (commit fe69136). New-page work limited to two excursions: Keys→New Bern finish (27 days) and a second Canada/Great Lakes side trip (74 days), 40 of those 101 days need a stub generated first. ~187 other draft stubs left untouched, out of scope. See [[project_phase6_scope]].
- 2026-07-23: Phase 06 context gathered (06-CONTEXT.md). Key finding: all 295 Gallery-using posts (250 draft stubs + 45 already-published) reference local file:// Photos-library paths that don't render anywhere — resolved to Cloudflare R2 for hosting.
- 2026-07-23: Phase 05 closed out. 05-04-SUMMARY.md written; all three human-gated tasks (GPX import, Stadia production tiles, mobile verification) confirmed done. See [[project_phase5_extras]] for work done outside the formal plan (lightbox, PostMiniMap photo dots, Nebo OCR detail parser).
- 2026-07-23: Imported 30 Nebo GPX files total across sessions; found and removed a stray non-voyage trip (Rhode Island Sound, wrong dates) that had polluted the live route polyline; cleaned up duplicate exports. See [[project_gpx_pipeline]].
- 2026-07-23: Built `scripts/09-parse-nebo-details.mjs` — extracts weather, route names, ICW mile markers, and waypoints from raw Nebo OCR text (previously only summary stats were used). Not yet wired into any page; available for Phase 6 narrative generation.
- 2026-07-07: Phase 02 planned. 3 plans (Wave 1: import script + MDX + redirects; Wave 2: Gallery.astro + VideoEmbed.astro; Wave 3: verify + deploy). All 8 requirements covered. Research, VALIDATION.md, and PATTERNS.md complete.
- 2026-07-07: Session resumed. Phase 01 confirmed complete (all 3 plans done, site live on Netlify). Significant pipeline and blog inventory work completed since last STATE update.
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

Last session: 2026-08-01
Stopped at: Phase 06 Wave 2 blocked on human action. Next: user provisions a Cloudflare R2 bucket + bucket-scoped API token, fills in `.env` (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE, ANTHROPIC_API_KEY), then says "approved" to resume plan 06-02's smoke test and finish Wave 2.

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
| `scripts/04-generate-stubs.mjs` | ✅ WORKING | 250 draft MDX stubs generated (Phase 04) |
| `scripts/07-daily-routes.mjs` | ✅ WORKING | `src/data/daily-routes.json` — start/end/track/photos per day |
| `scripts/08-slice-gpx-by-day.mjs` | ✅ WORKING | Merges real Nebo GPX into daily-routes.json tracks |
| `scripts/simplify-gpx.mjs` | ✅ WORKING | `src/data/route-track.json` — full-route polyline, runs via astro:build:start |
| `scripts/import-gpx.sh` (`npm run import-gpx`) | ✅ WORKING | Pulls AirDropped GPX from ~/Downloads into `.planning/data/gpx/` |
| `scripts/09-parse-nebo-details.mjs` | ✅ WORKING | Adds `legs` detail (weather, route name, ICW markers) to nebo-logs.json — not yet consumed downstream |

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

1. **Execute Phase 06** — run `/gsd:execute-phase 6`. 8 plans, 7 waves; several waves have human-gated checkpoints (R2 bucket provisioning, render-verify, voice sign-off, Barbara's final review) so this will not run fully autonomously.
2. Flag REQUIREMENTS.md's QLFT-05 and POST-04 for the next `/gsd:transition` — both effectively descoped this milestone (already documented in 06-01/06-08 plan frontmatter, actioned by 06-08 Task 3).
3. `scripts/09-parse-nebo-details.mjs`'s `legs` output (weather, route names, ICW markers) is wired into Phase 6's narrative generation per 06-CONTEXT.md — no longer unconsumed.
4. (Optional) Import more Nebo GPX tracks if more trips are available — only 68 of 569 days have real GPS tracks so far.

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
