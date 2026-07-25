# Phase 6: New Post Generation - Research

**Researched:** 2026-07-25
**Domain:** Static-site content pipeline — Node.js batch scripting, Cloudflare R2 object storage, macOS Photos export, Claude API multimodal narrative generation
**Confidence:** HIGH (stack/API mechanics) / MEDIUM (prompt design for voice-matching) / LOW (nothing — no unverifiable claims remain after root-cause investigation)

<user_constraints>
## User Constraints (from CONTEXT.md)

**Note:** This project's `06-CONTEXT.md` uses `<domain>`/`<decisions>`/`<canonical_refs>`/`<code_context>`/`<specifics>`/`<deferred>` sections rather than the generic `Decisions`/`Claude's Discretion`/`Deferred Ideas` template. The most directly corresponding sections are copied verbatim below; there is no explicit "Claude's Discretion" section in this project's CONTEXT.md — areas left open to Claude's judgment are embedded within the Decisions (e.g., D-06's triage is "photo/data volume as a proxy," leaving exact thresholds to implementation) and are called out inline in this research where relevant (e.g., r2.dev vs. custom domain choice in Pattern 4).

### Phase Boundary (verbatim from CONTEXT.md `<domain>`)

The original 72-post Blogger blog is the baseline and does not get new photos. Phase 6's new-page work covers two date ranges, but they are **not the same kind of thing** — one is the main Loop continuing to its finish, the other is a genuine side trip:

1. **Keys to New Bern — main Loop continuation, NOT a side trip** (~2024-04-13 to 2024-05-17, the trip's finish): Florida Keys → FL east coast ICW → Georgia → South Carolina → North Carolina → New Bern NC. This is the Day-numbered sequence continuing straight through to the end (Day 723 onward) — narrative should read as the direct continuation of the main day-by-day Loop story, finishing it out. No "side trip" or "excursion" framing here. **27 candidate days** — 18 already have a `draft: true` stub, 9 have photo data in `daily-routes.json` but no stub was ever generated (2024-04-14, 04-15, 04-23, 04-29, 05-03, 05-08, 05-09, 05-10, 05-14).

2. **Canada side trip — an actual excursion** (2023-06-05 to 2023-08-31): a second Great Lakes excursion including a return to Canadian waters (North Channel, Ontario, Jul 14-22) — distinct from the *already-published* 2022 Georgian Bay/Canada leg. **74 candidate days** — 43 already have a `draft: true` stub, 31 have photo data but no stub generated. This one *is* presented with editorial framing as a side excursion in the narrative text (a return visit to Canada) — no structural/grouping change to the site, just how the writing frames it.

**Everything else is explicitly out of scope for this phase:** the other ~187 draft stubs (including the Holland MI "Days 112-124" Aug 2022 gap, and the rest of the Jan 2023–Apr 2024 middle) stay as unpublished `draft: true` files, untouched. No placeholder posts, no partial treatment — they simply aren't part of this milestone.

**The 72 original Blogger posts get no new photos, period.** 45 of them had a `<Gallery>` block appended during Phase 4's enrichment pass (pointing to local `file://` paths that never rendered) — this has already been removed (commit `fe69136`, 2026-07-25). No further "upgrade" work is planned for these 72 posts beyond that removal.

No `draft: true` posts should remain in the two in-scope ranges when the phase completes. Narrative is AI-drafted, then Barbara reviews/edits/approves every post — no AI narrative ships unreviewed.

### Locked Decisions (verbatim from CONTEXT.md `<decisions>`)

- **D-00 (supersedes D-01/D-02/D-03 as they applied to the 45 original posts):** The 45 original Blogger posts that had a Phase-4-added `<Gallery>` block have had that block and its import removed (commit `fe69136`). `VoyageStats` was left in place. **No further action needed on the 72 original posts.**
- **D-01:** Photos/videos for the ~101 candidate days (27 Keys→New Bern + 74 Canada) get uploaded to a **Cloudflare R2 bucket** (free tier: 10GB storage / 10M reads/month, zero egress). A batch script exports images from the local Photos library (via `osxphotos`) and uploads them, then rewrites each post's Gallery array to the real R2 URL.
- **D-02:** Videos (`.mov` files present in some galleries) get uploaded to R2 alongside photos, same pipeline.
- **D-03:** Photos are resized/compressed before upload (~1600px wide, JPEG ~80%), matching the existing w1600 lightbox pattern. HEIC converted to JPEG.
- **D-04 (new):** 9 Keys→New Bern days and 31 Canada-trip days have photo data in `daily-routes.json` but no `draft: true` stub was ever generated (likely `scripts/04-generate-stubs.mjs` applied a filter/threshold that skipped them). These need stubs generated using the existing pipeline before triage/narrative work can start — this is a prerequisite task, not optional.
- **D-05 (supersedes prior D-04/D-05 about "undocumented middle"):** The ~187 draft stubs outside the two in-scope ranges are left as unpublished drafts with no action. No placeholder posts for these.
- **D-06:** Full-narrative vs. transit-day split driven by **photo/data volume as a proxy** — more photos + richer Nebo detail (weather, named stops, ICW markers) = more eventful day = full narrative; thin-data days get stats+gallery only.
- **D-07:** Claude presents the full triage list before generating any AI drafts, so specific days can be moved between categories first.
- **D-08:** Every full-narrative AI draft includes an attempted closing Bible verse (matches Barbara's established voice). Not a placeholder — an actual attempt, freely editable by Barbara.
- **Canada side trip framing:** narrative for these 74 days should note it's a return trip to Canada (distinct from the 2022 Georgian Bay leg) — editorial content note, not a structural/frontmatter change.
- **D-09:** Direct MDX file editing — no new review UI.
- **D-10:** Barbara flips `draft: true` → `false` herself when she's done with a post.
- **AI narrative generation approach:** Reuse `scripts/07-quality-lift.mjs`'s Claude API pattern (Anthropic SDK, `claude-sonnet-4-6`, `ANTHROPIC_API_KEY`). Inputs: correlated photos (after R2 hosting), Nebo GPS waypoints + stats, parsed Nebo OCR detail (`nebo-logs.json`'s `legs` field). Use published, non-draft posts as style/voice reference.

### Canonical References (verbatim from CONTEXT.md `<canonical_refs>`)

