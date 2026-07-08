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

**Goal:** A working Astro 7.x project is deployed to Netlify with content collection schema, routing structure, and visual layout — blank of content but fully operational as infrastructure.

**Depends on:** Nothing (first phase)

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, SITE-01, SITE-03, SITE-04, SITE-05

**Plans:** 2/3 plans executed

Plans:
- [x] 01-01-PLAN.md — Astro 7 init + Tailwind 4 + Google Fonts + multi-voyage content schema (FOUND-01, FOUND-02)
- [x] 01-02-PLAN.md — Base layout, nav/footer, homepage/about/voyage-index/post-route/404 + dummy validation post (FOUND-04, SITE-01, SITE-03, SITE-04, SITE-05)
- [ ] 01-03-PLAN.md — Netlify deploy pipeline: netlify.toml + connect git + verify live HTTPS URL (FOUND-03, SITE-01)

**Success Criteria** (what must be TRUE when Phase 1 completes):
1. Running `npm run build` locally produces a static site with zero errors and zero schema validation warnings
2. A human visiting the Netlify live URL sees a styled, responsive homepage — no broken layouts on mobile or desktop
3. Navigating to `/blog/`, `/voyages/great-loop/`, and `/about/` returns real pages, not 404s
4. A dummy MDX post placed in `src/content/blog/great-loop/` with all required frontmatter fields passes Zod validation and renders at its URL with correct heading hierarchy
5. The multi-voyage architecture is visible in the routing — adding a second voyage directory under `src/content/blog/` would require no structural changes to the site

---

### Phase 2: Blogger Migration

**Goal:** Every published Blogger post exists in Astro as an MDX file with preserved metadata, working photo links, and Netlify 301 redirects covering all old Blogger URLs — the existing blog remains live throughout.

**Depends on:** Phase 1

**Requirements:** MIG-01, MIG-02, MIG-03, MIG-04, MIG-05, MEDIA-01, MEDIA-02, MEDIA-03

**Plans:** 2/3 plans executed

**Success Criteria** (what must be TRUE when Phase 2 completes):
1. Every published Blogger post has a corresponding MDX file in `src/content/blog/great-loop/` — post count in Astro matches post count in the Blogger XML export
2. A human visiting any old Blogger URL (`/YYYY/MM/slug.html`) is redirected with 301 to the correct new Astro URL — verified for at least 10 representative posts spanning multiple years
3. Photos embedded in existing posts render visibly in the browser with no broken image icons — verified by spot-checking 10 posts with photos
4. The existing Blogger blog is still live and accessible — no DNS or domain changes have occurred
5. A post with embedded YouTube video renders the video embed correctly on the Astro site

Plans:

**Wave 1**
- [x] 02-01-PLAN.md — Import script + MDX generation + redirects (MIG-01, MIG-02, MIG-03, MIG-04, MIG-05)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Gallery.astro + VideoEmbed.astro media components (MEDIA-01, MEDIA-02, MEDIA-03)

**Wave 3** *(blocked on Wave 1 + Wave 2 completion)*
- [ ] 02-03-PLAN.md — Verification + deploy + redirect spot-check (MIG-04, MIG-05)

**Cross-cutting constraints:**
- `npm run build` must exit 0 after every wave before proceeding
- Blogger blog at jackiebiiigoingloopy.blogspot.com must remain live throughout (MIG-05)

---

### Phase 3: Quality Lift

**Goal:** All migrated posts are reformatted to a consistent professional standard — with early posts (Days 1–111) enhanced using correlated iCloud photos and Nebo GPS data to match the richer style of later posts — with every post reviewed and approved by the human author before being marked complete.

**Depends on:** Phase 2, Phase 4 (photo index + GPS data must exist to drive enhancement)

**Requirements:** QLFT-01, QLFT-02, QLFT-03, QLFT-04, QLFT-05

