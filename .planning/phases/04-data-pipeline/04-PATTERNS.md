# Phase 4: Data Pipeline — Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 3 (1 new script + 45 existing MDX backfills + ~253 new MDX stubs)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/04-generate-stubs.mjs` | utility/transform script | batch + file-I/O | `scripts/07-quality-lift.mjs` | exact |
| `src/content/blog/great-loop/*.mdx` (45 backfills) | content | file-I/O (in-place edit) | `scripts/07-quality-lift.mjs` enrichPosts() | exact |
| `src/content/blog/great-loop/{date}-day-{N}-{slug}.mdx` (~253 stubs) | content | file-I/O (create) | `src/content/blog/great-loop/2022-04-16-getting-ready-to-go.mdx` | exact |

---

## Pattern Assignments

### `scripts/04-generate-stubs.mjs` (utility/transform, batch + file-I/O)

**Analog:** `scripts/07-quality-lift.mjs`

**Imports + path constants pattern** (lines 39–47):

```javascript
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const DATA_DIR  = join(ROOT, '.planning', 'data');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');
```

**No external packages.** `gray-matter` is not in `package.json`. All frontmatter
utilities are custom inline functions. Do not `import` any npm package except
`@anthropic-ai/sdk` (which is not needed for this script either).

---

**`splitFrontmatter` function** (lines 100–107 verbatim):

```javascript
function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: '', body: text };
  const frontmatter = text.slice(4, end); // strip opening ---\n
  const body = text.slice(end + 4).replace(/^\n/, ''); // strip closing ---\n
  return { frontmatter, body };
}
```

**`parseFrontmatter` function** (lines 114–131 verbatim):

```javascript
function parseFrontmatter(yaml) {
  const obj = {};
  for (const line of yaml.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    let val = line.slice(colon + 1).trim();
    if (val === 'true') obj[key] = true;
    else if (val === 'false') obj[key] = false;
    else if (val !== '' && !isNaN(Number(val))) obj[key] = Number(val);
    else if ((val.startsWith('"') && val.endsWith('"')) ||
             (val.startsWith("'") && val.endsWith("'"))) {
      obj[key] = val.slice(1, -1);
    }
    else obj[key] = val;
  }
  return obj;
}
```

CRITICAL: This parser is flat-only. It does NOT handle YAML arrays or nested
objects. All existing post frontmatter uses only flat scalar values — this is fine.
Never add nested structures to frontmatter.

**`serializeFrontmatter` function** (lines 138–152 verbatim):

```javascript
function serializeFrontmatter(obj) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else if (typeof v === 'number') lines.push(`${k}: ${v}`);
    else {
      const needs = /[:#{}\[\]|>&*!'",%@`?]/.test(String(v));
      if (needs) lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
      else lines.push(`${k}: ${v}`);
    }
  }
  return lines.join('\n');
}
```

**Write-back pattern** (line 319 / 398 verbatim):

```javascript
const newContent = `---\n${serializeFrontmatter(fm)}\n---\n\n${newBody}\n`;
writeFileSync(filePath, newContent, 'utf8');
```

---

**Timeline loading pattern** (lines 83–92, adapted — use enriched timeline only, no nebo-logs.json):

```javascript
const timelineRaw = JSON.parse(
  readFileSync(join(DATA_DIR, 'voyage-timeline-enriched.json'), 'utf8')
);

const timelineByDate = new Map();
for (const day of timelineRaw.days) {
  timelineByDate.set(day.date, day);
}
console.log(`Timeline loaded: ${timelineByDate.size} dated entries`);
```

Do NOT load `nebo-logs.json` separately. The enriched timeline already embeds
`day.nebo` per day. Loading both files introduces a second source of truth.

---

**MDX file discovery pattern** (lines 335–339 verbatim):

```javascript
const mdxFiles = readdirSync(POSTS_DIR)
  .filter(f => extname(f) === '.mdx')
  .map(f => join(POSTS_DIR, f))
  .sort();
