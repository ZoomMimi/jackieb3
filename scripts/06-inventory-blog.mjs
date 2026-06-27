#!/usr/bin/env node
/**
 * scripts/06-inventory-blog.mjs
 *
 * Reads pre-fetched blog post data (blog-posts-raw.json) and marks which
 * dates in photo-selections.json already have blog coverage. Blog image
 * filenames are a different UUID namespace from the Photos library, so we
 * use date-based marking rather than per-photo matching.
 *
 * Input:  .planning/data/blog-posts-raw.json   — pre-fetched post list
 * Output: .planning/data/blog-inventory.json   — full post inventory
 *         .planning/data/photo-selections.json — updated with blogPosts per date
 *
 * Usage: node scripts/06-inventory-blog.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname }                           from 'node:path';
import { fileURLToPath }                           from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '..', '.planning', 'data');

const BLOG_RAW_PATH   = join(DATA_DIR, 'blog-posts-raw.json');
const SELECTIONS_PATH = join(DATA_DIR, 'photo-selections.json');
const INVENTORY_PATH  = join(DATA_DIR, 'blog-inventory.json');

// ── Load blog posts ───────────────────────────────────────────────────────────

if (!existsSync(BLOG_RAW_PATH)) {
  console.error('ERROR: blog-posts-raw.json not found.');
  process.exit(1);
}

console.log('Loading pre-fetched blog posts…');
const rawPosts = JSON.parse(readFileSync(BLOG_RAW_PATH, 'utf8'));
console.log(`  ${rawPosts.length} posts loaded`);

// ── Summarize posts ───────────────────────────────────────────────────────────

const posts = rawPosts.map(raw => ({
  date:       raw.date,
  title:      raw.title,
  imageCount: raw.filenames?.length ?? 0,
  videoCount: raw.videos ?? 0,
}));

posts.sort((a, b) => a.date.localeCompare(b.date));

const totalImages = posts.reduce((n, p) => n + p.imageCount, 0);
const totalVideos = posts.reduce((n, p) => n + p.videoCount, 0);

console.log(`\n── Blog Inventory ────────────────────────────────────`);
console.log(`  Posts:  ${posts.length}`);
console.log(`  Images: ${totalImages} (across all posts)`);
console.log(`  Videos: ${totalVideos} (Blogger-hosted)`);

// ── Update photo-selections.json with date-level blog coverage ────────────────
// Note: Blogger CDN filenames use a different UUID namespace than the Photos
// Library (osxphotos UUIDs), so per-photo matching is not possible. Instead
// we mark each date with the blog post(s) that cover it.

console.log('\nUpdating photo-selections.json…');
let selections = existsSync(SELECTIONS_PATH)
  ? JSON.parse(readFileSync(SELECTIONS_PATH, 'utf8'))
  : {};

// Clear existing blogPosts markers (clean slate each run)
for (const date of Object.keys(selections)) {
  delete selections[date].blogPosts;
}

// Mark each post's date
let datesMarked = 0;
for (const post of posts) {
  if (!selections[post.date]) selections[post.date] = { photos: {}, reviewed: false };
  if (!selections[post.date].blogPosts) {
    selections[post.date].blogPosts = [];
    datesMarked++;
  }
  selections[post.date].blogPosts.push({
    title:      post.title,
    imageCount: post.imageCount,
    videoCount: post.videoCount,
  });
}

writeFileSync(SELECTIONS_PATH, JSON.stringify(selections, null, 2));
console.log(`  Marked ${posts.length} posts across ${datesMarked} dates`);

// ── Save blog inventory ────────────────────────────────────────────────────────

const inventory = {
  generated: new Date().toISOString(),
  note: 'Date-based coverage only. Blog image filenames use a different UUID namespace than the Photos library.',
  stats: { posts: posts.length, totalImages, totalVideos },
  posts,
};
writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
console.log(`  Saved → .planning/data/blog-inventory.json`);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n── Blog post dates ───────────────────────────────────');
for (const p of posts) {
  const vidStr = p.videoCount > 0 ? ` + ${p.videoCount}v` : '';
  console.log(`  ${p.date}  [${p.imageCount} img${vidStr}]  ${p.title}`);
}

console.log('\nDone.');