**Estimated plans (4):**
1. Quality-lift script — write `scripts/quality-lift.mjs` using Claude API (claude-sonnet-4-6); apply structural formatting to batches of 10–20 posts: insert H1 title, H2 section headings, normalize paragraph breaks; idempotency check by Blogger post ID prevents re-processing reviewed posts; update frontmatter flag from `migrated: true` to `migrated: "lifted"` after AI pass
2. Photo injection for early posts — for all posts Days 1–111 (April–August 2022), cross-reference correlated photo index from Phase 4; inject photo gallery entries into MDX frontmatter; use photo GPS + timestamp to confirm location accuracy; add captions derived from photo EXIF place data
3. Narrative enhancement — for early posts with thin prose (<400 words), use Claude API with Nebo GPS waypoints, photo metadata, and writing style samples from later posts to draft expanded narrative; preserve Barbara's voice (first-person, conversational, closing Bible verse); human review mandatory before flag clears
4. Human review workflow — diff-review each lifted post against raw import; approve or correct AI output; clear flag to `migrated: false` (complete) only after human approval; track review progress in a simple checklist

**Success Criteria** (what must be TRUE when Phase 3 completes):
1. Every migrated post has `migrated: false` in frontmatter — no post remains at `migrated: true` (raw) or `migrated: "lifted"` (AI-processed but unreviewed)
2. A human reading any early post (Days 1–111) finds photo count and narrative length comparable to later posts — no post under 400 words or with fewer than 4 photos where photo data exists
3. The voyage stats footer (distance, date, anchorage/marina) appears on every post page — no posts are missing the footer block
4. A human reading any 10 posts finds no obvious grammar errors, run-on formatting, or Blogger HTML artifacts (stray `<br>`, `<div>`, or `&amp;` entities) in the rendered output
5. Barbara has reviewed and approved every enhanced post before it is marked complete

**Plans:** TBD

---

### Phase 4: Data Pipeline

**Goal:** A set of local pipeline scripts ingests the iCloud photo library (via osxphotos) and Nebo GPX tracks + PDF voyage summaries into a unified voyage timeline — producing enriched post frontmatter and draft MDX stubs for all undocumented stops, including the complete last segment (Days 259 → New Bern NC, May 2024).

**Depends on:** Phase 2 (MDX files must exist before frontmatter enrichment can run)

**Data sources:**
- iCloud Photos library on Mac — extracted via `osxphotos` (GPS + timestamp on every photo)
- Nebo GPX tracks — exported per-trip from Nebo app (Settings → Trips → Export GPX)
- Nebo PDF voyage summaries — auto-emailed at end of each trip and monthly; parse from email archive
- Nebo in-app trip log — daily stats viewable in app; screencap or manual export as backup

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07

**Estimated plans (5):**
1. Photo index script — install `osxphotos` (`pip install osxphotos`); run `osxphotos query --json --exiftool > .planning/data/photo-index.json` against the local iCloud library (Photos app must have "Download Originals to this Mac" enabled or use `--download-missing`); extract `DateTimeOriginal`, GPS lat/lon, filename, and album for every photo; output structured index; report GPS coverage rate
2. GPX parsing script — write `scripts/01-parse-gpx.mjs`; inspect actual Nebo GPX export for `<time>` on each `<trkpt>` and session structure; convert to GeoJSON via `@tmcw/togeojson`; simplify with `@turf/simplify` to 5,000–15,000 points; group multi-session days by calendar date in local time; output per-day track segments to `.planning/data/tracks/`
3. Nebo PDF parsing script — write `scripts/03-parse-nebo-pdf.mjs`; inspect 2–3 actual Nebo PDF summaries for table structure (distance, hours, speed, location); use `pdf-parse` + manual field mapping to extract daily stats; output `.planning/data/nebo-logs.json`
4. Timestamp correlation — write `scripts/04-correlate.mjs`; match photos to voyage days using timezone-aware `DateTimeOriginal` → UTC via GPS coordinates (`tz-lookup` + `luxon`); match to GPX track timestamps; cluster by day and stop; do not interpolate across GPS gaps >10 minutes; output `.planning/data/voyage-timeline.json` with every day, its photos, GPS track segment, and Nebo stats
5. Frontmatter enrichment and stub generation — write `scripts/05-generate-content.mjs`; backfill `lat`/`lon`/`miles`/`hours` on existing migrated posts; generate `draft: true` MDX stubs for all days with GPS/photo data but no Blogger post — including the full last segment (Days 259 → New Bern, ~May 2024); each stub gets frontmatter, correlated photo list, voyage stats table, and Nebo PDF summary block

