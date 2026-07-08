# Phase 3: Quality Lift - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform all 72 migrated Blogger posts from raw HTML blobs into clean, professional MDX — consistent heading structure, prose quality, photo handling, and enriched frontmatter. A Node.js script drives the lift using the Claude API; Barbara reviews the resulting site. Early posts (Days 1–111, Apr–Aug 2022) also receive GPS/location enrichment and Gallery placeholders for iCloud photos. Phase 3 does NOT handle actual photo hosting for iCloud photos (deferred to Phase 6) and does NOT build the formal data pipeline infrastructure (Phase 4 owns DATA-01 through DATA-07).

</domain>

<decisions>
## Implementation Decisions

### AI Lift Pipeline
- **D-01:** Batch-all execution model. A single Node.js script (`scripts/07-quality-lift.mjs` or similar) processes all 72 posts automatically using the `@anthropic-ai/sdk`. Barbara reviews the live site afterward and reports issues — she does not approve each post before it's written.
- **D-02:** Script built as a standalone Node.js script in `scripts/`, consistent with the established pipeline pattern (00–06 scripts). Uses `@anthropic-ai/sdk` with the Claude API directly.
- **D-03:** Skip-and-log error handling. If the Claude API call fails for a post (rate limit, timeout, etc.), the script logs the failure and continues to the next post. A report file lists all failed post slugs. The script is re-runnable to retry only failed posts.
- **D-04:** Idempotent by design. Script checks each post's `lifted` frontmatter field before processing; if `lifted: true`, the post is skipped. Safe to re-run without re-lifting already-completed posts or overwriting Barbara's manual edits.

### Post Output Format
- **D-05:** Clean Markdown prose with photos inline. The Blogger HTML soup (`<div class="separator">`, `<span style="font-size: large;">`, etc.) is converted to clean Markdown: `## Heading` for H2 sections, paragraph text for prose, `![](url)` for inline photos. Photos stay in the narrative flow where Blogger originally placed them — no extraction to a Gallery component for existing inline photos.
- **D-06:** New `VoyageStats.astro` component (`src/components/VoyageStats.astro`) at the end of each post. The component receives frontmatter props: `miles`, `hours`, `stops`, `startLocation`, `endLocation` (all optional). If frontmatter fields are missing, the component renders nothing or an empty state — no hard errors. The lift script writes a `<VoyageStats ... />` call at the end of each post body using available Nebo log data for that post's date.
- **D-07:** Photo alt text left empty for now (`![](url)` with blank alt). Will be addressed in a future pass or by Barbara during review.

### `migrated` Flag + Cover Photo
- **D-08:** New boolean frontmatter field `lifted: true` marks quality-lifted posts. Schema change: add `lifted: z.boolean().default(false)` to `src/content.config.ts`. `migrated: true` stays on all posts as a permanent historical record of their Blogger origin. After quality lift, a post has both `migrated: true` and `lifted: true`.
- **D-09:** Script auto-selects the first `<img>` URL found in the post body as `coverPhoto` frontmatter. This gives every post a cover photo without manual work. Barbara can override specific cover photos during her review pass.
- **D-10:** `location` frontmatter field updated from `"Great Loop"` (voyage name placeholder) to an actual stop location derived from `voyage-timeline-enriched.json` — matched by post date. Location is expressed as a human-readable place name (e.g., `"Solomon's Island, MD"`). If no timeline entry exists for the post date, the location field stays as-is.

### QLFT-05: Early Post Enrichment
- **D-11:** Phase 3 includes QLFT-05 enrichment using already-built pipeline output. The lift script reads `voyage-timeline-enriched.json` and `nebo-logs.json` to enrich early post (Days 1–111, Apr–Aug 2022) frontmatter with: `lat`, `lon`, GPS-derived `location`, and Nebo stats (`miles`, `hours`) for the `VoyageStats` component.
- **D-12:** For early posts with correlated iCloud photos in `voyage-timeline-enriched.json`, append a `<Gallery images={[...localPaths]} />` call at the end of the post body using local file paths as placeholders (e.g., `file:///path/to/UUID.heic`). Phase 6 (New Post Generation) resolves actual photo hosting and replaces placeholder paths with web-accessible URLs. The Gallery renders nothing useful locally but establishes the structure.

### Claude's Discretion
- AI prompt engineering: The exact system prompt and user message format for the quality lift API call — Claude designs this based on the requirements and sample post content.
- Nebo stats lookup logic: How to match a post date to nebo-logs.json entries when there are gaps or multi-day posts (e.g., "Days 4–9" spans multiple log entries) — Claude's discretion.
- iCloud photo path format in placeholder Gallery: exact format of local path strings — Claude's discretion.
- Markdown heading detection: how aggressively to convert Blogger bold/large text to Markdown H2 sections — Claude's discretion based on what the existing content looks like.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — QLFT-01, QLFT-02, QLFT-03, QLFT-04, QLFT-05 (all Phase 3 requirements)

