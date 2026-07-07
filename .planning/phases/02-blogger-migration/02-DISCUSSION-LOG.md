# Phase 2: Blogger Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 02-blogger-migration
**Areas discussed:** Import method, HTML content fidelity, Photo placement in MDX, Blogger video handling

---

## Import Method

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Atom API | Evolve blog-viewer.mjs into the importer — no XML needed | |
| Download Blogger XML | Export XML from Blogger admin, parse with fast-xml-parser | |
| Both — API for speed, XML as backup | Use Atom API as primary source; XML for coverage validation | ✓ |

**User's choice:** Both — Atom API primary, XML export for validation  
**Notes:** User didn't know if XML export already exists on disk. Plan should check and note download location (Blogger admin → Settings → Manage blog → Back up content) if absent.

---

### Import Method — XML status

| Option | Description | Selected |
|--------|-------------|----------|
| Need to download it | XML not yet exported | |
| Already have it | XML is on disk | |
| Don't know | Unknown | ✓ |

**User's choice:** Don't know  
**Notes:** Plan will check for an XML file in the project; if absent, include a note on how to obtain it.

---

## HTML Content Fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve raw HTML | Keep Blogger HTML intact in MDX body; Phase 3 cleans up | ✓ |
| Light structural cleanup | Strip inline styles and Blogger divs during import | |
| Prose-only extraction | Strip all HTML tags, keep only text | |

**User's choice:** Preserve raw HTML (Recommended)  
**Notes:** Raw fidelity preferred — migrated: true flags it for Phase 3. No data loss risk.

---

### HTML Fidelity — MDX-breaking tag sanitization

| Option | Description | Selected |
|--------|-------------|----------|
| Sanitize MDX-breaking tags only | Strip unclosed tags, scripts, Blogger-specific components | ✓ |
| Keep everything verbatim | Fix MDX errors case-by-case at build time | |

**User's choice:** Sanitize MDX-breaking tags only  
**Notes:** Minimal sanitization for MDX compilability, but don't touch prose or image tags.

---

## Photo Placement in MDX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in HTML body | Leave photos where Blogger placed them as img tags | ✓ |
| Extract to frontmatter images array | Pull all URLs to frontmatter, render via Gallery.astro at end | |
| Both — frontmatter list + keep inline | Redundant but gives downstream agents the URL list | |

**User's choice:** Inline in HTML body (Recommended)  
**Notes:** Preserve original Blogger inline photo positions. Phase 3 will restructure as needed.

---

### Photo Placement — Cover photo

| Option | Description | Selected |
|--------|-------------|----------|
| First image in post (auto-pick) | Import script picks first URL as coverPhoto | |
| Leave coverPhoto empty, fill in Phase 3 | Barbara selects cover during quality lift | ✓ |
| Use photo-selections.json where available | Use manual curation, fall back to first image | |

**User's choice:** Leave coverPhoto empty, fill in during Phase 3  
**Notes:** More intentional — Barbara picks the right photo per post during review.

---

## Blogger Video Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Only in Blogger | Videos stored only in Blogger hosting | |
| Also on YouTube | Each video has a YouTube counterpart | |
| Mix / don't know | Some on YouTube, others Blogger-only | ✓ |

**User's choice:** Mix / don't know  
**Notes:** 32 posts have Blogger-native video tokens. Whether each has a YouTube version is unknown.

---

### Video Handling — What to do with blogger.com/video.g tokens

| Option | Description | Selected |
|--------|-------------|----------|
| Stub as HTML comments | Replace iframes with <!-- video: [token] --> | ✓ |
| Embed as-is | Keep Blogger iframe src; may or may not work outside Blogger | |
| Preserve iframe + flag in frontmatter | Keep iframe in body AND add hasVideo: true | |

**User's choice:** Stub as HTML comments (Recommended)  
**Notes:** Comment format: `<!-- video: https://www.blogger.com/video.g?token=XXX -->` — consistent for Phase 3 grep.

---

### Video Handling — VideoEmbed.astro scope

| Option | Description | Selected |
|--------|-------------|----------|
| YouTube only | VideoEmbed.astro accepts YouTube URL, renders responsive iframe | ✓ |
| Both YouTube + Blogger tokens | Handle both embed formats in the component | |

**User's choice:** YouTube only (Recommended)  
**Notes:** Phase 2 VideoEmbed.astro = YouTube URL → responsive 16:9 iframe. Blogger tokens deferred.

---

## Claude's Discretion

- Slug normalization logic (special characters, duplicate dates)
- Netlify redirect format (`[[redirects]]` in netlify.toml vs. `_redirects` file)
- MDX-breaking-tag list (which specific tags to sanitize beyond the obvious)
- Astro content collection ID / filename conventions

## Deferred Ideas

- Video migration (finding YouTube URLs for Blogger-hosted videos) — Phase 3 human task
- Cover photo selection — Phase 3 quality lift
- Photo gallery restructuring (extracting inline images to Gallery component) — Phase 3
- `migrated` flag lifecycle beyond `true` — Phase 3 context
