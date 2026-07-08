---
phase: 02-blogger-migration
reviewed: 2026-07-08T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - scripts/import-blogger.mjs
  - src/components/Gallery.astro
  - src/components/VideoEmbed.astro
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-08
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed: the Blogger import script (`import-blogger.mjs`), a gallery grid component (`Gallery.astro`), and a YouTube embed component (`VideoEmbed.astro`).

`Gallery.astro` is clean — no findings. The import script has one crash-on-input bug that would abort the entire migration for any Blogger post missing an `alternate` link, plus minor quality gaps. `VideoEmbed.astro` accepts an arbitrary URL and places it verbatim into an `<iframe src>`, creating an injection vector. Three informational items round out the report.

---

## Critical Issues

### CR-01: `extractSlug` throws `TypeError` on empty `postUrl`, crashing the entire import

**File:** `scripts/import-blogger.mjs:209`

**Issue:** In `fetchAllPosts`, a Blogger entry with no `alternate` link produces `postUrl = ''` (line 54: `?? ''`). In the main processing loop, `extractSlug(post.postUrl)` is called unconditionally without a guard. `new URL('')` throws `TypeError: Invalid URL`, which is unhandled and terminates the Node.js process — discarding any posts already processed in that run.

The coverage-validation section at line 252 correctly guards with `if (!entry.postUrl) continue;` before calling `extractSlug`, but the main loop at line 209 has no equivalent guard.

Confirmed: `node -e "new URL('')"` throws `TypeError: Invalid URL`.

**Fix:**
```js
// In the main processing loop, add a guard before extractSlug:
for (const post of posts) {
  if (!post.postUrl) {
    console.log(`  [skip] ${post.date} "${post.title}" — no alternate link (postUrl empty)`);
    skipped++;
    continue;
  }
  const slug = extractSlug(post.postUrl);
  // ...rest of loop
}
```

---

### CR-02: `VideoEmbed.astro` passes arbitrary URL to `<iframe src>` without scheme validation

**File:** `src/components/VideoEmbed.astro:9,13`

**Issue:** When the `url` prop is not recognized as a YouTube URL, `embedUrl` falls back to the raw `url` value (line 9), which is then set verbatim as the `src` of an `<iframe>` (line 13):

```js
const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
```

Astro escapes HTML entities in template expressions but does not block URL schemes. A caller passing `url="javascript:alert(document.cookie)"` or a `data:` URI produces a live `<iframe src="javascript:...">` — a known cross-origin execution vector in all major browsers. The component's own interface comment says non-YouTube URLs fall through as-is, making this an intentional but unsafe API.

Since the site uses MDX with author-controlled content the immediate exploitability is low, but the component ships no guardrail and the API contract documents no restriction on input schemes.

**Fix:**
```js
// After extracting videoId, validate the fallback URL's scheme:
const ALLOWED_SCHEMES = ['https:', 'http:'];

function getSafeEmbedUrl(url: string, videoId: string | undefined): string {
  if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  try {
    const parsed = new URL(url);
    if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
      console.warn(`VideoEmbed: rejected unsafe URL scheme "${parsed.protocol}"`);
      return '';
    }
    return url;
  } catch {
    return '';
  }
}

const embedUrl = getSafeEmbedUrl(url, videoId);
```

Then guard the `<iframe>` render: `{embedUrl && <iframe src={embedUrl} ...>}`.

---

## Warnings

### WR-01: `public/_redirects` is always clobbered — manually added rules are silently discarded

**File:** `scripts/import-blogger.mjs:235-240`

**Issue:** The script unconditionally writes a fresh `_redirects` file on every run:

```js
const redirectsContent = [
  '# Blogger -> Astro 301 redirects ...',
  ...redirectLines,
].join('\n') + '\n';

writeFileSync(REDIRECTS_PATH, redirectsContent);
```

If `public/_redirects` later acquires additional hand-authored redirect rules (SPA fallback, form redirects, etc.), the next run of `import-blogger.mjs` silently overwrites them. There is no read-then-merge step.

