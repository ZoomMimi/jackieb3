// rehype-bible-verse.mjs
//
// Nearly every migrated post ends with a closing Bible verse + citation,
// e.g. `"For this God is our God..." Psalms 48:14 NIV`. In the source
// Markdown these show up in several different shapes:
//   - quote and citation as two separate paragraphs (blank line between)
//   - quote and citation merged into one paragraph via a soft line break
//   - quote and citation on one line with no break at all, just a space
//     after the closing quote mark
//   - citation with no translation code at all ("Psalm 31:19")
//   - translation code in parens, or with a trailing digit-year ("NASB1995")
//   - a trailing bare bible.com link, either as its own paragraph or as one
//     more soft-broken line in the same paragraph as the citation
// Some were pasted from a Bible app and carry invisible bidi override
// characters (U+202A-U+202E) around each word. This finds the trailing
// quote+citation(+link), strips the bidi junk, and rewraps it as
// <blockquote class="verse-frame"><p>quote</p><footer>— <cite>ref</cite></footer></blockquote>
// so it can be styled as its own framed callout instead of a plain
// paragraph.
//
// Deliberately NOT handled: a citation fused into ordinary narrative prose
// with no quote marks and no line break at all (e.g. "...grace upon grace.
// John 1:16") — too easy to false-positive on an ordinary time-of-day
// mention ("back at the dock by 4:30").
import { toText } from 'hast-util-to-text';

const VERSION_ALT =
  '(?:NIV|NKJV|KJV|NLT|ESV|RSV|ASV|MSG|NASB|CSB|NRSV|NABRE|AMP|CEV|TLB|NET|GNT|GW|HCSB)\\d{0,4}';
// Whole-string citation: "Book Chapter:Verse[-Verse] [VERSION]", tolerant of
// a wrapping paren around the whole thing or just the version.
const CITATION_RE = new RegExp(
  `^\\(?\\s*((?:[1-3]\\s)?[A-Za-z][A-Za-z .]*?)\\s+(\\d+\\s*:\\s*\\d+(?:-\\d+)?)\\s*\\)?` +
  `\\s*\\(?\\s*(${VERSION_ALT})?\\s*\\)?\\s*\\.?\\s*$`
);
// Quote-mark-terminated quote directly followed by a citation, no line
// break — e.g. `"...end of quote." Book 1:2 NIV`. Requires the text right
// before the citation to close with a quotation mark, which is what keeps
// this from matching an ordinary sentence that happens to end in a number.
const QUOTE_CITATION_RE = new RegExp(
  `^(.*[”"'])\\s+` +
  `\\(?\\s*((?:[1-3]\\s)?[A-Za-z][A-Za-z .]*?)\\s+(\\d+\\s*:\\s*\\d+(?:-\\d+)?)\\s*\\)?` +
  `\\s*\\(?\\s*(${VERSION_ALT})?\\s*\\)?\\s*\\.?\\s*$`
);
const URL_RE = /^https?:\/\/\S+$/;
// Bidi format control characters (LRE/RLE/PDF/LRO/RLO/isolates) that leak in
// from copy-pasting scripture out of iOS Bible apps.
const BIDI_RE = /[‎‏‪-‮⁦-⁩]/g;

function clean(s) {
  return s.replace(BIDI_RE, '').replace(/[ \t]+/g, ' ').trim();
}

function isElement(node, tagName) {
  return !!node && node.type === 'element' && (!tagName || node.tagName === tagName);
}

function lastElementIndex(children, before = children.length) {
  let i = before - 1;
  while (i >= 0 && !isElement(children[i])) i--;
  return i;
}

function linesOf(el) {
  return clean(toText(el, { whitespace: 'pre' }))
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildVerseBlock(quoteText, book, ref, version, link) {
  const citationText = clean(`${book} ${ref.replace(/\s*:\s*/, ':')}${version ? ` ${version}` : ''}`);
  const citeEl = { type: 'element', tagName: 'cite', properties: {}, children: [{ type: 'text', value: citationText }] };
  const footerChildren = [
    { type: 'text', value: '— ' },
    link ? { type: 'element', tagName: 'a', properties: { href: link }, children: [citeEl] } : citeEl,
  ];
  return {
    type: 'element',
    tagName: 'blockquote',
    properties: { className: ['verse-frame'] },
    children: [
      { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: quoteText }] },
      { type: 'element', tagName: 'footer', properties: {}, children: footerChildren },
    ],
  };
}

export default function rehypeBibleVerse() {
  return (tree) => {
    const children = tree.children;
    if (!Array.isArray(children) || children.length === 0) return;

    const removalEnd = lastElementIndex(children);
    if (removalEnd < 0 || !isElement(children[removalEnd], 'p')) return;

    let workingIdx = removalEnd;
    let lines = linesOf(children[workingIdx]);
    let link = null;

    // A trailing bare link line/paragraph is consumed as the citation's
    // href rather than left dangling as its own line.
    if (lines.length && URL_RE.test(lines[lines.length - 1])) {
      link = lines.pop();
    }
    if (lines.length === 0) {
      // The whole last paragraph was just a link — step back to the
      // paragraph before it for the actual quote/citation.
      workingIdx = lastElementIndex(children, workingIdx);
      if (workingIdx < 0 || !isElement(children[workingIdx], 'p')) return;
      lines = linesOf(children[workingIdx]);
    }
    if (lines.length === 0) return;

    // Case A: last line of the working paragraph is a standalone citation;
    // everything before it (in this same paragraph) is the quote.
    if (lines.length >= 2) {
      const match = CITATION_RE.exec(lines[lines.length - 1]);
      const quoteText = lines.slice(0, -1).join(' ').trim();
      if (match && quoteText) {
        children.splice(workingIdx, removalEnd - workingIdx + 1, buildVerseBlock(quoteText, match[1], match[2], match[3], link));
        return;
      }
    }

    const single = lines.join(' ');

    // Case B: the working paragraph is the citation alone; the paragraph
    // immediately before it is the quote.
    const wholeMatch = CITATION_RE.exec(single);
    if (wholeMatch) {
      const prevIdx = lastElementIndex(children, workingIdx);
      if (prevIdx >= 0 && isElement(children[prevIdx], 'p')) {
        const quoteText = clean(toText(children[prevIdx], { whitespace: 'pre' }));
        if (quoteText) {
          children.splice(prevIdx, removalEnd - prevIdx + 1, buildVerseBlock(quoteText, wholeMatch[1], wholeMatch[2], wholeMatch[3], link));
          return;
        }
      }
    }

    // Case C: quote and citation share one paragraph with no line break at
    // all — just a space after the quote's closing quotation mark.
    const inlineMatch = QUOTE_CITATION_RE.exec(single);
    if (inlineMatch) {
      children.splice(workingIdx, removalEnd - workingIdx + 1, buildVerseBlock(inlineMatch[1], inlineMatch[2], inlineMatch[3], inlineMatch[4], link));
    }
  };
}
