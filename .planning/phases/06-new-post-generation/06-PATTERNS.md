# Phase 6: New Post Generation - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 5 (2 modified/extended scripts, 2 new scripts, ~101 MDX files modified in bulk via script)
**Analogs found:** 5 / 5 (script-level); 0 / 1 for R2 S3-client auth (no analog in this codebase — external pattern from RESEARCH.md required)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/04-generate-stubs.mjs` (EXTEND) | utility (batch script) | CRUD (file read → transform → write) | itself (existing file, extend in place) | exact |
| `scripts/10-upload-r2.mjs` (NEW) | service (batch script) | file-I/O + event-driven (external CLI + cloud API calls) | `scripts/00-index-photos.mjs` (Photos-library/osxphotos access) + `scripts/07-quality-lift.mjs` (idempotency-flag + report.json pattern) | role-match (composite of two analogs) |
| `scripts/11-draft-narratives.mjs` (NEW) | service (batch script, Claude API) | request-response (multimodal API call) + CRUD (MDX rewrite) | `scripts/07-quality-lift.mjs` (Claude API call, MDX frontmatter round-trip) | exact |
| `src/content/blog/great-loop/*.mdx` (bulk-modified by scripts, not hand-edited) | content/data (MDX + frontmatter) | CRUD (Gallery-array rewrite, draft flip, narrative insertion) | `2024-04-13-day-723-florida-keys.mdx` (draft stub shape) + `2024-02-23-boca-chica-vogelzaangs-days-254-258.mdx` (target narrative voice/verse shape) | exact |
| `.planning/data/r2-upload-report.json` / `narrative-triage.json` (NEW output artifacts) | config/report (JSON) | batch | `.planning/data/quality-lift-report.json` (produced by `07-quality-lift.mjs`) | exact |

**Unchanged reference components** (read but not modified — confirmed compatible as-is, no pattern extraction needed beyond confirming their prop contracts): `src/components/Gallery.astro`, `src/components/Lightbox.astro`, `src/components/VoyageStats.astro`, `src/layouts/BlogPost.astro`, `src/content.config.ts`.

## Pattern Assignments

### `scripts/04-generate-stubs.mjs` (utility, CRUD) — EXTEND

**Analog:** itself — this is a targeted extension of existing Job 2 logic, not a new file.

**Exact insertion point** (`scripts/04-generate-stubs.mjs` lines 269-271):
```javascript
for (const day of timelineRaw.days) {
  // D-01/D-02: skip if fewer than 10 photos
  if (day.photoCount < 10) continue;
```

**Required change (Pattern 1 from RESEARCH.md, confirmed against actual code):** Add a date allow-list check immediately above the existing `photoCount < 10` guard so the general-purpose filter is untouched for any future full-timeline re-run, and only the 40 named dates bypass it:
```javascript
const FORCE_STUB_DATES = new Set([
  '2024-04-14', '2024-04-15', '2024-04-23', '2024-04-29', '2024-05-03',
  '2024-05-08', '2024-05-09', '2024-05-10', '2024-05-14',
  '2023-06-06', '2023-06-08', '2023-06-11', '2023-06-12', '2023-06-13',
  '2023-06-15', '2023-06-17', '2023-06-20', '2023-06-22', '2023-06-25',
  '2023-06-26', '2023-06-28', '2023-06-29', '2023-07-05', '2023-07-11',
  '2023-07-15', '2023-07-23', '2023-07-30', '2023-08-01', '2023-08-04',
  '2023-08-06', '2023-08-10', '2023-08-12', '2023-08-13', '2023-08-16',
  '2023-08-19', '2023-08-21', '2023-08-22', '2023-08-23', '2023-08-28',
  '2023-08-29',
]);

for (const day of timelineRaw.days) {
  if (day.photoCount < 10 && !FORCE_STUB_DATES.has(day.date)) continue;
  // ...existing date-range guard, slug-building, conflict guards, frontmatter/body build unchanged...
}
```
Everything downstream of this line (slug/filename construction lines 276-301, frontmatter object build lines 303-319, body/Gallery-array build lines 321-343, write + collision-tracking lines 345-359) is reused **unmodified** — the 40 missing stubs must come out in exactly the same `file://...heic` Gallery-array shape as the 250 existing stubs (confirmed via `2024-04-13-day-723-florida-keys.mdx`, see below), so the R2 upload script has a single consistent input format to rewrite.

**Frontmatter field-order convention** (lines 304-319, confirmed against `content.config.ts` schema and live stub file): `title, date, voyage, location, excerpt, migrated, draft`, then conditionally `lat, lon, miles, hours`. Do not reorder — `serializeFrontmatter` preserves insertion order and downstream scripts/humans expect this order (see the live stub example below).

**Live example of Job 2's current output shape** (`src/content/blog/great-loop/2024-04-13-day-723-florida-keys.mdx`, full file, 38 lines):
```yaml
---
title: Day 723 — Florida Keys
date: 2024-04-13
voyage: great-loop
location: Florida Keys
excerpt: Photos from Florida Keys
migrated: false
draft: true
lat: 25.1326
lon: -80.3991
---

import VoyageStats from '../../../components/VoyageStats.astro'
import Gallery from '../../../components/Gallery.astro'

<VoyageStats  />

<Gallery images={[
    "file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/F/F60A4DCB-19AD-45EF-AEC8-E616E8894F78.heic",
    ...
  ]} />
```
This is the exact shape the 40 new stubs must match, and the exact shape `scripts/10-upload-r2.mjs` must parse (extract UUIDs from `file://.../originals/{dir}/{UUID}.{ext}` paths) and rewrite in place.

---

### `scripts/10-upload-r2.mjs` (NEW — service, file-I/O + event-driven)

**Primary analog:** `scripts/00-index-photos.mjs` (Photos-library access pattern) + `scripts/07-quality-lift.mjs` (idempotency/report pattern). No existing script in this codebase does `osxphotos export` or any cloud upload — this is genuinely new territory, composited from two analogs plus RESEARCH.md's verified external-API patterns.

**Header/config pattern to copy** (`scripts/00-index-photos.mjs` lines 1-33):
```javascript
#!/usr/bin/env node
/**
 * scripts/10-upload-r2.mjs
 * ...doc comment describing pipeline stage, inputs, outputs, usage...
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const DATA_DIR  = join(ROOT, '.planning', 'data');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
```

**Lazy credential-guard pattern to copy** (`scripts/07-quality-lift.mjs` lines 49-63 — `getClient()`): apply the identical shape for R2 credentials, since this script also needs `ANTHROPIC_API_KEY`-style fail-fast behavior for `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`:
```javascript
let _r2Client = null;
function getR2Client() {
  if (_r2Client) return _r2Client;
  for (const v of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
    if (!process.env[v]) {
      console.error(`ERROR: ${v} environment variable is not set.`);
      console.error('  Export it before running, or add to .env / .env.production (already gitignored).');
      process.exit(1);
    }
  }
  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _r2Client;
}
```
(This exact `S3Client`/`PutObjectCommand` shape is verified in RESEARCH.md Pattern 4, sourced from Cloudflare's own S3-compatible API docs — no in-repo analog exists for cloud-storage auth, so RESEARCH.md is the authoritative source here, not codebase precedent.)

**Frontmatter round-trip helpers to copy verbatim:** `splitFrontmatter`, `parseFrontmatter`, `serializeFrontmatter` — identical in both `scripts/04-generate-stubs.mjs` (lines 49-101) and `scripts/07-quality-lift.mjs` (lines 100-152), byte-for-byte except one line (04's `splitFrontmatter` requires bare `\n---\n`; 07's uses `\n---` without trailing `\n` — **04's version is stricter and safer**, prefer copying from `scripts/04-generate-stubs.mjs` lines 49-56). This script needs the same three functions to read each in-scope stub's `file://` Gallery array and rewrite it with R2 URLs.

**Idempotency-flag + partial-failure-safe rewrite pattern to copy** (`scripts/07-quality-lift.mjs` lines 354-359 idempotency gate style, combined with Pitfall 4's "all-or-nothing per-post commit" requirement from RESEARCH.md):
```javascript
// Idempotency gate (mirrors `fm.lifted === true` check in 07-quality-lift.mjs)
if (fm.r2Uploaded === true) {
  console.log(`SKIP  ${slug} (already uploaded)`);
  skipped.push(slug);
  continue;
}

try {
  // ...osxphotos export --uuid ... --convert-to-jpeg, sharp resize, R2 PutObjectCommand
  // per-photo, collecting all resulting URLs into a local array first...
  if (allPhotosUploaded) {
    fm.r2Uploaded = true;               // only set after full success (Pitfall 4)
    // rewrite Gallery array in body using the collected R2 URLs, same
    // string-replace-block approach as scripts/04-generate-stubs.mjs's imageList build
  }
} catch (err) {
  console.log(`FAIL`);
  console.error(`  FAIL  ${slug}: ${err.message}`);
  failed.push({ slug, error: err.message });
  // do NOT partially rewrite the Gallery array — leave file:// URLs intact for retry
}
```

**osxphotos export invocation** (RESEARCH.md Pattern 2, verified against `osxphotos export --help` on this machine — use `node:child_process` `execFileSync`/`spawnSync`, not `exec`, to avoid shell-injection risk with UUID lists):
```bash
osxphotos export /tmp/r2-staging --uuid <uuid1> --uuid <uuid2> --convert-to-jpeg --jpeg-quality 1.0 --current-name
```

**sharp resize step** (RESEARCH.md Pattern 3, `sharp` already a project dependency):
```javascript
import sharp from 'sharp';
await sharp(inputJpegPath)
  .resize({ width: 1600, withoutEnlargement: true })
  .jpeg({ quality: 80 })
  .toFile(outputPath);
```

**Report-writing pattern to copy** (`scripts/07-quality-lift.mjs` lines 420-443 — `report` object + `writeFileSync(join(DATA_DIR, '...-report.json'), ...)`): produce `.planning/data/r2-upload-report.json` with the same `{generated, durationSeconds, summary: {...}, processed, skipped, failed}` shape.

---

### `scripts/11-draft-narratives.mjs` (NEW — service, request-response + CRUD)

**Analog:** `scripts/07-quality-lift.mjs` (Claude API call, `getClient()` pattern, MDX round-trip) — near-exact match; this script is structurally the closest thing to an existing "narrative generation" script in the repo, even though its prompt content is new.

**Client-init pattern to copy verbatim** (`scripts/07-quality-lift.mjs` lines 39, 52-63):
```javascript
import Anthropic from '@anthropic-ai/sdk';

let _client = null;
function getClient() {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('  Export it before running:  export ANTHROPIC_API_KEY="<your-key>"');
    process.exit(1);
  }
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}
```

**API-call function shape to copy** (`scripts/07-quality-lift.mjs` lines 216-236 — `liftPost`), extended per RESEARCH.md Pattern 5 to add multimodal `type: "url"` image blocks before the text block (image-then-text ordering per Anthropic docs):
```javascript
async function draftNarrative({ dateStr, location, miles, hours, legs, photoUrls, styleExcerpts }) {
  const content = [];
  for (const url of photoUrls) {  // ≤20 per RESEARCH.md Pattern 5 / Assumption A3
    content.push({ type: 'image', source: { type: 'url', url } });
  }
  content.push({ type: 'text', text: buildPromptText({ dateStr, location, miles, hours, legs }) });

  const msg = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: NARRATIVE_SYSTEM_PROMPT,   // includes 2-3 style excerpts, per D-08/canonical_refs
    messages: [{ role: 'user', content }],
  });

  const block = msg.content.find(b => b.type === 'text');
  if (!block) throw new Error('No text block in Claude response');
  return block.text.trim();
}
```

**Nebo `legs` data shape to consume** (from `scripts/09-parse-nebo-details.mjs`, output written into `.planning/data/nebo-logs.json`'s `legs` array; verified fields, lines 107-124 of that script):
```javascript
{
  routeName, commenced, completed,
  weatherDeparture: { temp, unit, windKn, windDir } /* or null */,
  weatherArrival:   { temp, unit, windKn, windDir } /* or null */,
  icwMarkers: [Number, ...],
  landmarks: [String, ...],
  namedStops: { started, departed, arrived: [...], stopped },
  weatherReadings: [...],
  positions: [[lat, lon], ...],
}
```
`nebo-logs.json` top-level shape is `Array<{date, pdfUuid, raw, legs}>` (confirmed by direct inspection) — build a `Map` keyed by `date` exactly like `scripts/07-quality-lift.mjs`'s `neboByDate` (lines 65-79), reusing its `findNeboEntry`-style ±7-day fallback (lines 169-184) if an exact date match isn't found, since Nebo PDF dates don't always align 1:1 with photo/post dates.

**MDX frontmatter/body round-trip:** reuse `splitFrontmatter`/`parseFrontmatter`/`serializeFrontmatter` exactly as in `scripts/04-generate-stubs.mjs` (see above) — read the stub written by the R2-upload-updated file, insert narrative text into the body (after the `VoyageStats`/`Gallery` imports, before or interleaved with the existing `<Gallery>` block per Barbara's established post structure — see `2024-02-23-boca-chica-vogelzaangs-days-254-258.mdx` below for target shape), and **do not flip `draft: true` → `false`** (that's D-10, Barbara's manual action) — only write the narrative body text.

**Triage-list-first pattern (D-07):** no direct in-repo analog for a "present list, wait for adjustment, then proceed" script flow. Closest structural precedent is `scripts/05-assess-photos.mjs`'s report-then-act two-phase design (not fully read this session, but its existence confirms the project's convention of writing an intermediate `.json` report for human review before a downstream script consumes it — same as this phase's planned `.planning/data/narrative-triage.json`). Recommend: `scripts/11-draft-narratives.mjs --triage-only` writes `narrative-triage.json` and exits; a second invocation (`--generate`) reads that file (post-edit) and proceeds to Claude calls — mirrors the `--dry-run` flag convention already used in `scripts/04-generate-stubs.mjs` (line 40) and `scripts/07-quality-lift.mjs`'s enrichment-pass idempotency gating.

---

### `src/content/blog/great-loop/*.mdx` (bulk content mutation — NOT hand-authored, produced by scripts above)

**Analog for target narrative shape (voice, structure, closing verse):** `src/content/blog/great-loop/2024-02-23-boca-chica-vogelzaangs-days-254-258.mdx` (migrated: true, full narrative) and `src/content/blog/great-loop/2022-04-22-the-adventure-begins.mdx` (migrated: true, first published post).

**Closing Bible verse format** (exact quote-then-citation shape to prompt for, confirmed from two independent published posts):
```markdown
"He makes grass grow for the cattle, and plants for people to cultivate— bringing forth food from the earth: wine that gladdens human hearts, oil to make their faces shine, and bread that sustains their hearts."
Psalms 104:14-15 NIV

<VoyageStats miles={67.5} hours={4.6} />
```
and
```markdown
"The heavens declare the glory of God; the skies proclaim the work of his hands."
Psalms 19:1 NIV
```
Pattern: quoted verse text on its own line, immediately followed (next line, no blank line between) by `Book Chapter:verse TRANSLATION` — appears near the end of the post, typically right before the `<VoyageStats />` footer.

**Voice/style excerpt** (`2024-02-23-boca-chica-vogelzaangs-days-254-258.mdx`, first-person warm/conversational tone with specific names/places, confirmed):
```markdown
Our next set of visitors came from Michigan. Cindy and John were up for anything so that's what we did!

Their first day was a rainy day but that didn't stop us. We had breakfast at Blue Heaven. It was once
a bordello then a boxing venue where matches were occasionally refereed by Ernest Hemingway...
```

**Frontmatter target state after this phase** for each of the ~101 in-scope posts: `draft` stays `true` until Barbara manually flips it (D-10) — narrative-generation script must NOT touch `draft`. New/changed frontmatter fields the pipeline should add: `r2Uploaded: true` (10-upload-r2.mjs, new flag, no existing precedent — model it on `enriched`/`lifted` boolean flags already in the Zod schema pattern) — **note:** `r2Uploaded` is not yet in `src/content.config.ts`'s Zod schema; the planner must add it there (optional boolean, default false) alongside the existing `lifted`/`migrated`/`draft` booleans, or Astro's build-time validation will reject it as an unknown key... actually Zod's default `.object()` strips unknown keys silently rather than erroring (non-strict mode) — confirm this doesn't silently drop the flag on next parse; safest to add it explicitly to the schema.

**Gallery-array rewrite target:** `file:///Users/.../originals/{dir}/{UUID}.{heic|png|mov}` → `https://pub-<hash>.r2.dev/great-loop/{date}/{filename}.{jpg|mov}`, same array-literal structure, same `Gallery.astro`/`Lightbox.astro` consumption (no component changes needed — confirmed `Gallery.astro`'s `images: string[]` prop and `Lightbox.astro`'s `.post-body img` click-handler both work against any `src` URL scheme, R2 or Blogger; **one nuance**: `Lightbox.astro`'s `largerSrc()` regex (line 17-20) only rewrites Blogger's `/w400/`-style size segments to `/w1600/` — it will silently no-op on R2 URLs, which is fine since R2-hosted images are already served at the D-03 target size (1600px), no "click for larger" upgrade needed or expected for R2 photos).

---

## Shared Patterns

### Idempotency flag + partial-failure isolation
**Source:** `scripts/07-quality-lift.mjs` lines 354-359 (`fm.lifted === true` gate), lines 265-270 (`fm.enriched === true` gate), Pitfall 4 in RESEARCH.md
**Apply to:** `scripts/10-upload-r2.mjs` (`r2Uploaded` flag), `scripts/11-draft-narratives.mjs` (consider a `narrativeDrafted` flag so re-running doesn't overwrite Barbara's in-progress edits — **important**: unlike `lifted`/`enriched`, this flag must NOT cause the script to skip a post Barbara is actively editing; recommend gating on presence of a specific marker like an empty/placeholder narrative body rather than a boolean, or simply document that the script should never be re-run against a post once Barbara has started editing it — a planning-time decision, not fully resolved by codebase precedent).
```javascript
if (fm.someFlag === true) { console.log(`SKIP ${slug} (already done)`); skipped.push(slug); continue; }
```

### Frontmatter split/parse/serialize round-trip
**Source:** `scripts/04-generate-stubs.mjs` lines 49-101 (preferred — stricter `\n---\n` boundary check) / `scripts/07-quality-lift.mjs` lines 100-152 (near-identical, slightly looser)
**Apply to:** All three scripts touching MDX files (`04-generate-stubs.mjs` extension, `10-upload-r2.mjs`, `11-draft-narratives.mjs`) — copy these three functions verbatim into each new script (no shared-utils module exists in this codebase; every script duplicates this trio rather than importing a common file — follow that established convention, do not introduce a new shared module for this phase).

### Lazy fail-fast credential guard
**Source:** `scripts/07-quality-lift.mjs` lines 49-63 (`getClient()`)
**Apply to:** `scripts/10-upload-r2.mjs` (R2 credentials), `scripts/11-draft-narratives.mjs` (reuse `ANTHROPIC_API_KEY` guard verbatim)

### Per-script `--dry-run` flag + run-report JSON
**Source:** `scripts/04-generate-stubs.mjs` line 40 (`DRY` flag), `scripts/07-quality-lift.mjs` lines 420-443 (report object + `writeFileSync` to `.planning/data/*-report.json`)
**Apply to:** `scripts/10-upload-r2.mjs` → `.planning/data/r2-upload-report.json`; `scripts/11-draft-narratives.mjs` → `.planning/data/narrative-triage.json` (triage phase) and could append a `narrative-draft-report.json` (generation phase) following the same `{generated, durationSeconds, summary, processed, skipped, failed}` shape.

### Date-keyed Map lookups against timeline/nebo data
**Source:** `scripts/07-quality-lift.mjs` lines 65-92 (`neboByDate`, `timelineByDate` construction from `.planning/data/nebo-logs.json` / `voyage-timeline-enriched.json`), lines 169-184 (`findNeboEntry`'s ±7-day fallback)
**Apply to:** `scripts/11-draft-narratives.mjs`'s lookup of `legs` detail per in-scope date — build a `Map<date, legsEntry>` the same way; use the ±N-day fallback only if exact-date lookup misses (uncommon for the daily-stub case since these dates are 1:1 by construction, unlike the multi-day migrated-post case `findNeboEntry` was built for).

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| R2 (`@aws-sdk/client-s3`) auth/upload client construction | service | event-driven (cloud API) | No prior cloud-storage integration exists in this codebase — only local file I/O (`node:fs`) and one external API (`@anthropic-ai/sdk`) have precedent. Use RESEARCH.md Pattern 4 (verified against Cloudflare's own S3-compatible API docs) as the authoritative source instead of a codebase analog. |
| `osxphotos export` (as opposed to `osxphotos`'s SQLite-read mode already used in `00-index-photos.mjs`) | utility (external CLI invocation) | file-I/O | `00-index-photos.mjs` only ever queries `Photos.sqlite` directly via `node:sqlite`; it never shells out to the `osxphotos` CLI's `export` subcommand. RESEARCH.md Pattern 2 (verified via `osxphotos export --help` on this machine) is the authoritative source; use `node:child_process.execFileSync`/`spawnSync` (array-args form, not string/shell form) to avoid injection risk with UUID lists. |
| Video (`.mov`) handling in the upload pipeline | utility | file-I/O | No video-processing code exists anywhere in this repo (`ffmpeg` not installed per RESEARCH.md Environment Availability). Per D-02 and RESEARCH.md, upload `.mov` files as-is (no resize/compress step) — this is a documented scope decision, not a missing-pattern gap. |
| "Present triage list, wait for human adjustment, then proceed" two-phase script flow | utility | batch | No exact analog; `scripts/05-assess-photos.mjs` is the closest structural precedent (report-then-downstream-consumption two-phase design) but wasn't read in full this session — the planner should skim it briefly if more detail on this specific flow shape is needed, though the `--dry-run`/idempotency-flag conventions already documented above are sufficient to implement D-07's requirement. |

## Metadata

**Analog search scope:** `scripts/` (all 18 files, filenames scanned; 4 read in full: `00-index-photos.mjs`, `04-generate-stubs.mjs`, `07-quality-lift.mjs`, `09-parse-nebo-details.mjs`), `src/components/` (`Gallery.astro`, `Lightbox.astro`, `VoyageStats.astro` read in full), `src/layouts/BlogPost.astro` (read in full), `src/content.config.ts` (read in full), `src/content/blog/great-loop/*.mdx` (3 representative files read: 1 draft stub, 2 migrated/published posts), `.planning/data/*.json` (structure-sampled: `voyage-timeline-enriched.json`, `nebo-logs.json`; not fully loaded — large files, targeted single-entry inspection via `python3 -c` only).
**Files scanned:** 18 script filenames + 12 files read in full or targeted detail.
**Pattern extraction date:** 2026-07-25
