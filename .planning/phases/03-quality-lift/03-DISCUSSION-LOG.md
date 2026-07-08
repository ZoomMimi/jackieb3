# Phase 3: Quality Lift - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 03-quality-lift
**Areas discussed:** AI lift pipeline, Post output format, migrated flag + cover photo, QLFT-05 scope vs. Phase 4

---

## AI Lift Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Batch-all, then Barbara reviews | Script processes all 72 posts automatically, commits lifted MDX. Barbara reviews the live site afterward. | ✓ |
| Interactive per-post | Script lifts one post, shows diff/preview, Barbara approves before writing. 72 approval steps. | |
| Batch by segment (10 at a time) | Run in chunks so Barbara can spot-check a batch before continuing. | |

**User's choice:** Batch-all, then Barbara reviews
**Notes:** Fastest approach; Barbara sees finished output rather than drafts.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Node.js script with @anthropic-ai/sdk | Standalone script in scripts/ — consistent with existing pipeline pattern. | ✓ |
| Claude Code directly reads + edits files | Use Claude Code's editor tools inline. Not reproducible. | |

**User's choice:** Node.js script with @anthropic-ai/sdk

---

| Option | Description | Selected |
|--------|-------------|----------|
| Skip and continue, log failures | Script continues; failed posts listed in report file; re-run to retry. | ✓ |
| Stop on first error | Script exits immediately. No partial state. | |
| Auto-retry with exponential backoff | Retry up to 3x before skipping. Good for transient rate limits. | |

**User's choice:** Skip and continue, log failures

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — skip posts already marked as lifted | Idempotent; checks `lifted` flag before processing. | ✓ |
| No — always re-lift all posts | Simpler logic; would overwrite manual edits. | |

**User's choice:** Idempotent — skip already-lifted posts

---

## Post Output Format

| Option | Description | Selected |
|--------|-------------|----------|
| Clean Markdown prose, photos inline | Convert HTML to `## Heading`, paragraphs, `![](url)`. Photos stay in narrative flow. | ✓ |
| Prose to Markdown + Gallery component at end | All photos extracted and placed in a `<Gallery>` block at end. | |
| Prose to Markdown + MDX components inline | Each photo becomes a `<Gallery>` call in context. | |

**User's choice:** Clean Markdown prose, photos inline
**Notes:** No new components needed for existing inline photos from Blogger.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown table or text block | Stats as plain Markdown at bottom. No new component. | |
| New VoyageStats.astro component | Phase 3 creates `src/components/VoyageStats.astro`; posts use `<VoyageStats miles={...} />`. | ✓ |
| Skip for posts without data | Only add voyage stats when GPS/Nebo data exists. | |

**User's choice:** New VoyageStats.astro component
**Notes:** Better if Phase 5 (maps) will also use these stats. Component renders nothing when no props provided.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Frontmatter props: miles, hours, stops, start/end location | Add optional frontmatter fields; VoyageStats reads as props. Phase 4 fills in; Phase 3 adds what's known. | ✓ |
| Hardcoded in MDX body from Nebo logs | Write stats directly as text. Not machine-readable for Phase 5. | |
| Defer stats component to Phase 4 | Phase 3 creates shell; Phase 4 populates frontmatter. | |

**User's choice:** Frontmatter props from available Nebo log data

---

| Option | Description | Selected |
|--------|-------------|----------|
| Claude generates descriptive alt text from surrounding prose | Best for accessibility and SEO. | |
| Leave alt text empty for now | Can be filled in during Barbara's review or future phase. | ✓ |
| Use filename as alt text | UUID filenames — terrible alt text. | |

**User's choice:** Leave alt text empty for now

---

## migrated flag + cover photo

| Option | Description | Selected |
|--------|-------------|----------|
| New boolean field: `lifted: true` | Add `lifted: z.boolean().default(false)` to schema. `migrated` stays as historical record. | ✓ |
| Flip `migrated` to false | `migrated: false` = lifted. Reuses existing field. Counterintuitive semantics. | |

**User's choice:** New `lifted: true` field
**Notes:** `migrated: true` stays on all posts permanently. After lift: post has both `migrated: true` and `lifted: true`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Script auto-selects first photo | Picks first `<img>` URL as `coverPhoto`. Barbara can override during review. | ✓ |
| Barbara selects manually via photo-viewer.mjs | Highest quality; significant manual work for 72 posts. | |
| Leave empty, defer to Phase 5/6 | Cover photos most important for route map pop-ups. | |

**User's choice:** Script auto-selects first photo

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fill location from voyage-timeline-enriched.json | Match post date to GPS timeline; derive human-readable place name. | ✓ |
| Claude extracts location from post title/content | Less accurate than GPS data. | |
| Leave for Phase 4 | Phase 4 enriches frontmatter with GPS data anyway. | |

**User's choice:** Fill location from voyage-timeline-enriched.json

---

## QLFT-05 Scope vs. Phase 4

| Option | Description | Selected |
|--------|-------------|----------|
| Enrichment included in Phase 3 using existing pipeline output | Reads voyage-timeline-enriched.json and nebo-logs.json; adds lat/lon, location, Nebo stats to early post frontmatter. | ✓ |
| Phase 3 does prose lift only; QLFT-05 deferred to Phase 4 | Clean HTML and reformat prose for all 72. QLFT-05 enrichment fully deferred. | |
| Split: Phase 3 adds GPS; Phase 4 adds photos | Phase 3 uses timeline for lat/lon/location; Phase 4 handles photo galleries. | |

**User's choice:** Include enrichment in Phase 3 using existing pipeline output
**Notes:** Data is already ready; no reason to wait for Phase 4's formal pipeline build.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Gallery.astro call with correlated photo thumbnails at end | Appends `<Gallery images={[...]} />` at end of early posts. | ✓ |
| lat/lon + photo count to frontmatter only | Photo display deferred to Phase 5/6. | |
| Prose reference only | Write placeholder sentence ("Barbara has X photos from this day"). | |

**User's choice:** Gallery.astro call with correlated photo thumbnails

---

| Option | Description | Selected |
|--------|-------------|----------|
| Upload to Google Photos / CDN before Phase 3 | Requires Barbara to manually upload iCloud photos. Real web URLs. | |
| Placeholder Gallery with local paths; Phase 6 resolves hosting | Write Gallery calls with local file paths. Phase 6 handles hosting. | ✓ |
| Skip Gallery for early posts; metadata only | Only frontmatter changes for early posts in Phase 3. | |

**User's choice:** Placeholder Gallery with local paths; Phase 6 resolves hosting

---

## Claude's Discretion

- AI prompt engineering (system prompt + user message format for quality lift API call)
- Nebo stats lookup logic for multi-day posts spanning multiple log entries
- iCloud photo path format in placeholder Gallery calls
- Markdown heading detection aggressiveness (how boldly to convert Blogger large text to H2)

## Deferred Ideas

- Actual iCloud photo hosting — Phase 6
- Alt text for all photos — future pass
- Formal data pipeline infrastructure (DATA-01 through DATA-07) — Phase 4
- Full video migration (finding YouTube URLs for all Blogger-hosted videos) — Phase 6
- Barbara's cover photo selection tool — manual override, no tooling needed in Phase 3
