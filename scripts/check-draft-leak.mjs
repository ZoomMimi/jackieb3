#!/usr/bin/env node
/**
 * scripts/check-draft-leak.mjs
 *
 * Build-output assertion: no `draft: true` post's slug may appear as a
 * `/blog/<slug>` link anywhere in the generated production build.
 *
 * Counting post pages alone (`dist/blog/<slug>/index.html`) is NOT sufficient
 * to prove drafts are excluded — the homepage Recent Posts list, the voyage
 * index, and the RSS feed can each independently leak a draft link even when
 * `getStaticPaths` itself is correctly filtered. This script scans all four
 * surfaces that enumerate posts.
 *
 * Usage:
 *   npm run build && node scripts/check-draft-leak.mjs
 *   npm run check-draft-leak
 *
 * Exits 1 (with offending slugs/surfaces listed) if any draft slug leaks, or
 * if any of the four expected dist/ files is missing (stale/partial build).
 * Exits 0 and prints DRAFT_LEAKS=0 plus per-surface link counts otherwise.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');
const DIST_DIR  = join(ROOT, 'dist');

// ── Frontmatter utilities (copied verbatim from scripts/04-generate-stubs.mjs lines 49-81) ──

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

// ── Step 1: build the draft-slug set from source MDX ────────────────────────

const draftSlugs = new Set();
for (const file of readdirSync(POSTS_DIR)) {
  if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue;
  const text = readFileSync(join(POSTS_DIR, file), 'utf8');
  const { frontmatter } = splitFrontmatter(text);
  const fm = parseFrontmatter(frontmatter);
  if (fm.draft === true) {
    const slug = file.replace(/\.mdx?$/, '');
    draftSlugs.add(slug);
  }
}

// ── Step 2: require all four dist/ surfaces to exist ────────────────────────

const SURFACES = {
  HOME_LINKS:         join(DIST_DIR, 'index.html'),
  BLOG_INDEX_LINKS:   join(DIST_DIR, 'blog', 'index.html'),
  VOYAGE_INDEX_LINKS: join(DIST_DIR, 'voyages', 'great-loop', 'index.html'),
  RSS_ITEMS:          join(DIST_DIR, 'rss.xml'),
};

const missing = Object.entries(SURFACES).filter(([, path]) => !existsSync(path));
if (missing.length > 0) {
  console.error('ERROR: missing expected dist/ output — build is stale or partial:');
  for (const [key, path] of missing) {
    console.error(`  ${key}: ${path}`);
  }
  process.exit(1);
}

// ── Step 3: scan each surface for /blog/<slug> links, and for draft leaks ───

const leaks = []; // { slug, surface }
const linkCounts = {}; // surface key -> distinct /blog/... link count
let rssItemCount = 0;

for (const [key, path] of Object.entries(SURFACES)) {
  const text = readFileSync(path, 'utf8');

  if (key === 'RSS_ITEMS') {
    const itemMatches = text.match(/<item>/g);
    rssItemCount = itemMatches ? itemMatches.length : 0;
  } else {
    const linkMatches = text.match(/\/blog\/[a-zA-Z0-9-]+/g) || [];
    linkCounts[key] = new Set(linkMatches).size;
  }

  for (const slug of draftSlugs) {
    if (text.includes(`/blog/${slug}`)) {
      leaks.push({ slug, surface: key });
    }
  }
}

// ── Step 4: report ────────────────────────────────────────────────────────

console.log(`DRAFT_LEAKS=${leaks.length}`);
console.log(`HOME_LINKS=${linkCounts.HOME_LINKS}`);
console.log(`BLOG_INDEX_LINKS=${linkCounts.BLOG_INDEX_LINKS}`);
console.log(`VOYAGE_INDEX_LINKS=${linkCounts.VOYAGE_INDEX_LINKS}`);
console.log(`RSS_ITEMS=${rssItemCount}`);

if (leaks.length > 0) {
  console.error('\nDraft leaks found (first 10):');
  for (const { slug, surface } of leaks.slice(0, 10)) {
    console.error(`  ${slug} leaked on ${surface}`);
  }
  process.exit(1);
}

process.exit(0);