- `.planning/REQUIREMENTS.md` — POST-01 through POST-05
- `.planning/ROADMAP.md` §Phase 6 — original goal/scope language; actual scope is narrower per CONTEXT.md's Domain section
- `.planning/PROJECT.md` — "Photos stay cloud-hosted (no self-hosting)" constraint; R2 satisfies it. QLFT-05 is effectively reversed for the 72 original posts — flagged for the next `/gsd:transition`.
- Existing patterns to reuse: `scripts/07-quality-lift.mjs` (Claude API pattern), `scripts/00-index-photos.mjs` (`osxphotos`-based access), `scripts/04-generate-stubs.mjs` (needs extending for the 40 missing stubs), `scripts/09-parse-nebo-details.mjs` / `.planning/data/nebo-logs.json` `legs` field, `src/components/Lightbox.astro`, `Gallery.astro`, `src/layouts/BlogPost.astro`.
- Draft stub data: Keys→New Bern range (2024-04-13 to 2024-05-17) — 18 existing stubs + 9 missing. Canada side trip range (2023-06-05 to 2023-08-31) — 43 existing stubs + 31 missing.

### Deferred Ideas (verbatim from CONTEXT.md `<deferred>`, OUT OF SCOPE)

- The ~187 out-of-scope draft stubs (Holland MI Aug 2022 gap, rest of Jan 2023–Apr 2024) — left as unpublished drafts, available for a possible future milestone if ever revisited. Not deleted.
- No "Reviewed Todos (not folded)" — none.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| POST-01 | MDX stubs generated for all undocumented stops using GPS + EXIF + Nebo data | Root-caused the exact reason 40 stubs are missing (`photoCount < 10` filter in `scripts/04-generate-stubs.mjs`); Pattern 1 provides the fix (date-list override, not a global threshold change) |
| POST-02 | Each stub includes: auto-populated frontmatter, photo gallery from correlated iCloud photos, voyage stats, Nebo PDF summary block | Existing `04-generate-stubs.mjs` Job 2 already produces this shape for every other stub — the same code path applies once Pattern 1's override is added; no new frontmatter logic needed |
| POST-03 | All generated posts reviewed and narrative-completed by Barbara before publishing | D-09/D-10 (direct MDX edit, manual `draft` flip) — no tooling needed; Validation Architecture section defines the "count remaining `draft: true` in scope" check the planner should verify against at phase gate |
| POST-04 | Undocumented middle (Days 112–124) documented to the extent photo/GPS data allows | **Out of scope per CONTEXT.md D-05** — this requirement's Phase-6 mapping in REQUIREMENTS.md predates the 2026-07-25 scope tightening; the planner should flag this for `/gsd:transition` rather than build anything for it in this phase |
| POST-05 | Last segment (Days 259 → return to New Bern NC, May 2024) fully documented with AI-drafted narrative reviewed by Barbara | Covered by the Keys→New Bern range (in-scope range 1); Pattern 5 provides the concrete Claude API narrative-generation approach, Code Examples section provides the verified voice/Bible-verse reference patterns to prompt against |

**Note on POST-04:** Per the authoritative 06-CONTEXT.md revision, the "undocumented middle" (which included Days 112-124) was dropped from Phase 6 scope. This research does not investigate implementation for POST-04 — see Open Questions / the recommendation above to flag it in REQUIREMENTS.md traceability during the next transition, per CONTEXT.md's own canonical_refs note about QLFT-05's similar status.
</phase_requirements>

## Summary

Phase 6 is a data-pipeline phase, not a UI phase: four new/extended Node.js scripts (stub generation, R2 photo upload, narrative drafting) operating on the existing `.planning/data/*.json` pipeline outputs and `src/content/blog/great-loop/*.mdx` files. No new site components or routes are needed — `Gallery.astro`, `Lightbox.astro`, `VoyageStats.astro`, and `BlogPost.astro` already handle whatever URLs land in a post's frontmatter/body, cloud-hosted or not.

Investigation confirmed the root cause CONTEXT.md's D-04 flagged as "likely": `scripts/04-generate-stubs.mjs` hard-codes `if (day.photoCount < 10) continue;` (line 270-271) when reading `voyage-timeline-enriched.json`. All 9 Keys→New Bern and all 31 Canada missing days have `photoCount` between 1 and 9 in that file — confirmed by direct inspection, not inference. The fix is a threshold override for the two in-scope date ranges, not a rewrite of the stub-generation logic. `src/data/daily-routes.json` (mentioned in CONTEXT.md) is a different, lighter-weight artifact used only for map-track rendering (lat/lon/timestamp triples, no UUID/filename) — it is not the right data source for stub generation; `voyage-timeline-enriched.json` (with full photo objects) is.

For photo hosting, Cloudflare R2's free tier (10 GB storage, 1M Class A writes/month, 10M Class B reads/month, zero egress) is confirmed directly against current Cloudflare pricing docs and comfortably covers ~101 days of photos. The critical technical finding here is that **`sharp`'s prebuilt npm binary cannot decode HEIC input** — confirmed by inspecting `sharp.format.heif` on this machine, which shows only `.avif` in the file-suffix list, no HEIC. HEIC→JPEG conversion must happen at the `osxphotos export --convert-to-jpeg` step (native macOS decode), with `sharp` used afterward only for resize/recompress of the resulting JPEGs. `osxphotos` has no built-in resize flag — `sharp` is required for the 1600px/80%-quality step.

