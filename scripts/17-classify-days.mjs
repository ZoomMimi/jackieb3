#!/usr/bin/env node
/**
 * scripts/17-classify-days.mjs
 *
 * DRY RUN ONLY — proposes, for every live migrated post, a classification
 * (transit / stop / off-boat) and a naming-convention title, using:
 *   - real photo dates (scripts/lib/photo-chronology.mjs — perceptual hash
 *     against the local Photos library; same tool that found the 05-26 vs
 *     05-31 Chesapeake City mixup)
 *   - Nebo's own reported distance for that date (.planning/data/nebo-logs.json)
 *     — a day with real distance > TRANSIT_NM is a transit day; near-zero or
 *     no log at all is a stop, UNLESS off-boat language is present in the text
 *   - the post's own existing `location` field and its chronologically
 *     nearest neighbor (by corrected real date) for transit origin/destination
 *
 * Writes .planning/data/day-classification-report.json. Does NOT touch any
 * post file, frontmatter, or nebo-maps.json — this is purely a proposal for
 * human review before scripts/18-apply-classification.mjs (or manual edits)
 * acts on it.
 *
 * Usage: node scripts/17-classify-days.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePhotoDate, dateFromTs } from './lib/photo-chronology.mjs';
import { locationDistanceMi, reverseGeocode } from './lib/geocode.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');
const TRANSIT_NM = 3; // real distance above this = the boat moved that day
const LOCATION_MISMATCH_MI = 20; // location text farther than this from real GPS is flagged as wrong

const OFFBOAT_RE = /\b(flew|flight|airport|drove to the airport|rental car|off the boat|left the boat|drove home|flew home|drove back)\b/i;

function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---\n', 3);
  if (end === -1) return { frontmatter: '', body: text };
  return { frontmatter: text.slice(4, end), body: text.slice(end + 4).replace(/^\n/, '') };
}
function parseFrontmatter(yaml) {
  const obj = {};
  for (const line of yaml.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    let val = line.slice(colon + 1).trim().replace(/^"(.*)"$/, '$1');
    if (val === 'true') obj[key] = true;
    else if (val === 'false') obj[key] = false;
    else obj[key] = val;
  }
  return obj;
}
function extractPhotoUrls(body) {
  const urls = [];
  for (const m of body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g)) urls.push(m[1]);
  return urls.filter((u) => !/\.(mov|mp4)$/i.test(u));
}

/** Strips the "(Days N-M)" / "Days N-M" / "Day N" portion off a title,
 *  leaving just the blogger's own place-description text — usually already
 *  specific and well-written (e.g. "Bobcaygeon to Fenelon Falls"). Trusting
 *  this over the vaguer `location` frontmatter field avoids downgrading a
 *  good title to a generic one, which the first draft of this script did. */
function extractPlacePhrase(title) {
  if (!title) return null;
  let t = title.replace(/\(?\s*Days?\s+[\d]+(?:\s*[-–—]\s*\d+)?\s*\)?/gi, '').trim();
  t = t.replace(/[-–—:,\s]+$/, '').trim();
  return t || null;
}
const TO_PATTERN_RE = /\bto\b/i;

const logs = JSON.parse(readFileSync(join(ROOT, '.planning', 'data', 'nebo-logs.json'), 'utf8'));
const logByDate = new Map(logs.map((l) => [l.date, l]));

const filenames = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));

