#!/usr/bin/env node
/**
 * scripts/11-draft-narratives.mjs
 *
 * Phase 6 narrative-generation pipeline. This script has two halves:
 *
 * --triage (implemented here, plan 06-03):
 *   Classifies every in-scope post (Keys->New Bern + Canada side trip, see
 *   scripts/verify-phase6.mjs for the exact in-scope date derivation) into
 *   full-narrative / transit / sparse using photo count + Nebo detail
 *   richness as a deterministic proxy for "eventful day" (06-CONTEXT.md D-06).
 *   Writes .planning/data/narrative-triage.json — a hand-editable artifact
 *   presented to the user before any AI draft is generated (D-07). Moving a
 *   day between categories is a JSON edit (set classification + locked:true),
 *   never a code change, and locked entries survive re-runs of this script.
 *
 * --generate (stub in this plan; implemented in plan 06-05):
 *   Reads narrative-triage.json (post-review) and calls the Claude API to
 *   draft narrative text for `full` days, per D-08 (attempted closing Bible
 *   verse). NOT implemented here — invoking it just prints a pointer message
 *   and exits 0. This script does NOT call the Anthropic API and does NOT
 *   reference any Claude API credential env var in --triage mode.
 *
 * Classification rules (deterministic, no AI involved — 06-03-PLAN.md <interfaces>):
 *   neboRichness = sum over the day's nebo legs of: routeName present (1)
 *     + weatherDeparture present (1) + weatherArrival present (1)
 *     + icwMarkers non-empty (1) + landmarks non-empty (1)
 *     + namedStops.arrived non-empty (1)
 *   "full"    when photoCount >= 10, OR (photoCount >= 5 AND neboRichness >= 3)
 *   "transit" when not full AND (photoCount >= 1 OR the day has >=1 nebo leg)
 *   "sparse"  otherwise
 *
 * Usage:
 *   node scripts/11-draft-narratives.mjs --triage
 *   node scripts/11-draft-narratives.mjs --triage --dry-run
 *   node scripts/11-draft-narratives.mjs --generate   (stub — see plan 06-05)
 *   node scripts/11-draft-narratives.mjs              (usage, exit 2)
 *
 * Output:
 *   .planning/data/narrative-triage.json — per-day classification + signals
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const DATA_DIR  = join(ROOT, '.planning', 'data');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');

const TRIAGE_PATH = join(DATA_DIR, 'narrative-triage.json');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args          = process.argv.slice(2);
const MODE_TRIAGE    = args.includes('--triage');
const MODE_GENERATE  = args.includes('--generate');
const DRY            = args.includes('--dry-run');

const USAGE = `Usage:
  node scripts/11-draft-narratives.mjs --triage              Classify all in-scope posts, write narrative-triage.json
  node scripts/11-draft-narratives.mjs --triage --dry-run    Print the classification table, do not write the file
  node scripts/11-draft-narratives.mjs --generate             Draft AI narratives (implemented in plan 06-05)
`;

if (!MODE_TRIAGE && !MODE_GENERATE && !DRY) {
  console.log(USAGE);
  process.exit(2);
}

if (MODE_GENERATE) {
  console.log('narrative generation is implemented in plan 06-05 (--generate is not yet available in this script).');
  console.log('Run --triage first, review .planning/data/narrative-triage.json, then plan 06-05 will read it.');
  process.exit(0);
}

// ── Constants ─────────────────────────────────────────────────────────────────
// Mirrors scripts/verify-phase6.mjs's in-scope date derivation exactly, so
// this script's notion of "in scope" never drifts from the phase's gate script.

const RANGES = [
  { name: 'keys-to-new-bern', start: '2024-04-13', end: '2024-05-17' },
  { name: 'canada-side-trip', start: '2023-06-05', end: '2023-08-31' },
];

const THRESHOLDS = {
  fullPhotoCount: 10,
  fullPhotoCountWithNebo: 5,
  fullNeboRichness: 3,
};

function inScope(dateStr) {
  return RANGES.some(r => dateStr >= r.start && dateStr <= r.end);
}

function rangeOf(dateStr) {
  return RANGES.find(r => dateStr >= r.start && dateStr <= r.end)?.name ?? null;
}

// ── Load data ─────────────────────────────────────────────────────────────────

const dailyRoutes = JSON.parse(
  readFileSync(join(ROOT, 'src', 'data', 'daily-routes.json'), 'utf8')
);
const inScopeDates = Object.keys(dailyRoutes).filter(inScope).sort();

const timelineRaw = JSON.parse(
  readFileSync(join(DATA_DIR, 'voyage-timeline-enriched.json'), 'utf8')
);
/** @type {Map<string, object>} */
const timelineByDate = new Map();
for (const day of timelineRaw.days) {
  timelineByDate.set(day.date, day);
}

