# Project Research Summary

**Project:** Jackie B III Going Loopy — Great Loop Cruise Blog
**Domain:** Static travel blog with interactive route maps, content migration, and data pipeline
**Researched:** 2026-03-23
**Confidence:** MEDIUM — all findings from training data (knowledge cutoff August 2025); no live documentation verified. Flag each integration point before implementation.

---

## Executive Summary

This is a static travel blog migrating roughly 80 published posts from Blogger to Astro, with the goal of adding interactive route maps, structured GPS/photo data per post, and generating stubs for the ~20% of voyage days that never got posts. The project is well-scoped for a fully static Astro + Netlify deployment with zero ongoing hosting cost. Experts build this class of site with Astro content collections (MDX + Zod schema validation), Leaflet for maps (no API key, no cost, adequate for a completed 2D route), and a pre-build data pipeline that processes raw GPX/EXIF/email data into committed content files that Astro reads at build time. This is not an app — it is a document with interactive embeds, and the architecture should reflect that simplicity.

The highest-risk decision is the Blogger photo URL strategy. The ~hundreds of `lh3.googleusercontent.com` photo URLs embedded in imported posts are empirically stable but not officially guaranteed. The recommended approach is to migrate with link-through in Phase 2 (no re-hosting) and treat re-hosting as a deferred risk-mitigation task. The second major risk area is the data pipeline: key details about Nebo Gold's actual GPX export structure, the exact format of voyage summary emails, and total photo count are unknowns that must be verified against real data before the pipeline scripts can be finalized. Everything else is well-trodden ground.

The phase order is driven by hard dependencies: the site must exist (scaffolding) before content can live in it; the Blogger content must be migrated before quality lifting makes sense; GPS/EXIF enrichment depends on understanding the actual Nebo export format; and maps can only be built once posts have `lat`/`lon` frontmatter. Quality lifting and new post generation are independent workstreams that run in parallel after migration completes.

---

## Key Findings

### Recommended Stack

Start from `npm create astro@latest -- --template blog` (the official blog starter), add MDX support, and add Leaflet. Do not start from a community theme — travel-specific layouts (leg-by-leg navigation, route maps, per-stop gallery) will fight against any pre-existing theme opinions. The site is pure static (`output: 'static'`), so no Netlify adapter is needed. Node 20 LTS is the Astro 5.x minimum requirement.

**Core technologies:**
- **Astro 5.x + MDX**: Static site generator — SSG mode, content collections with Zod schema validation, zero JS by default except where islands opt in
- **Netlify free tier**: Hosting + CI/CD — static output fits free tier limits; deploy previews on every PR; project constraint
- **Leaflet.js 1.9.x**: Interactive route map — free, no API key, adequate for a completed 2D nautical route with ~100 clickable stops; ~40 KB gzipped vs. 600 KB+ for MapLibre/Mapbox
- **Zod**: Frontmatter schema validation — ships with Astro; catches missing fields at build time
- **Plain `<img loading="lazy">`**: All cloud-hosted photos — do NOT use Astro's `<Image>` component for remote URLs (fetches every image at build time, slow and fragile for 80+ posts)
- **Stadia Maps tiles**: Base map — clean coastal rendering, generous free tier, no API key for low-traffic personal sites
- **OpenSeaMap overlay**: Nautical overlay on top of base tiles — shows buoys, channels; adds boating character at higher zoom levels

**Supporting libraries (data pipeline — run locally, not at build time):**
- `@tmcw/togeojson` + `@xmldom/xmldom`: GPX → GeoJSON conversion
- `exifr`: EXIF/GPS extraction from iPhone HEIC and JPEG photos
- `mailparser` + `cheerio`: Parse Nebo voyage summary emails
- `gray-matter`: Read/write MDX frontmatter in pipeline scripts
- `luxon` + `tz-lookup`: Timezone-aware timestamp correlation
- `xml2js` or `fast-xml-parser`: Parse Blogger XML export
- `turndown`: HTML-to-Markdown conversion for Blogger post bodies
- `@turf/simplify`: GPX track simplification for performance

**See:** `.planning/research/STACK.md` and `.planning/research/MAPS.md` for full library details.

---

### Architecture Approach

The architecture has two distinct runtime contexts that must stay separate: (1) a pre-build data pipeline running locally in Node.js to process raw Nebo GPX files, iPhone EXIF data, and voyage emails into committed content files, and (2) the Astro build which reads only those committed content files and produces static HTML. The pipeline is never wired into `astro build` — it is a set of standalone scripts run manually when new data arrives. Generated MDX stubs require human review before publishing.

