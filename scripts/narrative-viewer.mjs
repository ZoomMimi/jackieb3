#!/usr/bin/env node
/**
 * scripts/narrative-viewer.mjs
 *
 * Local HTTP server for reviewing AI-drafted narratives (plan 06-06/06-07)
 * before publication. Answers three checkpoint requests that direct-MDX-
 * editing (06-CONTEXT.md D-09) can't:
 *
 *   1. Real-time editing of the drafted text, saved straight to the MDX file.
 *   2. A keep/discard checkbox per day — discarding deletes that day's post
 *      from the site entirely (git-reversible, not undoable from this tool).
 *   3. A place to supply ground truth generation can't infer from photos or
 *      GPS alone: a site-wide "known people" note (real names/relationships)
 *      and a per-day "memory" note. Both are read automatically by every
 *      future run of `scripts/11-draft-narratives.mjs --generate`, single-day
 *      or bulk — this tool is the editor for .planning/data/narrative-notes.json,
 *      not a separate data path.
 *
 *   node scripts/narrative-viewer.mjs            → http://localhost:3002
 *   node scripts/narrative-viewer.mjs --port 3003
 *
 * "Regenerate with notes" spawns:
 *   node --env-file-if-exists=.env scripts/11-draft-narratives.mjs --generate --date <date> --force
 * so it needs the same ANTHROPIC_API_KEY as running the generator directly.
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const DATA_DIR  = join(ROOT, '.planning', 'data');
const POSTS_DIR = join(ROOT, 'src', 'content', 'blog', 'great-loop');

const TRIAGE_PATH = join(DATA_DIR, 'narrative-triage.json');
const NOTES_PATH  = join(DATA_DIR, 'narrative-notes.json');

const portIdx = process.argv.indexOf('--port');
const PORT    = portIdx !== -1 ? parseInt(process.argv[portIdx + 1], 10) : 3002;

if (!existsSync(TRIAGE_PATH)) {
  console.error(`ERROR: ${TRIAGE_PATH} not found. Run scripts/11-draft-narratives.mjs --triage first.`);
  process.exit(1);
}

// ── Frontmatter utilities (copied verbatim from scripts/10-upload-r2.mjs) ──────

function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };
  const end = text.indexOf('\n---\n', 3);
  if (end === -1) return { frontmatter: '', body: text };
  const frontmatter = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n/, '');
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
    else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      obj[key] = val.slice(1, -1).replace(/\\"/g, '"');
    } else obj[key] = val;
  }
  return obj;
}

function serializeFrontmatter(obj) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'boolean' || typeof v === 'number') lines.push(`${k}: ${v}`);
    else {
      const needs = /[:#{}\[\]|>&*!'",%@`?]/.test(String(v));
      lines.push(needs ? `${k}: "${String(v).replace(/"/g, '\\"')}"` : `${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

// ── Notes (family + per-day memory + keep) ─────────────────────────────────────

function loadNotes() {
  if (!existsSync(NOTES_PATH)) return { familyNotes: '', days: {} };
  try {
    const parsed = JSON.parse(readFileSync(NOTES_PATH, 'utf8'));
    return { familyNotes: parsed.familyNotes ?? '', days: parsed.days ?? {} };
  } catch {
    return { familyNotes: '', days: {} };
  }
}

function saveNotes(notes) {
  writeFileSync(NOTES_PATH, JSON.stringify(notes, null, 2), 'utf8');
}

// ── Load triage + build the day list this tool works with ─────────────────────
// Scope: every 'full'-classified day, the same set --generate acts on. Transit
// and sparse days have no narrative to review and aren't shown here.

const triage = JSON.parse(readFileSync(TRIAGE_PATH, 'utf8'));
const fullDays = triage.days.filter((d) => d.classification === 'full').sort((a, b) => a.date.localeCompare(b.date));

const mdxFilenames = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));
const postFileByDate = new Map();
for (const f of mdxFilenames) {
  const datePrefix = f.slice(0, 10);
  if (!postFileByDate.has(datePrefix)) postFileByDate.set(datePrefix, f);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (err) { reject(err); }
    });
  });
}

/** Extract the prose (everything between the imports and the Gallery block). */
function extractProse(body) {
  const galleryIdx = body.indexOf('<Gallery');
  const lastImportMatch = [...body.matchAll(/^import .*$/gm)].pop();
  const start = lastImportMatch ? lastImportMatch.index + lastImportMatch[0].length : 0;
  const end = galleryIdx === -1 ? body.length : galleryIdx;
  return body.slice(start, end).trim();
}

