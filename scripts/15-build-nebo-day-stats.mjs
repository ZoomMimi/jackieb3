#!/usr/bin/env node
/**
 * scripts/15-build-nebo-day-stats.mjs
 *
 * Extracts max/avg speed and a compact weather summary from nebo-logs.json
 * for every date that also has a Nebo map (src/data/nebo-maps.json), so
 * BlogPost.astro can show them alongside distance/underway hours at the top
 * of the post, without re-deriving anything at request time.
 *
 * Usage: node scripts/15-build-nebo-day-stats.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const logs = JSON.parse(readFileSync(join(ROOT, '.planning/data/nebo-logs.json'), 'utf8'));
const neboMaps = JSON.parse(readFileSync(join(ROOT, 'src/data/nebo-maps.json'), 'utf8'));
const logByDate = new Map(logs.map((l) => [l.date, l]));

function cToF(c) {
  return Math.round((c * 9) / 5 + 32);
}

function weatherStr(w) {
  if (!w || w.temp == null) return null;
  const t = w.unit === 'C' ? cToF(w.temp) : Math.round(w.temp);
  const wind = w.windKn != null ? `, ${Math.round(w.windKn)}kt ${w.windDir ?? ''}`.trim().replace(/,$/, '') : '';
  return `${t}°F${wind}`;
}

const out = {};
for (const date of Object.keys(neboMaps)) {
  const l = logByDate.get(date);
  if (!l) continue;
  const legs = l.legs ?? [];
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const departure = weatherStr(firstLeg?.weatherDeparture);
  const arrival = weatherStr(lastLeg?.weatherArrival);
  let weather = null;
  if (departure && arrival && departure !== arrival) weather = `${departure} → ${arrival}`;
  else if (departure) weather = departure;
  else if (arrival) weather = arrival;

  const entry = {};
  if (l.maxSpeedKts != null) entry.maxKnots = Math.round(l.maxSpeedKts * 10) / 10;
  if (l.avgSpeedKts != null) entry.avgKnots = Math.round(l.avgSpeedKts * 10) / 10;
  if (weather) entry.weather = weather;
  if (Object.keys(entry).length) out[date] = entry;
}

writeFileSync(join(ROOT, 'src/data/nebo-day-stats.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Wrote ${Object.keys(out).length} entries -> src/data/nebo-day-stats.json`);
