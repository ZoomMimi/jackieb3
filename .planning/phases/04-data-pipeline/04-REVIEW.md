---
phase: 04-data-pipeline
reviewed: 2026-07-18T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - scripts/04-generate-stubs.mjs
  - src/content/blog/great-loop/2022-04-01-day--20-new-bern-nc.mdx
  - src/content/blog/great-loop/2024-05-17-day-757-new-bern-nc.mdx
  - src/content/blog/great-loop/2022-04-22-the-adventure-begins.mdx
  - src/content/blog/great-loop/2022-07-07-oswego-canal-day-77.mdx
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The primary deliverable is `scripts/04-generate-stubs.mjs`, a Node.js ESM script with two jobs: backfilling `miles/hours/lat/lon` into existing MDX posts, and generating ~250 draft MDX stubs for undocumented voyage days. The four MDX files are representative outputs — two generated stubs and two migrated blog posts touched by the backfill path.

The script's frontmatter round-trip logic is generally sound, idempotency guarding is correct, and the conflict-detection for existing posts works. However, two blockers threaten the live site directly: the `draft` field is not in the Astro content schema and the page templates have no draft filter, so all ~250 stubs would be published immediately on next build. Additionally, every generated Gallery references hardcoded `file:///Users/bruhnhome/` paths that are broken outside the developer's machine. Five warnings cover: misleading `undefined` props, no error handling in the stub loop, a fragile frontmatter splitter that could corrupt files with `---` horizontal rules, a round-trip escape-sequence bug, and an inaccurate dry-run.

## Critical Issues

### CR-01: `draft: true` Is Not in Content Schema — All Stubs Will Be Published

**File:** `scripts/04-generate-stubs.mjs:302`
**Also affects:** `src/content.config.ts:6-32`, `src/pages/blog/index.astro:5`, `src/pages/blog/[...id].astro:6`

**Issue:** The script writes `fm.draft = true` into every generated stub, intending to prevent them from appearing in the live site. However:

1. `src/content.config.ts` defines the blog collection schema with `z.object()` but does NOT include a `draft` field.
2. Zod's `z.object()` strips unknown keys silently — after content collection loading, `entry.data.draft` is always `undefined`.
3. `src/pages/blog/index.astro` calls `getCollection('blog')` with **no filter**. All stubs appear in the post listing.
4. `src/pages/blog/[...id].astro` calls `getCollection('blog')` with **no filter**. Static paths are generated for every stub.

Running `astro build` after this script produces ~250 live pages for draft stubs with placeholder content. The `draft: true` front-matter field has zero effect on the build output.

**Fix (two parts):**

Add `draft` to the content schema:
```typescript
// src/content.config.ts
schema: z.object({
  title: z.string(),
  date: z.coerce.date(),
  voyage: z.string(),
  location: z.string(),
  excerpt: z.string(),
  migrated: z.boolean().default(false),
  draft: z.boolean().default(false),   // ← add this
  lifted: z.boolean().default(false),
  // … rest of fields unchanged
})
```

And filter in both page templates:
```astro
// src/pages/blog/index.astro  AND  src/pages/blog/[...id].astro
const posts = await getCollection('blog', ({ data }) => !data.draft);
```

---

### CR-02: Hardcoded Machine-Local `file:///Users/bruhnhome/` Paths in All Generated Stubs

**File:** `scripts/04-generate-stubs.mjs:315`
**Also affects:** `src/content/blog/great-loop/2022-04-01-day--20-new-bern-nc.mdx:19-81`, `src/content/blog/great-loop/2024-05-17-day-757-new-bern-nc.mdx:20-50`

**Issue:** Every generated Gallery image list is built from:
```javascript
`"file:///Users/bruhnhome/Pictures/Photos Library.photoslibrary/originals/${p.directory}/${p.filename}"`
```

`file://` URIs are machine-local. The `Gallery` component passes them directly to `<img src={src}>` without any Astro image processing. Consequences:

- On any machine other than the developer's (CI, Netlify/Vercel build, any collaborator), every stub and the two already-committed output MDX files serve broken `<img>` elements.
- Modern browsers block `file://` resources when a page is served over HTTP, so even if built locally and served via `astro preview` the images are broken.
- The Gallery component (`src/components/Gallery.astro`) uses a plain `<img>` tag — no Astro `<Image>` optimization — so there is no build-time error; the breakage is silent until the page is viewed.
- The paths are now committed to git history in the two sample MDX files.

