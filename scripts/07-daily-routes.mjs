#!/usr/bin/env node
/**
 * scripts/07-daily-routes.mjs
 *
 * Builds src/data/daily-routes.json from Nebo OCR data.
 * Each entry: { start: [lat, lon] | null, end: [lat, lon] | null, track: [] }
 *
 * "track" starts empty — populate it later by running:
 *   node scripts/08-slice-gpx-by-day.mjs
 * after placing Nebo GPX exports in .planning/data/gpx/
 *
 * Usage:
 *   node scripts/07-daily-routes.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TIMELINE  = join(__dirname, '..', '.planning', 'data', 'voyage-timeline-enriched.json');
const OUTPUT    = join(__dirname, '..', 'src', 'data', 'daily-routes.json');

// Matches: 35°1.08' N, 76° 57.76' W  (space between degrees and minutes is optional)
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

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

const timeline = JSON.parse(readFileSync(TIMELINE, 'utf8'));
const routes = {};

for (const day of timeline.days) {
  if (!day.hasNebo) continue;

  // Pages 2 and 3 contain the voyage log with GPS waypoints
  const logText = (day.nebo.raw[1] ?? '') + '\n' + (day.nebo.raw[2] ?? '');
  const coords = parseCoords(logText);

  if (coords.length === 0) continue;

  const [startLat, startLon] = coords[0].map(round6);
  const [endLat, endLon]     = coords[coords.length - 1].map(round6);

  // If only one coord was found, skip start (we only have the destination)
  routes[day.date] = {
    start: coords.length > 1 ? [startLat, startLon] : null,
    end:   [endLat, endLon],
    track: [],
  };
}

writeFileSync(OUTPUT, JSON.stringify(routes, null, 2));

const total    = Object.keys(routes).length;
const withStart = Object.values(routes).filter(r => r.start).length;
console.log(`Wrote ${total} daily routes (${withStart} with start coords) → ${OUTPUT}`);
