# Phase 6: New Post Generation - Context

**Gathered:** 2026-07-23
**Revised:** 2026-07-25 — scope substantially tightened, supersedes the original discussion
**Status:** Ready for planning

<domain>
## Phase Boundary

**Revision note:** this phase's scope was significantly narrowed on 2026-07-25 after the initial discussion. The original discussion (preserved in `06-DISCUSSION-LOG.md`) covered a much broader scope — this section reflects the current, authoritative boundary.

The original 72-post Blogger blog is the baseline and does not get new photos. Phase 6's new-page work is limited to two specific excursions, both framed primarily by real photos from those periods:

1. **Last leg — Keys to New Bern** (~2024-04-13 to 2024-05-17, the trip's finish): Florida Keys → FL east coast ICW → Georgia → South Carolina → North Carolina → New Bern NC. **27 candidate days** — 18 already have a `draft: true` stub, 9 have photo data in `daily-routes.json` but no stub was ever generated (2024-04-14, 04-15, 04-23, 04-29, 05-03, 05-08, 05-09, 05-10, 05-14).

2. **Canada side trip** (2023-06-05 to 2023-08-31): a second Great Lakes excursion including a return to Canadian waters (North Channel, Ontario, Jul 14-22) — distinct from the *already-published* 2022 Georgian Bay/Canada leg. **74 candidate days** — 43 already have a `draft: true` stub, 31 have photo data but no stub generated (see full list in Decisions below). Presented with editorial framing as a side excursion in the narrative text — no structural/grouping change to the site.

**Everything else is explicitly out of scope for this phase:** the other ~187 draft stubs (including the Holland MI "Days 112-124" Aug 2022 gap, and the rest of the Jan 2023–Apr 2024 middle) stay as unpublished `draft: true` files, untouched. No placeholder posts, no partial treatment — they simply aren't part of this milestone.

**The 72 original Blogger posts get no new photos, period.** 45 of them had a `<Gallery>` block appended during Phase 4's enrichment pass (pointing to local `file://` paths that never rendered) — **this has already been removed** (commit `fe69136`, 2026-07-25). No further "upgrade" work is planned for these 72 posts beyond that removal; Phase 3's quality-lift already brought them to standard.

No `draft: true` posts should remain in the two in-scope ranges when the phase completes. Narrative is AI-drafted, then Barbara reviews/edits/approves every post — no AI narrative ships unreviewed.

</domain>

<decisions>
## Implementation Decisions

### Original blog posts: photo placeholders already removed
- **D-00 (supersedes D-01/D-02/D-03 as they applied to these 45 posts):** The 45 original Blogger posts that had a Phase-4-added `<Gallery>` block (local `file://` paths, never rendered) have had that block and its import removed — done in commit `fe69136`. `VoyageStats` (real Nebo miles/hours data) was left in place; it's not a photo placeholder. **No further action needed on the 72 original posts.**

### Photo hosting for the two new-page workstreams
- **D-01:** Photos/videos for the ~101 candidate days (27 Keys→New Bern + 74 Canada) get uploaded to a **Cloudflare R2 bucket** (free tier: 10GB storage / 10M reads/month, zero egress). A batch script exports images from the local Photos library (via `osxphotos`, already used for indexing) and uploads them, then rewrites each post's Gallery array to the real R2 URL. **Scope note:** this is now ~101 days' worth of photos, not the original 295-post estimate — the 45 original posts no longer need this at all (D-00).
- **D-02:** Videos (`.mov` files present in some galleries) get uploaded to R2 alongside photos, same pipeline.
- **D-03:** Photos are resized/compressed before upload (~1600px wide, JPEG ~80%), matching the existing w1600 lightbox pattern. HEIC converted to JPEG.

### Missing stubs must be generated before triage
- **D-04 (new):** 9 Keys→New Bern days and 31 Canada-trip days have photo data in `daily-routes.json` but no `draft: true` stub was ever generated (likely `scripts/04-generate-stubs.mjs` applied a filter/threshold that skipped them). These need stubs generated using the existing pipeline before triage/narrative work can start on them — this is a prerequisite task, not optional.

### Dropped scope
- **D-05 (supersedes prior D-04/D-05 about "undocumented middle"):** The ~187 draft stubs outside the two in-scope ranges (Holland MI Aug 2022, rest of the Jan 2023–Apr 2024 middle) are left as unpublished drafts with no action. No placeholder posts for these — that placeholder-post idea from the original discussion only applied to the now-dropped "undocumented middle" scope and does not apply to the two ranges actually in scope (both have real photo/GPS data for essentially every day once the missing stubs are generated per D-04).

### Stub triage (within the ~101 in-scope days)
- **D-06:** Full-narrative vs. transit-day split driven by **photo/data volume as a proxy** — more photos + richer Nebo detail (weather, named stops, ICW markers, from `scripts/09-parse-nebo-details.mjs`) = more eventful day = full narrative; thin-data days get stats+gallery only.
- **D-07:** Claude presents the full triage list before generating any AI drafts, so specific days can be moved between categories first.
- **D-08:** Every full-narrative AI draft includes an attempted closing Bible verse (matches Barbara's established voice). Not a placeholder — an actual attempt, freely editable by Barbara.
- **Canada side trip framing:** narrative for these 74 days should note it's a return trip to Canada (distinct from the 2022 Georgian Bay leg) — editorial content note, not a structural/frontmatter change.

### Barbara's review workflow
- **D-09:** Direct MDX file editing — no new review UI.
- **D-10:** Barbara flips `draft: true` → `false` herself when she's done with a post.

### AI narrative generation approach
- Reuse `scripts/07-quality-lift.mjs`'s Claude API pattern (Anthropic SDK, `claude-sonnet-4-6`, `ANTHROPIC_API_KEY`).
- Inputs: correlated photos (after R2 hosting), Nebo GPS waypoints + stats, parsed Nebo OCR detail (`nebo-logs.json`'s `legs` field — weather, route/marina names, ICW markers, named stops). Use published, non-draft posts as style/voice reference.

### Folded Todos
- **`gallery-lightbox-phase6.md`** — closed (see original discussion). Confirmed `Gallery.astro` images render inside `.post-body`, already covered by Phase 5's `Lightbox.astro`. Now moot for the 72 original posts (no Gallery there anymore) but still relevant for the new Keys→New Bern and Canada pages once they get real R2 URLs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — POST-01 through POST-05
- `.planning/ROADMAP.md` §Phase 6 — original goal/scope language; **note the actual scope is now narrower, per this CONTEXT.md's Domain section, not ROADMAP.md's original two-body description**
- `.planning/PROJECT.md` — "Photos stay cloud-hosted (no self-hosting)" constraint; R2 satisfies it. **QLFT-05 ("early posts enhanced with correlated iCloud photos") is effectively reversed for the 72 original posts** — flag this for the next `/gsd:transition` to move QLFT-05 to Out of Scope with reason, since PROJECT.md currently lists it as Validated.

### Existing patterns to reuse
- `scripts/07-quality-lift.mjs` — Claude API call pattern
- `scripts/00-index-photos.mjs` — `osxphotos`-based Photos-library access, needed for the R2 upload script
- `scripts/04-generate-stubs.mjs` — needs re-running (or extending) to generate the 40 missing stubs (D-04) — check why it originally skipped these 40 specific days
- `scripts/09-parse-nebo-details.mjs` / `.planning/data/nebo-logs.json` `legs` field — weather, route names, ICW markers
- `src/components/Lightbox.astro`, `src/components/Gallery.astro`, `src/layouts/BlogPost.astro` — Gallery-in-lightbox coverage confirmed

### Draft stub data (post-scope-tightening)
- **Keys→New Bern range** (2024-04-13 to 2024-05-17): 18 existing `draft: true` stubs + 9 missing (2024-04-14, 04-15, 04-23, 04-29, 05-03, 05-08, 05-09, 05-10, 05-14)
- **Canada side trip range** (2023-06-05 to 2023-08-31): 43 existing `draft: true` stubs + 31 missing (2023-06-06, 06-08, 06-11, 06-12, 06-13, 06-15, 06-17, 06-20, 06-22, 06-25, 06-26, 06-28, 06-29, 07-05, 07-11, 07-15, 07-23, 07-30, 08-01, 08-04, 08-06, 08-10, 08-12, 08-13, 08-16, 08-19, 08-21, 08-22, 08-23, 08-28, 08-29)
- The 72 original posts (`migrated: true`) — no longer have Gallery blocks (D-00), out of further scope

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/07-quality-lift.mjs`: Claude API pattern, reusable for narrative drafting with a new prompt.
- `scripts/00-index-photos.mjs`: Photos.sqlite → file path resolution pattern, needed by the R2 upload script.
- `VoyageStats.astro`, `Gallery.astro`: unchanged, still used by draft stubs; Gallery no longer used by the 72 original posts.

### Established Patterns
- Frontmatter schema for generated posts: `title, date, voyage, location, excerpt, migrated, draft, lat, lon, miles, hours`.
- Existing w1600 image-upgrade pattern — resize target for R2 uploads (D-03).

### Integration Points
- New R2 upload script (likely `scripts/10-*.mjs`) reads each in-scope stub's `file://` Gallery array, uploads/resizes, rewrites the MDX Gallery block with real URLs. **Scope this to only the ~101 Keys→New Bern + Canada days, not all 250 stubs.**
- Need to extend/re-run `scripts/04-generate-stubs.mjs` for the 40 missing days (D-04) before the R2 step and before triage.
- Nebo `legs` detail needs a date-keyed lookup against each stub's `date` field.

</code_context>

<specifics>
## Specific Ideas

- Closing Bible verse in every full-narrative draft (D-08).
- Canada side trip gets editorial framing as a return visit, distinct from the 2022 Georgian Bay leg — text-level note, not a structural change.
- The 72 original posts are explicitly frozen — no new photos, ever, per this decision.

</specifics>

<deferred>
## Deferred Ideas

- The ~187 out-of-scope draft stubs (Holland MI Aug 2022 gap, rest of Jan 2023–Apr 2024) — left as unpublished drafts, available for a possible future milestone if ever revisited. Not deleted.

### Reviewed Todos (not folded)
None.

</deferred>

---

*Phase: 6-New Post Generation*
*Context gathered: 2026-07-23, revised 2026-07-25*
