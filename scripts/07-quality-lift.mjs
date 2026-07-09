#!/usr/bin/env node
/**
 * scripts/07-quality-lift.mjs
 *
 * Batch quality-lift script: converts all migrated Blogger HTML posts to clean
 * Markdown prose using the Claude API, injects a VoyageStats footer from Nebo
 * log data, and sets lifted: true in frontmatter.
 *
 * After the lift pass, an enrichment pass (enrichPosts) runs on all posts:
 * - Updates location/lat/lon from voyage-timeline-enriched.json (D-10, D-11)
 * - Appends Gallery placeholder for early posts (2022-04-16..2022-08-04) with
 *   correlated iCloud photos (D-12, QLFT-05)
 * - Gates on frontmatter `enriched: true` for idempotency
 *
 * Decisions honored:
 *   D-01 Batch all 72 posts in one run
 *   D-02 Standalone ESM Node.js script
 *   D-03 Idempotent: skip posts already marked lifted: true
 *   D-04 Skip-and-log on API failure; continue to next post
 *   D-05 Output clean Markdown prose; photos stay inline as ![](url)
 *   D-06 Append <VoyageStats /> with matched nebo stats; use optional props
 *   D-07 Blank alt text: ![](url)
 *   D-08 Set lifted: true (NOT migrated: "lifted")
 *   D-09 Auto-select first img URL in body as coverPhoto
 *   D-10 Update location from timeline only when a place name exists
 *   D-11 Add lat/lon from timeline centroid
 *   D-12 Append Gallery placeholder for early posts with iCloud photos
 *
 * Usage:
 *   ANTHROPIC_API_KEY=<your-key> node scripts/07-quality-lift.mjs
 *   node scripts/07-quality-lift.mjs   (enrichment only, no API key needed
 *                                        when all posts are already lifted)
 *
 * Output:
 *   src/content/blog/great-loop/*.mdx  — rewritten in-place
 *   .planning/data/quality-lift-report.json — run report
 */

import Anthropic             from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath }     from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const DATA_DIR  = join(ROOT, '.planning', 'data');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');

// ── API key guard (lazy) ──────────────────────────────────────────────────────
// Key is only required when posts actually need lifting; enrichment runs without it.

let _client = null;
function getClient() {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('  Export it before running:  export ANTHROPIC_API_KEY="<your-key>"');
    console.error('  Or prefix the command:     ANTHROPIC_API_KEY=<your-key> npm run quality-lift');
    process.exit(1);
  }
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// ── Load nebo logs ────────────────────────────────────────────────────────────

const neboRaw = JSON.parse(readFileSync(join(DATA_DIR, 'nebo-logs.json'), 'utf8'));

/** @type {Map<string, {distanceNm: number, underwayHours: number}>} */
const neboByDate = new Map();
for (const entry of neboRaw) {
  if (entry.date && entry.distanceNm !== undefined) {
    // Keep only the first entry per date (chronologically stable)
    if (!neboByDate.has(entry.date)) {
      neboByDate.set(entry.date, entry);
    }
  }
}
console.log(`Nebo logs loaded: ${neboByDate.size} dated entries`);

// ── Load voyage timeline ──────────────────────────────────────────────────────

const timelineRaw = JSON.parse(
  readFileSync(join(DATA_DIR, 'voyage-timeline-enriched.json'), 'utf8')
);

/** @type {Map<string, object>} */
const timelineByDate = new Map();
for (const day of timelineRaw.days) {
  timelineByDate.set(day.date, day);
}
console.log(`Timeline loaded: ${timelineByDate.size} dated entries`);

// ── Frontmatter parsing ───────────────────────────────────────────────────────

/**
 * Split raw MDX text into { frontmatter: string, body: string }.
 * Handles files that start with "---\n" ... "---\n".
 */
function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: '', body: text };
  const frontmatter = text.slice(4, end); // strip opening ---\n
  const body = text.slice(end + 4).replace(/^\n/, ''); // strip closing ---\n
  return { frontmatter, body };
}

/**
 * Parse YAML frontmatter string into a plain object (key-value only).
 * Handles: string, number, boolean, quoted strings.
 * Does NOT handle nested YAML — not needed for this simple schema.
 */
function parseFrontmatter(yaml) {
  const obj = {};
  for (const line of yaml.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    let val = line.slice(colon + 1).trim();
    if (val === 'true') obj[key] = true;
    else if (val === 'false') obj[key] = false;
    else if (val !== '' && !isNaN(Number(val))) obj[key] = Number(val);
    else if ((val.startsWith('"') && val.endsWith('"')) ||
             (val.startsWith("'") && val.endsWith("'"))) {
      obj[key] = val.slice(1, -1);
    }
    else obj[key] = val;
  }
  return obj;
}

