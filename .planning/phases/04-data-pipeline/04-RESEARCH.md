# Phase 4: Data Pipeline — Research

**Researched:** 2026-07-09
**Domain:** Node.js ESM script — MDX frontmatter editing + stub file generation
**Confidence:** HIGH (all findings read directly from codebase)

## Summary

Phase 4 writes one script: `scripts/04-generate-stubs.mjs`. All upstream pipeline scripts
(00–03) are complete. The enriched timeline (`voyage-timeline-enriched.json`) is the single
data source — it already embeds Nebo stats per day so no separate `nebo-logs.json` load
is needed. The frontmatter-editing utilities (parse, serialize, split) already exist in
`scripts/07-quality-lift.mjs` and must be copied verbatim rather than re-invented.

The script has two sequential jobs: (1) backfill `miles`/`hours` into 45 existing MDX posts
that have matching Nebo data; (2) generate ~253 new `draft: true` MDX stubs for undocumented
days with 10+ photos. Both jobs operate on the same enriched timeline data.

**Primary recommendation:** Copy the three frontmatter utility functions from
`07-quality-lift.mjs` and drive everything from `voyage-timeline-enriched.json`. Do not load
`nebo-logs.json` separately — the enriched timeline already has `day.nebo` embedded.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Stub threshold: 10+ photos (yields ~253 stubs)
- **D-02** No minimum Nebo data requirement — photo count alone drives qualification
- **D-03** Date range: April 1, 2022 through May 17, 2024
- **D-04** Edit existing MDX files in-place for miles/hours backfill
- **D-05** Backfill: add `miles` (from `distanceNm`) and `hours` (from `underwayHours`) to 45 posts with Nebo data
- **D-06** Posts with no Nebo data: leave `miles`/`hours` absent entirely — do NOT set to 0
- **D-07** Matching by ISO date string `YYYY-MM-DD`
- **D-08** 4 posts missing `lat`/`lon`: backfill from `centroidLat`/`centroidLon` if available
- **D-09** Stubs: full component structure — `draft: true`, `lat`, `lon`, `miles`, `hours`, `location`, `title` + Gallery + VoyageStats
- **D-10** Photo sort: ascending by timestamp (original capture order)
- **D-11** Stub title format: `"Day {N} — {location}"` (Day 1 = April 22, 2022)
- **D-12** Stub slug format: `{YYYY-MM-DD}-day-{N}-{location-slug}`

### Claude's Discretion

- Exact placeholder text for required `excerpt` field in stubs
- Whether to use a dedicated idempotency flag (`stubs_generated: true`) or check for existing fields
- Day-number convention for pre-departure days (April 1–21, 2022)

### Deferred Ideas (OUT OF SCOPE)

