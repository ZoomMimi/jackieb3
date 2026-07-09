# Phase 4: Data Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 4-data-pipeline
**Areas discussed:** Stub threshold, Miles/hours backfill, Stub content

---

## Stub Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 10+ photos | ~253 stubs — filters out most stay-in-port days | ✓ |
| 5+ photos | ~359 stubs — includes many half-days and overnights | |
| Nebo data present | ~170 stubs — moving days only, misses parked-but-active days | |
| Any data (all 569) | Full coverage but Phase 6 becomes overwhelming | |

**User's choice:** 10+ photos (recommended)
**Notes:** None beyond selection.

---

## Voyage Date Range

| Option | Description | Selected |
|--------|-------------|----------|
| Voyage window only | April 22, 2022 – May 17, 2024 (departure to return) | |
| Include pre-departure | From April 1, 2022 — some New Bern prep days have 10+ photos | ✓ |

**User's choice:** Include pre-departure
**Notes:** User confirmed some pre-departure days in New Bern are worth capturing.

---

## Miles/Hours Backfill — Method

| Option | Description | Selected |
|--------|-------------|----------|
| Edit in-place (recommended) | Script updates frontmatter directly in each .mdx file | ✓ |
| Output a report only | Script writes JSON; human or second pass applies edits | |

**User's choice:** Edit in-place

---

## Miles/Hours Backfill — Missing Nebo

| Option | Description | Selected |
|--------|-------------|----------|
| Leave them empty (recommended) | No miles/hours set; VoyageStats handles gracefully | ✓ |
| Set to 0 | Explicit zeros to mark known-missing | |

**User's choice:** Leave them empty

---

## Stub Content

| Option | Description | Selected |
|--------|-------------|----------|
| Full components (recommended) | VoyageStats + Gallery with real data; same as existing posts | ✓ |
| Frontmatter only | Just frontmatter block; Phase 6 builds body from scratch | |

**User's choice:** Full components — import VoyageStats + Gallery, call with real data.
Phase 6 adds narrative prose between/around the components.

---

## Claude's Discretion

- Title format: `"Day {N} — {location}"` with Day 1 = April 22, 2022
- Slug format: `{YYYY-MM-DD}-day-{N}-{location-slug}`
- Photo sort order: ascending by timestamp
- Fallback for null/Unknown location: reverse geocode centroid or coordinates string

## Deferred Ideas

- GPX track simplification / per-day GeoJSON → Phase 5
- AI-assisted narrative generation for stub prose → Phase 6
- Photo CDN migration away from `file:///` local paths → out of scope v1
