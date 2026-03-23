# Data Pipeline Research: GPX/EXIF Processing

**Project:** Jackie B III Going Loopy — Great Loop cruise blog
**Researched:** 2026-03-23
**Overall confidence:** MEDIUM-HIGH (training knowledge through Aug 2025; external tool access unavailable during this session — version numbers should be verified against npm before pinning in package.json)

---

## Executive Summary

The data pipeline has five distinct stages: (1) ingest raw Nebo GPS exports, (2) extract EXIF coordinates from iPhone photos, (3) correlate photos to route segments by timestamp, (4) parse voyage summary emails into structured data, (5) generate or enrich blog posts using the combined data. All five stages are well-supported by mature Node.js libraries. The trickiest parts are timezone handling in timestamp correlation and the mbox/email parsing step, which requires knowing the exact format of the Nebo summary emails before committing to a parser approach.

---

## 1. GPX Parsing in Node.js

### Recommended Library: `@tmcw/togeojson`

**Why:** Maintained by Tom MacWright (Mapbox alum), actively used in production mapping tools, converts GPX directly to GeoJSON which is the standard interchange format for everything downstream (Leaflet, Mapbox, PostGIS, etc.). Returns plain JavaScript objects — no class instances to unwrap.

**Confidence:** HIGH — this is the de facto standard for GPX→GeoJSON in JS.

```javascript
import { gpx } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs';

const gpxText = fs.readFileSync('nebo-export.gpx', 'utf-8');
const dom = new DOMParser().parseFromString(gpxText, 'text/xml');
const geojson = gpx(dom);

// geojson.features is an array of LineString (tracks) and Point (waypoints)
// Each feature has:
//   feature.geometry.type: 'LineString' | 'Point'
//   feature.geometry.coordinates: [lon, lat, elevation?][] for LineString
//   feature.properties.name: track/waypoint name
//   feature.properties.time: ISO timestamp string (for tracks with <time> elements)
//   feature.properties.coordTimes: string[] — per-point timestamps for LineString
```

**Key detail — `coordTimes`:** When Nebo records a track with timestamps on each trackpoint (`<trkpt>` with `<time>` children), togeojson puts those per-point timestamps in `feature.properties.coordTimes`. This is what you use for photo correlation. Verify that your Nebo export actually includes `<time>` elements on trackpoints — not all GPS apps do.

**Alternative: `gpxparser`**
Simpler API, gives you `.tracks`, `.waypoints`, `.routes` as typed arrays. Good if you don't need GeoJSON. Slightly less maintained. Fine for simple track extraction but doesn't give you the GeoJSON structure you'll want for map rendering.

```javascript
import GPXParser from 'gpxparser';
const gpx = new GPXParser();
gpx.parse(fs.readFileSync('nebo-export.gpx', 'utf-8'));

// gpx.tracks[0].points → array of { lat, lon, ele, time }
// gpx.waypoints → array of { lat, lon, name, desc, time }
```

**Recommendation:** Use `@tmcw/togeojson` as the primary parser. The GeoJSON output is directly usable by Leaflet/Mapbox for map rendering and by any spatial query code. Use `gpxparser` only if you need its simpler typed API for a specific extraction step.

### GPX Structure You'll Get From Nebo Gold

Nebo exports GPX with:
- `<trk>` elements per voyage/day — contains `<trkseg>` with `<trkpt lat lon>` children
- Each `<trkpt>` has `<ele>` (elevation, will be 0 on water) and `<time>` in UTC ISO 8601
- `<wpt>` elements for saved waypoints (anchorages, marinas, hazards)
- `<name>` on each track matching the voyage name in the app
- `<desc>` may contain voyage notes

**Nebo CSV export** (if available alongside GPX): Likely has columns for timestamp, lat, lon, speed (knots), heading, distance. Treat this as a backup — GPX is richer. Parse CSV with the built-in `node:readline` streaming API or `csv-parse` for large files.

### Extracting a "Daily Summary" from a Track

