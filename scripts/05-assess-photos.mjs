#!/usr/bin/env node
/**
 * scripts/05-assess-photos.mjs
 *
 * AI photo screening — uses Claude to classify each thumbnail:
 *   - exclude irrelevant photos (screenshots, text, diagrams, blurry, dark)
 *   - score photos for cover selection (0–10)
 *   - categorize content (scenery, people, marina, etc.)
 *
 * Usage:
 *   node scripts/05-assess-photos.mjs              # assess all unassessed photos
 *   node scripts/05-assess-photos.mjs --apply       # also write to photo-selections.json
 *   node scripts/05-assess-photos.mjs --limit 50    # assess only 50 photos (test run)
 *   node scripts/05-assess-photos.mjs --date 2022-04-01   # single day
 *
 * Output: .planning/data/photo-assessments.json
 *
 * Model: claude-haiku-4-5 (fast, cheap for batch vision classification)
 * Cost estimate: ~$0.002 per photo → ~$19 for all 9,489 photos
 *
 * Prereq: node scripts/03-correlate.mjs
 */

import Anthropic         from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join }          from 'node:path';
import { homedir }       from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname }       from 'node:path';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = join(__dirname, '..', '.planning', 'data');
const PHOTOS_LIB = join(homedir(), 'Pictures', 'Photos Library.photoslibrary');

const ENRICHED_PATH    = join(DATA_DIR, 'voyage-timeline-enriched.json');
const ASSESSMENTS_PATH = join(DATA_DIR, 'photo-assessments.json');
const SELECTIONS_PATH  = join(DATA_DIR, 'photo-selections.json');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const APPLY    = args.includes('--apply');
const limitIdx = args.indexOf('--limit');
const LIMIT    = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;
const dateIdx  = args.indexOf('--date');
const ONLY_DATE = dateIdx !== -1 ? args[dateIdx + 1] : null;

// ── Load data ─────────────────────────────────────────────────────────────────
const enriched    = JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'));
const assessments = existsSync(ASSESSMENTS_PATH)
  ? JSON.parse(readFileSync(ASSESSMENTS_PATH, 'utf8'))
  : {};

// ── Build work queue ──────────────────────────────────────────────────────────
const queue = [];
for (const day of enriched.days) {
  if (ONLY_DATE && day.date !== ONLY_DATE) continue;
  if (!day.photos) continue;
  for (const photo of day.photos) {
    if (photo.kind === 1) continue;          // skip videos
    if (assessments[photo.uuid]) continue;   // already assessed
    const thumbPath = join(
      PHOTOS_LIB,
      'resources', 'derivatives',
      photo.uuid[0].toLowerCase(),
      `${photo.uuid}_1_105_c.jpeg`
    );
    if (!existsSync(thumbPath)) continue;    // thumbnail not cached locally
    queue.push({ date: day.date, uuid: photo.uuid, thumbPath });
    if (queue.length >= LIMIT) break;
  }
  if (queue.length >= LIMIT) break;
}

console.log(`Photos to assess: ${queue.length}`);
console.log(`Already assessed: ${Object.keys(assessments).length}`);
if (queue.length === 0) { console.log('Nothing to do.'); process.exit(0); }

// ── Claude client ─────────────────────────────────────────────────────────────
const client = new Anthropic();
const MODEL  = 'claude-haiku-4-5';

const SYSTEM = `You are a photo curator for a travel blog about a boat voyage around the Great Loop (a 6,000+ nautical mile inland waterway loop through the eastern USA and Canada).

Your job: assess each photo thumbnail and return a JSON object. Be concise and accurate.`;

const USER_PROMPT = `Assess this photo for a travel blog. Return ONLY valid JSON with these fields:

{
  "include": true/false,           // false = definitely exclude from blog
  "exclude_reason": null | "screenshot" | "text_heavy" | "diagram" | "blurry" | "too_dark" | "unrelated" | "duplicate_angle" | "people_only_no_context" | "low_quality",
  "cover_score": 0-10,             // 10=stunning hero shot, 0=unusable; for cover photo selection
  "category": "scenery" | "water_view" | "sunset_sunrise" | "marina" | "lock_dam" | "city_town" | "wildlife" | "people" | "boat_interior" | "boat_exterior" | "food_drink" | "map_sign" | "screenshot" | "other",
  "description": "1 sentence"      // brief content description
}

Exclude (include:false) if: screenshot, phone/app UI, pure text, technical diagram, severely blurry, very dark, completely unrelated to a boat voyage.

Cover score guidelines:
- 9-10: Dramatic scenery, beautiful water, compelling composition, great light
- 7-8: Nice scenery or interesting moment, good quality
- 5-6: Decent photo, acceptable for post
- 3-4: Generic or unremarkable
- 1-2: Poor quality but usable
- 0: Should be excluded`;

