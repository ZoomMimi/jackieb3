#!/usr/bin/env node
/**
 * scripts/02-fetch-nebo-logs.mjs
 *
 * For each entry in nebo-email-index.json:
 *   1. Download the PDF from reports.nebo.global
 *   2. OCR it using macOS Vision framework (PyObjC)
 *   3. Parse stats from the OCR text
 *   4. Append result to nebo-logs.json (incremental — safe to re-run)
 *
 * Usage: node scripts/02-fetch-nebo-logs.mjs [--limit N] [--start-date YYYY-MM-DD]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../.planning/data');
const pdfDir = join(dataDir, 'nebo-pdfs');
const emailIndexPath = join(dataDir, 'nebo-email-index.json');
const outputPath = join(dataDir, 'nebo-logs.json');

// Parse CLI args
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;
const startDateIdx = args.indexOf('--start-date');
const startDate = startDateIdx >= 0 ? args[startDateIdx + 1] : null;

// Ensure PDF cache dir exists
if (!existsSync(pdfDir)) mkdirSync(pdfDir, { recursive: true });

// Load index
const emailIndex = JSON.parse(readFileSync(emailIndexPath, 'utf8'));

// Load existing output (for incremental / resumable runs)
let existing = [];
if (existsSync(outputPath)) {
  existing = JSON.parse(readFileSync(outputPath, 'utf8'));
}
const doneUuids = new Set(existing.map(e => e.pdfUuid));

// Filter: skip already done, apply start-date filter
let toProcess = emailIndex.filter(e => !doneUuids.has(e.pdfUuid));
if (startDate) toProcess = toProcess.filter(e => e.date >= startDate);
if (limit < Infinity) toProcess = toProcess.slice(0, limit);

console.log(`Index: ${emailIndex.length} entries, ${doneUuids.size} already done, ${toProcess.length} to process.`);

// Python OCR script (inline, written to tmp file)
const ocrScript = `
import sys, re, json, pathlib
sys.path.insert(0, '/Users/bruhnhome/Library/Python/3.9/lib/python/site-packages')
import Quartz
from Foundation import NSURL
import Vision

def ocr_pdf(pdf_path):
    url = NSURL.fileURLWithPath_(str(pdf_path))
    pdf = Quartz.PDFDocument.alloc().initWithURL_(url)
    if not pdf:
        return None
    pages_text = []
    for i in range(min(pdf.pageCount(), 3)):
        page = pdf.pageAtIndex_(i)
        page_img = page.thumbnailOfSize_forBox_((2000, 2000), Quartz.kPDFDisplayBoxMediaBox)
        # Convert NSImage to CGImage for Vision
        tiff_data = page_img.TIFFRepresentation()
        img_src = Quartz.CGImageSourceCreateWithData(tiff_data, None)
        cg_image = Quartz.CGImageSourceCreateImageAtIndex(img_src, 0, None)
        request = Vision.VNRecognizeTextRequest.alloc().init()
        request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
        handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, {})
        handler.performRequests_error_([request], None)
        lines = []
        for obs in request.results():
            lines.append(obs.topCandidates_(1)[0].string())
        pages_text.append('\\n'.join(lines))
    return pages_text

pdf_path = sys.argv[1]
result = ocr_pdf(pdf_path)
if result:
    print(json.dumps(result))
else:
    print(json.dumps([]))
`;

const ocrScriptPath = join(tmpdir(), 'nebo_ocr.py');
writeFileSync(ocrScriptPath, ocrScript);

// Parse stats from OCR text (page 1)
// The Nebo PDF page 1 layout has labels and values on separate lines:
//   "Voyages\nUnderway\n(hours)\n2:14\n...\nMax Speed\n(knots)\n22.2\n...\n
//    Duration\n(hours)\nDistance\n(nm)\nAverage Speed\n(knots)\n2:29\n28.7\n12.8"
function parseStats(pagesText, date, pdfUuid) {
  const page1 = pagesText[0] || '';
  const lines = page1.split('\n').map(l => l.trim()).filter(Boolean);

  const result = { date, pdfUuid, raw: pagesText };

  // Helper: find next numeric value after a label (searches within N lines)
  function valueAfter(labelPattern, windowSize = 5) {
    for (let i = 0; i < lines.length; i++) {
      if (labelPattern.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + windowSize, lines.length); j++) {
          const num = parseFloat(lines[j]);
          if (!isNaN(num)) return num;
        }
      }
    }
    return null;
  }

  // Helper: find next H:MM time value after a label
  function timeAfter(labelPattern, windowSize = 5) {
    for (let i = 0; i < lines.length; i++) {
      if (labelPattern.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + windowSize, lines.length); j++) {
          const m = lines[j].match(/^(\d+):(\d{2})$/);
          if (m) return m[0];
        }
      }
    }
    return null;
  }

  // Underway time — appears after "Underway" / "(hours)"
  const underwayTime = timeAfter(/^underway$/i) || timeAfter(/^\(hours\)$/i);
  if (underwayTime) {
    const [h, m] = underwayTime.split(':').map(Number);
    result.underwayHours = h + m / 60;
    result.underwayFormatted = underwayTime;
  }

  // Max speed — appears after "Max Speed" or "(knots)" following "Max Speed"
  const maxSpd = valueAfter(/^max\s+speed$/i);
  if (maxSpd != null) result.maxSpeedKts = maxSpd;

  // Duration / Distance / Average Speed — two possible layouts:
  // Layout A (3-column): all 3 labels appear consecutively, then all 3 values follow
  //   "Duration\n(hours)\nDistance\n(nm)\nAverage Speed\n(knots)\n2:29\n28.7\n12.8"
  // Layout B (inline): each label followed immediately by its value
  //   "Duration\n(hours)\n0:49\nDistance\n(nm)\n6.1\n..."
  const durIdx = lines.findIndex(l => /^duration$/i.test(l));
  if (durIdx >= 0) {
    // Detect layout A: "Duration\n(hours)\nDistance" — no value between Duration and Distance
    // Layout B: "Duration\n(hours)\n0:49\nDistance" — value appears before Distance label
    const lineAfterUnits = lines[durIdx + 2] || '';
    const isLayoutA = /^distance$/i.test(lineAfterUnits);

    if (isLayoutA) {
      // Layout A: labels cluster first, then values follow.
      // Skip past label lines (text + "(unit)" pairs) to find the value block.
      let vi = durIdx;
      while (vi < lines.length && (!/^\d/.test(lines[vi]) || /^\d{4}$/.test(lines[vi]))) vi++;
      // vi now points to first value line; gather values
      const valueLines = lines.slice(vi, vi + 8);
      const timeVal = valueLines.find(l => /^\d+:\d{2}$/.test(l));
      const numVals = valueLines.filter(l => /^\d+\.?\d*$/.test(l) && !isNaN(parseFloat(l)));
      if (timeVal) {
        const [h, m] = timeVal.split(':').map(Number);
        result.durationHours = h + m / 60;
        result.durationFormatted = timeVal;
      }
      if (numVals[0] != null) result.distanceNm = parseFloat(numVals[0]);
      if (numVals[1] != null) result.avgSpeedKts = parseFloat(numVals[1]);
    } else {
      // Layout B: each label followed by value inline
      const durTime = timeAfter(/^duration$/i);
      if (durTime) {
        const [h, m] = durTime.split(':').map(Number);
        result.durationHours = h + m / 60;
        result.durationFormatted = durTime;
      }
      const dist = valueAfter(/^\(nm\)$/i);
      if (dist != null) result.distanceNm = dist;
      const avgSpd = valueAfter(/^average\s+speed$/i);
      if (avgSpd != null) result.avgSpeedKts = avgSpd;
    }
  }

  // Voyage count — number before "Voyage" on a line, or line after "Voyages"
  const voyageMatch = page1.match(/(\d+)\s+voyage/i);
  if (voyageMatch) {
    result.voyageCount = parseInt(voyageMatch[1]);
  } else {
    const vCount = valueAfter(/^voyages?$/i, 3);
    if (vCount != null) result.voyageCount = vCount;
  }

  return result;
}

// Process each entry
const results = [...existing];

for (let i = 0; i < toProcess.length; i++) {
  const { date, pdfUuid } = toProcess[i];
  const pdfUrl = `https://reports.nebo.global/6033931b-947a-427f-943d-802ec9d37af9/${pdfUuid}.pdf`;
  const pdfPath = join(pdfDir, `${pdfUuid}.pdf`);

  process.stdout.write(`[${i + 1}/${toProcess.length}] ${date} ${pdfUuid.slice(0, 8)}... `);

  try {
    // Download PDF (skip if cached)
    if (!existsSync(pdfPath)) {
      execSync(`curl -s -o "${pdfPath}" "${pdfUrl}"`, { timeout: 30000 });
    }

    // OCR
    const ocrOutput = execSync(`python3 "${ocrScriptPath}" "${pdfPath}"`, {
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    }).toString().trim();

    const pagesText = JSON.parse(ocrOutput);
    const entry = parseStats(pagesText, date, pdfUuid);
    results.push(entry);

    const dist = entry.distanceNm ? `${entry.distanceNm}nm` : '?nm';
    const time = entry.underwayFormatted || '?';
    console.log(`✓ ${dist} ${time}`);

    // Save incrementally after each entry
    writeFileSync(outputPath, JSON.stringify(results, null, 2));

  } catch (err) {
    console.log(`✗ ERROR: ${err.message.slice(0, 80)}`);
    results.push({ date, pdfUuid, error: err.message.slice(0, 200) });
    writeFileSync(outputPath, JSON.stringify(results, null, 2));
  }
}

console.log(`\nDone. ${results.length} total entries in ${outputPath}`);

// Summary stats
const successful = results.filter(r => r.distanceNm != null);
const totalNm = successful.reduce((s, r) => s + r.distanceNm, 0);
console.log(`Successful OCR: ${successful.length}/${results.length}`);
console.log(`Total voyage distance: ${totalNm.toFixed(1)} nm`);
