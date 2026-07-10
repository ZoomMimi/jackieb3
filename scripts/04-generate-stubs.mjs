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
      obj[key] = val.slice(1, -1);
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

// JOB 1: BACKFILL (Task 2)

// JOB 2: STUBS (Task 3)