```

---

**Idempotency + in-place edit loop** (lines 347–399, adapted for backfill job):

```javascript
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

  // D-05: backfill miles/hours — only when nebo is non-null (D-06: never set 0 for no-data)
  if (day.nebo !== null && day.nebo !== undefined) {
    if (fm.miles === undefined) { fm.miles = Math.round(day.nebo.distanceNm * 10) / 10; mutated = true; }
    if (fm.hours === undefined) { fm.hours = Math.round(day.nebo.underwayHours * 10) / 10; mutated = true; }
  }
  // D-08: backfill lat/lon for 4 posts that are missing them
  if (fm.lat === undefined && day.centroidLat !== null) { fm.lat = day.centroidLat; mutated = true; }
  if (fm.lon === undefined && day.centroidLon !== null) { fm.lon = day.centroidLon; mutated = true; }

  if (mutated) {
    writeFileSync(filePath, `---\n${serializeFrontmatter(fm)}\n---\n\n${body}\n`, 'utf8');
    console.log(`BACKFILL ${slug}`);
  }
}
```

CRITICAL: `day.nebo === null` means no data. `day.nebo.distanceNm === 0` means
the boat stayed at dock — this is valid Nebo data and must be written as `miles: 0`,
not skipped.

---

**Conflict-avoidance + stub generation loop** (adapted from enrichment pass, lines 247–330):

```javascript
const DEPARTURE = new Date('2022-04-22T00:00:00Z');

function dayNumber(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return Math.floor((d - DEPARTURE) / 86400000) + 1;
}

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Build set of existing filenames to prevent overwrite (D-12 / Pitfall 5)
const existing = new Set(readdirSync(POSTS_DIR).filter(f => f.endsWith('.mdx')));

for (const day of timelineRaw.days) {
  if (day.photoCount < 10) continue;                           // D-01
  if (day.date < '2022-04-01' || day.date > '2024-05-17') continue; // D-03

  const dayN    = dayNumber(day.date);
  const loc     = day.location || `${day.centroidLat}, ${day.centroidLon}`;
  const slug    = `${day.date}-day-${dayN}-${toSlug(loc)}`;
  const filename = `${slug}.mdx`;

  // Skip if exact file exists
  if (existing.has(filename)) { console.log(`SKIP  ${filename} (exists)`); continue; }
  // Skip if any existing file starts with this date (D-05 / Pitfall 5)
  if ([...existing].some(f => f.startsWith(day.date))) {
    console.log(`SKIP  ${filename} (date covered by existing post)`);
    continue;
  }

  // ... build and write stub (see MDX Stub section below)
}
```

**Summary log pattern** (lines 446–458):

```javascript
console.log('── Generate Stubs Complete ──────────────────────────');
console.log(`  Posts backfilled: ${backfilled}`);
console.log(`  Posts skipped:    ${backfillSkipped}`);
console.log(`  Stubs created:    ${stubsCreated}`);
console.log(`  Stubs skipped:    ${stubsSkipped}`);
```

---

### `src/content/blog/great-loop/{date}-day-{N}-{slug}.mdx` (~253 stubs, file-I/O create)

**Analog:** `src/content/blog/great-loop/2022-04-16-getting-ready-to-go.mdx`
**Secondary analog:** `src/content/blog/great-loop/2022-07-07-oswego-canal-day-77.mdx`
(the only existing post with `VoyageStats miles={N} hours={N}` in the body)

**Required Zod fields** (from `src/content.config.ts` lines 8–14):

```
title      z.string()              REQUIRED — no default
date       z.coerce.date()         REQUIRED — accepts "YYYY-MM-DD"
voyage     z.string()              REQUIRED — use "great-loop"
location   z.string()              REQUIRED
excerpt    z.string()              REQUIRED — no default, no optional; stubs MUST provide
migrated   z.boolean().default(false)   defaults false
```

Optional fields:

```
miles      z.number().optional()
hours      z.number().optional()
lat        z.number().optional()
lon        z.number().optional()
```

`draft` is NOT in the Zod schema — Astro strips it before schema validation. Write
`draft: true` in frontmatter as-is.

**Full stub template** (when Nebo data IS available):

```mdx
---
title: "Day 77 — Oswego NY"
date: 2022-07-07
voyage: great-loop
location: Oswego NY
excerpt: Photos from Oswego NY
migrated: false
draft: true
lat: 44.2288
lon: -76.4805
miles: 47.1
hours: 5.4
---

