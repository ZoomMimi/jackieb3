---
phase: 06-new-post-generation
plan: 02
subsystem: data-pipeline
tags: [aws-sdk-client-s3, sharp, osxphotos, cloudflare-r2, mdx]

# Dependency graph
requires:
  - phase: 06-new-post-generation (plan 06-01)
    provides: "@aws-sdk/client-s3 dependency, r2Uploaded/narrativeDrafted schema flags, upload-r2 npm script, .env.example env-var names, 100/101 in-scope stubs"
provides:
  - "scripts/10-upload-r2.mjs — dry-run-verified osxphotos export -> sharp resize -> R2 upload -> MDX Gallery rewrite pipeline"
affects: [06-04-pilot-render-verify, 06-05-full-r2-upload, 06-06-narrative-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All-or-nothing per-post Gallery rewrite gated on r2Uploaded (mirrors lifted/enriched idempotency pattern from 07-quality-lift.mjs)"
    - "Lazy fail-fast credential guard (getR2Client) — dry-run never requires R2 env vars"

key-files:
  created:
    - scripts/10-upload-r2.mjs
  modified: []

key-decisions:
  - "Task 1 (script) is complete and dry-run verified. Task 2 (Cloudflare R2 bucket + credential provisioning) is a blocking checkpoint:human-verify requiring the actual project owner to act in the Cloudflare dashboard — this cannot be automated or simulated, and was NOT attempted or bypassed."
  - "No .env file was created and no credentials were fabricated. .env remains absent from this worktree pending the human's dashboard actions."

patterns-established:
  - "osxphotos export --uuid-from-file (never date-range/whole-library) as the only photo-export path, enforced by an acceptance-criteria grep"

requirements-completed: []  # POST-02 NOT yet complete — Task 2 (bucket provisioning) and the actual upload run (plan 06-05) still required before any photo is truly R2-hosted.

# Metrics
duration: ~45min (Task 1 only; Task 2 not started — blocked on human checkpoint)
completed: 2026-07-28
---

# Phase 6 Plan 2: R2 Upload Script (Task 1 complete, Task 2 blocked on human checkpoint) Summary

**`scripts/10-upload-r2.mjs` built and dry-run verified against all 100 in-scope posts (1846 media files, 136 videos) — zero MDX files touched, zero R2 credentials required for dry-run — but the plan is NOT complete: Task 2 requires the actual project owner to provision a real Cloudflare R2 bucket and API token, which cannot be automated.**

## Performance

- **Duration:** ~45 min (Task 1 only)
- **Started:** 2026-07-28 (session start)
- **Completed (Task 1 only):** 2026-07-28T12:26:39Z
- **Tasks:** 1 of 2 complete
- **Files modified:** 1 (scripts/10-upload-r2.mjs, new)

## Accomplishments
- Built `scripts/10-upload-r2.mjs` (426 lines): per-in-scope-day pipeline that extracts UUIDs from each post's existing `file://` Gallery array, exports them via `osxphotos export --uuid-from-file` with `--convert-to-jpeg` (HEIC decode via macOS native decoder), resizes images with `sharp` (1600px wide, JPEG quality 80, `withoutEnlargement: true`), uploads to Cloudflare R2 via `@aws-sdk/client-s3`'s `PutObjectCommand`, and rewrites the post's Gallery array with real HTTPS URLs — all gated on an all-or-nothing per-post commit (`r2Uploaded: true` only set after every one of that post's files uploads successfully).
- Verified end-to-end in `--dry-run` mode with **no R2 credentials present at all** (proves the lazy credential guard): all 100 in-scope posts report correct per-post image/video counts, totaling 1846 media files (1710 images, 136 videos) — matching 06-RESEARCH.md's measured scale.
- Confirmed the credential guard fails fast and correctly: a real (non-dry-run) invocation with no env vars set exits 1 naming the first missing variable (`R2_ACCOUNT_ID`), with no secret values ever echoed.
- Confirmed `git diff --stat src/content/blog/great-loop` is empty after all dry runs (no MDX files touched) and `npm run build` passes (77 pages built).
- Confirmed no date-range or whole-library `osxphotos` invocation exists anywhere in the script — the only export path is `--uuid-from-file`, mitigating T-06-03.
- Confirmed array-args `execFileSync('osxphotos', [...])` is the only process-spawn form used — zero occurrences of `exec(`, mitigating T-06-05 (command injection).

## Task Commits

1. **Task 1: Write scripts/10-upload-r2.mjs** - `7d70808` (feat)

Task 2 (Cloudflare R2 bucket + credential provisioning) has **no commit** — it is a blocking `checkpoint:human-verify` task requiring the actual project owner (not this agent) to act in the Cloudflare dashboard. Per this plan's own `<action>` and `<threat_model>` (T-06-04: bucket-scoped Object Read & Write token only, never Account-level Admin), bucket/token creation has no CLI/API bootstrap path from an unauthenticated machine — it is genuinely manual and was correctly NOT attempted, simulated, or bypassed with placeholder credentials.