const neboRaw = JSON.parse(readFileSync(join(DATA_DIR, 'nebo-logs.json'), 'utf8'));
/** @type {Map<string, object>} */
const neboByDate = new Map();
for (const entry of neboRaw) {
  if (entry.date && !neboByDate.has(entry.date)) {
    // Keep only the first entry per date (mirrors scripts/07-quality-lift.mjs's neboByDate)
    neboByDate.set(entry.date, entry);
  }
}

const mdxFilenames = readdirSync(POSTS_DIR).filter(f => f.endsWith('.mdx'));

/** @type {Map<string, string>} filename by date prefix */
const postFileByDate = new Map();
for (const f of mdxFilenames) {
  const datePrefix = f.slice(0, 10);
  if (!postFileByDate.has(datePrefix)) postFileByDate.set(datePrefix, f);
}

console.log(`In-scope dates: ${inScopeDates.length}  |  Timeline entries: ${timelineByDate.size}  |  Nebo dated entries: ${neboByDate.size}  |  MDX posts scanned: ${mdxFilenames.length}`);

// ── Signal helpers ────────────────────────────────────────────────────────────

/**
 * Count .mov entries inside a post's <Gallery images={[...]} /> array.
 * Falls back to a whole-file .mov count if the Gallery block itself can't be
 * isolated (defensive — every generated stub has this exact shape).
 */
