#!/usr/bin/env node
/**
 * scripts/verify-phase6.mjs
 *
 * Scoped Phase-6 verification. Reports completion state for exactly the two
 * in-scope date ranges (Keys->New Bern, Canada side trip) and nothing else.
 *
 * A blanket `grep -rl "draft: true"` across the whole great-loop/ directory
 * would false-positive against the ~187 explicitly out-of-scope draft stubs
 * (06-CONTEXT.md D-05) — every check here is filtered to the in-scope date
 * set first.
 *
 * Usage:
 *   node scripts/verify-phase6.mjs
 *   node scripts/verify-phase6.mjs --gate posts --gate no-file-urls --gate no-drafts
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const DATA_DIR  = join(ROOT, '.planning', 'data');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const requestedGates = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--gate' && args[i + 1]) {
    requestedGates.push(args[i + 1]);
    i++;
  }
}

// ── Frontmatter utilities (copied verbatim from scripts/04-generate-stubs.mjs lines 49-81) ──

/**
 * Split raw MDX text into { frontmatter: string, body: string }.
 * Handles files that start with "---\n" ... "---\n".
 */
function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---\n', 3); // require bare ---\n line; avoids matching --- horizontal rules in body
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

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGES = [
  { name: 'keys-to-new-bern', start: '2024-04-13', end: '2024-05-17' },
  { name: 'canada-side-trip', start: '2023-06-05', end: '2023-08-31' },
];

const KNOWN_GAP_DATES = new Map([
  ['2023-08-09', 'GPS track present in daily-routes.json but photoCount 0 in voyage-timeline-enriched.json — no photos exist, so no Gallery/stub is possible; excluded from 06-CONTEXT.md D-04\'s 40-date list'],
]);

// Days the project owner explicitly chose to drop entirely via
// scripts/narrative-viewer.mjs's keep/discard checkbox (post deleted from
// src/content/blog/great-loop/). Treated the same as a known gap so the
// "100 in-scope posts" contract doesn't break when a day is removed on
// purpose. .planning/data/narrative-notes.json missing/absent = none dropped.
const NOTES_PATH = join(DATA_DIR, 'narrative-notes.json');
if (existsSync(NOTES_PATH)) {
  const notes = JSON.parse(readFileSync(NOTES_PATH, 'utf8'));
  for (const [date, entry] of Object.entries(notes.days ?? {})) {
    if (entry.keep === false) {
      KNOWN_GAP_DATES.set(date, 'Dropped by explicit owner choice via narrative-viewer.mjs\'s keep/discard checkbox');
    }
  }
}

const VALID_GATES = ['posts', 'no-file-urls', 'no-drafts'];

function inScope(dateStr) {
  return RANGES.some(r => dateStr >= r.start && dateStr <= r.end);
}

function rangeOf(dateStr) {
  return RANGES.find(r => dateStr >= r.start && dateStr <= r.end)?.name ?? null;
}

// ── Reject unknown gates early ────────────────────────────────────────────────

for (const g of requestedGates) {
  if (!VALID_GATES.includes(g)) {
    console.error(`ERROR: unknown gate "${g}". Valid gates: ${VALID_GATES.join(', ')}`);
    process.exit(2);
  }
}

// ── Derive in-scope date set from daily-routes.json (authoritative source) ────

const dailyRoutes = JSON.parse(
  readFileSync(join(ROOT, 'src', 'data', 'daily-routes.json'), 'utf8')
);

const inScopeDates = Object.keys(dailyRoutes).filter(inScope).sort();

// ── Read MDX files, filtered to in-scope dates ────────────────────────────────

const mdxFiles = readdirSync(POSTS_DIR).filter(f => f.endsWith('.mdx'));

