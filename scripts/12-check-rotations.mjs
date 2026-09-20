#!/usr/bin/env node
/**
 * scripts/12-check-rotations.mjs
 *
 * Uses Claude's vision (claude-sonnet-4-6) to assess every R2-hosted photo
 * across all in-scope Phase 6 posts (fm.r2Uploaded === true) for orientation,
 * and auto-rotates the ones it's confident about. Anything it isn't confident
 * about is left untouched and flagged in the report for a human to check by
 * eye in narrative-viewer.mjs's lightbox (which now has its own rotate
 * button/'R' shortcut).
 *
 * Rotation itself reuses the exact re-upload-to-the-same-R2-key approach
 * built for scripts/narrative-viewer.mjs's per-photo rotate button (rotatePhoto,
 * getR2Client, keyFromPublicUrl below are copied verbatim from there) — no MDX
 * file ever needs editing, every existing Gallery reference to that URL just
 * starts showing the corrected orientation.
 *
 * Resumable: results are keyed by URL in the report file, and a URL already
 * present there (fixed / ok / flagged / error) is skipped on the next run
 * unless --force is passed. Written incrementally (after each post) so an
 * interruption partway through a ~1400-image run doesn't lose progress.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=<key> R2_*=... node scripts/12-check-rotations.mjs
 *   node scripts/12-check-rotations.mjs --dry-run              (assess only, no R2 writes)
 *   node scripts/12-check-rotations.mjs --date 2024-04-13       (repeatable)
 *   node scripts/12-check-rotations.mjs --limit 20               (cap images processed, for testing)
 *   node scripts/12-check-rotations.mjs --concurrency 4           (default 6)
 *   node scripts/12-check-rotations.mjs --force                   (re-assess URLs already in the report)
 *
 * Output:
 *   .planning/data/rotation-check-report.json
 */

import Anthropic from '@anthropic-ai/sdk';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');
const DATA_DIR   = join(ROOT, '.planning', 'data');
const POSTS_DIR  = join(ROOT, 'src', 'content', 'blog', 'great-loop');
const REPORT_PATH = join(DATA_DIR, 'rotation-check-report.json');

// ── CLI flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const FORCE = args.includes('--force');
const DATES = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && args[i + 1]) DATES.push(args[i + 1]);
}
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : null;
const concIdx = args.indexOf('--concurrency');
const CONCURRENCY = concIdx !== -1 && args[concIdx + 1] ? parseInt(args[concIdx + 1], 10) : 6;

// ── API key guard (lazy, copied verbatim in spirit from scripts/07-quality-lift.mjs) ──

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

// ── R2 rotate helpers (copied verbatim from scripts/narrative-viewer.mjs) ──

let _r2Client = null;
function getR2Client() {
  if (_r2Client) return _r2Client;
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE'];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length) throw new Error(`Missing env var(s): ${missing.join(', ')} — needed to rotate a photo`);
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

function keyFromPublicUrl(url) {
  const base = process.env.R2_PUBLIC_BASE.replace(/\/$/, '');
  if (!url.startsWith(base)) throw new Error('URL is not under R2_PUBLIC_BASE');
  return url.slice(base.length + 1);
}

async function rotatePhoto(url, degrees) {
  const key = keyFromPublicUrl(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const rotated = await sharp(buffer).rotate(degrees).jpeg({ quality: 80 }).toBuffer();
  await getR2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: rotated,
    ContentType: 'image/jpeg',
  }));
}

// ── Frontmatter + Gallery parsing (copied verbatim from scripts/10-upload-r2.mjs) ──

function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---\n', 3);
  if (end === -1) return { frontmatter: '', body: text };
  return { frontmatter: text.slice(4, end), body: text.slice(end + 4).replace(/^\n/, '') };
}

function parseFrontmatter(yaml) {
  const obj = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    let [, k, v] = m;
    v = v.trim();
    if (v === 'true') obj[k] = true;
    else if (v === 'false') obj[k] = false;
    else if (/^-?\d+(\.\d+)?$/.test(v)) obj[k] = parseFloat(v);
    else obj[k] = v.replace(/^"|"$/g, '');
  }
  return obj;
}

