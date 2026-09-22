// rehype-video-embed.mjs
//
// Migrated posts sometimes contain a bare video URL sitting on its own
// paragraph (YouTube, or Blogger's own now-legacy `video.g?token=` host).
// VideoEmbed.astro exists for exactly this purpose but was never wired into
// the MDX render path, so these URLs were showing up as plain clickable
// text instead of a player.
//
// This finds any paragraph whose entire text is one of those URLs and
// replaces it with a click-to-play facade (poster image + play button)
// rather than an eagerly-loaded iframe — an iframe painted before the
// player's own JS finishes loading shows as a plain black rectangle, and
// loading every video's iframe on every page load is wasted weight for
// videos nobody plays. VideoFacade.astro's client script swaps the real
// <iframe> in on click. YouTube has a predictable static thumbnail URL;
// Blogger's legacy video host doesn't expose one publicly — under the hood
// it's actually backed by an unlisted YouTube video (i9.ytimg.com/vi_blogger/...),
// but its thumbnail URLs require a signed query string minted per-session
// by the player's own JS, so there's no stable URL to compute at build
// time. BLOGGER_POSTER_OVERRIDES holds hand-extracted stills for specific
// tokens (pulled once via browser devtools, saved locally under
// public/videos/) rather than leaving those with no poster at all.
import { toText } from 'hast-util-to-text';

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/;
const BLOGGER_VIDEO_RE = /blogger\.com\/video\.g\?token=([^&\s]+)/;

// token -> /public path, for legacy Blogger videos with a manually-pulled poster frame.
const BLOGGER_POSTER_OVERRIDES = {
  'AD6v5dy4Ywfnr6RellYMwsU0unGtchFWqI1c-KhZrlDJJYOFuwj8kVAymDtxY5cxBg-tphJt4z1C1IGVlWXdLNtKjA':
    '/videos/deer-crossing-alligator-river.jpg',
};

function isElement(node, tagName) {
  return !!node && node.type === 'element' && (!tagName || node.tagName === tagName);
}

function embedInfoFor(url) {
  const yt = YOUTUBE_RE.exec(url);
  if (yt) {
    return {
      embedUrl: `https://www.youtube.com/embed/${yt[1]}`,
      poster: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const bg = BLOGGER_VIDEO_RE.exec(url);
  if (bg) {
    return {
      embedUrl: `https://www.blogger.com/video.g?token=${bg[1]}`,
      poster: BLOGGER_POSTER_OVERRIDES[bg[1]] ?? null,
    };
  }
  return null;
}

const PLAY_ICON = {
  type: 'element',
  tagName: 'span',
  properties: { className: ['video-embed__icon'], ariaHidden: 'true' },
  children: [
    {
      type: 'element',
      tagName: 'svg',
      properties: { viewBox: '0 0 24 24' },
      children: [{ type: 'element', tagName: 'path', properties: { d: 'M6 4l14 8-14 8z' }, children: [] }],
    },
  ],
};

function buildFacade(embedUrl, poster) {
  const children = [];
  if (poster) {
    children.push({
      type: 'element',
      tagName: 'img',
      properties: { className: ['video-embed__poster'], src: poster, alt: '', loading: 'lazy' },
      children: [],
    });
  }
  children.push(PLAY_ICON);
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['video-embed'], dataEmbedSrc: embedUrl },
    children: [
      {
        type: 'element',
        tagName: 'button',
        properties: { type: 'button', className: ['video-embed__play'], ariaLabel: 'Play video' },
        children,
      },
    ],
  };
}

export default function rehypeVideoEmbed() {
  return (tree) => {
    const children = tree.children;
    if (!Array.isArray(children)) return;

    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (!isElement(node, 'p')) continue;
      // Only a paragraph whose *entire* content is the bare URL — a link
      // mentioned mid-sentence is left alone.
      if (node.children.length !== 1 || node.children[0].type !== 'element' || node.children[0].tagName !== 'a') continue;
      const anchor = node.children[0];
      const href = anchor.properties?.href;
      if (typeof href !== 'string') continue;
      const text = toText(anchor).trim();
      if (text !== href) continue;
      const info = embedInfoFor(href);
      if (!info) continue;
      children[i] = buildFacade(info.embedUrl, info.poster);
    }
  };
}
