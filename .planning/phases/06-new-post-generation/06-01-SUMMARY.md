---
phase: 06-new-post-generation
plan: 01
subsystem: data-pipeline
tags: [astro, zod, node, aws-sdk-client-s3, mdx, content-collections]

# Dependency graph
requires:
  - phase: 04-data-pipeline
    provides: scripts/04-generate-stubs.mjs, voyage-timeline-enriched.json, the frontmatter round-trip helper convention
provides:
  - scripts/verify-phase6.mjs — scoped, gate-driven Phase-6 completion reporting
  - FORCE_STUB_DATES allow-list in scripts/04-generate-stubs.mjs
  - r2Uploaded/narrativeDrafted schema flags and their npm-script/env-var contracts
  - 40 new draft:true MDX stubs completing in-scope date coverage to 100/101
affects: [06-02-r2-triage, 06-03, 06-04-pilot-render-verify, 06-05-full-r2-upload, 06-06-narrative-generation, 06-07-bulk-narratives, 06-08-final-publish]

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-s3 ^3.1095.0"]
  patterns:
    - "Scoped verification script (in-scope date set derived from src/data/daily-routes.json, never a repo-wide grep) to avoid false-positives against out-of-scope draft stubs"
    - "Curated date allow-list bypassing a general-purpose filter, rather than lowering the filter's global threshold"

key-files:
  created:
    - scripts/verify-phase6.mjs
    - .env.example
    - .planning/data/phase6-verify.json
  modified:
    - package.json
    - package-lock.json
    - src/content.config.ts
    - scripts/04-generate-stubs.mjs
    - src/content/blog/great-loop/*.mdx (40 new files)

key-decisions:
  - "verify-phase6.mjs derives the in-scope date set from src/data/daily-routes.json (569 total keys), not a hardcoded list, so it stays correct if daily-routes.json is ever regenerated"
  - "FORCE_STUB_DATES is a 40-entry allow-list bypassing day.photoCount < 10 only for those dates; the global threshold line is untouched, preventing ~187 out-of-scope stubs from being generated"
  - "phase6-verify.json is committed each time the script runs (mirrors the existing quality-lift-report.json pattern already tracked in .planning/data/) — only the generated timestamp changes between runs"

patterns-established:
  - "Pattern 1 from 06-RESEARCH.md (scoped stub generation via allow-list) applied verbatim"
  - "verify-phase6.mjs's KEY=<n> stdout contract and --gate <name> exit-code convention is the interface plans 06-02 through 06-08 grep against"

requirements-completed: [POST-01, POST-02]

# Metrics
duration: 43min
completed: 2026-07-26
---

# Phase 6 Plan 1: Verification Tooling, Schema/Env Contracts, and Missing Stub Generation Summary

**Scoped `verify-phase6.mjs` reporting tool, `@aws-sdk/client-s3` + r2Uploaded/narrativeDrafted schema flags, and 40 new draft MDX stubs bringing in-scope Phase 6 post coverage from 60/101 to 100/101 days**

## Performance

- **Duration:** 43 min
- **Started:** 2026-07-26T11:45:58-04:00
- **Completed:** 2026-07-26T12:28:26-04:00
- **Tasks:** 3
- **Files modified:** 45 (package.json, package-lock.json, .env.example, src/content.config.ts, scripts/verify-phase6.mjs, scripts/04-generate-stubs.mjs, .planning/data/phase6-verify.json, 40 new MDX stubs)

## Accomplishments
- Built `scripts/verify-phase6.mjs`: a scoped completion-reporting tool that derives the 101-date in-scope set directly from `src/data/daily-routes.json`, reports 8 machine-greppable `KEY=<n>` counters, and supports `--gate posts|no-file-urls|no-drafts` with correct exit codes — the automated verification interface every downstream Phase 6 plan gates on.
- Root-caused-and-fixed the missing-stub gap: added a 40-entry `FORCE_STUB_DATES` allow-list to `scripts/04-generate-stubs.mjs` that bypasses the `photoCount < 10` filter for exactly the named dates, leaving the general-purpose threshold untouched.
- Ran the generator for real, producing 40 new `draft: true` MDX stubs (9 Keys→New Bern, 31 Canada side trip) in the same `file://...heic` Gallery shape as the existing 250 stubs — exactly the input format `scripts/10-upload-r2.mjs` (plan 06-02) will parse.
- Established the schema/env/npm-script contracts every later Phase 6 script depends on: `@aws-sdk/client-s3` installed, `r2Uploaded`/`narrativeDrafted` added to the blog collection Zod schema, `.env.example` documenting all six env-var names, and three new npm scripts (`verify-phase6`, `upload-r2`, `draft-narratives`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Establish dependency, env, npm-script, and schema contracts** - `763cb7a` (feat)
2. **Task 2: Create the scoped Phase-6 verification script** - `ba0ce72` (feat)
3. **Task 3: Generate the 40 missing in-scope stubs** - `35a2915` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `scripts/verify-phase6.mjs` - Scoped Phase-6 verification: 8 KEY=<n> counters, 3 exit-code gates, JSON report writer
- `.env.example` - Documents ANTHROPIC_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE (names only, no values)
- `src/content.config.ts` - Added `r2Uploaded`/`narrativeDrafted` optional boolean flags to the blog collection schema, after `lifted`
- `package.json` / `package-lock.json` - Added `@aws-sdk/client-s3` dependency; added `verify-phase6`/`upload-r2`/`draft-narratives` npm scripts
- `scripts/04-generate-stubs.mjs` - Added `FORCE_STUB_DATES` Set (40 entries) and updated the Job 2 photo-count guard to check it
- `src/content/blog/great-loop/*.mdx` - 40 new draft stub files (see commit `35a2915` for the full list)
- `.planning/data/phase6-verify.json` - Machine-readable verification report, regenerated on each script run

## Decisions Made
- In-scope date derivation reads `src/data/daily-routes.json` keys filtered by the two date ranges (string comparison on ISO dates), not a hardcoded 101-date list — matches the plan's `<interfaces>` contract and stays correct if the underlying data pipeline output changes shape.
- Report JSON (`phase6-verify.json`) is committed as tracked data, consistent with the existing `.planning/data/*.json` convention (e.g. `quality-lift-report.json`) already in this repo.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The worktree's initial HEAD was one commit behind the expected base (`3db8809af9`, the "phase 6 planned" STATE.md commit) — corrected with a safe fast-forward `git reset --hard` per the worktree-branch-check protocol before any task work began; no commits were lost since the worktree branch had no commits beyond that ancestor.

## User Setup Required

None - no external service configuration required. (R2 bucket provisioning and API token generation are deferred to plan 06-02 per the plan's `user_setup: []` frontmatter.)

## Next Phase Readiness
- `scripts/verify-phase6.mjs` is live and gates green: `GATE_PASS posts`, `IN_SCOPE_DATES=101`, `KNOWN_GAPS=1`, `MISSING_POSTS=0`, `IN_SCOPE_POSTS=100`.
- All 100 in-scope days with photo data now have a stub; `2023-08-09` remains the documented photoCount-0 gap with no stub possible.
- `r2Uploaded`/`narrativeDrafted` schema flags, the `upload-r2`/`draft-narratives` npm-script entry points, and `.env.example`'s six variable names are in place for plan 06-02 to build `scripts/10-upload-r2.mjs` against.
- `npm run build` is green (77 pages built, drafts correctly excluded from output).
- No blockers. Ready for plan 06-02 (R2 pipeline + triage).

---
*Phase: 06-new-post-generation*
*Completed: 2026-07-26*