// ── Process photos ────────────────────────────────────────────────────────────
const CONCURRENCY = 5;
let processed = 0;
let excluded  = 0;
let errors    = 0;

function saveProgress() {
  writeFileSync(ASSESSMENTS_PATH, JSON.stringify(assessments, null, 2));
}

async function assessPhoto(item) {
  const imgData = readFileSync(item.thumbPath).toString('base64');
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        {
          type:   'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: imgData },
        },
        { type: 'text', text: USER_PROMPT },
      ],
    }],
  });

  const text = response.content.find(b => b.type === 'text')?.text || '';
  // Extract JSON from response (may have markdown fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${text}`);
  return JSON.parse(jsonMatch[0]);
}

// Process in batches of CONCURRENCY
for (let i = 0; i < queue.length; i += CONCURRENCY) {
  const batch = queue.slice(i, i + CONCURRENCY);

  await Promise.allSettled(
    batch.map(async (item) => {
      try {
        const result = await assessPhoto(item);
        assessments[item.uuid] = { date: item.date, ...result };
        processed++;
        if (!result.include) excluded++;

        const pct = ((processed / queue.length) * 100).toFixed(1);
        const excl = result.include ? '' : ` [EXCLUDE: ${result.exclude_reason}]`;
        const desc = result.description?.slice(0, 60) || '';
        console.log(`[${processed}/${queue.length} ${pct}%] ${item.date} ${item.uuid.slice(0,8)}… score=${result.cover_score} ${desc}${excl}`);
      } catch (err) {
        errors++;
        console.error(`  ERROR ${item.uuid.slice(0,8)}: ${err.message}`);
        assessments[item.uuid] = { date: item.date, error: err.message };
      }
    })
  );

  // Save progress every batch
  saveProgress();

  // Brief rate-limit pause between batches
  if (i + CONCURRENCY < queue.length) {
    await new Promise(r => setTimeout(r, 200));
  }
}

saveProgress();

console.log(`\nDone. Processed: ${processed}, Excluded: ${excluded}, Errors: ${errors}`);
console.log(`Assessments saved to: ${ASSESSMENTS_PATH}`);

// ── Optionally apply to photo-selections.json ─────────────────────────────────
if (APPLY) {
  const selections = existsSync(SELECTIONS_PATH)
    ? JSON.parse(readFileSync(SELECTIONS_PATH, 'utf8'))
    : {};

  let applied = 0;
  for (const [uuid, assessment] of Object.entries(assessments)) {
    if (assessment.error) continue;
    const date = assessment.date;
    if (!date) continue;
    if (!selections[date]) selections[date] = { photos: {}, reviewed: false };
    if (!selections[date].photos) selections[date].photos = {};

    // Only set if not already manually set
    if (selections[date].photos[uuid] !== undefined) continue;

    if (!assessment.include) {
      selections[date].photos[uuid] = 'exclude';
      applied++;
    } else if (assessment.cover_score >= 8) {
      // Don't auto-set cover — too opinionated; just pre-include high scorers
      selections[date].photos[uuid] = 'include';
      applied++;
    } else if (assessment.include) {
      selections[date].photos[uuid] = 'include';
      applied++;
    }
  }

  writeFileSync(SELECTIONS_PATH, JSON.stringify(selections, null, 2));
  console.log(`\nApplied ${applied} AI suggestions to photo-selections.json`);
  console.log('(Only unset photos were updated — manual selections preserved)');
}

console.log('\nNext steps:');
console.log('  node scripts/photo-viewer.mjs   # review AI suggestions in browser');
console.log('  node scripts/05-assess-photos.mjs --apply   # write suggestions to selections');
