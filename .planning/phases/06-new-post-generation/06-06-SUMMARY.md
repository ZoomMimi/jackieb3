---
phase: 06-new-post-generation
plan: 06
subsystem: content-generation
tags: [anthropic-api, claude-sonnet, multimodal, mdx, narrative-generation]

# Dependency graph
requires:
  - phase: 06-new-post-generation (plan 06-03)
    provides: ".planning/data/narrative-triage.json (user-approved full/transit classification)"
  - phase: 06-new-post-generation (plan 06-05)
    provides: "R2-hosted Gallery URLs on every in-scope post (no file:// entries)"
provides:
  - "scripts/11-draft-narratives.mjs --generate mode: multimodal Claude call drafting first-person narrative + closing verse per full-classified day, byte-preserving Gallery/VoyageStats"
  - "scripts/narrative-viewer.mjs: local review tool (edit/keep-discard/family+per-day memory notes/photo rotate-delete-zoom)"
  - ".planning/data/narrative-notes.json: site-wide family notes + per-day memory notes, consumed automatically by --generate"
  - "Two structurally-verified, human-reviewed pilot narratives proving both range framings"
  - "De facto approval to proceed to bulk generation (06-07), given via 'draft the text as planned for all of these days' after two rounds of real fixes"
affects: [06-07-bulk-narrative-generation, 06-08-review-and-publish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy getClient() ANTHROPIC_API_KEY guard copied verbatim from scripts/07-quality-lift.mjs, so --triage mode still works with no key set"
    - "Image content blocks use source type 'url' pointing straight at public R2 URLs — no base64 download — capped at 20 blocks, evenly sampled across the day when a post has more"
    - "Grounding rule: a person's name is only used when it is legible text in a photo, supplied in narrative-notes.json, or explicit in the data — otherwise a role reference ('my husband', 'the kids') is used instead"
    - "Body rewrite extracts the existing <Gallery> and <VoyageStats> blocks as exact substrings and reuses them byte-for-byte; narrative prose is inserted, never regenerated component markup"
    - "narrative-viewer.mjs follows the existing photo-viewer.mjs/blog-viewer.mjs local-HTTP-server review-tool pattern"

key-files:
  created:
    - scripts/narrative-viewer.mjs
    - .planning/data/narrative-notes.json
  modified:
    - scripts/11-draft-narratives.mjs
    - scripts/verify-phase6.mjs
    - .planning/phases/06-new-post-generation/06-CONTEXT.md
    - src/content/blog/great-loop/2024-04-13-day-723-florida-keys.mdx
    - src/content/blog/great-loop/2023-07-16-day-451-north-channel-on.mdx
    - .planning/data/narrative-draft-report.json
    - package.json

key-decisions:
  - "narrative-viewer.mjs was built as a new local review tool, superseding 06-CONTEXT.md's D-09 ('direct MDX editing, no new review UI') — recorded as superseded, not silently overridden, in commit a821f7c. Direct editing gave no way to supply real names for generically-described people, no per-day memory notes the AI can't infer from photos/GPS, and no fast keep/discard action."
  - "Family notes (site-wide) and per-day memory notes live in .planning/data/narrative-notes.json and are read directly by scripts/11-draft-narratives.mjs's --generate mode, not just from the viewer tool — so bulk/future regeneration benefits from whatever context has been filled in."
  - "Grounding rule tightened mid-checkpoint: an unnamed-but-visible person (e.g. a man on a paddleboard) must get a role reference, not an invented plausible name. The original instruction only forbade inventing people/places/events wholesale; it didn't cover filling in a name for someone real but unnamed. Found because the first pilot draft invented 'Mike' for Barbara's husband before his real name was known to the system."
  - "No single explicit approve/reject verdict was given for the Task 3 checkpoint. The user instead drove two rounds of real fixes (the naming-grounding fix, then the narrative-viewer tool) and then said 'draft the text as planned for all of these days' — treated as the practical go-ahead into plan 06-07's bulk run. This is the de facto approval, recorded here since it never took the form the plan's <resume-signal> anticipated."

patterns-established:
  - "Two-line closing verse format (quoted verse, then 'Book Chapter:verse TRANSLATION' on the next line, no blank line between) — carried into every generated post in 06-07"
  - "Per-range framing instruction keyed off the post's date (Keys-to-New-Bern = Loop finishing, no 'side trip' language; Canada = explicit return, distinct from the 2022 Georgian Bay leg)"

requirements-completed: [POST-03, POST-05]

# Metrics
duration: unknown (spanned multiple sessions; not tracked start-to-finish)
completed: 2026-09-19
---

# Phase 6 Plan 6: Narrative Generation Implementation + Pilot + Voice Sign-off Summary

**Built the `--generate` half of `scripts/11-draft-narratives.mjs` — a multimodal Claude call that drafts first-person narrative in Barbara's voice from R2 photos + Nebo data, byte-preserving the existing Gallery/VoyageStats blocks — proved it on two pilot days, found and fixed a real name-fabrication defect mid-review, built a new local review tool to supply real names/memories the AI can't infer, and received de facto approval to proceed to the bulk run**

## Performance

- **Tasks:** 3 (2 auto tasks + 1 human-verify checkpoint that iterated twice before reaching a practical go-ahead)
- **Files created:** 2 (`scripts/narrative-viewer.mjs`, `.planning/data/narrative-notes.json`)
- **Files modified:** 7

## Accomplishments
- Implemented `--generate` mode: selects only `full`-classified days from the user-approved `narrative-triage.json`, sends up to 20 evenly-sampled R2 photo URLs as `type: 'url'` image blocks plus Nebo `legs` detail (weather/route/ICW markers/named stops), and 3 dated style excerpts pulled from `migrated: true` posts, then rewrites the post body while reusing the existing `<Gallery>` and `<VoyageStats>` blocks byte-for-byte.
- Structural safety holds: the string `fm.draft =` appears nowhere in the generator; it refuses to write to any `draft: false` post even with `--force`; it skips already-drafted posts unless `--force`; it reads classification, never recomputes it.
- Generated and structurally verified two real pilot narratives: `2024-04-13` (Florida Keys, 17 images — the plan's acceptance criteria assumed 19, a stale planning-time estimate; 17 is the real already-uploaded count) and `2023-07-16` (North Channel Ontario, 8 images).
- Found and fixed a real defect during the checkpoint: the model invented "Mike" as a name for an unnamed man on a paddleboard. Tightened the grounding rule so an unnamed-but-visible person gets a role reference ("my husband") instead, and regenerated both pilots with `--force`.
- Built `scripts/narrative-viewer.mjs`, a new local review tool (matching the `photo-viewer.mjs`/`blog-viewer.mjs` pattern) with real-time MDX text editing, a keep/discard checkbox per day, site-wide family notes + per-day memory notes (`.planning/data/narrative-notes.json`, consumed automatically by `--generate`), a "regenerate with notes" button, and photo rotate/delete/zoom (rotate re-uploads to the same R2 key so no MDX edit is ever needed).
- Received the user's practical go-ahead ("draft the text as planned for all of these days") to proceed into the bulk run, after two rounds of real fixes rather than a single explicit approve/reject statement.

## Task Commits

1. **Task 1: Implement `--generate` mode** — `59a9a59` (feat)
2. **Task 2: Generate two pilot narratives** — `0065322` (feat)
3. **Task 3: Human-verify checkpoint** — iterated across three follow-up commits before reaching approval:
   - `42c51c9` (fix) — tightened the naming-grounding rule after the "Mike" fabrication was flagged; both pilots regenerated with `--force`
   - `8a2267a` (chore) — unrelated color-scheme fix picked up in the same worktree session
   - `101abb3` (feat) — built `scripts/narrative-viewer.mjs` with edit/keep-discard/notes workflow, per the user's explicit request for a way to supply real names and per-day memories
   - `a821f7c` (docs) — recorded 06-CONTEXT.md's D-09 as superseded by the new review tool
   - `46ef734` (feat) — added photo rotate/delete/zoom to the viewer

## Files Created/Modified
- `scripts/11-draft-narratives.mjs` — `--generate` mode: multimodal API call, prompt construction, body rewrite, `narrativeDrafted` flag, report; later extended to read `narrative-notes.json` family/memory notes and to skip `keep: false` days
- `scripts/narrative-viewer.mjs` — new local review tool
- `.planning/data/narrative-notes.json` — new: site-wide `familyNotes` + per-day `memory` entries
- `scripts/verify-phase6.mjs` — folds `keep: false` days into `KNOWN_GAP_DATES` automatically
- `.planning/phases/06-new-post-generation/06-CONTEXT.md` — D-09 marked superseded
- `src/content/blog/great-loop/2024-04-13-day-723-florida-keys.mdx`, `src/content/blog/great-loop/2023-07-16-day-451-north-channel-on.mdx` — generated, then regenerated twice (grounding fix, then real family notes)
- `.planning/data/narrative-draft-report.json` — per-run generation report (overwritten each invocation; cumulative totals for the full run are in `06-07-SUMMARY.md`)
- `package.json` — `narrative-viewer` npm script

## Decisions Made

**Approved prompt characteristics (as of the final pilot regeneration):**
- First-person voice anchored on 3 dated style excerpts from `migrated: true` posts, capped ~1200 chars each, imports/components stripped before embedding
- Closing verse required in the two-line quote-then-citation format, explicitly framed to the model as an unverified attempt for Barbara to check
- Per-range framing: Keys-to-New-Bern (2024-04-13..2024-05-17) explicitly forbidden from "side trip"/"excursion" language; Canada (2023-06-05..2023-08-31) explicitly framed as a return, distinct from the 2022 Georgian Bay leg
- Grounding: a name is only used when it's legible text in a photo, supplied in `narrative-notes.json`, or explicit in the data; otherwise a role reference is used
- Up to 20 `type: 'url'` image blocks, evenly sampled when a day has more photos than that (confirmed on a 127-image day: exactly 20 evenly-spaced URLs)

**Verse-accuracy verdict:** Not separately confirmed as accurate or inaccurate during this checkpoint — the user's attention went to the naming defect and the review-tool gap instead. **This means plan 06-08's review must still treat every generated verse citation as unverified** — the mitigation the plan called for (a human specifically judging verse accuracy) did not happen in a form that produced a recorded verdict.

**No formal reject/revise/approve statement.** The checkpoint's `<resume-signal>` asked for the literal word "approved" or a description of prompt changes; neither was given. Instead: (1) the naming defect was found and fixed, (2) a capability gap (no way to supply real names/memories) was found and fixed by building a new tool, (3) the user then said to proceed with generation for "all of these days." That instruction is recorded here as the operative approval for the bulk run, since 06-07 was in fact run afterward based on it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Named finding] Model invented a name for an unnamed visible person**
- **Found during:** Task 3, first checkpoint round — the user reviewed the 2024-04-13 pilot and flagged "Mike" as a name the model made up for the man on the paddleboard.
- **Root cause:** The original grounding instruction forbade inventing people/places/events that aren't evidenced, but didn't explicitly cover the case of a real, visible-but-unnamed person — the model treated "give this person a name" as reasonable narrative color rather than fabrication.
- **Fix:** System prompt now requires a name to be legible text in a photo or supplied explicitly in the data before it's used; otherwise the model must use a role reference.
- **Verification:** Both pilots regenerated with `--force`; 2024-04-13 now says "my husband" instead of "Mike."
- **Committed in:** `42c51c9`

**2. [Named finding] No way to supply ground truth the model can't infer**
- **Found during:** Task 3, after the naming fix — the user asked for a real-time editing tool with keep/discard and a way to supply real names and per-day memories, rather than continuing to iterate on the prompt alone.
- **Fix:** Built `scripts/narrative-viewer.mjs` plus `.planning/data/narrative-notes.json`, consumed directly by `--generate` (not just the tool), so future single-day or bulk regeneration benefits automatically from whatever family/memory context is filled in.
- **Verification:** Regenerating 2024-04-13 with real family notes correctly produced "Mike" and "our daughter and her two kids" in place of the generic role references — tested end-to-end, then kept as the pilot's final content.
- **Committed in:** `101abb3`, `46ef734` (viewer photo tooling)

### Not addressed (carried forward)

**Verse-citation accuracy was never explicitly verified.** Plan 06-08's review of all 59 drafts must treat every closing verse citation as unverified model output, since no round of this checkpoint produced a recorded judgment on whether the pilots' verses were accurate.

## Issues Encountered

None beyond the two findings above, both resolved within this plan's scope.

## User Setup Required

None beyond what plan 06-02 already provisioned. `ANTHROPIC_API_KEY` was already available for `scripts/07-quality-lift.mjs`'s use; this plan reuses the same lazy guard and the same `.env` entry.

## Next Phase Readiness

- `--generate` mode is implemented, dry-run verified, and proven correct on two real days across both range framings.
- The grounding rule and the review-tool's notes mechanism are both wired into the generator itself, so plan 06-07's bulk run automatically benefits from any notes filled in via `narrative-viewer.mjs` before or during that run.
- `NARRATIVE_DRAFTED_POSTS=2`, `DRAFT_POSTS=100` at the close of this plan; `npm run build` passes.
- **Open item carried to 06-08:** verse-citation accuracy is unverified for every generated post, pilots included — this needs explicit human judgment during the review pass, not assumed correctness.
- Ready for plan 06-07 (bulk generation across the remaining 57 full-classified days).

---
*Phase: 06-new-post-generation*
*Completed: 2026-09-19*
