/**
 * scripts/lib/geocode.mjs
 *
 * Reverse-geocodes a lat/lon into a place name via OpenStreetMap Nominatim,
 * to cross-check a post's own `location` text field against its real,
 * photo-verified GPS — the same class of defect as the date mismatches
 * (Cape May labeled "Chesapeake City", Colorado labeled "Baltimore MD"),
 * just in the location field instead of the date field.
 *
 * Respects Nominatim's usage policy: max 1 req/sec, custom User-Agent,
 * results cached indefinitely (a lat/lon's place name never changes) so a
 * re-run never re-hits the API for the same point.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, '..', '..', '.planning', 'data', 'geocode-cache.json');

let _cache = null;
function loadCache() {
  if (_cache) return _cache;
  _cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};
  return _cache;
}
function saveCache() {
  writeFileSync(CACHE_PATH, JSON.stringify(_cache, null, 2) + '\n', 'utf8');
}

function cacheKey(lat, lon) {
  // round to ~1km — plenty precise for "which town is this" and keeps the
  // cache small when many photos cluster around the same anchorage
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

let _lastCallTs = 0;
async function throttle() {
  const elapsed = Date.now() - _lastCallTs;
  if (elapsed < 1100) await new Promise((r) => setTimeout(r, 1100 - elapsed));
  _lastCallTs = Date.now();
}

/**
 * Returns { city, state, county, raw } or null on failure. `city` falls back
 * through town/village/hamlet since Nominatim doesn't guarantee `city` for
 * small marinas/anchorages.
 */
export async function reverseGeocode(lat, lon) {
  const key = cacheKey(lat, lon);
  const cache = loadCache();
  if (cache[key]) return cache[key];

  await throttle();
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'jackieb3-great-loop-blog-data-cleanup/1.0 (personal, non-commercial)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.hamlet || a.municipality || null;
    const state = a['ISO3166-2-lvl4']?.split('-')[1] || a.state_code || null;
    const result = { city, state, county: a.county || null, country: a.country_code || null, displayName: data.display_name || null };
    cache[key] = result;
    saveCache();
    return result;
  } catch (err) {
    const result = { city: null, state: null, county: null, country: null, displayName: null, error: String(err) };
    cache[key] = result;
    saveCache();
    return result;
  }
}

/**
 * Forward geocode: turn a place-name string (a post's existing `location`
 * field, e.g. "Gulf Shores / Orange Beach AL") into coordinates, so it can be
 * compared by DISTANCE to the real photo-verified centroid. Text/state-level
 * matching was tried first and rejected — it passes anything in the right
 * STATE even when the actual place is 100+ miles off (verified case: a post
 * whose real photos centroid on Washington County AL, 100mi inland, still
 * "matched" its "Gulf Shores / Orange Beach AL" label on a state-code check).
 * Distance is the only check that actually catches that.
 */
export async function forwardGeocode(placeName) {
  const key = `fwd:${placeName.toLowerCase()}`;
  const cache = loadCache();
  if (cache[key]) return cache[key];

  await throttle();
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&countrycodes=us,ca&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'jackieb3-great-loop-blog-data-cleanup/1.0 (personal, non-commercial)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data.length ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), displayName: data[0].display_name } : null;
    cache[key] = result;
    saveCache();
    return result;
  } catch (err) {
    cache[key] = null;
    saveCache();
    return null;
  }
}

function distMi(a, b) {
  return Math.hypot((a.lat - b.lat) * 69, (a.lon - b.lon) * 54.6);
}

/**
 * Splits a "A / B STATE" or "A, B" style location string on the first
 * separator and forward-geocodes each named part (a compound label like
 * "Gulf Shores / Orange Beach AL" names two towns — either one being close
 * to the real centroid is a pass). Returns the closest distance in miles, or
 * null if no part could be geocoded.
 */
export async function locationDistanceMi(locationText, centroid) {
  if (!locationText || !centroid) return null;
  const parts = locationText.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  const stateMatch = locationText.match(/\b([A-Z]{2})\b\s*$/);
  const state = stateMatch ? stateMatch[1] : '';
  let best = null;
  for (const part of parts) {
    const query = state && !new RegExp(`\\b${state}\\b`).test(part) ? `${part} ${state}` : part;
    const geo = await forwardGeocode(query);
    if (!geo) continue;
    const d = distMi(centroid, geo);
    if (best == null || d < best) best = d;
  }
  return best;
}