### Project context
- `.planning/PROJECT.md` — multi-voyage architecture, photo URL strategy (cloud-hosted, no Astro Image optimizer)
- `.planning/STATE.md` — key decisions (Claude API for quality lift, `migrated` flag strategy, plain `<img>` tags)

### Prior phase context
- `.planning/phases/02-blogger-migration/02-CONTEXT.md` — D-06 (coverPhoto deferred to Phase 3), D-07 (video stubs format `<!-- video: [token] -->`), D-03 (migrated flag semantics)

### Existing code
- `src/content.config.ts` — Zod schema; Phase 3 adds `lifted: z.boolean().default(false)` field
- `src/layouts/BlogPost.astro` — post layout; understand what frontmatter it consumes and how `.post-body` styles render clean Markdown
- `src/components/Gallery.astro` — existing Gallery component (created in Phase 2); understand its current props/slots API before deciding how VoyageStats and early-post Gallery calls use it
- `src/components/VideoEmbed.astro` — existing VideoEmbed component; video comment stubs `<!-- video: [token] -->` may be resolvable to YouTube URLs during lift

### Pipeline data (already built)
- `.planning/data/voyage-timeline-enriched.json` — 625 dates with GPS centroids, photo clusters, Nebo log matches; primary source for location enrichment and early-post iCloud photo data
- `.planning/data/nebo-logs.json` — 162/171 Nebo logs OCR'd; source for VoyageStats data (miles, hours, avg speed, max speed, departure/arrival)
- `.planning/data/photo-assessments.json` — photo quality assessments per day

### Existing scripts (patterns to follow)
- `scripts/blog-viewer.mjs` — Atom API fetcher; understand how it reads existing post data
- Any `scripts/0*.mjs` — established Node.js pipeline script pattern (ESM, no build step, reads JSON from `.planning/data/`)

### Roadmap
- `.planning/ROADMAP.md` § Phase 3 — success criteria, requirements coverage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Gallery.astro` — exists from Phase 2; understand current API before designing early-post Gallery placeholders
- `src/components/VideoEmbed.astro` — exists from Phase 2; Phase 3 may replace some `<!-- video: [token] -->` stubs with `<VideoEmbed url="..." />` if YouTube URLs can be identified
- Pipeline data files in `.planning/data/` — voyage-timeline-enriched.json is the key source for QLFT-05 enrichment

### Established Patterns
- Pipeline scripts are ESM Node.js in `scripts/` directory, reading from `.planning/data/`, writing to `src/content/blog/great-loop/`
- `migrated: true` = raw Blogger import (established in Phase 2); Phase 3 adds `lifted: true` alongside it
- Content collection IDs are filenames without extension; slugs are stable from Phase 2 import
- Photos: cloud-hosted Blogger CDN URLs (`blogger.googleusercontent.com`) — no Astro Image optimizer, plain `<img loading="lazy">` tags

### Integration Points
- `src/content.config.ts` — schema change required (add `lifted` field + optional VoyageStats props: `miles`, `hours`, `stops`, `startLocation`, `endLocation`)
- `src/layouts/BlogPost.astro` — may need to render `VoyageStats` component if stats are in frontmatter (or VoyageStats is called in MDX body)
- `src/content/blog/great-loop/*.mdx` — all 72 files are rewritten by the lift script

</code_context>

<specifics>
## Specific Ideas

- The lift script should produce a progress log (post slug + status) so Barbara can see what was processed and what failed
- Video stubs `<!-- video: [token] -->` — if the lift script can heuristically find the YouTube URL from the post context (e.g., the post mentions a video with a title), it should attempt to replace the stub with `<VideoEmbed url="..." />`. Otherwise leave the stub as-is.
- `VoyageStats.astro` should gracefully render nothing when no props are provided — do not show an empty box or placeholder text
- The quality lift Claude prompt should instruct the model to: preserve all factual content and Barbara's voice, convert formatting only, not rewrite prose
- Early posts with multi-day coverage (e.g., "Days 4–9") may map to multiple nebo-log entries; the script should aggregate or pick the first matching entry

</specifics>

<deferred>
## Deferred Ideas

- Actual iCloud photo hosting — photos are local files; Phase 6 (New Post Generation) resolves hosting when building full post stubs. Gallery calls with local path placeholders are the Phase 3 bridge.
- Alt text for all photos — left empty in Phase 3; future pass or Barbara review
- Formal data pipeline infrastructure (DATA-01 through DATA-07) — Phase 4 builds the official pipeline. Phase 3 reads from already-built pipeline output only.
- Barbara's cover photo overrides — her manual selection can happen anytime after Phase 3 runs; no tooling needed in Phase 3
- Video migration (finding YouTube URLs for all Blogger-hosted videos) — Phase 3 only attempts obvious ones; full resolution is a human task in Phase 6

</deferred>

---

*Phase: 03-quality-lift*
*Context gathered: 2026-07-08*
