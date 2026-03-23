# Roadmap: JACKIE B III Going Loopy

**Project:** Great Loop Cruise Blog — Blogger migration to Astro
**Created:** 2026-03-23
**Granularity:** Standard (6 phases)
**Coverage:** 33/33 v1 requirements mapped

---

## Phases

- [ ] **Phase 1: Scaffolding** - Working Astro site on Netlify with multi-voyage content schema
- [ ] **Phase 2: Blogger Migration** - All existing posts in Astro as MDX with redirects and media components
- [ ] **Phase 3: Quality Lift** - All migrated posts reformatted to consistent, professional standard
- [ ] **Phase 4: Data Pipeline** - GPX/EXIF/email pipeline producing enriched frontmatter and draft stubs
- [ ] **Phase 5: Route Maps** - Interactive full-route map and per-post mini maps live on the site
- [ ] **Phase 6: New Post Generation** - All undocumented voyage stops have reviewed, published posts

---

## Phase Details

### Phase 1: Scaffolding

**Goal:** A working Astro 5.x project is deployed to Netlify with content collection schema, routing structure, and visual layout — blank of content but fully operational as infrastructure.

**Depends on:** Nothing (first phase)

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, SITE-01, SITE-03, SITE-04, SITE-05

**Estimated plans (4):**
1. Astro project initialization — `npm create astro@latest -- --template blog`, add MDX integration, configure `output: 'static'`, pin Node 20 LTS in `.nvmrc` and `netlify.toml`
2. Content collection schema — define `blog` and `voyages` Zod schemas with all frontmatter fields: title, date, voyage slug, location, lat/lon, anchorage/marina, cover photo, excerpt, migrated flag; validate schema compiles clean
3. Netlify deploy pipeline — connect git repository to Netlify, configure build command and publish directory, verify deploy preview on pull request, confirm HTTPS live URL
4. Base layout and pages — responsive layout component with consistent typography and heading hierarchy; stub pages for individual post (`/blog/[slug]/`), About, and voyage index (`/voyages/great-loop/`); site is public with no auth

**Success Criteria** (what must be TRUE when Phase 1 completes):
1. Running `npm run build` locally produces a static site with zero errors and zero schema validation warnings
2. A human visiting the Netlify live URL sees a styled, responsive homepage — no broken layouts on mobile or desktop
3. Navigating to `/blog/`, `/voyages/great-loop/`, and `/about/` returns real pages, not 404s
4. A dummy MDX post placed in `src/content/blog/great-loop/` with all required frontmatter fields passes Zod validation and renders at its URL with correct heading hierarchy
5. The multi-voyage architecture is visible in the routing — adding a second voyage directory under `src/content/blog/` would require no structural changes to the site

**Plans:** TBD

---

### Phase 2: Blogger Migration

**Goal:** Every published Blogger post exists in Astro as an MDX file with preserved metadata, working photo links, and Netlify 301 redirects covering all old Blogger URLs — the existing blog remains live throughout.

**Depends on:** Phase 1

**Requirements:** MIG-01, MIG-02, MIG-03, MIG-04, MIG-05, MEDIA-01, MEDIA-02, MEDIA-03

**Estimated plans (4):**
1. Blogger XML import script — write `scripts/import-blogger.mjs` using `fast-xml-parser` with `removeNSPrefix: true`; parse Atom export into MDX files; handle CDATA, namespace quirks, draft vs. published state; spot-check namespace handling against 5 real entries before full run
2. Metadata and slug preservation — extract publish date, post slug, labels/tags into frontmatter; set `migrated: true` flag on all imports; generate slugs that match original Blogger URL patterns for redirect accuracy
3. Netlify redirect generation — auto-generate 301 redirect rules mapping old `/YYYY/MM/slug.html` paths to new `/voyages/great-loop/YYYY-MM-DD-slug/` paths; output to `netlify.toml` fragment; verify redirect count matches post count
4. Media components — implement `Gallery.astro` component rendering cloud-hosted photo URLs as plain `<img loading="lazy" decoding="async">` (no Astro Image optimizer for remote URLs); implement `VideoEmbed.astro` for YouTube and cloud-hosted video; verify gallery is responsive and touch-friendly on mobile

