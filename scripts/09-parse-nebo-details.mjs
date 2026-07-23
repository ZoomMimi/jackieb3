#!/usr/bin/env node
/**
 * scripts/09-parse-nebo-details.mjs
 *
 * Parses the raw OCR text already captured in nebo-logs.json (by script 02)
 * into structured per-leg detail: route name, commenced/completed times,
 * weather on departure/arrival, ICW mile markers, named stops/landmarks,
 * in-transit weather readings, and GPS positions mentioned in the log body.
 *
 * Does NOT attempt to pair individual events with exact timestamps -- Nebo's
 * PDF table layout gets OCR'd in inconsistent orders (event descriptions and
 * their time column sometimes appear together, sometimes split across a page
 * break), so a strict line-count-based pairing would silently misalign in
 * some logs. Each field is instead extracted independently via bounded
 * regex search, which degrades gracefully (a field is just null/empty) when
 * the OCR text doesn't contain it, instead of producing wrong timestamps.
 *
 * Adds a `legs` array to each entry in nebo-logs.json (one item per detail
 * page -- raw[1], and raw[2] if present). Leaves `raw` and the existing
 * summary fields untouched.
 *
 * Usage:
 *   node scripts/09-parse-nebo-details.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS = join(__dirname, '..', '.planning', 'data', 'nebo-logs.json');

const WEATHER_RE = /(\d+\.?\d*)°([CF]),?\s*Wind\s*(\d+)kn\s*([A-Z]{1,3})/g;
const COORD_DMS_RE = /(\d+)°\s*(\d+\.?\d*)'\s*(N|S),\s*(\d+)°\s*(\d+\.?\d*)'\s*(W|E)/g;

function dedupeConsecutive(arr) {
  return arr.filter((item, i) => i === 0 || JSON.stringify(item) !== JSON.stringify(arr[i - 1]));
}

function weatherNear(text, label) {
  const idx = text.indexOf(label);
  if (idx === -1) return null;
  const window = text.slice(idx, idx + 100);
  WEATHER_RE.lastIndex = 0;
  const m = WEATHER_RE.exec(window);
  return m ? { temp: Number(m[1]), unit: m[2], windKn: Number(m[3]), windDir: m[4] } : null;
}

function parseLeg(pageText) {
  const routeMatch = pageText.match(/\nVoyage\n([\s\S]*?)\n(?:Skipper|Weather on departure|Commenced)/);
  const routeName = routeMatch ? routeMatch[1].trim().replace(/\s*\n\s*/g, ' ') : null;

  // Commenced/Completed: OCR sometimes puts both labels together then both
  // values together, sometimes label-value-label-value. Bounding the search
  // window from "Commenced" to the next "Time" label and taking the first
  // two HH:MM tokens works for both layouts.
  let commenced = null, completed = null;
  const cIdx = pageText.indexOf('Commenced');
  if (cIdx !== -1) {
    const tIdx = pageText.indexOf('Time', cIdx);
    const window = pageText.slice(cIdx, tIdx !== -1 ? tIdx : cIdx + 200);
    const times = window.match(/\d{1,2}:\d{2}/g) || [];
    [commenced = null, completed = null] = times;
  }

  const weatherDeparture = weatherNear(pageText, 'Weather on departure');
  const weatherArrival = weatherNear(pageText, 'Weather on arrival');

  // Bound the voyage-log detail block: from "Voyage Log" to "From Start"
  // (or end of page text if "From Start" wasn't OCR'd). Page-break noise
  // that sometimes falls inside this range (repeated boat name, watermark
  // fragments, a duplicate Commenced/Completed block) doesn't match any of
  // the patterns below, so it's harmlessly ignored rather than needing to
  // be stripped out explicitly.
  const vlIdx = pageText.indexOf('Voyage Log');
  const fsIdx = vlIdx !== -1 ? pageText.indexOf('From Start', vlIdx) : -1;
  const block = vlIdx === -1 ? '' : pageText.slice(vlIdx, fsIdx !== -1 ? fsIdx : undefined);

  const icwMarkers = [...block.matchAll(/Passed ICW St M\s*(\d+)/g)].map((m) => Number(m[1]));
  const landmarks = [...block.matchAll(/Passed under ([^\n]+)/g)].map((m) => m[1].trim());

  const startedMatch = block.match(/Started voyage at ([^\n]+)/);
  const departedMatch = block.match(/Departed ([^\n]+)/);
  const arrivedMatches = [...block.matchAll(/Arrived ([^\n]+)/g)].map((m) => m[1].trim());
  const stoppedMatch = block.match(/Stopped [Vv]oyage(?:\s+at\s+([^\n]+))?/);

  const weatherReadings = dedupeConsecutive(
    [...block.matchAll(WEATHER_RE)].map((m) => ({
      temp: Number(m[1]),
      unit: m[2],
      windKn: Number(m[3]),
      windDir: m[4],
    }))
  );

  const positions = dedupeConsecutive(
    [...block.matchAll(COORD_DMS_RE)].map((m) => {
      const lat = parseFloat(m[1]) + parseFloat(m[2]) / 60;
      const lon = parseFloat(m[4]) + parseFloat(m[5]) / 60;
      return [
        Math.round((m[3] === 'S' ? -lat : lat) * 1e6) / 1e6,
        Math.round((m[6] === 'W' ? -lon : lon) * 1e6) / 1e6,
      ];
    })
  );

  return {
    routeName,
    commenced,
    completed,
    weatherDeparture,
    weatherArrival,
    icwMarkers,
    landmarks,
    namedStops: {
      started: startedMatch?.[1]?.trim() ?? null,
      departed: departedMatch?.[1]?.trim() ?? null,
      arrived: arrivedMatches,
      stopped: stoppedMatch?.[1]?.trim() ?? null,
    },
    weatherReadings,
    positions,
  };
}

const logs = JSON.parse(readFileSync(LOGS, 'utf8'));

let totalLegs = 0;
let withRouteName = 0, withWeather = 0, withIcw = 0;

for (const entry of logs) {
  const legPages = entry.raw.slice(1); // raw[0] is the page-1 summary/map page
  entry.legs = legPages.map((page) => {
    const leg = parseLeg(page);
    totalLegs++;
    if (leg.routeName) withRouteName++;
    if (leg.weatherReadings.length > 0) withWeather++;
    if (leg.icwMarkers.length > 0) withIcw++;
    return leg;
  });
}

writeFileSync(LOGS, JSON.stringify(logs, null, 2));

console.log(`Parsed ${totalLegs} legs across ${logs.length} logs -> ${LOGS}`);
console.log(`  Route name found:      ${withRouteName}/${totalLegs}`);
console.log(`  Weather readings found: ${withWeather}/${totalLegs}`);
console.log(`  ICW markers found:      ${withIcw}/${totalLegs}`);
