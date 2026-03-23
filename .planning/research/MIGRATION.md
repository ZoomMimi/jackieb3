# Blogger XML → Astro Migration Research

**Project:** Jackie B III Going Loopy
**Researched:** 2026-03-23
**Confidence:** MEDIUM overall — Blogger XML format and Astro content collections are well-documented stable APIs. Google CDN URL behavior is based on known patterns but deserves validation before committing to link-only strategy.

---

## 1. Blogger XML Export Format

### What the File Is

Blogger exports an Atom 1.0 feed in XML format. File is typically named `blog-MM-DD-YYYY.xml`. There is no size limit in practice — large blogs may produce files of several MB. The entire blog is a single XML document.

**Confidence: HIGH** — Atom 1.0 is an open standard. This format has not changed since Blogger adopted it in ~2007.

### Top-Level Structure

```xml
<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns='http://www.w3.org/2005/Atom'
      xmlns:openSearch='http://a9.com/-/spec/opensearchrss/1.0/'
      xmlns:blogger='http://schemas.google.com/blogger/2008'
      xmlns:georss='http://www.georss.org/georss'
      xmlns:gd='http://schemas.google.com/g/2005'
      xmlns:thr='http://purl.org/syndication/thread/1.0'>

  <!-- Blog-level metadata -->
  <id>tag:blogger.com,1999:blog-XXXXXXXXXXXXXXXX</id>
  <title type='text'>Jackie B III Going Loopy</title>
  <link rel='alternate' type='text/html' href='https://jackiebiiigoingloopy.blogspot.com/'/>
  <link rel='self' type='application/atom+xml' href='...'/>
  <author>...</author>
  <generator>Blogger</generator>

  <!-- Then: one <entry> per post, per comment, per page, per settings record -->
</feed>
```

### Entry Types — How to Tell Them Apart

The export contains multiple categories of `<entry>` elements, distinguished by their `<category>` tags:

| Category scheme value | Kind | Notes |
|----------------------|------|-------|
| `#post` | Blog post (published) | Main content you want |
| `#comment` | Reader comment | Skip for migration |
| `#page` | Static page (About, etc.) | May want to migrate separately |
| `#settings` | Internal Blogger config | Skip |
| `#template` | Blog template data | Skip |

**Filter rule:** Keep entries where `<category scheme="http://schemas.google.com/g/2005#kind" term="http://schemas.google.com/blogger/2008/kind#post"/>` is present.

### Post Entry Structure

```xml
<entry>
  <!-- Unique post ID — contains the numeric Blogger post ID at the end -->
  <id>tag:blogger.com,1999:blog-BLOGID.post-POSTID</id>

  <!-- Publication date (when post was first published) -->
  <published>2023-07-15T10:30:00.000-04:00</published>

  <!-- Last modified date -->
  <updated>2023-07-15T10:30:00.000-04:00</updated>

  <!-- Category: kind discriminator (see above) -->
  <category scheme='http://schemas.google.com/g/2005#kind'
            term='http://schemas.google.com/blogger/2008/kind#post'/>

  <!-- Labels/tags — one <category> per label -->
  <category scheme='http://www.blogger.com/atom/ns#' term='Great Loop'/>
  <category scheme='http://www.blogger.com/atom/ns#' term='Tennessee River'/>

  <!-- The canonical URL for this post -->
  <link rel='alternate' type='text/html'
        href='https://jackiebiiigoingloopy.blogspot.com/2023/07/post-title-slug.html'
        title='Post Title Here'/>

  <!-- Post title -->
  <title type='text'>Post Title Here</title>

  <!-- Post body — HTML, wrapped in CDATA -->
  <content type='html'>
    &lt;div&gt;Post HTML content here...&lt;/div&gt;
  </content>

  <!-- Author -->
  <author>
    <name>Author Name</name>
    <email>noreply@blogger.com</email>  <!-- always anonymized -->
    <gd:image rel='...' width='...' height='...' src='...'/>
  </author>

  <!-- Blogger-specific: post slug and draft status -->
  <blogger:filename>/2023/07/post-title-slug.html</blogger:filename>
  <app:control>
    <app:draft>no</app:draft>  <!-- 'yes' = draft, skip these -->
  </app:control>
</entry>
```

