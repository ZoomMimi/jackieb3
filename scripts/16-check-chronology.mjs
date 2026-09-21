#!/usr/bin/env node
/**
 * scripts/16-check-chronology.mjs
 *
 * Cross-checks a post's claimed date and photo order against the REAL date
 * of each photo (see scripts/lib/photo-chronology.mjs for how that's
 * resolved — direct UUID lookup for Phase 6 R2 photos, perceptual-hash
 * matching against the local Photos library for migrated Blogger photos).
 *
 * Flags two independent problems:
 *   - date mismatch: the post's frontmatter `date` disagrees with where most
 *     of its photos actually were taken
 *   - order mismatch: photos appear in the post body out of real
 *     chronological order (this happens on its own even when the date is
 *     right — e.g. a photo from the tail end of a multi-day post placed
 *     before one from the start)
 *
 * Usage:
 *   node scripts/16-check-chronology.mjs --date 2022-05-27
 *   node scripts/16-check-chronology.mjs --all                  (live posts only)
 *   node scripts/16-check-chronology.mjs --all --include-drafts
 *   node scripts/16-check-chronology.mjs --all --report .planning/data/chronology-report.json
 *
 * This only REPORTS. Reordering/redating is applied by hand (or via the
 * narrative-viewer.mjs UI for posts it covers) after reviewing the findings —
 * automated prose edits are deliberately out of scope; see module docstring.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePhotoDate, dateFromTs } from './lib/photo-chronology.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');

const args = process.argv.slice(2);
const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : null;
const all = args.includes('--all');
const includeDrafts = args.includes('--include-drafts');
const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : null;

function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---\n', 3);
  if (end === -1) return { frontmatter: '', body: text };
  return { frontmatter: text.slice(4, end), body: text.slice(end + 4).replace(/^\n/, '') };
}

function parseFrontmatter(yaml) {
  const obj = {};
  for (const line of yaml.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    let val = line.slice(colon + 1).trim().replace(/^"(.*)"$/, '$1');
    if (val === 'true') obj[key] = true;
    else if (val === 'false') obj[key] = false;
    else obj[key] = val;
  }
  return obj;
}

/** Photo URLs in body order: inline markdown images, then <Gallery> array entries. */
function extractPhotoUrls(body) {
  const urls = [];
  for (const m of body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g)) urls.push(m[1]);
  const galleryMatch = body.match(/<Gallery\s+images=\{\[\s*([\s\S]*?)\]\}\s*\/>/);
  if (galleryMatch) {
    for (const m of galleryMatch[1].matchAll(/"([^"]+)"/g)) urls.push(m[1]);
  }
  return urls.filter((u) => !/\.(mov|mp4)$/i.test(u));
}

async function checkPost(filePath, filename) {
  const raw = readFileSync(filePath, 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const fm = parseFrontmatter(frontmatter);
  const fmDate = fm.date;
  const draft = fm.draft === true;
  if (draft && !includeDrafts) return null;

  const urls = extractPhotoUrls(body);
  if (urls.length === 0) return null;

  const resolved = [];
  for (const url of urls) {
    const r = await resolvePhotoDate(url, fmDate);
    resolved.push({ url, ...r });
  }

  const trusted = resolved.filter((r) => r.ts != null && (r.confidence === 'exact' || r.confidence === 'high'));
  if (trusted.length === 0) {
    return { filename, fmDate, urls: resolved, dateMismatch: null, orderIssues: [], note: 'no high-confidence photo matches' };
  }

  const dateCounts = new Map();
  for (const r of trusted) {
    const d = dateFromTs(r.ts);
    dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1);
  }
  const [majorityDate, majorityN] = [...dateCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const dateMismatch = majorityDate !== fmDate ? { fmDate, majorityDate, majorityN, of: trusted.length } : null;

  // order check: among trusted photos, do timestamps increase monotonically
  // in body order? Report the first inversion.
  const orderIssues = [];
  let lastTs = -Infinity, lastIdx = -1;
  resolved.forEach((r, i) => {
    if (r.ts == null || (r.confidence !== 'exact' && r.confidence !== 'high')) return;
    if (r.ts < lastTs) {
      orderIssues.push({ afterPosition: lastIdx, outOfOrderPosition: i, expectedBefore: lastTs, actual: r.ts });
    }
    lastTs = r.ts; lastIdx = i;
  });

  return { filename, fmDate, urls: resolved, dateMismatch, orderIssues };
}

function fmt(r) {
  const d = r.ts != null ? dateFromTs(r.ts) : '??';
  const t = r.ts != null ? new Date(r.ts * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  const tail = r.url.split('/').pop().slice(0, 20);
  return `${d} ${t}  [${r.confidence}${r.distance != null ? ` d=${r.distance}` : ''}]  ${tail}`;
}

async function main() {
  let targets = [];
  if (dateArg) {
    const f = readdirSync(POSTS_DIR).find((f) => f.startsWith(dateArg));
    if (!f) { console.error(`No post found for ${dateArg}`); process.exit(1); }
    targets = [f];
  } else if (all) {
    targets = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx')).sort();
  } else {
    console.error('Usage: --date YYYY-MM-DD | --all [--include-drafts] [--report path.json]');
    process.exit(1);
  }

  const results = [];
  for (const filename of targets) {
    const result = await checkPost(join(POSTS_DIR, filename), filename);
    if (!result) continue;
    results.push(result);
    if (dateArg) {
      console.log(`\n${filename}  (frontmatter date: ${result.fmDate})`);
      result.urls.forEach((r, i) => console.log(`  ${i}: ${fmt(r)}`));
      if (result.dateMismatch) {
        console.log(`\n  ⚠ DATE MISMATCH: frontmatter says ${result.dateMismatch.fmDate}, ${result.dateMismatch.majorityN}/${result.dateMismatch.of} trusted photos say ${result.dateMismatch.majorityDate}`);
      }
      if (result.orderIssues.length) {
        console.log(`  ⚠ ${result.orderIssues.length} photo(s) out of chronological order`);
      }
      if (!result.dateMismatch && !result.orderIssues.length) console.log('  ✓ looks consistent');
    }
  }

  if (all) {
    const flagged = results.filter((r) => r.dateMismatch || r.orderIssues.length);
    console.log(`Checked ${results.length} posts with photos, ${flagged.length} flagged:\n`);
    for (const r of flagged) {
      const bits = [];
      if (r.dateMismatch) bits.push(`date: fm=${r.dateMismatch.fmDate} real=${r.dateMismatch.majorityDate} (${r.dateMismatch.majorityN}/${r.dateMismatch.of})`);
      if (r.orderIssues.length) bits.push(`${r.orderIssues.length} out-of-order photo(s)`);
      console.log(`  ${r.filename} — ${bits.join('; ')}`);
    }
    if (reportPath) {
      writeFileSync(reportPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
      console.log(`\nFull report written to ${reportPath}`);
    }
  }
}

main();