**Fix:** Replace the hardcoded path with a configurable root determined at run-time, and document that stubs require image migration before publishing:
```javascript
// At top of script — derive from environment or a config file
const PHOTOS_ROOT = process.env.PHOTOS_ROOT
  ?? join(process.env.HOME ?? '', 'Pictures/Photos Library.photoslibrary/originals');

// Line 315 — use the variable
.map(p => `"file://${PHOTOS_ROOT}/${p.directory}/${p.filename}"`)
```

Also add a `<!-- TODO: replace file:// paths before publishing -->` comment in the stub body, or emit a post-run warning listing stubs that contain `file://` paths.

---

## Warnings

### WR-01: `vsProps` Emits `miles={undefined} hours={undefined}` When `nebo` Object Lacks Distance Fields

**File:** `scripts/04-generate-stubs.mjs:318-320`

**Issue:** `vsProps` is built as:
```javascript
const vsProps = (day.nebo != null)
  ? `miles={${fm.miles}} hours={${fm.hours}}`
  : '';
```

`fm.miles` and `fm.hours` are only set when `day.nebo.distanceNm !== undefined` and `day.nebo.underwayHours !== undefined` (lines 308-309). If `day.nebo` is a non-null object that lacks one or both fields, the generated JSX is:
```jsx
<VoyageStats miles={undefined} hours={undefined} />
```

`VoyageStats` handles this gracefully (its `hasData` check returns `false`), so there is no visual defect. However, it produces misleading prop values and would surface as a TypeScript error if the `Props` interface is ever tightened to disallow explicit `undefined`.

**Fix:**
```javascript
const vsProps =
  (day.nebo != null && fm.miles !== undefined && fm.hours !== undefined)
    ? `miles={${fm.miles}} hours={${fm.hours}}`
    : '';
```

---

### WR-02: `parseFrontmatter` Does Not Unescape `\"` — Progressive Corruption on Re-Runs

**File:** `scripts/04-generate-stubs.mjs:68-71`

**Issue:** When a quoted YAML value like `"He said \"hello\""` is read, `parseFrontmatter` strips the outer quotes via `val.slice(1, -1)` but does NOT unescape `\"` → `"`:
```javascript
obj[key] = val.slice(1, -1);  // returns: He said \"hello\"  (literal backslash kept)
```

Then `serializeFrontmatter` re-escapes the `"` that isn't there, turning `\"` into `\\"`:
```javascript
String(v).replace(/"/g, '\\"')  // He said \\"hello\\"
```

Each run of the backfill script on the same file adds one more layer of backslash escaping. Any frontmatter string value that was originally written with `\"` inside a YAML double-quoted string will be progressively corrupted.

Currently no frontmatter field in the reviewed posts contains `\"`, so this is latent. It will surface if the `excerpt` or `coverPhoto` fields ever contain a literal double-quote.

**Fix:**
```javascript
// After stripping outer quotes, unescape YAML double-quote escapes
obj[key] = val.slice(1, -1).replace(/\\"/g, '"');
```

---

### WR-03: `indexOf('\n---', 3)` in Backfill Will Split on `---` Horizontal Rules in MDX Body

**File:** `scripts/04-generate-stubs.mjs:222` (also `splitFrontmatter` at line 45)

**Issue:** Both `splitFrontmatter` and the backfill reconstruction code find the end of the YAML front-matter by calling `text.indexOf('\n---', 3)`. This returns the FIRST occurrence of `\n---` after position 3. In MDX, a `---` on its own line is a valid horizontal rule (thematic break). If any existing post body contains:

```markdown
---

Some section below the rule.
```

…then `indexOf('\n---', 3)` would find that body occurrence first, not the closing front-matter delimiter. The result:

- `fmStr` would contain most of the post body treated as YAML, with `parseFrontmatter` silently dropping un-parseable lines.
- `bodyRaw` = everything after the first in-body `---`, losing the text above it.
- The file is then **rewritten** with the corrupt content.

The existing migrated posts do not appear to have `---` horizontal rules, but this is a silent data-loss risk for any future post that does.

**Fix:** Tighten the search to match only a bare `---` line (no trailing text, but allow `\r`):
```javascript
const FM_CLOSE = /\n---[ \t]*(\r?\n|$)/;
const match = raw.match(FM_CLOSE);
const fmEnd = match ? match.index : -1;
const bodyRaw = fmEnd !== -1 ? raw.slice(fmEnd + match[0].length - (match[1].length)) : '';
```
Or more simply, find `\n---\n` (requiring the line to be exactly `---`):
```javascript
const fmEnd = raw.indexOf('\n---\n', 3);
```

---

### WR-04: No Error Handling in Stub Generation Loop — Partial State on Crash

**File:** `scripts/04-generate-stubs.mjs:260-344`