```javascript
function summarizeTrack(feature) {
  const coords = feature.geometry.coordinates; // [lon, lat, ele][]
  const times = feature.properties.coordTimes; // ISO strings[]

  const startTime = new Date(times[0]);
  const endTime = new Date(times[times.length - 1]);
  const durationHours = (endTime - startTime) / 3_600_000;

  // Haversine distance
  let distanceNm = 0;
  for (let i = 1; i < coords.length; i++) {
    distanceNm += haversineNm(coords[i-1], coords[i]);
  }

  return {
    date: startTime.toISOString().split('T')[0],
    startLon: coords[0][0],
    startLat: coords[0][1],
    endLon: coords[coords.length-1][0],
    endLat: coords[coords.length-1][1],
    distanceNm,
    durationHours,
    trackpointCount: coords.length,
  };
}
```

---

## 2. EXIF Extraction from iPhone Photos

### Recommended Library: `exifr`

**Why:** Purpose-built for browser and Node.js, handles HEIC/HEIF (iPhone's native format since iOS 11) in addition to JPEG, extremely fast for bulk processing, returns plain objects, correct handling of GPS coordinate encoding.

**Confidence:** HIGH — exifr is the modern standard for this use case.

```javascript
import exifr from 'exifr';

// Single photo
const exif = await exifr.parse('IMG_1234.HEIC', {
  pick: ['DateTimeOriginal', 'GPSLatitude', 'GPSLongitude',
         'GPSLatitudeRef', 'GPSLongitudeRef', 'GPSAltitude',
         'Make', 'Model'],
});
// Returns:
// {
//   DateTimeOriginal: Date object,
//   latitude: 30.123456,   // exifr normalizes GPS to decimal degrees
//   longitude: -88.654321,
//   GPSAltitude: 5.2,
// }

// Bulk processing a directory
import { glob } from 'glob';
import path from 'path';

const photos = await glob('/path/to/photos/**/*.{jpg,jpeg,heic,HEIC,JPG}');
const results = await Promise.all(
  photos.map(async (filePath) => {
    try {
      const exif = await exifr.parse(filePath, {
        pick: ['DateTimeOriginal', 'latitude', 'longitude'],
      });
      if (!exif?.latitude || !exif?.DateTimeOriginal) return null;
      return { filePath, ...exif };
    } catch {
      return null; // screenshots, downloaded images have no EXIF
    }
  })
);
const geotagged = results.filter(Boolean);
```

**iPhone-specific gotchas:**

1. **HEIC format:** exifr handles HEIC natively. Sharp can also read HEIC but requires libvips compiled with HEIC support. exifr is lighter for metadata-only extraction.

2. **Timezone is not stored in EXIF.** `DateTimeOriginal` is local time with no UTC offset. You must know the timezone the phone was set to at the time of the photo. For a Great Loop trip, this means handling EDT, CDT, and CST transitions as the boat moves between timezones. The GPS coordinates themselves let you infer the timezone — see Section 3.

3. **GPS coordinates in EXIF:** iPhone photos always include GPS if Location Services was on for the Camera app. The coordinates are in degrees/minutes/seconds with a cardinal direction (N/S/E/W). exifr normalizes these to decimal degrees automatically. Raw EXIF readers give you the DMS array — you'd need to convert manually.

4. **Live Photos:** iPhone Live Photos export as paired .HEIC + .MOV files. Only the .HEIC has the EXIF you need; skip .MOV files.

5. **iCloud sync:** If photos came from iCloud Photos export (a .zip or folder from icloud.com), EXIF is preserved. If you used "Export Unmodified Original" from Photos.app, EXIF is fully intact. "Export" (without unmodified) may strip GPS depending on Privacy settings.

### Alternative: exiftool (CLI via child_process)

Phil Harvey's exiftool is the gold standard for EXIF completeness. Useful when you need fields exifr doesn't expose or for batch JSON output.

```bash
exiftool -json -GPSLatitude -GPSLongitude -DateTimeOriginal -r ./photos/ > exif-dump.json
```

Call from Node.js:
```javascript
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

const { stdout } = await execFileAsync('exiftool', [
  '-json', '-GPSLatitude', '-GPSLongitude',
  '-DateTimeOriginal', '-OffsetTimeOriginal',
  '-r', './photos/'
]);
const data = JSON.parse(stdout);
```

**Caveat:** exiftool must be installed on the machine (brew install exiftool). Not portable for CI. Use exifr for the primary pipeline, exiftool for one-off validation/debugging.

### Sharp for Thumbnails (Separate Concern)

Sharp is an image processing library — use it for generating resized thumbnails/WebP output for the blog, not for EXIF extraction. Sharp can read some EXIF but it's not its focus. Keep concerns separate: exifr for metadata, sharp for image transforms.

---

## 3. Correlating GPS Tracks with Photos by Timestamp

### The Core Problem

Given:
- A photo with `DateTimeOriginal = "2023-07-15 14:32:00"` (local time, no TZ)
- A GPX track with timestamps in UTC

You need to:
1. Determine what UTC offset to apply to the photo timestamp
2. Convert photo time to UTC
3. Find the nearest trackpoint within a reasonable window (e.g., ±5 minutes)

### Timezone Resolution Strategy

**Option A — Use photo GPS coordinates directly.** If the photo already has GPS, you don't need the track for location — you just use the photo's own coordinates. The track correlation is then only needed for photos that lack GPS.

**Option B — Infer timezone from GPS location.** Use a timezone lookup library with the photo's GPS coordinates (if present) or the track coordinates nearest in time.

```javascript
import tzlookup from 'tz-lookup'; // or geo-tz, timezone-support

// From photo's own GPS:
const tz = tzlookup(photo.latitude, photo.longitude);
// tz = "America/Chicago", "America/New_York", etc.

// Then use luxon or date-fns-tz to interpret the naive timestamp:
import { DateTime } from 'luxon';
const photoUtc = DateTime.fromJSDate(photo.DateTimeOriginal, { zone: tz }).toUTC();
```

**Option C — Manual offset table.** For a Great Loop trip, the timezone transitions are knowable from the route. You could hardcode a table: "before date X we were in Eastern time, after date Y we were in Central time." Crude but reliable if you don't want a TZ lookup dependency.

**Recommended:** Option A first (most iPhone photos on a boat will have GPS), fall back to Option C for the edge cases.

### Matching Algorithm

```javascript
function findNearestTrackpoint(photoUtc, trackpoints, windowMs = 5 * 60 * 1000) {
  let nearest = null;
  let minDelta = Infinity;

  for (const pt of trackpoints) {
    const delta = Math.abs(pt.timeUtc - photoUtc);
    if (delta < minDelta) {
      minDelta = delta;
      nearest = pt;
    }
  }

  if (minDelta > windowMs) return null; // outside tolerance window
  return { ...nearest, deltaMs: minDelta };
}
```

For 5-minute granularity on a boat doing 8 knots, position error is ~0.67 nautical miles — acceptable for blog purposes.

### Handling Clock Drift

If the iPhone clock was synced to cellular/GPS time (normal behavior), drift is negligible. If photos came from a camera without GPS or network sync, apply a manual offset. exiftool can show `OffsetTimeOriginal` (the UTC offset stored in newer EXIF versions) — iPhone photos taken with iOS 13+ typically include this field, making timezone inference trivial.

### Output Structure

```javascript
// Enriched photo record
{
  filePath: '/photos/IMG_1234.HEIC',
  dateUtc: '2023-07-15T19:32:00Z',
  dateLocal: '2023-07-15T14:32:00',
  latitude: 30.123,
  longitude: -88.456,
  source: 'exif', // or 'track-interpolated'
  nearestTrackpoint: { lat, lon, timeUtc, distanceMeters },
  voyageDate: '2023-07-15',
  // Reverse-geocoded location name (add later):
  locationName: null,
}
```

---

## 4. Reverse Geocoding for Human-Readable Locations

You'll want "Pensacola, FL" not "lat 30.41 lon -87.22" in blog posts.

### Options

**Nominatim (OpenStreetMap) — free, no API key, rate-limited to 1 req/sec**

```javascript
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'JackieB3Blog/1.0 (contact@example.com)' }
  });
  const data = await res.json();
  // data.address = { city, town, county, state, country, ... }
  return data.address;
}
```

**Rate limiting:** At 1 req/sec, 1,000 photos takes ~17 minutes. Run this once, cache results to a JSON file. Never run on every build.

**Google Maps Geocoding API — fast, reliable, costs money after free tier**

For ~1,000 points in the Great Loop dataset, you'd be within the free monthly credit. But Nominatim is sufficient and free.

**Recommendation:** Nominatim, cached to `.planning/data/geocode-cache.json`, run as a one-time data enrichment script not a build step.

---

## 5. Email Parsing for Voyage Summaries

### Understanding the Format First

Before choosing a parser, you need to know what format the Nebo email archive is in:

| Format | How to Check | Parser |
|--------|-------------|--------|
| `.mbox` file (Gmail export via Takeout) | Single file, starts with `From ` lines | `mailsplit` + `mailparser` |
| Individual `.eml` files | Directory of files, each is RFC 2822 | `mailparser` directly |
| `.pst` / `.ost` (Outlook) | Binary format | `readpst` CLI tool first, then parse output |
| HTML files (saved from browser) | `.html` files, no headers | `cheerio` + custom parsing |
| Forwarded/pasted text | Plain text or markdown | Custom regex |

### Recommended: `mailparser` (nodemailer project)

Handles MIME encoding, multipart, base64, quoted-printable, attachments. The de facto standard for Node.js email parsing.

```javascript
import { simpleParser } from 'mailparser';
import fs from 'fs';

const emlContent = fs.readFileSync('voyage-2023-07-15.eml');
const parsed = await simpleParser(emlContent);

// parsed.subject: "Nebo Voyage Summary - July 15, 2023"
// parsed.text: plain text body
// parsed.html: HTML body (if multipart)
// parsed.date: Date object
// parsed.from.text: sender address
```

### Parsing an mbox Archive

```javascript
import { createReadStream } from 'fs';

// Split mbox into individual messages
// mbox format: each message starts with "From " (no colon) on a new line
function* splitMbox(content) {
  const messages = content.split(/^From /m).filter(Boolean);
  for (const msg of messages) {
    yield 'From ' + msg;
  }
}

const mboxContent = fs.readFileSync('nebo-emails.mbox', 'utf-8');
for (const rawMessage of splitMbox(mboxContent)) {
  const parsed = await simpleParser(rawMessage);
  // process...
}
```

### Extracting Structured Data from Nebo Email Bodies

Nebo voyage summary emails (based on known format as of 2024) contain:

- Voyage name / date
- Distance traveled (nautical miles)
- Average speed / max speed
- Duration underway
- Start and end location names
- Sometimes: fuel consumption, anchor time

The email body is typically HTML with a table or structured text. You'll need to reverse-engineer the exact template. Use `cheerio` for HTML parsing:

```javascript
import * as cheerio from 'cheerio';

function parseNeboEmailHtml(html) {
  const $ = cheerio.load(html);

  // Find summary table — exact selectors depend on Nebo's template
  const rows = {};
  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length === 2) {
      const key = $(cells[0]).text().trim().toLowerCase();
      const val = $(cells[1]).text().trim();
      rows[key] = val;
    }
  });

  return {
    distanceNm: parseFloat(rows['distance'] || rows['distance traveled'] || '0'),
    durationHours: parseDuration(rows['duration'] || rows['time underway'] || ''),
    avgSpeedKnots: parseFloat(rows['average speed'] || '0'),
    maxSpeedKnots: parseFloat(rows['max speed'] || '0'),
    startLocation: rows['from'] || rows['start'] || '',
    endLocation: rows['to'] || rows['end'] || '',
  };
}
```

**Critical first step:** Dump one or two actual Nebo emails to a file and inspect the HTML structure before writing the parser. The table structure and field labels are what you need to map. Spend 30 minutes on this inspection before writing any regex or cheerio selectors.

### Correlating Emails to GPS Dates

Nebo emails arrive the same day or next morning. Match by:
1. Parse `parsed.date` (email send date)
2. Check `parsed.subject` for a date string (regex: `/(\w+ \d+,? \d{4})/` or similar)
3. Fall back to the GPS track date that's closest to the email date

---

## 6. Build-Time Data Processing in Astro

### Correct Architecture: Pre-Build Scripts, Not Build Integration

**Do not** run GPX/EXIF processing as part of `astro build`. These are expensive one-time operations. The correct pattern is:

```
data/                    ← raw inputs (GPX files, photos, emails)
scripts/
  process-gpx.mjs       ← generates src/content/voyages/*.json
  process-photos.mjs    ← generates src/content/photos/*.json
  process-emails.mjs    ← generates src/content/summaries/*.json
  generate-posts.mjs    ← generates src/content/blog/*.mdx stubs
src/content/            ← Astro content collections (committed to git)
  voyages/              ← generated JSON, one per day
  blog/                 ← MDX posts (mix of human-written and generated)
```

Run the scripts manually when new data arrives:
```bash
node scripts/process-gpx.mjs
node scripts/process-photos.mjs
node scripts/generate-posts.mjs
```

Then commit the generated content files. Astro's build just reads them — it never touches the raw data.

### Why Not Astro Integrations or Vite Plugins?

- Photo EXIF scanning takes minutes for hundreds of photos
- GPS processing only needs to re-run when new tracks arrive
- Generated MDX posts need human review before publishing
- The content collection format is already optimized for Astro's content layer

### Astro Content Collections Schema

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const voyages = defineCollection({
  type: 'data', // JSON/YAML, not MDX
  schema: z.object({
    date: z.string(),          // "2023-07-15"
    distanceNm: z.number(),
    durationHours: z.number(),
    startLat: z.number(),
    startLon: z.number(),
    endLat: z.number(),
    endLon: z.number(),
    anchorages: z.array(z.object({
      lat: z.number(),
      lon: z.number(),
      name: z.string(),
    })),
    trackGeoJson: z.string(), // path to .geojson file in public/
  }),
});

const blog = defineCollection({
  type: 'content', // MDX
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    voyageDate: z.string().optional(),
    tags: z.array(z.string()),
    generated: z.boolean().default(false), // flag AI-generated posts
    photos: z.array(z.string()).optional(), // relative paths
  }),
});

