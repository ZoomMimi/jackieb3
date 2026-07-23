# Phase 6: New Post Generation - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Every undocumented voyage stop gets a human-reviewed, published post — completing the full Great Loop documentation through the return to New Bern NC (May 2024). Scope covers **both** bodies of work from ROADMAP.md:

1. **Last segment** (~Feb–May 2024, post-Keys): Florida Keys → FL east coast ICW → Georgia → South Carolina → North Carolina → New Bern. Rich iCloud photo + Nebo GPS coverage. ~60-90 days.
2. **Undocumented middle** (Days 112-124, Sep 2022 – Oct 2023): Great Lakes → Chicago → Illinois River → upper Mississippi. Likely sparse coverage — best-effort with whatever data exists, minimal placeholder posts where truly nothing survives.

No `draft: true` posts should remain in either range when the phase completes. Narrative is AI-drafted, then Barbara reviews/edits/approves every post — no AI narrative ships unreviewed.

</domain>

<decisions>
## Implementation Decisions

### Photo hosting (blocking dependency — must be solved first)
**Discovery during discussion:** all 295 posts using `<Gallery>` (250 `draft: true` stubs + 45 already-*published* Phase-4-enriched posts) reference local `file:///Users/.../Photos Library.photoslibrary/...` paths. These render nowhere except the author's own Mac — this is a live, currently-broken-in-production issue for the 45 non-draft posts, not just a blocker for new stub work.

- **D-01:** Photos get uploaded to a **Cloudflare R2 bucket** (free tier: 10GB storage / 10M reads/month, zero egress fees — matters since images get hot-linked on every page view). A batch script exports images from the local Photos library (via `osxphotos`, already used for indexing) and uploads them, then rewrites each post's `file://` paths to the real R2 URL.
- **D-02:** Videos (`.mov` files present in some stub galleries) get uploaded to R2 alongside photos, using the same pipeline — not deferred to a separate pass.
- **D-03:** Photos are resized/compressed before upload (~1600px wide, JPEG ~80%) rather than kept at full original resolution — matches the existing w1600 lightbox pattern already used for Blogger images. HEIC gets converted to JPEG as part of this step (technical necessity, not a separate decision).
- **Also applies to:** the 45 already-published posts with broken `file://` Gallery images — these need the same fix, not just the 250 new draft stubs, since they're currently live and broken.

### Scope: last segment + undocumented middle (both in scope)
- **D-04:** An earlier session's memory note said Phase 6 should be last-segment-only. That's superseded — user confirmed **both** the last segment and the undocumented middle (Days 112-124) are in scope for this phase.
- **D-05:** For undocumented-middle days with zero usable photos and no Nebo data at all: publish a **minimal placeholder post** (title, date, best-available location, a short "no photos or logs survive from this day" note) rather than leaving them unpublished. Keeps the voyage index timeline continuous with no unexplained gaps. Only skip a day if there's truly nothing — not even date-adjacent GPS.

