#!/usr/bin/env node
/**
 * scripts/00-index-photos.mjs
 *
 * Indexes the iCloud Photos library directly via its SQLite database.
 * Outputs a JSON voyage timeline: one entry per day with GPS centroid,
 * photo list, and coverage stats.
 *
 * Uses Node 22+ built-in node:sqlite — no npm packages required.
 *
 * Usage:
 *   node scripts/00-index-photos.mjs
 *   node scripts/00-index-photos.mjs --start 2022-04-01 --end 2024-05-31
 */

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────

const PHOTOS_DB = `${process.env.HOME}/Pictures/Photos Library.photoslibrary/database/Photos.sqlite`;
const OUTPUT_DIR = join(__dirname, '..', '.planning', 'data');

// Voyage date range (default: full Great Loop)
const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const START_DATE = getArg('--start') ?? '2022-04-01';
const END_DATE   = getArg('--end')   ?? '2024-05-31';

// CoreData epoch offset: Apple stores timestamps as seconds since 2001-01-01
const CD_EPOCH = 978307200;

function toCoreDateRange(isoStart, isoEnd) {
  const s = Math.floor(new Date(isoStart).getTime() / 1000) - CD_EPOCH;
  const e = Math.floor(new Date(isoEnd + 'T23:59:59Z').getTime() / 1000) - CD_EPOCH;
  return { s, e };
}

function fromCoreDate(ts) {
  return new Date((ts + CD_EPOCH) * 1000).toISOString().slice(0, 10);
}

// ── Query ───────────────────────────────────────────────────────────────────

console.log(`Opening Photos library: ${PHOTOS_DB}`);
console.log(`Voyage range: ${START_DATE} → ${END_DATE}\n`);

const db = new DatabaseSync(PHOTOS_DB, { readOnly: true });
const { s, e } = toCoreDateRange(START_DATE, END_DATE);

// All voyage photos and videos (ZKIND 0 = photo, 1 = video)
const rows = db.prepare(`
  SELECT
    ZDATECREATED                                     AS ts,
    ZFILENAME                                        AS filename,
    ZDIRECTORY                                       AS directory,
    ZUUID                                            AS uuid,
    ZLATITUDE                                        AS lat,
    ZLONGITUDE                                       AS lon,
    ZKIND                                            AS kind
  FROM ZASSET
  WHERE ZTRASHEDSTATE = 0
    AND ZKIND IN (0, 1)
    AND ZDATECREATED BETWEEN ? AND ?
  ORDER BY ZDATECREATED ASC
`).all(s, e);

db.close();

const photoCount = rows.filter(r => r.kind === 0).length;
const videoCount = rows.filter(r => r.kind === 1).length;
console.log(`Total in range: ${rows.length}  (${photoCount} photos, ${videoCount} videos)`);

// ── Process ─────────────────────────────────────────────────────────────────

const GPS_SENTINEL = -180.0;

const byDay = new Map();

for (const row of rows) {
  const date = fromCoreDate(row.ts);
  if (!byDay.has(date)) {
    byDay.set(date, { date, photos: [], withGps: 0, noGps: 0 });
  }
  const day = byDay.get(date);
  const hasGps = row.lat !== null && row.lat !== GPS_SENTINEL;

  day.photos.push({
    uuid: row.uuid,
    filename: row.filename,
    directory: row.directory,
    kind: row.kind, // 0 = photo, 1 = video
    ts: row.ts + CD_EPOCH, // Unix timestamp
    lat: hasGps ? Math.round(row.lat * 10000) / 10000 : null,
    lon: hasGps ? Math.round(row.lon * 10000) / 10000 : null,
  });

  if (hasGps) day.withGps++; else day.noGps++;
}

// Build day summaries: centroid GPS from median of GPS photos
const days = [...byDay.values()].map(day => {
  const gpsPhotos = day.photos.filter(p => p.lat !== null);

  let centroidLat = null, centroidLon = null;
  if (gpsPhotos.length > 0) {
    const lats = gpsPhotos.map(p => p.lat).sort((a, b) => a - b);
    const lons = gpsPhotos.map(p => p.lon).sort((a, b) => a - b);
    const mid = Math.floor(lats.length / 2);
    centroidLat = Math.round(lats[mid] * 10000) / 10000;
    centroidLon = Math.round(lons[mid] * 10000) / 10000;
  }

  return {
    date: day.date,
    photoCount: day.photos.length,
    withGps: day.withGps,
    noGps: day.noGps,
    centroidLat,
    centroidLon,
    photos: day.photos,
  };
});

// ── Stats ────────────────────────────────────────────────────────────────────

const totalItems   = days.reduce((n, d) => n + d.photoCount, 0);
const totalVideos  = days.reduce((n, d) => n + d.photos.filter(p => p.kind === 1).length, 0);
const totalPhotos  = totalItems - totalVideos;
const totalGps     = days.reduce((n, d) => n + d.withGps, 0);
const totalNoGps   = days.reduce((n, d) => n + d.noGps, 0);
const daysWithData = days.length;
const daysWithGps  = days.filter(d => d.withGps > 0).length;

console.log(`\n── Media Index Summary ──────────────────────────────`);
console.log(`  Days with media  : ${daysWithData}`);
console.log(`  Days with GPS    : ${daysWithGps}`);
console.log(`  Total items      : ${totalItems}  (${totalPhotos} photos, ${totalVideos} videos)`);
console.log(`  With GPS         : ${totalGps} (${Math.round(totalGps/totalItems*100)}%)`);
console.log(`  Without GPS      : ${totalNoGps}`);
console.log(`  First day        : ${days[0]?.date}`);
console.log(`  Last day         : ${days[days.length - 1]?.date}`);
console.log(`────────────────────────────────────────────────────\n`);

// Monthly breakdown
const byMonth = new Map();
for (const d of days) {
  const m = d.date.slice(0, 7);
  if (!byMonth.has(m)) byMonth.set(m, { total: 0, withGps: 0 });
  byMonth.get(m).total  += d.photoCount;
  byMonth.get(m).withGps += d.withGps;
}
console.log('Monthly breakdown:');
for (const [month, stats] of byMonth) {
  const pct = Math.round(stats.withGps / stats.total * 100);
  console.log(`  ${month}  ${String(stats.total).padStart(5)} photos  ${pct}% GPS`);
}
console.log('');

// ── Output ───────────────────────────────────────────────────────────────────

mkdirSync(OUTPUT_DIR, { recursive: true });

// Full index (all photos with GPS)
const outputPath = join(OUTPUT_DIR, 'photo-index.json');
writeFileSync(outputPath, JSON.stringify({
  generated: new Date().toISOString(),
  range: { start: START_DATE, end: END_DATE },
  stats: { totalPhotos, totalGps, totalNoGps, daysWithData, daysWithGps },
  days
}, null, 2));
console.log(`Wrote: ${outputPath}`);

// Day summary (no photo arrays — lightweight for downstream scripts)
const summaryPath = join(OUTPUT_DIR, 'photo-summary.json');
const summary = days.map(d => ({
  date: d.date,
  photoCount: d.photoCount,
  withGps: d.withGps,
  centroidLat: d.centroidLat,
  centroidLon: d.centroidLon,
}));
writeFileSync(summaryPath, JSON.stringify({
  generated: new Date().toISOString(),
  range: { start: START_DATE, end: END_DATE },
  days: summary
}, null, 2));
console.log(`Wrote: ${summaryPath}`);
