---
phase: 5
slug: route-maps
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework installed; build-pass + manual visual confirmation |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run preview` (manual visual check on map load) |
| **Estimated runtime** | ~30–60 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` exits 0
- **After every plan wave:** Run `npm run build && npm run preview` — manual visual check on map load
- **Before `/gsd:verify-work`:** Build passes + human verifies map loads on mobile (touch pan, pinch zoom, popup tap)
- **Max feedback latency:** 60 seconds (build time)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | MAP-02 | — | Script exits non-zero if output > 500KB | integration | `node scripts/simplify-gpx.mjs && stat src/data/route-track.json` | ❌ Wave 0 | ⬜ pending |
| 05-02-01 | 02 | 2 | MAP-01, MAP-05 | — | No `window` access in frontmatter; build exits 0 | build | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 05-03-01 | 03 | 2 | MAP-03 | — | Popup HTML from controlled frontmatter only | visual/manual | manual — open map, click marker, verify popup | N/A | ⬜ pending |
| 05-04-01 | 04 | 3 | MAP-04, SITE-02 | — | PostMiniMap not rendered on list views | build | `npm run build` exits 0 | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/data/route-track.json` — stub empty GeoJSON (required for build; covers MAP-02 prerequisite)
- [ ] `scripts/simplify-gpx.mjs` — GPX converter script; covers MAP-02
- [ ] `src/components/VoyageMap.astro` — full route map component; covers MAP-01, MAP-02, MAP-03
- [ ] `src/components/PostMiniMap.astro` — per-post mini map component; covers MAP-04, MAP-05

*All four are created by the plans — Wave 0 means "must exist before subsequent wave tasks depend on them."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stop markers clickable with popup showing photo + excerpt + link | MAP-03 | Visual interaction; no test framework | Open `/voyages/great-loop/`, click a marker, verify popup shows cover photo, title, excerpt, and "Read more" link |
| Map loads and is interactive on mobile | MAP-04 (mobile) | Device-specific touch behavior | Open on iOS/Android, verify touch pan, pinch zoom, popup tap work with no layout overflow |
| Route polyline drawn as full Great Loop track | MAP-02 | Visual verification of GPX quality | Open `/voyages/great-loop/`, verify polyline covers the full route from New Bern NC loop |
| Stadia Maps tiles load in production (not just localhost) | MAP-01 | Domain auth is dashboard-only config | After Netlify deploy, verify no 429 errors in DevTools for tile requests |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