**Success Criteria** (what must be TRUE when Phase 2 completes):
1. Every published Blogger post has a corresponding MDX file in `src/content/blog/great-loop/` — post count in Astro matches post count in the Blogger XML export
2. A human visiting any old Blogger URL (`/YYYY/MM/slug.html`) is redirected with 301 to the correct new Astro URL — verified for at least 10 representative posts spanning multiple years
3. Photos embedded in existing posts render visibly in the browser with no broken image icons — verified by spot-checking 10 posts with photos
4. The existing Blogger blog is still live and accessible — no DNS or domain changes have occurred
5. A post with embedded YouTube video renders the video embed correctly on the Astro site

**Plans:** TBD

---

### Phase 3: Quality Lift

**Goal:** All migrated posts are reformatted to a consistent professional standard — matching heading structure, grammar quality, and visual layout — with every post reviewed and approved by the human author before being marked complete.

**Depends on:** Phase 2

**Requirements:** QLFT-01, QLFT-02, QLFT-03, QLFT-04

**Estimated plans (3):**
1. Quality-lift script — write `scripts/quality-lift.mjs` using Claude API (claude-sonnet); apply structural formatting to batches of 10–20 posts at a time: insert H1 title, H2 section headings, normalize paragraph breaks, add image captions; idempotency check by Blogger post ID prevents re-processing reviewed posts; update frontmatter flag from `migrated: true` to `migrated: "lifted"` after AI pass
2. Human review workflow — diff-review each lifted post against the raw import; approve or correct AI output; clear flag to `migrated: false` (complete) only after human approval; track review progress in a simple checklist or status file
3. Consistent post layout — ensure every post (raw import and lifted) renders with the shared layout: intro summary paragraph, body sections, photo gallery block, voyage stats footer; audit for any posts missing required layout sections and fix manually

**Success Criteria** (what must be TRUE when Phase 3 completes):
1. Every migrated post has `migrated: false` in frontmatter — no post remains at `migrated: true` (raw) or `migrated: "lifted"` (AI-processed but unreviewed)
2. A human reading any 10 posts chosen at random finds consistent heading structure: one H1 title at top, H2 section headings throughout, no inline HTML heading tags left over from Blogger
3. The voyage stats footer (distance, date, anchorage/marina) appears on every post page — no posts are missing the footer block
4. A human reading the same 10 posts finds no obvious grammar errors, run-on formatting, or Blogger HTML artifacts (stray `<br>`, `<div>`, or `&amp;` entities) in the rendered output

**Plans:** TBD

---

### Phase 4: Data Pipeline

**Goal:** A set of local pipeline scripts processes Nebo GPX tracks, iPhone EXIF metadata, and voyage summary emails into enriched post frontmatter and draft MDX stubs for all undocumented voyage stops.

**Depends on:** Phase 2 (MDX files must exist before frontmatter enrichment can run)

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05

**Estimated plans (5):**
1. GPX parsing script — write `scripts/01-parse-gpx.mjs`; verify actual Nebo GPX export structure before coding (check for `<time>` on each `<trkpt>`, one-file-per-session vs. one-file-per-trip); convert GPX to GeoJSON using `@tmcw/togeojson`; simplify track with `@turf/simplify` to 5,000–15,000 points for browser performance; handle multi-track days by grouping sessions whose first timestamp falls on the same calendar date in local time
2. EXIF extraction script — write `scripts/02-extract-exif.mjs` using `exifr`; extract `DateTimeOriginal`, GPS coordinates, and filename from iPhone HEIC and JPEG files; output a structured index of all photos with timestamp and position; verify GPS coverage rate before designing correlation logic
3. Email parsing script — write `scripts/03-parse-emails.mjs`; inspect 2–3 actual Nebo summary emails to identify archive format (mbox, .eml, or forwarded text) and HTML table structure; use `mailparser` + `cheerio` to extract distance, hours, location, and narrative summary per voyage day
4. Timestamp correlation — write `scripts/04-correlate.mjs`; match photos to voyage days/stops using timezone-aware comparison (`tz-lookup` + `luxon`): resolve photo `DateTimeOriginal` to UTC using GPS coordinates, then match to GPX track timestamps; do not interpolate across GPS gaps longer than 10 minutes
5. Frontmatter enrichment and stub generation — write `scripts/05-generate-content.mjs` and `scripts/enrich-posts.mjs`; backfill `lat`/`lon`/`miles`/`hours` frontmatter on existing migrated posts without overwriting body content; generate MDX stubs (marked `draft: true`) for stops with GPS data but no Blogger post; stubs include auto-populated frontmatter, correlated photo list, voyage stats table, and Nebo email summary

