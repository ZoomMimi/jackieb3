#!/usr/bin/env node
/**
 * scripts/photo-viewer.mjs
 *
 * Local HTTP server for reviewing and curating photos/videos by voyage day.
 *   node scripts/photo-viewer.mjs            → http://localhost:3000
 *   node scripts/photo-viewer.mjs --port 3001
 *
 * Prereq: node scripts/03-correlate.mjs
 *
 * Interactions:
 *   Single-click    — cycle state: (blank) → ✅ include → ❌ exclude → ⭐ cover
 *   Double-click    — open lightbox (zoom photo / play video inline)
 *   Shift+click     — toggle into multi-select
 *   Float bar       — apply Include / Exclude / Cover / Unset to all selected
 *   Day buttons     — Include All / Exclude All / Cover All / Clear All
 *
 * Keyboard (in browser):
 *   ← / →           navigate days in sidebar
 *   Escape           close lightbox or clear selection
 *   M                toggle Mark Reviewed
 *   Ctrl+Z           undo last state change
 *   ← / → (lightbox) prev / next media item
 *
 * Selections saved to: .planning/data/photo-selections.json
 */

import { createServer }                            from 'node:http';
import { readFileSync, writeFileSync, existsSync,
         createReadStream, statSync }              from 'node:fs';
import { join, extname }                           from 'node:path';
import { fileURLToPath }                           from 'node:url';
import { dirname }                                 from 'node:path';
import { homedir }                                 from 'node:os';
import { exec }                                    from 'node:child_process';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = join(__dirname, '..', '.planning', 'data');
const PHOTOS_LIB = join(homedir(), 'Pictures', 'Photos Library.photoslibrary');

const portIdx = process.argv.indexOf('--port');
const PORT    = portIdx !== -1 ? parseInt(process.argv[portIdx + 1], 10) : 3000;

// ── Load ──────────────────────────────────────────────────────────────────────

const ENRICHED_PATH   = join(DATA_DIR, 'voyage-timeline-enriched.json');
const SELECTIONS_PATH = join(DATA_DIR, 'photo-selections.json');

if (!existsSync(ENRICHED_PATH)) {
  console.error('ERROR: voyage-timeline-enriched.json not found.');
  console.error('       Run: node scripts/03-correlate.mjs  first.');
  process.exit(1);
}

console.log('Loading voyage-timeline-enriched.json...');
const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'));

let selections = existsSync(SELECTIONS_PATH)
  ? JSON.parse(readFileSync(SELECTIONS_PATH, 'utf8'))
  : {};

function saveSelections() {
  writeFileSync(SELECTIONS_PATH, JSON.stringify(selections, null, 2));
}

const dayList = enriched.days
  .filter(d => d.hasPhotos || d.hasNebo)
  .map(d => ({
    date:       d.date,
    location:   d.location,
    photoCount: d.photos.filter(p => p.kind !== 1).length,
    videoCount: d.photos.filter(p => p.kind === 1).length,
    totalCount: d.photoCount,
    withGps:    d.withGps,
    hasNebo:    d.hasNebo,
    nebo: d.nebo
      ? { distanceNm: d.nebo.distanceNm, underwayFormatted: d.nebo.underwayFormatted }
      : null,
  }));

// ── File helpers ──────────────────────────────────────────────────────────────

const MIME = {
  '.heic': 'image/heic', '.heif': 'image/heif',
  '.jpg': 'image/jpeg',  '.jpeg': 'image/jpeg',
  '.png': 'image/png',   '.gif': 'image/gif',
  '.mov': 'video/quicktime', '.mp4': 'video/mp4',
};

const derivPath  = p =>
  join(PHOTOS_LIB, 'resources', 'derivatives', p.directory, `${p.uuid}_1_105_c.jpeg`);
const deriv102Path = p =>
  join(PHOTOS_LIB, 'resources', 'derivatives', p.directory, `${p.uuid}_1_102_o.jpeg`);
const thmPath    = p =>
  join(PHOTOS_LIB, 'resources', 'derivatives', p.directory, `${p.uuid}.THM`);
const origPath   = p =>
  join(PHOTOS_LIB, 'originals', p.directory, p.filename);

// ── HTML ──────────────────────────────────────────────────────────────────────
// Inner backticks escaped as \`; inner ${} escaped as \${}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jackie B III — Photo Viewer</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:#111; --surface:#1c1c1c; --surface2:#232323; --border:#2e2e2e;
  --text:#e0e0e0; --muted:#777; --accent:#4a9eff;
  --green:#4caf50; --red:#e53935; --gold:#ffc107;
  --sidebar-w:290px;
}
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--text); display:flex; height:100vh; overflow:hidden; }