import VoyageStats from '../../../components/VoyageStats.astro'
import Gallery from '../../../components/Gallery.astro'

<VoyageStats miles={47.1} hours={5.4} />

<Gallery images={[
    "file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/E/E09CAB4D-8111-4CB4-9E62-D4DA28305785.jpeg",
    "file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/D/D1F2F5E9-31E8-4344-ABD2-E64F29F34DEB.jpeg"
  ]} />
```

**Stub template when Nebo data is absent** (omit `miles`/`hours` from frontmatter AND from VoyageStats props — D-06):

```mdx
---
title: "Day 23 — New Bern NC"
date: 2022-05-14
voyage: great-loop
location: New Bern NC
excerpt: Photos from New Bern NC
migrated: false
draft: true
lat: 35.103
lon: -77.039
---

import VoyageStats from '../../../components/VoyageStats.astro'
import Gallery from '../../../components/Gallery.astro'

<VoyageStats />

<Gallery images={[
    "file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/4/427C183F-64E7-4200-85C9-0AE465D0E839.heic"
  ]} />
```

**Stub body construction** (code to put in the generator):

```javascript
// D-10: sort photos ascending by timestamp
const photos = [...day.photos].sort((a, b) => a.ts - b.ts);

// Photo path pattern (from 07-quality-lift.mjs lines 297-299)
const imageList = photos.map(p =>
  `"file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/${p.directory}/${p.filename}"`
).join(',\n    ');

