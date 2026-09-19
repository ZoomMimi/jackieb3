---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Phase 06 Wave 4 (06-05, R2 upload) at 97/100 posts — 3 remaining need manual iCloud download (Task 2-style checkpoint)"
last_updated: "2026-09-18T00:00:00.000Z"
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

Phase: 06 (new-post-generation) — EXECUTING (Wave 4, blocked on 3 human iCloud downloads)
Plan: 4 of 8 fully complete (06-01, 06-02, 06-03, 06-04); 06-05 at 97 of 100 posts R2-uploaded
**Milestone:** v1.0 — Great Loop Blog
**Phase:** 6
**Status:** Wave 4 (06-05, full R2 upload) resumed 2026-09-18 and ran to 97/100. Full Keys-to-New-Bern range (27 posts) and all of Canada except 3 dates are done (batches 1-8 committed in the worktree). The remaining 3 — 2023-08-03, 2023-08-04, 2023-08-25 — each have one asset (2 images, 1 video) that is iCloud-only with zero local presence (`ZCLOUDLOCALSTATE=0`, `ZCLOUDDOWNLOADREQUESTS=0` in Photos.sqlite, no cached derivative either): osxphotos's `--download-missing` never triggers a fetch for them, and `--allow-derivative-fallback` has nothing to fall back to. This is a genuine human-only checkpoint, not a script bug.

**Resume Instructions for 06-05:**
1. Human action needed first: open Photos.app, find these 3 assets by UUID (`4D62663A-3ADE-4CFF-B79A-D8CC0145AA69` on 2023-08-03, `10DA80DE-5CAA-4F3F-8939-C8187B2E884A` on 2023-08-04, `8D8AB0D9-F594-45C6-A2DE-1D491699468F` on 2023-08-25), select each and File → Download Originals (or similar, to force the iCloud fetch), then confirm `ZCLOUDLOCALSTATE` flips to 1 in Photos.sqlite or just retry the upload.
2. Open worktree: `.claude/worktrees/agent-a9124638c29605553` (branch `worktree-agent-a9124638c29605553`). Once the 3 originals are downloaded, run `node --env-file-if-exists=.env scripts/10-upload-r2.mjs --date 2023-08-03 --date 2023-08-04 --date 2023-08-25` there and commit the result.
3. Fixed this run: the recurring "stale export-staging-directory crash on retry" defect (previously only worked around manually) is now fixed at the code level — `scripts/10-upload-r2.mjs` `rm -rf`s each day's staging dir before every export attempt (commit `ded2259`). Note: do NOT run two `10-upload-r2.mjs` invocations concurrently — osxphotos itself crashes with `KeyError: 'styles'` in its own config-file handling when two instances run at once (observed this session); run batches sequentially.
4. After the last 3 posts land: merge the worktree into main, run `npm run build` + `node scripts/verify-phase6.mjs --gate no-file-urls` (should now pass), write 06-05-SUMMARY.md, update STATE.md/ROADMAP.md tracking, then proceed to Wave 5 (06-06: narrative generation implementation + 2 pilot drafts + human voice sign-off).

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

- 2026-09-18: Resumed plan 06-05 (R2 upload) from the 67/100 pause. Fixed the recurring stale-staging-directory crash at the code level (`scripts/10-upload-r2.mjs`, commit `ded2259`) so retries no longer need manual `rm -rf`. Ran batches 5-8 (30 more posts, ~3GB) to 97/100. The final 3 dates (2023-08-03, 2023-08-04, 2023-08-25) each have one asset that's iCloud-only with zero local presence — not even a cached derivative — so neither `--download-missing` nor `--allow-derivative-fallback` can resolve them; this needs the user to manually force-download the specific originals in Photos.app before the last retry. Also found (the hard way): running two `10-upload-r2.mjs` processes concurrently crashes osxphotos itself (`KeyError: 'styles'` in its own config handling) — batches must run sequentially.
- 2026-08-09: R2 bucket provisioned (`jackieb3-photos`, credentials smoke-tested — Wave 2 complete). Wave 3 (06-04) ran the R2 pilot on 2 voyage days and caught a real data-quality defect during human review: 2 of 19 photos on 2024-04-13 (and 4 of 14 on 2023-07-16) were not actually from that voyage day — they matched by calendar timestamp only, with no GPS confirming location. Root cause: these ~101 new Phase 6 days never went through the manual photo-curation step (`photo-viewer.mjs`) that 87 other voyage days already had. Scope check found 57 of 101 in-scope days affected, 181 no-GPS photos total, 0 days would go empty if excluded. Fixed at the source: `scripts/10-upload-r2.mjs` now default-excludes any Gallery UUID with null lat/lon before upload. Full run's scope is now 1,665 files (down from 1,846). Barbara will separately review the excluded no-GPS photos via `photo-viewer.mjs` later to add back any she recognizes as legitimate — not blocking the current phase. User declined the `--allow-derivative-fallback` option for the full upload (pilot had 100% export success).
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

Last session: 2026-09-18
Stopped at: Plan 06-05 (full R2 upload) at 97 of 100 posts — blocked on the user manually downloading 3 iCloud-only originals in Photos.app (not a script issue). See "Resume Instructions for 06-05" under Current Position above for exact steps to pick back up.

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
