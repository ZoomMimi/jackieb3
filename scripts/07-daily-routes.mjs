#!/usr/bin/env node
/**
 * scripts/07-daily-routes.mjs
 *
 * Builds src/data/daily-routes.json from the enriched voyage timeline.
 * Each entry:
 *   start:  [lat, lon] | null   — Nebo departure coord
 *   end:    [lat, lon] | null   — Nebo arrival coord
 *   track:  []                  — filled by scripts/08-slice-gpx-by-day.mjs
 *   photos: [[lat, lon, ts], …] — GPS-tagged photos for the day (ts = Unix seconds)
 *
 * Usage:
 *   node scripts/07-daily-routes.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const TIMELINE   = join(__dirname, '..', '.planning', 'data', 'voyage-timeline-enriched.json');
const BLOG_IMGS  = join(__dirname, '..', '.planning', 'data', 'blog-image-urls.json');
const OUTPUT     = join(__dirname, '..', 'src', 'data', 'daily-routes.json');

const COORD_RE = /(\d+)°\s*(\d+\.?\d*)'\s*(N|S),\s*(\d+)°\s*(\d+\.?\d*)'\s*(W|E)/g;

function parseCoords(text) {
  const results = [];
  for (const m of text.matchAll(COORD_RE)) {
    const lat = parseFloat(m[1]) + parseFloat(m[2]) / 60;
    const lon = parseFloat(m[4]) + parseFloat(m[5]) / 60;
    results.push([
      m[3] === 'S' ? -lat : lat,
      m[6] === 'W' ? -lon : lon,
    ]);
  }
  return results;
}

function r6(n) { return Math.round(n * 1e6) / 1e6; }

const timeline = JSON.parse(readFileSync(TIMELINE, 'utf8'));

// Build date → Blogger image URL array from blog-image-urls.json
const blogImgsByDate = {};
try {
  const blogData = JSON.parse(readFileSync(BLOG_IMGS, 'utf8'));
  for (const post of Object.values(blogData.posts)) {
    if (post.date && post.images?.length > 0) blogImgsByDate[post.date] = post.images;
  }
} catch {}

// Preserve existing track arrays from a prior run so GPX data isn't lost
let existing = {};
try { existing = JSON.parse(readFileSync(OUTPUT, 'utf8')); } catch {}

const routes = {};

for (const day of timeline.days) {
  const hasPhotos = (day.photos || []).some(p => p.lat != null);
  if (!day.hasNebo && !hasPhotos) continue;

  // ── Nebo waypoints → start, end, and sparse track ────────────────────────
  let start = null, end = null, track = existing[day.date]?.track ?? [];
  if (day.hasNebo) {
    const logText = (day.nebo.raw[1] ?? '') + '\n' + (day.nebo.raw[2] ?? '');
    const coords = parseCoords(logText);
    if (coords.length > 0) {
      end   = coords[coords.length - 1].map(r6);
      start = coords.length > 1 ? coords[0].map(r6) : null;
      // Use all waypoints as a sparse track (GPX upload will replace with real data)
      // Only set if no GPX-sourced track already exists for this day
      if (track.length === 0 && coords.length >= 2) {
        track = coords.map(c => c.map(r6));
      }
    }
  }

  // ── GPS photos: [lat, lon, ts, url?] tuples ─────────────────────────────
  const blogUrls = blogImgsByDate[day.date] ?? [];
  const photos = (day.photos || [])
    .filter(p => p.lat != null && p.lon != null)
    .sort((a, b) => a.ts - b.ts)
    .map((p, i) => {
      const base = [r6(p.lat), r6(p.lon), Math.round(p.ts)];
      return i < blogUrls.length ? [...base, blogUrls[i]] : base;
    });

  routes[day.date] = { start, end, track, photos };
}

writeFileSync(OUTPUT, JSON.stringify(routes, null, 2));

const total      = Object.keys(routes).length;
const withStart  = Object.values(routes).filter(r => r.start).length;
const withPhotos = Object.values(routes).filter(r => r.photos.length > 0).length;
const totalPhotos = Object.values(routes).reduce((s, r) => s + r.photos.length, 0);
console.log(`Wrote ${total} days (${withStart} with start, ${withPhotos} with photos, ${totalPhotos} total photo pins) → ${OUTPUT}`);