/** @type {Map<string, {filename: string, fm: object, raw: string}>} */
const inScopePostsByDate = new Map();
for (const f of mdxFiles) {
  const datePrefix = f.slice(0, 10);
  if (!inScope(datePrefix)) continue;
  const raw = readFileSync(join(POSTS_DIR, f), 'utf8');
  const { frontmatter: fmStr } = splitFrontmatter(raw);
  const fm = parseFrontmatter(fmStr);
  // A date is "covered" if any .mdx filename starts with that date string.
  // If multiple files somehow share a date prefix, keep the first found.
  if (!inScopePostsByDate.has(datePrefix)) {
    inScopePostsByDate.set(datePrefix, { filename: f, fm, raw });
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────

const missingPosts = [];
for (const date of inScopeDates) {
  if (KNOWN_GAP_DATES.has(date)) continue;
  if (!inScopePostsByDate.has(date)) missingPosts.push(date);
}

const fileUrlPosts = [];
const draftPosts = [];
const r2UploadedPosts = [];
const narrativeDraftedPosts = [];

for (const [date, { filename, fm, raw }] of inScopePostsByDate) {
  if (raw.includes('file://')) fileUrlPosts.push(filename);
  if (fm.draft === true) draftPosts.push(filename);
  if (fm.r2Uploaded === true) r2UploadedPosts.push(filename);
  if (fm.narrativeDrafted === true) narrativeDraftedPosts.push(filename);
}

const counts = {
  inScopeDates: inScopeDates.length,
  knownGaps: KNOWN_GAP_DATES.size,
  inScopePosts: inScopePostsByDate.size,
  missingPosts: missingPosts.length,
  fileUrlPosts: fileUrlPosts.length,
  draftPosts: draftPosts.length,
  r2UploadedPosts: r2UploadedPosts.length,
  narrativeDraftedPosts: narrativeDraftedPosts.length,
};

// ── Output ────────────────────────────────────────────────────────────────────

function printCapped(label, list, cap = 20) {
  if (list.length === 0) return;
  const shown = list.slice(0, cap);
  const suffix = list.length > cap ? ` ... and ${list.length - cap} more` : '';
  console.log(`  ${label}: ${shown.join(', ')}${suffix}`);
}

console.log(`IN_SCOPE_DATES=${counts.inScopeDates}`);
console.log(`KNOWN_GAPS=${counts.knownGaps}`);
console.log(`IN_SCOPE_POSTS=${counts.inScopePosts}`);
console.log(`MISSING_POSTS=${counts.missingPosts}`);
console.log(`FILE_URL_POSTS=${counts.fileUrlPosts}`);
console.log(`DRAFT_POSTS=${counts.draftPosts}`);
console.log(`R2_UPLOADED_POSTS=${counts.r2UploadedPosts}`);
console.log(`NARRATIVE_DRAFTED_POSTS=${counts.narrativeDraftedPosts}`);

console.log('');
console.log('── Per-range breakdown ────────────────────────────────');
for (const r of RANGES) {
  const datesInRange = inScopeDates.filter(d => d >= r.start && d <= r.end);
  const missingInRange = missingPosts.filter(d => rangeOf(d) === r.name);
  console.log(`  ${r.name} (${r.start}..${r.end}): ${datesInRange.length} in-scope dates, ${missingInRange.length} missing posts`);
}

console.log('');
console.log('── Known gaps ──────────────────────────────────────────');
for (const [date, reason] of KNOWN_GAP_DATES) {
  console.log(`  ${date}: ${reason}`);
}

if (missingPosts.length > 0) {
  console.log('');
  console.log('── Missing posts ───────────────────────────────────────');
  printCapped('dates', missingPosts.sort());
}

if (fileUrlPosts.length > 0) {
  console.log('');
  console.log('── Posts containing file:// URLs ───────────────────────');
  printCapped('files', fileUrlPosts.sort());
}

if (draftPosts.length > 0) {
  console.log('');
  console.log('── Posts with draft: true ──────────────────────────────');
  printCapped('files', draftPosts.sort());
}

// ── Write JSON report ─────────────────────────────────────────────────────────

mkdirSync(DATA_DIR, { recursive: true });

const report = {
  generated: new Date().toISOString(),
  ranges: RANGES,
  inScopeDates,
  knownGaps: [...KNOWN_GAP_DATES.entries()].map(([date, reason]) => ({ date, reason })),
  counts,
  missingPosts: missingPosts.sort(),
  fileUrlPosts: fileUrlPosts.sort(),
  draftPosts: draftPosts.sort(),
  r2UploadedPosts: r2UploadedPosts.sort(),
  narrativeDraftedPosts: narrativeDraftedPosts.sort(),
};

writeFileSync(join(DATA_DIR, 'phase6-verify.json'), JSON.stringify(report, null, 2), 'utf8');

// ── Gates ─────────────────────────────────────────────────────────────────────

if (requestedGates.length > 0) {
  console.log('');
  console.log('── Gates ────────────────────────────────────────────────');
}

let anyGateFailed = false;
for (const gate of requestedGates) {
  let pass;
  if (gate === 'posts') pass = missingPosts.length === 0;
  else if (gate === 'no-file-urls') pass = fileUrlPosts.length === 0;
  else if (gate === 'no-drafts') pass = draftPosts.length === 0;

  if (pass) {
    console.log(`GATE_PASS ${gate}`);
  } else {
    console.log(`GATE_FAIL ${gate}`);
    anyGateFailed = true;
  }
}

process.exit(anyGateFailed ? 1 : 0);
