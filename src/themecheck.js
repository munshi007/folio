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

// A second, deliberately different person: no tech or domain vocabulary anywhere. Any claim-like sentence that
// shows up for both Maya and Lena can't be coming from either profile, so the theme hardcoded it.
const CONTRAST = {
  name: 'Lena Park',
  headline: 'Illustrator and picture-book author',
  location: 'Lisbon, Portugal',
  about: 'I draw small animals having big feelings. My books have been translated into nine languages.',
  links: [{ label: 'Instagram', url: 'https://instagram.com/example' }],
  projects: [
    { name: 'The Quiet Fox', description: 'A picture book about a fox who learns to listen.', url: 'https://example.com/fox', tags: ['Watercolor'], year: '2024', featured: true, highlights: ['Shortlisted for a regional book prize'] },
    { name: 'Harbor Sketches', description: 'A year of morning drawings at the river.', url: 'https://example.com/harbor', tags: ['Ink'], year: '2023' },
  ],
  experience: [{ role: 'Illustrator', org: 'Paper Boat Press', start: '2021', end: 'present', highlights: ['Illustrated six picture books'] }],
  education: [{ school: 'Lisbon School of Fine Arts', degree: 'BA, Illustration', start: '2016', end: '2020' }],
  skills: [{ group: 'Media', items: ['Watercolor', 'Ink', 'Gouache'] }],
  awards: [{ title: 'Regional Picture Book Prize', org: 'Shortlist', date: '2025' }],
};

// Words that make a sentence a claim about the person (their field, role or work).
const CLAIM_WORDS = /\b(data|systems?|pipelines?|engineer(s|ing)?|developers?|software|code|coding|programm(er|ing)|ml|ai|llms?|agents?|machine learning|infra(structure)?|backend|front-?end|full-?stack|designers?|students?|research(ers?)?|startups?|products?|apis?|cloud|devops|analytics)\b/i;

function visibleText(html) {
  return stripScripts(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head>[\s\S]*?<\/head>/i, '')
    .split(/<[^>]+>/)
    .map((t) => t.replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

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
  const contrast = tryRender(theme, CONTRAST, 'contrast', errors);

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

    // style.sections: put skills first and about last; a theme that honors it (via h.ordered) moves them.
    const reordered = tryRender(theme, { ...EXAMPLE, style: { sections: ['skills', 'experience', 'projects', 'education', 'awards', 'about'] } }, 'reordered', errors);
    if (reordered) {
      const t = stripScripts(reordered).replace(/<head>[\s\S]*?<\/head>/, '');
      const skill = t.indexOf(p.skills[0].items[0]);
      const about = t.indexOf('third-year');
      if (skill === -1 || about === -1 || skill > about) warnings.push('ignores style.sections order (sort your sections with h.ordered(p, sections))');
    }

    // Hardcoded claims: same claim-like text for two very different people.
    if (contrast) {
      const norm = (t) => t.replace(/\d+/g, '#').toLowerCase();
      const theirs = new Set(visibleText(contrast).map(norm));
      const baked = [...new Set(visibleText(full).map(norm))].filter((t) => theirs.has(t) && t.split(' ').length >= 2 && CLAIM_WORDS.test(t));
      for (const t of baked.slice(0, 5)) warnings.push(`hardcoded wording that isn't from folio.json: "${t}". It shows for every person; derive it from the profile or remove it`);
    }

    const kb = Buffer.byteLength(full) / 1024;
    if (kb > 120) warnings.push(`page is ${kb.toFixed(0)} KB before images; keep it lean`);
  }

  return { errors, warnings };
}