**Success Criteria** (what must be TRUE when Phase 4 completes):
1. Running `scripts/01-parse-gpx.mjs` through `scripts/05-generate-content.mjs` in order completes without errors and produces output files in `.planning/data/` and `src/content/`
2. Every migrated Blogger post that has GPS data for its date has `lat`, `lon`, and `miles` populated in frontmatter — verified by spot-checking 10 posts against known trip dates
3. MDX stubs exist in `src/content/blog/great-loop/` for all voyage days that have GPX data but no Blogger post — stub count plus Blogger post count equals total documented voyage days
4. Each generated stub contains: valid frontmatter (all required fields), a photo list section with correlated photo URLs, a voyage stats table (distance, hours, average speed), and the Nebo email summary text or a clear placeholder if no email data exists
5. Photo-to-day correlation is timezone-aware — a human spot-check of 5 photos with known capture locations confirms they are assigned to the correct voyage day (not off by one day due to timezone errors)

**Plans:** TBD

---

### Phase 5: Route Maps

**Goal:** An interactive full-route map on the voyage index page and a per-post segment mini map on each individual post page are live, performant, and navigable on both desktop and mobile.

**Depends on:** Phase 1 (site must exist), Phase 4 (`lat`/`lon` frontmatter must be populated on posts)

**Requirements:** MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, SITE-02

**Estimated plans (4):**
1. GPX track simplification prebuild hook — write `scripts/simplify-gpx.mjs` as a Vite `prebuild` hook; output simplified GeoJSON track to `public/tracks/great-loop.json`; verify file size is under 500 KB; configure hook to run automatically before each `astro build`
2. VoyageMap component — write `src/components/VoyageMap.astro` using Leaflet loaded client-side via inline `<script>` block with `client:only` directive (never `client:load` — Leaflet requires `window`); fetch stop data from a separate JSON file (not inline `define:vars`) to avoid bloating HTML; draw GPX polyline on Stadia Maps base tiles with optional OpenSeaMap nautical overlay; verify Stadia Maps free tier URL format and OpenSeaMap tile URL before implementation
3. Clickable stop markers and popups — add stop markers for each post with `lat`/`lon` frontmatter; clicking a marker shows a popup with cover photo, post title, excerpt, and "Read more" link; use custom marker icons (avoid default Leaflet marker which breaks under Vite asset hashing); test popup sizing and touch behavior on mobile
4. PostMiniMap component and voyage index page — write `src/components/PostMiniMap.astro` using `define:vars` for small per-post data payload; show day's track segment and 1–3 stop markers; only render on individual post pages (never on list views — multiple Leaflet instances cause memory and tile-flood issues); build voyage index page (`/voyages/great-loop/`) listing all posts with the full VoyageMap above the list

**Success Criteria** (what must be TRUE when Phase 5 completes):
1. A human visiting `/voyages/great-loop/` sees a full-route interactive map with the complete Great Loop track drawn as a polyline and clickable stop markers for every post that has `lat`/`lon` frontmatter
2. Clicking a stop marker on the voyage index map shows a popup with a photo, the post title, a short excerpt, and a working "Read more" link to the full post
3. A human visiting any individual post page sees a mini map showing that day's track segment — the map does not appear on list or index pages
4. The voyage index map loads and is interactive on a mobile device (touch pan, pinch zoom, popup tap) with no visible layout overflow or map-container-height collapse
5. Running `npm run build` with the simplified GeoJSON track completes in under 60 seconds and produces a `public/tracks/great-loop.json` file under 500 KB