function buildDayPayload(day) {
  const filename = postFileByDate.get(day.date);
  const notes = loadNotes();
  const dayNotes = notes.days[day.date] ?? {};
  const base = {
    date: day.date,
    slug: day.slug,
    range: day.range,
    location: day.location,
    hasFile: !!filename,
    memory: dayNotes.memory ?? '',
    keep: dayNotes.keep !== false,
  };
  if (!filename) return { ...base, title: day.slug, images: [], videos: [], prose: '', narrativeDrafted: false, draft: null };

  const raw = readFileSync(join(POSTS_DIR, filename), 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const fm = parseFrontmatter(frontmatter);
  const galleryMatch = body.match(/<Gallery\s+images=\{\[\s*([\s\S]*?)\]\}\s*\/>/);
  const urls = galleryMatch ? [...galleryMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];

  return {
    ...base,
    title: fm.title ?? day.slug,
    excerpt: fm.excerpt ?? '',
    images: urls.filter((u) => !u.toLowerCase().endsWith('.mov')),
    videos: urls.filter((u) => u.toLowerCase().endsWith('.mov')),
    prose: extractProse(body),
    narrativeDrafted: fm.narrativeDrafted === true,
    draft: fm.draft,
  };
}

function saveProse(date, prose, excerpt) {
  const filename = postFileByDate.get(date);
  if (!filename) throw new Error('no post file for this date');
  const filePath = join(POSTS_DIR, filename);
  const raw = readFileSync(filePath, 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const fm = parseFrontmatter(frontmatter);

  if (fm.draft === false) throw new Error('draft is false (already published) — refusing to overwrite, even from the viewer');

  const galleryMatch = body.match(/<Gallery\s+images=\{\[[\s\S]*?\]\}\s*\/>/);
  const voyageStatsMatch = body.match(/<VoyageStats[^>]*\/>/);
  const importLines = body.match(/^import .*$/gm) ?? [];
  const galleryBlockFull = galleryMatch ? galleryMatch[0] : null;
  const voyageStatsBlockFull = voyageStatsMatch ? voyageStatsMatch[0] : '<VoyageStats  />';

  const parts = [importLines.join('\n'), prose.trim()];
  if (galleryBlockFull) parts.push(galleryBlockFull);
  parts.push(voyageStatsBlockFull);
  const newBody = parts.join('\n\n');

  const newFm = { ...fm, narrativeDrafted: true };
  if (typeof excerpt === 'string' && excerpt.trim()) newFm.excerpt = excerpt.trim();

  writeFileSync(filePath, '---\n' + serializeFrontmatter(newFm) + '\n---\n\n' + newBody + '\n', 'utf8');
}

function dropDay(date) {
  const filename = postFileByDate.get(date);
  if (filename) {
    unlinkSync(join(POSTS_DIR, filename));
    postFileByDate.delete(date);
  }
}

function regenerate(date) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--env-file-if-exists=.env', join(__dirname, '11-draft-narratives.mjs'), '--generate', '--date', date, '--force'],
      { cwd: ROOT, env: process.env }
    );
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(out || `generator exited ${code}`));
    });
  });
}

// ── HTML ──────────────────────────────────────────────────────────────────────

