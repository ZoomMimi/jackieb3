#!/usr/bin/env node
/**
 * scripts/simplify-gpx.mjs
 *
 * Converts Nebo GPX export files in .planning/data/gpx/ into a simplified
 * GeoJSON Feature (LineString) written to src/data/route-track.json for
 * import by VoyageMap.astro at build time.
 *
 * When no GPX files are present, writes a valid empty-coordinates stub so
 * that `astro build` never fails on the VoyageMap import before real GPX
 * data exists.
 *
 * Usage:
 *   node scripts/simplify-gpx.mjs            # write output file
 *   node scripts/simplify-gpx.mjs --dry-run  # compute + log size, skip write
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gpx } from '@tmcw/togeojson';
import simplify from 'simplify-js';
import { DOMParser } from '@xmldom/xmldom';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Constants ─────────────────────────────────────────────────────────────────

const GPX_DIR    = join(__dirname, '..', '.planning', 'data', 'gpx');
const OUTPUT     = join(__dirname, '..', 'src', 'data', 'route-track.json');
const TOLERANCE  = 0.001;   // ~110 m; raise if SIZE_LIMIT exceeded
const SIZE_LIMIT = 500_000; // 500 KB hard cap (MAP-02 success criteria)

const DRY_RUN = process.argv.includes('--dry-run');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Write an empty-coordinates stub so downstream imports always succeed. */
function writeStub() {
  mkdirSync(join(__dirname, '..', 'src', 'data'), { recursive: true });
  const stub = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [] },
    properties: {},
  };
  if (!DRY_RUN) {
    writeFileSync(OUTPUT, JSON.stringify(stub));
  }
  return stub;
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Guard: no GPX directory or zero .gpx files → write stub and exit
if (!existsSync(GPX_DIR) || readdirSync(GPX_DIR).filter(f => f.endsWith('.gpx')).length === 0) {
  writeStub();
  console.log('No GPX files found in .planning/data/gpx/ — stub route-track.json written.');
  process.exit(0);
}

// ── Collect coordinates from every GPX file ───────────────────────────────────

const gpxFiles = readdirSync(GPX_DIR).filter(f => f.endsWith('.gpx'));
let allPoints = [];

for (const file of gpxFiles) {
  const xml     = readFileSync(join(GPX_DIR, file), 'utf8');
  const doc     = new DOMParser().parseFromString(xml, 'text/xml');
  const geojson = gpx(doc);

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === 'LineString') {
      allPoints.push(...feature.geometry.coordinates);
    } else if (feature.geometry.type === 'MultiLineString') {
      // @tmcw/togeojson emits MultiLineString for GPX tracks with >1 <trkseg>
      // (e.g. Nebo exports after a pause or power cycle). Flatten all segments.
      for (const segment of feature.geometry.coordinates) {
        allPoints.push(...segment);
      }
    }
  }
}

const rawCount = allPoints.length;

// ── Simplify ──────────────────────────────────────────────────────────────────

// simplify-js uses {x, y} — map [lon, lat] coords accordingly
const pts        = allPoints.map(([lon, lat]) => ({ x: lon, y: lat }));
const simplified = simplify(pts, TOLERANCE, true /* highQuality */);
const coords     = simplified.map(p => [p.x, p.y]);

// ── Build output ──────────────────────────────────────────────────────────────

const output = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: coords },
  properties: {},
};

const json  = JSON.stringify(output);
const bytes = Buffer.byteLength(json, 'utf8');

// ── Size gate (T-05-01 mitigation) — MUST run before writeFileSync ───────────
// Checking after the write would leave an oversized file on disk that astro dev
// silently consumes on subsequent runs, violating the MAP-02 500 KB hard cap.

if (bytes > SIZE_LIMIT) {
  console.error(
    `\nERROR: Output is ${(bytes / 1024).toFixed(0)} KB — exceeds 500 KB limit.\n` +
    `Raise TOLERANCE (currently ${TOLERANCE}) and re-run to reduce file size.`
  );
  process.exit(1);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`GPX files processed:  ${gpxFiles.length}`);
console.log(`Raw points:           ${rawCount}`);
console.log(`Simplified points:    ${coords.length}`);
console.log(`Output size:          ${(bytes / 1024).toFixed(1)} KB${DRY_RUN ? ' (dry-run, not written)' : ''}`);

// ── Write (unless dry-run) ────────────────────────────────────────────────────

if (!DRY_RUN) {
  mkdirSync(join(__dirname, '..', 'src', 'data'), { recursive: true });
  writeFileSync(OUTPUT, json);
}