// VoyageStats props — only include if nebo is non-null (D-06)
const vsProps = (day.nebo !== null && day.nebo !== undefined)
  ? `miles={${Math.round(day.nebo.distanceNm * 10) / 10}} hours={${Math.round(day.nebo.underwayHours * 10) / 10}}`
  : '';

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
```

**Frontmatter object construction** (field order follows existing post convention):

```javascript
const fm = {
  title: `Day ${dayN} — ${loc}`,       // D-11
  date: day.date,
  voyage: 'great-loop',
  location: loc,
  excerpt: `Photos from ${loc}`,        // required field; placeholder text
  migrated: false,
  draft: true,
};
// Optional geo fields
if (day.centroidLat !== null && day.centroidLat !== undefined) fm.lat = day.centroidLat;
if (day.centroidLon !== null && day.centroidLon !== undefined) fm.lon = day.centroidLon;
// Optional Nebo fields — omit entirely when nebo is null (D-06)
if (day.nebo !== null && day.nebo !== undefined) {
  fm.miles = Math.round(day.nebo.distanceNm * 10) / 10;
  fm.hours = Math.round(day.nebo.underwayHours * 10) / 10;
}
```

---

## Shared Patterns

### ESM Module Boilerplate
**Source:** `scripts/07-quality-lift.mjs` lines 39–47 AND `scripts/03-correlate.mjs` lines 16–22
**Apply to:** `scripts/04-generate-stubs.mjs`

```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const DATA_DIR  = join(ROOT, '.planning', 'data');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');
```

### Date-String Extraction from Frontmatter
**Source:** `scripts/07-quality-lift.mjs` lines 362 and 274
**Apply to:** Job 1 (backfill loop), any place a post's date is needed

```javascript
// Derive YYYY-MM-DD from frontmatter.date or from filename prefix
const dateStr = fm.date ? String(fm.date).slice(0, 10) : slug.slice(0, 10);
```

`parseFrontmatter` may return `date` as a number (if YAML bare date parses as
numeric) — `String(fm.date).slice(0, 10)` handles both string and number safely.

### Skip-and-Log Error Handling
**Source:** `scripts/07-quality-lift.mjs` lines 403–408
**Apply to:** Both jobs in `04-generate-stubs.mjs`

```javascript
try {
  // ... mutate and write
} catch (err) {
  console.error(`FAIL  ${slug}: ${err.message}`);
  failed.push({ slug, error: err.message });
}
```

### File-Existence Guard Before Write
**Source:** `scripts/07-quality-lift.mjs` — `existsSync` import + pattern from enrichPosts
**Apply to:** Stub generation loop (prevent overwriting existing posts)

```javascript
import { existsSync } from 'node:fs';
// ...
if (existsSync(join(POSTS_DIR, filename))) {
  console.log(`SKIP  ${filename} (file already exists)`);
  continue;
}
```

### Photo Path Construction
**Source:** `scripts/07-quality-lift.mjs` lines 297–299
**Apply to:** Gallery image list in both stub bodies and the enrichment pass Gallery placeholder

```javascript
`"file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/${p.directory}/${p.filename}"`
```

`p.directory` is the first character of the UUID — this field is already
pre-computed on every photo object in `voyage-timeline-enriched.json`. No
path manipulation needed.

---

## Data Shape Reference (for planner)

### `voyage-timeline-enriched.json` — top level

```json
{
  "generated": "ISO timestamp",
  "stats": { "totalDays": 634, "withPhotos": 628, "withNebo": 162 },
  "days": [...]
}
```

### Per-day object

```json
{
  "date": "2022-04-01",
  "location": "New Bern NC",
  "centroidLat": 35.103,
  "centroidLon": -77.0391,
  "photoCount": 62,
  "withGps": 61,
  "photos": [...],
  "nebo": null
}
```

### `nebo` when present

```json
"nebo": {
  "distanceNm": 47.1,
  "underwayHours": 5.383333,
  "underwayFormatted": "5:23",
  "durationHours": 5.6,
  "avgSpeedKts": 8.7,
  "maxSpeedKts": 18.3
}
```

`nebo === null` means no Nebo data for that day.
`nebo.distanceNm === 0` is a valid zero-distance day (dock day with real log entry).

### Per-photo object

```json
{
  "uuid": "E218186D-1B1F-4694-A364-6C6AEC351820",
  "filename": "E218186D-1B1F-4694-A364-6C6AEC351820.heic",
  "directory": "E",
  "kind": 0,
  "ts": 1648837932.73,
  "lat": 35.103,
  "lon": -77.039
}
```

`ts` = Unix seconds — sort ascending for D-10. `directory` = first char of UUID.
`kind`: 0 = photo, 1 = video (both go into Gallery).

---

## No Analog Found

None. All patterns have direct analogs in the existing codebase.

---

## Key Anti-Patterns (from RESEARCH.md — planner must enforce)

| Anti-pattern | What breaks | Correct approach |
|---|---|---|
| `import matter from 'gray-matter'` | Script crashes — not in package.json | Copy three utility functions from `07-quality-lift.mjs` |
| `fm.miles = 0` when `day.nebo === null` | Violates D-06; VoyageStats shows 0 instead of hiding stats | Only set `miles`/`hours` when `day.nebo !== null` |
| Writing stub without `excerpt` field | Astro build fails: `excerpt` is `z.string()` — no default | Always include `excerpt: "Photos from {location}"` |
| Writing over an existing post | Destroys documented content | Check `existing.has(filename)` AND date-prefix check before every write |
| Nested YAML in frontmatter | `parseFrontmatter` mangles it on write-back | Keep `photos[]` array in MDX body as JSX only |

---

## Metadata

**Analog search scope:** `scripts/`, `src/content/blog/great-loop/`, `src/content.config.ts`
**Files scanned:** 4 (07-quality-lift.mjs, 03-correlate.mjs, 2022-04-16-getting-ready-to-go.mdx, 2022-07-07-oswego-canal-day-77.mdx)
**Pattern extraction date:** 2026-07-09