function extractGalleryEntries(body) {
  const match = body.match(/<Gallery\s+images=\{\[\s*([\s\S]*?)\]\}\s*\/>/);
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

// ── Report persistence ───────────────────────────────────────────────────────

function loadReport() {
  if (!existsSync(REPORT_PATH)) return { byUrl: {} };
  return JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
}

function saveReport(report) {
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
}

// ── Orientation assessment ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are assessing the orientation of a single photograph from a boating voyage blog.

Determine whether the image is displayed upright, or needs to be rotated CLOCKWISE by 90, 180, or 270 degrees to appear upright. Use the horizon line, water surface, gravity cues (people standing, hanging objects, dock pilings, boat masts/hulls), and normal scene expectations to judge up from down and which way is sideways.

If you cannot judge orientation with real confidence — e.g. an abstract close-up, a food photo, a screenshot, sky-only or water-only with no horizon, or a scene that looks plausible in more than one orientation — set confidence to "low" rather than guessing.

Respond with ONLY a JSON object, no other text, no markdown fences:
{"rotation": 0|90|180|270, "confidence": "high"|"low", "reason": "<under 12 words>"}

"rotation" is the clockwise degrees needed to correct the image (0 if it is already upright).`;

async function assessImage(url) {
  const content = [
    { type: 'image', source: { type: 'url', url } },
    { type: 'text', text: 'Assess this photo\'s orientation.' },
  ];
  const msg = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  });
  const block = msg.content.find((b) => b.type === 'text');
  if (!block) throw new Error('No text block in response');
  const jsonMatch = block.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Unparseable response: ${block.text.slice(0, 200)}`);
  const parsed = JSON.parse(jsonMatch[0]);
  if (![0, 90, 180, 270].includes(parsed.rotation)) throw new Error(`Invalid rotation value: ${parsed.rotation}`);
  if (!['high', 'low'].includes(parsed.confidence)) throw new Error(`Invalid confidence value: ${parsed.confidence}`);
  return parsed;
}

// ── Simple concurrency pool ──────────────────────────────────────────────────

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function runNext() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let files = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));
  if (DATES.length) files = files.filter((f) => DATES.includes(f.slice(0, 10)));
  files.sort((a, b) => a.slice(0, 10).localeCompare(b.slice(0, 10)));

  const report = loadReport();

  // Build the full work list first (slug/date/url tuples) across all posts.
  const work = [];
  let alreadyInReportCount = 0;
  for (const file of files) {
    const date = file.slice(0, 10);
    const slug = file.slice(0, -'.mdx'.length);
    const raw = readFileSync(join(POSTS_DIR, file), 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw);
    const fm = parseFrontmatter(frontmatter);
    if (fm.r2Uploaded !== true) continue;
    const entries = extractGalleryEntries(body).filter((u) => !u.toLowerCase().endsWith('.mov'));
    for (const url of entries) {
      if (!FORCE && report.byUrl[url]) { alreadyInReportCount++; continue; }
      work.push({ date, slug, url });
    }
  }

  const toProcess = LIMIT !== null ? work.slice(0, LIMIT) : work;
  const limitedOutCount = work.length - toProcess.length;
  console.log(`Assessing ${toProcess.length} photo(s) across ${new Set(toProcess.map((w) => w.slug)).size} post(s) ` +
    `(${alreadyInReportCount} already in report, ${limitedOutCount} held back by --limit)${DRY ? ' [DRY RUN — no R2 writes]' : ''}`);

  if (toProcess.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (!DRY) getR2Client(); // fail fast on missing R2 creds before spending API budget

  let fixed = 0, ok = 0, flagged = 0, errored = 0;
  let done = 0;
  const startTime = Date.now();

  await runPool(toProcess, async ({ date, slug, url }) => {
    let entry;
    try {
      const { rotation, confidence, reason } = await assessImage(url);
      if (confidence === 'high' && rotation !== 0) {
        if (!DRY) {
          await rotatePhoto(url, rotation);
        }
        entry = { date, slug, url, action: DRY ? 'would-fix' : 'fixed', rotation, confidence, reason };
        fixed++;
        console.log(`FIX   ${slug}  ${url.split('/').pop()}  rotate ${rotation}°  (${reason})`);
      } else if (confidence === 'low') {
        entry = { date, slug, url, action: 'flagged', rotation, confidence, reason };
        flagged++;
        console.log(`FLAG  ${slug}  ${url.split('/').pop()}  possible ${rotation}° (${reason}) — needs human eyes`);
      } else {
        entry = { date, slug, url, action: 'ok', rotation, confidence, reason };
        ok++;
      }
    } catch (err) {
      entry = { date, slug, url, action: 'error', error: err.message };
      errored++;
      console.log(`ERROR ${slug}  ${url.split('/').pop()}  ${err.message}`);
    }
    report.byUrl[url] = entry;
    done++;
    if (done % 25 === 0 || done === toProcess.length) {
      saveReport(report);
      console.log(`  … ${done}/${toProcess.length} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
    }
  }, CONCURRENCY);

  saveReport(report);

  console.log('');
  console.log('── Summary ─────────────────────────────────────────');
  console.log(`Processed: ${toProcess.length}`);
  console.log(`  ${DRY ? 'Would fix' : 'Fixed'} (high confidence, rotated): ${fixed}`);
  console.log(`  OK (high confidence, already upright): ${ok}`);
  console.log(`  Flagged for human review (low confidence): ${flagged}`);
  console.log(`  Errors: ${errored}`);
  console.log(`Report: ${REPORT_PATH}`);

  if (flagged > 0) {
    console.log('');
    console.log('Flagged photos (review these in narrative-viewer.mjs\'s lightbox):');
    for (const [url, e] of Object.entries(report.byUrl)) {
      if (e.action === 'flagged') console.log(`  ${e.slug}  ${url}`);
    }
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
