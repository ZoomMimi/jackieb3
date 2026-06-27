#!/usr/bin/env node
/**
 * scripts/blog-viewer.mjs
 *
 * Browse every photo and video published on the Blogger blog.
 * Fetches posts from the Blogger Atom JSON API and serves a viewer.
 *
 *   node scripts/blog-viewer.mjs            → http://localhost:3001
 *   node scripts/blog-viewer.mjs --port 3002
 *   node scripts/blog-viewer.mjs --refresh   force re-fetch (ignores cache)
 *
 * Images load directly from the Blogger CDN — no local files needed.
 */

import { createServer }                           from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname }                          from 'node:path';
import { fileURLToPath }                          from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const DATA_DIR    = join(__dirname, '..', '.planning', 'data');
const CACHE_PATH  = join(DATA_DIR, 'blog-image-urls.json');

const portIdx  = process.argv.indexOf('--port');
const PORT     = portIdx !== -1 ? parseInt(process.argv[portIdx + 1], 10) : 3001;
const REFRESH  = process.argv.includes('--refresh');

const BLOG_URL = 'https://jackiebiiigoingloopy.blogspot.com';
const FEED_BASE = `${BLOG_URL}/feeds/posts/default?alt=json&max-results=25`;

// Prefer href (full-size original); fall back to img src (display-size)
const IMG_HREF_RE = /href="(https?:\/\/blogger\.googleusercontent\.com[^"]+)"/gi;
const IMG_SRC_RE  = /src="(https?:\/\/blogger\.googleusercontent\.com[^"]+)"/gi;
// Blogger video — token appears in single or double quoted src attributes
const VIDEO_RE    = /['"](https?:\/\/www\.blogger\.com\/video\.g\?token=[^'"&\s]+)['"]/g;

// ── Fetch all blog posts ──────────────────────────────────────────────────────

async function fetchAllPosts() {
  const posts = [];
  let startIndex = 1;

  while (true) {
    const url = `${FEED_BASE}&start-index=${startIndex}&orderby=published`;
    process.stdout.write(`  Fetching posts ${startIndex}–${startIndex + 24}…\r`);
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`Feed returned ${res.status}`);
    const feed = await res.json();
    const entries = feed.feed?.entry ?? [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const title     = entry.title?.$t ?? '(untitled)';
      const published = (entry.published?.$t ?? '').slice(0, 10);
      const postUrl   = entry.link?.find(l => l.rel === 'alternate')?.href ?? '';
      const html      = entry.content?.$t ?? '';

      const images  = [];
      const videos  = [];
      const seen    = new Set();

      let m;
      // href attrs have full-size originals; src attrs have display-size versions
      for (const re of [IMG_HREF_RE, IMG_SRC_RE]) {
        re.lastIndex = 0;
        while ((m = re.exec(html)) !== null) {
          // Normalize size: replace /wNNN-hNNN/ or /sNNN/ with /s1600/
          const url = m[1].replace(/\/[whs]\d+(-[whs]\d+)?\//i, '/s1600/').split('"')[0];
          if (!seen.has(url)) { seen.add(url); images.push(url); }
        }
      }

      const videoSeen = new Set();
      VIDEO_RE.lastIndex = 0;
      while ((m = VIDEO_RE.exec(html)) !== null) {
        const embedUrl = m[1];
        if (!videoSeen.has(embedUrl)) { videoSeen.add(embedUrl); videos.push({ embedUrl }); }
      }

      posts.push({ date: published, title, postUrl, images, videos });
    }

    if (entries.length < 25) break;
    startIndex += 25;
  }

  posts.sort((a, b) => a.date.localeCompare(b.date));
  return posts;
}

// ── Load or fetch posts ───────────────────────────────────────────────────────

let posts;

if (!REFRESH && existsSync(CACHE_PATH)) {
  console.log('Loading cached blog image URLs…');
  const cached = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  posts = cached.posts;
  console.log(`  ${posts.length} posts from cache (run with --refresh to re-fetch)`);
} else {
  console.log('Fetching blog posts from Blogger…');
  posts = await fetchAllPosts();
  writeFileSync(CACHE_PATH, JSON.stringify({ generated: new Date().toISOString(), posts }, null, 2));
  console.log(`\n  ${posts.length} posts fetched and cached`);
}

const totalImages = posts.reduce((n, p) => n + p.images.length, 0);
const totalVideos = posts.reduce((n, p) => n + p.videos.length, 0);

// ── HTML ──────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jackie B III — Blog Photos</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:#111; --surface:#1c1c1c; --surface2:#232323; --border:#2e2e2e;
  --text:#e0e0e0; --muted:#777; --accent:#4a9eff;
  --sidebar-w:280px;
}
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--text); display:flex; height:100vh; overflow:hidden; }

