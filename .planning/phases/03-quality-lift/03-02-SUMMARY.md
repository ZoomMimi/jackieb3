---
phase: 03-quality-lift
plan: "02"
subsystem: content-pipeline
tags: [node-script, anthropic-sdk, quality-lift, nebo, voyage-stats, mdx]

requires:
  - phase: 03-quality-lift
    plan: "01"
    provides: "VoyageStats.astro component and lifted: boolean schema field"

provides:
  - "scripts/07-quality-lift.mjs: 314-line ESM batch quality-lift script"
  - "package.json quality-lift npm script entry"
  - "Idempotent post-processing pipeline: lifted: true gate, coverPhoto auto-select, VoyageStats footer"

affects:
  - "src/content/blog/great-loop/*.mdx — script rewrites all 72 posts when run"
  - "03-03 (location enrichment layer) builds on lifted: true posts"

tech-stack:
  added: []
  patterns:
    - "Hand-parsed YAML frontmatter (no heavy yaml dep) consistent with established scripts"
    - "nebo-logs.json Map keyed by date with ±7-day fallback for multi-day posts"
    - "Per-post try/catch with skip-and-log (D-04); continues on API failure"

key-files:
  created:
    - scripts/07-quality-lift.mjs
    - .planning/data/quality-lift-report.json
  modified:
    - package.json

key-decisions:
  - "API key guard: exits 1 with clear message when ANTHROPIC_API_KEY missing — never hardcoded"
  - "VoyageStats import injected as first line of MDX body (component resolves at MDX render time)"
  - "±7-day fallback for nebo-log matching covers multi-day posts like Days 4-9"
  - "Report written regardless of partial failures so re-runs know what to retry"
  - "coverPhoto set only if not already present (safe for Barbara's manual overrides)"

requirements-completed: [QLFT-01, QLFT-02]

duration: 8min
completed: 2026-07-08
---

# Phase 3 Plan 02: Quality-Lift Script Summary

**314-line ESM batch script using @anthropic-ai/sdk to convert all 72 Blogger HTML posts to clean Markdown with VoyageStats footers; npm script entry added; idempotent and re-runnable**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-08T10:22:00Z
- **Completed:** 2026-07-08T10:30:00Z
- **Tasks:** 2
- **Files created/modified:** 3

## Accomplishments

- Created `scripts/07-quality-lift.mjs` (314 lines, >80-line minimum met) using `@anthropic-ai/sdk`
- Script reads API key from `process.env.ANTHROPIC_API_KEY` and exits 1 with a clear message if missing — no hardcoded key
- Idempotency gate: skips posts with `lifted: true` in frontmatter (D-03)
- Auto-selects `coverPhoto` from first `<img src>` URL in raw Blogger HTML body (D-09)
- Matches nebo-logs by post date with ±7-day fallback for multi-day posts (D-06)
- Appends `import VoyageStats ...` as first line of MDX body, `<VoyageStats miles={} hours={} />` as footer
- Per-post try/catch: logs `FAIL <slug>: <msg>` and continues; writes `.planning/data/quality-lift-report.json`
- Added `"quality-lift": "node scripts/07-quality-lift.mjs"` to `package.json` scripts
- `npm run build` exits 0 throughout (77 pages, schema is backward-compatible)
- Placeholder `quality-lift-report.json` committed documenting pending run

## Task Commits

1. **Task 1: Write the batch quality-lift script core** - `aedc7df` (feat)
2. **Task 2: Run the lift + verify build** - `1af9eb8` (chore — pending run documented)

## Files Created/Modified

- `scripts/07-quality-lift.mjs` — 314-line ESM quality-lift script; Claude API + nebo-log integration
- `package.json` — added `"quality-lift"` npm script entry
- `.planning/data/quality-lift-report.json` — placeholder report documenting pending run

## Deviations from Plan

### Script Run Not Executed — ANTHROPIC_API_KEY Absent

**Rule applied:** None (documented auth gate per context notes)

**Situation:** `ANTHROPIC_API_KEY` was not set in the executor environment. The context notes for this plan explicitly state:

> "If the key is absent the execute-plan flow surfaces an auth checkpoint."
> "Do NOT halt execution — create the script artifact regardless."

**What was done:**
- Script created and fully verified: `node --check` passes, no hardcoded key, idempotency gate present, VoyageStats injection present
- Script attempted to run: exits 1 with `ERROR: ANTHROPIC_API_KEY environment variable is not set.`
- Placeholder `quality-lift-report.json` committed (status: pending)
- `npm run build` confirmed exits 0 (posts remain with Blogger HTML but build is clean — schema defaults handle missing `lifted` field)

**Action required by user:**
```bash
export ANTHROPIC_API_KEY="your-key-from-console.anthropic.com"
npm run quality-lift
```
Re-run is idempotent — already-lifted posts are skipped. If any posts fail, re-run the script again.

## User Setup Required

**REQUIRED before posts are quality-lifted:**

1. Get API key: https://console.anthropic.com → Settings → API Keys
2. Run the script:
   ```bash
   ANTHROPIC_API_KEY=<your-key> npm run quality-lift
   ```
3. After the run, verify:
   - `.planning/data/quality-lift-report.json` shows `processed: 72` (or close)
   - `grep -rl "lifted: true" src/content/blog/great-loop/*.mdx | wc -l` returns 72
   - `npm run build` exits 0

## Known Stubs

- **All 72 MDX posts:** Bodies remain as raw Blogger HTML. `lifted: false` (schema default). Awaiting API key to run `npm run quality-lift`.
- **`.planning/data/quality-lift-report.json`:** Status field is `"pending"` — will be overwritten by the actual run.

## Threat Flags

No new threat surface introduced. API key accessed only from environment variable — not from filesystem, git-tracked files, or network. Verified: `grep -qE "sk-ant-"` returns no match across the script.

## Self-Check

- [x] `scripts/07-quality-lift.mjs` exists — FOUND
- [x] `package.json` has `quality-lift` entry — FOUND (`grep -q '"quality-lift"' package.json`)
- [x] `.planning/data/quality-lift-report.json` exists — FOUND
- [x] `node --check scripts/07-quality-lift.mjs` — PASS
- [x] No hardcoded API key — PASS (`grep -qE "sk-ant-"` returns exit 1)
- [x] `npm run build` exits 0 — PASS (77 pages built)
- [x] Commits exist: `aedc7df` (feat script), `1af9eb8` (chore report)

## Self-Check: PASSED

---
*Phase: 03-quality-lift*
*Completed: 2026-07-08*