const INITIAL_DAYS = fullDays.map(buildDayPayload).map((d) => ({
  date: d.date, slug: d.slug, location: d.location, title: d.title,
  narrativeDrafted: d.narrativeDrafted, hasFile: d.hasFile, keep: d.keep,
  hasMemory: !!d.memory,
}));
const INITIAL_FAMILY_NOTES = loadNotes().familyNotes;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jackie B III — Narrative Review</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:#111; --surface:#1c1c1c; --surface2:#232323; --border:#2e2e2e;
  --text:#e0e0e0; --muted:#888; --accent:#4a9eff; --warn:#e05252; --ok:#4caf6e;
  --sidebar-w:300px;
}
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--text); display:flex; height:100vh; overflow:hidden; }
#sidebar { width:var(--sidebar-w); min-width:var(--sidebar-w); border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface); overflow:hidden; }
#sidebar-top { padding:12px; border-bottom:1px solid var(--border); }
#sidebar-top h2 { font-size:14px; font-weight:600; margin-bottom:6px; }
#family-notes { width:100%; min-height:70px; background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:6px 8px; color:var(--text); font-size:12px; resize:vertical; outline:none; }
#family-notes:focus { border-color:var(--accent); }
#family-save { margin-top:6px; font-size:11px; padding:4px 10px; border-radius:5px; border:1px solid var(--border); background:var(--surface2); color:var(--text); cursor:pointer; }
#family-save:hover { border-color:var(--accent); }
#family-status { font-size:10px; color:var(--muted); margin-left:6px; }
#search-wrap { padding:8px 12px; border-bottom:1px solid var(--border); }
#search { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:5px 8px; color:var(--text); font-size:12px; outline:none; }
#day-list { flex:1; overflow-y:auto; }
.day-row { padding:9px 12px; cursor:pointer; border-left:3px solid transparent; border-bottom:1px solid var(--border); }
.day-row:hover { background:var(--surface2); }
.day-row.active { background:var(--surface2); border-left-color:var(--accent); }
.day-row.dropped { opacity:0.4; }
.day-date { font-size:11px; color:var(--muted); font-variant-numeric:tabular-nums; }
.day-title { font-size:12px; margin-top:2px; line-height:1.3; }
.day-flags { font-size:10px; margin-top:3px; display:flex; gap:6px; }
.flag { padding:1px 5px; border-radius:3px; }
.flag.drafted { background:#1f3d2a; color:var(--ok); }
.flag.undrafted { background:#3d2a1f; color:#e0a552; }
.flag.memory { background:#1f2f3d; color:var(--accent); }
.flag.dropped { background:#3d1f1f; color:var(--warn); }
#main { flex:1; display:flex; flex-direction:column; overflow-y:auto; }
#empty { margin:auto; color:var(--muted); font-size:13px; }
#post-view { display:none; padding:20px 28px; max-width:900px; }
#post-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px; }
#ph-title { font-size:18px; font-weight:700; }
#ph-meta { font-size:12px; color:var(--muted); margin-top:4px; margin-bottom:16px; }
.keep-row { display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:16px; padding:8px 12px; background:var(--surface); border-radius:6px; border:1px solid var(--border); }
.keep-row input { width:16px; height:16px; }
.keep-warn { color:var(--warn); font-size:11px; }
#photo-strip { display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:16px; }
#photo-strip img { height:110px; border-radius:4px; flex-shrink:0; }
#photo-strip .vid-chip { height:110px; width:80px; flex-shrink:0; background:#1a1a2e; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:11px; color:var(--muted); border:1px solid #2a2a4a; }
label.field-label { display:block; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); margin-bottom:5px; margin-top:16px; }
#excerpt-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text); font-size:13px; outline:none; }
#memory-input { width:100%; min-height:60px; background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text); font-size:13px; resize:vertical; outline:none; }
#prose-input { width:100%; min-height:320px; background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:12px; color:var(--text); font-size:14px; line-height:1.6; font-family:Georgia,serif; resize:vertical; outline:none; }
#prose-input:focus, #memory-input:focus, #excerpt-input:focus { border-color:var(--accent); }
.btn-row { display:flex; gap:10px; margin-top:16px; align-items:center; }
button.action { font-size:13px; padding:8px 16px; border-radius:6px; border:1px solid var(--border); background:var(--surface2); color:var(--text); cursor:pointer; }
button.action:hover { border-color:var(--accent); }
button.action.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
button.action.danger { border-color:var(--warn); color:var(--warn); }
button.action:disabled { opacity:0.5; cursor:default; }
#status-line { font-size:12px; color:var(--muted); }
#no-file-note { color:var(--warn); font-size:13px; margin-top:16px; }
::-webkit-scrollbar { width:6px; height:6px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#333; border-radius:3px; }
</style>
</head>
<body>

<div id="sidebar">
  <div id="sidebar-top">
    <h2>Known people</h2>
    <textarea id="family-notes" placeholder="e.g. Barbara's husband is Mike. Frequent visitors: Cindy &amp; John (Michigan), Ellen &amp; Louie (Northern Florida)...">${INITIAL_FAMILY_NOTES.replace(/</g, '&lt;')}</textarea>
    <div><button id="family-save">Save</button><span id="family-status"></span></div>
  </div>
  <div id="search-wrap">
    <input id="search" type="search" placeholder="Filter days…" autocomplete="off">
  </div>
  <div id="day-list"></div>
</div>

<div id="main">
  <div id="empty">Select a day to review its draft.</div>
  <div id="post-view">
    <div id="post-header">
      <div>
        <div id="ph-title"></div>
        <div id="ph-meta"></div>
      </div>
    </div>

    <div class="keep-row">
      <input type="checkbox" id="keep-checkbox">
      <label for="keep-checkbox">Keep this day</label>
      <span class="keep-warn">Unchecking deletes the post file immediately (recoverable only via git history)</span>
    </div>

    <div id="photo-strip"></div>

    <div id="no-file-note" style="display:none">This day's post file doesn't exist (dropped, or never generated).</div>

    <div id="editable-fields">
      <label class="field-label" for="excerpt-input">Excerpt</label>
      <input id="excerpt-input" type="text">

      <label class="field-label" for="memory-input">Memory (facts I can't infer from photos/GPS — used on next regenerate)</label>
      <textarea id="memory-input" placeholder="e.g. This was the day Ellen and Louie's daughter Blair visited with her new puppy."></textarea>

      <label class="field-label" for="prose-input">Drafted narrative (editable)</label>
      <textarea id="prose-input" placeholder="No draft yet — use Regenerate to create one."></textarea>

      <div class="btn-row">
        <button class="action primary" id="save-btn">Save edits</button>
        <button class="action" id="regen-btn">Regenerate with notes</button>
        <span id="status-line"></span>
      </div>
    </div>
  </div>
</div>

<script>
let DAYS = ${JSON.stringify(INITIAL_DAYS)};
let currentDate = null;

function renderSidebar(filter) {
  const q = (filter || '').toLowerCase();
  const list = document.getElementById('day-list');
  const visible = DAYS.filter(d => !q || d.date.includes(q) || (d.location || '').toLowerCase().includes(q) || (d.title || '').toLowerCase().includes(q));
  list.innerHTML = visible.map(d => \`
    <div class="day-row \${d.date === currentDate ? 'active' : ''} \${!d.keep ? 'dropped' : ''}" data-date="\${d.date}">
      <div class="day-date">\${d.date}\${d.location ? ' — ' + d.location : ''}</div>
      <div class="day-title">\${d.title}</div>
      <div class="day-flags">
        \${!d.keep ? '<span class="flag dropped">dropped</span>' : ''}
        \${d.keep && d.narrativeDrafted ? '<span class="flag drafted">drafted</span>' : ''}
        \${d.keep && !d.narrativeDrafted ? '<span class="flag undrafted">no draft</span>' : ''}
        \${d.hasMemory ? '<span class="flag memory">memory</span>' : ''}
      </div>
    </div>\`).join('');
  list.querySelectorAll('.day-row').forEach(row => row.addEventListener('click', () => loadDay(row.dataset.date)));
}

async function loadDay(date) {
  currentDate = date;
  renderSidebar(document.getElementById('search').value);
  const day = await fetch('/api/day/' + date).then(r => r.json());

  document.getElementById('empty').style.display = 'none';
  document.getElementById('post-view').style.display = 'block';
  document.getElementById('ph-title').textContent = day.title;
  document.getElementById('ph-meta').textContent = day.date + (day.location ? ' — ' + day.location : '') + (day.draft === false ? '  [PUBLISHED — read only]' : '');

  document.getElementById('keep-checkbox').checked = day.keep;
  document.getElementById('excerpt-input').value = day.excerpt || '';
  document.getElementById('memory-input').value = day.memory || '';
  document.getElementById('prose-input').value = day.prose || '';

  const editable = day.draft !== false;
  document.getElementById('excerpt-input').disabled = !editable;
  document.getElementById('prose-input').disabled = !editable;
  document.getElementById('save-btn').disabled = !editable || !day.hasFile;
  document.getElementById('regen-btn').disabled = !editable || !day.hasFile;

  document.getElementById('no-file-note').style.display = day.hasFile ? 'none' : 'block';

  const strip = document.getElementById('photo-strip');
  strip.innerHTML = [
    ...day.images.map(u => \`<img src="\${u}" loading="lazy">\`),
    ...day.videos.map(() => '<div class="vid-chip">video</div>'),
  ].join('') || '<span style="color:var(--muted);font-size:12px">No photos</span>';

  document.getElementById('status-line').textContent = '';
}

document.getElementById('search').addEventListener('input', e => renderSidebar(e.target.value));

document.getElementById('family-save').onclick = async () => {
  const familyNotes = document.getElementById('family-notes').value;
  await fetch('/api/family-notes', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ familyNotes }) });
  const s = document.getElementById('family-status');
  s.textContent = 'saved'; setTimeout(() => s.textContent = '', 1500);
};

document.getElementById('keep-checkbox').addEventListener('change', async (e) => {
  const keep = e.target.checked;
  if (!keep && !confirm('This deletes the post file for ' + currentDate + ' right now. Continue?')) {
    e.target.checked = true; return;
  }
  const res = await fetch('/api/day/' + currentDate + '/keep', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ keep }) });
  const updated = await res.json();
  const d = DAYS.find(x => x.date === currentDate);
  if (d) { d.keep = updated.keep; d.hasFile = updated.hasFile; }
  renderSidebar(document.getElementById('search').value);
  loadDay(currentDate);
});

document.getElementById('save-btn').onclick = async () => {
  const status = document.getElementById('status-line');
  status.textContent = 'saving…';
  const memoryValue = document.getElementById('memory-input').value;
  const body = { prose: document.getElementById('prose-input').value, excerpt: document.getElementById('excerpt-input').value };
  await fetch('/api/day/' + currentDate + '/memory', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ memory: memoryValue }) });
  const res = await fetch('/api/day/' + currentDate + '/save', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (res.ok) {
    status.textContent = 'saved';
    const d = DAYS.find(x => x.date === currentDate);
    if (d) { d.narrativeDrafted = true; d.hasMemory = !!memoryValue; }
    renderSidebar(document.getElementById('search').value);
  } else {
    status.textContent = 'error: ' + await res.text();
  }
};

document.getElementById('regen-btn').onclick = async () => {
  const status = document.getElementById('status-line');
  status.textContent = 'saving notes…';
  await fetch('/api/day/' + currentDate + '/memory', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ memory: document.getElementById('memory-input').value }) });
  status.textContent = 'calling the API (this can take ~15-30s)…';
  document.getElementById('regen-btn').disabled = true;
  try {
    const res = await fetch('/api/day/' + currentDate + '/regenerate', { method: 'POST' });
    if (!res.ok) { status.textContent = 'error: ' + await res.text(); return; }
    status.textContent = 'regenerated';
    await loadDay(currentDate);
  } finally {
    document.getElementById('regen-btn').disabled = false;
  }
};

renderSidebar();
</script>
</body>
</html>`;

// ── Server ────────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === '/' || path === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML); return;
    }

    if (path === '/api/family-notes' && req.method === 'POST') {
      const { familyNotes } = await readBody(req);
      const notes = loadNotes();
      notes.familyNotes = familyNotes ?? '';
      saveNotes(notes);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      return;
    }

    const dayMatch = path.match(/^\/api\/day\/(\d{4}-\d{2}-\d{2})$/);
    if (dayMatch && req.method === 'GET') {
      const day = fullDays.find((d) => d.date === dayMatch[1]);
      if (!day) { res.writeHead(404); res.end('{}'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(buildDayPayload(day)));
      return;
    }

    const saveMatch = path.match(/^\/api\/day\/(\d{4}-\d{2}-\d{2})\/save$/);
    if (saveMatch && req.method === 'POST') {
      const { prose, excerpt } = await readBody(req);
      saveProse(saveMatch[1], prose ?? '', excerpt);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      return;
    }

    const memoryMatch = path.match(/^\/api\/day\/(\d{4}-\d{2}-\d{2})\/memory$/);
    if (memoryMatch && req.method === 'POST') {
      const { memory } = await readBody(req);
      const notes = loadNotes();
      notes.days[memoryMatch[1]] = { ...(notes.days[memoryMatch[1]] ?? {}), memory: memory ?? '' };
      saveNotes(notes);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      return;
    }

    const keepMatch = path.match(/^\/api\/day\/(\d{4}-\d{2}-\d{2})\/keep$/);
    if (keepMatch && req.method === 'POST') {
      const { keep } = await readBody(req);
      const notes = loadNotes();
      notes.days[keepMatch[1]] = { ...(notes.days[keepMatch[1]] ?? {}), keep: !!keep };
      saveNotes(notes);
      if (!keep) dropDay(keepMatch[1]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keep: !!keep, hasFile: postFileByDate.has(keepMatch[1]) }));
      return;
    }

    const regenMatch = path.match(/^\/api\/day\/(\d{4}-\d{2}-\d{2})\/regenerate$/);
    if (regenMatch && req.method === 'POST') {
      try {
        await regenerate(regenMatch[1]);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end(err.message);
      }
      return;
    }

    res.writeHead(404); res.end('Not found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n── Jackie B III Narrative Review ${'─'.repeat(24)}`);
  console.log(`  URL:        http://localhost:${PORT}`);
  console.log(`  Days:       ${fullDays.length} (classification=full)`);
  console.log(`  Notes file: .planning/data/narrative-notes.json`);
  console.log(`  Ctrl+C to stop`);
  console.log('─'.repeat(47));
});
