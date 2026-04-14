#!/usr/bin/env node
/**
 * scripts/03-correlate.mjs
 *
 * Merges three data sources by date into a single enriched timeline:
 *   - photo-index.json      (photos with GPS + timestamps, per day)
 *   - nebo-logs.json        (Nebo voyage stats per day)
 *   - voyage-timeline.json  (location names + movement, from script 01)
 *
 * Output: .planning/data/voyage-timeline-enriched.json
 *
 * Usage:
 *   node scripts/03-correlate.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join }                        from 'node:path';
import { fileURLToPath }               from 'node:url';
import { dirname }                     from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '..', '.planning', 'data');

// ── Load ──────────────────────────────────────────────────────────────────────

console.log('Loading data sources...');

const photoIndex = JSON.parse(readFileSync(join(DATA_DIR, 'photo-index.json'), 'utf8'));
const neboRaw    = JSON.parse(readFileSync(join(DATA_DIR, 'nebo-logs.json'), 'utf8'));
const timeline   = JSON.parse(readFileSync(join(DATA_DIR, 'voyage-timeline.json'), 'utf8'));

// ── Index by date ─────────────────────────────────────────────────────────────

const photoByDate    = new Map(photoIndex.days.map(d => [d.date, d]));
const timelineByDate = new Map(timeline.days.map(d => [d.date, d]));

// nebo-logs.json is a plain object keyed by numeric index
const neboByDate = new Map();
for (const entry of Object.values(neboRaw)) {
  if (entry.date && entry.distanceNm !== undefined) {
    neboByDate.set(entry.date, entry);
  }
}

console.log(`  Photo days:   ${photoByDate.size}`);
console.log(`  Nebo logs:    ${neboByDate.size}  (${Object.keys(neboRaw).length - neboByDate.size} skipped — missing date/stats)`);
console.log(`  Timeline days: ${timelineByDate.size}`);

// ── Merge ─────────────────────────────────────────────────────────────────────

const allDates = new Set([
  ...photoByDate.keys(),
  ...neboByDate.keys(),
  ...timelineByDate.keys(),
]);

const days = [...allDates].sort().map(date => {
  const photo = photoByDate.get(date);
  const nebo  = neboByDate.get(date);
  const tl    = timelineByDate.get(date);

  return {
    date,
    location:     tl?.location      ?? null,
    centroidLat:  photo?.centroidLat ?? tl?.centroidLat ?? null,
    centroidLon:  photo?.centroidLon ?? tl?.centroidLon ?? null,
    milesFromPrev: tl?.milesFromPrev ?? null,

    photoCount: photo?.photoCount ?? 0,
    withGps:    photo?.withGps    ?? 0,
    photos:     photo?.photos     ?? [],
    hasPhotos:  (photo?.photoCount ?? 0) > 0,

    nebo: nebo ? {
      distanceNm:         nebo.distanceNm,
      underwayHours:      nebo.underwayHours,
      underwayFormatted:  nebo.underwayFormatted,
      durationHours:      nebo.durationHours,
      durationFormatted:  nebo.durationFormatted,
      maxSpeedKts:        nebo.maxSpeedKts,
      avgSpeedKts:        nebo.avgSpeedKts,
      pdfUuid:            nebo.pdfUuid,
      raw:                nebo.raw,
    } : null,
    hasNebo: !!nebo,
  };
});

// ── Stats ─────────────────────────────────────────────────────────────────────

const withPhotos = days.filter(d => d.hasPhotos).length;
const withNebo   = days.filter(d => d.hasNebo).length;
const withBoth   = days.filter(d => d.hasPhotos && d.hasNebo).length;
const totalPhotos = days.reduce((n, d) => n + d.photoCount, 0);

console.log(`\n── Correlation Summary ──────────────────────────────`);
console.log(`  Total dates:       ${days.length}`);
console.log(`  With photos:       ${withPhotos}  (${totalPhotos} total photos)`);
console.log(`  With Nebo logs:    ${withNebo}`);
console.log(`  With both:         ${withBoth}`);
console.log(`  Photos only:       ${withPhotos - withBoth}`);
console.log(`  Nebo only:         ${withNebo - withBoth}`);
console.log(`  First date:        ${days.at(0)?.date}`);
console.log(`  Last date:         ${days.at(-1)?.date}`);
console.log(`────────────────────────────────────────────────────\n`);

// ── Output ────────────────────────────────────────────────────────────────────

const output = {
  generated: new Date().toISOString(),
  stats: { totalDays: days.length, withPhotos, withNebo, withBoth, totalPhotos },
  days,
  segments: timeline.segments,
};

const outPath = join(DATA_DIR, 'voyage-timeline-enriched.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote: ${outPath}`);
