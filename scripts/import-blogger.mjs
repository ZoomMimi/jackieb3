#!/usr/bin/env node
/**
 * scripts/import-blogger.mjs
 *
 * Fetches all 72 Blogger posts from the Atom JSON API, sanitizes HTML for
 * MDX compilation safety, and generates 72 MDX files in
 * src/content/blog/great-loop/ plus 72 redirect rules in public/_redirects.
 *
 *   node scripts/import-blogger.mjs            → fetch (or load cache) + write MDX + _redirects
 *   node scripts/import-blogger.mjs --refresh   force re-fetch from API (ignores blog-posts-full.json)
 *   node scripts/import-blogger.mjs --force     overwrite existing MDX files (default: skip if exists)
 *
 * Outputs:
 *   .planning/data/blog-posts-full.json   — cached API response (full HTML content)
 *   src/content/blog/great-loop/*.mdx     — 72 YYYY-MM-DD-slug.mdx files
 *   public/_redirects                     — 72 Netlify 301 redirect rules
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname }                           from 'node:path';
import { fileURLToPath }                           from 'node:url';

const __dirname      = dirname(fileURLToPath(import.meta.url));
const DATA_DIR       = join(__dirname, '..', '.planning', 'data');
const CACHE_PATH     = join(DATA_DIR, 'blog-posts-full.json');
const MDX_DIR        = join(__dirname, '..', 'src', 'content', 'blog', 'great-loop');
const REDIRECTS_PATH = join(__dirname, '..', 'public', '_redirects');
const IMAGE_URLS_PATH = join(DATA_DIR, 'blog-image-urls.json');

const REFRESH = process.argv.includes('--refresh');
const FORCE   = process.argv.includes('--force');

const BLOG_URL  = 'https://jackiebiiigoingloopy.blogspot.com';
const FEED_BASE = `${BLOG_URL}/feeds/posts/default?alt=json&max-results=25`;

// ── Fetch all blog posts from Atom API ────────────────────────────────────────

async function fetchAllPosts() {
  const posts = [];
  let startIndex = 1;

  while (true) {
    const url = `${FEED_BASE}&start-index=${startIndex}&orderby=published`;
    process.stdout.write(`  Fetching posts ${startIndex}–${startIndex + 24}…\r`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Feed returned ${res.status} for ${url}`);
    const feed = await res.json();
    const entries = feed.feed?.entry ?? [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const title    = entry.title?.$t ?? '(untitled)';
      const published = (entry.published?.$t ?? '').slice(0, 10);  // "YYYY-MM-DD"
      const postUrl  = entry.link?.find(l => l.rel === 'alternate')?.href ?? '';
      const html     = entry.content?.$t ?? '';
      const labels   = (entry.category ?? [])
        .filter(c => c.scheme === 'http://www.blogger.com/atom/ns#')
        .map(c => c.term);
      const posterId = entry.id?.$t ?? '';

      posts.push({ date: published, title, postUrl, html, labels, posterId });
    }

    if (entries.length < 25) break;
    startIndex += 25;
  }

  posts.sort((a, b) => a.date.localeCompare(b.date));
  return posts;
}

// ── Load or fetch posts ───────────────────────────────────────────────────────

let posts;

if (!REFRESH && existsSync(CACHE_PATH)) {
  console.log('Loading cached blog posts…');
  const cached = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  posts = cached.posts;
  console.log(`  ${posts.length} posts from cache (run with --refresh to re-fetch)`);
} else {
  console.log('Fetching blog posts from Blogger Atom API…');
  posts = await fetchAllPosts();
  writeFileSync(CACHE_PATH, JSON.stringify({ generated: new Date().toISOString(), posts }, null, 2));
  console.log(`\n  ${posts.length} posts fetched and cached to .planning/data/blog-posts-full.json`);
}

// ── HTML Sanitization ─────────────────────────────────────────────────────────
// 6 targeted regex transforms applied in order to avoid double-processing.
// Security: removes <script>/<style> blocks (T-02-01, T-02-02).
// MDX safety: self-closes void elements, escapes bare braces (T-02-03, T-02-04).

function sanitizeHtml(html) {
  return html
    // 1. Replace Blogger video iframes with placeholder divs (D-07, T-02-04).
    //    Only matches blogger.com/video.g?token= iframes.
    //    Iframes with youtube.com/embed in their src are valid HTML and are preserved as-is.
    //    Note: MDX v3 does not support HTML comments (<!-- -->); using <div> placeholder
    //    instead so Phase 3 can locate videos via class="video-placeholder" selector.
    .replace(
      /<iframe[^>]+src=['"][^'"]*blogger\.com\/video\.g\?token=([^'"&\s]+)[^'"]*['"][^>]*>[\s\S]*?<\/iframe>/gi,
      (_, token) => `<div class="video-placeholder" data-src="https://www.blogger.com/video.g?token=${token}"></div>`
    )
    // 2. Strip <script> blocks entirely (T-02-01)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // 3. Strip <style> blocks entirely (T-02-02)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // 4a. Self-close <br> void elements (MDX v3 requires self-closing).
    //     Handles <br>, <br/>, <br />, <br  /> — Blogger already emits <br />.
    .replace(/<br\s*\/?\s*>/gi, '<br />')
    // 4b. Self-close <hr> void elements
    .replace(/<hr\s*\/?\s*>/gi, '<hr />')
    // 4c. Self-close <img> void elements (handles Blogger attrs: border="0", data-*, etc.).
    //     Uses lazy [^>]*? so the optional trailing \s*\/?\s* only matches right before >.
    //     This correctly handles both <img ...> and already-self-closed <img ... />.
    .replace(/<img(\s[^>]*?)\s*\/?\s*>/gi, '<img$1 />')
    // 5. Escape bare { and } in text nodes (T-02-03).
    //    Uses lookbehind to avoid replacing braces inside HTML tag attribute values.
    .replace(/(?<!<[^>]*)\{/g, '&#123;')
    .replace(/(?<!<[^>]*)\}/g, '&#125;')
    .trim();
}

// ── Slug Extraction ───────────────────────────────────────────────────────────

function extractSlug(postUrl) {
  const pathname = new URL(postUrl).pathname;  // /2022/04/getting-ready-to-go.html
  const parts    = pathname.split('/');
  const filename = parts[parts.length - 1];   // getting-ready-to-go.html
  return filename.replace(/\.html$/, '');     // getting-ready-to-go
}

// ── Frontmatter Builder ───────────────────────────────────────────────────────

function buildFrontmatter(entry) {
  // location: first Blogger label, or "Great Loop" fallback (Pitfall 4)
  const location = entry.labels && entry.labels.length > 0
    ? entry.labels[0]
    : 'Great Loop';

  // excerpt: strip HTML, normalize whitespace, decode common entities, slice to 200 chars
  const excerpt = (entry.html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .trim()
    .slice(0, 200);

  return {
    title:    entry.title,
    date:     entry.date,      // YYYY-MM-DD string
    voyage:   'great-loop',
    location,
    excerpt,
  };
}

// ── MDX Builder ───────────────────────────────────────────────────────────────
// Rules: double-quote ALL string values, escape " as \", date is bare YYYY-MM-DD,
// migrated: true (bare boolean). Omit coverPhoto, lat, lon, anchorage, marina.

function buildMdx(frontmatter, sanitizedHtml) {
  const title    = frontmatter.title.replace(/"/g, '\\"');
  const location = frontmatter.location.replace(/"/g, '\\"');
  const excerpt  = frontmatter.excerpt.replace(/"/g, '\\"');

  return `---
title: "${title}"
date: ${frontmatter.date}
voyage: "great-loop"
location: "${location}"
excerpt: "${excerpt}"
migrated: true
---

${sanitizedHtml}
`;
}

// ── Redirect Line Builder ─────────────────────────────────────────────────────

function buildRedirectLine(dateStr, slug) {
  const year  = dateStr.slice(0, 4);
  const month = dateStr.slice(5, 7);
  return `/${year}/${month}/${slug}.html /blog/${dateStr}-${slug}/ 301`;
}

// ── Main Loop ─────────────────────────────────────────────────────────────────

let written  = 0;
let skipped  = 0;
let fallbackCount = 0;
const redirectLines = [];

console.log(`\nProcessing ${posts.length} posts…`);

// Log first 5 posts' label data to confirm field structure (RESEARCH.md Open Q1)
console.log('  Label data for first 5 posts:');
for (let i = 0; i < Math.min(5, posts.length); i++) {
  const p = posts[i];
  console.log(`    ${p.date} "${p.title}": labels=${JSON.stringify(p.labels ?? [])}`);
}

for (const post of posts) {
  if (!post.postUrl) { skipped++; continue; }
  const slug     = extractSlug(post.postUrl);
  const filename = `${post.date}-${slug}.mdx`;
  const outPath  = join(MDX_DIR, filename);

  // Compute redirect line for ALL posts (not just newly written ones)
  redirectLines.push(buildRedirectLine(post.date, slug));

  // Count location fallbacks
  if (!post.labels || post.labels.length === 0) {
    fallbackCount++;
    console.log(`  [location fallback] ${post.date} "${post.title}" → "Great Loop"`);
  }

  if (!FORCE && existsSync(outPath)) {
    skipped++;
    continue;
  }

  const sanitized  = sanitizeHtml(post.html);
  const frontmatter = buildFrontmatter(post);
  writeFileSync(outPath, buildMdx(frontmatter, sanitized));
  written++;
}

// ── Write public/_redirects ───────────────────────────────────────────────────

const redirectsContent = [
  '# Blogger -> Astro 301 redirects (auto-generated by scripts/import-blogger.mjs)',
  ...redirectLines,
].join('\n') + '\n';

writeFileSync(REDIRECTS_PATH, redirectsContent);

// ── Coverage Validation (D-01) ────────────────────────────────────────────────
// Cross-check every slug in blog-image-urls.json against written MDX files.

let coverageMismatches = 0;

if (existsSync(IMAGE_URLS_PATH)) {
  const imageData = JSON.parse(readFileSync(IMAGE_URLS_PATH, 'utf8'));
  const imagePosts = imageData.posts ?? [];
  for (const entry of imagePosts) {
    if (!entry.postUrl) continue;
    const slug     = extractSlug(entry.postUrl);
    const filename = `${entry.date}-${slug}.mdx`;
    const mdxPath  = join(MDX_DIR, filename);
    if (!existsSync(mdxPath)) {
      console.log(`  [coverage mismatch] Missing MDX for: ${filename}`);
      coverageMismatches++;
    }
  }
  if (coverageMismatches === 0) {
    console.log(`  Coverage validation: all ${imagePosts.length} slugs from blog-image-urls.json have MDX files`);
  }
} else {
  console.log('  [warning] blog-image-urls.json not found — skipping coverage validation');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n── Import Summary ${'─'.repeat(30)}`);
console.log(`  Posts loaded:             ${posts.length}`);
console.log(`  MDX files written:        ${written}`);
console.log(`  MDX files skipped:        ${skipped} (already exist; use --force to overwrite)`);
console.log(`  Redirect rules written:   ${redirectLines.length}`);
console.log(`  Location fallbacks:       ${fallbackCount} posts used "Great Loop" (no Blogger labels)`);
console.log(`  Coverage mismatches:      ${coverageMismatches}`);
console.log(`  Cache:                    .planning/data/blog-posts-full.json`);
console.log(`  Output:                   src/content/blog/great-loop/ (${written + skipped} files total)`);
console.log(`  Redirects:                public/_redirects`);
console.log('─'.repeat(47));
