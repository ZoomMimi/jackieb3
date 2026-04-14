#!/usr/bin/env node
/**
 * scripts/01-build-timeline.mjs
 *
 * Reads photo-summary.json and produces voyage-timeline.json:
 * - Named geographic locations via coordinate lookup
 * - Groups consecutive stationary days into "stops"
 * - Identifies transit days
 * - Flags days that need blog posts vs. days already documented
 *
 * Usage:
 *   node scripts/01-build-timeline.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '.planning', 'data');

// ── Geographic region classifier ─────────────────────────────────────────────
// Ordered most-specific first. Returns first match.

const REGIONS = [
  // ── North Carolina home/start ──
  { name: 'New Bern NC',            lat: [34.9, 35.15],  lon: [-77.2, -76.85] },
  { name: 'Belhaven NC',            lat: [35.5, 35.6],   lon: [-76.7, -76.5]  },
  { name: 'Beaufort / Morehead City NC', lat: [34.6, 34.85], lon: [-77.05, -76.5] },
  { name: 'Oriental NC',            lat: [35.0, 35.1],   lon: [-77.1, -76.85] },
  { name: 'Myrtle Beach SC',        lat: [33.5, 34.1],   lon: [-79.1, -78.4]  },
  { name: 'Wilmington NC',          lat: [34.1, 34.5],   lon: [-78.1, -77.7]  },
  { name: 'Wrightsville Beach NC',  lat: [34.1, 34.3],   lon: [-77.9, -77.7]  },

  // ── Virginia / Chesapeake ──
  { name: 'Occoquan VA (home port)', lat: [38.65, 38.8], lon: [-77.4, -77.2]  },
  { name: 'Norfolk / Hampton Roads VA', lat: [36.8, 37.1], lon: [-76.5, -76.1] },
  { name: 'Annapolis MD',           lat: [38.9, 39.0],   lon: [-76.6, -76.4]  },
  { name: 'Baltimore MD',           lat: [39.2, 39.4],   lon: [-76.7, -76.5]  },
  { name: 'Chesapeake City MD',     lat: [39.5, 39.6],   lon: [-75.9, -75.7]  },
  { name: 'Chesapeake Bay',         lat: [36.8, 39.5],   lon: [-76.8, -75.8]  },
  { name: 'Solomon\'s Island MD',   lat: [38.3, 38.4],   lon: [-76.5, -76.4]  },
  { name: 'Gibson Island MD',       lat: [39.0, 39.1],   lon: [-76.5, -76.4]  },

  // ── Delaware / Cape May ──
  { name: 'Cape May NJ',            lat: [38.9, 39.1],   lon: [-75.1, -74.8]  },
  { name: 'Delaware Bay',           lat: [39.0, 39.6],   lon: [-75.5, -74.9]  },
  { name: 'Chesapeake City / C&D Canal', lat: [39.4, 39.6], lon: [-76.0, -75.5] },

  // ── New York / Hudson ──
  { name: 'New York Harbor',        lat: [40.5, 40.75],  lon: [-74.3, -73.9]  },
  { name: 'Hudson River / Poughkeepsie', lat: [41.5, 42.0], lon: [-74.1, -73.8] },
  { name: 'Hudson Highlands / West Point', lat: [41.3, 41.5], lon: [-74.0, -73.9] },
  { name: 'Troy / Waterford NY',    lat: [42.7, 42.8],   lon: [-73.8, -73.6]  },

  // ── Erie Canal ──
  { name: 'Erie Canal (Amsterdam NY)', lat: [42.9, 43.0], lon: [-74.3, -74.1] },
  { name: 'Erie Canal (Canajoharie NY)', lat: [42.8, 42.9], lon: [-74.7, -74.5] },
  { name: 'Oswego / Lake Ontario',  lat: [43.3, 43.6],   lon: [-76.6, -76.4]  },

  // ── Trent-Severn / Ontario ──
  { name: 'Trent-Severn Waterway',  lat: [44.0, 45.3],   lon: [-79.5, -77.5]  },
  { name: 'Bobcaygeon ON',          lat: [44.5, 44.6],   lon: [-78.6, -78.4]  },
  { name: 'Orillia ON',             lat: [44.5, 44.7],   lon: [-79.5, -79.3]  },
  { name: 'Midland / Georgian Bay', lat: [44.7, 44.9],   lon: [-79.9, -79.6]  },

  // ── North Channel / Georgian Bay ──
  { name: 'North Channel ON',       lat: [45.7, 46.4],   lon: [-83.5, -81.0]  },
  { name: 'Killarney ON',           lat: [45.9, 46.2],   lon: [-81.7, -81.4]  },
  { name: 'Gore Bay / Manitoulin',  lat: [45.8, 46.0],   lon: [-82.5, -82.1]  },

  // ── Michigan ──
  { name: 'Mackinac Island MI',     lat: [45.8, 46.0],   lon: [-84.7, -84.5]  },
  { name: 'Charlevoix MI',          lat: [45.3, 45.4],   lon: [-85.3, -85.1]  },
  { name: 'Frankfort MI',           lat: [44.6, 44.7],   lon: [-86.3, -86.1]  },
  { name: 'Holland MI',             lat: [42.7, 42.95],  lon: [-86.3, -86.0]  },
  { name: 'Grand Haven MI',         lat: [43.0, 43.1],   lon: [-86.3, -86.1]  },
  { name: 'Pentwater MI',           lat: [43.7, 43.85],  lon: [-86.5, -86.3]  },
  { name: 'Ludington MI',           lat: [43.9, 44.1],   lon: [-86.6, -86.4]  },
  { name: 'Beaver Island MI',       lat: [45.6, 45.9],   lon: [-85.7, -85.4]  },
  { name: 'Petoskey MI',            lat: [45.3, 45.5],   lon: [-85.0, -84.8]  },
  { name: 'Lake Michigan',          lat: [41.6, 46.1],   lon: [-87.6, -84.7]  },

  // ── Chicago / Illinois River ──
  { name: 'Chicago / Calumet IL',   lat: [41.6, 42.1],   lon: [-88.5, -87.4]  },
  { name: 'Joliet IL',              lat: [41.5, 41.6],   lon: [-88.2, -88.0]  },
  { name: 'Starved Rock / Illinois River', lat: [41.2, 41.6], lon: [-89.5, -88.3] },
  { name: 'Quad Cities / Rock Island', lat: [41.4, 41.7], lon: [-90.7, -90.4]  },

  // ── Mississippi River ──
  { name: 'Mississippi River (Upper)', lat: [37.5, 42.0], lon: [-91.5, -89.0] },
  { name: 'St. Louis MO',           lat: [38.5, 38.8],   lon: [-90.4, -90.1]  },
  { name: 'Paducah KY',             lat: [37.0, 37.2],   lon: [-89.0, -88.5]  },
  { name: 'Green Turtle Bay KY',    lat: [36.8, 37.0],   lon: [-88.3, -88.0]  },
  { name: 'Kentucky Lake / Pickwick', lat: [35.0, 36.8], lon: [-88.5, -87.5]  },

  // ── Tenn-Tom / Alabama ──
  { name: 'Tenn-Tom Waterway',      lat: [32.5, 35.5],   lon: [-89.0, -87.5]  },
  { name: 'Demopolis AL',           lat: [32.4, 32.7],   lon: [-88.2, -87.8]  },
  { name: 'Mobile AL',              lat: [30.5, 31.0],   lon: [-88.3, -87.9]  },

  // ── Gulf Coast ──
  { name: 'Gulf Shores / Orange Beach AL', lat: [30.2, 30.4], lon: [-87.9, -87.5] },
  { name: 'Pensacola FL',           lat: [30.1, 30.5],   lon: [-87.5, -87.1]  },
  { name: 'Destin FL',              lat: [30.3, 30.5],   lon: [-86.5, -86.1]  },
  { name: 'Panama City FL',         lat: [30.1, 30.3],   lon: [-86.0, -85.5]  },
  { name: 'Apalachicola FL',        lat: [29.6, 29.8],   lon: [-85.1, -84.9]  },

  // ── Florida Gulf Coast (ICW) ──
  { name: 'Steinhatchee FL',        lat: [29.6, 29.8],   lon: [-83.5, -83.3]  },
  { name: 'Cedar Key FL',           lat: [29.1, 29.2],   lon: [-83.1, -82.9]  },
  { name: 'Crystal River FL',       lat: [28.8, 29.0],   lon: [-82.7, -82.5]  },
  { name: 'Clearwater / St Pete FL', lat: [27.8, 28.0],  lon: [-82.9, -82.6]  },
  { name: 'Sarasota FL',            lat: [27.2, 27.5],   lon: [-82.7, -82.4]  },
  { name: 'Bradenton Beach FL',     lat: [27.4, 27.6],   lon: [-82.8, -82.5]  },
  { name: 'Fort Myers / Cape Coral FL', lat: [26.4, 26.8], lon: [-82.1, -81.8] },
  { name: 'Marco Island FL',        lat: [25.9, 26.1],   lon: [-81.8, -81.6]  },
  { name: 'Everglades / Shark River FL', lat: [25.3, 25.7], lon: [-81.2, -80.9] },

  // ── Florida Keys ──
  { name: 'Marathon Key FL',        lat: [24.6, 24.8],   lon: [-81.2, -80.9]  },
  { name: 'Key West FL',            lat: [24.5, 24.6],   lon: [-81.9, -81.7]  },
  { name: 'Boca Chica FL',          lat: [24.5, 24.6],   lon: [-81.8, -81.5]  },
  { name: 'Florida Keys',           lat: [24.4, 25.3],   lon: [-82.1, -80.2]  },

  // ── Florida East Coast (ICW) ──
  { name: 'Homestead / Biscayne Bay FL', lat: [25.0, 25.5], lon: [-80.6, -80.3] },
  { name: 'Miami FL',               lat: [25.5, 25.9],   lon: [-80.4, -80.1]  },
  { name: 'Fort Lauderdale FL',     lat: [26.0, 26.4],   lon: [-80.2, -80.0]  },
  { name: 'West Palm Beach FL',     lat: [26.6, 27.0],   lon: [-80.2, -80.0]  },
  { name: 'Sebastian / Vero Beach FL', lat: [27.5, 27.9], lon: [-80.5, -80.3] },
  { name: 'Cape Canaveral / Titusville FL', lat: [28.4, 28.7], lon: [-80.9, -80.6] },
  { name: 'Daytona Beach FL',       lat: [29.0, 29.3],   lon: [-81.2, -80.9]  },
  { name: 'St. Augustine FL',       lat: [29.7, 29.95],  lon: [-81.4, -81.2]  },
  { name: 'Jacksonville FL',        lat: [30.2, 30.5],   lon: [-81.8, -81.3]  },

  // ── Georgia ──
  { name: 'Brunswick GA',           lat: [31.0, 31.3],   lon: [-81.7, -81.4]  },
  { name: 'Savannah GA',            lat: [31.9, 32.1],   lon: [-81.2, -80.9]  },
  { name: 'Tybee Island GA',        lat: [31.9, 32.0],   lon: [-80.9, -80.8]  },

  // ── South Carolina ──
  { name: 'Beaufort SC',            lat: [32.3, 32.6],   lon: [-80.8, -80.5]  },
  { name: 'Hilton Head SC',         lat: [32.1, 32.3],   lon: [-80.9, -80.6]  },
  { name: 'Charleston SC',          lat: [32.7, 32.9],   lon: [-80.1, -79.8]  },

  // ── Colorado / off-boat ──
  { name: 'Colorado (off-boat)',    lat: [39.0, 41.5],   lon: [-106.0, -104.0] },
  { name: 'Fort Worth TX (off-boat)', lat: [32.5, 33.1], lon: [-97.5, -96.8]  },
  { name: 'West Virginia (off-boat)', lat: [37.5, 38.5], lon: [-82.0, -80.5]  },
];

function classifyLocation(lat, lon) {
  if (lat === null || lon === null) return 'Unknown';
  for (const r of REGIONS) {
    if (lat >= r.lat[0] && lat <= r.lat[1] && lon >= r.lon[0] && lon <= r.lon[1]) {
      return r.name;
    }
  }
  return `${lat.toFixed(2)}°N ${Math.abs(lon).toFixed(2)}°W`;
}

function distance(lat1, lon1, lat2, lon2) {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Main ──────────────────────────────────────────────────────────────────────

const summary = JSON.parse(readFileSync(join(DATA_DIR, 'photo-summary.json'), 'utf8'));
const days = summary.days;

// Enrich each day with location name and movement flag
let prevLat = null, prevLon = null;
const enriched = days.map(d => {
  const location = classifyLocation(d.centroidLat, d.centroidLon);
  let miles = 0;
  if (prevLat !== null && d.centroidLat !== null) {
    miles = Math.round(distance(prevLat, prevLon, d.centroidLat, d.centroidLon));
  }
  if (d.centroidLat !== null) { prevLat = d.centroidLat; prevLon = d.centroidLon; }
  return { ...d, location, milesFromPrev: miles };
});

// Group into voyage segments: consecutive days at similar location
const TRANSIT_THRESHOLD = 20; // miles — if centroid moves >20 miles, it's a transit day
const segments = [];
let seg = null;

for (const day of enriched) {
  const isTransit = day.milesFromPrev > TRANSIT_THRESHOLD;
  if (!seg || isTransit || day.location !== seg.location) {
    seg = { location: day.location, startDate: day.date, endDate: day.date, days: [day], transit: isTransit };
    segments.push(seg);
  } else {
    seg.endDate = day.date;
    seg.days.push(day);
  }
}

// Annotate segments
const annotated = segments.map(s => ({
  location: s.location,
  startDate: s.startDate,
  endDate: s.endDate,
  dayCount: s.days.length,
  photoCount: s.days.reduce((n, d) => n + d.photoCount, 0),
  transit: s.transit,
}));

// ── Output ──────────────────────────────────────────────────────────────────

const output = {
  generated: new Date().toISOString(),
  totalDays: days.length,
  totalPhotos: days.reduce((n, d) => n + d.photoCount, 0),
  days: enriched,
  segments: annotated,
};

const outPath = join(DATA_DIR, 'voyage-timeline.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote: ${outPath}`);

// ── Print human-readable route summary ───────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  JACKIE B III — Complete Voyage Route');
console.log('═══════════════════════════════════════════════════════════\n');

let prevLocation = null;
for (const s of annotated) {
  if (s.location === prevLocation) continue;
  const range = s.startDate === s.endDate ? s.startDate : `${s.startDate} → ${s.endDate}`;
  const flag  = s.location.includes('off-boat') ? ' ✈' : '';
  console.log(`  ${range.padEnd(26)}  ${s.location}${flag}  (${s.photoCount} photos)`);
  prevLocation = s.location;
}

console.log('\n');
