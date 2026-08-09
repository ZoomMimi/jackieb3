---
phase: 06-new-post-generation
plan: 04
subsystem: data-pipeline
tags: [astro, cloudflare-r2, osxphotos, sharp, aws-sdk-client-s3, gps-filter]

# Dependency graph
requires:
  - phase: 06-new-post-generation (plan 06-02)
    provides: "scripts/10-upload-r2.mjs (dry-run verified), provisioned R2 bucket + credentials"
provides:
  - "Env-gated draft preview path (PREVIEW_DRAFTS) across all six post-listing surfaces + scripts/check-draft-leak.mjs build-output assertion"
  - "scripts/10-upload-r2.mjs fixed for real-world use: --db flag bypassing a macOS TCC permission gate, plus a GPS-confirmation filter excluding date-only-matched photos with no confirmed location"
  - "Two fully R2-hosted, human-approved pilot posts proving the upload pipeline end to end"
  - "Measured per-file cost and a validated projection for the remaining ~1,638-file full run"
  - "Derivative-fallback decision for plan 06-05: do not use"
affects: [06-05-full-r2-upload, 06-06-narrative-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PREVIEW_DRAFTS env-gate predicate (!data.draft || import.meta.env.PREVIEW_DRAFTS === '1') applied identically across every post-enumerating surface, never process.env"
    - "Explicit --db path to osxphotos export, bypassing its default auto-discovery of the Photos.plist preferences file (a stricter TCC-gated resource than the Photos.sqlite database itself)"
    - "GPS-confirmation filter: cross-reference every Gallery UUID against photo-index.json before export/upload; exclude only entries with a photo-index record whose lat AND lon are both null; a UUID absent from the index entirely is not excluded (default-include for the unindexed edge case, not the common case)"

key-files:
  created:
    - scripts/check-draft-leak.mjs
  modified:
    - src/pages/blog/[...id].astro
    - src/pages/blog/index.astro
    - src/components/VoyageMap.astro
    - src/pages/index.astro
    - src/pages/voyages/great-loop/index.astro
    - src/pages/rss.xml.js
    - package.json
    - scripts/10-upload-r2.mjs
    - src/content/blog/great-loop/2024-04-13-day-723-florida-keys.mdx
    - src/content/blog/great-loop/2023-07-16-day-451-north-channel-on.mdx
    - .planning/data/r2-upload-report.json
    - .planning/data/phase6-verify.json

key-decisions:
  - "Derivative-fallback decision for the full run (plan 06-05): do NOT use --allow-derivative-fallback. The pilot's 100% export success rate (27/27 GPS-confirmed files, 0 missing exports) gave no evidence the flag is needed; the human's approval did not request it."
  - "GPS-confirmation filter excludes only UUIDs whose photo-index.json record has both lat and lon null — never UUIDs missing from the index entirely — because the null-GPS signal specifically flags date-only-matched entries that DO have an index record, not a missing-data case"
  - "osxphotos export now passes --db explicitly (same path convention as scripts/00-index-photos.mjs's PHOTOS_DB constant) instead of relying on auto-discovery, to work around a macOS TCC permission gate on the Photos.plist preferences file"

patterns-established:
  - "Local-preview-only env-gate: PREVIEW_DRAFTS=1, exposed via npm run dev:drafts, never set in netlify.toml/.env.example/CI"
  - "Build-output leak assertion (scripts/check-draft-leak.mjs) scanning all four generated listing surfaces, not just post-page count, for the phase-closing gate in plan 06-08"

requirements-completed: [POST-02, POST-03]

# Metrics
duration: 50min
completed: 2026-08-04
---

# Phase 6 Plan 4: Draft Preview Gate + R2 Pilot Upload Summary

**Env-gated draft preview across all six post-listing surfaces, plus a two-day R2 upload pilot that surfaced and fixed two real bugs — a macOS TCC permission gate and a GPS-confirmation gap that let 2 unrelated photos leak into a voyage-day gallery — before human-approving the corrected result for the full ~1,638-file run**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-04T08:05:00-04:00
- **Completed:** 2026-08-04T08:50:00-04:00
- **Tasks:** 3 (2 auto tasks + 1 human-verify checkpoint, re-presented once after a mid-checkpoint fix)
- **Files modified:** 12

## Accomplishments
- Added an env-gated draft preview path (`PREVIEW_DRAFTS=1`, via `npm run dev:drafts`) to all six surfaces that enumerate blog posts — closing a leak where the homepage Recent Posts, the voyage index, and the RSS feed had no draft filter at all and shipped all 322 posts including every draft stub.
- Built `scripts/check-draft-leak.mjs`, a build-output assertion scanning `dist/index.html`, `dist/blog/index.html`, `dist/voyages/great-loop/index.html`, and `dist/rss.xml` for any draft-post slug — the phase-closing gate plan 06-08 will reuse.
- Ran the R2 upload pilot for real on two voyage days (`2024-04-13-day-723-florida-keys`, `2023-07-16-day-451-north-channel-on`), fixing two bugs surfaced along the way (see Deviations), and got explicit human approval on the corrected result.
- Measured real per-file cost and produced a validated projection for the remaining full run, comfortably inside the 10 GB R2 free-tier ceiling.
- Recorded the derivative-fallback decision plan 06-05 needs: do not use it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add env-gated draft preview path across every post-listing surface** - `8d070cc` (feat)
2. **Task 2: Run the R2 upload pilot on two voyage days** - `d071016` (feat) — includes the `--db` TCC-permission fix, discovered and fixed mid-task since the script had never been exercised against real photos before this run
3. **Mid-checkpoint fix (Task 3 human-verify round 1 found a real defect)** - `816d1bf` (fix) — GPS-confirmation filter added to `scripts/10-upload-r2.mjs`; both pilot posts re-uploaded through the corrected script
4. **Task 3: Human-verify checkpoint** - resolved by the project owner (approved, no derivative-fallback request) after the round-1 defect was fixed and the corrected pilot re-presented; no additional code commit required for the checkpoint itself

**Plan metadata:** (this commit)

## Files Created/Modified
- `scripts/check-draft-leak.mjs` - Build-output draft-leak assertion across 4 listing surfaces
- `src/pages/blog/[...id].astro`, `src/pages/blog/index.astro`, `src/components/VoyageMap.astro`, `src/pages/index.astro`, `src/pages/voyages/great-loop/index.astro`, `src/pages/rss.xml.js` - `PREVIEW_DRAFTS` predicate added/extended on each
- `package.json` - `dev:drafts` and `check-draft-leak` npm scripts
- `scripts/10-upload-r2.mjs` - `--db` flag (TCC fix) + GPS-confirmation filter (`buildGpsLookup`/`isNoGpsExcluded`), plus report fields (`noGpsExcludedCount`, `noGpsExclusions`)
- `src/content/blog/great-loop/2024-04-13-day-723-florida-keys.mdx` - R2-hosted Gallery, 17 images (2 no-GPS excluded), `r2Uploaded: true`
- `src/content/blog/great-loop/2023-07-16-day-451-north-channel-on.mdx` - R2-hosted Gallery, 8 images + 2 videos (4 no-GPS excluded), `r2Uploaded: true`
- `.planning/data/r2-upload-report.json` - Corrected pilot run report
- `.planning/data/phase6-verify.json` - Refreshed verification snapshot (`R2_UPLOADED_POSTS=2`)

## Decisions Made

**Derivative-fallback decision (plan 06-05):** Do **not** use `--allow-derivative-fallback` for the full run. The corrected pilot achieved a 100% export success rate (27/27 GPS-confirmed files exported and uploaded on the first attempt, 0 missing exports, 0 fallbacks needed), and the project owner did not request the flag when approving. If the full run later hits real missing-export failures, that's a signal to revisit this decision with real failure data rather than pre-emptively trading resolution for coverage.

**Measured pilot cost and full-run projection:**

| Metric | Value |
|---|---|
| Pilot files uploaded (corrected, GPS-filtered) | 27 (17 images day 1, 8 images + 2 videos day 2) |
| Pilot bytes uploaded (corrected) | 14,951,416 bytes (~14.3 MB) |
| Measured bytes/file (cache-independent, from corrected run) | ~553,756 bytes/file |
| Measured seconds/file (cold-cache, from the original unfiltered pilot run before the GPS fix — used here rather than the corrected re-run's rate, which benefited from a warm iCloud cache left over from the first attempt and would understate real full-run duration) | ~3.24 s/file |
| Export success rate | 100% (27/27), 0 failed, 0 derivative fallbacks |
| Full-run scope after GPS filter | 1,665 files (1,545 images + 120 videos), down from 1,846 pre-filter |
| Remaining files for plan 06-05 | 1,638 (1,665 − 27 already uploaded) |
| Projected remaining time | ~5,307s ≈ 88 minutes (conservative, cold-cache rate) |
| Projected remaining bytes | ~907 MB |
| Projected full-run total bytes (incl. pilot) | ~922 MB — ~9% of the 10 GB R2 free-tier ceiling |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] osxphotos export failed with a macOS TCC permission error on its first real invocation**
- **Found during:** Task 2 (first real R2 upload attempt)
- **Issue:** `scripts/10-upload-r2.mjs` (built in plan 06-02) had never been exercised against real photos — its dry-run mode short-circuits before the osxphotos step, and plan 06-02's smoke test only uploaded a throwaway text file. The first real invocation failed: `osxphotos`'s default library auto-discovery reads `~/Library/Containers/com.apple.Photos/Data/Library/Preferences/com.apple.Photos.plist`, a macOS-protected resource gated by a stricter Full Disk Access TCC permission than the Photos.sqlite database itself, and the executing process didn't have it.
- **Fix:** Added an explicit `--db` flag pointing at the known Photos library path (matching `scripts/00-index-photos.mjs`'s existing `PHOTOS_DB` convention), bypassing the protected preferences read entirely and going straight to direct database access — confirmed working via a standalone test before patching the script.
- **Files modified:** `scripts/10-upload-r2.mjs`
- **Verification:** Both pilot posts uploaded successfully afterward (19+14 files, 33 total, 0 failures)
- **Committed in:** `d071016` (Task 2 commit)

### Found via human-verify checkpoint (not self-directed, but recorded here since it changed shipped code)

**2. [Named finding] GPS-unconfirmed photos leaking into voyage-day galleries**
- **Found during:** Task 3's first human-verify round — the project owner visually reviewed the pilot at the dev server and identified 2 of 19 photos on `2024-04-13-day-723-florida-keys` as visibly not Florida Keys photos.
- **Root cause:** The ~101 in-scope days were never manually curated — only 87 of 628 total voyage days are keys in `.planning/data/photo-selections.json` (the human photo-review tool's output). For uncurated days, `voyage-timeline-enriched.json`'s Gallery arrays come from calendar-date correlation alone (any photo taken that day, regardless of confirmed location), which can sweep in same-day photos with no GPS match. Both flagged photos were exactly the day's two `lat: null, lon: null` entries in `.planning/data/photo-index.json`.
- **Fix:** `scripts/10-upload-r2.mjs` now cross-references every Gallery UUID against `photo-index.json` before export/upload and default-excludes any UUID whose record has both `lat` and `lon` null. A UUID with no `photo-index.json` record at all is deliberately **not** excluded — the null-GPS signal specifically flags date-only-matched entries that *do* have an index record, not entries missing from the index. This matters because `scripts/00-index-photos.mjs` indexes videos identically to photos (`kind: 0` = photo, `kind: 1` = video, same lat/lon fields), so an unindexed UUID is a genuine edge case rather than the common video case — confirmed directly: both pilot videos already carried valid GPS in `photo-index.json` and were unaffected by the filter.
- **Scope check (independently re-verified, not just taken on faith):** A `--dry-run --force` pass across all 100 in-scope posts confirmed the investigation exactly — **57 of 100 posts** have at least one no-GPS photo, **181 no-GPS photos total**, **0 posts would go empty** (every affected day retains at least one GPS-confirmed photo). Post-filter, the full run covers 1,665 files (1,545 images + 120 videos) instead of 1,846.
- **Pilot correction:** Both pilot posts were re-run with `--force` through the corrected script. `2024-04-13-day-723-florida-keys` dropped from 19 to 17 images (excluded `F60A4DCB-19AD-45EF-AEC8-E616E8894F78`, `4BC3E293-713B-436C-9714-7E38B6B9FAAF`). `2023-07-16-day-451-north-channel-on` dropped from 12+2 to 8+2 (excluded `184B3472-5F91-4D80-ADC0-10C969A190F5`, `A318ADBD-2CE1-4B0C-966F-5C6EEE412BB8`, `23B09709-3D61-4664-9BEE-BC2C17D3469D`, `2844C36C-B26E-44CB-B8C3-AB2507411169` — none of the 6 excluded UUIDs across either post are videos). R2 objects already uploaded for the 6 excluded UUIDs were left unlinked in the bucket (not worth the cleanup complexity now, per the project owner's explicit call).
- **Follow-up (deliberately not built into this plan):** Barbara will separately use the existing `scripts/photo-viewer.mjs` tool to review the excluded no-GPS photos across all 57 affected in-scope days and manually add back any she recognizes as legitimate. This is a manual, editorial follow-up task for her, not tooling this plan needs to build.
- **Files modified:** `scripts/10-upload-r2.mjs`, `src/content/blog/great-loop/2024-04-13-day-723-florida-keys.mdx`, `src/content/blog/great-loop/2023-07-16-day-451-north-channel-on.mdx`
- **Verification:** All 27 corrected URLs return HTTP 200; `npm run build` passes; the dev server, re-checked after the fix, served the corrected galleries live with the excluded UUIDs confirmed absent from the rendered HTML
- **Committed in:** `816d1bf`

### .mov rendering note
The plan's checkpoint asked whether `.mov` entries (rendered through `Gallery.astro`'s `<img>` path, with no dedicated video player) behave acceptably or need different handling before the full run. No rendering issue was reported by the project owner in either approval round — both video entries in `2023-07-16-day-451-north-channel-on` were part of the approved, corrected pilot. No change to video handling is needed before plan 06-05.

---

**Total deviations:** 2 (1 auto-fixed blocking bug, 1 finding surfaced by the human-verify checkpoint and fixed in response). **Impact on plan:** Both were necessary corrections discovered by actually running the pipeline against real data for the first time — exactly what a pilot is for. No scope creep: the GPS filter is a targeted, well-scoped fix (excludes only records with a confirmed null-GPS signal) rather than a broader rework, and the follow-up review of excluded photos was explicitly deferred to Barbara rather than built into this plan.

## Issues Encountered

- This worktree's initial HEAD was 22 commits behind the orchestrator's intended base (`00f5a9397370abe4a7fe281479135db829daff66`) — the base commit object simply wasn't reachable in the worktree at spawn time (a stale-worktree issue, not a decision I second-guessed). Corrected with a safe, non-destructive `git fetch` from the main project checkout followed by `git reset --hard` to the confirmed-ancestor target, per the worktree-branch-check protocol, before any task work began. No commits were lost — the worktree branch had no commits beyond that ancestor.

## User Setup Required

None - no external service configuration required. (R2 bucket, credentials, and `.env` were already provisioned and smoke-tested in plan 06-02; this plan's `.env` copy into the worktree was routine, expected worktree setup, not new configuration.)

## Next Phase Readiness

- `npm run build` passes (77 pages, drafts correctly excluded) and `node scripts/verify-phase6.mjs` reports `R2_UPLOADED_POSTS=2`.
- Draft posts are previewable via `npm run dev:drafts`; production build is leak-free on all four checked surfaces (`DRAFT_LEAKS=0`).
- `scripts/10-upload-r2.mjs` is now proven against real photos, real iCloud downloads, real R2 uploads, and a real human visual review — including two bugs it would otherwise have carried silently into the full 1,638-file run in plan 06-05.
- Plan 06-05 should run **without** `--allow-derivative-fallback`, per the approved decision above, and can expect ~88 minutes / ~907 MB for the remaining files based on measured pilot data.
- No blockers. Ready for plan 06-05 (full R2 upload) and, after that, plan 06-06 (narrative generation).

---
*Phase: 06-new-post-generation*
*Completed: 2026-08-04*