For narrative generation, the biggest simplification available: since photos will already be hosted at public R2 URLs before the narrative-generation step runs, the Claude API call can pass images via `type: "url"` image source blocks pointing directly at the R2 URLs, instead of downloading and base64-encoding each photo. This avoids the 20-image-per-request stricter dimension limit concerns and the base64 payload/latency overhead entirely, and requires no SDK upgrade (the project's installed `@anthropic-ai/sdk@0.52.0`, while several minor versions behind current `0.115.0`, fully supports image content blocks — this is stable, non-beta API surface).

**Primary recommendation:** Extend `scripts/04-generate-stubs.mjs` with a hard-coded date-list override (bypassing the photo-count filter for the 40 named missing-stub dates only), build a new `scripts/10-upload-r2.mjs` using `@aws-sdk/client-s3` + `osxphotos export --uuid --convert-to-jpeg` + `sharp` resize, then a new `scripts/11-draft-narratives.mjs` that reuses `07-quality-lift.mjs`'s Anthropic SDK pattern but sends R2 URLs as `type: "url"` image blocks alongside structured Nebo/GPS text, gated behind a triage step per CONTEXT.md D-06/D-07.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Missing-stub MDX generation | Local Pipeline Script (Node.js, offline) | Content Collection (Astro, build-time validation) | Runs once, writes files; Astro's Zod schema validates the result at next `astro build` |
| Photo/video export from Photos library | Local Pipeline Script (`osxphotos` CLI, macOS-only) | — | Must run on the machine with the Photos library; no server-side equivalent exists |
| Image resize/HEIC conversion | Local Pipeline Script (`osxphotos` for format, `sharp` for resize) | — | Both steps are local/offline; no runtime cost to the deployed site |
| Photo/video hosting | Cloud Object Storage (Cloudflare R2) | CDN (R2's built-in edge caching via custom domain) | Matches PROJECT.md's "photos stay cloud-hosted" constraint; R2 serves images directly to browsers at request time |
| AI narrative drafting | Local Pipeline Script (Node.js, calls Claude API) | — | One-time batch generation; output is static MDX text, not a runtime dependency |
| Narrative review/approval | Human (Barbara, direct file edit) | — | Explicitly no new UI (D-09) — this is manual editorial work, not a system component |
| Final rendering | Browser (via Astro static build) | Static Hosting (Netlify) | Unchanged from existing site architecture — `Gallery.astro`/`Lightbox.astro`/`VoyageStats.astro` already handle arbitrary image URLs |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aws-sdk/client-s3` | `^3.1095.0` [VERIFIED: npm registry — resolved via Cloudflare's own S3-compatibility docs, then confirmed with `npm view`] | Upload objects to Cloudflare R2 via its S3-compatible API | Cloudflare's official-docs-recommended path for programmatic R2 access from Node.js; no Cloudflare-specific SDK exists for pure object upload (wrangler is a CLI/dev-tool, not a library for batch scripting) |
| `sharp` | `0.34.5` installed / `0.35.3` latest [VERIFIED: npm registry] | Resize to ~1600px wide + recompress to ~80% JPEG quality | Already a project dependency; industry-standard for Node.js image processing; **cannot decode HEIC** — see pitfall below |
| `osxphotos` | `0.75.7` installed [VERIFIED: `osxphotos --version` on this machine] | Export photos/videos from the local Photos library by UUID, convert HEIC→JPEG at export time | Already used in `scripts/00-index-photos.mjs` for indexing; its `export` subcommand (not previously used in this project) does the file-extraction + format-conversion job |
| `@anthropic-ai/sdk` | `0.52.0` installed / `0.115.0` latest [VERIFIED: npm registry] | Claude API calls for narrative drafting | Already the project's established pattern (`scripts/07-quality-lift.mjs`); image content blocks are stable (non-beta) API surface supported since early versions — no upgrade required for this phase's use case |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:sqlite` (built-in, Node 22+) | n/a | Already used for direct Photos.sqlite queries in `00-index-photos.mjs` | Not needed for the new R2/narrative scripts — `osxphotos export --uuid` is sufficient since UUIDs are already known from `photo-index.json`/`voyage-timeline-enriched.json` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@aws-sdk/client-s3` | `wrangler r2 object put` (Cloudflare CLI) | Wrangler is designed for interactive/CI use, not scripted batch upload with dynamic per-file logic (resize results, Gallery-array rewriting); AWS SDK gives full programmatic control in the same Node.js process |
| `@aws-sdk/client-s3` | Third-party wrapper libs (e.g. `node-cloudflare-r2`) found via WebSearch [ASSUMED — not verified against official docs, not recommended] | Thin wrappers around the same S3 API; adds a dependency with unknown maintenance status for no functional benefit over the AWS SDK directly |
| `osxphotos --convert-to-jpeg` for resize | `sharp` alone for both HEIC decode and resize | Not possible — `sharp`'s prebuilt binary lacks libheif; would require compiling libvips from source with libheif/libde265/x265, a heavy and fragile build dependency for a script that only needs to run a handful of times |
| Claude `url` image source | Base64-encoded image blocks | Base64 requires downloading + encoding every photo locally before the API call, inflates request payload size, and hits the stricter "many-image" dimension limit sooner; since photos are already public R2 URLs by the time narrative generation runs, `url` source is strictly simpler and has no meaningful downside |

**Installation:**
```bash
npm install @aws-sdk/client-s3
```
(`sharp` and `@anthropic-ai/sdk` are already project dependencies; `osxphotos` is a pre-installed Homebrew CLI, not an npm package.)

**Version verification:** Verified live against npm registry during this research session:
```
$ npm view @aws-sdk/client-s3 version   → 3.1095.0
$ npm view sharp version                → 0.35.3 (0.34.5 installed)
$ npm view @anthropic-ai/sdk version    → 0.115.0 (0.52.0 installed)
$ osxphotos --version                   → 0.75.7 (Homebrew, Python 3.11.15 backend)
```

## Package Legitimacy Audit

Only one new package is introduced by this phase: `@aws-sdk/client-s3`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@aws-sdk/client-s3` | npm | Years (official AWS SDK v3, modular since 2020) | Very high (tens of millions/week across the `@aws-sdk/*` family) | github.com/aws/aws-sdk-js-v3 | [OK] | Approved |

`slopcheck install @aws-sdk/client-s3` was run during this research session and returned `[OK]`. **Caveat on methodology:** `slopcheck install` performs a real `npm install`, not a dry-run check — it modified `package.json`/`package-lock.json` on disk during verification. This was detected via `git status` immediately after and reverted (`git checkout -- package.json package-lock.json`, followed by `npm install` to resync `node_modules`); the repository was left clean. **The planner should NOT re-run `slopcheck install` casually during planning/execution — treat this package as already legitimacy-checked.** If a future phase needs to re-verify a package with slopcheck, do it in a scratch directory or expect it to mutate `package.json` and plan to revert.

Separately, `@aws-sdk/client-s3`'s existence and current version were confirmed directly via `npm view` (registry ground truth) and its identity as the AWS-official S3 client is corroborated by Cloudflare's own official R2 documentation recommending it by name for S3-compatible access — this combination satisfies `[VERIFIED: npm registry]` provenance (official-docs-sourced package name, registry-confirmed).

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────┐
│  Photos.sqlite /     │
│  Photos library      │  (local macOS, ~/Pictures/Photos Library.photoslibrary)
└──────────┬───────────┘
           │ osxphotos export --uuid <uuid> --convert-to-jpeg --jpeg-quality 1.0
           ▼
┌──────────────────────┐
│  Local temp JPEGs     │  (full-res, converted from HEIC)
└──────────┬────────────┘
           │ sharp .resize({width:1600}).jpeg({quality:80})
           ▼
┌──────────────────────┐        ┌────────────────────────────┐
│  Resized JPEGs (temp) │──────▶│  Cloudflare R2 bucket        │
└──────────────────────┘  PUT   │  (S3 API via @aws-sdk/       │
    (@aws-sdk/client-s3)        │   client-s3, public via      │
                                 │   r2.dev or custom domain)   │
                                 └──────────────┬───────────────┘
                                                 │ public HTTPS URLs
                                                 ▼
┌───────────────────────────┐         ┌─────────────────────────────┐
│ voyage-timeline-enriched   │         │  MDX stub's Gallery array     │
│ .json + nebo-logs.json     │────────▶│  rewritten with real URLs     │
│ (legs: weather/ICW/stops)  │  read   └──────────────┬────────────────┘
└───────────────────────────┘                          │
                                                          │ R2 URLs + Nebo legs
                                                          │ text fed to prompt
                                                          ▼
                                          ┌─────────────────────────────┐
                                          │  Claude API (messages.create) │
                                          │  image blocks: type "url"     │
                                          │  text: GPS/weather/ICW/stats  │
                                          └──────────────┬────────────────┘
                                                          │ drafted narrative text
                                                          ▼
                                          ┌─────────────────────────────┐
                                          │  MDX body rewritten in-place  │
                                          │  (draft: true retained)       │
                                          └──────────────┬────────────────┘
                                                          │ manual review/edit
                                                          ▼
                                          ┌─────────────────────────────┐
                                          │  Barbara flips draft:false    │
                                          └──────────────┬────────────────┘
                                                          │ astro build
                                                          ▼
                                          ┌─────────────────────────────┐
                                          │  Static site → Netlify        │
                                          └─────────────────────────────┘
```

### Recommended Project Structure
```
scripts/
├── 04-generate-stubs.mjs      # EXTEND: add date-list override bypassing photoCount<10 filter for the 40 named dates
├── 10-upload-r2.mjs           # NEW: osxphotos export → sharp resize → R2 upload → rewrite MDX Gallery array
├── 11-draft-narratives.mjs    # NEW: triage pass + Claude API narrative generation, reusing 07-quality-lift.mjs's client pattern
.planning/data/
├── r2-upload-report.json      # NEW: per-day upload results (mirrors quality-lift-report.json pattern)
├── narrative-triage.json      # NEW: full-narrative / transit-day / sparse-data classification, presented to user before drafting (D-07)
```

### Pattern 1: Scoped stub generation without disturbing the existing filter
**What:** Add an explicit allow-list of the 40 target dates that bypasses `day.photoCount < 10` only for those dates, leaving the general-purpose filter untouched for any future re-run over the full timeline.
**When to use:** Any time a specific, enumerated set of days needs a stub despite thin photo data — exactly CONTEXT.md's D-04 scenario.
**Example:**
```javascript
// Source: pattern derived from scripts/04-generate-stubs.mjs (existing project code)
const FORCE_STUB_DATES = new Set([
  '2024-04-14', '2024-04-15', '2024-04-23', '2024-04-29', '2024-05-03',
  '2024-05-08', '2024-05-09', '2024-05-10', '2024-05-14',
  '2023-06-06', '2023-06-08', /* ...remaining 29 Canada dates... */
]);

for (const day of timelineRaw.days) {
  const forced = FORCE_STUB_DATES.has(day.date);
  if (day.photoCount < 10 && !forced) continue;   // unchanged default behavior
  if (day.date < '2022-04-01' || day.date > '2024-05-17') continue;
  // ...rest of existing stub-building logic unchanged...
}
```

### Pattern 2: osxphotos targeted export by UUID with HEIC conversion
**What:** Export only the specific photos already identified per-day in `voyage-timeline-enriched.json`/`photo-index.json` (not a date-range export, which would pull in-scope AND out-of-scope photos), converting HEIC to JPEG at export time.
**When to use:** The R2 upload script's per-day photo-fetch step.
**Example:**
```bash
# Source: osxphotos export --help (installed CLI, v0.75.7)
osxphotos export /tmp/r2-staging \
  --uuid F884B1E7-12D4-40A2-A6C3-28035D866232 \
  --uuid EAD3C79A-68D4-43D6-9E2D-C2AECD887232 \
  --convert-to-jpeg \
  --jpeg-quality 1.0 \
  --current-name
```
`--uuid` may be repeated for a batch of UUIDs in one invocation (confirmed via `osxphotos export --help`). Run once per day's UUID set, or batch multiple days per invocation with `--uuid-from-file` reading a generated UUID list. `.mov` files pass through export unchanged (osxphotos does not convert video); upload them to R2 as-is per D-02 — no video resize/compression tooling is available in this environment (`ffmpeg` is not installed — see Environment Availability).

### Pattern 3: Resize + compress with sharp after HEIC→JPEG conversion
**What:** The 1600px-wide / ~80%-quality target from D-03, applied only to the already-JPEG output of the osxphotos export step.
**Example:**
```javascript
// Source: sharp API docs (sharp.pixelplumbing.com/api-resize, api-output)
import sharp from 'sharp';

await sharp(inputJpegPath)
  .resize({ width: 1600, withoutEnlargement: true })
  .jpeg({ quality: 80 })
  .toFile(outputPath);
```
`withoutEnlargement: true` prevents upscaling photos already narrower than 1600px (some early-era or cropped photos may be smaller).

### Pattern 4: R2 upload via S3-compatible API
**What:** Standard AWS SDK v3 `PutObjectCommand` against R2's S3-compatible endpoint.
**Example:**
```javascript
// Source: developers.cloudflare.com/r2/api/s3/api/ (endpoint format, region=auto)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

await r2.send(new PutObjectCommand({
  Bucket: 'jackieb3-photos',
  Key: `great-loop/2024-04-14/${filename}`,
  Body: fileBuffer,
  ContentType: 'image/jpeg',
}));

// Public URL (r2.dev dev subdomain, or a configured custom domain):
const publicUrl = `https://pub-<hash>.r2.dev/great-loop/2024-04-14/${filename}`;
```
**Auth setup:** Create an **Object Read & Write**, bucket-scoped R2 API token in the Cloudflare dashboard (R2 → Manage API Tokens) — narrower scope than Account-level Admin tokens, appropriate for a script that only uploads/reads one bucket. [CITED: developers.cloudflare.com/r2/api/tokens/]
**Public access setup:** Enable the bucket's "Public Development URL" (r2.dev subdomain) for this phase — Cloudflare's own docs flag r2.dev as rate-limited and development-only, but a personal blog with modest traffic and R2's zero-egress model make this an acceptable production choice without the extra step of provisioning a custom domain/DNS zone in Cloudflare. If Barbara's domain is already Cloudflare-managed, a custom domain is a drop-in upgrade later with no code changes (only the base URL constant changes). [CITED: developers.cloudflare.com/r2/buckets/public-buckets/]

### Pattern 5: Claude narrative generation with R2-hosted photo URLs
**What:** Multimodal prompt combining photo URLs, GPS/Nebo structured data, and a style-reference excerpt, following the image-then-text ordering Anthropic's docs recommend.
**Example:**
```javascript
// Source: 07-quality-lift.mjs (existing client pattern) + platform.claude.com/docs/en/build-with-claude/vision
const msg = await getClient().messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4000,
  system: NARRATIVE_SYSTEM_PROMPT, // includes voice-reference excerpts from published posts
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Photo 1:' },
      { type: 'image', source: { type: 'url', url: 'https://pub-xxxx.r2.dev/great-loop/2024-04-14/IMG_0001.jpg' } },
      { type: 'text', text: 'Photo 2:' },
      { type: 'image', source: { type: 'url', url: 'https://pub-xxxx.r2.dev/great-loop/2024-04-14/IMG_0002.jpg' } },
      // ... up to 20 images without hitting the stricter multi-image dimension limit
      {
        type: 'text',
        text: `Day: 2024-04-14. Location: ${location}. Distance: ${miles}nm, ${hours}hrs underway.
Route: ${legs.routeName}. Weather departure: ${legs.weatherDeparture}. ICW markers passed: ${legs.icwMarkers.join(', ')}.
Named stops: ${legs.namedStops.arrived.join(', ')}.
Write a first-person journal entry in Barbara's voice (reference style below), ending with an attempted Bible verse relevant to the day's events.`,
      },
    ],
  }],
});
```
**Image count guidance:** Keep to ≤20 image blocks per request — above 20, the API applies a stricter per-image dimension cap (no side over 2000px) rather than rejecting outright, but staying at/under 20 avoids the issue entirely and matches typical daily photo-cluster sizes in this dataset. [CITED: platform.claude.com/docs/en/build-with-claude/vision — "Request limits"]

### Anti-Patterns to Avoid
- **Base64-encoding R2-hosted photos before sending to Claude:** Pointless double-transfer (R2 → script → base64 → Anthropic) when the `url` source type lets Anthropic's servers fetch directly from the already-public R2 URL.
- **Relying on `sharp` to decode HEIC:** Will throw or silently fail depending on sharp version — this project's installed `sharp@0.34.5` confirmed no `.heic` in `sharp.format.heif.input.fileSuffix` (only `.avif`). Always convert HEIC→JPEG via `osxphotos --convert-to-jpeg` first.
- **Date-range `osxphotos export` instead of per-UUID export:** A date-range export would need additional filtering logic to exclude out-of-Loop-photos (e.g., personal photos taken same day) and re-derive which UUIDs belong to which post — the pipeline already has exact UUID lists per day in `voyage-timeline-enriched.json`; use them directly with `--uuid`.
- **Regenerating the full timeline/photo-index for this phase:** Not needed — `photo-index.json` and `voyage-timeline-enriched.json` already contain the necessary per-day photo lists; only the *stub-generation filter* needs adjusting (Pattern 1), not the underlying indexing pipeline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HEIC→JPEG decoding | Custom HEIF parser or a compiled-from-source libvips+libheif toolchain | `osxphotos export --convert-to-jpeg` | Uses macOS's native, patent-licensed HEIC decoder already present on the machine — zero extra dependencies, and this project already depends on `osxphotos` |
| S3-compatible request signing | Manual AWS Signature V4 implementation | `@aws-sdk/client-s3` | SigV4 is notoriously easy to get subtly wrong (clock skew, canonical request formatting); the official SDK handles it transparently |
| Multi-day photo→post correlation | New timestamp-matching logic for the 40 missing days | Existing `voyage-timeline-enriched.json` (already has per-day photo UUID lists, built by `scripts/00-index-photos.mjs` → `03-correlate.mjs`) | The correlation work is already done for every day in range; only the stub *generation* filter needs adjusting |
| Nebo OCR detail parsing | New regex/parsing pass over raw OCR text | Existing `scripts/09-parse-nebo-details.mjs` output (`nebo-logs.json`'s `legs` field) | Already built and tested in a prior session per STATE.md — "not yet consumed downstream" is exactly what Phase 6 should do, not replace |

**Key insight:** This phase's real complexity is almost entirely in orchestration (which script runs on which subset of days, in what order) rather than in any single technical problem — nearly every sub-problem (photo indexing, GPS correlation, Nebo detail extraction, Claude API calling, MDX frontmatter parsing) already has a working, tested implementation elsewhere in `scripts/`. The temptation to hand-roll should be resisted in favor of extending/reusing those exact patterns.

## Common Pitfalls

### Pitfall 1: Assuming `sharp` can read HEIC files directly
**What goes wrong:** A script that does `sharp(heicBuffer).resize(...)` either throws `Input file contains unsupported image format` or silently produces a corrupt/empty output, depending on sharp/libvips build.
**Why it happens:** `sharp`'s prebuilt npm binary ships with a stripped-down libvips that excludes libheif for licensing reasons (HEIC/HEVC patent licensing).
**How to avoid:** Always run `osxphotos export --convert-to-jpeg` (or otherwise produce a JPEG) before any `sharp` processing. Confirmed on this machine: `sharp.format.heif.input.fileSuffix` = `['.avif']` only, no `.heic`.
**Warning signs:** Any HEIC-related error from `sharp`, or JPEG output files that are 0 bytes / fail to open.

### Pitfall 2: Photo-count threshold silently excluding target days from stub generation
**What goes wrong:** Re-running `scripts/04-generate-stubs.mjs` as-is will continue to skip exactly the 40 days this phase needs to backfill, because `day.photoCount < 10` is unconditional.
**Why it happens:** The filter was designed for a different purpose (avoid generating near-empty stubs across the *entire* undocumented timeline) and was never meant to gate a specific, curated list of days that the user has explicitly decided deserve full narrative treatment despite thin photo counts.
**How to avoid:** Use the date-list override pattern (Pattern 1) rather than lowering the global threshold — lowering it globally would also generate ~187 additional out-of-scope stubs across the "undocumented middle," directly violating D-05's dropped-scope decision.
**Warning signs:** Running the stub generator and getting 0 new stubs for the 40 target dates; check `SKIP_STUB <date>` log lines against the confirmed date list.

### Pitfall 3: r2.dev public URL rate limiting under production traffic
**What goes wrong:** If the site gets a traffic spike (e.g., shared on a boating forum), r2.dev's rate limit could cause broken images.
**Why it happens:** Cloudflare explicitly documents r2.dev as development-only and rate-limited; it is not designed for production image serving at scale.
**How to avoid:** For a personal blog with modest, non-viral traffic this is a low-probability risk worth accepting to avoid custom-domain DNS setup complexity — but note it as a known tradeoff, and document the upgrade path (custom domain, zero code changes beyond the base URL constant) for if traffic ever grows. [CITED: developers.cloudflare.com/r2/buckets/public-buckets/]
**Warning signs:** Images intermittently failing to load with 429-style responses during high-traffic periods.

### Pitfall 4: Gallery array containing a mix of `file://` and R2 URLs after a partial/failed upload run
**What goes wrong:** If the R2 upload script crashes partway through a day's photo batch, the Gallery array could end up with some `https://pub-xxx.r2.dev/...` URLs and some stale `file:///Users/...` paths, and the stale ones will render as broken images in production (the `file://` scheme never resolves in a browser).
**Why it happens:** Naive "upload each photo, rewrite in place" logic without an all-or-nothing per-post commit.
**How to avoid:** Follow `07-quality-lift.mjs`'s established idempotency pattern — only rewrite a post's Gallery array after *all* of that post's photos have successfully uploaded; use a frontmatter flag (e.g., `r2Uploaded: true`) to gate re-runs, matching the `lifted`/`enriched` pattern already used elsewhere in this codebase.
**Warning signs:** Grep for `file://` remaining in any post's Gallery array after the upload script reports success.

