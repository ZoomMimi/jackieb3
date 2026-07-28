#!/usr/bin/env node
/**
 * scripts/10-upload-r2.mjs
 *
 * Phase 6 (D-01/D-02/D-03): turns each in-scope voyage day's dead file://
 * Gallery array into real, public, browser-loadable Cloudflare R2 URLs.
 *
 * For each in-scope post (the ~101 Keys->New Bern + Canada-side-trip days,
 * derived from src/data/daily-routes.json within the two in-scope date
 * ranges — see 06-CONTEXT.md), this script:
 *
 *   1. Parses the post's existing <Gallery images={[...]} /> block, which
 *      contains file:///.../originals/{dir}/{UUID}.{heic|png|jpeg|mov} paths
 *      (produced by scripts/04-generate-stubs.mjs).
 *   2. Exports exactly those UUIDs from the local Photos library via
 *      `osxphotos export --uuid-from-file` (never a date-range or
 *      whole-library export — T-06-03 mitigation), converting HEIC->JPEG at
 *      export time (macOS's native decoder; sharp cannot decode HEIC, see
 *      06-RESEARCH.md Pitfall 1).
 *   3. Resizes images to ~1600px wide / JPEG quality 80 with sharp. Videos
 *      (.mov) are uploaded byte-for-byte — no transcoding step (D-02).
 *   4. Uploads every file to Cloudflare R2 via the S3-compatible API
 *      (@aws-sdk/client-s3).
 *   5. Only after every one of a post's media files has uploaded
 *      successfully, rewrites that post's Gallery array in place with the
 *      resulting public R2 URLs and sets `r2Uploaded: true` in frontmatter.
 *      An interrupted or failed post leaves the MDX file completely
 *      untouched (06-RESEARCH.md Pitfall 4) — no mixed file://+https:// state
 *      is ever written.
 *
 * Re-running the script skips posts already marked r2Uploaded (unless
 * --force is passed), so batching the full upload across sessions
 * (plan 06-05) is safe and resumable.
 *
 * Usage:
 *   node scripts/10-upload-r2.mjs --dry-run
 *   node scripts/10-upload-r2.mjs --dry-run --date 2024-04-13
 *   node --env-file-if-exists=.env scripts/10-upload-r2.mjs --date 2024-04-13 --date 2024-04-14
 *   node --env-file-if-exists=.env scripts/10-upload-r2.mjs --limit 5
 *   node --env-file-if-exists=.env scripts/10-upload-r2.mjs --force --date 2024-04-13
 *   node --env-file-if-exists=.env scripts/10-upload-r2.mjs --allow-derivative-fallback
 *
 * Flags:
 *   --dry-run                    Parse and report only; never touches R2,
 *                                 osxphotos, or sharp; never requires
 *                                 credentials; exits 0.
 *   --date YYYY-MM-DD             Repeatable. Restrict the run to these dates.
 *   --limit N                     Process at most N posts this run.
 *   --force                       Ignore the r2Uploaded idempotency gate.
 *   --allow-derivative-fallback   If an image export is missing (failed
 *                                 iCloud download), fall back to the cached
 *                                 1022x768 derivative JPEG instead of
 *                                 failing the whole post. No effect on
 *                                 videos (no derivative exists for .mov).
 *
 * Output:
 *   src/content/blog/great-loop/*.mdx — rewritten in place (Gallery array +
 *                                        r2Uploaded flag), all-or-nothing
 *                                        per post.
 *   .planning/data/r2-upload-report.json — run report (never contains
 *                                        credential values).
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const DATA_DIR  = join(ROOT, '.planning', 'data');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');

const STAGING = join(tmpdir(), 'jackieb3-r2-staging');
const DERIVATIVES_ROOT = join(
  process.env.HOME,
  'Pictures/Photos Library.photoslibrary/resources/derivatives'
);

// The two in-scope date ranges (06-CONTEXT.md Domain section, verbatim).
const RANGES = [
  ['2024-04-13', '2024-05-17'], // Keys -> New Bern (main Loop finish)
  ['2023-06-05', '2023-08-31'], // Canada side trip (return to Great Lakes)
];

// ── CLI flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const FORCE = args.includes('--force');
const ALLOW_FALLBACK = args.includes('--allow-derivative-fallback');

const DATES = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && args[i + 1]) DATES.push(args[i + 1]);
}

const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : null;

console.log(
  `Flags: dryRun=${DRY} dates=${DATES.length ? DATES.join(',') : '(all)'} ` +
  `limit=${LIMIT ?? '(none)'} force=${FORCE} allowDerivativeFallback=${ALLOW_FALLBACK}`
);

// ── R2 credential guard (lazy — dry-run never calls this) ──────────────────
// Mirrors getClient() in scripts/07-quality-lift.mjs. Never logs credential
// values, including in error paths.

let _r2Client = null;
function getR2Client() {
  if (_r2Client) return _r2Client;
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE'];
  for (const v of required) {
    if (!process.env[v]) {
      console.error(`ERROR: ${v} environment variable is not set.`);
      console.error('  set it in .env (already gitignored) or export it, then run: npm run upload-r2');
      process.exit(1);
    }
  }
  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _r2Client;
}

// ── Frontmatter utilities (copied verbatim from scripts/04-generate-stubs.mjs) ──
// This project duplicates this trio per-script rather than sharing a module.

function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---\n', 3); // require bare ---\n line; avoids matching --- horizontal rules in body
  if (end === -1) return { frontmatter: '', body: text };
  const frontmatter = text.slice(4, end); // strip opening ---\n
  const body = text.slice(end + 4).replace(/^\n/, ''); // strip closing ---\n
  return { frontmatter, body };
}

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
      obj[key] = val.slice(1, -1).replace(/\\"/g, '"');
    }
    else obj[key] = val;
  }
  return obj;
}

function serializeFrontmatter(obj) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else if (typeof v === 'number') lines.push(`${k}: ${v}`);
    else {
      const needs = /[:#{}\[\]|>&*!'",%@`?]/.test(String(v));
      if (needs) lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
      else lines.push(`${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

// ── In-scope date derivation ─────────────────────────────────────────────────

function buildInScopeDates() {
  const routes = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'daily-routes.json'), 'utf8'));
  const dates = new Set();
  for (const date of Object.keys(routes)) {
    for (const [start, end] of RANGES) {
      if (date >= start && date <= end) { dates.add(date); break; }
    }
  }
  return dates;
}

// ── Gallery-block parsing ────────────────────────────────────────────────────
// Extracts every double-quoted entry inside <Gallery images={[ ... ]} />,
// preserving source order. Each entry is a file:///.../{UUID}.{ext} path.

function extractGalleryEntries(body) {
  const match = body.match(/<Gallery\s+images=\{\[\s*([\s\S]*?)\]\}\s*\/>/);
  if (!match) return null;
  const entries = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return { fullMatch: match[0], entries };
}

// ── Per-run flow ─────────────────────────────────────────────────────────────

async function main() {
  const inScopeDates = buildInScopeDates();

  let files = readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.mdx') && inScopeDates.has(f.slice(0, 10)));
  files.sort((a, b) => a.slice(0, 10).localeCompare(b.slice(0, 10)));

  if (DATES.length) files = files.filter((f) => DATES.includes(f.slice(0, 10)));
  if (LIMIT !== null) files = files.slice(0, LIMIT);

  // Fail fast on missing credentials BEFORE any osxphotos/sharp/R2 work —
  // but only when there is real work to do (dry-run and empty runs never
  // need credentials at all).
  if (!DRY && files.length > 0) {
    getR2Client();
  }

  const startTime = Date.now();
  const processed = [];
  const skipped = [];
  const failed = [];
  const derivativeFallbacks = [];
  let filesUploaded = 0;
  let bytesUploaded = 0;
  let totalImages = 0;
  let totalVideos = 0;

  for (const file of files) {
    const date = file.slice(0, 10);
    const slug = file.slice(0, -('.mdx'.length));
    const filePath = join(POSTS_DIR, file);
    const raw = readFileSync(filePath, 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw);
    const fm = parseFrontmatter(frontmatter);

    if (fm.r2Uploaded === true && !FORCE) {
      console.log(`SKIP  ${slug} (already uploaded)`);
      skipped.push(slug);
      continue;
    }

    const gallery = extractGalleryEntries(body);
    if (!gallery || gallery.entries.length === 0) {
      console.log(`SKIP  ${slug} (no Gallery entries)`);
      skipped.push(slug);
      continue;
    }

    const items = gallery.entries.map((entry) => ({
      entry,
      uuid: basename(entry, extname(entry)),
      isVideo: extname(entry).toLowerCase() === '.mov',
    }));
    const imageCount = items.filter((i) => !i.isVideo).length;
    const videoCount = items.filter((i) => i.isVideo).length;
    totalImages += imageCount;
    totalVideos += videoCount;

    if (DRY) {
      console.log(`WOULD UPLOAD ${slug} (${imageCount} images, ${videoCount} videos)`);
      continue;
    }

    const dayStaging = join(STAGING, date);
    try {
      mkdirSync(dayStaging, { recursive: true });
      const uuidsFile = join(dayStaging, 'uuids.txt');
      writeFileSync(uuidsFile, items.map((i) => i.uuid).join('\n') + '\n', 'utf8');

      // Array-args form only — no shell interpolation, no injection risk
      // even though UUIDs originate from this project's own generated data.
      execFileSync('osxphotos', [
        'export', dayStaging,
        '--uuid-from-file', uuidsFile,
        '--convert-to-jpeg',
        '--jpeg-quality', '1.0',
        '--jpeg-ext', 'jpg',
        '--filename', '{uuid}',
        '--skip-live',
        '--download-missing',
        '--use-photokit',
        '--retry', '2',
        '--report', join(dayStaging, 'export.csv'),
      ], {
        timeout: 30 * 60 * 1000, // iCloud downloads are slow — generous timeout
        maxBuffer: 32 * 1024 * 1024,
        stdio: 'pipe',
      });

      const resizedDir = join(dayStaging, 'resized');
      mkdirSync(resizedDir, { recursive: true });

      const uploadedUrls = [];
      const postFallbacks = [];
      const publicBase = process.env.R2_PUBLIC_BASE.replace(/\/$/, '');

      for (const item of items) {
        const ext = item.isVideo ? 'mov' : 'jpg';
        const expectedPath = join(dayStaging, `${item.uuid}.${ext}`);
        let sourcePath = expectedPath;

        if (!existsSync(expectedPath)) {
          if (!item.isVideo && ALLOW_FALLBACK) {
            const derivative = join(DERIVATIVES_ROOT, item.uuid[0], `${item.uuid}_1_105_c.jpeg`);
            if (existsSync(derivative)) {
              sourcePath = derivative;
              postFallbacks.push(item.uuid);
            } else {
              throw new Error(`missing export and no cached derivative for ${item.uuid}`);
            }
          } else {
            const hint = item.isVideo
              ? '(videos have no derivative fallback)'
              : '(pass --allow-derivative-fallback to use the cached 1022x768 derivative)';
            throw new Error(`missing export for ${item.uuid} ${hint}`);
          }
        }

        let uploadPath = sourcePath;
        if (!item.isVideo) {
          const resizedPath = join(resizedDir, `${item.uuid}.jpg`);
          await sharp(sourcePath)
            .resize({ width: 1600, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(resizedPath);
          uploadPath = resizedPath;
        }

        const key = `great-loop/${date}/${item.uuid}.${ext}`;
        const fileBuffer = readFileSync(uploadPath);

        await getR2Client().send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: key,
          Body: fileBuffer,
          ContentType: item.isVideo ? 'video/quicktime' : 'image/jpeg',
        }));

        filesUploaded++;
        bytesUploaded += statSync(uploadPath).size;
        uploadedUrls.push(`${publicBase}/${key}`);
      }

      // All-or-nothing commit (06-RESEARCH.md Pitfall 4): only rewrite the
      // Gallery array and set r2Uploaded once every one of this post's
      // media files has uploaded successfully.
      const newInner = '\n' + uploadedUrls.map((u) => `    "${u}"`).join(',\n') + '\n  ';
      const newGalleryBlock = `<Gallery images={[${newInner}]} />`;
      const newBody = body.replace(gallery.fullMatch, newGalleryBlock);
      fm.r2Uploaded = true;
      writeFileSync(filePath, '---\n' + serializeFrontmatter(fm) + '\n---\n\n' + newBody + '\n', 'utf8');

      if (postFallbacks.length) {
        derivativeFallbacks.push(...postFallbacks.map((uuid) => ({ slug, uuid })));
      }
      processed.push({ slug, images: imageCount, videos: videoCount, derivativeFallbacks: postFallbacks.length });
      console.log(`OK    ${slug} (${imageCount} images, ${videoCount} videos uploaded)`);

      rmSync(dayStaging, { recursive: true, force: true });
    } catch (err) {
      // Leave the MDX file completely unmodified so file:// entries survive
      // for a clean retry — never a partial/mixed Gallery array.
      console.log(`FAIL  ${slug}: ${err.message}`);
      failed.push({ slug, error: err.message });
      // Staging dir intentionally left in place on failure for inspection.
    }
  }

  if (DRY) {
    console.log(`TOTAL: ${files.length} posts, ${totalImages} images, ${totalVideos} videos`);
    return;
  }

  // Rescan all in-scope posts (not just this run's subset) so batched runs
  // report true overall progress.
  const allInScopeFiles = readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.mdx') && inScopeDates.has(f.slice(0, 10)));
  let postsWithR2Uploaded = 0;
  for (const f of allInScopeFiles) {
    const raw = readFileSync(join(POSTS_DIR, f), 'utf8');
    const { frontmatter } = splitFrontmatter(raw);
    const fm = parseFrontmatter(frontmatter);
    if (fm.r2Uploaded === true) postsWithR2Uploaded++;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const report = {
    generated: new Date().toISOString(),
    durationSeconds: parseFloat(elapsed),
    summary: {
      total: files.length,
      processed: processed.length,
      skipped: skipped.length,
      failed: failed.length,
      filesUploaded,
      bytesUploaded,
      derivativeFallbackCount: derivativeFallbacks.length,
    },
    processed,
    skipped,
    failed,
    derivativeFallbacks,
    cumulative: { postsWithR2Uploaded },
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'r2-upload-report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log('');
  console.log('── R2 Upload Complete ────────────────────────────────');
  console.log(`  Processed: ${processed.length}  Skipped: ${skipped.length}  Failed: ${failed.length}`);
  console.log(`  Files uploaded: ${filesUploaded}  Bytes uploaded: ${bytesUploaded}`);
  console.log(`  Cumulative posts with r2Uploaded: ${postsWithR2Uploaded}`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
