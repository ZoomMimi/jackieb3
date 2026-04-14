# Requirements: JACKIE B III Going Loopy

**Defined:** 2026-03-23
**Core Value:** Every stop on the Great Loop is documented with consistent, professional quality — readable by someone who wasn't there, discoverable by the boating community, and ready to host future voyages.

## v1 Requirements

### Foundation

- [ ] **FOUND-01**: Astro project scaffolded with content collections schema (multi-voyage architecture)
- [ ] **FOUND-02**: Content collection frontmatter schema covers: title, date, voyage, location, lat/lon, anchorage/marina, cover photo, excerpt, migrated flag
- [ ] **FOUND-03**: Site deployed to Netlify free tier from git repository
- [ ] **FOUND-04**: Responsive layout with consistent typography, heading hierarchy, and visual style across all posts

### Migration

- [ ] **MIG-01**: All existing Blogger posts extracted from XML export and converted to MDX
- [ ] **MIG-02**: Post metadata preserved: publish date, slug, labels/tags
- [ ] **MIG-03**: Photo URLs from existing posts preserved and rendering correctly
- [ ] **MIG-04**: Netlify 301 redirects generated from old Blogger URLs to new Astro URLs
- [ ] **MIG-05**: Existing blog remains live during migration (no DNS changes until site is ready)

### Quality Lift

- [ ] **QLFT-01**: All migrated posts reformatted to consistent heading structure (H1 title, H2 sections)
- [ ] **QLFT-02**: Grammar and prose normalized across all migrated posts
- [ ] **QLFT-03**: Consistent post layout: intro summary, body, photo gallery, voyage stats footer
- [ ] **QLFT-04**: `migrated` frontmatter flag tracks raw imports vs. quality-lifted posts
- [ ] **QLFT-05**: Early posts (Days 1–111, Apr–Aug 2022) enhanced with correlated iCloud photos and Nebo GPS data to match the narrative richness of later posts

### Data Pipeline

- [ ] **DATA-01**: Nebo GPX tracks parsed and converted to GeoJSON (simplified for performance)
- [ ] **DATA-02**: iCloud photo library indexed via osxphotos — GPS + timestamp extracted for every voyage photo
- [ ] **DATA-03**: Photos correlated to voyage days/stops by timestamp (timezone-aware)
- [ ] **DATA-04**: Nebo PDF voyage summaries parsed for daily stats (distance, hours, speed, location)
- [ ] **DATA-05**: Frontmatter enriched with lat/lon/miles data for all posts where GPS data exists
- [ ] **DATA-06**: Unified voyage timeline produced — every day from Day 1 to return has GPS track, photo cluster, and Nebo stats (or documented gap)
- [ ] **DATA-07**: Last segment (Days 259 → New Bern, May 2024) fully represented in timeline with photos + GPS

### Route Maps

- [ ] **MAP-01**: Full Great Loop interactive route map on voyage index page (Leaflet, Stadia Maps tiles)
- [ ] **MAP-02**: GPX track drawn as polyline on full route map
- [ ] **MAP-03**: Clickable stop markers on full route map — pop-up shows cover photo + excerpt + link to post
- [ ] **MAP-04**: Per-post mini map showing that day's route segment
- [ ] **MAP-05**: Map components use `client:only` (no SSR), pass stop data as props from frontmatter

### New Post Generation

- [ ] **POST-01**: MDX stubs generated for all undocumented stops using GPS + EXIF + Nebo data
- [ ] **POST-02**: Each stub includes: auto-populated frontmatter, photo gallery from correlated iCloud photos, voyage stats, Nebo PDF summary block
- [ ] **POST-03**: All generated posts reviewed and narrative-completed by Barbara before publishing
- [ ] **POST-04**: Undocumented middle (Days 112–124) documented to the extent photo/GPS data allows
- [ ] **POST-05**: Last segment (Days 259 → return to New Bern NC, May 2024) fully documented with AI-drafted narrative reviewed by Barbara

### Photo & Media

- [ ] **MEDIA-01**: Per-post photo galleries rendering from cloud-hosted URLs (plain `<img>` with lazy loading, no Astro Image optimizer)
- [ ] **MEDIA-02**: Video embeds supported (cloud-hosted or YouTube)
- [ ] **MEDIA-03**: Gallery layout is responsive and touch-friendly on mobile

### Site Structure

- [ ] **SITE-01**: Public site, no login or authentication
- [ ] **SITE-02**: Voyage index page listing all posts for the Great Loop with map
- [ ] **SITE-03**: Individual post pages with consistent layout
- [ ] **SITE-04**: About page (Jackie B III, the crew, the Great Loop)
- [ ] **SITE-05**: Site architecture supports adding future voyages without restructuring

## v2 Requirements

### Future Voyages

- **VOYG-01**: Second voyage section when Jackie B III completes next trip
- **VOYG-02**: Fleet/voyage comparison view across multiple trips

### Enhancements

- **ENH-01**: Search across all posts
- **ENH-02**: Filter posts by type (anchoring, marina, notable stop)
- **ENH-03**: Lightbox for photo galleries
- **ENH-04**: Printable voyage summary / PDF export

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / login | Public read-only site, no auth needed |
| Comments system | Not a community forum, keep it simple |
| Real-time GPS tracking | Trip is complete, static route data only |
| Self-hosted images | Photos stay cloud-hosted; re-hosting adds complexity and storage cost |
| Mobile app | Web-first; browser is sufficient for reading |
| E-commerce / merchandise | Not a monetization project |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| MIG-01 | Phase 2 | Pending |
| MIG-02 | Phase 2 | Pending |
| MIG-03 | Phase 2 | Pending |
| MIG-04 | Phase 2 | Pending |
| MIG-05 | Phase 2 | Pending |
| QLFT-01 | Phase 3 | Pending |
| QLFT-02 | Phase 3 | Pending |
| QLFT-03 | Phase 3 | Pending |
| QLFT-04 | Phase 3 | Pending |
| DATA-01 | Phase 4 | Pending |
| DATA-02 | Phase 4 | Pending |
| DATA-03 | Phase 4 | Pending |
| DATA-04 | Phase 4 | Pending |
| DATA-05 | Phase 4 | Pending |
| MAP-01 | Phase 5 | Pending |
| MAP-02 | Phase 5 | Pending |
| MAP-03 | Phase 5 | Pending |
| MAP-04 | Phase 5 | Pending |
| MAP-05 | Phase 5 | Pending |
| POST-01 | Phase 6 | Pending |
| POST-02 | Phase 6 | Pending |
| POST-03 | Phase 6 | Pending |
| POST-04 | Phase 6 | Pending |
| MEDIA-01 | Phase 2 | Pending |
| MEDIA-02 | Phase 2 | Pending |
| MEDIA-03 | Phase 2 | Pending |
| SITE-01 | Phase 1 | Pending |
| SITE-02 | Phase 5 | Pending |
| SITE-03 | Phase 1 | Pending |
| SITE-04 | Phase 1 | Pending |
| SITE-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after initial definition*
