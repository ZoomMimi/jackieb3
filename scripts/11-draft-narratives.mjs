#!/usr/bin/env node
/**
 * scripts/11-draft-narratives.mjs
 *
 * Phase 6 narrative-generation pipeline. This script has two halves:
 *
 * --triage (plan 06-03):
 *   Classifies every in-scope post (Keys->New Bern + Canada side trip, see
 *   scripts/verify-phase6.mjs for the exact in-scope date derivation) into
 *   full-narrative / transit / sparse using photo count + Nebo detail
 *   richness as a deterministic proxy for "eventful day" (06-CONTEXT.md D-06).
 *   Writes .planning/data/narrative-triage.json — a hand-editable artifact
 *   presented to the user before any AI draft is generated (D-07). Moving a
 *   day between categories is a JSON edit (set classification + locked:true),
 *   never a code change, and locked entries survive re-runs of this script.
 *
 * --generate (plan 06-06):
 *   Reads narrative-triage.json (post-review, never recomputes it) and calls
 *   the Claude API to draft first-person narrative text, in Barbara's voice,
 *   for `full`-classified days only. Sends the post's R2-hosted photos as
 *   `type: "url"` image blocks alongside Nebo GPS/weather/route detail, and
 *   requires an attempted closing Bible verse (D-08 — an attempt for Barbara
 *   to verify, never claimed as guaranteed-accurate). Never flips `draft`,
 *   never overwrites a post Barbara has already published (`draft: false`,
 *   refused even with --force), and skips a post already drafted unless
 *   --force is passed. This is the only mode that reads ANTHROPIC_API_KEY.
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
 *   node scripts/11-draft-narratives.mjs --generate
 *   node scripts/11-draft-narratives.mjs --generate --dry-run
 *   node scripts/11-draft-narratives.mjs --generate --date YYYY-MM-DD   (repeatable)
 *   node scripts/11-draft-narratives.mjs --generate --limit N
 *   node scripts/11-draft-narratives.mjs --generate --force
 *   node scripts/11-draft-narratives.mjs              (usage, exit 2)
 *
 * Output:
 *   .planning/data/narrative-triage.json — per-day classification + signals (--triage)
 *   src/content/blog/great-loop/*.mdx — narrative prose + verse written in place (--generate)
 *   .planning/data/narrative-draft-report.json — per-day generation results (--generate)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

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
const FORCE          = args.includes('--force');

const DATES = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && args[i + 1]) DATES.push(args[i + 1]);
}
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : null;

const USAGE = `Usage:
  node scripts/11-draft-narratives.mjs --triage                          Classify all in-scope posts, write narrative-triage.json
  node scripts/11-draft-narratives.mjs --triage --dry-run                Print the classification table, do not write the file
  node scripts/11-draft-narratives.mjs --generate                        Draft AI narratives for every unfinished 'full' day
  node scripts/11-draft-narratives.mjs --generate --dry-run              Print prompts + image lists, call no API, write nothing
  node scripts/11-draft-narratives.mjs --generate --date YYYY-MM-DD      Restrict to these dates (repeatable)
  node scripts/11-draft-narratives.mjs --generate --limit N              Process at most N posts this run
  node scripts/11-draft-narratives.mjs --generate --force                Re-draft a post even if narrativeDrafted is already true
`;

if (!MODE_TRIAGE && !MODE_GENERATE && !DRY) {
  console.log(USAGE);
  process.exit(2);
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

// ── Frontmatter utilities (copied verbatim from scripts/10-upload-r2.mjs) ──────
// This project duplicates this trio per-script rather than sharing a module.

function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---\n', 3); // require bare ---\n line; avoids matching --- horizontal rules in body
  if (end === -1) return { frontmatter: '', body: text };
  const frontmatter = text.slice(4, end); // strip opening ---\n
  const body = text.slice(end + 4).replace(/^\n/, ''); // strip closing ---\n
  return { frontmatter, body };
}

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

// ── Narrative generation (plan 06-06) ──────────────────────────────────────────

// API key guard (lazy) — copied verbatim from scripts/07-quality-lift.mjs.
// Must stay lazy so --triage continues to work with no key set.
let _client = null;
function getClient() {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('  Export it before running:  export ANTHROPIC_API_KEY="<your-key>"');
    console.error('  Or prefix the command:     ANTHROPIC_API_KEY=<your-key> npm run draft-narratives -- --generate');
    process.exit(1);
  }
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const RANGE_FRAMING = {
  'keys-to-new-bern': `This day is part of the Great Loop continuing straight through to its finish at New Bern, NC on 2024-05-17 — the day-numbered sequence running to the end. Do NOT frame this day as a "side trip" or an "excursion"; those words (or synonyms with the same meaning) must not appear.`,
  'canada-side-trip': `This day is part of a return visit to Canadian waters and the Great Lakes (North Channel, Ontario, roughly July 14-22 2023) — a side excursion, and distinctly NOT the same as the already-published 2022 Georgian Bay/Canada leg. The prose should acknowledge this as a return to Canada.`,
};

/** Extract the voyage day number from a slug like "2024-04-13-day-723-florida-keys". */
function dayNumberFromSlug(slug) {
  const m = slug.match(/-day-(\d+)-/);
  return m ? m[1] : null;
}