**Success Criteria** (what must be TRUE when Phase 4 completes):
1. `photo-index.json` exists with GPS + timestamp for every iCloud photo in the voyage date range; GPS coverage rate is documented
2. Per-day GeoJSON track segments exist in `.planning/data/tracks/` for all days with Nebo GPX data — including Days 259 through final return
3. Every migrated Blogger post has `lat`, `lon`, and `miles` in frontmatter where GPS data exists — verified by spot-checking 10 posts
4. MDX stubs exist for all undocumented days that have GPS or photo data — stub count plus Blogger post count covers the complete voyage from Day 1 to return to New Bern
5. Photo-to-day correlation is timezone-aware — spot-check of 5 photos with known locations confirms correct day assignment

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

**Goal:** Every undocumented voyage stop has a human-reviewed, published post — completing the full Great Loop documentation through the return to New Bern NC (May 2024) — with narrative written or approved by Barbara and no `draft: true` posts remaining.

**Scope:** Two distinct bodies of work:
- **Last segment** (Days 259 → New Bern, ~Feb–May 2024): Florida Keys → FL east coast ICW → Georgia → South Carolina → North Carolina → New Bern. Fully driven by iCloud photos + Nebo GPS. ~60–90 days of voyage.
- **Undocumented middle** (Days 112–124, Sep 2022 – Oct 2023): Great Lakes → Chicago → Illinois River → upper Mississippi. Likely sparse photo/GPS coverage; treat as best-effort with what data exists.

**Depends on:** Phase 4 (stubs + photo clusters + Nebo data), Phase 3 (quality standard and voice established)

**Requirements:** POST-01, POST-02, POST-03, POST-04, POST-05

**Estimated plans (4):**
1. Stub triage — review all `draft: true` stubs from Phase 4; categorize: (a) compelling stops meriting full narrative (locks, anchorages, notable weather, interesting towns, visitor days), (b) transit days where stats table + photo gallery suffice, (c) sparse-data days needing manual memory or note; create triage list ordered by last-segment priority first
2. AI-assisted draft generation — for priority-A stubs, use Claude API (claude-sonnet-4-6) with: correlated photos, Nebo GPS waypoints + stats, style samples from Barbara's best later posts, and a system prompt capturing her voice (first-person, conversational, specific details, closing Bible verse); output draft narrative alongside existing data block in MDX
3. Barbara review and narrative completion — for each draft, Barbara edits in place: correct any facts, add personal memory and texture, adjust voice; for priority-B transit stubs, verify stats + photos are complete and sufficient; for priority-C sparse stubs, add whatever notes are available; no AI narrative published unreviewed
4. Final publication — clear `draft: true` from each completed post; verify rendering with mini map, photo gallery, voyage stats footer; confirm voyage index covers Day 1 through final return to New Bern with no unexplained gaps; final build zero errors

**Success Criteria** (what must be TRUE when Phase 6 completes):
1. Zero MDX files have `draft: true` — every stub is either published or explicitly deferred with a documented reason
2. The voyage index covers Day 1 (New Bern departure, April 2022) through return to New Bern (May 2024) — no date gaps longer than one day without a post or documented reason
3. Every last-segment post (Days 259+) reads as an authentic first-person journal entry with photos, voyage stats, and Barbara's voice — no AI artifact text visible
4. Running `npm run build` with all posts completes with zero errors and the site is deployable to Netlify

**Plans:** TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffolding | 2/3 | In Progress|  |
| 2. Blogger Migration | 2/3 | In Progress|  |
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