export const collections = { voyages, blog };
```

### Accessing Voyage Data in Blog Posts

```astro
---
// src/pages/blog/[slug].astro
import { getCollection, getEntry } from 'astro:content';
const { entry } = Astro.props;

// Cross-reference voyage data for this post's date
const voyageDate = entry.data.voyageDate;
const voyage = voyageDate
  ? await getEntry('voyages', voyageDate)
  : null;
---
```

### Astro 5.x Content Layer API (if using Astro 5+)

Astro 5 introduced a new Content Layer API with loaders. You could write a loader that reads your processed JSON directory:

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  // The loader API lets you define external data sources
  // but for file-based JSON this doesn't buy you much over
  // the standard data collection approach above.
  // Stick with data collections unless you need live API fetching.
});
```

**Recommendation:** Use Astro 4.x content collections (type: 'data') for the generated JSON files. The Content Layer API in Astro 5 is more useful for live API sources, not file-based pipelines.

---

## 7. Nebo Gold App — Export Format Details

**Confidence: MEDIUM** — Based on Nebo app documentation and user reports through mid-2025. Verify against your actual export files.

### What Nebo Gold Exports

Nebo Gold (the paid tier of the Nebo navigation app for iOS) supports:
- **GPX export** of voyage tracks from the "Logbook" section
- **CSV export** of voyage logs (speed, heading, position over time)
- **Voyage summary emails** sent automatically at end of each voyage