### Pitfall 5: Prompt asks for a Bible verse but the model fabricates a citation
**What goes wrong:** An AI-generated "Philippians 4:19 NIV" quote that doesn't actually match the real verse text, or attributes real text to the wrong reference.
**Why it happens:** LLMs can confidently misquote scripture references, especially specific verse numbers, the same way they can hallucinate citations in any domain.
**How to avoid:** This is explicitly Barbara's review responsibility per D-08/D-09 ("Not a placeholder — an actual attempt, freely editable by Barbara") — the phase design already accounts for this by requiring human review before any post is published (`draft: true` → `false` is manual). The prompt should ask for a *reasonable attempt*, not claim the citation is guaranteed accurate, and the system prompt should be explicit that Barbara will verify it.
**Warning signs:** N/A at generation time — this is a content-quality risk mitigated entirely by the existing human-review gate, not by tooling.

## Code Examples

### Established closing Bible verse pattern (from existing published post, for prompt reference)
```markdown
<!-- Source: src/content/blog/great-loop/2022-04-22-the-adventure-begins.mdx (published, migrated: true) -->
"The heavens declare the glory of God; the skies proclaim the work of his hands."
Psalms 19:1 NIV
```
This is the exact quote-then-citation format the narrative-generation prompt should target: a quoted verse line, then `Book Chapter:verse TRANSLATION` on the following line, typically placed near the end of the post (sometimes before a final photo/stats section, sometimes as the closing line).