**Major components:**

1. **Content Collections** (`src/content/`) — Schema-validated MDX posts in `blog/great-loop/` subdirectory, plus a `voyages/` collection for voyage-level metadata. The `voyage` field on each post is a string slug (not a reference) enabling `getCollection` filtering per voyage. `lat`/`lon`/`leg` fields on each post feed the route map without a separate data file.

2. **Data Pipeline** (`scripts/`) — Five numbered scripts: `01-parse-gpx.mjs`, `02-extract-exif.mjs`, `03-parse-emails.mjs`, `04-correlate.mjs`, `05-generate-content.mjs`. Outputs to `.planning/data/` (intermediate) and `src/content/` (final). A separate `import-blogger.mjs` handles the one-time Blogger XML migration.

3. **VoyageMap Component** (`src/components/VoyageMap.astro`) — Full-trip interactive map. Uses an inline `<script>` block (not a React/Svelte island) with Leaflet loaded client-side. Stop data fetched as a separate JSON file (not inline via `define:vars`) to avoid bloating page HTML. Uses `client:only` pattern — never `client:load`, which would crash on Leaflet's `window` reference during Astro's server render.

4. **PostMiniMap Component** (`src/components/PostMiniMap.astro`) — Per-post segment map showing the day's track and 1-3 stop markers. `define:vars` is fine here (small data payload). Only used on individual post pages, never on list views (multiple Leaflet instances on one page causes memory/tile-flood issues).

5. **Quality-Lift Pipeline** (`scripts/quality-lift.mjs`) — Claude API script that applies structural formatting to migrated posts (heading insertion, paragraph breaks, image captions). Uses `migrated: true` / `migrated: "lifted"` / `migrated: false` frontmatter flag to track review state. Output requires human review before the flag is cleared.

6. **Netlify Redirect Rules** — Auto-generated from the Blogger migration script. Maps old `/YYYY/MM/slug.html` paths to new `/voyages/great-loop/YYYY-MM-DD-slug` paths. Generated into `netlify.toml` (or a fragment to be merged).

**Route structure:**
```
/                            → homepage
/blog/                       → all posts paginated
/blog/[slug]/                → individual post
/voyages/great-loop/         → voyage overview + map
/voyages/great-loop/map/     → full-screen route map
/voyages/great-loop/stops/   → leg-by-leg index
```

**See:** `.planning/research/STACK.md` for schema code, `.planning/research/MAPS.md` for map architecture, `.planning/research/DATA-PIPELINE.md` for pipeline architecture.

---

### Critical Pitfalls

1. **Leaflet crashes during Astro's server render** — Leaflet requires `window` and `document`, which do not exist in Node.js. Using `client:load` renders the component on the server first, causing a build crash. Use `client:only` (skips server render entirely) for all Leaflet components. For plain Astro components with an inline `<script>` block, the script runs only in the browser — also safe.

2. **Astro `<Image>` with remote URLs is slow and fragile** — Astro's `<Image>` component fetches and optimizes remote URLs at build time. For a blog with hundreds of `lh3.googleusercontent.com` photos, this fetches every image on every build — slow, rate-limited, and fragile. Use plain `<img loading="lazy" decoding="async">` for all cloud-hosted photos. This is not a regression; it is the correct pattern.

3. **EXIF timezone gotcha in GPS correlation** — `DateTimeOriginal` in iPhone EXIF is local time with no UTC offset. GPX timestamps from Nebo are UTC. On a trip traversing EDT, CDT, and CST, naively comparing these timestamps produces position errors of ~1 hour (= several nautical miles). Always resolve timezone from the photo's own GPS coordinates first (`tz-lookup` + `luxon`), then compare to UTC track times.

4. **Blogger XML namespace handling** — The Blogger Atom export uses multiple XML namespaces (`app:`, `blogger:`, `gd:`). With `xml2js`, fields like `app:draft` come through with the colon in the key name. With `fast-xml-parser` + `removeNSPrefix: true`, they are stripped. Failing to handle namespaces correctly causes silent missing-data bugs in the migration parser. Test against the real export file before writing the full parser.

5. **Nebo exports one GPX per voyage session, not per calendar day** — If the engine was started, stopped, then started again on the same day, Nebo creates multiple GPX tracks. Grouping by "day" requires grouping all tracks whose first timestamp falls on the same calendar date (in local time at that location), not by track count. Also: Nebo records GPS only while a voyage is "active" — anchor time and marina stays produce gaps. Do not interpolate across gaps longer than 10 minutes.