### Stub triage
- **D-06:** Full-narrative vs. transit-day vs. sparse-data triage is driven by **photo/data volume as a proxy** for how eventful a day was — days with more photos and richer Nebo detail (weather, named stops, ICW mile markers — see [[project_phase5_extras]] for the parser built in Phase 5) get full AI-drafted narrative; thin-data transit days get stats+gallery only.
- **D-07:** Claude presents the full triage list (which days fall into which category) **before** generating any AI drafts, so the user can move specific days between categories before spending API calls on narrative generation.
- **D-08:** Every full-narrative AI draft includes a closing Bible-verse attempt (matches Barbara's established voice pattern from published posts). Not left as a placeholder — an actual attempted verse, which Barbara can freely edit/replace during review.

### Barbara's review workflow
- **D-09:** Barbara edits AI-drafted narratives via **direct MDX file editing** — no new review UI gets built for this (contrast with the existing `photo-viewer.mjs`/`blog-viewer.mjs` local-server pattern, which was considered and declined as unnecessary overhead for this step).
- **D-10:** Barbara flips `draft: true` → `false` herself in the frontmatter when she's done editing a post — no separate publish-flag handoff step back to Michael/Claude.

### AI narrative generation approach
- Reuse the existing Claude API pattern already established in `scripts/07-quality-lift.mjs` (Anthropic SDK, `claude-sonnet-4-6`, `ANTHROPIC_API_KEY` env var) — this is a carried-forward pattern, not a new decision point.
- Inputs available for narrative generation: correlated photos (after R2 hosting), Nebo GPS waypoints + stats, and — new since Phase 5 — parsed Nebo OCR detail (weather at departure/arrival, route/marina names, ICW mile markers, named stops) from `scripts/09-parse-nebo-details.mjs`'s output in `nebo-logs.json`'s `legs` field. Use published, non-draft posts as style/voice reference samples.

### Folded Todos
- **`gallery-lightbox-phase6.md`** ("Add lightbox/zoom to Gallery component") — closed. Verified during this discussion that `Gallery.astro`'s images render inside `.post-body` (via the MDX `<slot />` in `BlogPost.astro`), and Phase 5's `Lightbox.astro` already binds click-to-zoom to all `.post-body img` elements. Once real R2 URLs replace the `file://` paths, this should already work — no separate lightbox work needed. Worth a quick visual confirmation once photos are re-hosted, but not a planning task.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — POST-01 through POST-05 (this phase's requirements)
- `.planning/ROADMAP.md` §Phase 6 — goal, scope split, estimated 4-plan breakdown (stub triage → AI draft generation → Barbara review → final publication)
- `.planning/PROJECT.md` — "Photos stay cloud-hosted (no self-hosting)" constraint; this phase's R2 decision satisfies it (R2 is cloud-hosted, not self-hosted on the site's own infrastructure)

### Existing patterns to reuse
- `scripts/07-quality-lift.mjs` — established Claude API call pattern (Anthropic SDK, model, env var) for AI-assisted text generation
- `scripts/00-index-photos.mjs` — existing `osxphotos`-based Photos-library access pattern, needed for the R2 upload script to locate original image bytes
- `scripts/09-parse-nebo-details.mjs` and its output in `.planning/data/nebo-logs.json` (`legs` field) — weather, route names, ICW markers per voyage leg, ready to feed narrative generation
- `src/components/Lightbox.astro`, `src/components/Gallery.astro`, `src/layouts/BlogPost.astro` — confirms Gallery images are already covered by the existing lightbox (see Folded Todos above)

### Draft stub data
- `src/content/blog/great-loop/*.mdx` with `draft: true` — 250 files, frontmatter includes `title, date, voyage, location, lat, lon, excerpt, migrated: false, draft: true`, plus `miles`/`hours` where Nebo data exists. Gallery images currently reference local `file://` paths (see D-01).
- 45 non-draft, `migrated: true` posts with Phase-4-enriched `<Gallery>` blocks also have `file://` paths — these are live and currently broken, needs the same R2 fix.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/07-quality-lift.mjs`: Claude API call pattern (Anthropic SDK v0.52, `claude-sonnet-4-6`) — directly reusable for narrative drafting, just needs a new prompt/system-message tailored to narrative voice instead of quality-lift editing.
- `scripts/00-index-photos.mjs`: reads `~/Pictures/Photos Library.photoslibrary/database/Photos.sqlite` directly via `node:sqlite` — the pattern for resolving a photo UUID to its original file path, needed by the R2 upload script.
- `VoyageStats.astro`, `Gallery.astro`: already used in every stub's MDX body — no changes needed to these components themselves, only to the URLs Gallery receives.

### Established Patterns
- Frontmatter schema for generated posts: `title, date, voyage, location, excerpt, migrated, draft, lat, lon, miles, hours` — consistent across all 250 stubs, already validated by the content collection Zod schema from Phase 1.
- Existing w1600 image-upgrade pattern (Blogger images upgraded to `/w1600/` for the lightbox) — the resize target for R2 uploads should match this (D-03).

### Integration Points
- The R2 upload script needs to run as a new pipeline step (likely `scripts/10-*.mjs` given current numbering) that reads each stub's `file://` Gallery array, uploads/resizes each image, and rewrites the MDX file's Gallery block in place with the new hosted URLs.
- Nebo `legs` detail (`nebo-logs.json`) needs a date-keyed lookup to match against each stub's `date` frontmatter field for narrative generation input.

</code_context>

<specifics>
## Specific Ideas

- Closing Bible verse in every full-narrative draft, matching Barbara's established voice — not a placeholder, an actual attempt (D-08).
- Minimal placeholder posts (not silence) for truly-undocumented days, to keep the voyage timeline visually continuous (D-05).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
None — the one matching todo (gallery-lightbox-phase6.md) was folded/closed, not deferred.

</deferred>

---

*Phase: 6-New Post Generation*
*Context gathered: 2026-07-23*