### GPX Export Structure

Nebo GPX exports follow standard GPX 1.1 schema:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Nebo" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Voyage Name</name>
    <time>2023-07-15T12:00:00Z</time>
  </metadata>

  <trk>
    <name>July 15 - Chicago to Joliet</name>
    <desc>Optional voyage notes</desc>
    <trkseg>
      <trkpt lat="41.8781" lon="-87.6298">
        <ele>0.0</ele>
        <time>2023-07-15T12:03:22Z</time>
      </trkpt>
      <!-- ... more trackpoints ... -->
    </trkseg>
  </trk>

  <!-- Waypoints (anchorages, marinas) saved during voyage -->
  <wpt lat="41.5001" lon="-88.0843">
    <name>Joliet Brandon Road Lock</name>
    <time>2023-07-15T16:42:00Z</time>
    <desc>Lock wait: 45 min</desc>
  </wpt>
</gpx>
```

**Key fields confirmed:**
- Trackpoints have UTC timestamps (Nebo syncs to GPS time)
- Elevation is always 0.0 on water
- One `<trk>` per voyage session (Nebo starts a new track when you "start voyage")
- Waypoints are separate from track segments

### CSV Export Columns (approximate)

```
Timestamp(UTC), Latitude, Longitude, Speed(kn), Heading(deg), Distance(nm)
2023-07-15T12:03:22Z, 41.8781, -87.6298, 0.0, 0, 0.00
2023-07-15T12:04:22Z, 41.8775, -87.6305, 6.2, 187, 0.04
```

**Important:** The CSV may use local time not UTC depending on Nebo version. Verify by comparing a known GPS fix timestamp against the GPX timestamp for the same point.

### Voyage Summary Email Fields

Nebo sends these emails to the logged-in account email. Fields typically include:
- Voyage name (usually "Voyage MM/DD/YYYY" or user-named)
- Date and time (local)
- Distance (nautical miles)
- Duration (hours:minutes)
- Average speed (knots)
- Max speed (knots)
- Start location (Nebo's best reverse geocode)
- End location
- Sometimes: anchor alarm activations, fuel log entries

**What Nebo does NOT provide:**
- Water depth log (that's a chartplotter/NMEA function)
- Engine hours (that's from the engine's NMEA output)
- Tide information

---

## 8. Auto-Generating Blog Post Stubs

### The Generation Strategy

For the ~20% of missing days, the goal is generating structured stubs that a human reviews and enriches — not fully automated publishing.

```javascript
// scripts/generate-posts.mjs
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