/**
 * Index every migrated:true post's stripped body text, for use as style
 * excerpts. Strips import lines and component tags (<VoyageStats .../>,
 * <Gallery ... />), leaving prose + markdown image lines, capped at ~1200
 * chars per plan 06-06 Task 1.
 */
function buildMigratedPostsIndex() {
  const index = [];
  for (const f of mdxFilenames) {
    const raw = readFileSync(join(POSTS_DIR, f), 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw);
    const fm = parseFrontmatter(frontmatter);
    if (fm.migrated !== true) continue;
    const stripped = body
      .replace(/^import .*$/gm, '')
      .replace(/<[^>]+\/?>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!stripped) continue;
    index.push({ date: fm.date ?? f.slice(0, 10), slug: f.replace(/\.mdx$/, ''), text: stripped.slice(0, 1200) });
  }
  return index;
}

/** The 3 migrated-post excerpts nearest in date to targetDate. */
function nearestStyleExcerpts(migratedIndex, targetDate, n = 3) {
  const targetMs = new Date(targetDate).getTime();
  return [...migratedIndex]
    .sort((a, b) => Math.abs(new Date(a.date).getTime() - targetMs) - Math.abs(new Date(b.date).getTime() - targetMs))
    .slice(0, n);
}

function formatWeather(w) {
  if (!w) return null;
  const parts = [];
  if (w.temp !== undefined && w.temp !== null) parts.push(`${w.temp}${w.unit ?? ''}`.trim());
  if (w.windKn !== undefined && w.windKn !== null) parts.push(`wind ${w.windKn}kn${w.windDir ? ' ' + w.windDir : ''}`);
  return parts.length ? parts.join(', ') : null;
}

/** Render a Nebo entry's legs into text, omitting null/empty fields entirely. */
function buildLegsText(neboEntry) {
  if (!neboEntry || !Array.isArray(neboEntry.legs) || neboEntry.legs.length === 0) return '';
  const lines = [];
  neboEntry.legs.forEach((leg, i) => {
    const parts = [];
    if (leg.routeName) parts.push(`route ${leg.routeName}`);
    if (leg.commenced) parts.push(`commenced ${leg.commenced}`);
    if (leg.completed) parts.push(`completed ${leg.completed}`);
    const dep = formatWeather(leg.weatherDeparture);
    if (dep) parts.push(`departure weather ${dep}`);
    const arr = formatWeather(leg.weatherArrival);
    if (arr) parts.push(`arrival weather ${arr}`);
    if (Array.isArray(leg.icwMarkers) && leg.icwMarkers.length) parts.push(`ICW markers ${leg.icwMarkers.join(', ')}`);
    if (Array.isArray(leg.landmarks) && leg.landmarks.length) parts.push(`landmarks ${leg.landmarks.join(', ')}`);
    if (leg.namedStops?.started) parts.push(`started at ${leg.namedStops.started}`);
    if (leg.namedStops?.departed) parts.push(`departed ${leg.namedStops.departed}`);
    if (Array.isArray(leg.namedStops?.arrived) && leg.namedStops.arrived.length) parts.push(`arrived at ${leg.namedStops.arrived.join(', ')}`);
    if (leg.namedStops?.stopped) parts.push(`stopped ${leg.namedStops.stopped}`);
    if (parts.length) lines.push(`  Leg ${i + 1}: ${parts.join('; ')}`);
  });
  return lines.length ? `Nebo log detail:\n${lines.join('\n')}` : '';
}

/** Exactly min(n, k) unique, sorted, evenly-spaced indices into [0, n). */
function evenlySpacedIndices(n, k) {
  if (n <= k) return Array.from({ length: n }, (_, i) => i);
  const idxs = new Set();
  for (let i = 0; i < k; i++) idxs.add(Math.round((i * (n - 1)) / (k - 1)));
  let next = 0;
  while (idxs.size < k) {
    if (!idxs.has(next)) idxs.add(next);
    next++;
  }
  return [...idxs].sort((a, b) => a - b);
}