### Established voice/style reference (from existing published post)
```markdown
<!-- Source: src/content/blog/great-loop/2024-02-23-boca-chica-vogelzaangs-days-254-258.mdx -->
Our next set of visitors came from Michigan. Cindy and John were up for anything so that's what we did!

Their first day was a rainy day but that didn't stop us. We had breakfast at Blue Heaven. It was once
a bordello then a boxing venue where matches were occasionally refereed by Ernest Hemingway...
```
First-person, warm, conversational, specific place/name detail, light self-deprecating humor. The narrative-generation system prompt should include 2-3 excerpts like this (drawn programmatically from `migrated: true` posts, not `draft: true` stubs) as style anchors, per CONTEXT.md's canonical references ("Use published, non-draft posts as style/voice reference").

### Nebo `legs` data shape available for prompting (from `scripts/09-parse-nebo-details.mjs` output)
```javascript
// Source: scripts/09-parse-nebo-details.mjs — actual fields written to nebo-logs.json's `legs` array
{
  routeName: "Charleston SC to Georgetown SC" /* or null if not OCR'd */,
  commenced: "07:45", completed: "14:20",
  weatherDeparture: { temp: 72, unit: 'F', windKn: 8, windDir: 'SW' } /* or null */,
  weatherArrival: { temp: 78, unit: 'F', windKn: 12, windDir: 'S' } /* or null */,
  icwMarkers: [423, 428, 435] /* ICW statute mile markers passed */,
  landmarks: ["the Ben Sawyer Bridge"] /* "Passed under X" matches */,
  namedStops: { started: "...", departed: "...", arrived: [...], stopped: "..." },
  weatherReadings: [ /* in-transit readings */ ],
  positions: [[lat, lon], ...] /* GPS fixes mentioned in the OCR text */,
}
```
Every field degrades gracefully to `null`/`[]` when OCR didn't capture it (per the script's own design comment) — the narrative prompt-builder should handle missing fields without erroring, e.g. omit a "weather on departure" sentence entirely rather than injecting "null".

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Anthropic image blocks: standard-tier models capped at 1568px long edge | Claude 4.7+ models get a "high-resolution" tier: 2576px long edge, 4784 max visual tokens, automatic (no beta header) | Per current Anthropic vision docs (fetched this session) | If the project ever moves to a 4.7+/5.x model, larger source images (beyond the 1600px D-03 target) could be sent without extra downscaling — not a reason to change the 1600px plan now, since 1600px is well under even the standard-tier 1568px-ish threshold and keeps R2 storage/egress low regardless of model tier |
| `@anthropic-ai/sdk@0.52.0` (installed) | `@anthropic-ai/sdk@0.115.0` (current) | Ongoing since project's Phase 3 | Image content blocks (`type: "image"`, `source.type: "url"`/`"base64"`) are stable, non-beta surface present in both versions — no upgrade required for this phase. An upgrade would only matter if a future phase wants the Files API (`file_id` source, requires `anthropic-beta: files-api-2025-04-14` header) |