function countVideos(raw) {
  const galleryMatch = raw.match(/<Gallery\s+images=\{\[([\s\S]*?)\]\}\s*\/>/);
  const scope = galleryMatch ? galleryMatch[1] : raw;
  return (scope.match(/\.mov"/gi) || []).length;
}

/**
 * neboRichness = sum over the day's nebo legs of the 6 D-06 signals.
 * A day with no nebo entry, or a nebo entry with no parsed legs, scores 0.
 */
function computeNeboRichness(neboEntry) {
  if (!neboEntry || !Array.isArray(neboEntry.legs) || neboEntry.legs.length === 0) return 0;
  let richness = 0;
  for (const leg of neboEntry.legs) {
    if (leg.routeName) richness += 1;
    if (leg.weatherDeparture) richness += 1;
    if (leg.weatherArrival) richness += 1;
    if (Array.isArray(leg.icwMarkers) && leg.icwMarkers.length > 0) richness += 1;
    if (Array.isArray(leg.landmarks) && leg.landmarks.length > 0) richness += 1;
    if (Array.isArray(leg.namedStops?.arrived) && leg.namedStops.arrived.length > 0) richness += 1;
  }
  return richness;
}

/** First leg with a non-null routeName, or null. */
function firstRouteName(neboEntry) {
  if (!neboEntry || !Array.isArray(neboEntry.legs)) return null;
  for (const leg of neboEntry.legs) {
    if (leg.routeName) return leg.routeName;
  }
  return null;
}

/**
 * Classify per the exact D-06 rules in 06-03-PLAN.md <interfaces>.
 * Returns { classification, classificationReason }.
 */
function classify(photoCount, neboRichness, hasNeboLeg) {
  if (photoCount >= THRESHOLDS.fullPhotoCount) {
    return { classification: 'full', classificationReason: 'photoCount>=10' };
  }
  if (photoCount >= THRESHOLDS.fullPhotoCountWithNebo && neboRichness >= THRESHOLDS.fullNeboRichness) {
    return { classification: 'full', classificationReason: 'photoCount>=5 && neboRichness>=3' };
  }
  if (photoCount >= 1 || hasNeboLeg) {
    return { classification: 'transit', classificationReason: 'has photos or nebo leg' };
  }
  return { classification: 'sparse', classificationReason: 'no photos, no nebo' };
}

// ── Load prior triage for locked-entry preservation (D-07 durability) ─────────

let existingByDate = new Map();
if (existsSync(TRIAGE_PATH)) {
  try {
    const existingTriage = JSON.parse(readFileSync(TRIAGE_PATH, 'utf8'));
    if (Array.isArray(existingTriage.days)) {
      for (const d of existingTriage.days) existingByDate.set(d.date, d);
    }
  } catch (err) {
    console.error(`WARNING: could not parse existing ${TRIAGE_PATH} (${err.message}); starting fresh.`);
    existingByDate = new Map();
  }
}

// ── Build triage entries ──────────────────────────────────────────────────────

const days = [];
const skippedDates = [];

for (const date of inScopeDates) {
  const filename = postFileByDate.get(date);
  if (!filename) {
    const day = timelineByDate.get(date);
    const reason = (day && day.photoCount === 0)
      ? 'photoCount 0 in voyage-timeline-enriched.json — no photos exist, no stub was generated'
      : 'no MDX post exists for this date';
    skippedDates.push({ date, reason });
    continue;
  }

  const raw = readFileSync(join(POSTS_DIR, filename), 'utf8');
  const slug = filename.replace(/\.mdx$/, '');

  const timelineDay = timelineByDate.get(date);
  const photoCount  = timelineDay?.photoCount ?? 0;
  const location    = timelineDay?.location ?? null;
  const videoCount  = countVideos(raw);

  const neboEntry    = neboByDate.get(date) ?? null;
  const hasNeboLog   = !!neboEntry;
  const hasNeboLeg   = hasNeboLog && Array.isArray(neboEntry.legs) && neboEntry.legs.length > 0;
  const distanceNm   = neboEntry?.distanceNm !== undefined ? Math.round(neboEntry.distanceNm * 10) / 10 : null;
  const routeName    = firstRouteName(neboEntry);
  const neboRichness = computeNeboRichness(neboEntry);

  const { classification: freshClassification, classificationReason } =
    classify(photoCount, neboRichness, hasNeboLeg);

  const existing = existingByDate.get(date);
  const locked = existing?.locked === true;
  const classification = locked ? existing.classification : freshClassification;

  days.push({
    date,
    slug,
    range: rangeOf(date),
    location,
    photoCount,
    videoCount,
    distanceNm,
    hasNeboLog,
    neboRichness,
    routeName,
    classification,
    classificationReason,
    locked,
  });
}

days.sort((a, b) => a.date.localeCompare(b.date));

// ── Summary ───────────────────────────────────────────────────────────────────

const summary = { total: days.length, full: 0, transit: 0, sparse: 0 };
for (const d of days) summary[d.classification]++;

const perRange = new Map();
for (const r of RANGES) perRange.set(r.name, { total: 0, full: 0, transit: 0, sparse: 0 });
for (const d of days) {
  const bucket = perRange.get(d.range);
  if (bucket) {
    bucket.total++;
    bucket[d.classification]++;
  }
}

// ── Print report ──────────────────────────────────────────────────────────────

console.log('');
console.log('── Per-range summary ─────────────────────────────────────');
for (const [name, counts] of perRange) {
  console.log(`  ${name}: total=${counts.total} full=${counts.full} transit=${counts.transit} sparse=${counts.sparse}`);
}

console.log('');
console.log(`TRIAGE_TOTAL=${summary.total}`);
console.log(`TRIAGE_FULL=${summary.full}`);
console.log(`TRIAGE_TRANSIT=${summary.transit}`);
console.log(`TRIAGE_SPARSE=${summary.sparse}`);

if (skippedDates.length > 0) {
  console.log('');
  console.log('── Skipped dates (no post file) ──────────────────────────');
  for (const { date, reason } of skippedDates) {
    console.log(`  ${date}: ${reason}`);
  }
}

console.log('');
console.log('── Full day-by-day list ──────────────────────────────────');
for (const d of days) {
  console.log(
    `${d.date}  ${d.classification.padEnd(7)}  photos=${d.photoCount} videos=${d.videoCount} nebo=${d.neboRichness} ${d.location ?? '(no location)'}`
  );
}

// ── Write triage file ─────────────────────────────────────────────────────────

if (MODE_TRIAGE && !DRY) {
  const output = {
    generated: new Date().toISOString(),
    thresholds: THRESHOLDS,
    summary,
    days,
    skippedDates,
  };
  writeFileSync(TRIAGE_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log('');
  console.log(`Wrote ${TRIAGE_PATH}`);
} else if (DRY) {
  console.log('');
  console.log('[DRY RUN] narrative-triage.json was not written.');
}
