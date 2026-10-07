// Conformance checks for a theme. Errors = unsafe or broken. Warnings = quality issues worth fixing.
// Used by `folio theme check`, the test suite, and the design loop in skills/folio/DESIGN.md.

import { readFileSync } from 'node:fs';
import { normalize } from './schema.js';
import { renderWith } from './themes.js';

const EXAMPLE = JSON.parse(readFileSync(new URL('../examples/folio.example.json', import.meta.url), 'utf8'));

const EVIL = '<script>alert(1)</script><img src=x onerror=alert(1)>';
const HOSTILE = {
  name: EVIL,
  headline: EVIL,
  status: EVIL,
  location: EVIL,
  about: `${EVIL} [x](javascript:alert(1))`,
  avatar: 'javascript:alert(1)',
  links: [{ label: EVIL, url: 'javascript:alert(1)' }],
  projects: [{ name: EVIL, description: EVIL, url: 'javascript:alert(1)', repo: 'data:text/html,x', image: 'javascript:x', tags: [EVIL], highlights: [EVIL], featured: true }],
  experience: [{ role: EVIL, org: EVIL, url: 'javascript:alert(1)', summary: EVIL, highlights: [EVIL] }],
  education: [{ school: EVIL, degree: EVIL, details: EVIL }],
  skills: [{ group: EVIL, items: [EVIL] }],
  awards: [{ title: EVIL, org: EVIL, url: 'javascript:alert(1)' }],
  writing: [{ title: EVIL, url: 'javascript:alert(1)', venue: EVIL }],
};

// Fonts every AI-generated site reaches for. Not wrong, just forgettable.
export const GENERIC_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Arial', 'Poppins', 'Montserrat', 'Space Grotesk', 'Lato'];

const stripScripts = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '');

function tryRender(theme, raw, label, errors) {
  try {
    return renderWith(theme, normalize(raw));
  } catch (e) {
    errors.push(`render crashed on ${label} profile: ${e.message}`);
    return null;
  }
}

export function checkTheme(theme) {
  const errors = [];
  const warnings = [];

  if (!theme?.meta?.name) errors.push('meta.name is missing');
  if (!theme?.meta?.description) warnings.push('meta.description is empty; `folio themes` shows it to users');
  if (typeof theme?.render !== 'function') return { errors: [...errors, 'render(profile, h) is not a function'], warnings };

  const full = tryRender(theme, EXAMPLE, 'example', errors);
  const minimal = tryRender(theme, { name: 'Solo Person' }, 'minimal (name only)', errors);
  const hostile = tryRender(theme, HOSTILE, 'hostile', errors);

  if (hostile) {
    const h = stripScripts(hostile.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ''));
    if (/<script>alert|<img src=x/i.test(h)) errors.push('unescaped user content: a value was inserted as raw HTML (use h.esc / h.inline / h.md)');
    if (/(href|src)\s*=\s*["']?\s*(javascript|data):/i.test(h)) errors.push('unsafe URL in href/src (use h.attrUrl for every link and image)');
    // Blank out quoted attribute values (escaped user text lives there) before looking for on*= attributes.
    const tags = h.replace(/"[^"]*"|'[^']*'/g, '""');
    if (/<[a-z][^>]*\son\w+\s*=\s*alert/i.test(tags)) errors.push('user content produced an inline event handler');
  }

  for (const [label, html] of [['example', full], ['minimal', minimal]]) {
    if (!html) continue;
    const visible = stripScripts(html).replace(/<style[\s\S]*?<\/style>/gi, '');
    const leak = visible.match(/\b(undefined|NaN|\[object Object\])\b/);
    if (leak) errors.push(`"${leak[1]}" leaks into the ${label} page`);
    if (/<script[^>]+src=/i.test(html.replace(/<script type="application\/ld\+json">/, ''))) {
      errors.push('external <script src> is not allowed; inline only what you need');
    }
  }

  if (full) {
    const text = stripScripts(full);
    const p = normalize(EXAMPLE);
    const expect = [
      ['headline', p.headline],
      ['about', 'third-year'],
      ['featured projects', p.projects.find((x) => x.featured).name],
      ['experience', p.experience[0].org],
      ['education', p.education[0].school],
      ['skills', p.skills[0].items[0]],
      ['awards', p.awards[0].title],
      ['links', 'github.com/example'],
    ];
    for (const [section, needle] of expect) {
      if (!text.includes(needle)) warnings.push(`doesn't render ${section} (looked for "${needle}")`);
    }

    const css = (full.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (!/prefers-color-scheme/.test(css)) warnings.push('no dark/light handling (@media (prefers-color-scheme: ...))');
    if (!/@media[^{]*max-width/.test(css)) warnings.push('no mobile breakpoint (@media (max-width: ...))');
    if (/(animation|transition)\s*:/.test(css) && !/prefers-reduced-motion/.test(css)) {
      warnings.push('animates without a prefers-reduced-motion fallback');
    }
    if (!/:focus|:focus-visible/.test(css)) warnings.push('no visible focus style for keyboard users (:focus-visible)');

    const fontUrl = (full.match(/fonts\.googleapis\.com\/css2\?([^"]+)"/) || [])[1] || '';
    const families = [...decodeURIComponent(fontUrl).matchAll(/family=([^:&]+)/g)].map((m) => m[1].replace(/\+/g, ' '));
    const generic = families.filter((f) => GENERIC_FONTS.includes(f));
    if (generic.length) warnings.push(`generic font${generic.length > 1 ? 's' : ''}: ${generic.join(', ')} — pick something with character`);

    const kb = Buffer.byteLength(full) / 1024;
    if (kb > 120) warnings.push(`page is ${kb.toFixed(0)} KB before images; keep it lean`);
  }

  return { errors, warnings };
}
