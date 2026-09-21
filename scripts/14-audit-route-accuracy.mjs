#!/usr/bin/env node
/**
 * scripts/14-audit-route-accuracy.mjs
 *
 * Read-only data-quality audit of src/data/daily-routes.json (the GPS-derived
 * track PostMiniMap renders), using Nebo's own reported stats as ground
 * truth. Two checks, since only 171 of ~625 days have a Nebo log:
 *
 *   A. Distance check (days WITH a Nebo log): compare Nebo's reported
 *      Distance (nm) against the haversine length of that day's
 *      daily-routes.json track. A big gap means the site's track is either
 *      missing real GPX data (falls back to a sparse photo-centroid path —
 *      "not smooth") or otherwise wrong.
 *
 *   B. Continuity check (every day, regardless of Nebo coverage): distance
 *      between one day's `end` point and the next day's `start` point.
 *      A day with no Nebo log still gets cross-checked this way — if it
 *      connects cleanly to Nebo-verified neighbors on both sides, that's
 *      indirect evidence its own track is plausible; if not, it's flagged
 *      the same way the 2023-08-02..08 land-trip week originally was
 *      (implausible-geometry, not a direct data source).
 *
 * Writes no files and changes nothing — this only reports. Fixing flagged
 * days (re-slicing GPX, dropping bad photos, etc.) is a separate, deliberate
 * follow-up per day.
 *
 * Usage: node scripts/14-audit-route-accuracy.mjs [--threshold-pct 25] [--gap-nm 3]
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
function argVal(flag, def) {
  const i = args.indexOf(flag);
  return i === -1 ? def : parseFloat(args[i + 1]);
}
const THRESHOLD_PCT = argVal('--threshold-pct', 25); // flag distance mismatches beyond this %
const GAP_NM = argVal('--gap-nm', 3); // flag day-to-day gaps beyond this many nm

const logs = JSON.parse(readFileSync(join(ROOT, '.planning/data/nebo-logs.json'), 'utf8'));
const routes = JSON.parse(readFileSync(join(ROOT, 'src/data/daily-routes.json'), 'utf8'));

const logByDate = new Map(logs.map((l) => [l.date, l]));
const dates = Object.keys(routes).sort();

function haversineNm(a, b) {
  const R_NM = 3440.065;
  const [lat1, lon1] = a, [lat2, lon2] = b;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R_NM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function trackLengthNm(track) {
  let total = 0;
  for (let i = 1; i < track.length; i++) total += haversineNm(track[i - 1], track[i]);
  return total;
}

// ── Check A: distance accuracy on Nebo-covered days ────────────────────────

const distanceFlags = [];
for (const date of dates) {
  const log = logByDate.get(date);
  if (!log || log.distanceNm == null) continue;
  const track = routes[date].track ?? [];
  const computed = trackLengthNm(track);
  const reported = log.distanceNm;
  const pctDiff = reported > 0 ? (Math.abs(computed - reported) / reported) * 100 : (computed > 0 ? 100 : 0);
  if (pctDiff >= THRESHOLD_PCT || track.length <= 2) {
    distanceFlags.push({
      date, reportedNm: reported, computedNm: Math.round(computed * 10) / 10,
      pctDiff: Math.round(pctDiff), trackPoints: track.length,
    });
  }
}

// ── Check B: day-to-day continuity, all days ───────────────────────────────

const continuityFlags = [];
for (let i = 0; i < dates.length - 1; i++) {
  const d1 = dates[i], d2 = dates[i + 1];
  const end1 = routes[d1].end;
  const start2 = routes[d2].start;
  if (!end1 || !start2) continue;
  // Only meaningful for actually-consecutive calendar days; skip gaps in the
  // voyage itself (e.g. weeks at anchor between legs).
  const daysApart = (new Date(d2) - new Date(d1)) / 86400000;
  if (daysApart !== 1) continue;
  const gap = haversineNm(end1, start2);
  if (gap >= GAP_NM) {
    continuityFlags.push({
      day1: d1, day2: d2, gapNm: Math.round(gap * 10) / 10,
      day1HasNebo: logByDate.has(d1), day2HasNebo: logByDate.has(d2),
    });
  }
}

// ── Report ───────────────────────────────────────────────────────────────

console.log(`\n=== Distance-accuracy flags (Nebo-covered days, >=${THRESHOLD_PCT}% off or <=2 track points) ===`);
console.log(`${distanceFlags.length} of ${dates.filter((d) => logByDate.has(d)).length} Nebo-covered days flagged\n`);
for (const f of distanceFlags) {
  console.log(`  ${f.date}: Nebo says ${f.reportedNm}nm, track computes ${f.computedNm}nm (${f.pctDiff}% off, ${f.trackPoints} track points)`);
}

console.log(`\n=== Continuity flags (consecutive days, >=${GAP_NM}nm gap between end/start) ===`);
console.log(`${continuityFlags.length} gaps found\n`);
for (const f of continuityFlags) {
  const tag = (has) => (has ? 'nebo' : 'NO-nebo');
  console.log(`  ${f.day1} (${tag(f.day1HasNebo)}) -> ${f.day2} (${tag(f.day2HasNebo)}): ${f.gapNm}nm gap`);
}

console.log(`\nTotals: ${distanceFlags.length} distance flags, ${continuityFlags.length} continuity flags.\n`);