6. **GPX track size for a 6,000-mile route** — At typical recording intervals, a full Great Loop GPX could contain 50,000–300,000+ trackpoints (12–24 MB raw XML). Loading this in the browser as a Leaflet polyline will lag on mobile. Simplify at build time using `@turf/simplify` via a `prebuild` script. A 300k-point track can be reduced to 5,000–15,000 points with no visible route-shape loss at overview zoom levels.

7. **AI quality lift must be human-reviewed** — Claude's quality-lift script applies structural changes (headings, paragraph breaks, captions) to migrated posts. AI models can subtly alter facts, place names, or voice in travel journals. Never mark a post as `migrated: false` (complete) without human review of the diff. The `migrated: "lifted"` intermediate flag enforces this gate.

**See:** `.planning/research/MAPS.md` section 12 and `.planning/research/DATA-PIPELINE.md` section 12 for full pitfall inventories.

---

## Implications for Roadmap

### Phase 1: Scaffolding
**Rationale:** Nothing else can start without a working Astro project. This is the unblocking dependency for all other phases.
**Delivers:** Working Astro 5.x project on Netlify with content collections schema, routing structure, and deploy pipeline. Blank site with no content — but it builds and deploys.
**Key tasks:** `npm create astro@latest -- --template blog`, add MDX, define content collection schema (`blog` + `voyages` collections with full Zod schema), configure `netlify.toml`, set Node version, verify Netlify deploy preview works.
**Avoids:** Starting from a community theme that constrains travel-specific layouts.
**Research flag:** Standard patterns — skip `research-phase`. This is well-documented Astro setup.

### Phase 2: Blogger Migration
**Rationale:** Gets all existing content into the new system before anything else touches it. Establishes the baseline the quality-lift and GPS-enrichment phases will iterate on.
**Delivers:** All ~80 published Blogger posts as MDX files in `src/content/blog/great-loop/`, with `migrated: true` flag, photo URLs preserved as-is (link-through, no re-hosting), and Netlify 301 redirect rules for all old Blogger URLs.
**Key tasks:** Download Blogger XML export, write `scripts/import-blogger.mjs` (XML parse → MDX files), test namespace handling against real export, generate `netlify.toml` redirect fragment, verify 5–10 posts render correctly on the Astro site.
**Avoids:** Re-hosting photos in this phase (deferred risk), double-decoding CDATA content, losing post slugs needed for redirects.
**Research flag:** Verify namespace handling against real export before writing the full parser. The `fast-xml-parser` + `removeNSPrefix: true` approach is recommended but must be validated against the actual file.

### Phase 3: Data Pipeline
**Rationale:** The GPS/EXIF pipeline enriches posts with `lat`/`lon`/`miles`/`hours` frontmatter — data that the route map depends on. Must happen before the map phase. Also generates stubs for the ~20% missing voyage days.
**Delivers:** Five numbered pipeline scripts, enriched frontmatter on all migrated posts, stub MDX files for missing days (marked `draft: true` pending human narrative), and `.planning/data/` intermediate files (GPX summaries, EXIF index, email summaries).
**Key tasks:** Verify actual Nebo GPX export structure (see Open Questions), write and run `01-parse-gpx.mjs` through `05-generate-content.mjs` in order, handle timezone correlation for photo-to-track matching, build `enrich-posts.mjs` to backfill `lat`/`lon` on existing Blogger posts without overwriting body content.
**Avoids:** Running pipeline scripts inside `astro build`, assuming GPS data is continuous, ignoring multi-track days.
**Research flag:** NEEDS real data validation before scripts can be finalized. Nebo export format, email archive format, and photo timezone behavior are all unknowns.

### Phase 4: Quality Lift
**Rationale:** Can run in parallel with Phase 3 once posts exist. Independent workstream — does not block maps. Improves post consistency before the site goes public.
**Delivers:** All migrated posts reformatted with consistent headings, proper paragraph breaks, image captions, and voice-preserving structural cleanup. Each post reviewed by a human and marked `migrated: false` (complete).
**Key tasks:** Write `scripts/quality-lift.mjs` using Claude API, run on batches of 10–20 posts at a time, review diffs and mark approved posts complete. Cost is negligible (~$0.50–$1.50 for 100 posts at claude-sonnet pricing).
**Avoids:** Bulk-approving AI output without review, hallucinated facts in travel narrative, overwriting already-reviewed posts on re-run (idempotency check by `bloggerPostId`).
**Research flag:** Standard patterns — skip `research-phase`. The Claude API integration is documented and the approach is straightforward.

