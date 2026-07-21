#!/usr/bin/env node
/**
 * scripts/08-slice-gpx-by-day.mjs
 *
 * Slices Nebo GPX exports into per-day tracks and merges them into
 * src/data/daily-routes.json (which must already exist from script 07).
 *
 * Each <trkpt> is assigned to a date bucket using its <time> element
 * (UTC). The track for each date is simplified with simplify-js then
 * stored as [[lat, lon], ...] in the "track" field.
 *
 * Run after placing .gpx files in .planning/data/gpx/:
 *   node scripts/08-slice-gpx-by-day.mjs
 *
 * Safe to re-run — only overwrites track arrays, leaves start/end untouched.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gpx } from '@tmcw/togeojson';
import simplify from 'simplify-js';
import { DOMParser } from '@xmldom/xmldom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GPX_DIR   = join(__dirname, '..', '.planning', 'data', 'gpx');
const ROUTES    = join(__dirname, '..', 'src', 'data', 'daily-routes.json');

// Simplification tolerance — raise if output is too large
const TOLERANCE = 0.0001;

if (!existsSync(GPX_DIR)) {
  console.error(`GPX directory not found: ${GPX_DIR}`);
  console.error('Export trips from the Nebo app and place .gpx files there.');
  process.exit(1);
}

if (!existsSync(ROUTES)) {
  console.error(`daily-routes.json not found — run script 07 first.`);
  process.exit(1);
}

const routes = JSON.parse(readFileSync(ROUTES, 'utf8'));

// ── Parse all GPX files and bucket trackpoints by UTC date ───────────────────

const byDate = {};

for (const file of readdirSync(GPX_DIR).filter(f => f.endsWith('.gpx'))) {
  const xml  = readFileSync(join(GPX_DIR, file), 'utf8').replace(/^﻿/, '');
  const dom  = new DOMParser().parseFromString(xml, 'text/xml');
  const geojson = gpx(dom);

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;

    const coords =
      feature.geometry.type === 'LineString'
        ? [feature.geometry.coordinates]
        : feature.geometry.type === 'MultiLineString'
        ? feature.geometry.coordinates
        : [];

    // togeojson stores times under coordinateProperties.times (nested per segment)
    const rawTimes =
      feature.properties?.coordinateProperties?.times ??
      feature.properties?.coordTimes ??
      feature.properties?.times ??
      [];

    // Flatten both coords and times — segments mirror each other
    const flatCoords = coords.flat();
    const flatTimes  = Array.isArray(rawTimes[0]) ? rawTimes.flat() : rawTimes;

    for (let i = 0; i < flatCoords.length; i++) {
      const [lon, lat] = flatCoords[i];
      const t = flatTimes[i];
      if (!t || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const date = new Date(t).toISOString().slice(0, 10);
      (byDate[date] ??= []).push({ x: lon, y: lat });
    }
  }
}

// ── Simplify and write ────────────────────────────────────────────────────────

let updated = 0;

for (const [date, points] of Object.entries(byDate)) {
  const simplified = simplify(points, TOLERANCE, true).map(p => [
    Math.round(p.y * 1e6) / 1e6,
    Math.round(p.x * 1e6) / 1e6,
  ]);

  if (!routes[date]) {
    // Day exists in GPX but not in Nebo — create a minimal entry
    routes[date] = { start: null, end: null, track: simplified };
  } else {
    routes[date].track = simplified;
  }
  updated++;
}

writeFileSync(ROUTES, JSON.stringify(routes, null, 2));
console.log(`Updated ${updated} daily tracks → ${ROUTES}`);
