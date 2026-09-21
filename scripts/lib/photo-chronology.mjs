/**
 * scripts/lib/photo-chronology.mjs
 *
 * Resolves the REAL date/time/GPS of a photo used in a blog post, independent
 * of whatever date the post itself claims. Two very different photo sources
 * exist on this site, so two resolution strategies:
 *
 *   1. Phase 6 (AI-generated) posts store photos in a <Gallery> array as R2
 *      URLs shaped `great-loop/{date}/{uuid}.{ext}` (scripts/10-upload-r2.mjs)
 *      — {uuid} IS the real Photos-library UUID, so this is a direct,
 *      100%-confidence lookup in photo-index.json. No download needed.
 *
 *   2. Migrated (original Blogger) posts embed inline `![](url)` images
 *      hosted on blogger.googleusercontent.com. Google strips ALL EXIF
 *      (confirmed: no DateTimeOriginal, no GPSInfo survive re-upload) and the
 *      UUID-shaped filename in the URL is NOT a real Photos-library UUID (it
 *      doesn't appear in photo-index.json) — these must be identified by
 *      perceptual hash against the local Photos library's own derivative
 *      thumbnails, within a plausible date window around the post's claimed
 *      date. This is slower (downloads + hashes candidates) but reliable:
 *      real matches land at Hamming distance 0-5 out of 256 bits, with the
 *      next-best candidate typically 20+ away — a wide, trustworthy margin.
 *      (Verified 2026-09-21 against six real photos from a mis-dated 2022
 *      post — all correct matches landed at distance ≤5, next-best ≥23.)
 *
 * Results are cached to .planning/data/photo-chronology-cache.json (by URL)
 * since re-downloading/re-hashing Blogger images is slow and the answer
 * never changes.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, '.planning', 'data');
const PHOTO_INDEX_PATH = join(DATA_DIR, 'photo-index.json');
const CACHE_PATH = join(DATA_DIR, 'photo-chronology-cache.json');
const DERIVATIVES_ROOT = join(homedir(), 'Pictures', 'Photos Library.photoslibrary', 'resources', 'derivatives');

const UUID_RE = /([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})/;

// ── photo-index.json, memoized ──────────────────────────────────────────────

let _photoIndex = null;
function loadPhotoIndex() {
  if (_photoIndex) return _photoIndex;
  const idx = JSON.parse(readFileSync(PHOTO_INDEX_PATH, 'utf8'));
  const byUuid = new Map();
  const byDate = new Map(); // date -> [{uuid, ts, lat, lon, directory, kind}]
  for (const day of idx.days) {
    const list = [];
    for (const p of day.photos) {
      const rec = { uuid: p.uuid.toUpperCase(), ts: p.ts, lat: p.lat ?? null, lon: p.lon ?? null, directory: p.directory, kind: p.kind };
      byUuid.set(rec.uuid, rec);
      list.push(rec);
    }
    byDate.set(day.date, list);
  }
  _photoIndex = { byUuid, byDate, dates: [...byDate.keys()].sort() };
  return _photoIndex;
}

// ── cache ────────────────────────────────────────────────────────────────────

let _cache = null;
function loadCache() {
  if (_cache) return _cache;
  _cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};
  return _cache;
}
function saveCache() {
  writeFileSync(CACHE_PATH, JSON.stringify(_cache, null, 2) + '\n', 'utf8');
}

// ── perceptual hash (16x16 average hash → 256-bit hex string) ──────────────

async function ahashFromBuffer(buffer) {
  const { data } = await sharp(buffer)
    .resize(16, 16, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const avg = data.reduce((s, v) => s + v, 0) / data.length;
  let bits = '';
  for (const v of data) bits += v > avg ? '1' : '0';
  // pack to hex for compact storage
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

function hammingDistanceHex(a, b) {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { dist += x & 1; x >>= 1; }
  }
  return dist;
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── candidate hash cache, per date-window ──────────────────────────────────
// Keyed by uuid so windows overlapping don't redo work across calls.

const _candidateHashCache = new Map(); // uuid -> hex hash | null (null = derivative missing/unreadable)

async function getCandidateHash(rec) {
  if (_candidateHashCache.has(rec.uuid)) return _candidateHashCache.get(rec.uuid);
  const deriv = join(DERIVATIVES_ROOT, rec.directory, `${rec.uuid}_1_105_c.jpeg`);
  if (!existsSync(deriv)) { _candidateHashCache.set(rec.uuid, null); return null; }
  try {
    const hash = await ahashFromBuffer(readFileSync(deriv));
    _candidateHashCache.set(rec.uuid, hash);
    return hash;
  } catch {
    _candidateHashCache.set(rec.uuid, null);
    return null;
  }
}

function datesInWindow(centerDate, daysBefore, daysAfter) {
  const idx = loadPhotoIndex();
  const center = new Date(centerDate + 'T00:00:00');
  const wanted = new Set();
  for (let d = -daysBefore; d <= daysAfter; d++) {
    const dt = new Date(center);
    dt.setDate(dt.getDate() + d);
    wanted.add(dt.toISOString().slice(0, 10));
  }
  return idx.dates.filter((d) => wanted.has(d));
}

// ── public API ───────────────────────────────────────────────────────────────

export function extractUuid(url) {
  const m = url.match(UUID_RE);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Direct lookup only (no download/hash). Use for Phase 6 R2 photos where the
 * URL's UUID is guaranteed to be the real Photos-library UUID.
 */