**Plans:** TBD

---

### Phase 6: New Post Generation

**Goal:** Every undocumented voyage stop has a human-reviewed, published post — completing the full Great Loop documentation — with narrative written or approved by the author and no `draft: true` posts remaining.

**Depends on:** Phase 4 (pipeline must have generated stubs), Phase 3 (quality standard established for comparison)

**Requirements:** POST-01, POST-02, POST-03, POST-04

**Estimated plans (3):**
1. Stub review and triage — review all `draft: true` stubs generated in Phase 4; categorize each by narrative priority: (a) compelling stops that deserve full narrative (locks, anchorages, notable weather, interesting towns), (b) transit days where the data table and photo gallery are sufficient, (c) stubs with insufficient data that need manual research; create a triage list before writing
2. Narrative completion — for priority-A stops, write personal narrative to accompany the auto-populated data; for priority-B stops, verify the voyage stats table and photo gallery are complete and sufficient; for priority-C stops, supplement with any available notes or mark the narrative section as intentionally sparse; all posts must read as authentic first-person journal entries — no AI-generated narrative published without rewrite
3. Final publication — clear `draft: true` flag from each completed post; verify post renders correctly with all components (mini map, photo gallery, voyage stats footer); confirm total published post count covers all Great Loop voyage days; run a final build to confirm zero errors

**Success Criteria** (what must be TRUE when Phase 6 completes):
1. Zero MDX files in `src/content/blog/great-loop/` have `draft: true` in frontmatter — every stub is either published or explicitly deferred with a documented reason
2. A human reading any post from the undocumented ~20% of the voyage finds a complete post: frontmatter, intro, at least one photo, voyage stats, and either a personal narrative or a clearly structured data-driven entry — no placeholder text like "TODO" or "STUB" visible in rendered output
3. The voyage index page (`/voyages/great-loop/`) lists posts covering the complete Great Loop — no date gaps longer than one day without a post or a documented reason for the gap
4. Running `npm run build` with all posts published completes with zero errors and the site is deployable to Netlify

**Plans:** TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffolding | 0/4 | Not started | - |
| 2. Blogger Migration | 0/4 | Not started | - |
| 3. Quality Lift | 0/3 | Not started | - |
| 4. Data Pipeline | 0/5 | Not started | - |
| 5. Route Maps | 0/4 | Not started | - |
| 6. New Post Generation | 0/3 | Not started | - |

---

## Coverage Summary

All 33 v1 requirements mapped. No orphans.

