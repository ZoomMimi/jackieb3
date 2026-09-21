#!/usr/bin/env node
/**
 * scripts/13-extract-nebo-maps.mjs
 *
 * Pulls the speed-colored route map out of page 1 of each day's cached Nebo
 * PDF report (.planning/data/nebo-pdfs/, already downloaded by
 * scripts/02-fetch-nebo-logs.mjs — nothing is re-fetched from Gmail) and
 * uploads it to R2 as that day's "original Nebo map" image.
 *
 * Why: the site's own PostMiniMap (Leaflet, built from GPS-derived
 * daily-routes.json) is inaccurate/not smooth for many days (confirmed by
 * scripts/14-audit-route-accuracy.mjs: 137 of 171 Nebo-covered days are
 * materially off). Nebo's own rendered map — speed-colored track over a real
 * basemap — is drawn from Nebo's full-resolution internal GPS log, which
 * isn't recoverable from the PDF as numbers (only OCR'able as text/labels),
 * so this image *is* the most accurate route available for these days
 * without re-exporting real GPX from the Nebo app per trip.
 *
 * Extraction: rather than rasterizing the whole PDF page and cropping (which
 * downsamples through PDFKit's renderer), this pulls the map's *embedded
 * source image* directly via PyMuPDF (`page.get_images()` /
 * `doc.extract_image()`) — Nebo embeds it at a fixed native 2480x2400,
 * verified identical across every PDF checked. That's the actual resolution
 * ceiling; there is no higher-fidelity version to get at from this file.
 * The legend (speed-color key) is NOT part of this embedded image — it's a
 * separate vector-drawn table in the PDF — so it's reproduced as a crisp
 * HTML/CSS legend in NeboMap.astro instead of being screenshotted.
 *
 * Usage:
 *   node scripts/13-extract-nebo-maps.mjs --date 2024-05-17
 *   node --env-file-if-exists=.env scripts/13-extract-nebo-maps.mjs --date 2024-05-17 --date 2024-05-09 --upload
 *   node --env-file-if-exists=.env scripts/13-extract-nebo-maps.mjs --all --upload   (every date with both a full-classified post and a Nebo log)
 *
 * Without --upload, images are written locally to .planning/data/nebo-maps/
 * for review. With --upload, each is also pushed to R2 at
 * great-loop/{date}/nebo-map.jpg and the public URL is printed.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, '.planning', 'data');
const PDF_DIR = join(DATA_DIR, 'nebo-pdfs');
const OUT_DIR = join(DATA_DIR, 'nebo-maps');
const LOGS_PATH = join(DATA_DIR, 'nebo-logs.json');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');
// Consumed by src/layouts/BlogPost.astro to decide, per post, whether a Nebo
// map exists — same role daily-routes.json plays for PostMiniMap's track data.
const MANIFEST_PATH = join(ROOT, 'src', 'data', 'nebo-maps.json');

const args = process.argv.slice(2);
const dates = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date') dates.push(args[++i]);
}
const doAll = args.includes('--all');
const doUpload = args.includes('--upload');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const logs = JSON.parse(readFileSync(LOGS_PATH, 'utf8'));
const logByDate = new Map(logs.map((l) => [l.date, l]));

let targetDates = dates;
if (doAll) {
  // Every date with both a Nebo log and an existing post file, regardless of
  // classification/draft status — the manifest-driven layout in
  // BlogPost.astro doesn't care about either, so there's no reason to
  // restrict this to the narrative-viewer's narrower "full" scope.
  const postDates = new Set(readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx')).map((f) => f.slice(0, 10)));
  targetDates = logs.map((l) => l.date).filter((d) => postDates.has(d));
}

if (targetDates.length === 0) {
  console.error('No dates given. Use --date YYYY-MM-DD (repeatable) or --all.');
  process.exit(1);
}

// ── PDF page 1 -> native embedded map image, via PyMuPDF ───────────────────
// Picks the largest-area embedded raster on the page (the map; the other is
// a small fixed 526x526 AGLCA logo) and re-encodes it as a high-quality JPEG.

function extractNativeMap(pdfPath, outPath) {
  const pyScript = `
import fitz
from PIL import Image
import io

doc = fitz.open(${JSON.stringify(pdfPath)})
page = doc[0]
imgs = page.get_images(full=True)
if not imgs:
    raise SystemExit("no embedded images on page 1")
best = max(imgs, key=lambda i: doc.extract_image(i[0])['width'] * doc.extract_image(i[0])['height'])
data = doc.extract_image(best[0])
im = Image.open(io.BytesIO(data['image'])).convert('RGB')
im.save(${JSON.stringify(outPath)}, 'JPEG', quality=92)
print(f"ok {im.width}x{im.height}")
`;
  const result = execFileSync('python3', ['-c', pyScript], { encoding: 'utf8' });
  if (!result.includes('ok')) throw new Error('extract failed: ' + result);
  return result.trim();
}

// ── R2 upload (only if --upload) ───────────────────────────────────────────

let _r2Client = null;
function getR2Client() {
  if (_r2Client) return _r2Client;
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE'];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length) throw new Error(`Missing env var(s): ${missing.join(', ')}`);
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

async function uploadMap(date, filePath) {
  const key = `great-loop/${date}/nebo-map.jpg`;
  await getR2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: readFileSync(filePath),
    ContentType: 'image/jpeg',
  }));
  const base = process.env.R2_PUBLIC_BASE.replace(/\/$/, '');
  return `${base}/${key}`;
}

// ── Run ─────────────────────────────────────────────────────────────────────

const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};

for (const date of targetDates) {
  const log = logByDate.get(date);
  if (!log) { console.log(`${date}: no Nebo log — skipped`); continue; }
  const pdfPath = join(PDF_DIR, `${log.pdfUuid}.pdf`);
  if (!existsSync(pdfPath)) { console.log(`${date}: PDF missing (${log.pdfUuid}) — skipped`); continue; }

  const outPath = join(OUT_DIR, `${date}.jpg`);
  try {
    const info = extractNativeMap(pdfPath, outPath);
    console.log(`${date}: extracted (${info}) -> ${outPath}`);
    if (doUpload) {
      const url = await uploadMap(date, outPath);
      console.log(`${date}: uploaded -> ${url}`);
      manifest[date] = url;
    }
  } catch (err) {
    console.error(`${date}: FAILED — ${err.message}`);
  }
}

if (doUpload) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Manifest updated: ${MANIFEST_PATH} (${Object.keys(manifest).length} dates)`);
}
