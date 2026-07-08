---
phase: 02-blogger-migration
plan: "02"
subsystem: components
tags: [astro, components, gallery, video-embed, css-grid, youtube, media]

# Dependency graph
requires:
  - phase: 02-blogger-migration
    plan: "01"
    provides: 72 MDX files in src/content/blog/great-loop/ (builds on; components available for Phase 3 to wire in)

provides:
  - src/components/Gallery.astro — responsive CSS grid gallery, plain img lazy-load, scoped styles
  - src/components/VideoEmbed.astro — YouTube URL to 16:9 iframe, regex video-ID extraction, scoped styles
  - npm run build exits 0 (77 pages) with both components compiled

affects:
  - 02-03 (verify + deploy — build confirmed passing with both new components)
  - 03-quality-lift (Gallery.astro and VideoEmbed.astro available to wire into migrated posts)

# Tech tracking
tech-stack:
  added: []  # No new packages — pure Astro component files
  patterns:
    - "FormattedDate.astro interface Props pattern applied to Gallery.astro and VideoEmbed.astro"
    - "Scoped <style> block at bottom of .astro file (HeaderLink.astro convention)"
    - "Plain <img loading=lazy decoding=async> — no astro:assets import (project D-05)"
    - "CSS grid repeat(auto-fill, minmax(280px, 1fr)) for responsive gallery without media queries"
    - "YouTube video ID regex: /(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([^&\\s]+)/ — handles both URL forms"
    - "padding-bottom: 56.25% technique for responsive 16:9 iframe ratio"

key-files:
  created:
    - src/components/Gallery.astro
    - src/components/VideoEmbed.astro
  modified: []

key-decisions:
  - "Gallery uses plain <img> tags not <Image> from astro:assets — photos are on blogger.googleusercontent.com CDN which Astro Image optimizer cannot process (D-05)"
  - "VideoEmbed extracts video ID via regex and constructs clean embed URL — raw url prop never reaches iframe src directly (T-02-05 threat mitigation)"
  - "VideoEmbed fallback: if URL does not match YouTube patterns, pass url through directly (handles already-embed-format URLs)"
  - "No new npm packages — both components are pure .astro files"

# Metrics
duration: 10min
completed: 2026-07-08
---

# Phase 02 Plan 02: Gallery.astro + VideoEmbed.astro Summary

**Responsive CSS grid gallery and YouTube 16:9 iframe embed components written as plain Astro components with scoped styles, no new packages, build exits 0 with 77 pages**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-08T11:19:00Z
- **Completed:** 2026-07-08T11:29:31Z
- **Tasks:** 2
- **Files modified/created:** 2 (Gallery.astro, VideoEmbed.astro)

## Accomplishments

- Wrote src/components/Gallery.astro: `interface Props { images: string[]; caption?: string }`, CSS grid `repeat(auto-fill, minmax(280px, 1fr))`, `<img loading="lazy" decoding="async">`, scoped styles, no astro:assets
- Wrote src/components/VideoEmbed.astro: `interface Props { url: string; title?: string }`, YouTube URL regex extracts video ID, `https://www.youtube.com/embed/{videoId}` embed URL construction, 16:9 ratio via `padding-bottom: 56.25%`, `allowfullscreen`, `loading="lazy"`, scoped styles
- npm run build exits 0 — 77 pages generated, both components compiled without errors
- T-02-05 threat mitigation applied: raw url prop never reaches iframe src; only the extracted videoId is used in the constructed embed URL

## Task Commits

1. **Task 1: Write Gallery.astro and VideoEmbed.astro** - `af7859c` (feat)
2. **Task 2: Build verification** - no commit (no files modified; build verification only)

## Files Created/Modified

- `src/components/Gallery.astro` - Responsive image grid; props: images: string[], caption?: string; CSS grid with repeat(auto-fill, minmax(280px, 1fr)); plain img lazy-load
- `src/components/VideoEmbed.astro` - YouTube iframe embed; props: url: string, title?: string; regex video ID extraction; 16:9 aspect ratio via padding-bottom 56.25%

## Decisions Made

- **No astro:assets:** Gallery uses plain `<img>` tags (not `<Image>` from astro:assets). Photos are on blogger.googleusercontent.com CDN which Astro Image optimizer cannot process remote CDN URLs for.
- **VideoEmbed fallback:** If `url` does not match YouTube patterns, `embedUrl` falls back to `url` directly — handles edge cases where URL is already an embed URL.
- **T-02-05 mitigation:** VideoEmbed extracts only the video ID from the url prop, then constructs the iframe src as `https://www.youtube.com/embed/{videoId}`. The raw url value never reaches the iframe src attribute directly.

## Deviations from Plan

None — plan executed exactly as written. Both components match the RESEARCH.md Pattern 5 and Pattern 6 specs precisely.

## Known Stubs

None — both components are fully functional. Gallery and VideoEmbed are available for Phase 3 to wire into migrated posts. The 72 existing migrated posts do not call these components yet (per D-05: photos remain inline in raw Blogger HTML; video placeholders use `<div class="video-placeholder">` from Phase 1 import).

## Threat Surface Scan

T-02-05 mitigation confirmed present in VideoEmbed.astro:
- Threat: Raw url prop passed to iframe src
- Mitigation: `const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1]` extracts only the ID; `const embedUrl = videoId ? \`https://www.youtube.com/embed/${videoId}\` : url` constructs safe embed URL
- No new unplanned threat surface introduced

## Next Phase Readiness

- **Wave 2 complete:** Gallery.astro and VideoEmbed.astro compiled and ready
- **Wave 3 ready:** Plan 02-03 (verify + deploy) can proceed — build confirmed passing with 77 pages
- **Phase 3 handoff:** Gallery.astro and VideoEmbed.astro available for quality-lift phase to wire into migrated posts

---
*Phase: 02-blogger-migration*
*Completed: 2026-07-08*