### Phase 5: Route Maps
**Rationale:** Depends on Phase 3 (posts need `lat`/`lon` frontmatter) and Phase 1 (site must exist). Leaflet integration and GPX simplification scripts can be built in parallel with Phase 4.
**Delivers:** Full-trip `VoyageMap` component on the voyage overview page, per-post `PostMiniMap` on individual post pages, simplified GeoJSON track files in `/public/tracks/`, and OpenSeaMap nautical overlay (optional toggle).
**Key tasks:** Write `scripts/simplify-gpx.mjs` as a `prebuild` hook, write `VoyageMap.astro` with Leaflet via inline `<script>` and `client:only` pattern, write `PostMiniMap.astro` for per-post segment maps, style popups (photo + name + excerpt + "Read more" link), test on mobile (explicit height, touch behavior, popup sizing).
**Avoids:** Using `client:load` instead of `client:only` (server-render crash), loading the full GPX in the browser (performance), initializing multiple Leaflet instances on list pages (memory/tile flood), using default Leaflet marker icons (broken images in Vite bundles).
**Research flag:** Verify Stadia Maps free tier URL format and OpenSeaMap tile URL before implementation.

### Phase 6: New Post Generation
**Rationale:** Depends on Phase 3 (pipeline must be working) and Phase 4 (quality standards established for comparison). Filling in missing voyage days is lower priority than getting the existing 80 posts right.
**Delivers:** Human-reviewed narrative stubs for all voyage days that have GPS data but no Blogger post. Each stub has the data table (distance, hours, speed) and a placeholder for personal narrative — enough to be useful, clearly marked as incomplete where narrative is missing.
**Key tasks:** Review all `draft: true` stubs generated in Phase 3, add narrative to those with compelling GPS stories (locks, anchorages, unusual weather), finalize frontmatter, clear `draft: true` flag to publish.
**Avoids:** Publishing AI-generated content as-if it were personal journal entries.
**Research flag:** Standard process — skip `research-phase`.

---

### Phase Ordering Rationale

- Phase 1 (scaffolding) must come first — everything else depends on a working Astro project.
- Phase 2 (migration) comes before Phase 3 (pipeline) because the pipeline's `enrich-posts.mjs` enriches already-existing MDX files. If migration happens after pipeline, enrichment must re-run.
- Phase 3 (data pipeline) must come before Phase 5 (maps) because `lat`/`lon` frontmatter on posts is the map data source.
- Phase 4 (quality lift) is independent once posts exist — it can run in parallel with Phase 3 and Phase 5. Recommend starting it after Phase 2 lands but not blocking Phase 3 on it.
- Phase 5 (maps) and Phase 6 (new posts) are both "nice to have" vs. Phases 1–4 which are required for the site to be functional.

---

### Research Flags

**Needs deeper research / real-data validation:**
- **Phase 3 (Data Pipeline):** Nebo Gold export format must be verified against the actual `.gpx` file before writing the parser. Key unknowns: does the export include `<time>` elements on each `<trkpt>`? Does the iOS app export one file per voyage or one file per trip? What is the CSV column naming convention? Email archive format (mbox vs. individual .eml files vs. HTML) must be identified before choosing a parser.
- **Phase 2 (Migration):** The Blogger XML namespace handling strategy (`fast-xml-parser` + `removeNSPrefix`) should be tested against the real export file before building the full migration script. A 10-minute spot-check against 5 actual entries avoids an entire rewrite.