**Fix:** Read and preserve existing non-Blogger rules before writing:
```js
// Read existing lines that are NOT from this script
let existingRules = '';
if (existsSync(REDIRECTS_PATH)) {
  const current = readFileSync(REDIRECTS_PATH, 'utf8');
  // Strip the auto-generated block (everything from the header comment onward)
  const autoGenMarker = '# Blogger -> Astro 301 redirects';
  const idx = current.indexOf(autoGenMarker);
  existingRules = idx > 0 ? current.slice(0, idx).trimEnd() + '\n\n' : '';
}
writeFileSync(REDIRECTS_PATH, existingRules + redirectsContent);
```

---

### WR-02: No output directory creation — throws `ENOENT` on a clean checkout

**File:** `scripts/import-blogger.mjs:84, 229, 240`

**Issue:** Three `writeFileSync` calls assume their target directories already exist:

- Line 84: writes cache to `.planning/data/blog-posts-full.json`
- Line 229: writes MDX files to `src/content/blog/great-loop/`
- Line 240: writes `public/_redirects`

If any of these directories is absent (fresh clone, directory accidentally deleted), Node throws `ENOENT: no such file or directory` with no helpful message. The script has no `mkdirSync` / `mkdir -p` calls anywhere.

**Fix:** Add directory guards before the first write to each target:
```js
import { mkdirSync } from 'node:fs';

// Near the top, after defining path constants:
mkdirSync(DATA_DIR,  { recursive: true });
mkdirSync(MDX_DIR,   { recursive: true });
mkdirSync(dirname(REDIRECTS_PATH), { recursive: true });
```

---

### WR-03: Missing `published` field produces `date: ` (empty) in MDX frontmatter

**File:** `scripts/import-blogger.mjs:53, 173`

**Issue:** When a Blogger entry lacks a `published` field, `date` defaults to `''` via:
```js
const published = (entry.published?.$t ?? '').slice(0, 10);
```

This empty string propagates into the MDX frontmatter (line 173):
```yaml
date: 
```

An empty bare YAML value parses as `null`. Astro content collections with a `z.date()` or `z.string()` schema for `date` will throw a validation error at build time for this file, failing the entire site build.

Additionally, `extractSlug` is called before the date guard (CR-01 fix above), so this can also produce a filename like `-<slug>.mdx` with a leading hyphen, which may confuse file-system tools.

**Fix:**
```js
// In the main loop, skip or warn on posts with no date:
if (!post.date) {
  console.warn(`  [skip] "${post.title}" — missing published date, cannot write MDX`);
  skipped++;
  continue;
}
```

---

## Info

### IN-01: Diagnostic debug log for first 5 posts left unconditionally in production code

**File:** `scripts/import-blogger.mjs:201-206`

**Issue:** Every run of the script logs label data for the first 5 posts, with an internal comment referencing "RESEARCH.md Open Q1". This was a debugging aid that should be removed before this script is considered stable:

```js
// Log first 5 posts' label data to confirm field structure (RESEARCH.md Open Q1)
console.log('  Label data for first 5 posts:');
for (let i = 0; i < Math.min(5, posts.length); i++) {
  ...
}
```

**Fix:** Remove lines 201-206 once label behavior is confirmed. If the diagnostic is valuable to keep, gate it behind a `--verbose` or `--debug` flag.

---

### IN-02: No upper bound on API pagination loop — theoretically unbounded

**File:** `scripts/import-blogger.mjs:42-66`

**Issue:** The `while (true)` loop that pages through the Blogger Atom feed has no hard page-count limit. For a 72-post blog (3 pages of 25) this is benign, but if the API returns malformed responses that always indicate more pages exist, the loop runs indefinitely. No timeout or max-page guard is present.

**Fix:** Add a page cap as a safety net:
```js
const MAX_PAGES = 20; // 20 × 25 = 500 posts max
let page = 0;

while (page++ < MAX_PAGES) {
  // ...existing loop body...
}
if (page > MAX_PAGES) {
  console.warn(`  [warning] Stopped after ${MAX_PAGES} pages — check API for unexpected responses`);
}
```

---

### IN-03: Deprecated `frameborder="0"` HTML attribute on `<iframe>`

**File:** `src/components/VideoEmbed.astro:17`

**Issue:** `frameborder` is an obsolete HTML4 attribute. The equivalent `border: none` is already applied by the component's own stylesheet (line 38). The attribute is harmless but adds noise and will trigger HTML validators.

**Fix:** Remove `frameborder="0"` from the `<iframe>` element. The CSS rule on `.video-embed iframe { border: none; }` already handles it.

---

_Reviewed: 2026-07-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