**Issue:** The backfill loop (lines 195-239) wraps its `writeFileSync` in a `try/catch` that records failures. The stub generation loop (lines 260-344) has no error handling at all. If `writeFileSync` throws mid-loop (e.g., disk full, path collision, permission error), the script terminates with an unhandled exception, the summary block (lines 347-353) never prints, and the `existing` set is not updated in subsequent calls — leaving the operator with no clear picture of which stubs were written and which were not.

**Fix:** Wrap the stub write in a `try/catch` mirroring the backfill pattern:
```javascript
try {
  if (!DRY) {
    writeFileSync(join(POSTS_DIR, filename), content, 'utf8');
    existing.add(filename);
    console.log(`STUB ${filename}`);
  } else {
    console.log(`WOULD STUB ${filename}`);
  }
  stubsCreated++;
} catch (err) {
  console.error(`FAIL_STUB ${filename}: ${err.message}`);
  stubsFailed.push({ filename, error: err.message });
}
```

---

### WR-05: `existing` Set Not Updated in Dry-Run Mode — Inaccurate Collision Simulation

**File:** `scripts/04-generate-stubs.mjs:335-343`

**Issue:** In real mode, `existing.add(filename)` is called after each write, preventing same-run duplicate detection from missing filenames generated earlier in the same execution. In dry-run mode this line is not reached:
```javascript
if (!DRY) {
  writeFileSync(...);
  existing.add(filename);  // ← only reached in real mode
  ...
}
```

If two timeline entries produce the same filename (unlikely given date-unique slugs but possible if location is empty and two dates map to the same string), dry run would log both as `WOULD STUB` while real mode would correctly skip the second via the `existing.has(filename)` guard. Dry run is supposed to simulate real behavior; this discrepancy makes it an unreliable preview tool.

**Fix:**
```javascript
if (!DRY) {
  writeFileSync(join(POSTS_DIR, filename), content, 'utf8');
  console.log(`STUB ${filename}`);
} else {
  console.log(`WOULD STUB ${filename}`);
}
existing.add(filename);  // always update, regardless of DRY
stubsCreated++;
```

---

## Info

### IN-01: Backfilled Fields Appended at End of Frontmatter Rather Than Schema Order

**File:** `scripts/04-generate-stubs.mjs:199-216`

**Issue:** `parseFrontmatter` preserves insertion order (the order fields appear in the source YAML). New fields (`miles`, `hours`, `lat`, `lon`) are set on the parsed object after existing fields, so `serializeFrontmatter` writes them at the end of the YAML block regardless of the schema-defined order (`lat/lon` before `coverPhoto`, `miles/hours` after `lifted`). Posts backfilled by this script will have inconsistent field ordering compared to posts written by other pipeline stages.

**Fix:** After mutation, rebuild the frontmatter object in the canonical schema field order before serializing:
```javascript
const FIELD_ORDER = ['title','date','voyage','location','excerpt','migrated',
  'draft','lifted','miles','hours','stops','startLocation','endLocation',
  'lat','lon','coverPhoto','anchorage','marina','enriched'];
const ordered = {};
for (const k of FIELD_ORDER) if (fm[k] !== undefined) ordered[k] = fm[k];
// carry any extra keys not in FIELD_ORDER
for (const k of Object.keys(fm)) if (!(k in ordered)) ordered[k] = fm[k];
const newContent = `---\n${serializeFrontmatter(ordered)}\n---` + bodyRaw;
```

---

### IN-02: Idempotency Gate Always Passes for Posts Without Nebo Data

**File:** `scripts/04-generate-stubs.mjs:182-190`

**Issue:** The early-exit gate skips a file only when all four fields (`miles`, `hours`, `lat`, `lon`) are already populated. A post that has no Nebo source data can never have `miles` or `hours` filled by this script, so the gate condition is always false. On every re-run, the script will enter the mutation block, find nothing to mutate, and log `SKIP (no new data to add)` — wasting a `readFileSync` call per post per run. This is an inefficiency, not a correctness issue.

**Fix:** Add a secondary check: if the only potentially writable fields are lat/lon and both are already present, skip immediately:
```javascript
const canWriteMiles = day.nebo != null;
const needsMiles  = canWriteMiles && fm.miles === undefined;
const needsHours  = canWriteMiles && fm.hours === undefined;
const needsLat    = fm.lat === undefined && day.centroidLat != null;
const needsLon    = fm.lon === undefined && day.centroidLon != null;
if (!needsMiles && !needsHours && !needsLat && !needsLon) {
  console.log(`SKIP ${slug} (already complete)`);
  backfillSkipped++;
  continue;
}
```

---

_Reviewed: 2026-07-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
