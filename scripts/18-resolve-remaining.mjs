#!/usr/bin/env node
/**
 * scripts/18-resolve-remaining.mjs
 *
 * For every live post that scripts/17-classify-days.mjs couldn't verify from
 * cache alone, retries photo resolution WITH downloads enabled and a wider
 * date window (±10 days instead of the default ±5) — the Colorado wedding
 * trip needed exactly this widening (6 days off from its old label) to find
 * its real match. Populates scripts/lib/photo-chronology.mjs's persistent
 * cache; scripts/17-classify-days.mjs then picks the results up on its next
 * run (cache-only). Does not touch any post file.
 *
 * Usage: node scripts/18-resolve-remaining.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePhotoDate } from './lib/photo-chronology.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');

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
function extractPhotoUrls(body) {
  const urls = [];
  for (const m of body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g)) urls.push(m[1]);
  return urls.filter((u) => !/\.(mov|mp4)$/i.test(u));
}

const filenames = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));
let checked = 0, newlyResolved = 0;

for (const filename of filenames) {
  const raw = readFileSync(join(POSTS_DIR, filename), 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const fm = parseFrontmatter(frontmatter);
  if (fm.draft === true) continue;

  const urls = extractPhotoUrls(body);
  if (urls.length === 0) continue;

  // quick cache-only pass first to see if this post already has ANY trusted match
  let alreadyOk = false;
  for (const url of urls) {
    const cached = await resolvePhotoDate(url, fm.date, { download: false });
    if (cached.ts != null && cached.lat != null && (cached.confidence === 'exact' || cached.confidence === 'high')) { alreadyOk = true; break; }
  }
  if (alreadyOk) continue;

  checked++;
  console.log(`\n[${checked}] ${filename} (fm date ${fm.date}) — retrying with download + ±10 day window...`);
  for (const url of urls.slice(0, 6)) { // cap per post to bound total runtime
    const r = await resolvePhotoDate(url, fm.date, { windowDays: 10, download: true });
    if (r.ts != null && r.lat != null && (r.confidence === 'exact' || r.confidence === 'high')) {
      console.log(`    found: ${new Date(r.ts * 1000).toISOString().slice(0, 10)} (dist=${r.distance}, 2nd=${r.secondBestDistance})`);
      newlyResolved++;
      break;
    }
  }
}

console.log(`\nDone. Retried ${checked} previously-unresolved posts, newly resolved ${newlyResolved}.`);
