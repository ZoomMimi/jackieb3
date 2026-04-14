#!/usr/bin/env node
// Merges all nebo-emails-b*.json + nebo-emails-partial-b.json into nebo-email-index.json
// Deduplicates by pdfUuid, sorts by date descending.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../.planning/data');

const files = [
  'nebo-emails-b1.json',
  'nebo-emails-b2.json',
  'nebo-emails-b3.json',
  'nebo-emails-b4.json',
  'nebo-emails-b5.json',
  'nebo-emails-b6.json',
  'nebo-emails-b7.json',
  'nebo-emails-b8.json',
  'nebo-emails-partial-b.json',
];

const seen = new Set();
const all = [];

for (const file of files) {
  const entries = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
  for (const entry of entries) {
    if (!seen.has(entry.pdfUuid)) {
      seen.add(entry.pdfUuid);
      all.push(entry);
    }
  }
}

// Sort by date descending (newest first)
all.sort((a, b) => b.date.localeCompare(a.date));

const outPath = join(dataDir, 'nebo-email-index.json');
writeFileSync(outPath, JSON.stringify(all, null, 2));

console.log(`Merged ${all.length} unique Nebo voyage logs.`);
console.log(`Date range: ${all.at(-1).date} → ${all[0].date}`);
console.log(`Output: ${outPath}`);