**Standard patterns — skip research-phase:**
- **Phase 1 (Scaffolding):** Astro + Netlify static deploy is a well-documented, stable pattern.
- **Phase 4 (Quality Lift):** Claude API integration is documented and the pattern is straightforward.
- **Phase 5 (Maps):** Leaflet + Astro inline script is a standard, documented approach. Main implementation risks are CSS (map height) and data size (GPX simplification), both well-understood.
- **Phase 6 (New Posts):** Content review process, no technical research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Astro + Netlify stack | HIGH | Stable, well-documented, used on related reunion-website project |
| Content collection schema design | HIGH | Standard Astro pattern since 2.x; Zod validation is built-in |
| Leaflet + Astro integration | HIGH | `client:only` + inline script is the canonical pattern; documented |
| Blogger XML format | HIGH | Atom 1.0 standard; unchanged for 15+ years |
| HTML-to-Markdown (Turndown) | HIGH | De facto standard for this conversion path |
| GPX parsing (`@tmcw/togeojson`) | HIGH | De facto standard for GPX→GeoJSON in Node.js |
| EXIF extraction (`exifr`) | HIGH | Modern standard; handles HEIC natively |
| Astro 5.x Content Layer API specifics | MEDIUM | API changed between 4.x and 5.x; verify current docs |
| Blogger photo URL stability | MEDIUM | Empirically stable 10+ years but not officially guaranteed |
| Nebo GPX export specifics | MEDIUM | Based on community reports; must verify against actual export |
| Email archive format | LOW | Unknown until the actual archive is inspected |
| Photo count and EXIF coverage rate | LOW | Unknown; affects pipeline complexity significantly |
| Stadia Maps free tier limits | MEDIUM | Verified as of August 2025; confirm current pricing |
| OpenSeaMap tile URL | MEDIUM | Volunteer-run service; verify availability before implementation |

**Overall confidence:** MEDIUM

---

### Gaps to Address

These unknowns cannot be resolved from research alone. They require inspecting the actual data before the corresponding phase begins:

- **Nebo GPX export format:** Does Nebo Gold export one GPX file per voyage session or one file per trip? Are `<time>` elements present on each `<trkpt>`? Verify by opening the actual export in a text editor before writing `01-parse-gpx.mjs`. Expected answer: yes, per-session, with timestamps — but confirm.

- **Nebo email archive format:** Are the voyage summary emails available as `.mbox` (Gmail Takeout export), individual `.eml` files, or only as forwarded text? This determines which parser to use and how much cleaning is needed before structured data can be extracted. Inspect 2–3 actual emails before writing `03-parse-emails.mjs`.

- **Nebo email body HTML structure:** The exact table structure and field label names in Nebo's summary emails are unknown. Need to inspect actual emails to write the `cheerio` selectors. Plan for 30 minutes of inspection before the parser.

- **Photo count and EXIF coverage:** How many photos are in the archive? What fraction have GPS coordinates vs. just timestamps? This affects the complexity of the photo-to-track correlation step. If GPS coverage is near 100% (typical for iPhone photos with Location Services on), correlation is simple. If many photos lack GPS, the timezone inference path becomes more important.

- **Google CDN URL stability validation:** Before committing to the link-through strategy for Blogger photos, manually test 5–10 `lh3.googleusercontent.com` URLs from existing posts to confirm they still serve. This takes 5 minutes and prevents a bad assumption from propagating through the migration.

---

## Sources

### Primary (HIGH confidence — stable documented APIs)
- Astro content collections: https://docs.astro.build/en/guides/content-collections/
- Astro images guide: https://docs.astro.build/en/guides/images/
- Astro deploy to Netlify: https://docs.astro.build/en/guides/deploy/netlify/
- Astro client directives (client:only): https://docs.astro.build/en/reference/directives-reference/#clientonly
- Leaflet.js getting started: https://leafletjs.com/examples/quick-start/
- `leaflet-gpx` plugin: https://github.com/mpetazzoni/leaflet-gpx
- `@tmcw/togeojson`: https://github.com/tmcw/togeojson
- `exifr`: https://github.com/MikeKovarik/exifr
- `mailparser`: https://nodemailer.com/extras/mailparser/
- `turndown`: https://github.com/mixmark-io/turndown
- `gray-matter`: https://github.com/jonschlinkert/gray-matter
- Netlify redirects: https://docs.netlify.com/routing/redirects/
- GPX 1.1 schema: https://www.topografix.com/GPX/1/1/gpx.xsd

### Secondary (MEDIUM confidence — verify before use)
- Stadia Maps pricing/free tier: https://stadiamaps.com/pricing
- OpenSeaMap tile service: https://openseamap.org
- `tz-lookup`: https://github.com/photostructure/tz-lookup
- `@turf/simplify`: https://turfjs.org/docs/api/simplify
- Astro 5.x Content Layer API: https://docs.astro.build/en/reference/content-loader-reference/

### Tertiary (LOW confidence — need real data)
- Nebo Gold export format documentation: https://neboat.com/help/ (verify GPX and email format)
- Blogger XML namespace behavior: validate against actual `blog-export.xml` before implementation

---

*Research completed: 2026-03-23*
*Ready for roadmap: yes*
