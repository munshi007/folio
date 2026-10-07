// "style" in folio.json: knobs that work on every theme, including ones folio has never seen.
//   mode:     auto | light | dark          rewrites the theme's prefers-color-scheme blocks
//   font:     theme | serif | sans | mono  overrides the theme's type with a vetted pairing
//   sections: ["projects", "about", ...]   order (themes opt in via h.ordered)
//   hide:     ["awards", ...]              hidden everywhere (cleared before the theme renders)

export const SECTION_IDS = ['about', 'projects', 'experience', 'education', 'skills', 'awards', 'writing'];
export const MODES = ['auto', 'light', 'dark'];
export const FONTS = ['theme', 'serif', 'sans', 'mono'];

const PAIRS = {
  serif: {
    url: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400&display=swap',
    display: '"Fraunces",Georgia,serif',
    text: '"Newsreader",Georgia,serif',
  },
  sans: {
    url: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Instrument+Sans:wght@400;500;600&display=swap',
    display: '"Bricolage Grotesque",ui-sans-serif,sans-serif',
    text: '"Instrument Sans",ui-sans-serif,system-ui,sans-serif',
  },
  mono: {
    url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap',
    display: '"JetBrains Mono",ui-monospace,monospace',
    text: '"JetBrains Mono",ui-monospace,monospace',
  },
};

export function validateStyle(style) {
  const errors = [];
  if (style == null) return errors;
  if (typeof style !== 'object' || Array.isArray(style)) return ['style: must be an object'];
  if (style.mode != null && !MODES.includes(style.mode)) errors.push(`style.mode: one of ${MODES.join(', ')}`);
  if (style.font != null && !FONTS.includes(style.font)) errors.push(`style.font: one of ${FONTS.join(', ')}`);
  for (const key of ['sections', 'hide']) {
    if (style[key] == null) continue;
    if (!Array.isArray(style[key])) errors.push(`style.${key}: must be an array of section names`);
    else {
      const bad = style[key].filter((s) => !SECTION_IDS.includes(s));
      if (bad.length) errors.push(`style.${key}: unknown section${bad.length > 1 ? 's' : ''} ${bad.join(', ')} (use ${SECTION_IDS.join(', ')})`);
    }
  }
  return errors;
}

export function normalizeStyle(style = {}) {
  const s = style && typeof style === 'object' ? style : {};
  const listed = Array.isArray(s.sections) ? s.sections.filter((x) => SECTION_IDS.includes(x)) : null;
  return {
    mode: MODES.includes(s.mode) ? s.mode : 'auto',
    font: FONTS.includes(s.font) ? s.font : 'theme',
    // null = "use the theme's own order"; otherwise the user's order, then anything they didn't list.
    sections: listed && listed.length ? [...new Set([...listed, ...SECTION_IDS])] : null,
    hide: Array.isArray(s.hide) ? s.hide.filter((x) => SECTION_IDS.includes(x)) : [],
  };
}

// Stable sort by the user's section order. No order set => items come back untouched.
export function ordered(p, items, idOf = (x) => x.id) {
  const order = p?.sections;
  if (!order) return items;
  const rank = (x) => {
    const i = order.indexOf(idOf(x));
    return i === -1 ? order.length : i;
  };
  return items
    .map((x, i) => [x, i])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])
    .map(([x]) => x);
}

// Find each @media block whose condition is only prefers-color-scheme, with its full brace-balanced extent.
function schemeBlocks(css) {
  const out = [];
  const re = /@media\s*\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)\s*\{/gi;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < css.length && depth; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out.push({ start: m.index, bodyStart: re.lastIndex, end: i, scheme: m[1].toLowerCase() });
    re.lastIndex = i;
  }
  return out;
}

// mode=light: drop dark blocks, unwrap light blocks. mode=dark: the reverse. auto: untouched.
export function applyMode(css, mode) {
  if (mode !== 'light' && mode !== 'dark') return css;
  let out = '';
  let pos = 0;
  for (const b of schemeBlocks(css)) {
    out += css.slice(pos, b.start);
    if (b.scheme === mode) out += css.slice(b.bodyStart, b.end - 1);
    pos = b.end;
  }
  return out + css.slice(pos);
}

export function fontOverride(font) {
  const pair = PAIRS[font];
  if (!pair) return null;
  return {
    url: pair.url,
    css: `/* folio.json style.font = ${font} */
body,body *:not(svg):not(svg *):not(code):not(pre):not(kbd):not(#folio-dev):not(#folio-dev *):not(.folio-badge){font-family:${pair.text}!important}
h1,h2,h3,h1 *,h2 *,h3 *{font-family:${pair.display}!important}`,
  };
}