const posts = [];
for (const filename of filenames) {
  const path = join(POSTS_DIR, filename);
  const raw = readFileSync(path, 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const fm = parseFrontmatter(frontmatter);
  if (fm.draft === true) continue; // stubs are already correctly auto-dated; not in scope

  const urls = extractPhotoUrls(body);
  if (urls.length === 0) continue;

  const resolved = [];
  for (const url of urls) {
    const r = await resolvePhotoDate(url, fm.date, { download: false }); // cache-only, no new downloads
    resolved.push(r);
  }
  // A "trusted" photo must have a real timestamp AND real GPS — a high-confidence
  // hash match with no GPS on the matched library photo is still useless for
  // placing the day, and averaging a null into a centroid silently produces
  // (0,0) ("null island"), which happened on the very first run of this script.
  const trusted = resolved.filter((r) => r.ts != null && r.lat != null && r.lon != null && (r.confidence === 'exact' || r.confidence === 'high'));
  if (trusted.length === 0) {
    posts.push({ filename, fmDate: fm.date, title: fm.title, location: fm.location, verified: false, reason: 'no high-confidence photo+GPS match (cached)' });
    continue;
  }

  const dates = trusted.map((r) => dateFromTs(r.ts)).sort();
  const minDate = dates[0], maxDate = dates[dates.length - 1];
  const spanDays = (new Date(maxDate) - new Date(minDate)) / 86400000;
  const centroid = {
    lat: trusted.reduce((s, r) => s + r.lat, 0) / trusted.length,
    lon: trusted.reduce((s, r) => s + r.lon, 0) / trusted.length,
  };

  // does the real date range include any day the boat actually moved a meaningful distance?
  const distancesInRange = [];
  for (const d of new Set(dates)) {
    const log = logByDate.get(d);
    if (log?.distanceNm != null) distancesInRange.push({ date: d, nm: log.distanceNm });
  }
  const maxNm = distancesInRange.length ? Math.max(...distancesInRange.map((d) => d.nm)) : null;
  // Keyword scan alone is too unreliable (a Baltimore stop post mentioning the
  // earlier Colorado wedding as backstory tripped this on the first run) — it's
  // only used to flag a candidate for human review, never to auto-decide.
  const hasOffboatLanguage = OFFBOAT_RE.test(body);

  const placePhrase = extractPlacePhrase(fm.title);
  // A title already shaped "A to B" is the blogger's own signal that this was
  // a travel day — trust that over an absent/missing Nebo log (many transit
  // days, especially in Canada, have no log at all), rather than defaulting
  // to "stop" just because there's no distance figure to corroborate it.
  const titleImpliesTransit = placePhrase ? TO_PATTERN_RE.test(placePhrase) : false;

  let dayType, needsReview = false;
  if (trusted.length < 2 && spanDays === 0 && distancesInRange.length === 0 && !titleImpliesTransit) {
    // single photo, no corroborating Nebo data, no title hint — too thin to classify confidently
    dayType = 'stop'; needsReview = true;
  } else if (spanDays >= 2) {
    // multi-day real range: this is fundamentally a multi-day STAY even if one
    // edge day shows a departure/arrival leg (e.g. a rendezvous that ends with
    // travel to the next stop) — a single day's distance shouldn't flip a
    // week-long post to "transit". Flag for review if it in fact contains a
    // real transit leg, so a human can decide whether to split it.
    dayType = 'stop';
    if (maxNm != null && maxNm > TRANSIT_NM) needsReview = true;
  } else if (maxNm != null && maxNm > TRANSIT_NM) {
    dayType = 'transit';
  } else if (maxNm != null) {
    dayType = 'stop';
  } else if (titleImpliesTransit) {
    dayType = 'transit'; needsReview = true; // no Nebo corroboration — flagged, but title says "A to B"
  } else {
    dayType = 'stop'; // no Nebo log at all — default to stop, always flagged
    needsReview = true;
  }
  if (hasOffboatLanguage) needsReview = true; // never auto-assign off-boat; always human-confirmed

  // Location text check: forward-geocode the post's own `location` field and
  // compare by DISTANCE to the real centroid. Text/state-level matching was
  // tried and rejected — see scripts/lib/geocode.mjs docstring for the case
  // that broke it (a post "matched" its own label at the state level despite
  // the real place being 100mi away). A bare one-word label (a state or
  // "Great Loop" placeholder) can't be checked this way — Nominatim resolves
  // it to a huge area's centroid, which is naturally far from a specific
  // point without that being an error — so those are left unverified rather
  // than flagged.
  let locationDistMi = null, locationLikelyWrong = false, geocodedPlace = null;
  const isSpecificLabel = fm.location && /[A-Za-z].*[A-Za-z]/.test(fm.location) && fm.location.trim().toLowerCase() !== 'great loop' && /\s/.test(fm.location.trim());
  if (isSpecificLabel) {
    locationDistMi = await locationDistanceMi(fm.location, centroid);
    if (locationDistMi != null && locationDistMi > LOCATION_MISMATCH_MI) locationLikelyWrong = true;
  }
  if (!isSpecificLabel || locationLikelyWrong) {
    const geo = await reverseGeocode(centroid.lat, centroid.lon);
    if (geo?.city || geo?.county) geocodedPlace = `${geo.city || geo.county}${geo.state ? ' ' + geo.state : ''}`;
  }

  posts.push({
    filename, fmDate: fm.date, title: fm.title, location: fm.location, placePhrase, titleImpliesTransit,
    verified: true, minDate, maxDate, spanDays, centroid, nTrusted: trusted.length,
    distancesInRange, maxNm, hasOffboatLanguage, dayType, needsReview,
    locationDistMi, locationLikelyWrong, geocodedPlace,
    correctedLocation: locationLikelyWrong ? (geocodedPlace || fm.location) : (isSpecificLabel ? fm.location : (geocodedPlace || fm.location)),
    dateMismatch: fm.date !== minDate && fm.date !== maxDate ? { fmDate: fm.date, realRange: [minDate, maxDate] } : null,
  });
  if (locationLikelyWrong) posts[posts.length - 1].needsReview = true;
}

// Existing "Day N" / "Days N-M" labels are the blogger's own trip-day count.
// Recomputing them from scratch (calendar days since voyage start) doesn't
// match the blogger's own numbering elsewhere on the site (verified: off by
// several days on a spot check) and would create a jarring inconsistency
// with the hundreds of untouched posts around it — so these are preserved
// verbatim, never recalculated.
function extractDayLabel(title) {
  const m = (title || '').match(/Days?\s+[\d]+(?:\s*[-–—]\s*\d+)?/i);
  return m ? m[0] : null;
}

// second pass: assign transit origin = nearest-preceding CONFIDENT post's
// location, by corrected real date — but only within MAX_NEIGHBOR_DAYS of
// real time. Confident matches are sparse (most posts have only 1-2 trusted
// photos), so "nearest chronologically" in the whole 72-post/2-year set can
// mean over a year away — the first version of this script proposed "Trent-
// Severn Waterway [Ontario, Jul 2022] to Stock Island FL [Feb 2024]" as a
// single day's travel because that's what "nearest" resolved to. A distant
// neighbor is worse than no neighbor.
const MAX_NEIGHBOR_DAYS = 14;
const verifiedSorted = posts.filter((p) => p.verified).sort((a, b) => (a.minDate || '').localeCompare(b.minDate || ''));
for (let i = 0; i < verifiedSorted.length; i++) {
  const p = verifiedSorted[i];
  const dayLabel = extractDayLabel(p.title);
  // Prefer the blogger's own place-description (already specific and
  // well-written) over the vaguer `location` field, UNLESS real GPS proved
  // the location field wrong — in which case the human text is suspect too
  // and the geocoded correction is the safer bet.
  const placeName = p.locationLikelyWrong ? p.correctedLocation : (p.placePhrase || p.correctedLocation);

  if (p.dayType === 'transit') {
    let prev = null;
    for (let j = i - 1; j >= 0; j--) {
      const cand = verifiedSorted[j];
      if (cand.needsReview) continue;
      const gapDays = (new Date(p.minDate) - new Date(cand.maxDate)) / 86400000;
      if (gapDays > MAX_NEIGHBOR_DAYS) break; // sorted by date — nothing closer further back either
      prev = cand; break;
    }
    const prevPlace = prev ? (prev.locationLikelyWrong ? prev.correctedLocation : (prev.placePhrase || prev.correctedLocation)) : null;
    p.proposedOrigin = prevPlace;
    p.proposedDestination = placeName;
    if (p.proposedOrigin && p.proposedOrigin !== p.proposedDestination && !TO_PATTERN_RE.test(p.placePhrase || '')) {
      p.proposedTitle = `${p.proposedOrigin} to ${p.proposedDestination}` + (dayLabel ? ` — ${dayLabel}` : '');
    } else if (p.titleImpliesTransit && !p.locationLikelyWrong) {
      // title already says "A to B" and the location wasn't proven wrong — trust it verbatim
      p.proposedTitle = p.placePhrase + (dayLabel ? ` — ${dayLabel}` : '');
    } else {
      p.proposedTitle = `To ${p.proposedDestination}` + (dayLabel ? ` — ${dayLabel}` : '');
      p.needsReview = true; // no distinct, temporally-close origin found — worth a human look
    }
  } else if (p.dayType === 'stop') {
    p.proposedTitle = `${placeName} — ${dayLabel || 'stop'}`;
  } else if (p.dayType === 'off-boat') {
    p.proposedTitle = `${placeName} (off-boat)` + (dayLabel ? ` — ${dayLabel}` : '');
  }
}

writeFileSync(join(ROOT, '.planning', 'data', 'day-classification-report.json'), JSON.stringify(posts, null, 2) + '\n', 'utf8');

const verified = posts.filter((p) => p.verified);
const byType = { transit: 0, stop: 0, 'off-boat': 0 };
for (const p of verified) byType[p.dayType]++;
console.log(`Classified ${verified.length}/${posts.length} live posts with photos.`);
console.log(`  transit: ${byType.transit}, stop: ${byType.stop}, off-boat: ${byType['off-boat']}`);
console.log(`  needs review (thin evidence / multi-day span with a travel leg / off-boat language / no distinct origin): ${verified.filter((p) => p.needsReview).length}`);
console.log(`  unverified (no cached high-confidence match): ${posts.length - verified.length}`);
console.log(`\nFull report: .planning/data/day-classification-report.json`);
