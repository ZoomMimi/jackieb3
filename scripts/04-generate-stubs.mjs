#!/usr/bin/env node
/**
 * scripts/04-generate-stubs.mjs
 *
 * Final output stage of the data pipeline. Consumes voyage-timeline-enriched.json
 * and produces two outputs:
 *
 * Job 1 — Backfill (DATA-05, DATA-06):
 *   Add miles/hours to existing MDX posts that have matching Nebo data.
 *   Add lat/lon to the 4 posts missing them (from centroidLat/centroidLon).
 *   Edits files in-place; bodies preserved byte-for-byte.
 *
 * Job 2 — Stubs (DATA-07, POST-01, POST-02):
 *   Generate draft: true MDX stubs for every undocumented day with 10+ photos
 *   in the April 2022 – May 2024 range, including the full last segment.
 *   Each stub carries full frontmatter, VoyageStats, and Gallery.
 *
 * Usage:
 *   node scripts/04-generate-stubs.mjs
 *   node scripts/04-generate-stubs.mjs --dry-run
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const DATA_DIR  = join(ROOT, '.planning', 'data');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');

// ── Photos root — configurable via PHOTOS_ROOT env var (CR-02) ────────────────
// Default: ~/Pictures/Photos Library.photoslibrary/originals (macOS Photos)
// Override on CI or other machines: PHOTOS_ROOT=/mnt/photos node scripts/04-generate-stubs.mjs
const PHOTOS_ROOT = process.env.PHOTOS_ROOT
  ?? join(process.env.HOME ?? '', 'Pictures/Photos Library.photoslibrary/originals');

// ── Dry-run flag ──────────────────────────────────────────────────────────────

const DRY = process.argv.includes('--dry-run');
if (DRY) console.log('[DRY RUN] No files will be written.');

// ── Frontmatter utilities (copied verbatim from scripts/07-quality-lift.mjs lines 100-152) ──

/**
 * Split raw MDX text into { frontmatter: string, body: string }.
 * Handles files that start with "---\n" ... "---\n".
 */
function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: '', body: text };
  const frontmatter = text.slice(4, end); // strip opening ---\n
  const body = text.slice(end + 4).replace(/^\n/, ''); // strip closing ---\n
  return { frontmatter, body };
}

/**
 * Parse YAML frontmatter string into a plain object (key-value only).
 * Handles: string, number, boolean, quoted strings.
 * Does NOT handle nested YAML — not needed for this simple schema.
 */
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
      obj[key] = val.slice(1, -1).replace(/\\"/g, '"');
    }
    else obj[key] = val;
  }
  return obj;
}

/**
 * Serialize a frontmatter object back to YAML string.
 * Preserves string quoting for values that need it.
 */
