---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: context exhaustion at 75% (2026-09-21)
last_updated: "2026-09-21T10:39:02.859Z"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 23
  completed_plans: 22
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Every stop on the Great Loop is documented with consistent, professional quality — readable by someone who wasn't there, discoverable by the boating community, and ready to host future voyages.
**Current focus:** Phase 06 — new-post-generation

## Current Position

Phase: 06 (new-post-generation) — EXECUTING (Waves 1-6 complete, ready for Wave 7)
Plan: 7 of 8 fully complete (06-01 through 06-07)
**Milestone:** v1.0 — Great Loop Blog
**Phase:** 6
**Status:** Waves 5+6 (06-06 narrative-generator implementation + pilots, 06-07 bulk generation) completed and merged to main 2026-09-19. See `06-06-SUMMARY.md` and `06-07-SUMMARY.md` for the full account. All 59 `full`-classified in-scope days now have `narrativeDrafted: true` (`NARRATIVE_DRAFTED_POSTS=59`); the 34 `transit` days and 7 `sparse` days (the 2023-08-02–08 land-trip week) remain untouched. `node scripts/verify-phase6.mjs --gate posts --gate no-file-urls` passes, `npm run build` is green (77 pages). `DRAFT_POSTS=100` unchanged — nothing has been published; that's Wave 7's (06-08) job.