/**
 * Serialize a frontmatter object back to YAML string.
 * Preserves string quoting for values that need it.
 */
function serializeFrontmatter(obj) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else if (typeof v === 'number') lines.push(`${k}: ${v}`);
    else {
      // Quote if contains colon, hash, special chars, or is a date-like value
      const needs = /[:#{}\[\]|>&*!'",%@`?]/.test(String(v));
      if (needs) lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
      else lines.push(`${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

/**
 * Extract the first <img src="..."> URL from the raw Blogger HTML body.
 * Returns null if none found.
 */
function extractFirstImgUrl(html) {
  // Match <img ... src="URL" ...> – prefer the larger /s4032/ CDN variant
  const match = html.match(/\ssrc="(https?:\/\/blogger\.googleusercontent\.com[^"]+?)"/);
  return match ? match[1] : null;
}

/**
 * Find the best-matching Nebo log entry for a given post date string (YYYY-MM-DD).
 * For multi-day posts (e.g., dated 2022-05-02 covering Days 4–9) we use the
 * frontmatter date as the anchor and fall back to ±7 days.
 */
function findNeboEntry(dateStr) {
  if (neboByDate.has(dateStr)) return neboByDate.get(dateStr);

  // Search ±7 days
  const anchor = new Date(dateStr + 'T12:00:00Z');
  let best = null;
  let bestDiff = Infinity;
  for (const [d, entry] of neboByDate) {
    const diff = Math.abs(new Date(d + 'T12:00:00Z') - anchor) / 86400000;
    if (diff < bestDiff && diff <= 7) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best; // may be null
}

/**
 * Returns true when the location string is a human-readable place name rather
 * than a raw GPS coordinate string (e.g. "35.02°N 79.11°W").
 * Coordinate strings always contain a decimal followed by a degree symbol.
 */
function isPlaceName(loc) {
  if (!loc || !loc.trim()) return false;
  return !/\d+\.\d+°[NS]/.test(loc);
}

// ── Claude prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Markdown formatter converting Blogger HTML posts to clean Markdown.

RULES — follow them precisely:
1. Preserve ALL factual content and Barbara's exact first-person voice. Do not rewrite, rephrase, summarize, or improve prose. Only change formatting.
2. Convert section headings: Blogger bold/large text that acts as a title or section break → ## Heading. Use your judgment — not every bold phrase is a heading.
3. Convert inline images to Markdown: ![](URL) — keep the full src URL, leave alt text blank. Keep photos in the same narrative position where Blogger placed them.
4. Preserve paragraph breaks. Convert <br /> clusters and &nbsp; runs to blank lines between paragraphs.
5. Strip all HTML tags: <div>, <span>, <a href=...>, <p>, <br />, class="..." attributes, style="..." attributes, data-* attributes, border="0", etc.
6. Decode HTML entities: &nbsp; → space, &amp; → &, &quot; → ", &lt; → <, &gt; → >, &#39; → '.
7. Remove empty lines that result from stripped wrappers. Keep meaningful paragraph spacing.
8. Do NOT include frontmatter, code fences, or any text outside the Markdown body.
9. Do NOT add commentary, introductions, or conclusions that Barbara did not write.
10. Output ONLY the Markdown body text. Start immediately with the first paragraph or image.`;

/**
 * Call the Claude API to convert Blogger HTML body to Markdown.
 * Returns the lifted Markdown string.
 */
async function liftPost(title, date, rawBody) {
  const msg = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Convert this Blogger HTML post body to clean Markdown. Post title: "${title}" (date: ${date}).

RAW HTML BODY:
${rawBody}`,
      },
    ],
  });

  // Extract the text response
  const block = msg.content.find(b => b.type === 'text');
  if (!block) throw new Error('No text block in Claude response');
  return block.text.trim();
}

// ── Enrichment pass (D-10, D-11, D-12, QLFT-05) ──────────────────────────────

/**
 * Enrichment pass for all posts:
 * 1. Date-matches post to voyage-timeline-enriched.json
 * 2. Updates location (if a real place name exists), lat, lon
 * 3. Appends Gallery placeholder for early posts (2022-04-16..2022-08-04) with photos
 * Gates on frontmatter `enriched: true` for idempotency — safe to re-run.
 */
function enrichPosts(mdxFiles) {
  const enrichedList  = [];
  const enrichSkipped = [];
  const enrichFailed  = [];

  // Early-post date window (Days 1–111 = Apr 16 2022 – Aug 4 2022, inclusive)
  const EARLY_START = new Date('2022-04-16T00:00:00Z');
  const EARLY_END   = new Date('2022-08-04T23:59:59Z');

  const GALLERY_IMPORT = `import Gallery from '../../../components/Gallery.astro'`;
  const VS_IMPORT      = `import VoyageStats from '../../../components/VoyageStats.astro'`;

  for (const filePath of mdxFiles) {
    const slug = basename(filePath, '.mdx');
    const raw  = readFileSync(filePath, 'utf8');
    const { frontmatter: fmStr, body } = splitFrontmatter(raw);
    const fm = parseFrontmatter(fmStr);

    // Idempotency gate: skip already-enriched posts
    if (fm.enriched === true) {
      process.stdout.write(`ENRICH-SKIP ${slug}\n`);
      enrichSkipped.push(slug);
      continue;
    }

    try {
      // Derive YYYY-MM-DD date from frontmatter or filename
      const dateStr = fm.date ? String(fm.date).slice(0, 10) : slug.slice(0, 10);
      const day = timelineByDate.get(dateStr);

      let newBody = body;

      if (day) {
        // D-10: update location when timeline gives a real place name
        if (isPlaceName(day.location)) {
          fm.location = day.location;
        }

        // D-11: GPS coordinates from photo centroid
        if (day.centroidLat !== undefined) fm.lat = day.centroidLat;
        if (day.centroidLon !== undefined) fm.lon = day.centroidLon;

        // D-12 / QLFT-05: Gallery placeholder for early posts with iCloud photos
        const postDate = new Date(dateStr + 'T12:00:00Z');
        const isEarly  = postDate >= EARLY_START && postDate <= EARLY_END;
        const photos   = Array.isArray(day.photos) ? day.photos : [];

        if (isEarly && photos.length > 0) {
          // Build local placeholder paths (capped at 20 to keep files manageable)
          const capped = photos.slice(0, 20);
          const imageList = capped.map(p =>
            `"file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/${p.directory}/${p.filename}"`
          ).join(',\n    ');

          // Inject Gallery import after VoyageStats import (or at top of body)
          if (!newBody.includes(GALLERY_IMPORT)) {
            if (newBody.includes(VS_IMPORT)) {
              newBody = newBody.replace(VS_IMPORT, `${VS_IMPORT}\n${GALLERY_IMPORT}`);
            } else {
              newBody = `${GALLERY_IMPORT}\n` + newBody;
            }
          }

          // Append Gallery call at end of body
          newBody = newBody.trimEnd() +
            `\n\n<Gallery images={[\n    ${imageList}\n  ]} />\n`;
        }
      }

      // Mark enriched for idempotency; write file
      fm.enriched = true;

      const newContent = `---\n${serializeFrontmatter(fm)}\n---\n\n${newBody}\n`;
      writeFileSync(filePath, newContent, 'utf8');

      process.stdout.write(`ENRICH ${slug}\n`);
      enrichedList.push(slug);
    } catch (err) {
      console.error(`ENRICH-FAIL ${slug}: ${err.message}`);
      enrichFailed.push({ slug, error: err.message });
    }
  }

  return { enriched: enrichedList, enrichSkipped, enrichFailed };
}

// ── Main loop ─────────────────────────────────────────────────────────────────

const mdxFiles = readdirSync(POSTS_DIR)
  .filter(f => extname(f) === '.mdx')
  .map(f => join(POSTS_DIR, f))
  .sort();

console.log(`Found ${mdxFiles.length} MDX posts in ${POSTS_DIR}`);

const processed = [];
const skipped   = [];
const failed    = [];
const startTime = Date.now();

for (const filePath of mdxFiles) {
  const slug = basename(filePath, '.mdx');
  const raw  = readFileSync(filePath, 'utf8');

  const { frontmatter: fmStr, body } = splitFrontmatter(raw);
  const fm = parseFrontmatter(fmStr);

  // Idempotency gate (D-03)
  if (fm.lifted === true) {
    console.log(`SKIP  ${slug} (already lifted)`);
    skipped.push(slug);
    continue;
  }

  try {
    const dateStr = fm.date ? String(fm.date).slice(0, 10) : slug.slice(0, 10);

    // D-09: auto-select cover photo from first img URL in raw body
    const coverPhotoUrl = extractFirstImgUrl(body);
    if (coverPhotoUrl && !fm.coverPhoto) {
      fm.coverPhoto = coverPhotoUrl;
    }

    // Call Claude API (D-05)
    process.stdout.write(`LIFT  ${slug} … `);
    const liftedBody = await liftPost(fm.title || slug, dateStr, body);

    // D-06: look up Nebo log for VoyageStats
    const neboEntry = findNeboEntry(dateStr);

    // Build VoyageStats props (only include defined values)
    const vsProps = [];
    if (neboEntry?.distanceNm !== undefined) {
      vsProps.push(`miles={${Math.round(neboEntry.distanceNm * 10) / 10}}`);
    }
    if (neboEntry?.underwayHours !== undefined) {
      vsProps.push(`hours={${Math.round(neboEntry.underwayHours * 10) / 10}}`);
    }

    // Build the full MDX body: VoyageStats import first, then lifted prose, then stats footer
    const voyageStatsImport = `import VoyageStats from '../../../components/VoyageStats.astro'`;
    const statsFooter = vsProps.length > 0
      ? `\n\n<VoyageStats ${vsProps.join(' ')} />`
      : `\n\n<VoyageStats />`;

    const newBody = `${voyageStatsImport}\n\n${liftedBody}${statsFooter}`;

    // D-08: set lifted: true, keep migrated: true
    fm.lifted = true;

    // Re-serialize
    const newContent = `---\n${serializeFrontmatter(fm)}\n---\n\n${newBody}\n`;
    writeFileSync(filePath, newContent, 'utf8');

    console.log(`done`);
    processed.push(slug);
  } catch (err) {
    // D-04: skip-and-log on failure
    console.log(`FAIL`);
    console.error(`  FAIL  ${slug}: ${err.message}`);
    failed.push({ slug, error: err.message });
  }
}

// ── Enrichment pass ───────────────────────────────────────────────────────────

console.log('');
console.log('── Enrichment Pass ───────────────────────────────────');
const enrichResult = enrichPosts(mdxFiles);
console.log(`  Enriched:      ${enrichResult.enriched.length}`);
console.log(`  Already done:  ${enrichResult.enrichSkipped.length}`);
console.log(`  Failed:        ${enrichResult.enrichFailed.length}`);

// ── Write report ──────────────────────────────────────────────────────────────

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const report = {
  generated: new Date().toISOString(),
  durationSeconds: parseFloat(elapsed),
  summary: {
    total: mdxFiles.length,
    processed: processed.length,
    skipped: skipped.length,
    failed: failed.length,
    enriched: enrichResult.enriched.length,
    enrichSkipped: enrichResult.enrichSkipped.length,
    enrichFailed: enrichResult.enrichFailed.length,
  },
  processed,
  skipped,
  failed,
  enriched: enrichResult.enriched,
  enrichSkipped: enrichResult.enrichSkipped,
  enrichFailed: enrichResult.enrichFailed,
};

writeFileSync(join(DATA_DIR, 'quality-lift-report.json'), JSON.stringify(report, null, 2), 'utf8');

// ── Final summary ─────────────────────────────────────────────────────────────

console.log('');
console.log('── Quality Lift Complete ─────────────────────────────');
console.log(`  Total posts:  ${mdxFiles.length}`);
console.log(`  Lifted:       ${processed.length}  (this run)`);
console.log(`  Skipped:      ${skipped.length}  (already lifted)`);
console.log(`  Lift failed:  ${failed.length}`);
console.log(`  Enriched:     ${enrichResult.enriched.length}  (this run)`);
console.log(`  Enrich skip:  ${enrichResult.enrichSkipped.length}  (already enriched)`);
console.log(`  Enrich fail:  ${enrichResult.enrichFailed.length}`);
console.log(`  Duration:     ${elapsed}s`);
console.log(`  Report:       .planning/data/quality-lift-report.json`);

const anyFailed = failed.length > 0 || enrichResult.enrichFailed.length > 0;

if (failed.length > 0) {
  console.log('');
  console.log('  Lift failed slugs (re-run script to retry):');
  for (const { slug, error } of failed) {
    console.log(`    - ${slug}: ${error}`);
  }
}

if (enrichResult.enrichFailed.length > 0) {
  console.log('');
  console.log('  Enrich failed slugs:');
  for (const { slug, error } of enrichResult.enrichFailed) {
    console.log(`    - ${slug}: ${error}`);
  }
}

if (anyFailed) {
  process.exit(2); // non-zero so CI can detect partial failures
}
