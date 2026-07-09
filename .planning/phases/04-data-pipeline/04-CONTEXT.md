# Phase 4: Data Pipeline - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Write `scripts/04-generate-stubs.mjs` that reads the already-built enriched timeline
(`voyage-timeline-enriched.json`) and produces:

1. **Frontmatter backfill** — adds `miles`/`hours` to 45 existing MDX posts that have
   matching Nebo log data; edits files in-place.
2. **Stub generation** — creates `draft: true` MDX files for undocumented days meeting
   the threshold, with full Gallery + VoyageStats components populated from real data.

All upstream pipeline scripts (00–03) are already working. This phase is the final
output stage: translating pipeline data into site content.

</domain>

<decisions>
## Implementation Decisions

### Stub Threshold
- **D-01:** A day qualifies for a stub if it has **10 or more photos** in the enriched
  timeline. This yields ~253 stubs, filtering out low-value stay-in-port days.
- **D-02:** No minimum Nebo data requirement — photo count alone drives qualification.
  Days with Nebo data but <10 photos are skipped.
- **D-03:** **Date range:** April 1, 2022 through May 17, 2024 (full range including
  pre-departure New Bern days). Some pre-departure days have 10+ photos worth capturing.

### Frontmatter Backfill
- **D-04:** Edit existing MDX files **in-place** to add `miles` and `hours` to
  frontmatter. Same approach the quality-lift script used (`03-quality-lift.mjs`).
- **D-05:** For the 45 posts with matching Nebo data: backfill `miles` (from
  `distanceNm`) and `hours` (from `underwayHours`).
- **D-06:** For the 27 posts with **no Nebo data**: leave `miles`/`hours` absent from
  frontmatter entirely. VoyageStats handles missing values gracefully — don't set to 0.
- **D-07:** Matching is by date string (ISO `YYYY-MM-DD`). The Nebo log already has
  `date` fields from the OCR pipeline — use those directly.
- **D-08:** The 4 posts still missing `lat`/`lon` should also be backfilled if the
  enriched timeline has centroid data for that date.

### Stub Content
- **D-09:** Stubs use **full component structure** — same as existing posts:
  - Frontmatter with `draft: true`, `lat`, `lon`, `miles`, `hours`, `location`, `title`
  - `import VoyageStats` + `import Gallery`
  - `<VoyageStats miles={X} hours={X} />` with real Nebo data if available
  - `<Gallery images={[...]} />` with `file:///` local photo paths (same format as
    existing posts; `draft: true` means these never reach Netlify)
- **D-10:** Photo order in Gallery: sort by timestamp ascending (original capture order).
- **D-11:** Stub title format: `"Day {N} — {location}"` where N is the day number
  since departure (April 22, 2022 = Day 1) and location comes from `voyage-timeline-enriched.json`.
  If location is `null` or `"Unknown"`, use the GPS centroid city via reverse geocoding
  or fall back to coordinates string `"{lat}, {lon}"`.
- **D-12:** Stub slug format: `{YYYY-MM-DD}-day-{N}-{location-slug}` — consistent with
  existing post naming convention.

### What the Script Does NOT Do
- Does not touch posts already marked with `enriched: true` in frontmatter for GPS fields
  (lat/lon already populated in 68/72 posts — leave those alone).
- Does not run the Claude quality-lift API — that's Phase 3 territory.
- Does not generate GPX track GeoJSON per-day — that's Phase 5 territory.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Pipeline Data
- `.planning/data/voyage-timeline-enriched.json` — 634 days merged from photos + Nebo + timeline; fields: `date`, `location`, `centroidLat`, `centroidLon`, `photoCount`, `withGps`, `photos[]`, `nebo`
- `.planning/data/nebo-logs.json` — keyed by index; each entry has `date`, `distanceNm`, `underwayHours`, `avgSpeedKts`, `maxSpeedKts`
- `.planning/data/blog-inventory.json` — 72 posts with `date`, `title`, `imageCount`, `videoCount`

### Site Content Structure
- `src/content/config.ts` — Zod schema for blog collection; `miles`/`hours` are `z.number().optional()`; `draft` is not in schema (Astro handles it as a built-in)
- `src/content/blog/great-loop/` — 72 existing MDX files; frontmatter pattern established here
- Example post: `src/content/blog/great-loop/2022-04-16-getting-ready-to-go.mdx`

### Components
- `src/components/VoyageStats.astro` — takes `miles` and `hours` props; graceful when missing
- `src/components/Gallery.astro` — takes `images: string[]`; uses `file:///` local paths

### Existing Scripts (for pattern reference)
- `scripts/03-correlate.mjs` — how the enriched timeline was built; read to understand data shape
- `scripts/07-quality-lift.mjs` — in-place MDX frontmatter editing pattern to follow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VoyageStats.astro` — already handles missing `miles`/`hours` gracefully; no changes needed
- `Gallery.astro` — already accepts `file:///` paths; stubs use the same format

### Established Patterns
- **In-place frontmatter editing**: `07-quality-lift.mjs` reads MDX, parses frontmatter with
  `gray-matter`, mutates fields, and writes back. Follow this exact pattern.
- **Data loading**: Scripts use `node:fs` + `JSON.parse`; no npm data-pipeline packages.
- **File paths**: Photos at `~/Pictures/Photos Library.photoslibrary/originals/{dir}/{uuid}.heic`
  where `dir` is the first character of the UUID (from `directory` field in photo index).
- **Draft posts**: Astro treats `draft: true` as a built-in filter; drafted posts don't appear
  in `getCollection('blog')` without the `{ filter: (e) => e.data.draft }` override.

### Integration Points
- Script reads from `.planning/data/` (pipeline outputs) and writes to `src/content/blog/great-loop/`
- New stub slugs must not conflict with existing MDX filenames (check before writing)
- After script runs: `npm run build` must pass zero errors — schema validation will catch malformed frontmatter

</code_context>

<specifics>
## Specific Ideas

- Pre-departure New Bern days (April 1–21, 2022) are included if they have 10+ photos —
  the user confirmed these are worth capturing even though the voyage hadn't started.
- Day numbering starts from April 22, 2022 (Day 1 = departure day based on "The Adventure
  Begins" post).
- The script should log a summary on completion: posts backfilled, stubs generated, skipped.

</specifics>

<deferred>
## Deferred Ideas

- GPX track simplification and per-day GeoJSON output → Phase 5
- AI-assisted narrative generation for stubs → Phase 6
- Cloudinary or other photo CDN migration (file:// paths work for local dev / draft posts) → out of scope

</deferred>

---

*Phase: 4-data-pipeline*
*Context gathered: 2026-07-09*