- GPX track simplification and per-day GeoJSON → Phase 5
- AI-assisted narrative generation for stubs → Phase 6
- Cloudinary/CDN photo migration → out of scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-05 | Frontmatter enriched with lat/lon/miles for all posts where GPS data exists | Job 1: in-place backfill using enriched timeline centroid + nebo fields |
| DATA-07 | Last segment (Days 259 → May 2024) fully represented with photos + GPS | Job 2: stub generation covers this range; enriched timeline has full coverage |
| POST-01 | MDX stubs generated for all undocumented stops using GPS + EXIF + Nebo data | Job 2: 04-generate-stubs.mjs |
| POST-02 | Each stub includes auto-populated frontmatter, photo gallery, voyage stats | Job 2: Gallery + VoyageStats components with real data |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Frontmatter backfill | Build-time script | — | Offline transform; edits MDX files on disk |
| Stub generation | Build-time script | — | Offline file creation; Astro consumes output at build |
| Data reading | Build-time script | — | Reads .planning/data JSON; no runtime dependency |
| Draft filtering | Astro content layer | — | Astro filters `draft: true` posts from getCollection |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` | built-in | Read/write MDX files | Same pattern as all existing scripts [VERIFIED: project codebase] |
| `node:path` | built-in | Path resolution | Same pattern as all existing scripts [VERIFIED: project codebase] |
| `node:url` | built-in | `fileURLToPath` for `__dirname` | Required in ESM modules; used in every script [VERIFIED: project codebase] |

**No npm packages needed for this script.** `gray-matter` is NOT in `package.json`. All
frontmatter parsing uses custom inline utilities already present in the codebase. [VERIFIED: project package.json]

### Package Availability

`package.json` dependencies as of research date:

| Package | In package.json | Notes |
|---------|----------------|-------|
| gray-matter | NO | Not installed; do not use |
| slugify | NO | Not installed; implement inline |
| @anthropic-ai/sdk | YES | Not needed for this script |
| astro | YES | Not needed at script runtime |

## Package Legitimacy Audit

No external packages to install for this script. All utilities are Node.js built-ins or
functions copied from existing project scripts.

**Packages removed due to slopcheck:** none
**Packages flagged as suspicious:** none

## Architecture Patterns

### System Architecture Diagram

```
voyage-timeline-enriched.json
        |
        v
  [load & index by date]
        |
        +---> Job 1: Backfill existing posts
        |      |
        |      v
        |   src/content/blog/great-loop/*.mdx  (read)
        |      |
        |      v
        |   [splitFrontmatter → parseFrontmatter → mutate → serializeFrontmatter]
        |      |
        |      v
        |   src/content/blog/great-loop/*.mdx  (write in-place)
        |
        +---> Job 2: Generate stubs
               |
               v
           [filter: photoCount >= 10 AND date not already covered]
               |
               v
           [compute dayNumber, slugify location, build frontmatter + body]
               |
               v
           src/content/blog/great-loop/{YYYY-MM-DD}-day-{N}-{slug}.mdx  (create)
```

### Recommended Project Structure

This script fits into the existing `scripts/` directory pattern:

```
scripts/
├── 00-index-photos.mjs    # done
├── 01-build-timeline.mjs  # done
├── 02-parse-nebo.mjs      # done
├── 03-correlate.mjs       # done
└── 04-generate-stubs.mjs  # THIS PHASE
```

Output files go to `src/content/blog/great-loop/` (existing directory).

### Pattern 1: Frontmatter Utility Functions (copy verbatim from 07-quality-lift.mjs)

**What:** Three-function pattern to read, mutate, and write back MDX frontmatter without any
npm dependency.

**Source:** `scripts/07-quality-lift.mjs` lines 100–152 [VERIFIED: project codebase]

```javascript
// Source: scripts/07-quality-lift.mjs:100-107
function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: '', body: text };
  const frontmatter = text.slice(4, end); // strip opening ---\n
  const body = text.slice(end + 4).replace(/^\n/, ''); // strip closing ---\n
  return { frontmatter, body };
}

// Source: scripts/07-quality-lift.mjs:114-132
function parseFrontmatter(yaml) {
  // Parses flat YAML only (no nested). Handles string, number, boolean, quoted strings.
  // Returns plain object.
}

// Source: scripts/07-quality-lift.mjs:138-152
function serializeFrontmatter(obj) {
  // Serializes object back to YAML. Skips null/undefined values.
  // Quotes strings containing colons, hashes, and other special chars.
}
```

**Write-back pattern** (also verbatim from `07-quality-lift.mjs` line 398):
```javascript
const newContent = `---\n${serializeFrontmatter(fm)}\n---\n\n${newBody}\n`;
writeFileSync(filePath, newContent, 'utf8');
```

**Critical:** `parseFrontmatter` is flat-only. It does NOT handle nested YAML or YAML arrays.
All existing frontmatter fields are flat scalars — this is fine. [VERIFIED: project codebase]

### Pattern 2: Data Loading (from enriched timeline only)

**What:** Load the single enriched timeline; index by date; access `day.nebo` for stats.

```javascript
// Source: scripts/03-correlate.mjs structure + direct inspection of data file
const timelineRaw = JSON.parse(readFileSync(join(DATA_DIR, 'voyage-timeline-enriched.json'), 'utf8'));
const timelineByDate = new Map();
for (const day of timelineRaw.days) {
  timelineByDate.set(day.date, day);
}

// Access nebo stats directly — no separate nebo-logs.json needed:
const day = timelineByDate.get('2022-04-22');
// day.nebo === null  (no Nebo data for this day)
// day.nebo.distanceNm  (miles)
// day.nebo.underwayHours  (hours)
```

[VERIFIED: direct inspection of .planning/data/voyage-timeline-enriched.json]

### Pattern 3: MDX Body Structure for Stubs

**What:** Exact body format for generated stub files. Confirmed from two existing posts.

**Source:** `src/content/blog/great-loop/2022-04-22-the-adventure-begins.mdx` [VERIFIED: project codebase]

```mdx
---
title: "Day 1 — Belhaven NC"
date: 2022-04-22
voyage: great-loop
location: Belhaven NC
excerpt: "Photos from April 22, 2022"
migrated: false
draft: true
lat: 35.543
lon: -76.623
miles: 65.6
hours: 7.2
---

import VoyageStats from '../../../components/VoyageStats.astro'
import Gallery from '../../../components/Gallery.astro'

<VoyageStats miles={65.6} hours={7.2} />

<Gallery images={[
    "file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/C/CFE05BF6-2A99-4A03-9821-59ADFA6B335D.heic",
    "file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/8/8496A86E-BA85-4C27-B4E3-E1071EA6ABBF.mov"
  ]} />
```

When Nebo data is absent, omit `miles`/`hours` from frontmatter AND omit props from VoyageStats:

```mdx
<VoyageStats />
```

### Pattern 4: Photo Path Construction

**Source:** `scripts/07-quality-lift.mjs` lines 297–299 [VERIFIED: project codebase]

```javascript
const path = `file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/${p.directory}/${p.filename}`;
```

Where `p.directory` = first character of UUID (e.g., `"C"` for UUID starting with `C`).
The `directory` field is already pre-computed in each photo object in the enriched timeline.

### Pattern 5: Slug Generation (inline, no package)

No `slugify` package is available. Implement inline:

```javascript
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // strip special chars
    .trim()
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-');            // collapse multiple hyphens
}
// "New Bern NC" → "new-bern-nc"
// "Chesapeake City, MD" → "chesapeake-city-md"
```

### Pattern 6: Idempotency

- **Backfill job**: Skip posts that already have `miles` set in frontmatter (or check enriched: true covers lat/lon already)
- **Stub job**: Check `existsSync(filePath)` before writing; skip if file exists and log it

### Anti-Patterns to Avoid

- **Loading nebo-logs.json separately**: The enriched timeline already has `day.nebo` embedded. Loading both files is redundant and introduces a second source of truth.
- **Using gray-matter**: Not installed; importing it will crash. Use the custom functions.
- **Setting miles/hours to 0**: D-06 explicitly forbids this. Check `day.nebo === null` and skip those fields entirely.
- **Writing stubs over existing posts**: Check `existsSync` before every write; log conflicts and skip.
- **Nested YAML in frontmatter**: `parseFrontmatter` is flat-only. Do not add arrays or nested objects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frontmatter parsing | custom YAML parser | Copy from `07-quality-lift.mjs` | Already tested on all 72 posts |
| File discovery | glob package | `readdirSync` + filter | Same pattern as existing scripts |
| Date arithmetic | date library | `Date` object math | Simple subtraction for day numbers |

## Data Field Reference

### voyage-timeline-enriched.json

**Top level:**
```json
{
  "generated": "ISO timestamp",
  "stats": { "totalDays": 634, "withPhotos": 628, "withNebo": 162, ... },
  "days": [...]
}
```

**Per day:**
```json
{
  "date": "2022-04-01",
  "location": "New Bern NC",
  "centroidLat": 35.103,
  "centroidLon": -77.0391,
  "milesFromPrev": 0,
  "photoCount": 62,
  "withGps": 61,
  "nebo": null,
  "photos": [...]
}
```

**nebo when present:**
```json
"nebo": {
  "distanceNm": 65.6,
  "underwayHours": 7.183333333333334,
  "underwayFormatted": "7:11",
  "durationHours": 7.35,
  "durationFormatted": "7:21",
  "avgSpeedKts": 9.1,
  "maxSpeedKts": 22.2
}
```

**nebo when absent:**
```json
"nebo": null
```

[VERIFIED: direct file inspection — line ~580, ~1716 of voyage-timeline-enriched.json]

**Per photo:**
```json
{
  "uuid": "E218186D-1B1F-4694-A364-6C6AEC351820",
  "filename": "E218186D-1B1F-4694-A364-6C6AEC351820.heic",
  "directory": "E",
  "kind": 0,
  "ts": 1648837932.7315598,
  "lat": 35.103,
  "lon": -77.039
}
```

- `ts`: Unix timestamp in seconds (sort ascending for D-10)
- `directory`: first character of UUID — the Photos library subdirectory
- `kind`: 0 = photo, 1 = video (both included in Gallery)
- `lat`/`lon`: may be `null` for photos without GPS

[VERIFIED: direct file inspection of voyage-timeline-enriched.json]

### content.config.ts Zod Schema

| Field | Type | Required? | Notes |
|-------|------|-----------|-------|
| title | z.string() | YES | |
| date | z.coerce.date() | YES | accepts "YYYY-MM-DD" string |
| voyage | z.string() | YES | use "great-loop" |
| location | z.string() | YES | |
| excerpt | z.string() | YES | **No default — stubs need a placeholder** |
| migrated | z.boolean().default(false) | YES (defaults false) | stubs = false |
| lifted | z.boolean().default(false) | optional (defaults false) | stubs = false |
| miles | z.number().optional() | NO | omit when no Nebo data |
| hours | z.number().optional() | NO | omit when no Nebo data |
| lat | z.number().optional() | NO | |
| lon | z.number().optional() | NO | |
| coverPhoto | z.string().optional() | NO | omit in stubs |
| anchorage | z.string().optional() | NO | omit in stubs |
| marina | z.string().optional() | NO | omit in stubs |
| draft | NOT in schema | N/A | Astro built-in — see below |
| enriched | NOT in schema | N/A | Idempotency gate only |

[VERIFIED: src/content.config.ts direct read]

## Common Pitfalls

### Pitfall 1: excerpt Is Required — Stubs Will Fail Schema Validation Without It

**What goes wrong:** `npm run build` crashes with Zod validation error on all stub files.
**Why it happens:** `excerpt: z.string()` has no `.optional()` or `.default()`. A stub with
missing `excerpt` fails Astro's content layer validation.
**How to avoid:** Every stub must include an `excerpt`. Recommended placeholder:
`Photos from {location}` (e.g., `"Photos from New Bern NC"`).
**Warning signs:** Build error referencing a generated stub filename and "excerpt is required".

### Pitfall 2: Nebo distanceNm = 0 Is NOT the Same as Null

**What goes wrong:** Script treats `distanceNm: 0` as "no data" and skips it.
**Why it happens:** The enriched timeline has entries where `nebo.distanceNm === 0` —
these are legitimate zero-distance days (e.g., stayed at dock). `day.nebo === null` is the
correct "no data" check.
**How to avoid:** Only skip miles/hours when `day.nebo === null`. When `day.nebo` is an object,
always use its values even if they are 0.

### Pitfall 3: parseFrontmatter Handles Flat YAML Only

**What goes wrong:** If any existing MDX file has nested YAML or multi-line strings in
frontmatter, `parseFrontmatter` will mangle them on write-back.
**Why it happens:** The custom parser splits on `:` and has no YAML array/object support.
**How to avoid:** All 72 existing posts use only flat scalar frontmatter values — confirmed
by reading sample posts. Do not add any nested structures to frontmatter. The `photos[]`
array stays in the MDX body as JSX, not in frontmatter.
**Warning signs:** Post renders with missing or garbled fields after backfill run.

### Pitfall 4: Day Numbering for Pre-Departure Days

**What goes wrong:** Days before April 22, 2022 produce negative or zero day numbers with
the formula `dayN = Math.floor((dateMs - departureMs) / 86400000) + 1`.
**Why it happens:** D-03 includes April 1–21 in scope; D-11 defines Day 1 as April 22.
**How to avoid:** The CONTEXT.md says D-11 title format is `"Day {N} — {location}"`. For
pre-departure days, compute N as a negative offset (e.g., April 21 = Day 0, April 1 = Day -20).
This produces valid unique slugs. Alternatively, use `"Pre-Departure — {location}"` title
format for days where N <= 0. This decision is Claude's discretion.

### Pitfall 5: Slug Conflicts with Existing MDX Files

**What goes wrong:** Script overwrites an existing documented post.
**Why it happens:** A date that already has an MDX post also qualifies (10+ photos) for a stub.
**How to avoid:** Build a Set of existing filenames at startup. Before writing any stub,
check `existingFilenames.has(slug + '.mdx')`. Skip and log rather than overwrite. Date-based
matching covers most cases since existing posts have their date in the filename.

### Pitfall 6: Astro draft Field — Not in Zod Schema

**What goes wrong:** Confusion about whether `draft: true` needs to be in the Zod schema.
**Why it happens:** Astro treats `draft` as a special reserved field handled before Zod validation.
**How to avoid:** Write `draft: true` in frontmatter as-is. Astro strips it before Zod sees it.
The Zod schema in `content.config.ts` intentionally omits `draft`. Do NOT add it to the schema.
**Source:** CONTEXT.md states "draft is not in schema (Astro handles it as a built-in)"
[ASSUMED — not independently verified against Astro 5 docs, but confirmed by CONTEXT.md as user decision]

## Code Examples

### Job 1: Backfill Pattern

```javascript
// Source: adapted from scripts/07-quality-lift.mjs enrichPosts function
for (const filePath of mdxFiles) {
  const slug = basename(filePath, '.mdx');
  const raw  = readFileSync(filePath, 'utf8');
  const { frontmatter: fmStr, body } = splitFrontmatter(raw);
  const fm = parseFrontmatter(fmStr);

  // Idempotency: skip if already backfilled
  if (fm.miles !== undefined && fm.hours !== undefined) {
    console.log(`SKIP  ${slug} (already has miles/hours)`);
    continue;
  }

  const dateStr = fm.date ? String(fm.date).slice(0, 10) : slug.slice(0, 10);
  const day = timelineByDate.get(dateStr);
  if (!day) { console.log(`SKIP  ${slug} (no timeline data)`); continue; }

  let mutated = false;

  // D-05: backfill miles/hours from nebo
  if (day.nebo !== null && day.nebo !== undefined) {
    if (fm.miles === undefined) { fm.miles = Math.round(day.nebo.distanceNm * 10) / 10; mutated = true; }
    if (fm.hours === undefined) { fm.hours = Math.round(day.nebo.underwayHours * 10) / 10; mutated = true; }
  }
  // D-08: backfill lat/lon if missing
  if (fm.lat === undefined && day.centroidLat !== undefined) { fm.lat = day.centroidLat; mutated = true; }
  if (fm.lon === undefined && day.centroidLon !== undefined) { fm.lon = day.centroidLon; mutated = true; }

  if (mutated) {
    writeFileSync(filePath, `---\n${serializeFrontmatter(fm)}\n---\n\n${body}\n`, 'utf8');
    console.log(`BACKFILL ${slug}`);
  }
}
```

### Job 2: Stub Generation Pattern

```javascript
// Departure date for day-number calculation
const DEPARTURE = new Date('2022-04-22T00:00:00Z');

function dayNumber(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return Math.floor((d - DEPARTURE) / 86400000) + 1;
}

function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

// Collect existing filenames to avoid conflicts
const existing = new Set(readdirSync(POSTS_DIR).filter(f => f.endsWith('.mdx')));

for (const day of timelineRaw.days) {
  // D-01: threshold
  if (day.photoCount < 10) continue;
  // D-03: date range
  if (day.date < '2022-04-01' || day.date > '2024-05-17') continue;

  const dayN    = dayNumber(day.date);
  const loc     = day.location || `${day.centroidLat}, ${day.centroidLon}`;
  const locSlug = toSlug(loc);
  const slug    = `${day.date}-day-${dayN}-${locSlug}`;
  const filename = `${slug}.mdx`;

  // D-12: skip if existing post covers this date (check by filename prefix too)
  if (existing.has(filename)) { console.log(`SKIP  ${filename} (exists)`); continue; }

  // Check if any existing file starts with this date
  const datePrefix = day.date;
  if ([...existing].some(f => f.startsWith(datePrefix))) {
    console.log(`SKIP  ${filename} (date already covered by existing post)`);
    continue;
  }

  // Build frontmatter
  const fm = {
    title: `Day ${dayN} — ${loc}`,
    date: day.date,
    voyage: 'great-loop',
    location: loc,
    excerpt: `Photos from ${loc}`,
    migrated: false,
    draft: true,
  };
  if (day.centroidLat !== undefined) fm.lat  = day.centroidLat;
  if (day.centroidLon !== undefined) fm.lon  = day.centroidLon;
  if (day.nebo !== null && day.nebo !== undefined) {
    fm.miles = Math.round(day.nebo.distanceNm * 10) / 10;
    fm.hours = Math.round(day.nebo.underwayHours * 10) / 10;
  }

  // Build body
  const vsProps = fm.miles !== undefined ? `miles={${fm.miles}} hours={${fm.hours}}` : '';
  const photos  = [...day.photos].sort((a, b) => a.ts - b.ts); // D-10: ascending ts
  const imageList = photos.map(p =>
    `"file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/${p.directory}/${p.filename}"`
  ).join(',\n    ');

  const body = [
    `import VoyageStats from '../../../components/VoyageStats.astro'`,
    `import Gallery from '../../../components/Gallery.astro'`,
    ``,
    `<VoyageStats ${vsProps} />`,
    ``,
    `<Gallery images={[`,
    `    ${imageList}`,
    `  ]} />`,
  ].join('\n');

  const content = `---\n${serializeFrontmatter(fm)}\n---\n\n${body}\n`;
  writeFileSync(join(POSTS_DIR, filename), content, 'utf8');
  console.log(`STUB  ${filename}`);
}
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | No automated test framework configured |
| Config file | none |
| Quick run command | `npm run build 2>&1 | grep -c "error"` |
| Full suite command | `npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-05 | Existing posts have miles/hours in frontmatter after script | manual | `grep -l "^miles:" src/content/blog/great-loop/*.mdx | wc -l` | N/A |
| DATA-05 | Posts with no Nebo data do NOT have miles: 0 | manual | `grep -r "miles: 0" src/content/blog/great-loop/` | N/A |
| POST-01 | Stub files created for 10+ photo days | manual | `grep -rl "draft: true" src/content/blog/great-loop/ | wc -l` | N/A |
| POST-02 | Stubs pass Astro build validation | smoke | `npm run build` | ✅ |

### Sampling Rate

- **Per task commit:** `npm run build` (Astro schema validation catches all malformed frontmatter)
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green before `/gsd:verify-work`

### Wave 0 Gaps

None — no test infrastructure changes needed. Astro build validation serves as the automated
gate for this script phase.

## Open Questions (RESOLVED)

1. **Pre-departure day numbering (April 1–21, 2022)**
   - What we know: D-03 includes these dates; D-11 defines Day 1 = April 22
   - What's unclear: Title format for days when N <= 0 (Day -20 through Day 0)
   - Recommendation: Use `Day ${dayN}` regardless (produces "Day -20 — New Bern NC"); this yields a valid unique slug. If user prefers "Pre-Departure — {loc}", make that Claude's discretion.
   - **RESOLVED:** Use `Day ${dayN}` as-is (e.g., "Day -20 — New Bern NC"). `dayNumber()` uses `DEPARTURE = 2022-04-22` as anchor; pre-departure days produce negative integers which yield valid, unique slugs.

2. **excerpt placeholder text**
   - What we know: Zod requires `excerpt: z.string()` — no default, no optional
   - What's unclear: What string to use for auto-generated stubs
   - Recommendation: `"Photos from {location}"` (e.g., `"Photos from New Bern NC"`). Placeholder text; Barbara replaces when she writes the narrative.
   - **RESOLVED:** Use `"Photos from ${loc}"` as the excerpt placeholder on every generated stub.

3. **Backfill idempotency gate**
   - What we know: 07-quality-lift.mjs uses dedicated boolean flags (`lifted: true`, `enriched: true`)
   - What's unclear: Should we add `backfilled: true` to frontmatter or just check `miles !== undefined`
   - Recommendation: Check `fm.miles !== undefined` as the gate (simpler, no extra frontmatter noise). If only lat/lon need backfilling (D-08), check those separately.
   - **RESOLVED:** Gate on `fm.miles !== undefined` (skip post if miles already set). For lat/lon backfill (D-08), gate separately on `fm.lat === undefined`. No extra frontmatter flag added.

4. **VoyageStats with miles/hours = 0**
   - What we know: D-06 says don't set 0 for POSTS WITH NO NEBO DATA. But `day.nebo.distanceNm` can equal 0 (dock days with real Nebo entry)
   - What's unclear: Should dock days (nebo.distanceNm === 0) have `<VoyageStats miles={0} hours={0} />` in stubs?
   - Recommendation: Yes — if `day.nebo` is non-null, always use its values. `miles={0}` is a factually accurate reading.
   - **RESOLVED:** If `day.nebo !== null`, always use its values including 0. D-06 applies only when `day.nebo === null` (no Nebo data at all).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >=22.12.0 | Script runtime | ✓ | per engines field | — |
| voyage-timeline-enriched.json | Both jobs | ✓ | generated 2026-04-14 | Re-run script 03 |
| src/content/blog/great-loop/ | Both jobs | ✓ | 72 posts present | — |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `draft: true` in frontmatter is handled by Astro before Zod validation | Common Pitfalls #6 | Build failure on all ~253 stub files; fix = add `draft: z.boolean().optional()` to schema |
| A2 | The enriched timeline `nebo: null` pattern reliably indicates no Nebo data (vs. Nebo data with all zeros) | Data Field Reference | Could incorrectly skip valid zero-distance days — risk is LOW since `nebo: null` and `nebo: {...}` are structurally distinct |

## Sources

### Primary (HIGH confidence)

- `scripts/07-quality-lift.mjs` — frontmatter utility functions, in-place edit pattern, Gallery/VoyageStats body structure
- `src/content.config.ts` — Zod schema, required/optional fields
- `src/content/blog/great-loop/2022-04-22-the-adventure-begins.mdx` — canonical MDX stub format with VoyageStats + Gallery
- `.planning/data/voyage-timeline-enriched.json` — data shape, nebo embedding, photo fields
- `package.json` — confirms no gray-matter, no slugify

### Secondary (MEDIUM confidence)

- `.planning/phases/04-data-pipeline/04-CONTEXT.md` — locked decisions; authoritative for all D-## decisions

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Frontmatter editing pattern: HIGH — read directly from 07-quality-lift.mjs
- Data field names: HIGH — read directly from enriched timeline JSON
- Zod schema: HIGH — read directly from content.config.ts
- Astro draft behavior: ASSUMED — confirmed by CONTEXT.md user decision but not re-verified against Astro 5 docs
- Slug generation: HIGH — no package available; inline function is the only option

**Research date:** 2026-07-09
**Valid until:** 2026-08-09 (stable project; Astro upgrade could change draft behavior)