function generatePostStub(voyage, emailSummary, photos) {
  const date = voyage.date;
  const slug = date; // "2023-07-15"

  // Don't overwrite existing human-written posts
  const outputPath = `src/content/blog/${slug}.mdx`;
  if (existsSync(outputPath)) {
    console.log(`Skipping ${slug} — post already exists`);
    return;
  }

  const photoList = photos
    .filter(p => p.voyageDate === date)
    .map(p => p.filePath)
    .join('\n  - ');

  const content = `---
title: "${emailSummary?.endLocation || formatDate(date)}"
date: ${date}
voyageDate: "${date}"
generated: true
tags:
  - great-loop
  - ${voyage.state || 'passage'}
photos:
  - ${photoList}
---

<!-- AUTO-GENERATED from GPS + Nebo data. Review and enrich before publishing. -->

## The Day's Run

We covered **${voyage.distanceNm.toFixed(1)} nautical miles** in ${formatDuration(voyage.durationHours)},
departing from ${emailSummary?.startLocation || 'our previous anchorage'} and
arriving at ${emailSummary?.endLocation || formatCoord(voyage.endLat, voyage.endLon)}.

<!-- TODO: Add narrative about the day's conditions, highlights, challenges -->

## By the Numbers

| | |
|---|---|
| Distance | ${voyage.distanceNm.toFixed(1)} nm |
| Underway | ${formatDuration(voyage.durationHours)} |
| Avg Speed | ${emailSummary?.avgSpeedKnots?.toFixed(1) || 'n/a'} kts |
| Max Speed | ${emailSummary?.maxSpeedKnots?.toFixed(1) || 'n/a'} kts |

<!-- TODO: Add photos section, route map embed, and personal notes -->
`;

  writeFileSync(outputPath, content, 'utf-8');
  console.log(`Generated stub: ${outputPath}`);
}
```

### The 80% Enrichment Strategy (Existing Posts)

For existing posts that need consistent quality improvement, write a separate enrichment script:

```javascript
// scripts/enrich-posts.mjs
// For each existing post:
// 1. Read frontmatter
// 2. Find matching voyage data
// 3. Add missing fields (voyageDate, distanceNm, photos array)
// 4. Write back with updated frontmatter
// 5. Do NOT touch the MDX body content