**Open item carried into 06-08:** verse-citation accuracy was never explicitly human-verified during the 06-06 checkpoint (the user's attention went to a name-fabrication fix and a new review-tool build instead) — every generated closing Bible verse across all 59 posts should be treated as unverified until Barbara's review. Also, `.planning/data/narrative-notes.json` currently has real family/memory context for only one pilot day (2024-04-13); the other 58 posts used only generic role references and can be regenerated per-day with real names/memories via `scripts/narrative-viewer.mjs` during the 06-08 review pass.

**Two data-integrity defects found and fixed during this run:**

1. Individual mis-synced photos on 2023-08-03 and 2023-08-25: each had one asset that was a Messages/"Shared with You"-style syndication cache item with no real original anywhere (not a normal iCloud asset, no derivative fallback either). Removed individually from those posts' Gallery arrays; rest of both days uploaded normally.
2. A bigger version of the Wave-3 GPS-mismatch defect: **2023-08-02 through 2023-08-08 (7 posts, except 08-01/08-10) turned out to be an entire land-trip week**, not the boat — confirmed with the project owner as a drive home to the DC area while the Jackie B III sat at Holland MI. Unlike the Wave-3 defect, these photos all had real, self-consistent GPS; the tell was implausible daily mileage (up to 261 mi/day) bracketed by the same real anchor location (Holland MI) on both sides. All Gallery content removed from these 7 posts (they stay in scope as photo-less draft stubs — `narrative-triage.json` was updated to reclassify all 7 as `sparse` and `locked: true`, since their old classifications were computed from stale photo counts and would otherwise have been wrongly sent to AI generation with zero real photos); the 133 already-uploaded objects (~3GB) were deleted from R2. Their frontmatter (`title`/`location`/`lat`/`lon`) still reflects the bogus DC centroid — not corrected, flagged for whoever eventually decides what these 7 posts should say.

Also fixed at the code level: the recurring "stale export-staging-directory crash on retry" (previously only worked around manually) — `scripts/10-upload-r2.mjs` now `rm -rf`s each day's staging dir before every export attempt (commit `ded2259`). Discovered: running two `10-upload-r2.mjs` processes concurrently crashes osxphotos itself (unrelated bug in its own config handling) — always run batches sequentially.

**Next action:** Plan 06-08 (Barbara's review queue, publication gate, and requirement descope flags) needs to be discussed/planned. This is the actual human review of all 59 AI-drafted narratives via `npm run narrative-viewer` (http://localhost:3002) — adding real family/memory notes, editing text, dropping unwanted days, verifying verse citations, then flipping `draft: false` per-post when satisfied. The 7 land-trip posts (2023-08-02–08) are `sparse`-classified and won't be selected for AI generation; someone still needs to decide what (if anything) these 7 posts should ultimately say and fix their bogus location frontmatter.

## Phase Overview

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Scaffolding | ✅ Complete | 3/3 |
| 2 | Blogger Migration | ✅ Complete | 3/3 |
| 3 | Quality Lift | ✅ Complete | — |
| 4 | Data Pipeline | ✅ Complete | — |
| 5 | Route Maps | ✅ Complete | 4/4 |
| 6 | New Post Generation | ● In Progress | 7/8 |

## Recent Activity

- 2026-09-19: Completed and merged plans 06-06 (narrative-generator `--generate` mode, two pilot drafts, and the human-verify checkpoint) and 06-07 (bulk generation across the remaining 57 full-classified days, 0 failures) to main. Phase 6 is now 7/8 plans complete. Key findings: the checkpoint never produced a single explicit approve/reject verdict — instead the user drove two real fixes (a name-fabrication grounding fix, then a new `scripts/narrative-viewer.mjs` review tool with real-time editing/keep-discard/family+memory notes) before saying to proceed with the bulk run, which is recorded as the de facto approval. A hallucinated-markdown-image defect (4 of 59 posts, broke the build) was found and fixed mid-bulk-run with both a data fix and a generator-level defensive guard. Verse-citation accuracy was never explicitly verified — flagged as an open item for 06-08's review. See `06-06-SUMMARY.md` and `06-07-SUMMARY.md` for full accounts.
- 2026-09-18: Completed and merged plan 06-05 (full R2 upload). See "Status" above for the two data-integrity defects found (individual mis-synced photos on 2 dates; a whole land-trip week on 7 dates) and how they were resolved. `06-05-SUMMARY.md` has the full account. Phase 6 is now 5/8 plans complete.
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

Last session: 2026-09-23T21:10:00Z
Stopped at: Session resumed, proceeding to Phase 06 plan 06-08 (Barbara's review queue + publication gate) via /gsd:execute-phase 6. Home page polish shipped earlier this session (boat card + contact card side by side with click-to-zoom, "The Anchor We Cannot See" PDF and "Strength As One" book links, dynamic footer year), all pushed through `0e8b1a0`.
Resume file: None

Previous session: 2026-09-21T10:40:51.881Z — context exhaustion at 75%, working tree was clean and fully pushed at pause time.

Extended site-polish session layered on top of the existing Phase 6 pause (06-08 untouched throughout). All 12 commits landed and pushed to `origin/main` (HEAD `816fc4a` at pause time, later `56d856f`):

1. `1d583da` — narrative-viewer: photo crop + video rotate/trim (ffmpeg)
2. `0c17ccc` — committed project owner's concurrent narrative-viewer photo cleanup
3. `9d9cb29` — per-day Nebo trip map: `scripts/13-extract-nebo-maps.mjs`, `NeboMap.astro`, `src/data/nebo-maps.json`, wired into `BlogPost.astro`; piloted on 3 posts
4. `3a375f5` — whole-loop summary (`LoopSummary.astro`, from `OurLoopMap.jpeg`) on `/voyages/great-loop/` and `/about/`; fixed stale "5,424 nm" → 6,273.4 nm authoritative total
5. `0c5df5f` — Nebo maps for first 4 already-published days
6. `c0c1f42` — rolled Nebo maps out to all 148 available days; interactive PostMiniMap suppressed wherever a Nebo map exists
7. `510dc6f` — removed 36 Nebo-screenshot duplicates from original post bodies (individually verified via contact-sheet review, not pattern-matched)
8. `6669977` — removed interactive VoyageMap from `/voyages/great-loop/` (same bad-GPS issue)
9. `8b0b689` — added loop-completion photo below the loop map
10. `c65f01b` — dropped redundant loop stats text; added Our Boat + New Bern background pages from the live Blogger site
11. `7b17720` — left-margin sticky DateNav sidebar on post pages (desktop only)
12. `816fc4a` — moved VoyageStats to top of post; added max/avg speed + weather from Nebo logs; bulk-removed old tag from 361 post bodies (hit and fixed a blank-line MDX bug along the way — see Critical Anti-Patterns below)

**Deferred, not started:** real GPS track fix (needs fresh per-day GPX exports from Nebo app — explicit user deferral, "somewhere down the road"); Phase 6's 06-08 (Barbara's review queue, publication gate) — still exactly where it was before this session began.

**Critical anti-pattern found this session:** bulk regex-removing a component tag (`<VoyageStats />`) from many MDX files without checking what it leaves adjacent silently broke MDX compilation in 224/361 files by collapsing the blank line MDX requires between a trailing `import` block and following JSX. The build error gave no filename (rolldown/mdxjs-rs bundles files together). Fixed via binary-search bisection (moving half the candidate files to a scratch dir and rebuilding, ~9 iterations) rather than grep-guessing — use this technique first if a similar bulk MDX edit breaks the build with no filename in the error.

Nothing pending from this session — resumed cleanly from `.planning/HANDOFF.json` and `.planning/.continue-here.md`, both now retired as one-shot artifacts.

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