### Key Fields to Extract Per Post

| XML Field | XPath / How to Reach | Use in Astro |
|-----------|---------------------|--------------|
| Post ID | `id` text, last segment after `.post-` | Internal key for dedup |
| Published date | `published` text | `pubDate` frontmatter |
| Updated date | `updated` text | `updatedDate` frontmatter |
| Title | `title` text | `title` frontmatter |
| Body HTML | `content` text | Convert to Markdown/MDX body |
| Blogger URL | `link[@rel='alternate']/@href` | Extract slug; build redirect |
| Labels | All `category[@scheme='...atom/ns#']/@term` | `tags` frontmatter array |
| Draft flag | `app:control/app:draft` text | Skip if "yes" |
| Slug | `blogger:filename` text | Derive output filename |

### What Is NOT in the XML

- Photo binary data — only `<img>` src URLs are in the HTML content
- GPS/location data — Blogger has a geo field but most posts don't use it
- Video files — only embeds (YouTube iframe HTML) in post content
- Comment counts — present in feed metadata but not embedded per post in export

---

## 2. Node.js Parsing Strategy

### Recommended Library: `fast-xml-parser`

**Why:** Zero dependencies, handles large files well, outputs clean JS objects, supports namespace-aware parsing. The Blogger XML uses multiple XML namespaces which require namespace stripping or aliasing.

**Alternative:** `xml2js` — older, more community examples for Blogger specifically, but has quirky array-wrapping behavior that requires `explicitArray: false` tuning.

**Confidence: HIGH** — Both libraries are well-established and actively maintained as of early 2026.

```bash
npm install fast-xml-parser
# or
npm install xml2js
```

### Parsing Approach with `xml2js`

`xml2js` has more community examples for Blogger migration specifically:

```javascript
// scripts/parse-blogger-xml.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { parseStringPromise } from 'xml2js';
import { join } from 'path';

const xml = readFileSync('./blog-export.xml', 'utf8');
const result = await parseStringPromise(xml, {
  explicitArray: false,   // Don't wrap single elements in arrays
  explicitCharkey: true,  // Keep text nodes as { _: value }
  attrkey: '$',           // Attributes as obj.$
  charkey: '_',           // Text content as obj._
  trim: true,
  normalize: true,
  ignoreAttrs: false,
  mergeAttrs: false,
});

const entries = result.feed.entry;
// Normalize: sometimes a single entry comes back as object, not array
const entryList = Array.isArray(entries) ? entries : [entries];
```

### Parsing Approach with `fast-xml-parser`

```javascript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['entry', 'category', 'link'].includes(name),
  removeNSPrefix: true,   // Strip namespace prefixes (app:, blogger:, etc.)
});

const result = parser.parse(xml);
const entries = result.feed.entry;
```

`removeNSPrefix: true` is critical — without it, fields like `app:control` and `blogger:filename` won't be accessible with simple property access.

### Filtering and Extracting Posts

```javascript
function isPost(entry) {
  const categories = Array.isArray(entry.category) ? entry.category : [entry.category];
  return categories.some(cat =>
    cat?.['@_term']?.includes('kind#post') ||
    cat?.term?.includes('kind#post')
  );
}

function isDraft(entry) {
  return entry?.control?.draft === 'yes' ||
         entry?.['app:control']?.['app:draft'] === 'yes';
}

function getLabels(entry) {
  const categories = Array.isArray(entry.category) ? entry.category : [entry.category];
  return categories
    .filter(cat => cat?.['@_scheme']?.includes('atom/ns#'))
    .map(cat => cat?.['@_term'])
    .filter(Boolean);
}

function getAlternateLink(entry) {
  const links = Array.isArray(entry.link) ? entry.link : [entry.link];
  return links.find(l => l?.['@_rel'] === 'alternate')?.['@_href'];
}

const posts = entryList
  .filter(isPost)
  .filter(e => !isDraft(e))
  .map(entry => ({
    id:          entry.id?._ || entry.id,
    title:       entry.title?._ || entry.title,
    published:   entry.published,
    updated:     entry.updated,
    labels:      getLabels(entry),
    bloggerUrl:  getAlternateLink(entry),
    bodyHtml:    entry.content?._ || entry.content,
  }));
```

