---
phase: 1
slug: scaffolding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via Astro's built-in testing) + `npm run build` (Astro build) |
| **Config file** | `astro.config.mjs` — none — Wave 0 installs |
| **Quick run command** | `npm run build 2>&1 | tail -5` |
| **Full suite command** | `npm run build && echo "BUILD_OK"` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build 2>&1 | tail -5`
- **After every plan wave:** Run `npm run build && echo "BUILD_OK"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FOUND-01 | build | `npm run build` | ✅ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | FOUND-02 | build | `npm run build` | ✅ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | FOUND-03 | schema | `npm run build 2>&1 \| grep -c "error"` | ✅ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | SITE-01 | manual | Netlify deploy check | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | SITE-03 | build | `npm run build` | ✅ W0 | ⬜ pending |
| 1-04-02 | 04 | 2 | SITE-04 | manual | Visual layout check | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` with build script — stubs for FOUND-01/02
- [ ] `astro.config.mjs` — Astro 6.x config with MDX and Tailwind
- [ ] `src/content.config.ts` — content collection schema

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Netlify live URL accessible via HTTPS | SITE-01 | Requires browser + DNS | Visit Netlify URL, confirm HTTPS, no 404 |
| No broken layouts on mobile/desktop | SITE-04 | Visual regression requires human eye | Open DevTools, toggle mobile, verify layout |
| Deploy preview on pull request | SITE-01 | Requires GitHub PR + Netlify integration | Create draft PR, confirm preview URL in PR checks |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
