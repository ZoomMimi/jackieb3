---
phase: 04-data-pipeline
fixed_at: 2026-07-18T15:12:00Z
review_path: .planning/phases/04-data-pipeline/04-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-07-18T15:12:00Z
**Source review:** .planning/phases/04-data-pipeline/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 7
- Skipped: 0

**Verification:** `node scripts/04-generate-stubs.mjs --dry-run` exits 0. `npm run build` exits 0, 77 non-draft pages built (draft stubs correctly excluded from output).

## Fixed Issues

### CR-01: draft: true Is Not in Content Schema — All Stubs Will Be Published

**Files modified:** `src/content.config.ts`, `src/pages/blog/index.astro`, `src/pages/blog/[...id].astro`
**Commit:** 5703118
**Applied fix:** Added `draft: z.boolean().default(false)` to the blog collection Zod schema between `migrated` and `lifted`. Changed both `getCollection('blog')` calls to `getCollection('blog', ({ data }) => !data.draft)` in the index and dynamic route templates so draft stubs are excluded from the build.

---

### CR-02: Hardcoded Machine-Local file:// Paths in All Generated Stubs

**Files modified:** `scripts/04-generate-stubs.mjs`
**Commit:** f1314fe
**Applied fix:** Added `PHOTOS_ROOT` constant derived from `process.env.PHOTOS_ROOT ?? join(process.env.HOME ?? '', 'Pictures/Photos Library.photoslibrary/originals')` after the path constants. Replaced the hardcoded `file:///Users/bruhnhome/...` string in the image map with `` `"file://${PHOTOS_ROOT}/${p.directory}/${p.filename}"` ``.

---

### WR-01: vsProps Emits miles={undefined} hours={undefined}

**Files modified:** `scripts/04-generate-stubs.mjs`
**Commit:** f16bb12
**Applied fix:** Tightened the `vsProps` ternary guard from `(day.nebo != null)` to `(day.nebo != null && fm.miles !== undefined && fm.hours !== undefined)` so the prop string is only emitted when both values are actually set.

---

### WR-02: parseFrontmatter Does Not Unescape \" — Progressive Corruption on Re-Runs

**Files modified:** `scripts/04-generate-stubs.mjs`
**Commit:** 66504ba
**Applied fix:** Added `.replace(/\\"/g, '"')` after `val.slice(1, -1)` in the quoted-string branch of `parseFrontmatter` so YAML escaped double-quotes are unescaped before storage, preventing `serializeFrontmatter` from re-escaping them on each run.

---

### WR-03: splitFrontmatter Finds --- Horizontal Rules in MDX Body

**Files modified:** `scripts/04-generate-stubs.mjs`
**Commit:** 509db06
**Applied fix:** Changed `indexOf('\n---', 3)` to `indexOf('\n---\n', 3)` in both `splitFrontmatter` and the backfill reconstruction path. The narrower pattern requires the closing `---` to be a bare line (terminated by `\n`), preventing a match against `---` horizontal rules or `---` with trailing content in the MDX body. The `+4` slice offset remains correct since both patterns give the same `fmEnd` position when a bare line is matched.

---

### WR-04: No Error Handling in Stub Generation Loop

**Files modified:** `scripts/04-generate-stubs.mjs`
**Commit:** e39146f
**Applied fix:** Added `const stubsFailed = []` before the stub loop. Wrapped the stub write block in a `try/catch` that logs `FAIL_STUB {filename}: {message}` and pushes to `stubsFailed` on error. Added `Stubs failed: ${stubsFailed.length}` to the summary output block.

---

### WR-05: existing.add(filename) Inside if(!DRY) — Dry-Run Misses Collision Detection

**Files modified:** `scripts/04-generate-stubs.mjs`
**Commit:** 98faa52
**Applied fix:** Moved `existing.add(filename)` (with updated comment) outside the `if (!DRY)` block to run unconditionally after the write-or-log decision. The call remains inside the `try` block so a failed write does not add the filename to the set. Dry-run and real mode now share identical collision-detection behavior.

---

_Fixed: 2026-07-18T15:12:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