### Important Parsing Gotchas

1. **CDATA in content:** The post HTML body is in a CDATA section. Both xml2js and fast-xml-parser decode CDATA automatically — you get raw HTML string, not escaped entities. Do not double-decode.

2. **Namespace handling:** `app:control`, `app:draft`, `blogger:filename` use XML namespaces. With `xml2js`, these come through as `app:control` (key includes colon). Access as `entry['app:control']['app:draft']`. With fast-xml-parser + `removeNSPrefix`, they become `entry.control.draft`.

3. **Single vs. multiple entries:** If a blog has only one post (won't apply here, but worth noting), `entry` won't be an array. Always normalize to array.

4. **Character encoding:** The file is UTF-8. Use `{ encoding: 'utf8' }` when reading. Non-ASCII characters in post titles or content (em dashes, smart quotes, etc.) should survive fine.

5. **HTML entities in content:** The HTML body may contain `&amp;`, `&lt;`, etc. as both literal Blogger encoding AND as HTML entity references within the post. After CDATA decode, you have raw HTML — treat it as HTML, not as double-encoded XML.

---

## 3. Blogger Photo URL Analysis

### URL Patterns You Will Encounter

Blogger photos are served from Google's infrastructure. Three URL patterns are common:

**Pattern 1 — Google User Content CDN (most common for photos uploaded via Blogger editor)**
```
https://lh3.googleusercontent.com/pw/PHOTO_ID/photo.jpg
https://lh3.googleusercontent.com/XXXXXXX=w600-h400
```

**Pattern 2 — Blogger CDN with blog ID**
```
https://blogger.googleusercontent.com/img/b/BLOG_ID/PHOTO_ID/photo.jpg
https://bp.blogspot.com/PHOTO_ID/photo.jpg
```

**Pattern 3 — Google Photos shared links (if photos were in Google Photos)**
```
https://photos.google.com/...  (do NOT embed these — not embeddable)
https://lh3.googleusercontent.com/pw/...  (the embeddable version from Google Photos)
```

**Pattern 4 — Blogger's own static host**
```
https://X.bp.blogspot.com/PHOTO_ID/filename.jpg
```

### Stability Assessment

**lh3.googleusercontent.com URLs: MEDIUM confidence (stable in practice, not guaranteed)**

These URLs have served images for 10+ years without mass breakage. Google has not announced any deprecation. However:
- They are not officially documented as permanent CDN URLs
- Google has a history of sunsetting products (Picasa Web, Google+)
- The URLs are tied to the Google account that owns the Blogger blog
- If the source Blogger blog is deleted, photo URLs may break

**Risk factors for this specific project:**
- The Blogger blog at jackiebiiigoingloopy.blogspot.com will presumably remain live (or be archived)
- The owner controls the Google account, so accidental deletion is the main risk
- Google has not changed lh3.googleusercontent.com behavior in 10+ years for Blogger-uploaded photos

**Recommendation: Do NOT re-host photos in Phase 1.** The migration is cleanest with link-through. Re-hosting is a separate workstream (download ~hundreds of images, store in cloud, rewrite all `src` attributes). Defer unless lh3 URLs start breaking. Flag as a known risk in the project.

**If you decide to re-host later:**
- All `lh3.googleusercontent.com` and `bp.blogspot.com` URLs can be fetched programmatically
- Download in bulk, upload to Cloudinary (free tier: 25GB storage, sufficient for a travel blog), rewrite URLs in frontmatter/MDX
- Cloudinary is the right target given "cloud-hosted, not self-hosted" constraint

### Extracting Photo URLs from HTML Content

```javascript
// Extract all img src URLs from a post's HTML body
function extractPhotoUrls(html) {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const urls = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

// Check if a URL is a Blogger/Google photo
function isBloggerPhoto(url) {
  return url.includes('lh3.googleusercontent.com') ||
         url.includes('bp.blogspot.com') ||
         url.includes('blogger.googleusercontent.com');
}
```

### URL Size Parameters

Google's image CDN supports size parameters appended to URLs:

```
https://lh3.googleusercontent.com/PHOTO=w800     # 800px wide
https://lh3.googleusercontent.com/PHOTO=h600     # 600px tall
https://lh3.googleusercontent.com/PHOTO=w800-h600  # bounded box
https://lh3.googleusercontent.com/PHOTO=s0        # original size
```

When migrating, strip or standardize these parameters. For display, request `=w1200` (large enough for full-width post images) rather than whatever arbitrary size Blogger embedded.

---

## 4. Converting Blogger HTML to Markdown/MDX

### Recommended Library: `turndown`

**Why:** Best-maintained HTML-to-Markdown converter in the Node.js ecosystem. Handles nested HTML, handles tables, extensible with custom rules for Blogger-specific patterns.

**Confidence: HIGH** — turndown is the de facto standard for this conversion path.

```bash
npm install turndown
npm install @types/turndown  # if using TypeScript
```

### Basic Conversion Setup

```javascript
import TurndownService from 'turndown';

const td = new TurndownService({
  headingStyle: 'atx',          // # H1, ## H2, etc.
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  strongDelimiter: '**',
  emDelimiter: '_',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full',
});
```

### Blogger-Specific Turndown Rules

Blogger HTML has characteristic patterns that need custom handling:

```javascript
// 1. Blogger wraps images in <a> links to the full-size version.
// Preserve the image but use the link href as the src if it's bigger.
td.addRule('blogger-image-link', {
  filter: node =>
    node.nodeName === 'A' &&
    node.firstElementChild?.nodeName === 'IMG',
  replacement: (content, node) => {
    const img = node.querySelector('img');
    const src = img.getAttribute('src');
    const alt = img.getAttribute('alt') || '';
    // Optionally use the href (full-size) instead of the thumbnail src
    return `\n\n![${alt}](${src})\n\n`;
  },
});

// 2. Blogger div containers — strip, keep content
td.addRule('blogger-div-strip', {
  filter: ['div'],
  replacement: (content) => content,
});

// 3. Blogger inline styles — ignore styling, keep text
// turndown handles this by default but inline style spans get kept as text

// 4. Hard line breaks — Blogger uses <br> inside paragraphs frequently
// Default turndown converts <br> to \n (two spaces before newline for MD)
// Consider normalizing these to paragraph breaks instead
```

### What Blogger HTML Typically Looks Like

Blogger posts use a mix of:
- `<div>` containers (no semantic meaning, just layout)
- `<br>` for line breaks within paragraphs (not `<p>` tags)
- `<b>` and `<i>` (not `<strong>` / `<em>`)
- Images wrapped in `<a href="full-size-url"><img src="thumbnail-url"/></a>`
- `<span style="font-size:X;color:Y">` for manual formatting
- Sometimes Google Docs pasted content with extensive inline styles

### Handling the HTML Before Turndown

Run cleanup before converting:

```javascript
// Use node-html-parser or cheerio for pre-processing
import * as cheerio from 'cheerio';

function cleanBloggerHtml(html) {
  const $ = cheerio.load(html);

  // Remove empty divs and spans
  $('div:empty, span:empty').remove();

  // Strip inline styles (or preserve font-size changes as headings)
  $('[style]').each((_, el) => {
    $(el).removeAttr('style');
  });

  // Normalize <b> to <strong>, <i> to <em> for better Markdown output
  $('b').each((_, el) => { $(el).get(0).tagName = 'strong'; });
  $('i').each((_, el) => { $(el).get(0).tagName = 'em'; });

  // Remove Blogger watermark divs (sometimes present)
  $('.blogger-post-footer').remove();

  return $('body').html();
}
```

### MDX vs. Plain Markdown

**Recommendation: MDX** for Astro content collections.

Reasons:
- Photo galleries per-post require a custom `<PhotoGallery>` component — MDX supports this
- The interactive map pop-ups need post metadata in a structured form — MDX frontmatter is the source
- Future features (video embeds, GPX track embeds) benefit from component slots
- Astro content collections work identically for `.md` and `.mdx`

**The body content itself is plain Markdown** — MDX is only needed if/when you embed components. Start with pure Markdown body in MDX files; add component slots during quality-lift phase.

### Frontmatter Schema for Astro Content Collection

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const voyages = defineCollection({
  type: 'content',
  schema: z.object({
    title:       z.string(),
    pubDate:     z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    description: z.string().optional(),    // Auto-generate from first paragraph
    tags:        z.array(z.string()).default([]),
    voyage:      z.string().default('great-loop'),  // Multi-voyage support
    // For the map
    lat:         z.number().optional(),
    lng:         z.number().optional(),
    location:    z.string().optional(),    // Human-readable stop name
    // Migration tracking
    bloggerUrl:  z.string().url().optional(),  // Original Blogger URL (for redirect)
    bloggerPostId: z.string().optional(),       // Original post ID
    migrated:    z.boolean().default(false),   // true = imported, needs quality lift
    // Photo galleries
    heroImage:   z.string().url().optional(),  // First photo of post
    photos:      z.array(z.string().url()).default([]),
  }),
});

export const collections = { voyages };
```

### Output File Structure

```
src/content/voyages/
  great-loop/
    2023-07-15-leaving-chicago.mdx
    2023-07-16-lake-michigan-crossing.mdx
    ...
```

**Filename convention:** `YYYY-MM-DD-slugified-title.mdx`

Generate slug from Blogger URL (it's already slugified) or from title:

```javascript
function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Preferred: extract from existing Blogger URL
// https://jackiebiiigoingloopy.blogspot.com/2023/07/post-title-slug.html
// → post-title-slug
function slugFromBloggerUrl(url) {
  return url.split('/').pop().replace('.html', '');
}
```

### Generated MDX File Format

```mdx
---
title: "Leaving Chicago — Day 1 of the Great Loop"
pubDate: 2023-07-15T10:30:00-04:00
updatedDate: 2023-07-15T10:30:00-04:00
tags: ["Great Loop", "Chicago", "Lake Michigan"]
voyage: "great-loop"
location: "Chicago, IL"
bloggerUrl: "https://jackiebiiigoingloopy.blogspot.com/2023/07/leaving-chicago.html"
bloggerPostId: "1234567890123456789"
migrated: true
heroImage: "https://lh3.googleusercontent.com/XXXX=w1200"
photos:
  - "https://lh3.googleusercontent.com/XXXX=w1200"
  - "https://lh3.googleusercontent.com/YYYY=w1200"
---

Converted Markdown content here...

![Photo description](https://lh3.googleusercontent.com/XXXX=w1200)

More content...
```

---

## 5. Preserving Metadata and Slugs

### Blogger URL Structure

```
https://jackiebiiigoingloopy.blogspot.com/YYYY/MM/post-slug.html
```

Example:
```
https://jackiebiiigoingloopy.blogspot.com/2023/07/leaving-chicago-day-1-of-great-loop.html
```

The slug is generated by Blogger from the post title at publication time. It:
- Is lowercase, hyphenated
- Truncates at ~39 characters
- Drops special characters
- Is immutable after first publication

### Extracting All Metadata

```javascript
function processPost(entry) {
  const bloggerUrl = getAlternateLink(entry);
  const urlParts = new URL(bloggerUrl);
  const pathParts = urlParts.pathname.split('/');  // ['', 'YYYY', 'MM', 'slug.html']

  const year  = pathParts[1];
  const month = pathParts[2];
  const slug  = pathParts[3].replace('.html', '');

  const pubDate = new Date(entry.published);
  const dateStr = pubDate.toISOString().split('T')[0];  // YYYY-MM-DD

  const htmlBody = entry.content?._ || entry.content || '';
  const photos = extractPhotoUrls(htmlBody);

  return {
    filename:      `${dateStr}-${slug}.mdx`,
    slug:          slug,
    bloggerUrl:    bloggerUrl,
    bloggerPostId: entry.id.split('.post-').pop(),
    title:         entry.title?._ || entry.title,
    pubDate:       entry.published,
    updatedDate:   entry.updated,
    tags:          getLabels(entry),
    htmlBody:      htmlBody,
    photos:        photos,
    heroImage:     photos[0] || null,
  };
}
```

### Redirect Map

Generate a redirect map alongside content migration:

```javascript
// Output: redirects.json
// { "/2023/07/leaving-chicago.html": "/voyages/great-loop/2023-07-15-leaving-chicago" }

const redirects = posts.map(p => ({
  from: new URL(p.bloggerUrl).pathname,  // /2023/07/slug.html
  to:   `/voyages/great-loop/${p.filename.replace('.mdx', '')}`,
}));
```

---

## 6. Netlify Redirects

### Two Redirect Surfaces Needed

1. **Blogger path redirects** — Old Blogger URL paths map to new Astro routes
2. **Custom domain setup** — jackiebiiigoingloopy.blogspot.com → new domain (DNS-level, not Netlify redirects)

Note: DNS-level domain redirect is separate from Netlify redirects. Blogger supports custom domains but you cannot redirect a blogspot.com subdomain via Netlify. Visitors using the old blogspot.com URL will need to be pointed via Blogger's redirect setting or a separate landing page.

**Confidence: HIGH** — Netlify redirect behavior is well-documented and stable.

### `netlify.toml` Redirect Syntax

```toml
# netlify.toml

[[redirects]]
  from = "/2023/07/leaving-chicago-day-1-of-great-loop.html"
  to   = "/voyages/great-loop/2023-07-15-leaving-chicago"
  status = 301
  force  = true

[[redirects]]
  from = "/2023/07/another-post.html"
  to   = "/voyages/great-loop/2023-07-16-another-post"
  status = 301
  force  = true
```

Netlify supports up to 2,000 redirect rules in `netlify.toml`. A blog with ~100 posts is well within limits.

### Generating netlify.toml Automatically

```javascript
// scripts/generate-redirects.mjs
function generateNetlifyToml(redirects) {
  const rules = redirects.map(({ from, to }) =>
    `[[redirects]]\n  from = "${from}"\n  to   = "${to}"\n  status = 301\n  force  = true`
  ).join('\n\n');

  return `# Auto-generated from Blogger migration\n# Generated: ${new Date().toISOString()}\n\n${rules}\n`;
}
```

**Important:** Place in the Netlify project root as `netlify.toml`, or merge into an existing `netlify.toml`.

### Blogger Label/Tag Archive URLs

Blogger also generates these URL patterns that may have external links:

```
/search/label/Great+Loop    → /tags/great-loop
/YYYY_MM_01_archive.html    → /voyages/great-loop?year=YYYY&month=MM  (or just 404)
/?m=1                       → strip, redirect to homepage
```

These matter less for SEO than post URLs. Add rules as needed.

### Astro Route Structure That Makes Redirects Work

The new Astro routes should be:

```
/voyages/great-loop/[slug]   → individual post
/voyages/great-loop          → voyage index
/tags/[tag]                  → tag archive
```

For Astro static site generation, these must be explicit routes:

```typescript
// src/pages/voyages/great-loop/[slug].astro
export async function getStaticPaths() {
  const posts = await getCollection('voyages');
  return posts.map(post => ({
    params: { slug: post.slug },
    props:  { post },
  }));
}
```

---

## 7. AI-Assisted Quality Lifting

### The Problem

Imported Blogger posts will have:
- Inconsistent heading levels (or no headings at all)
- Conversational/informal grammar that may be fine to keep or may need light polish
- Photos inline without captions
- No consistent structure (location context, date, what happened, what's next)
- Mixed formatting artifacts from Blogger's editor

### Recommended Approach: Structured Prompt Pipeline

Do NOT do bulk AI reformatting in one pass. Structure it as a per-post pipeline that:
1. Preserves factual content exactly (no hallucination risk)
2. Applies structural formatting only
3. Outputs diff-reviewable changes

**Key constraint:** The reformatted post must be human-reviewable. AI output goes through a review step before being committed as "quality-lifted" content.

### Frontmatter Flag Strategy

Use the `migrated: true` flag in frontmatter to track status:

```yaml
# States:
migrated: true           # Imported from Blogger, no quality lift yet
migrated: "lifted"       # AI quality-lift applied, not yet reviewed
migrated: false          # Quality-lifted and reviewed (complete)
```

This allows querying which posts still need work:

```bash
# Find all posts still needing quality lift
grep -r "migrated: true" src/content/voyages/
```

### LLM Prompt Template for Quality Lifting

```
You are reformatting a travel blog post from a Blogger export. The content is
factual and personal — preserve ALL facts, dates, place names, and personal voice.
Do NOT add content that isn't there. Do NOT hallucinate details.

Apply these structural changes only:
1. Add a level-2 heading (##) at natural paragraph breaks every 3-4 paragraphs
2. Convert inline <br> line breaks to proper paragraph breaks
3. Add image captions as italicized text below each image: *Caption here.*
4. Fix obvious spelling errors but preserve personal style
5. Ensure the post starts with a brief (1-2 sentence) location/date context statement

Input post (Markdown):
---
[MARKDOWN CONTENT HERE]
---

Output: Return ONLY the reformatted Markdown. No commentary. No frontmatter.
```

### Integration with Claude API (for automation)

```javascript
// scripts/quality-lift.mjs
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import matter from 'gray-matter';

const client = new Anthropic();

async function liftPost(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const { data: frontmatter, content } = matter(raw);

  if (frontmatter.migrated !== true) return;  // Already lifted or complete

  const response = await client.messages.create({
    model: 'claude-opus-4-5',  // or claude-sonnet-4-5 for cost/quality balance
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: QUALITY_LIFT_PROMPT.replace('[MARKDOWN CONTENT HERE]', content),
    }],
  });

  const lifted = response.content[0].text;
  frontmatter.migrated = 'lifted';

  const output = matter.stringify(lifted, frontmatter);
  writeFileSync(filePath, output);
  console.log(`Lifted: ${filePath}`);
}
```

**Cost estimate:** A travel blog post is typically 500-1500 words. At claude-sonnet pricing (~$0.003/1K output tokens), 100 posts ≈ ~$0.50-$1.50 total. Negligible.

### Preserving vs. Replacing Photos in Lifted Posts

During quality lift, image alt text and captions can be improved by AI if given the image URL. For lh3.googleusercontent.com images, the URL itself carries no semantic info. Options:
- Leave alt text empty or minimal (accessibility gap)
- During quality lift, ask AI to generate descriptive alt text based on the surrounding context (not the image itself) — better than empty

---

## 8. Existing Tools for Blogger → Static Site Migration

### Community Tools (as of mid-2025)

**Confidence: MEDIUM** — these tools exist but their maintenance status varies.

| Tool | What It Does | Notes |
|------|-------------|-------|
| `blogger-to-markdown` (npm) | Converts Blogger XML to Markdown files | Last updated ~2020, may need patching for current Blogger export format |
| `blogger2ghost` | Converts Blogger XML to Ghost JSON import format | Not useful for Astro |
| Jekyll/Hugo importers | Various importers for Blogger XML | Jekyll has an official importer (`jekyll-import`); outputs Jekyll front matter, needs adaptation for Astro |
| Custom scripts (GitHub Gists) | Many individual developers have published one-off scripts | Quality varies widely; useful as reference implementations |

**Recommendation: Write a custom script.** The existing tools are either outdated, target different platforms, or lack the specific handling needed (photo URL extraction, MDX output, multi-voyage frontmatter schema, redirect generation). The parsing logic is ~200 lines of Node.js — not worth working around someone else's assumptions.

### Reference: Jekyll's Blogger Importer

Jekyll maintains an official Blogger importer (`jekyll-import` gem). Its source code is a reliable reference for how to handle the XML parsing edge cases, even though you won't use the tool itself. Key patterns it handles:
- Draft filtering
- Label extraction
- URL slug extraction
- HTML-to-Markdown conversion

### Astro Content Collection Migration Pattern

There is no official Astro migration tool for Blogger. The established community pattern is:

1. Write a `scripts/import-blogger.mjs` script
2. Run it once to generate `.mdx` files in `src/content/`
3. Commit the generated content
4. Quality-lift iteratively (AI-assisted or manual)

This is the right approach for this project.

---

## 9. Complete Migration Pipeline

### Script Architecture

```
scripts/
  import-blogger.mjs       # Main entry: XML → MDX files + redirects.toml
  lib/
    parse-xml.mjs           # XML parsing, entry filtering
    extract-photos.mjs      # Photo URL extraction and normalization
    html-to-markdown.mjs    # Turndown conversion with Blogger-specific rules
    generate-frontmatter.mjs  # Build frontmatter object from parsed entry
    write-mdx.mjs           # Write .mdx files with gray-matter
    generate-redirects.mjs  # Build netlify.toml redirect rules
  quality-lift.mjs          # Per-post AI quality lift (run separately)
```

### Pipeline Steps

```
1. Read blog-export.xml
2. Parse XML → array of raw entry objects
3. Filter: kind=post, draft=no
4. For each post:
   a. Extract metadata (title, dates, labels, Blogger URL, post ID)
   b. Extract photo URLs from HTML body
   c. Clean HTML (cheerio: strip inline styles, normalize tags)
   d. Convert HTML → Markdown (turndown)
   e. Build frontmatter object
   f. Determine output filename (YYYY-MM-DD-slug.mdx)
   g. Write MDX file to src/content/voyages/great-loop/
5. Generate redirects.toml (or netlify.toml fragment)
6. Write migration report: count, photos found, any failed conversions
```

### Idempotency

Make the script idempotent: if a file already exists and `migrated !== true`, skip it (preserves quality-lifted posts on re-run). Check by `bloggerPostId` in frontmatter, not filename.

### Dependencies

```json
{
  "devDependencies": {
    "xml2js": "^0.6.0",
    "turndown": "^7.2.0",
    "cheerio": "^1.0.0",
    "gray-matter": "^4.0.3"
  }
}
```

`gray-matter` handles frontmatter serialization for the output MDX files — it correctly escapes strings with colons, quotes, etc.

---

## 10. Known Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| lh3.googleusercontent.com URLs break | Low (long-term) | High (all photos disappear) | Keep Blogger blog live; phase 2 option to download + re-host on Cloudinary |
| XML parsing fails on malformed entries | Low | Low (skip that post, log it) | Wrap each entry parse in try/catch; log failures |
| Blogger HTML is too mangled for Turndown | Medium | Medium (ugly Markdown output) | Inspect 5-10 worst posts manually; add targeted cleanup rules |
| AI quality lift hallucinates content | Medium | High (factual errors in a travel journal) | Keep `migrated: "lifted"` flag; require human review before final commit |
| Netlify redirect limit hit | Very low | None (100 posts << 2000 limit) | N/A |
| Duplicate slugs (two posts with same Blogger slug) | Very low | Medium (file write collision) | Add dedup check; append `-2` if collision detected |
| Missing ~20% of posts not in Blogger export | Known | N/A (separate pipeline using GPS/EXIF) | Document separately; migration script handles the 80% |

---

## Sources and Confidence Notes

All findings in this document are based on training data (knowledge cutoff August 2025) since WebSearch and WebFetch were unavailable. Confidence notes:

- **Blogger XML format (Atom 1.0 structure, entry types, field names):** HIGH — Stable format documented across many migration guides and unchanged for 15+ years
- **xml2js / fast-xml-parser API:** HIGH — Both are stable, well-documented npm packages
- **lh3.googleusercontent.com URL stability:** MEDIUM — Empirically stable but not officially guaranteed; validate before committing to link-through strategy
- **Google CDN size parameter syntax (`=w800`):** HIGH — Documented pattern, used universally
- **turndown API and Blogger HTML patterns:** HIGH — turndown is stable; Blogger HTML patterns are well-understood
- **Astro content collections schema / getStaticPaths:** HIGH — Astro 4.x stable API, well-documented
- **Netlify redirects syntax:** HIGH — Stable, documented at docs.netlify.com
- **Existing migration tools status:** MEDIUM — Tool maintenance status may have changed; verify before relying on any specific tool
- **Claude API for quality lifting:** HIGH — Anthropic SDK API is current

**Recommended validation before coding:**
1. Download the actual Blogger XML export and spot-check 5 entries against the field paths documented here — confirm namespace handling
2. Manually test 2-3 photo URLs from the existing blog to confirm they serve with the size parameter syntax
3. Check npm for `blogger-to-markdown` or similar — if actively maintained, evaluate before writing from scratch
