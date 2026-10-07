import { esc, attrUrl, safeUrl } from './util.js';
import { applyMode, fontOverride } from './style.js';

export const REPO_URL = 'https://github.com/munshi007/folio';

const BADGE_CSS = `.folio-badge{position:fixed;right:14px;bottom:14px;z-index:50;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font:500 12px/1 ui-sans-serif,system-ui,sans-serif;text-decoration:none;color:#555;background:rgba(255,255,255,.85);border:1px solid rgba(0,0,0,.08);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:.75;transition:opacity .2s}
.folio-badge:hover{opacity:1}
@media (prefers-color-scheme:dark){.folio-badge{color:#bbb;background:rgba(20,20,20,.8);border-color:rgba(255,255,255,.1)}}
@media print{.folio-badge{display:none}}`;

// Wraps a theme's body in a full document: SEO + social meta, JSON-LD, fonts, theme CSS.
export function page(p, { fonts = '', css = '', body = '', script = '', bg = '#fff', bgDark = '#000' }) {
  const mode = p.style?.mode ?? 'auto';
  const font = fontOverride(p.style?.font);
  const title = p.headline ? `${p.name} — ${p.headline}` : p.name;
  const description = (p.about || p.headline || `${p.name}'s portfolio`).replace(/\s+/g, ' ').slice(0, 180);
  const image = safeUrl(p.avatar);
  const absImage = /^https?:/.test(image) ? image : p.url && image ? new URL(image, p.url).href : '';

  // Theme CSS, then folio.json overrides (they come last so they win), then the badge.
  // style.mode then rewrites every prefers-color-scheme block in one pass.
  const styleCss = applyMode(
    [
      css,
      p.accent ? `:root{--accent:${p.accent}}@media (prefers-color-scheme:dark){:root{--accent:${p.accent}}}` : '',
      BADGE_CSS,
      font ? font.css : '',
    ].join('\n'),
    mode,
  );

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name,
    jobTitle: p.headline || undefined,
    url: p.url || undefined,
    image: absImage || undefined,
    address: p.location ? { '@type': 'PostalAddress', addressLocality: p.location } : undefined,
    sameAs: p.links.map((l) => l.url).filter((u) => /^https?:/.test(u)),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${mode === 'auto'
  ? `<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${esc(bg)}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${esc(bgDark)}" media="(prefers-color-scheme: dark)">`
  : `<meta name="color-scheme" content="${mode}">
<meta name="theme-color" content="${esc(mode === 'dark' ? bgDark : bg)}">`}
<meta name="generator" content="folio">
${p.url ? `<link rel="canonical" href="${attrUrl(p.url)}">` : ''}
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${absImage ? `<meta property="og:image" content="${esc(absImage)}">` : ''}
<meta name="twitter:card" content="summary">
${image ? `<link rel="icon" href="${attrUrl(image)}">` : ''}
${fonts || font ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` : ''}
${fonts && !font ? `<link rel="stylesheet" href="${esc(fonts)}">` : ''}
${font ? `<link rel="stylesheet" href="${esc(font.url)}">` : ''}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>
${styleCss}</style>
</head>
<body>
${body}
${p.badge ? `<a class="folio-badge" href="${REPO_URL}" target="_blank" rel="noopener">✦ built with folio</a>` : ''}
${script ? `<script>${script}</script>` : ''}
</body>
</html>
`;
}