| Requirement | Description | Phase |
|-------------|-------------|-------|
| FOUND-01 | Astro project scaffolded with content collections (multi-voyage) | Phase 1 |
| FOUND-02 | Content collection frontmatter schema (all required fields) | Phase 1 |
| FOUND-03 | Site deployed to Netlify free tier from git | Phase 1 |
| FOUND-04 | Responsive layout, consistent typography, heading hierarchy | Phase 1 |
| MIG-01 | All Blogger posts extracted from XML and converted to MDX | Phase 2 |
| MIG-02 | Post metadata preserved: date, slug, labels/tags | Phase 2 |
| MIG-03 | Photo URLs from existing posts preserved and rendering | Phase 2 |
| MIG-04 | Netlify 301 redirects generated for all old Blogger URLs | Phase 2 |
| MIG-05 | Existing blog remains live during migration (no DNS changes) | Phase 2 |
| MEDIA-01 | Per-post photo galleries from cloud-hosted URLs (lazy loading, no Astro Image) | Phase 2 |
| MEDIA-02 | Video embeds supported (cloud-hosted or YouTube) | Phase 2 |
| MEDIA-03 | Gallery layout responsive and touch-friendly on mobile | Phase 2 |
| QLFT-01 | All migrated posts reformatted to consistent heading structure | Phase 3 |
| QLFT-02 | Grammar and prose normalized across all migrated posts | Phase 3 |
| QLFT-03 | Consistent post layout: intro, body, gallery, voyage stats footer | Phase 3 |
| QLFT-04 | `migrated` frontmatter flag tracks raw / lifted / complete state | Phase 3 |
| DATA-01 | Nebo GPX tracks parsed and converted to GeoJSON (simplified) | Phase 4 |
| DATA-02 | iPhone/iPad EXIF metadata extracted (timestamp + GPS) | Phase 4 |
| DATA-03 | Photos correlated to voyage days/stops by timestamp (timezone-aware) | Phase 4 |
| DATA-04 | Nebo voyage summary emails parsed for narrative context | Phase 4 |
| DATA-05 | Frontmatter enriched with lat/lon/miles for all posts with GPS data | Phase 4 |
| MAP-01 | Full Great Loop interactive route map on voyage index (Leaflet, Stadia tiles) | Phase 5 |
| MAP-02 | GPX track drawn as polyline on full route map | Phase 5 |
| MAP-03 | Clickable stop markers — popup shows photo + excerpt + link | Phase 5 |
| MAP-04 | Per-post mini map showing that day's route segment | Phase 5 |
| MAP-05 | Map components use `client:only`, stop data passed as props | Phase 5 |
| SITE-01 | Public site, no login or authentication | Phase 1 |
| SITE-02 | Voyage index page listing all posts with map | Phase 5 |
| SITE-03 | Individual post pages with consistent layout | Phase 1 |
| SITE-04 | About page (Jackie B III, crew, Great Loop) | Phase 1 |
| SITE-05 | Architecture supports adding future voyages without restructuring | Phase 1 |
| POST-01 | MDX stubs generated for all undocumented stops | Phase 6 |
| POST-02 | Each stub includes frontmatter, photo gallery, voyage stats, Nebo summary | Phase 6 |
| POST-03 | All generated posts reviewed and narrative-completed by human author | Phase 6 |
| POST-04 | Full Great Loop documented — every stop has a published post | Phase 6 |

**v1 requirements:** 33 total
**Mapped to phases:** 33
**Unmapped:** 0

---

## Dependency Graph

```
Phase 1: Scaffolding
    |
    v
Phase 2: Blogger Migration
    |
    +------> Phase 3: Quality Lift (can run in parallel with Phase 4)
    |
    v
Phase 4: Data Pipeline
    |
    +------> Phase 5: Route Maps (can start once Phase 4 produces lat/lon)
    |
    v
Phase 6: New Post Generation (requires Phase 4 stubs + Phase 3 quality standard)
```

**Parallelization opportunities:**
- Phase 3 (Quality Lift) and Phase 4 (Data Pipeline) can run in parallel after Phase 2 completes
- Phase 5 (Route Maps) can begin once Phase 4 produces enriched frontmatter, even if Phase 6 is not started

---

## Key Risks and Flags

| Risk | Phase | Severity | Mitigation |
|------|-------|----------|------------|
| Nebo GPX export format unknown | Phase 4 | High | Inspect actual .gpx file before writing `01-parse-gpx.mjs` |
| Nebo email archive format unknown | Phase 4 | High | Inspect 2–3 actual emails before writing `03-parse-emails.mjs` |
| Blogger XML namespace handling | Phase 2 | Medium | Spot-check 5 real entries with `fast-xml-parser` before full run |
| Blogger photo URL stability | Phase 2 | Medium | Manually test 5–10 `lh3.googleusercontent.com` URLs before committing to link-through strategy |
| Stadia Maps / OpenSeaMap tile URLs | Phase 5 | Medium | Verify current free tier URL format before implementation |
| AI quality lift altering facts | Phase 3 | Medium | Human review required for every post before clearing `migrated` flag |
| GPX track size in browser | Phase 5 | Medium | Simplify to 5k–15k points at build time; verify output file under 500 KB |
| Photo count and EXIF GPS coverage rate | Phase 4 | Low-Medium | Check coverage rate early in Phase 4 script 02 before designing correlation logic |

---

*Roadmap created: 2026-03-23*
*Last updated: 2026-03-23 after initial creation*