import matter from 'gray-matter'; // parse frontmatter

const raw = readFileSync(postPath, 'utf-8');
const { data, content } = matter(raw);

const enriched = {
  ...data,
  voyageDate: data.voyageDate || inferVoyageDate(data.date),
  // add fields, never remove existing ones
};

writeFileSync(postPath, matter.stringify(content, enriched), 'utf-8');
```

---

## 9. Haversine Distance Calculation

You'll need this everywhere. Write it once:

```javascript
const R_NM = 3440.065; // Earth radius in nautical miles

export function haversineNm([lon1, lat1], [lon2, lat2]) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R_NM * 2 * Math.asin(Math.sqrt(a));
}
```

---

## 10. Recommended Pipeline Architecture

```
Raw Data Sources
    ├── GPX files (Nebo export)         → scripts/01-parse-gpx.mjs
    ├── Photos directory (HEIC/JPG)      → scripts/02-extract-exif.mjs
    └── Email archive (.mbox or .eml)    → scripts/03-parse-emails.mjs
                                                      ↓
                                         scripts/04-correlate.mjs
                                         (join by date, match photos to tracks)
                                                      ↓
                                         .planning/data/
                                         ├── voyages.json     (one record per day)
                                         ├── photos.json      (one record per photo)
                                         └── summaries.json   (one record per email)
                                                      ↓
                                         scripts/05-generate-content.mjs
                                                      ↓
                                         src/content/
                                         ├── voyages/         (JSON data collection)
                                         │   └── 2023-07-15.json
                                         └── blog/            (MDX posts)
                                             └── 2023-07-15.mdx  (stub or existing)