function buildSystemPrompt(excerpts, framingText) {
  const excerptsText = excerpts
    .map((e, i) => `Excerpt ${i + 1} (from ${e.date}):\n${e.text}`)
    .join('\n\n');

  return `You are drafting a first-person journal entry in the voice of Barbara, who writes this boating blog about her family's Great Loop voyage aboard the Jackie B III.

Match the voice shown in these real excerpts from Barbara's own published posts — first-person, warm, conversational, specific about places and people, with light self-deprecating humor. Imitate the VOICE, not the specific events (those excerpts are from different days).

${excerptsText}

${framingText}

Closing verse (required): end the entry with an attempted closing Bible verse relevant to the day, in this exact two-line format — a quoted verse line, then on the very next line (no blank line between) the citation as "Book Chapter:verse TRANSLATION". Example:
"The heavens declare the glory of God; the skies proclaim the work of his hands."
Psalms 19:1 NIV
This is an ATTEMPT that Barbara will verify and may freely edit — do not claim the citation is guaranteed accurate.

Grounding rules: write only from what the photos and the supplied GPS/Nebo data actually show. Do not invent named people, restaurants, marinas, or events that are not evidenced by the photos or the data provided. A name is evidenced ONLY when it appears as legible text somewhere (a boat's transom, a sign, a name tag) or is given to you explicitly in the supplied data — never invent or guess a person's name just because a person is visible in a photo, even if a name would sound natural there. When a person is visible but unnamed, refer to them by role or relationship instead ("my husband," "the kids," "one of the paddlers"), the same way Barbara's own real posts sometimes do. Boats, landmarks, and businesses may be named only when their name is actually legible in a photo or supplied in the data. When the data is thin, write a shorter entry — padding is never correct.

Output format: your entire response must be exactly:
EXCERPT: <one sentence, under 160 characters, summarizing the day>

<the narrative markdown, ending with the closing verse>

No frontmatter, no code fences, no headings above H2, and no commentary about being an AI or about this being a generated draft.`;
}