**Plan metadata:** (this commit, partial — see below)

## Files Created/Modified
- `scripts/10-upload-r2.mjs` - osxphotos export -> sharp resize -> R2 upload -> MDX Gallery rewrite pipeline, with `--dry-run`/`--date`/`--limit`/`--force`/`--allow-derivative-fallback` flags

## Decisions Made
- Task 1 fully implements the plan's `<action>` spec verbatim (imports, constants, CLI flags, credential guard shape, frontmatter round-trip functions copied from `scripts/04-generate-stubs.mjs`, 9-step per-post flow, dry-run short-circuit).
- Task 2 was deliberately NOT attempted: creating a real Cloudflare R2 bucket, generating a real API token, and populating `.env` with real credentials requires human action in the Cloudflare dashboard with billing/access implications. No `.env` file was written; no credentials were fabricated or guessed.

## Deviations from Plan

None - Task 1 executed exactly as written and fully passed its acceptance criteria. Task 2 is blocked on the human checkpoint by design (not a deviation — this is the plan's own `checkpoint:human-verify gate="blocking"` structure working as intended).

## Issues Encountered

- This worktree had no `node_modules` (fresh worktree checkout, gitignored) — ran `npm install` to restore dependencies (`@aws-sdk/client-s3` was already declared in `package.json` by plan 06-01) before the script could be dry-run tested. No package.json/package-lock.json changes resulted (already in sync).

## User Setup Required

**Yes — this is the blocking item preventing plan completion.** See the checkpoint details below. Cloudflare R2 bucket creation, API token generation, and `.env` population must happen in the Cloudflare dashboard by the project owner. No CLI/API path exists to automate this from an unauthenticated machine.

### CHECKPOINT: Provision the Cloudflare R2 bucket and credentials (Task 2, blocking)

**What's built:** `scripts/10-upload-r2.mjs` is written and dry-run verified. It needs a real R2 bucket and credentials before it can upload anything. Bucket creation and API-token generation happen only in the Cloudflare dashboard — there is no CLI/API path to bootstrap them from an unauthenticated machine, so this step is genuinely manual.

**How to verify / what to do:**
1. Sign in at https://dash.cloudflare.com and go to R2. If R2 has never been used on this account, accept the free-tier terms (10 GB storage, 10M reads/month, zero egress — comfortably covers the ~1846 in-scope media files).
2. Create a bucket named `jackieb3-photos` (any name works; whatever you choose goes into `R2_BUCKET`).
3. Go to R2 -> Manage API Tokens -> Create API Token. Set permission to **Object Read & Write** and scope it to **the single `jackieb3-photos` bucket** — do NOT create an Account-level Admin token (threat T-06-04). Copy the Access Key ID and Secret Access Key; the secret is shown only once.
4. Go to R2 -> `jackieb3-photos` -> Settings -> Public access, and enable the **Public Development URL**. Copy the `https://pub-<hash>.r2.dev` value.
5. Create a `.env` file at the repo root (it is already gitignored) by copying `.env.example` and filling in: `R2_ACCOUNT_ID` (the Account ID shown on the R2 Overview page), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE` (the pub-<hash>.r2.dev URL, no trailing slash). Also add `ANTHROPIC_API_KEY` while you are here — plan 06-05 needs it.
6. Reply "approved" once `.env` is filled in. Claude will then run a write/read smoke test that uploads one tiny object and fetches it back over public HTTPS.

Known tradeoff you are accepting (06-RESEARCH.md Pitfall 3): `r2.dev` public URLs are documented by Cloudflare as development-only and rate-limited. For a personal blog with modest traffic this is acceptable; if traffic ever spikes, the upgrade to a custom Cloudflare domain changes only the `R2_PUBLIC_BASE` value — no code changes.

**Resume signal:** Type "approved" once `.env` is filled in, or describe what went wrong in the Cloudflare dashboard.

## Next Phase Readiness
- **This plan is NOT complete.** Task 1 (script) is done and dry-run verified; Task 2 (bucket provisioning) is blocked pending human action in the Cloudflare dashboard.
- Once `.env` is populated and the checkpoint is resumed, the remaining work is: run the write/read smoke test specified in the plan's Task 2 `<action>` (PUT a throwaway object, curl it back over public HTTPS, confirm 200), then this plan can be marked complete.
- Plans 06-04 (pilot/render-verify) and 06-05 (full R2 upload) both depend on this plan's Task 2 completing — they cannot proceed until real R2 credentials exist.
- No voyage media has been uploaded yet; no MDX file has been modified; the bucket does not yet exist.

---
*Phase: 06-new-post-generation*
*Completed: Task 1 only, 2026-07-28. Task 2 pending human checkpoint.*
