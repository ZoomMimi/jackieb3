# Phase 6: New Post Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 6-New Post Generation
**Areas discussed:** Photo hosting for stub galleries, Scope (last segment vs. + undocumented middle), Stub triage criteria, Barbara's review workflow

---

## Photo hosting for stub galleries

Discovered during codebase scouting (before questions were asked): all 295 posts using `<Gallery>` (250 draft stubs + 45 already-published Phase-4-enriched posts) reference local `file:///Users/.../Photos Library.photoslibrary/...` paths, which render nowhere except the author's Mac. This affects live, currently-published posts, not just new stub work.

| Option | Description | Selected |
|--------|-------------|----------|
| Cloud storage bucket (Cloudflare R2 or Backblaze B2) | Free tier, S3-compatible, batch-uploadable via script | ✓ |
| iCloud Shared Album / Google Photos shared album | No new infra, but manual/fragile linking | |
| You decide | Claude picks simplest reliable option | |

**User's choice:** Cloud storage bucket (Cloudflare R2 or Backblaze B2)

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare R2 | Zero egress fees, 10GB/10M reads free tier | ✓ |
| Backblaze B2 | Also free-tier friendly, egress not free past small allowance | |
| You decide | Claude picks R2 for zero-egress reason | |

**User's choice:** Cloudflare R2

| Option | Description | Selected |
|--------|-------------|----------|
| Upload to R2 alongside photos | Same bucket, same script, treated like any media file | ✓ |
| Skip videos in this pass, photos only | Defer video embeds to a separate pass | |
| You decide | Claude uploads if low-effort, else defers | |

**User's choice:** Upload to R2 alongside photos (videos)

| Option | Description | Selected |
|--------|-------------|----------|
| Resize + compress (~1600px, JPEG ~80%) | Matches existing w1600 lightbox pattern | ✓ |
| Full original resolution | Preserves detail, much larger files | |
| You decide | Claude resizes to match existing pattern | |

**User's choice:** Resize + compress (~1600px, JPEG ~80%)

**Notes:** This turned out to be the central blocking dependency for the whole phase — no narrative work matters if the photos don't render. Surfaced proactively during codebase scouting rather than assumed known.

---

## Scope: last segment only, or + undocumented middle too?

A project memory from an earlier session claimed the user had decided to scope Phase 6 to the last segment only (post-Keys), contradicting ROADMAP.md's original two-body scope. Raised directly as a conflict to resolve.

| Option | Description | Selected |
|--------|-------------|----------|
| Last segment only | Matches the more recent memory note | |
| Both — last segment + undocumented middle | Matches ROADMAP.md's original written scope | ✓ |
| You decide | Claude defaults to last-segment-only per the more recent decision | |

**User's choice:** Both — last segment + undocumented middle (Days 112-124)

**Notes:** This reverses the `project_phase6_scope` memory — updated after this session. The undocumented middle is explicitly back in scope.

| Option | Description | Selected |
|--------|-------------|----------|
| Publish a minimal placeholder post | Title/date/location + "no data survives" note | ✓ |
| Leave as draft / unpublished, skip entirely | Voyage index has gaps for those days | |
| You decide | Claude publishes placeholder if any date/location signal exists | |

**User's choice:** Publish a minimal placeholder post

---

## Stub triage criteria

| Option | Description | Selected |
|--------|-------------|----------|
| Photo/data volume as a proxy | More photos/richer Nebo detail = more eventful day | ✓ |
| Specific stops you already know were memorable | User names days for full-narrative treatment | |
| You decide | Claude uses volume proxy | |

**User's choice:** Photo/data volume as a proxy

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show me the list first | Review/adjust triage before AI drafts generated | ✓ |
| No, just proceed | Trust proxy, catch issues during Barbara's review | |

**User's choice:** Yes, show me the list first

| Option | Description | Selected |
|--------|-------------|----------|
| Include a closing verse attempt in every draft | Matches established voice pattern | ✓ |
| Leave it out, let Barbara add if she wants | AI shouldn't guess at personal/spiritual choice | |
| You decide | Claude includes placeholder note instead | |

**User's choice:** Include a closing verse attempt in every draft

---

## Barbara's review workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Direct MDX file editing | No new tooling, simplest to build | ✓ |
| Lightweight local review UI | Similar to existing photo-viewer.mjs/blog-viewer.mjs pattern | |
| You decide | Claude defaults to direct MDX editing | |

**User's choice:** Direct MDX file editing

| Option | Description | Selected |
|--------|-------------|----------|
| She flips draft: false herself in the frontmatter | One less handoff step | ✓ |
| She tells Michael, you/Claude flip the flag | Keeps frontmatter out of Barbara's hands | |
| You decide | Claude defaults to Barbara flipping it herself | |

**User's choice:** She flips draft: false herself in the frontmatter

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, close it — already covered | Gallery images already inside .post-body, covered by Lightbox.astro | ✓ |
| Keep it open, verify explicitly during Phase 6 | Confirm end-to-end before considering done | |

**User's choice:** Yes, close it — already covered (todo `gallery-lightbox-phase6.md` deleted from `.planning/todos/pending/`)

---

## Claude's Discretion

None — every question received an explicit user selection (no "You decide" picked this session).

## Deferred Ideas

None — discussion stayed within phase scope.