async function runGenerate() {
  if (!existsSync(TRIAGE_PATH)) {
    console.error(`ERROR: ${TRIAGE_PATH} not found. Run --triage first.`);
    process.exit(1);
  }
  const triage = JSON.parse(readFileSync(TRIAGE_PATH, 'utf8'));

  let candidates = triage.days.filter((d) => d.classification === 'full');
  if (DATES.length) candidates = candidates.filter((d) => DATES.includes(d.date));
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  if (LIMIT !== null) candidates = candidates.slice(0, LIMIT);

  console.log(`Flags: dryRun=${DRY} dates=${DATES.join(',') || '(all)'} limit=${LIMIT ?? '(none)'} force=${FORCE}`);
  console.log(`Candidates (classification=full): ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nothing to generate.');
    return;
  }

  // Fail fast on a missing API key before any file work — but only when there
  // is real work to do (a dry run never needs credentials).
  if (!DRY) getClient();

  const migratedIndex = buildMigratedPostsIndex();

  const startTime = Date.now();
  const processed = [];
  const skipped = [];
  const failed = [];
  let imagesSent = 0;
  let imagesSampledDown = 0;

  for (const day of candidates) {
    const filename = postFileByDate.get(day.date);
    if (!filename) {
      console.log(`SKIP  ${day.slug} (no post file)`);
      skipped.push(day.slug);
      continue;
    }

    const filePath = join(POSTS_DIR, filename);
    const raw = readFileSync(filePath, 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw);
    const fm = parseFrontmatter(frontmatter);

    // Hard refusal — applies even with --force. draft:false means Barbara
    // has already reviewed and published this post; never touch it again.
    if (fm.draft === false) {
      console.error(`REFUSE ${day.slug}: draft is false (already published) — will not overwrite, even with --force`);
      failed.push({ slug: day.slug, error: 'draft is false; refusing to overwrite a published post' });
      continue;
    }
    if (fm.narrativeDrafted === true && !FORCE) {
      console.log(`SKIP  ${day.slug} (already drafted)`);
      skipped.push(day.slug);
      continue;
    }
    if (raw.includes('file://')) {
      console.log(`SKIP  ${day.slug} (Gallery still has file:// entries — run plan 06-05's R2 upload first)`);
      skipped.push(day.slug);
      continue;
    }

    const galleryMatch = body.match(/<Gallery\s+images=\{\[\s*([\s\S]*?)\]\}\s*\/>/);
    if (!galleryMatch) {
      console.log(`SKIP  ${day.slug} (no Gallery block — nothing to draft from)`);
      skipped.push(day.slug);
      continue;
    }
    const galleryBlockFull = galleryMatch[0];
    const galleryUrls = [...galleryMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const imageUrls = galleryUrls.filter((u) => !u.toLowerCase().endsWith('.mov'));
    if (imageUrls.length === 0) {
      console.log(`SKIP  ${day.slug} (Gallery has no image entries, only video)`);
      skipped.push(day.slug);
      continue;
    }

    const voyageStatsMatch = body.match(/<VoyageStats[^>]*\/>/);
    const voyageStatsBlockFull = voyageStatsMatch ? voyageStatsMatch[0] : '<VoyageStats  />';

    let sampledUrls = imageUrls;
    let sampledDown = false;
    if (imageUrls.length > 20) {
      sampledDown = true;
      sampledUrls = evenlySpacedIndices(imageUrls.length, 20).map((i) => imageUrls[i]);
    }

    const framingText = RANGE_FRAMING[day.range] ?? '';
    const excerpts = nearestStyleExcerpts(migratedIndex, day.date, 3);
    const system = buildSystemPrompt(excerpts, framingText);

    const neboEntry = neboByDate.get(day.date) ?? null;
    const legsText = buildLegsText(neboEntry);
    const dayNumber = dayNumberFromSlug(day.slug);

    const textLines = [`Date: ${day.date}`];
    if (dayNumber) textLines.push(`Voyage day number: ${dayNumber}`);
    textLines.push(`Location: ${day.location ?? fm.location ?? 'unknown'}`);
    if (typeof fm.miles === 'number') textLines.push(`Distance: ${fm.miles} nm`);
    if (typeof fm.hours === 'number') textLines.push(`Hours underway: ${fm.hours}`);
    if (legsText) textLines.push(legsText);
    const userText = textLines.join('\n');

    const content = [
      ...sampledUrls.map((url) => ({ type: 'image', source: { type: 'url', url } })),
      { type: 'text', text: userText },
    ];

    if (DRY) {
      console.log('');
      console.log(`── DRY RUN: ${day.slug} ${sampledDown ? `(sampled ${sampledUrls.length} of ${imageUrls.length} images)` : `(${sampledUrls.length} images)`} ──`);
      console.log('SYSTEM PROMPT:');
      console.log(system);
      console.log('');
      console.log('IMAGE URLS:');
      for (const u of sampledUrls) console.log(`  ${u}`);
      console.log('');
      console.log('USER TEXT:');
      console.log(userText);
      continue;
    }

    try {
      const msg = await getClient().messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content }],
      });
      const block = msg.content.find((b) => b.type === 'text');
      if (!block) throw new Error('No text block in Claude response');
      const responseText = block.text.trim();

      const excerptMatch = responseText.match(/^EXCERPT:\s*(.+?)\r?\n\r?\n([\s\S]*)$/);
      const newExcerpt = excerptMatch ? excerptMatch[1].trim() : null;
      const narrative = (excerptMatch ? excerptMatch[2] : responseText).trim();

      const importLines = body.match(/^import .*$/gm) ?? [];

      const newFm = { ...fm };
      if (newExcerpt) newFm.excerpt = newExcerpt;
      newFm.narrativeDrafted = true;

      const newBody = [
        importLines.join('\n'),
        narrative,
        galleryBlockFull,
        voyageStatsBlockFull,
      ].join('\n\n');

      writeFileSync(filePath, '---\n' + serializeFrontmatter(newFm) + '\n---\n\n' + newBody + '\n', 'utf8');

      imagesSent += sampledUrls.length;
      if (sampledDown) imagesSampledDown++;
      processed.push({
        slug: day.slug,
        images: sampledUrls.length,
        imagesAvailable: imageUrls.length,
        sampledDown,
      });
      console.log(`OK    ${day.slug} (${sampledUrls.length} images sent${sampledDown ? `, sampled down from ${imageUrls.length}` : ''})`);
    } catch (err) {
      console.log(`FAIL  ${day.slug}: ${err.message}`);
      failed.push({ slug: day.slug, error: err.message });
      // File intentionally left completely unmodified on failure.
    }
  }

  if (DRY) {
    console.log('');
    console.log(`[DRY RUN] ${candidates.length} candidate(s) previewed. No API calls made, no files written.`);
    return;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const report = {
    generated: new Date().toISOString(),
    durationSeconds: parseFloat(elapsed),
    summary: {
      total: candidates.length,
      processed: processed.length,
      skipped: skipped.length,
      failed: failed.length,
      imagesSent,
      imagesSampledDown,
    },
    processed,
    skipped,
    failed,
  };
  writeFileSync(join(DATA_DIR, 'narrative-draft-report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log('');
  console.log('── Narrative Draft Complete ───────────────────────────');
  console.log(`  Processed: ${processed.length}  Skipped: ${skipped.length}  Failed: ${failed.length}`);
  console.log(`  Images sent: ${imagesSent}  Sampled-down posts: ${imagesSampledDown}`);
}

if (MODE_GENERATE) {
  await runGenerate();
  process.exit(0);
}

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