**Deprecated/outdated:** None identified specific to this phase's stack — R2, `osxphotos`, `sharp`, and the Anthropic Messages API are all current, actively maintained tools with no announced deprecations relevant here.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Third-party R2 wrapper libraries (`node-cloudflare-r2`, etc.) found in a WebSearch result are lower-quality/less-maintained than using `@aws-sdk/client-s3` directly | Alternatives Considered | Low — this is a recommendation to *avoid* an unverified package, not a claim the plan depends on |
| A2 | R2's `r2.dev` rate limit is acceptable for this specific low-traffic personal blog | Pitfall 3 | Medium — if wrong (unexpected traffic spike), images could intermittently 429; mitigation (custom domain) is a same-day fix requiring only a base-URL constant change, not a rewrite |
| A3 | 20 images per Claude narrative-generation request is a reasonable per-day cap that won't need raising | Pattern 5 | Low — the in-scope days' photo counts (per `voyage-timeline-enriched.json`, mostly single-digit to low-double-digit `photoCount`) are well under 20 for the vast majority of days; a handful of high-volume days may need either trimming to the most representative photos or splitting across `≤20`-image batches, decidable at planning time by checking actual per-day counts |

**If this table is empty:** N/A — see entries above. All three are low-to-medium risk judgment calls, not load-bearing factual claims; every load-bearing technical claim in this document (R2 pricing/limits, sharp HEIC support, osxphotos flags, Claude API limits, the photoCount<10 root cause) was independently verified against either official documentation or direct inspection of this project's own code/data/environment.