```

**Run order:**
```bash
node scripts/01-parse-gpx.mjs
node scripts/02-extract-exif.mjs
node scripts/03-parse-emails.mjs
node scripts/04-correlate.mjs
node scripts/05-generate-content.mjs
# Then: human review of generated stubs
# Then: astro build (reads only src/content/)
```

---

## 11. Recommended npm Packages

| Package | Purpose | Confidence |
|---------|---------|-----------|
| `@tmcw/togeojson` | GPX → GeoJSON | HIGH |
| `@xmldom/xmldom` | DOM parser for togeojson in Node | HIGH |
| `exifr` | EXIF/GPS extraction from HEIC/JPEG | HIGH |
| `mailparser` | Parse .eml / mbox email files | HIGH |
| `cheerio` | Parse Nebo email HTML bodies | HIGH |
| `gray-matter` | Read/write MDX frontmatter | HIGH |
| `luxon` | Timezone-aware date math | HIGH |
| `tz-lookup` | Lat/lon → IANA timezone | MEDIUM |
| `glob` | File discovery across photo directories | HIGH |
| `csv-parse` | Parse Nebo CSV exports if needed | HIGH |

**Do not need:**
- `sharp` for this pipeline (use for image resizing in the build, not data extraction)
- `exif-reader` (exifr supersedes it)
- Any AI/LLM library for auto-generation (template-based generation from structured data is sufficient and more reliable)

---

## 12. Critical Pitfalls

### Pitfall 1: EXIF Local Time Without Timezone
**What:** `DateTimeOriginal` in EXIF has no UTC offset. On a Great Loop trip crossing EDT→CDT→CST, naively comparing photo timestamps to UTC GPS timestamps produces ~1 hour position errors.
**Prevention:** Always resolve timezone from GPS coordinates before comparing timestamps. Use `tz-lookup` + `luxon`.

### Pitfall 2: Nebo Exports One GPX Per Voyage Session, Not Per Calendar Day
**What:** If the crew stopped, started the engine, then stopped again on the same day, Nebo may create 2+ GPX tracks. Joining these into a "day" requires grouping by calendar date, not by track count.
**Prevention:** When building the voyage record, group all tracks whose first timestamp falls on the same calendar date (in local time at that location).

### Pitfall 3: Assuming GPS Data Is Continuous
**What:** Nebo records GPS tracks only while the voyage is "active" in the app. Anchor time, marina stays, overnight stops produce gaps. Don't assume linear interpolation works across gaps of >30 minutes.
**Prevention:** When matching photos to tracks, check time delta and reject matches where delta exceeds threshold (5–10 minutes while underway; longer window for photos taken at anchor if the track captured the anchor point).

### Pitfall 4: Photo Timestamps During Camera Time Sync Events
**What:** If the phone was turned off and back on, or crossed a timezone border and iOS auto-adjusted, there can be timestamp discontinuities in a photo library.
**Prevention:** Spot-check photo timestamps against known events (a photo of a lock placard, a marina sign) to validate the timestamp-location correlation is working correctly before running bulk processing.

### Pitfall 5: mbox Parsing With Large Archives
**What:** Loading an entire mbox file into memory with `fs.readFileSync` fails for multi-GB archives.
**Prevention:** Use a streaming mbox splitter. The `mailsplit` npm package streams individual messages without loading the whole file.

### Pitfall 6: Running Expensive Scripts on Every Astro Build
**What:** If you wire EXIF/GPX processing into Astro's build via a Vite plugin or integration, cold builds of a CI system take 10+ minutes and fail on machines without exiftool installed.
**Prevention:** Keep data processing as standalone scripts outside the Astro build. Commit generated content to the repo. Astro only reads the generated files.

### Pitfall 7: Nebo Email Archive May Be HTML-Only (No Plain Text)
**What:** Many modern email clients send HTML-only emails. `mailparser`'s `.text` property will be null.
**Prevention:** Always parse `.html` first. Use `cheerio` on `.html` — don't rely on `.text`.

---

## 13. Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| GPX parsing libraries | HIGH | Stable ecosystem, @tmcw/togeojson well-established |
| EXIF extraction (exifr) | HIGH | exifr is the clear standard for Node.js HEIC/JPEG |
| Timestamp correlation | HIGH | Well-understood problem, tz-lookup approach is standard |
| Email parsing (mailparser) | HIGH | mailparser is stable, widely used |
| Astro content collections | HIGH | Verified against Astro 4.x docs in training |
| Nebo GPX format specifics | MEDIUM | Based on community reports and docs; verify against your actual export |
| Nebo email body structure | LOW | Must inspect actual emails before writing parser |
| Nebo CSV format | MEDIUM | Standard GPS CSV, but column names need verification |

---

## Sources

All findings based on training knowledge (cutoff August 2025). External tool access (WebSearch, WebFetch, Bash) was unavailable during this research session. The following are the authoritative sources to verify before implementation:

- `@tmcw/togeojson`: https://github.com/tmcw/togeojson
- `exifr`: https://github.com/MikeKovarik/exifr
- `mailparser`: https://nodemailer.com/extras/mailparser/
- Nebo Gold documentation: https://neboat.com/help/ (verify GPX export format)
- Astro Content Collections: https://docs.astro.build/en/guides/content-collections/
- `tz-lookup`: https://github.com/photostructure/tz-lookup
- `gray-matter`: https://github.com/jonschlinkert/gray-matter
- GPX 1.1 schema: https://www.topografix.com/GPX/1/1/gpx.xsd