/* sidebar */
#sidebar { width:var(--sidebar-w); min-width:var(--sidebar-w); border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface); }
#sidebar-top { padding:12px; border-bottom:1px solid var(--border); }
#sidebar-top h2 { font-size:13px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
#stats-line { font-size:11px; color:var(--muted); margin-bottom:8px; }
#filter-tabs { display:flex; gap:4px; flex-wrap:wrap; }
.tab { padding:3px 9px; border-radius:12px; cursor:pointer; font-size:11px; font-weight:500; background:var(--surface2); border:1px solid var(--border); color:var(--muted); user-select:none; }
.tab.active { background:var(--accent); border-color:var(--accent); color:#fff; }
#day-list { flex:1; overflow-y:auto; }
#day-list::-webkit-scrollbar { width:5px; }
#day-list::-webkit-scrollbar-thumb { background:#333; border-radius:3px; }
.day-row { padding:7px 12px; cursor:pointer; border-bottom:1px solid #1e1e1e; display:flex; align-items:center; gap:8px; border-left:3px solid transparent; }
.day-row:hover { background:#252525; }
.day-row.active { background:#1e2d42; border-left-color:var(--accent); }
.day-row.reviewed { border-left-color:var(--green); }
.day-row.reviewed.active { border-left-color:var(--accent); }
.day-date { font-size:11px; font-weight:600; color:var(--muted); font-family:'SF Mono',monospace; min-width:66px; }
.day-loc { font-size:12px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.badges { display:flex; gap:3px; flex-shrink:0; }
.badge { padding:1px 5px; border-radius:10px; font-size:10px; font-weight:600; }
.badge-photos { background:#1e3754; color:var(--accent); }
.badge-videos { background:#2e1e3a; color:#b39ddb; }
.badge-nebo { background:#1e3a1e; color:#6dbf6d; }
.badge-blog { background:#2e2418; color:#d4a056; }
.badge-rev { background:#1e3a24; color:var(--green); }

/* main */
#main { flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
#placeholder { flex:1; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:15px; }

/* day header */
#day-header { padding:10px 16px; border-bottom:1px solid var(--border); background:var(--surface); display:flex; align-items:center; gap:16px; flex-wrap:wrap; flex-shrink:0; }
#day-header-left h1 { font-size:17px; font-weight:700; }
#day-header-left .meta { font-size:12px; color:var(--muted); margin-top:2px; }
#nebo-stats { display:flex; gap:14px; }
.stat .val { font-size:15px; font-weight:700; color:var(--accent); }
.stat .lbl { font-size:9px; text-transform:uppercase; color:var(--muted); letter-spacing:.05em; }
#header-actions { margin-left:auto; display:flex; gap:5px; align-items:center; flex-wrap:wrap; }
.btn { padding:5px 10px; border-radius:6px; border:1px solid var(--border); background:var(--surface2); color:var(--text); cursor:pointer; font-size:11px; white-space:nowrap; }
.btn:hover { background:#333; }
.btn.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
.btn.success { background:var(--green); border-color:var(--green); color:#fff; }

/* counts bar */
#blog-notice { width:100%; padding:5px 0 2px; font-size:11px; color:#c49040; }
#blog-notice .blog-title { font-style:italic; }
#sel-bar { padding:5px 16px; border-bottom:1px solid var(--border); background:#161616; display:flex; gap:14px; font-size:11px; color:var(--muted); align-items:center; flex-shrink:0; }
.sel-item { display:flex; align-items:center; gap:4px; }
.dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
.dot-inc { background:var(--green); }
.dot-excl { background:var(--red); }
.dot-cov { background:var(--gold); }
#sel-hint { margin-left:auto; color:#444; font-size:10px; }

/* grid */
#photo-grid { flex:1; overflow-y:auto; padding:12px; display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; align-content:start; padding-bottom:70px; }
#photo-grid::-webkit-scrollbar { width:5px; }
#photo-grid::-webkit-scrollbar-thumb { background:#333; border-radius:3px; }

.photo-card { position:relative; aspect-ratio:4/3; border-radius:6px; overflow:hidden; cursor:pointer; border:2px solid transparent; background:#1e1e1e; user-select:none; }
.photo-card img { width:100%; height:100%; object-fit:cover; display:block; background:#1e1e1e; }
.hover-hint { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.55); opacity:0; transition:opacity .15s; font-size:10px; color:#bbb; pointer-events:none; text-align:center; padding:4px; }
.photo-card:hover .hover-hint { opacity:1; }
.state-badge { position:absolute; top:5px; right:5px; font-size:14px; line-height:1; text-shadow:0 0 4px rgba(0,0,0,.9); pointer-events:none; }
.gps-dot { position:absolute; bottom:5px; left:5px; width:6px; height:6px; border-radius:50%; background:var(--green); opacity:.7; pointer-events:none; }
.time-tag { position:absolute; bottom:5px; right:5px; font-size:9px; font-family:'SF Mono',monospace; background:rgba(0,0,0,.75); color:#ccc; padding:1px 4px; border-radius:3px; pointer-events:none; }
.video-badge { position:absolute; top:5px; left:5px; font-size:10px; background:rgba(0,0,0,.7); color:#ddd; padding:1px 5px; border-radius:3px; pointer-events:none; }
.photo-card.include { border-color:var(--green); }
.photo-card.exclude { border-color:var(--red); opacity:.5; }
.photo-card.cover { border-color:var(--gold); }
.photo-card.selected { outline:2px solid var(--accent); outline-offset:1px; }
.photo-card.selected .video-badge { opacity:0; }
.check-badge { display:none; position:absolute; top:5px; left:5px; background:var(--accent); color:#fff; border-radius:50%; width:18px; height:18px; align-items:center; justify-content:center; font-size:11px; font-weight:700; pointer-events:none; z-index:2; }
.photo-card.selected .check-badge { display:flex; }

/* floating action bar */
#float-bar { display:none; position:absolute; bottom:16px; left:50%; transform:translateX(-50%); background:#2a2a2a; border:1px solid #444; border-radius:30px; padding:8px 18px; align-items:center; gap:12px; box-shadow:0 4px 24px rgba(0,0,0,.6); z-index:50; white-space:nowrap; }
#float-bar.visible { display:flex; }
#float-count { font-size:13px; font-weight:600; color:var(--accent); }
.fbar-sep { width:1px; height:20px; background:#444; }
.fbar-btn { padding:5px 12px; border-radius:20px; border:1px solid #555; background:#333; color:var(--text); cursor:pointer; font-size:12px; }
.fbar-btn:hover { background:#444; }
.fbar-btn.inc  { border-color:var(--green); color:var(--green); }
.fbar-btn.excl { border-color:var(--red); color:var(--red); }
.fbar-btn.cov  { border-color:var(--gold); color:var(--gold); }

/* lightbox */
#lightbox { display:none; position:fixed; inset:0; z-index:300; background:rgba(0,0,0,.93); flex-direction:column; align-items:center; justify-content:center; }
#lightbox.open { display:flex; }
#lb-media { display:flex; align-items:center; justify-content:center; max-width:92vw; max-height:82vh; }
#lb-media img { max-width:92vw; max-height:82vh; object-fit:contain; border-radius:4px; display:block; }
#lb-media video { max-width:92vw; max-height:82vh; border-radius:4px; outline:none; }
#lb-close { position:absolute; top:14px; right:18px; background:rgba(255,255,255,.1); border:none; color:#fff; font-size:20px; width:36px; height:36px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; }
#lb-close:hover { background:rgba(255,255,255,.2); }
#lb-prev, #lb-next { position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,.1); border:none; color:#fff; font-size:28px; width:44px; height:60px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
#lb-prev:hover, #lb-next:hover { background:rgba(255,255,255,.2); }
#lb-prev { left:12px; }
#lb-next { right:12px; }
#lb-prev:disabled, #lb-next:disabled { opacity:.25; cursor:default; }
#lb-caption { position:absolute; bottom:14px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.7); color:#ccc; font-size:12px; padding:5px 14px; border-radius:20px; white-space:nowrap; pointer-events:none; display:flex; gap:12px; align-items:center; }
#lb-caption .lb-loc { color:var(--accent); }
#lb-counter { position:absolute; top:14px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.6); color:#aaa; font-size:11px; padding:4px 12px; border-radius:12px; pointer-events:none; }
#lb-loading { position:absolute; color:#555; font-size:14px; }

/* lightbox click-to-fill zoom */
#lb-media img { cursor:zoom-in; }
#lightbox.zoomed #lb-media img { max-width:100vw; max-height:100vh; border-radius:0; cursor:zoom-out; }
#lightbox.zoomed #lb-prev, #lightbox.zoomed #lb-next,
#lightbox.zoomed #lb-caption, #lightbox.zoomed #lb-counter,
#lightbox.zoomed #lb-close { opacity:0; pointer-events:none; }
#lb-prev, #lb-next, #lb-caption, #lb-counter, #lb-close { transition:opacity .15s; }
</style>
</head>
<body>

<div id="sidebar">
  <div id="sidebar-top">
    <h2>Jackie B III</h2>
    <div id="stats-line"></div>
    <div id="filter-tabs">
      <div class="tab active" data-filter="all">All</div>
      <div class="tab" data-filter="blog">Blog</div>
      <div class="tab" data-filter="nebo">Has Nebo</div>
      <div class="tab" data-filter="unreviewed">Unreviewed</div>
      <div class="tab" data-filter="reviewed">Reviewed</div>
    </div>
  </div>
  <div id="day-list"></div>
</div>

<div id="main">
  <div id="placeholder">← Select a day from the sidebar</div>
</div>

<!-- Lightbox -->
<div id="lightbox">
  <button id="lb-close">✕</button>
  <div id="lb-counter"></div>
  <div id="lb-loading">Loading…</div>
  <div id="lb-media"></div>
  <button id="lb-prev" disabled>‹</button>
  <button id="lb-next" disabled>›</button>
  <div id="lb-caption"></div>
</div>

<script>
// ── App state ─────────────────────────────────────────────────────────────────
const app = {
  days:        [],
  selections:  {},
  filter:      'all',
  currentDate: null,
  currentDay:  null,
  selected:    new Set(),
  undoStack:   [],
  lb: { open: false, idx: 0, items: [] },   // lightbox
};

const STATE_CYCLE = [null, 'include', 'exclude', 'cover'];
const STATE_ICON  = { include: '✅', exclude: '❌', cover: '⭐' };
const clickTimers = new Map();   // uuid → timer — for single vs double click

// ── API ───────────────────────────────────────────────────────────────────────
const get  = path => fetch(path).then(r => r.json());
const post = (path, body) => fetch(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
}).then(r => r.json());

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  const [days, sels] = await Promise.all([get('/api/days'), get('/api/selections')]);
  app.days       = days;
  app.selections = sels;
  const total  = days.reduce((n, d) => n + d.totalCount, 0);
  const videos = days.reduce((n, d) => n + d.videoCount, 0);
  document.getElementById('stats-line').textContent =
    \`\${days.length} days · \${total.toLocaleString()} items (\${videos} videos)\`;
  renderSidebar();
  document.addEventListener('keydown', onKey);
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function filteredDays() {
  const f = app.filter;
  return app.days.filter(d => {
    if (f === 'nebo')       return d.hasNebo;
    if (f === 'blog')       return app.selections[d.date]?.blogPosts?.length > 0;
    if (f === 'reviewed')   return !!app.selections[d.date]?.reviewed;
    if (f === 'unreviewed') return !app.selections[d.date]?.reviewed;
    return true;
  });
}

function renderSidebar() {
  const days = filteredDays();
  document.getElementById('day-list').innerHTML = days.map(d => {
    const reviewed = !!app.selections[d.date]?.reviewed;
    const active   = d.date === app.currentDate;
    const cls = 'day-row' + (active ? ' active' : '') + (reviewed ? ' reviewed' : '');
    const pb = d.photoCount > 0 ? \`<span class="badge badge-photos">\${d.photoCount}</span>\` : '';
    const vb = d.videoCount > 0 ? \`<span class="badge badge-videos">▶\${d.videoCount}</span>\` : '';
    const nb = d.hasNebo    ? \`<span class="badge badge-nebo">N</span>\` : '';
    const rb = reviewed     ? \`<span class="badge badge-rev">✓</span>\` : '';
    const bp = app.selections[d.date]?.blogPosts?.length > 0 ? \`<span class="badge badge-blog">Blog</span>\` : '';
    return \`<div class="\${cls}" data-date="\${d.date}">
      <div class="day-date">\${d.date.slice(5)}</div>
      <div class="day-loc">\${d.location || '—'}</div>
      <div class="badges">\${pb}\${vb}\${nb}\${bp}\${rb}</div>
    </div>\`;
  }).join('');
  document.querySelectorAll('.day-row').forEach(r =>
    r.addEventListener('click', () => loadDay(r.dataset.date)));
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    app.filter = tab.dataset.filter;
    renderSidebar();
  });
});

function scrollActiveIntoView() {
  document.querySelector('.day-row.active')?.scrollIntoView({ block: 'nearest' });
}

// ── Day loading ───────────────────────────────────────────────────────────────
async function loadDay(date) {
  app.currentDate = date;
  clearSelection();
  renderSidebar();
  scrollActiveIntoView();
  document.getElementById('main').innerHTML =
    '<div style="padding:24px;color:#555;font-size:13px;">Loading…</div>';
  app.currentDay = await get(\`/api/day/\${date}\`);
  renderDayView(app.currentDay);
}

// ── Day view ──────────────────────────────────────────────────────────────────
function renderDayView(day) {
  const sel        = app.selections[day.date] || {};
  const isReviewed = !!sel.reviewed;
  const videos     = day.photos.filter(p => p.kind === 1).length;
  const photos     = day.photos.length - videos;
  const countStr   = [photos > 0 && \`\${photos} photos\`, videos > 0 && \`\${videos} videos\`].filter(Boolean).join(', ');

  const neboHtml = day.nebo ? \`<div id="nebo-stats">
    <div class="stat"><div class="val">\${day.nebo.distanceNm.toFixed(1)}</div><div class="lbl">nm</div></div>
    <div class="stat"><div class="val">\${day.nebo.underwayFormatted}</div><div class="lbl">underway</div></div>
    <div class="stat"><div class="val">\${day.nebo.avgSpeedKts.toFixed(1)}</div><div class="lbl">avg kts</div></div>
    <div class="stat"><div class="val">\${day.nebo.maxSpeedKts.toFixed(1)}</div><div class="lbl">max kts</div></div>
  </div>\` : '';

  const blogPosts = sel.blogPosts || [];
  const blogHtml = blogPosts.length > 0
    ? \`<div id="blog-notice">📝 <strong>Blog post\${blogPosts.length > 1 ? 's' : ''} published for this date:</strong> \${blogPosts.map(p => \`<span class="blog-title">\${p.title}</span> (\${p.imageCount} img\${p.videoCount > 0 ? ', ' + p.videoCount + 'v' : ''})\`).join(' · ')}</div>\`
    : '';

  document.getElementById('main').innerHTML = \`
    <div id="day-header">
      <div id="day-header-left">
        <h1>\${day.date}</h1>
        <div class="meta">\${day.location || 'Unknown'} · \${countStr}\${day.nebo ? ' · Nebo log' : ''}</div>
      </div>
      \${neboHtml}
      <div id="header-actions">
        <button class="btn" id="btn-incl-all">✅ Include All</button>
        <button class="btn" id="btn-excl-all">❌ Exclude All</button>
        <button class="btn" id="btn-cov-all">⭐ Cover All</button>
        <button class="btn" id="btn-clr-all">⬜ Clear All</button>
        <button class="btn \${isReviewed ? 'success' : 'primary'}" id="btn-reviewed">
          \${isReviewed ? '✓ Reviewed' : 'Mark Reviewed'}
        </button>
      </div>
    </div>
    \${blogHtml}
    <div id="sel-bar">
      <div class="sel-item"><span class="dot dot-inc"></span><span id="cnt-inc">0</span> include</div>
      <div class="sel-item"><span class="dot dot-excl"></span><span id="cnt-excl">0</span> exclude</div>
      <div class="sel-item"><span class="dot dot-cov"></span><span id="cnt-cov">0</span> cover</div>
      <div id="sel-hint">single-click: cycle · dbl-click: zoom/play · shift+click: multi-select · ← →: days</div>
    </div>
    <div id="photo-grid"></div>
    <div id="float-bar">
      <span id="float-count"></span>
      <div class="fbar-sep"></div>
      <button class="fbar-btn inc"  data-action="include">✅ Include</button>
      <button class="fbar-btn excl" data-action="exclude">❌ Exclude</button>
      <button class="fbar-btn cov"  data-action="cover">⭐ Cover</button>
      <button class="fbar-btn"      data-action="null">⬜ Unset</button>
      <div class="fbar-sep"></div>
      <button class="fbar-btn" id="fbar-cancel">✕ Deselect</button>
    </div>
  \`;

  document.getElementById('btn-incl-all').onclick = () => bulkDay(day, 'include');
  document.getElementById('btn-excl-all').onclick = () => bulkDay(day, 'exclude');
  document.getElementById('btn-cov-all').onclick  = () => bulkDay(day, 'cover');
  document.getElementById('btn-clr-all').onclick  = () => bulkDay(day, null);
  document.getElementById('btn-reviewed').onclick = () => {
    ensureDay(day.date);
    const rev = app.selections[day.date].reviewed = !app.selections[day.date].reviewed;
    const btn = document.getElementById('btn-reviewed');
    btn.className = rev ? 'btn success' : 'btn primary';
    btn.textContent = rev ? '✓ Reviewed' : 'Mark Reviewed';
    scheduleSave(); renderSidebar(); scrollActiveIntoView();
  };
  document.querySelectorAll('.fbar-btn[data-action]').forEach(b =>
    b.addEventListener('click', () => applyToSelection(b.dataset.action === 'null' ? null : b.dataset.action)));
  document.getElementById('fbar-cancel').onclick = clearSelection;

  renderGrid(day);
  updateSelBar(day.date);
}

// ── Photo grid ────────────────────────────────────────────────────────────────
function renderGrid(day) {
  const grid = document.getElementById('photo-grid');
  if (!grid) return;

  // Build lightbox item list for this day
  app.lb.items = day.photos;

  grid.innerHTML = day.photos.map((p, i) => {
    const st  = getState(day.date, p.uuid);
    const sel = app.selected.has(p.uuid);
    const vid = p.kind === 1;
    const cls = ['photo-card', st, sel && 'selected'].filter(Boolean).join(' ');
    return \`<div class="\${cls}" data-uuid="\${p.uuid}" data-date="\${day.date}" data-idx="\${i}">
      <img data-src="/photo/\${day.date}/\${p.uuid}" alt="" decoding="async">
      <div class="hover-hint">\${vid ? '▶ dbl-click to play' : 'dbl-click to zoom'}</div>
      \${vid ? '<div class="video-badge">▶ video</div>' : ''}
      <div class="check-badge">✓</div>
      \${st ? \`<div class="state-badge">\${STATE_ICON[st]}</div>\` : ''}
      \${p.lat ? '<div class="gps-dot"></div>' : ''}
      <div class="time-tag">\${fmtTime(p.ts)}</div>
    </div>\`;
  }).join('');

  // IntersectionObserver lazy-loads images only as they scroll into view,
  // preventing hundreds of simultaneous requests on large days
  const imgObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
      obs.unobserve(img);
    });
  }, { rootMargin: '200px' });
  grid.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));

  grid.querySelectorAll('.photo-card').forEach(card => {
    const { uuid, date, idx } = card.dataset;

    card.addEventListener('click', e => {
      if (e.shiftKey) { toggleSelect(uuid); return; }

      // Timer distinguishes single vs double click
      if (clickTimers.has(uuid)) {
        clearTimeout(clickTimers.get(uuid));
        clickTimers.delete(uuid);
        openLightbox(parseInt(idx, 10));   // double-click → lightbox
      } else {
        clickTimers.set(uuid, setTimeout(() => {
          clickTimers.delete(uuid);
          cycleState(date, uuid);           // single-click → cycle state
        }, 220));
      }
    });
  });
}

function refreshGridStates(day) {
  document.querySelectorAll('.photo-card').forEach(card => {
    const { uuid } = card.dataset;
    const st  = getState(day.date, uuid);
    const sel = app.selected.has(uuid);
    card.className = ['photo-card', st, sel && 'selected'].filter(Boolean).join(' ');
    let badge = card.querySelector('.state-badge');
    if (st && !badge) {
      badge = document.createElement('div');
      badge.className = 'state-badge';
      card.appendChild(badge);
    }
    if (badge) { if (st) badge.textContent = STATE_ICON[st]; else badge.remove(); }
  });
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
const lb      = document.getElementById('lightbox');
const lbMedia = document.getElementById('lb-media');
const lbPrev  = document.getElementById('lb-prev');
const lbNext  = document.getElementById('lb-next');
const lbCap   = document.getElementById('lb-caption');
const lbCount = document.getElementById('lb-counter');
const lbLoad  = document.getElementById('lb-loading');

document.getElementById('lb-close').onclick = closeLightbox;
lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
lbPrev.onclick = () => showLightboxItem(app.lb.idx - 1);
lbNext.onclick = () => showLightboxItem(app.lb.idx + 1);
lbMedia.addEventListener('click', e => { if (e.target.tagName === 'IMG') lb.classList.toggle('zoomed'); });

function toggleZoom() { lb.classList.toggle('zoomed'); }

function openLightbox(idx) {
  app.lb.open = true;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
  showLightboxItem(idx);
}

function closeLightbox() {
  app.lb.open = false;
  lb.classList.remove('open');
  lb.classList.remove('zoomed');
  document.body.style.overflow = '';
  // Stop any playing video
  const vid = lbMedia.querySelector('video');
  if (vid) { vid.pause(); vid.src = ''; }
  lbMedia.innerHTML = '';
}

function showLightboxItem(idx) {
  const items = app.lb.items;
  if (!items.length) return;
  idx = Math.max(0, Math.min(idx, items.length - 1));
  app.lb.idx = idx;
  const p = items[idx];

  lbLoad.style.display = 'block';
  lbMedia.innerHTML = '';

  lbPrev.disabled = idx === 0;
  lbNext.disabled = idx === items.length - 1;
  lbCount.textContent = \`\${idx + 1} / \${items.length}\`;

  const time  = fmtTime(p.ts);
  const gps   = p.lat ? \`\${p.lat.toFixed(3)}°N \${Math.abs(p.lon).toFixed(3)}°W\` : '';
  const kind  = p.kind === 1 ? '▶ video' : '📷';
  lbCap.innerHTML = \`<span>\${kind}</span><span>\${time}</span>\${gps ? \`<span class="lb-loc">\${gps}</span>\` : ''}\`;

  if (p.kind === 1) {
    // Video — try inline player first
    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.src = \`/video/\${app.currentDate}/\${p.uuid}\`;
    video.onloadeddata = () => { lbLoad.style.display = 'none'; };
    video.onerror = () => {
      lbLoad.style.display = 'none';
      lbMedia.innerHTML = \`<div style="color:#888;font-size:14px;text-align:center;padding:40px">
        Video not available locally.<br><br>
        <button onclick="fetch('/api/openvideo/\${app.currentDate}/\${p.uuid}')"
          style="padding:8px 16px;border-radius:6px;border:1px solid #555;background:#333;color:#ddd;cursor:pointer;font-size:13px">
          Open in QuickTime
        </button>
      </div>\`;
    };
    lbMedia.appendChild(video);
  } else {
    // Photo — load full-res, fall back to derivative
    const img = document.createElement('img');
    img.onload = () => { lbLoad.style.display = 'none'; };
    img.onerror = () => {
      // Try derivative as fallback
      img.src = \`/photo/\${app.currentDate}/\${p.uuid}\`;
    };
    img.src = \`/fullres/\${app.currentDate}/\${p.uuid}\`;
    lbMedia.appendChild(img);
  }
}

// ── State management ──────────────────────────────────────────────────────────
function getState(date, uuid) { return app.selections[date]?.photos?.[uuid] ?? null; }
function ensureDay(date) {
  if (!app.selections[date]) app.selections[date] = { photos: {}, reviewed: false };
  if (!app.selections[date].photos) app.selections[date].photos = {};
}

function setPhotoState(date, uuid, newState) {
  ensureDay(date);
  if (newState === null) delete app.selections[date].photos[uuid];
  else app.selections[date].photos[uuid] = newState;
  const card = document.querySelector(\`.photo-card[data-uuid="\${uuid}"]\`);
  if (card) {
    const sel = app.selected.has(uuid);
    card.className = ['photo-card', newState, sel && 'selected'].filter(Boolean).join(' ');
    let badge = card.querySelector('.state-badge');
    if (newState && !badge) {
      badge = document.createElement('div'); badge.className = 'state-badge'; card.appendChild(badge);
    }
    if (badge) { if (newState) badge.textContent = STATE_ICON[newState]; else badge.remove(); }
  }
  updateSelBar(date);
  scheduleSave();
}

function cycleState(date, uuid) {
  const cur  = getState(date, uuid);
  const next = STATE_CYCLE[(STATE_CYCLE.indexOf(cur) + 1) % STATE_CYCLE.length];
  app.undoStack.push({ date, uuid, prev: cur });
  if (app.undoStack.length > 100) app.undoStack.shift();
  setPhotoState(date, uuid, next);
}

function bulkDay(day, state) {
  day.photos.forEach(p => setPhotoState(day.date, p.uuid, state));
  refreshGridStates(day);
  updateSelBar(day.date);
}

// ── Multi-select ──────────────────────────────────────────────────────────────
function toggleSelect(uuid) {
  if (app.selected.has(uuid)) app.selected.delete(uuid);
  else app.selected.add(uuid);
  const card = document.querySelector(\`.photo-card[data-uuid="\${uuid}"]\`);
  if (card) {
    const st = getState(app.currentDate, uuid);
    card.className = ['photo-card', st, app.selected.has(uuid) && 'selected'].filter(Boolean).join(' ');
  }
  updateFloatBar();
}

function clearSelection() {
  app.selected.clear();
  document.querySelectorAll('.photo-card.selected').forEach(c => c.classList.remove('selected'));
  updateFloatBar();
}

function applyToSelection(state) {
  app.selected.forEach(uuid => setPhotoState(app.currentDate, uuid, state));
  clearSelection();
}

function updateFloatBar() {
  const bar = document.getElementById('float-bar');
  if (!bar) return;
  const n = app.selected.size;
  bar.classList.toggle('visible', n > 0);
  if (n > 0) document.getElementById('float-count').textContent = \`\${n} selected\`;
}

// ── Counts bar ────────────────────────────────────────────────────────────────
function updateSelBar(date) {
  const photos = app.selections[date]?.photos || {};
  const c = { include: 0, exclude: 0, cover: 0 };
  for (const v of Object.values(photos)) if (v in c) c[v]++;
  const el = id => document.getElementById(id);
  if (el('cnt-inc'))  el('cnt-inc').textContent  = c.include;
  if (el('cnt-excl')) el('cnt-excl').textContent = c.exclude;
  if (el('cnt-cov'))  el('cnt-cov').textContent  = c.cover;
}

// ── Save ──────────────────────────────────────────────────────────────────────
let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => post('/api/selections', app.selections).catch(console.error), 400);
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
function onKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (app.lb.open) {
    if (e.key === 'Escape') {
      if (lb.classList.contains('zoomed')) lb.classList.remove('zoomed');
      else closeLightbox();
    } else if (e.key === 'ArrowLeft')  showLightboxItem(app.lb.idx - 1);
    else if (e.key === 'ArrowRight') showLightboxItem(app.lb.idx + 1);
    return;
  }

  const days = filteredDays();
  const idx  = days.findIndex(d => d.date === app.currentDate);
  if (e.key === 'ArrowLeft'  && idx > 0)            { e.preventDefault(); loadDay(days[idx-1].date); }
  if (e.key === 'ArrowRight' && idx < days.length-1){ e.preventDefault(); loadDay(days[idx+1].date); }
  if (e.key === 'Escape')   clearSelection();
  if (e.key === 'm' || e.key === 'M') document.getElementById('btn-reviewed')?.click();
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    const item = app.undoStack.pop();
    if (item) setPhotoState(item.date, item.uuid, item.prev);
  }
}

function fmtTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

boot();
</script>
</body>
</html>`;

// ── Server ────────────────────────────────────────────────────────────────────

function findPhoto(uuid, date) {
  const day = enriched.days.find(d => d.date === date);
  return day?.photos.find(p => p.uuid === uuid) ?? null;
}

// Thumbnail — tries derivatives in order of preference, then SVG placeholder
function serveThumbnail(uuid, date, res) {
  const photo = findPhoto(uuid, date);
  if (!photo) { res.writeHead(404); res.end('Not found'); return; }

  for (const [p, mime] of [
    [derivPath(photo),    'image/jpeg'],
    [deriv102Path(photo), 'image/jpeg'],
    [thmPath(photo),      'image/jpeg'],
  ]) {
    if (existsSync(p)) {
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public,max-age=3600' });
      createReadStream(p).pipe(res);
      return;
    }
  }
  const op = origPath(photo);
  if (existsSync(op)) {
    const mime = MIME[extname(photo.filename).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public,max-age=3600' });
    createReadStream(op).pipe(res);
    return;
  }
  // SVG placeholder — photo is iCloud-only, not downloaded locally
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="112" viewBox="0 0 150 112">
    <rect width="150" height="112" fill="#1a1a1a"/>
    <text x="75" y="46" text-anchor="middle" font-size="28" fill="#444">☁</text>
    <text x="75" y="68" text-anchor="middle" font-size="10" fill="#444" font-family="system-ui,sans-serif">iCloud</text>
  </svg>`;
  res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public,max-age=60' });
  res.end(svg);
}

// Full-resolution image (original → derivative fallback)
function serveFullRes(uuid, date, res) {
  const photo = findPhoto(uuid, date);
  if (!photo) { res.writeHead(404); res.end('Not found'); return; }

  const op = origPath(photo);
  if (existsSync(op)) {
    const mime = MIME[extname(photo.filename).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public,max-age=3600' });
    createReadStream(op).pipe(res);
    return;
  }
  // Fall back to derivative if original not downloaded
  serveThumbnail(uuid, date, res);
}

// Video file for inline playback
function serveVideo(uuid, date, res) {
  const photo = findPhoto(uuid, date);
  if (!photo) { res.writeHead(404); res.end('Not found'); return; }
  const op = origPath(photo);
  if (!existsSync(op)) { res.writeHead(404); res.end('Not downloaded from iCloud'); return; }
  const mime = MIME[extname(photo.filename).toLowerCase()] ?? 'video/quicktime';
  const stat  = statSync(op);
  const range = res.req?.headers?.range;
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : stat.size - 1;
    res.writeHead(206, {
      'Content-Type': mime,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
    });
    createReadStream(op, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size });
    createReadStream(op).pipe(res);
  }
}

function openInPlayer(uuid, date, res) {
  const photo = findPhoto(uuid, date);
  if (!photo) { res.writeHead(404); res.end('{}'); return; }
  const op = origPath(photo);
  if (!existsSync(op)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Not downloaded from iCloud' }));
    return;
  }
  exec(`open "${op}"`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end('{"ok":true}');
}

const server = createServer((req, res) => {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML); return;
  }

  if (path === '/api/days' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dayList)); return;
  }

  const dayMatch = path.match(/^\/api\/day\/(\d{4}-\d{2}-\d{2})$/);
  if (dayMatch && req.method === 'GET') {
    const day = enriched.days.find(d => d.date === dayMatch[1]);
    if (!day) { res.writeHead(404); res.end('{}'); return; }
    const out = { ...day, nebo: day.nebo ? { ...day.nebo, raw: undefined } : null };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out)); return;
  }

  if (path === '/api/selections' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(selections)); return;
  }

  if (path === '/api/selections' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try { selections = JSON.parse(body); saveSelections();
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      } catch { res.writeHead(400); res.end('Bad JSON'); }
    }); return;
  }

  // Thumbnail (derivative JPEG) — used by grid
  const photoMatch = path.match(/^\/photo\/(\d{4}-\d{2}-\d{2})\/([A-F0-9-]+)$/i);
  if (photoMatch) { serveThumbnail(photoMatch[2], photoMatch[1], res); return; }

  // Full-resolution — used by lightbox for photos
  const fullMatch = path.match(/^\/fullres\/(\d{4}-\d{2}-\d{2})\/([A-F0-9-]+)$/i);
  if (fullMatch) { serveFullRes(fullMatch[2], fullMatch[1], res); return; }

  // Video file — used by lightbox <video> element (supports range requests)
  const vidMatch = path.match(/^\/video\/(\d{4}-\d{2}-\d{2})\/([A-F0-9-]+)$/i);
  if (vidMatch) {
    const photo = findPhoto(vidMatch[2], vidMatch[1]);
    if (photo) { res.req = req; serveVideo(vidMatch[2], vidMatch[1], res); }
    else { res.writeHead(404); res.end('Not found'); }
    return;
  }

  // Open in system player
  const openMatch = path.match(/^\/api\/openvideo\/(\d{4}-\d{2}-\d{2})\/([A-F0-9-]+)$/i);
  if (openMatch) { openInPlayer(openMatch[2], openMatch[1], res); return; }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  const url    = `http://localhost:${PORT}`;
  const videos = dayList.reduce((n, d) => n + d.videoCount, 0);
  console.log(`\n── Jackie B III Photo Viewer ─────────────────────────`);
  console.log(`  URL:     ${url}`);
  console.log(`  Days:    ${dayList.length}  (${dayList.filter(d => d.hasNebo).length} with Nebo)`);
  console.log(`  Photos:  ${(enriched.stats.totalPhotos - videos).toLocaleString()}  Videos: ${videos.toLocaleString()}`);
  console.log(`  Single-click: cycle state`);
  console.log(`  Double-click: zoom photo / play video`);
  console.log(`  Shift+click: multi-select → float bar`);
  console.log(`  Ctrl+C to stop`);
  console.log(`─────────────────────────────────────────────────────\n`);
  exec(`open ${url}`);
});