/* sidebar */
#sidebar { width:var(--sidebar-w); min-width:var(--sidebar-w); border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface); overflow:hidden; }
#sidebar-top { padding:10px 12px; border-bottom:1px solid var(--border); }
#sidebar-top h2 { font-size:13px; font-weight:600; margin-bottom:2px; }
#sidebar-top .sub { font-size:11px; color:var(--muted); }
#search-wrap { padding:8px 12px; border-bottom:1px solid var(--border); }
#search { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:5px 8px; color:var(--text); font-size:12px; outline:none; }
#search:focus { border-color:var(--accent); }
#post-list { flex:1; overflow-y:auto; }
.post-row { padding:9px 12px; cursor:pointer; border-left:3px solid transparent; border-bottom:1px solid var(--border); }
.post-row:hover { background:var(--surface2); }
.post-row.active { background:var(--surface2); border-left-color:var(--accent); }
.post-date { font-size:11px; color:var(--muted); font-variant-numeric:tabular-nums; }
.post-title { font-size:12px; margin-top:2px; line-height:1.3; }
.post-counts { font-size:10px; color:var(--muted); margin-top:3px; }

/* main */
#main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
#post-header { padding:12px 20px; border-bottom:1px solid var(--border); background:var(--surface); flex-shrink:0; }
#post-header h1 { font-size:16px; font-weight:700; }
#post-header .meta { font-size:12px; color:var(--muted); margin-top:3px; }
#post-header a { color:var(--accent); text-decoration:none; font-size:11px; }
#post-header a:hover { text-decoration:underline; }
#photo-grid { flex:1; overflow-y:auto; padding:16px; display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:8px; align-content:start; }
.photo-card { position:relative; aspect-ratio:1; overflow:hidden; border-radius:6px; background:var(--surface2); cursor:pointer; }
.photo-card img { width:100%; height:100%; object-fit:cover; display:block; }
.photo-card img.error { opacity:0.3; }
.photo-card:hover img { opacity:0.85; }
.video-card { position:relative; aspect-ratio:1; overflow:hidden; border-radius:6px; background:#1a1a2e; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; border:1px solid #2a2a4a; transition:border-color .15s; }
.video-card:hover { border-color:#4a4aaa; }
.video-card .play-icon { font-size:40px; }
.video-card .vid-label { font-size:11px; color:var(--muted); }
.video-card .vid-num { font-size:10px; color:#555; }

/* video modal */
#vid-modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,.92); z-index:200; align-items:center; justify-content:center; flex-direction:column; gap:12px; }
#vid-modal.open { display:flex; }
#vid-frame { width:min(854px,90vw); height:min(480px,60vh); border:none; border-radius:6px; background:#000; }
#vid-modal-footer { display:flex; gap:16px; align-items:center; }
#vid-modal a { color:var(--accent); font-size:12px; text-decoration:none; }
#vid-modal a:hover { text-decoration:underline; }
#vid-close-btn { background:rgba(255,255,255,.1); border:none; color:#aaa; font-size:13px; padding:5px 14px; border-radius:14px; cursor:pointer; }
#vid-close-btn:hover { background:rgba(255,255,255,.2); }
.img-num { position:absolute; bottom:5px; right:6px; font-size:10px; background:rgba(0,0,0,.6); color:#ddd; padding:1px 5px; border-radius:3px; pointer-events:none; }
#empty { padding:40px; color:var(--muted); font-size:13px; text-align:center; }

/* lightbox */
#lightbox { display:none; position:fixed; inset:0; background:rgba(0,0,0,.92); z-index:100; align-items:center; justify-content:center; }
#lightbox.open { display:flex; }
#lb-media { max-width:92vw; max-height:82vh; display:flex; align-items:center; justify-content:center; }
#lb-media img { max-width:92vw; max-height:82vh; object-fit:contain; border-radius:4px; cursor:zoom-in; }
#lightbox.zoomed #lb-media img { max-width:100vw; max-height:100vh; border-radius:0; cursor:zoom-out; }
#lightbox.zoomed #lb-prev, #lightbox.zoomed #lb-next,
#lightbox.zoomed #lb-caption, #lightbox.zoomed #lb-counter,
#lightbox.zoomed #lb-close { opacity:0; pointer-events:none; }
#lb-prev, #lb-next, #lb-caption, #lb-counter, #lb-close { transition:opacity .15s; }
#lb-close { position:fixed; top:16px; right:20px; font-size:22px; cursor:pointer; color:#aaa; background:none; border:none; }
#lb-prev, #lb-next { position:fixed; top:50%; transform:translateY(-50%); font-size:28px; cursor:pointer; color:#aaa; background:rgba(0,0,0,.4); border:none; padding:12px 14px; border-radius:6px; }
#lb-prev { left:12px; } #lb-next { right:12px; }
#lb-counter { position:fixed; top:18px; left:50%; transform:translateX(-50%); font-size:12px; color:#aaa; }
#lb-caption { position:fixed; bottom:16px; left:50%; transform:translateX(-50%); font-size:12px; color:#ccc; background:rgba(0,0,0,.6); padding:4px 12px; border-radius:12px; max-width:80vw; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* scroll */
::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#333; border-radius:3px; }
</style>
</head>
<body>

<div id="sidebar">
  <div id="sidebar-top">
    <h2>Blog Photos &amp; Videos</h2>
    <div class="sub" id="stat-line">Loading…</div>
  </div>
  <div id="search-wrap">
    <input id="search" type="search" placeholder="Filter posts…" autocomplete="off">
  </div>
  <div id="post-list"></div>
</div>

<div id="main">
  <div id="post-header">
    <h1 id="ph-title">Select a post</h1>
    <div class="meta" id="ph-meta"></div>
    <a id="ph-link" href="#" target="_blank" style="display:none"></a>
  </div>
  <div id="photo-grid"></div>
</div>

<div id="vid-modal">
  <iframe id="vid-frame" allowfullscreen></iframe>
  <div id="vid-modal-footer">
    <button id="vid-close-btn">✕ Close</button>
    <a id="vid-open-link" href="#" target="_blank">Open in new tab ↗</a>
  </div>
</div>

<div id="lightbox">
  <button id="lb-close">✕</button>
  <button id="lb-prev">‹</button>
  <div id="lb-media"></div>
  <button id="lb-next">›</button>
  <div id="lb-counter"></div>
  <div id="lb-caption"></div>
</div>

<script>
const POSTS = ${JSON.stringify(posts)};

// ── State ─────────────────────────────────────────────────────────────────────
const app = { currentIdx: -1, currentPost: null, lbItems: [], lbIdx: 0, lbOpen: false };

// ── Init ──────────────────────────────────────────────────────────────────────
const totalImg = POSTS.reduce((n,p) => n + p.images.length, 0);
const totalVid = POSTS.reduce((n,p) => n + p.videos.length, 0);
document.getElementById('stat-line').textContent =
  POSTS.length + ' posts · ' + totalImg + ' photos · ' + totalVid + ' videos';

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar(filter) {
  const q = (filter || '').toLowerCase();
  const list = document.getElementById('post-list');
  const visible = POSTS.filter(p =>
    !q || p.title.toLowerCase().includes(q) || p.date.includes(q)
  );

  list.innerHTML = visible.map(p => {
    const idx = POSTS.indexOf(p);
    return \`<div class="post-row" data-idx="\${idx}">
      <div class="post-date">\${p.date}</div>
      <div class="post-title">\${p.title}</div>
      <div class="post-counts">\${p.images.length} photo\${p.images.length !== 1 ? 's' : ''}\${p.videos.length ? ' · ' + p.videos.length + ' video' + (p.videos.length !== 1 ? 's' : '') : ''}</div>
    </div>\`;
  }).join('');

  list.querySelectorAll('.post-row').forEach(row =>
    row.addEventListener('click', () => loadPost(parseInt(row.dataset.idx)))
  );

  // Restore active
  if (app.currentIdx >= 0) {
    list.querySelector(\`[data-idx="\${app.currentIdx}"]\`)?.classList.add('active');
  }
}

document.getElementById('search').addEventListener('input', e => renderSidebar(e.target.value));

// ── Post view ─────────────────────────────────────────────────────────────────
function loadPost(idx) {
  const post = POSTS[idx];
  if (!post) return;
  app.currentIdx  = idx;
  app.currentPost = post;

  // sidebar highlight
  document.querySelectorAll('.post-row').forEach(r => r.classList.remove('active'));
  const activeRow = document.querySelector(\`[data-idx="\${idx}"]\`);
  activeRow?.classList.add('active');
  activeRow?.scrollIntoView({ block: 'nearest' });

  // header
  document.getElementById('ph-title').textContent = post.title;
  const cnt = [
    post.images.length > 0 && post.images.length + ' photo' + (post.images.length !== 1 ? 's' : ''),
    post.videos.length > 0 && post.videos.length + ' video' + (post.videos.length !== 1 ? 's' : ''),
  ].filter(Boolean).join(' · ');
  document.getElementById('ph-meta').textContent = post.date + (cnt ? ' · ' + cnt : '');
  const link = document.getElementById('ph-link');
  if (post.postUrl) {
    link.href = post.postUrl;
    link.textContent = 'View original post ↗';
    link.style.display = 'inline';
  } else {
    link.style.display = 'none';
  }

  // Build lightbox items (images only)
  app.lbItems = post.images.map((url, i) => ({ url, label: post.title + ' (' + (i+1) + '/' + post.images.length + ')' }));

  // Grid
  const grid = document.getElementById('photo-grid');
  if (post.images.length === 0 && post.videos.length === 0) {
    grid.innerHTML = '<div id="empty">No media in this post.</div>';
    return;
  }

  grid.innerHTML = [
    ...post.images.map((url, i) => \`
      <div class="photo-card" data-idx="\${i}">
        <img src="\${url}" loading="lazy" onerror="this.classList.add('error')">
        <div class="img-num">\${i + 1}</div>
      </div>
    \`),
    ...post.videos.map((v, i) => \`
      <div class="video-card" data-embed="\${v.embedUrl}">
        <div class="play-icon">▶️</div>
        <div class="vid-label">Video \${i + 1} of \${post.videos.length}</div>
        <div class="vid-num">click to play</div>
      </div>
    \`),
  ].join('');

  grid.querySelectorAll('.photo-card').forEach(card =>
    card.addEventListener('click', () => openLightbox(parseInt(card.dataset.idx)))
  );
  grid.querySelectorAll('.video-card').forEach(card =>
    card.addEventListener('click', () => openVideo(card.dataset.embed))
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
const lb       = document.getElementById('lightbox');
const lbMedia  = document.getElementById('lb-media');
const lbPrev   = document.getElementById('lb-prev');
const lbNext   = document.getElementById('lb-next');
const lbClose  = document.getElementById('lb-close');
const lbCounter = document.getElementById('lb-counter');
const lbCaption = document.getElementById('lb-caption');

function openLightbox(idx) {
  app.lbOpen = true;
  app.lbIdx  = idx;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
  showLbItem();
}

function showLbItem() {
  const item = app.lbItems[app.lbIdx];
  if (!item) return;
  lbMedia.innerHTML = \`<img src="\${item.url}" alt="">\`;
  lbMedia.querySelector('img').addEventListener('click', () => lb.classList.toggle('zoomed'));
  lbCounter.textContent = (app.lbIdx + 1) + ' / ' + app.lbItems.length;
  lbCaption.textContent = item.label;
  lbPrev.style.display = app.lbItems.length > 1 ? '' : 'none';
  lbNext.style.display = app.lbItems.length > 1 ? '' : 'none';
}

function closeLightbox() {
  app.lbOpen = false;
  lb.classList.remove('open', 'zoomed');
  document.body.style.overflow = '';
}

lbClose.onclick = closeLightbox;
lbPrev.onclick  = () => { lb.classList.remove('zoomed'); app.lbIdx = (app.lbIdx - 1 + app.lbItems.length) % app.lbItems.length; showLbItem(); };
lbNext.onclick  = () => { lb.classList.remove('zoomed'); app.lbIdx = (app.lbIdx + 1) % app.lbItems.length; showLbItem(); };

lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

document.addEventListener('keydown', e => {
  if (!app.lbOpen) return;
  if (e.key === 'Escape')     { if (lb.classList.contains('zoomed')) lb.classList.remove('zoomed'); else closeLightbox(); }
  if (e.key === 'ArrowLeft')  { lb.classList.remove('zoomed'); app.lbIdx = (app.lbIdx - 1 + app.lbItems.length) % app.lbItems.length; showLbItem(); }
  if (e.key === 'ArrowRight') { lb.classList.remove('zoomed'); app.lbIdx = (app.lbIdx + 1) % app.lbItems.length; showLbItem(); }
});

// ── Video modal ───────────────────────────────────────────────────────────────
const vidModal   = document.getElementById('vid-modal');
const vidFrame   = document.getElementById('vid-frame');
const vidOpenLink = document.getElementById('vid-open-link');
const vidCloseBtn = document.getElementById('vid-close-btn');

function openVideo(embedUrl) {
  vidFrame.src = embedUrl;
  vidOpenLink.href = embedUrl;
  vidModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeVideo() {
  vidModal.classList.remove('open');
  vidFrame.src = '';
  document.body.style.overflow = '';
}

vidCloseBtn.onclick = closeVideo;
vidModal.addEventListener('click', e => { if (e.target === vidModal) closeVideo(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && vidModal.classList.contains('open')) closeVideo();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
renderSidebar();
if (POSTS.length > 0) loadPost(0);
</script>
</body>
</html>`;

// ── Server ────────────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log(`\n── Jackie B III Blog Viewer ${'─'.repeat(30)}`);
  console.log(`  URL:     http://localhost:${PORT}`);
  console.log(`  Posts:   ${posts.length}`);
  console.log(`  Images:  ${totalImages}`);
  console.log(`  Videos:  ${totalVideos} (Blogger-hosted)`);
  console.log(`  Cache:   .planning/data/blog-image-urls.json`);
  console.log(`  Ctrl+C to stop`);
  console.log('─'.repeat(47));
});