function serializeFrontmatter(obj) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else if (typeof v === 'number') lines.push(`${k}: ${v}`);
    else {
      // Quote if contains colon, hash, special chars, or is a date-like value
      const needs = /[:#{}\[\]|>&*!'",%@`?]/.test(String(v));
      if (needs) lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
      else lines.push(`${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

// ── Inline helpers ────────────────────────────────────────────────────────────

const DEPARTURE = new Date('2022-04-22T00:00:00Z');

/**
 * Compute the voyage day number. Day 1 = 2022-04-22.
 * Pre-departure dates yield zero or negative values — kept as-is for unique slugs.
 */
function dayNumber(dateStr) {
  return Math.floor((new Date(dateStr + 'T00:00:00Z') - DEPARTURE) / 86400000) + 1;
}

/**
 * Convert a location string to a URL-safe slug.
 * "New Bern NC" → "new-bern-nc"
 */
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Load enriched timeline ────────────────────────────────────────────────────

const timelineRaw = JSON.parse(
  readFileSync(join(DATA_DIR, 'voyage-timeline-enriched.json'), 'utf8')
);

// Integrity check
if (!Array.isArray(timelineRaw.days) || timelineRaw.days.length === 0) {
  console.error('ERROR: voyage-timeline-enriched.json has no days array or it is empty.');
  console.error('       Re-run scripts/03-correlate.mjs to rebuild the enriched timeline.');
  process.exit(1);
}

/** @type {Map<string, object>} */
const timelineByDate = new Map();
for (const day of timelineRaw.days) {
  timelineByDate.set(day.date, day);
}

const stats = timelineRaw.stats || {};
console.log(
  `Timeline loaded: ${timelineByDate.size} dated entries` +
  ` (withPhotos=${stats.withPhotos ?? '?'}, withNebo=${stats.withNebo ?? '?'})`
);

// ── JOB 1: BACKFILL (DATA-05, DATA-06, DATA-08) ───────────────────────────────

console.log('');
console.log('── Job 1: Backfill ───────────────────────────────────');

const mdxFiles = readdirSync(POSTS_DIR)
  .filter(f => extname(f) === '.mdx')
  .map(f => join(POSTS_DIR, f))
  .sort();

console.log(`Found ${mdxFiles.length} MDX posts in ${POSTS_DIR}`);

let backfilled    = 0;
let backfillSkipped = 0;
const backfillFailed = [];

for (const filePath of mdxFiles) {
  const slug = basename(filePath, '.mdx');
  const raw  = readFileSync(filePath, 'utf8');

  const { frontmatter: fmStr, body } = splitFrontmatter(raw);
  const fm = parseFrontmatter(fmStr);

  // Derive the date string from frontmatter or filename
  const dateStr = fm.date ? String(fm.date).slice(0, 10) : basename(filePath, '.mdx').slice(0, 10);

  // Look up the timeline entry
  const day = timelineByDate.get(dateStr);
  if (!day) {
    console.log(`SKIP ${slug} (no timeline data)`);
    backfillSkipped++;
    continue;
  }

  // Idempotency gate: skip if all four fields already populated
  if (
    fm.miles !== undefined &&
    fm.hours !== undefined &&
    fm.lat   !== undefined &&
    fm.lon   !== undefined
  ) {
    console.log(`SKIP ${slug} (already complete)`);
    backfillSkipped++;
    continue;
  }

  let mutated = false;

  try {
    // miles/hours: ONLY when day.nebo is a non-null object (D-06)
    // A nebo object with distanceNm===0 is a valid dock day — write miles:0
    if (day.nebo !== null && day.nebo !== undefined && typeof day.nebo === 'object') {
      if (fm.miles === undefined && day.nebo.distanceNm !== undefined) {
        fm.miles = Math.round(day.nebo.distanceNm * 10) / 10;
        mutated = true;
      }
      if (fm.hours === undefined && day.nebo.underwayHours !== undefined) {
        fm.hours = Math.round(day.nebo.underwayHours * 10) / 10;
        mutated = true;
      }
    }

    // lat/lon: fill from centroid if currently missing (D-08)
    if (fm.lat === undefined && day.centroidLat != null) {
      fm.lat = day.centroidLat;
      mutated = true;
    }
    if (fm.lon === undefined && day.centroidLon != null) {
      fm.lon = day.centroidLon;
      mutated = true;
    }

    if (mutated) {
      // Preserve body bytes exactly: slice from right after the closing \n---
      // (fmEnd is the index of the \n before ---, so fmEnd+4 skips \n--- itself)
      const fmEnd = raw.indexOf('\n---', 3);
      const bodyRaw = fmEnd !== -1 ? raw.slice(fmEnd + 4) : '';
      const newContent = `---\n${serializeFrontmatter(fm)}\n---` + bodyRaw;
      if (!DRY) {
        writeFileSync(filePath, newContent, 'utf8');
        console.log(`BACKFILL ${slug}`);
      } else {
        console.log(`WOULD BACKFILL ${slug}`);
      }
      backfilled++;
    } else {
      console.log(`SKIP ${slug} (no new data to add)`);
      backfillSkipped++;
    }
  } catch (err) {
    console.error(`FAIL ${slug}: ${err.message}`);
    backfillFailed.push({ slug, error: err.message });
  }
}

console.log('');
console.log(`  Backfilled: ${backfilled}`);
console.log(`  Skipped:    ${backfillSkipped}`);
console.log(`  Failed:     ${backfillFailed.length}`);

// ── JOB 2: STUBS (DATA-07, POST-01, POST-02) ──────────────────────────────────

console.log('');
console.log('── Job 2: Stubs ──────────────────────────────────────');

// Build set of existing filenames for collision detection
const existing = new Set(
  readdirSync(POSTS_DIR).filter(f => f.endsWith('.mdx'))
);

let stubsCreated = 0;
let stubsSkipped = 0;

for (const day of timelineRaw.days) {
  // D-01/D-02: skip if fewer than 10 photos
  if (day.photoCount < 10) continue;

  // D-03: skip if outside the documented date range
  if (day.date < '2022-04-01' || day.date > '2024-05-17') continue;

  // Build slug and filename (D-12)
  const dayN = dayNumber(day.date);
  const loc  = day.location || `${day.centroidLat}, ${day.centroidLon}`;
  const slug     = `${day.date}-day-${dayN}-${toSlug(loc)}`;
  const filename = `${slug}.mdx`;

  // Conflict guards (T-04-01, Pitfall 5): never overwrite a documented post
  if (existing.has(filename)) {
    console.log(`SKIP_STUB ${filename} (exact match exists)`);
    stubsSkipped++;
    continue;
  }
  // Date-prefix guard: skip if ANY existing file covers this date
  const datePrefix = day.date;
  let dateCovered = false;
  for (const f of existing) {
    if (f.startsWith(datePrefix)) {
      dateCovered = true;
      break;
    }
  }
  if (dateCovered) {
    console.log(`SKIP_STUB ${day.date} (existing post covers this date)`);
    stubsSkipped++;
    continue;
  }

  // Build frontmatter object in required field order (D-09/D-11)
  const fm = {};
  fm.title    = `Day ${dayN} — ${loc}`;
  fm.date     = day.date;
  fm.voyage   = 'great-loop';
  fm.location = loc;
  fm.excerpt  = `Photos from ${loc}`;
  fm.migrated = false;
  fm.draft    = true;

  // Conditionally add lat/lon and miles/hours (D-06, D-09)
  if (day.centroidLat != null) fm.lat = day.centroidLat;
  if (day.centroidLon != null) fm.lon = day.centroidLon;
  if (day.nebo !== null && day.nebo !== undefined && typeof day.nebo === 'object') {
    if (day.nebo.distanceNm !== undefined)   fm.miles = Math.round(day.nebo.distanceNm * 10) / 10;
    if (day.nebo.underwayHours !== undefined) fm.hours = Math.round(day.nebo.underwayHours * 10) / 10;
  }

  // Build body (D-09/D-10): photos sorted ascending by timestamp
  const photos    = [...day.photos].sort((a, b) => a.ts - b.ts);
  const imageList = photos
    .map(p => `"file://${PHOTOS_ROOT}/${p.directory}/${p.filename}"`)
    .join(',\n    ');

  const vsProps =
    (day.nebo != null && fm.miles !== undefined && fm.hours !== undefined)
      ? `miles={${fm.miles}} hours={${fm.hours}}`
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

  if (!DRY) {
    writeFileSync(join(POSTS_DIR, filename), content, 'utf8');
    // Add to existing set to prevent same-run duplicates
    existing.add(filename);
    console.log(`STUB ${filename}`);
  } else {
    console.log(`WOULD STUB ${filename}`);
  }
  stubsCreated++;
}

console.log('');
console.log('── Summary ───────────────────────────────────────────');
console.log(`  Posts backfilled:  ${backfilled}`);
console.log(`  Backfill skipped:  ${backfillSkipped}`);
console.log(`  Backfill failed:   ${backfillFailed.length}`);
console.log(`  Stubs created:     ${stubsCreated}`);
console.log(`  Stubs skipped:     ${stubsSkipped}`);