export function resolveDirect(url) {
  const uuid = extractUuid(url);
  if (!uuid) return null;
  const idx = loadPhotoIndex();
  const rec = idx.byUuid.get(uuid);
  if (!rec) return null;
  return { ts: rec.ts, lat: rec.lat, lon: rec.lon, uuid, confidence: 'exact', method: 'direct-uuid', distance: 0 };
}

/**
 * Full resolution: try direct UUID lookup first (fast path — covers Phase 6
 * R2 photos and any legacy photo whose UUID happens to still be indexed),
 * then fall back to perceptual-hash matching against a date window around
 * `hintDate` (the post's own claimed date — used only to bound the search,
 * never trusted as the answer).
 *
 * windowDays: how many days before/after hintDate to search. Widen this if
 * a post's date could be off by more than a few days (e.g. retrospective
 * catch-up posts after an off-boat trip).
 */
export async function resolvePhotoDate(url, hintDate, { windowDays = 5, download = true } = {}) {
  const cache = loadCache();
  if (cache[url]) return cache[url];

  const direct = resolveDirect(url);
  if (direct) { cache[url] = direct; saveCache(); return direct; }

  if (!download || !hintDate) {
    const result = { ts: null, lat: null, lon: null, uuid: extractUuid(url), confidence: 'none', method: 'unresolved', distance: null };
    cache[url] = result;
    saveCache();
    return result;
  }

  const idx = loadPhotoIndex();
  const candDates = datesInWindow(hintDate, windowDays, windowDays);
  const candidates = [];
  for (const d of candDates) {
    for (const rec of idx.byDate.get(d) ?? []) {
      if (rec.kind !== 0) continue; // photos only, skip videos
      candidates.push(rec);
    }
  }

  let targetHash;
  try {
    targetHash = await ahashFromBuffer(await fetchBuffer(url));
  } catch (err) {
    const result = { ts: null, lat: null, lon: null, uuid: extractUuid(url), confidence: 'none', method: 'fetch-failed', distance: null, error: String(err) };
    cache[url] = result;
    saveCache();
    return result;
  }

  let best = null, secondBest = null;
  for (const rec of candidates) {
    const hash = await getCandidateHash(rec);
    if (!hash) continue;
    const dist = hammingDistanceHex(targetHash, hash);
    if (!best || dist < best.dist) { secondBest = best; best = { dist, rec }; }
    else if (!secondBest || dist < secondBest.dist) { secondBest = { dist, rec }; }
  }

  if (!best) {
    const result = { ts: null, lat: null, lon: null, uuid: extractUuid(url), confidence: 'none', method: 'no-candidates', distance: null };
    cache[url] = result;
    saveCache();
    return result;
  }

  const margin = secondBest ? secondBest.dist - best.dist : 999;
  let confidence;
  if (best.dist <= 6 && margin >= 15) confidence = 'high';
  else if (best.dist <= 15 && margin >= 8) confidence = 'medium';
  else confidence = 'low';

  const result = {
    ts: best.rec.ts, lat: best.rec.lat, lon: best.rec.lon,
    uuid: best.rec.uuid, confidence, method: 'perceptual-hash',
    distance: best.dist, secondBestDistance: secondBest ? secondBest.dist : null,
  };
  cache[url] = result;
  saveCache();
  return result;
}

export function clearCacheEntry(url) {
  const cache = loadCache();
  delete cache[url];
  saveCache();
}

export function dateFromTs(ts) {
  if (ts == null) return null;
  return new Date(ts * 1000).toISOString().slice(0, 10);
}