## Open Questions

1. **How should the R2 upload script batch across ~101 days to stay well within a single working session, and should it be resumable?**
   - What we know: `07-quality-lift.mjs` and `04-generate-stubs.mjs` both establish an idempotency-flag pattern (`lifted`, `enriched`) that supports safe re-running after partial failure.
   - What's unclear: Whether osxphotos export + R2 upload for ~101 days' worth of photos (likely several hundred to low-thousands of images) should run as one long-lived script invocation or be chunked (e.g., by date range) to make interruption/resume simpler.
   - Recommendation: Follow the same per-post idempotency-flag pattern (e.g., `r2Uploaded: true` in frontmatter) so the script is naturally resumable regardless of how it's invoked — this is a planning-time task-sequencing decision, not a research gap.

2. **Exact photo/video counts and total upload volume for the ~101 in-scope days, to confirm the 10GB free-tier ceiling holds after 1600px/80%-quality resizing.**
   - What we know: `voyage-timeline-enriched.json` has per-day `photoCount` for every date; CONTEXT.md's D-01 already estimates this comfortably fits 10GB after resizing (typical resized JPEG at 1600px/80% quality is roughly 200-500KB, so even 1,500 photos would land around 300-750MB — well under 10GB).
   - What's unclear: The exact total photo+video byte count for just the ~101 in-scope days hasn't been computed in this research session (would require summing `photoCount` across exactly those 101 dates plus accounting for `.mov` files, which aren't resized and could be significantly larger per-file).
   - Recommendation: The planner should have the R2 upload script log cumulative bytes uploaded as it runs (matching the `*-report.json` pattern) so this is empirically confirmed during execution rather than needing to be pre-computed here; given the wide margin (10GB free tier vs. an estimated <1GB of resized photos), this is very unlikely to be a blocking issue.

3. **POST-04 (Days 112-124 "undocumented middle") is dropped from Phase 6 scope per CONTEXT.md D-05, but REQUIREMENTS.md still maps it to Phase 6.**
   - What we know: CONTEXT.md's canonical_refs explicitly flags this mismatch (alongside QLFT-05) as something to resolve at the next `/gsd:transition`, not something for this phase to build.
   - What's unclear: Whether the planner should mark POST-04 as "descoped — see CONTEXT.md D-05" in its plan output, or whether that's purely a `/gsd:transition`-time REQUIREMENTS.md edit.
   - Recommendation: The planner should NOT create any tasks for POST-04; it should note in its plan that POST-04 is out of scope per the authoritative CONTEXT.md, consistent with how it should treat QLFT-05.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `osxphotos` (Homebrew CLI) | R2 upload script's photo/video export step | ✓ | 0.75.7 | — |
| `sharp` (npm, already installed) | Resize/recompress step | ✓ | 0.34.5 | — |
| `@anthropic-ai/sdk` (npm, already installed) | Narrative generation | ✓ | 0.52.0 (image blocks supported) | Upgrade to 0.115.0 only if Files API is later desired |
| `@aws-sdk/client-s3` | R2 upload | ✗ (not yet installed) | — | `npm install @aws-sdk/client-s3` — no viable fallback needed, trivial install |
| `ffmpeg` | Video (`.mov`) compression/resize before R2 upload | ✗ | — | Not required by CONTEXT.md's scope — D-02 says videos upload "alongside photos, same pipeline" with no stated resize requirement; upload `.mov` files as-is. If video file sizes threaten the 10GB budget, `ffmpeg` install (`brew install ffmpeg`) is the fallback, but is out of scope unless the empirical byte count (Open Question 2) shows it's needed |
| Cloudflare R2 account + bucket | All R2 upload work | ✗ (must be created) | — | No fallback — this is a required one-time manual setup step (dashboard bucket creation + API token generation), not automatable from this research |
| `ANTHROPIC_API_KEY` env var | Narrative generation | ✗ (not set in current shell) | — | Must be exported before running the narrative script, same as the existing `07-quality-lift.mjs` requirement — no fallback, script already fails fast with a clear error message per its existing `getClient()` guard pattern |

**Missing dependencies with no fallback:**
- Cloudflare R2 account/bucket/API token — must be manually created by the user (dashboard) before any upload script can run; this is a `checkpoint:human-verify`-style prerequisite, not something the plan can automate.
- `ANTHROPIC_API_KEY` — must be exported into the shell environment before the narrative script runs (same as the existing quality-lift workflow already requires).

**Missing dependencies with fallback:**
- `@aws-sdk/client-s3` — trivial `npm install`, no risk.
- `ffmpeg` — only needed if video file sizes turn out to threaten the R2 free-tier budget; deferred pending empirical measurement during execution.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — this is a static-site content pipeline with no existing unit/integration test suite (confirmed: no `test` script in `package.json`, no `*test*` files/directories found in the repo) |
| Config file | none |
| Quick run command | `npm run build` (Astro's Zod content-collection schema validates every MDX file's frontmatter at build time — this is the project's de facto content-correctness check) |
| Full suite command | `npm run build` (same — no separate "full" suite exists) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POST-01 | 40 missing MDX stubs generated with valid frontmatter | schema validation | `npm run build` (fails loudly on any Zod schema violation) | ✅ (Astro's built-in content collection validation) |
| POST-02 | Each stub has frontmatter, gallery, voyage stats, Nebo summary | manual + build | `npm run build` + `grep -L "draft: true" src/content/blog/great-loop/2024-0[45]*.mdx src/content/blog/great-loop/2023-0[678]*.mdx` (spot-check no unexpected drafts flip) | ✅ / ❌ — no dedicated script exists to verify "has all four elements"; recommend a Wave 0 verification script |
| POST-03 | Every generated post reviewed/narrative-completed by Barbara before publish | manual | `grep -rl "draft: true" src/content/blog/great-loop/*.mdx \| wc -l` should be 0 for the two in-scope ranges at phase completion | ❌ — needs a Wave 0 helper script (see gaps below) |
| POST-05 | Last segment (Keys→New Bern) fully documented with AI-drafted, Barbara-reviewed narrative | manual + build | Same grep-based zero-draft check scoped to the Keys→New Bern date range | ❌ — same gap |

### Sampling Rate
- **Per task commit:** `npm run build` (fast — Astro build typically completes in seconds for a site this size; catches schema violations immediately)
- **Per wave merge:** `npm run build` + a grep-based `draft: true` count check scoped to the two in-scope date ranges
- **Phase gate:** `npm run build` passes with zero errors AND zero `draft: true` remaining in the two in-scope ranges AND voyage index (visually or via a script) shows no unexplained date gaps, per CONTEXT.md's phase-completion criteria

### Wave 0 Gaps
- [ ] A small verification script (or documented one-liner) that counts `draft: true` posts within exactly the two in-scope date ranges (2024-04-13→2024-05-17 and 2023-06-05→2023-08-31) — needed because a blanket `grep -rl "draft: true"` across the whole `great-loop/` directory would also match the ~187 explicitly out-of-scope stubs (D-05), giving a false-positive "not done" signal.
- [ ] A verification step confirming no `file://` URLs remain in any of the ~101 in-scope posts' Gallery arrays after the R2 upload script completes (the concrete symptom of Pitfall 4).
- [ ] No dedicated test framework install needed — this phase's "tests" are schema validation (already provided free by Astro's content collections) plus targeted grep/count checks, which are lightweight enough to write inline in verification tasks rather than standing up a formal test framework for a one-time content-migration phase.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Public read-only static site, no auth (per PROJECT.md/REQUIREMENTS.md SITE-01) |
| V3 Session Management | No | No sessions — static site |
| V4 Access Control | No | No user-facing access control; R2 bucket access control is infrastructure-level (see V6 below) |
| V5 Input Validation | Partial | MDX frontmatter is validated by Astro's Zod schema (`src/content.config.ts`) at build time — this is the existing, sufficient control; no new user input surfaces are introduced by this phase (all inputs are local files/APIs the developer controls, not untrusted user input) |
| V6 Cryptography / Secrets | Yes | `ANTHROPIC_API_KEY` and R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) must be handled the same way the existing `ANTHROPIC_API_KEY` is: environment variables, never committed to git. `.gitignore` already excludes `.env`/`.env.production` — the plan should add R2 credentials to the same `.env` file (or shell export) pattern, not hard-code them in a script. Use a **bucket-scoped, Object Read & Write** R2 API token (not an Account-level Admin token) to limit blast radius if the token ever leaks. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| R2 credentials committed to a script or git history | Information Disclosure | Environment variables only (`process.env.R2_ACCESS_KEY_ID`, etc.), matching the existing `getClient()` pattern in `07-quality-lift.mjs`; confirm `.env`/`.env.production` stay in `.gitignore` (already true) |
| Overly broad R2 API token scope (Account Admin instead of bucket-scoped) | Elevation of Privilege | Create the token as **Object Read & Write**, scoped to the single `jackieb3-photos` (or similarly named) bucket, not an Account-level Admin token |
| Publicly-readable R2 bucket unintentionally exposing non-voyage photos | Information Disclosure | Only upload the specific UUIDs already identified in `voyage-timeline-enriched.json` per in-scope day (Pattern 2's `--uuid`-based export) — never a blanket date-range or full-library export, which could pick up unrelated personal photos taken the same calendar day |

## Sources

### Primary (HIGH confidence)
- developers.cloudflare.com/r2/pricing/ — free tier limits (10GB storage, 1M Class A ops, 10M Class B ops, zero egress), fetched this session
- developers.cloudflare.com/r2/api/s3/api/ — S3-compatible endpoint format, region=auto, fetched this session
- developers.cloudflare.com/r2/buckets/public-buckets/ — r2.dev vs. custom domain setup and rate-limit caveat, fetched this session
- developers.cloudflare.com/r2/api/tokens/ — API token creation and permission scopes, fetched this session
- platform.claude.com/docs/en/build-with-claude/vision — image request limits, format support, resolution/token-cost tiers, image-then-text ordering guidance, fetched this session
- Direct machine inspection: `osxphotos --version` (0.75.7), `osxphotos export --help` (full flag set), `node -e "sharp.format.heif"` (confirms no HEIC input support), `npm view` for `@aws-sdk/client-s3`/`sharp`/`@anthropic-ai/sdk` current versions
- Direct repo/data inspection: `scripts/04-generate-stubs.mjs`, `scripts/07-quality-lift.mjs`, `scripts/00-index-photos.mjs`, `scripts/09-parse-nebo-details.mjs`, `.planning/data/voyage-timeline-enriched.json`, `src/data/daily-routes.json`, `src/content.config.ts`, `src/components/Gallery.astro`, `src/components/Lightbox.astro`, `src/components/VoyageStats.astro` — all read directly this session
- `slopcheck install @aws-sdk/client-s3` run directly against npm registry this session (result: `[OK]`)

### Secondary (MEDIUM confidence)
- WebSearch: "sharp npm HEIC input support" — corroborated by direct `sharp.format.heif` inspection on this machine (upgraded to effectively HIGH via direct verification)
- WebSearch: Cloudflare R2 pricing summaries (ThemeDev, egresscost.com, etc.) — used only to locate the search direction; actual figures cited in this document come from the official `developers.cloudflare.com/r2/pricing/` fetch, not these secondary sources

### Tertiary (LOW confidence)
- WebSearch mentions of third-party R2 wrapper libraries (`node-cloudflare-r2`, `aws4fetch`-based examples) — explicitly not recommended in this document; flagged `[ASSUMED]` and excluded from the Standard Stack

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version and API mechanic (R2 endpoint format, auth, sharp HEIC limitation, osxphotos flags, Claude vision limits) was verified directly against official docs or direct tool inspection on this machine, not inferred from training data
- Architecture: HIGH — the pipeline structure directly extends three existing, working scripts (`04-generate-stubs.mjs`, `07-quality-lift.mjs`, `00-index-photos.mjs`) whose code was read in full this session
- Pitfalls: HIGH — the two most consequential pitfalls (sharp/HEIC, photoCount<10 threshold) were root-caused with direct evidence (code inspection + data inspection confirming all 40 target dates fall below the threshold), not speculation

**Research date:** 2026-07-25
**Valid until:** 30 days (Cloudflare R2 pricing/API and Claude API vision limits are the most likely to shift; the internal codebase findings are stable until the phase itself modifies those files)
