// folio generate: N deliberately different design briefs for one profile, plus a theme file per brief.
// The CLI is deterministic (same seed + profile = same briefs); the creative work is done by an agent
// following skills/folio/GENERATE.md, one brief at a time or in parallel.

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { themeSource, loadTheme } from './themes.js';
import { personaWeights } from './sketch.js';

// ---- The design space -------------------------------------------------------------------------

export const DIRECTIONS = [
  { id: 'swiss', name: 'Swiss / International', fonts: ['Schibsted Grotesk', 'Familjen Grotesk'], note: 'strict grid, flush-left, black/white + one loud color, big numerals as structure', tags: ['engineer', 'design', 'minimal'], mood: ['light', 'sleek', 'bold', 'sans'] },
  { id: 'editorial', name: 'Editorial magazine', fonts: ['Newsreader', 'Instrument Sans'], note: 'warm paper, pull-quote about, drop cap, contents-page project list', tags: ['writer', 'research', 'product', 'design'], mood: ['light', 'crafted', 'calm', 'serif', 'editorial', 'warm'] },
  { id: 'blueprint', name: 'Technical blueprint', fonts: ['IBM Plex Mono', 'IBM Plex Sans'], note: 'drafting grid, title block, FIG. labels, spec tables', tags: ['infra', 'data', 'ml', 'hardware', 'backend'], mood: ['light', 'tech', 'mono', 'crafted', 'calm'] },
  { id: 'data', name: 'Data-native', fonts: ['JetBrains Mono', 'DM Sans'], note: 'numbers as the hero, small multiples, CSS/SVG charts drawn from their real data', tags: ['data', 'ml', 'analytics'], mood: ['sleek', 'tech', 'mono', 'calm'] },
  { id: 'brutalist', name: 'Brutalist', fonts: ['Archivo Black', 'Space Mono'], note: 'raw borders, no rounding, system-blue links, hard shadows, dense blocks', tags: ['indie', 'creative', 'frontend'], mood: ['bold', 'colorful', 'mono'] },
  { id: 'archive', name: 'Archive / index', fonts: ['Instrument Serif', 'Geist Mono'], note: 'everything is a catalog row: № · title · year · type, filterable', tags: ['many-projects', 'design', 'research'], mood: ['light', 'calm', 'editorial', 'serif'] },
  { id: 'paper', name: 'Academic paper', fonts: ['Source Serif 4', 'Source Sans 3'], note: 'single column, abstract-style about, numbered references, small caps', tags: ['research', 'phd', 'ml'], mood: ['light', 'calm', 'serif', 'editorial'] },
  { id: 'soft', name: 'Soft / organic', fonts: ['Bricolage Grotesque', 'Figtree'], note: 'warm pastels, generous whitespace, rounded shapes, grain texture', tags: ['product', 'ux', 'student', 'education'], mood: ['light', 'warm', 'soft', 'crafted', 'colorful'] },
  { id: 'retro-os', name: 'Retro desktop OS', fonts: ['VT323', 'IBM Plex Mono'], note: 'windows with title bars, a dock or menu bar, projects as files/folders', tags: ['systems', 'security', 'frontend', 'creative'], mood: ['playful', 'mono', 'tech', 'crafted'] },
  { id: 'zine', name: 'Zine / collage', fonts: ['Bagel Fat One', 'Young Serif'], note: '2–3 riso ink colors, overlapping blocks, rotated sticker labels', tags: ['creative', 'community', 'student'], mood: ['colorful', 'playful', 'crafted', 'bold', 'hand', 'warm'] },
  { id: 'cinematic', name: 'Cinematic dark', fonts: ['Syne', 'Hanken Grotesk'], note: 'near-black, huge cropped type, film-credit career, slow reveals', tags: ['frontend', 'creative', 'ml', 'product'], mood: ['dark', 'bold', 'sleek'] },
  { id: 'kinetic', name: 'Kinetic type', fonts: ['Unbounded', 'Manrope'], note: 'type is the image: oversized, stretched, marquee lines, scroll-driven weight', tags: ['frontend', 'design', 'creative'], mood: ['bold', 'colorful', 'sleek', 'playful'] },
  { id: 'bauhaus', name: 'Bauhaus geometry', fonts: ['League Spartan', 'Work Sans'], note: 'primary-colour blocks as structure, circle/square/triangle as the only ornament, function-first grid', tags: ['engineer', 'design', 'data', 'infra'], mood: ['light', 'colorful', 'bold', 'crafted', 'sans'] },
  { id: 'olympic', name: 'Olympic system', fonts: ['Hanken Grotesk', 'Hanken Grotesk'], note: 'Munich-72 style: friendly light palette (sky, green, orange), strict grid, pictograms built from a few angles, one family in many weights', tags: ['engineer', 'product', 'data'], mood: ['light', 'colorful', 'sleek', 'warm', 'sans'] },
  { id: 'transit', name: 'Transit map', fonts: ['Overpass', 'Overpass Mono'], note: 'career and projects as coloured lines and stations at 45°/90°, interchanges for overlaps, a legend instead of a nav', tags: ['data', 'infra', 'backend', 'ml'], mood: ['light', 'colorful', 'crafted', 'tech'] },
  { id: 'product', name: 'Product launch page', fonts: ['Geist', 'Geist Mono'], note: 'light, crisp product-site polish: hero claim, feature cards that are projects, a changelog for the career, real UI states', tags: ['product', 'frontend', 'ml', 'engineer'], mood: ['light', 'sleek', 'calm', 'sans'] },
  { id: 'field-guide', name: 'Field guide / specimen plates', fonts: ['Fraunces', 'Commissioner'], note: 'each project a labelled specimen plate with Latin-style captions, hand-drawn rules, warm paper and ink colours', tags: ['research', 'education', 'creative', 'data'], mood: ['light', 'crafted', 'warm', 'serif', 'hand'] },
  { id: 'lab-notebook', name: 'Lab notebook', fonts: ['Caveat', 'IBM Plex Mono'], note: 'grid paper, margin notes in handwriting, taped-in results, experiments and their evidence', tags: ['research', 'ml', 'data', 'student'], mood: ['light', 'crafted', 'warm', 'hand', 'tech', 'playful'] },
];

export const LAYOUTS = [
  'single long-read column with wide margins for annotations',
  'split screen: sticky identity panel on the left, scrolling work on the right',
  'bento grid of mixed-size tiles',
  'index table: every project and role as a sortable row',
  'horizontal sections you scroll sideways through on desktop (vertical on phones)',
  'full-bleed sections, one idea per screen, oversized type',
  'document with a sticky table-of-contents sidebar',
  'timeline-first: the career is the spine, projects hang off it',
  'windowed desktop: draggable panels on a canvas (stacked panels on phones)',
];

export const MOTION = [
  'still: no animation at all; let type and layout do the work',
  'subtle: short fades and underline sweeps on hover, nothing else',
  'expressive: scroll-driven reveals and one choreographed hero entrance (CSS scroll-timeline / IntersectionObserver)',
  'playful: cursor-reactive details (magnetic buttons, spotlight, tilt) kept small and optional',
];

export const PALETTES = [
  'monochrome plus exactly one saturated accent',
  'duotone: two inks on paper',
  'dark-first, high contrast, one neon-ish highlight',
  'warm paper with ink and a muted earthy accent',
  'vivid: a bold background color carrying the whole page',
  'cool grays with a precise technical blue',
];

export const SIGNATURES = [
  'a terminal visitors can actually type into (help, ls projects, cat about, open <name>)',
  'a ⌘K command palette to jump to any project or section',
  'project cards that reveal a large preview or detail panel on hover/focus',
  'a stats strip computed from their real data (years, roles, projects, stars)',
  'a career timeline whose progress line fills as you scroll',
  'an index you can filter by tag/tech with a few lines of vanilla JS',
  'a generative hero pattern seeded from their name (canvas or SVG, deterministic)',
  'a marquee of skills or tools that pauses on hover',
  'draggable project "polaroids" or windows (with a non-drag fallback)',
  'live local time and location badge in the header',
];

// ---- Seeded randomness so a run is reproducible -------------------------------------------------

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Rough read of who this is, to weight directions. Keyword heuristics, nothing clever.
export function profileTags(p) {
  const text = [p.headline, p.about, ...p.skills.flatMap((g) => [g.group, ...g.items]), ...p.experience.map((e) => e.role)]
    .join(' ')
    .toLowerCase();
  const tags = new Set();
  const has = (...words) => words.some((w) => text.includes(w));
  if (has('data', 'etl', 'warehouse', 'pipeline', 'analytics', 'sql')) tags.add('data');
  if (has('ml', 'machine learning', 'llm', 'ai ', ' ai', 'model', 'pytorch', 'agent')) tags.add('ml');
  if (has('infra', 'kubernetes', 'aws', 'terraform', 'devops', 'backend', 'distributed')) tags.add('infra');
  if (has('design', 'figma', 'ux', 'ui ')) tags.add('design');
  if (has('frontend', 'react', 'css', 'next.js', 'animation')) tags.add('frontend');
  if (has('research', 'phd', 'paper', 'thesis', 'publication')) tags.add('research');
  if (has('student', 'university', 'intern')) tags.add('student');
  if (has('security', 'reverse', 'exploit', 'ctf')) tags.add('security');
  if (has('product', 'pm ', 'growth')) tags.add('product');
  if (p.projects.length >= 8) tags.add('many-projects');
  if (p.writing.length) tags.add('writer');
  return [...tags];
}

// Directions are scored three ways: who they are (job-title keywords), what their persona says they like
// (taste answers, avoid list, dials: the same weights sketches use), and freshness (a direction from the
// last round is pushed down hard, older ones a little), so every round shows something new.
export function makeBriefs(p, { count = 6, seed = Date.now(), persona = null, used = new Map() } = {}) {
  const rand = rng(seed);
  const tags = profileTags(p);
  const prefs = persona ? personaWeights(persona) : {};
  const taste = (d) => (d.mood || []).reduce((s, t) => s + (prefs[t] || 0), 0);
  const fresh = (d) => (!used.has(d.id) ? 1.5 : used.get(d.id) <= 1 ? -3 : -1);
  // A mood they clearly don't want (e.g. "dark" after "avoid all-dark") rules a direction out entirely,
  // however well its other moods score, unless that would leave too few to choose from.
  const vetoed = (d) => (d.mood || []).some((t) => (prefs[t] || 0) <= -4);
  const pool = DIRECTIONS.filter((d) => !vetoed(d)).length >= count ? DIRECTIONS.filter((d) => !vetoed(d)) : DIRECTIONS;
  const scored = shuffle(pool, rand).map((d) => ({ d, taste: taste(d), fit: d.tags.filter((t) => tags.includes(t)).length + taste(d) * 0.5 + fresh(d) + rand() * 0.9 }));
  scored.sort((a, b) => b.fit - a.fit);
  const nFit = Math.ceil(count * 0.66);
  const fits = scored.slice(0, nFit).map((x) => x.d);
  // Wildcards widen the range, but never from something the persona says to avoid.
  const rest = scored.slice(nFit);
  const ok = rest.filter((x) => x.taste > -2);
  const wild = shuffle((ok.length >= count - nFit ? ok : rest).map((x) => x.d), rand).sort((a, b) => fresh(b) - fresh(a));
  const directions = [...fits, ...wild].slice(0, count);

  // Palettes and signature moments they said to avoid never reach a brief (e.g. "all-dark" → no
  // dark-first palette, "fake terminals" → no type-into terminal).
  const avoidText = (persona?.avoid || []).join(' ').toLowerCase();
  const veto = [/dark|black|night/.test(avoidText) || (prefs.dark || 0) <= -4 ? /dark|neon/ : null, /terminal|console|hacker|matrix/.test(avoidText) ? /terminal/ : null, /neon|gradient/.test(avoidText) ? /neon|gradient/ : null].filter(Boolean);
  const allowed = (list) => { const ok = list.filter((x) => !veto.some((re) => re.test(x))); return ok.length ? ok : list; };
  const layouts = shuffle(LAYOUTS, rand);
  const motions = shuffle(MOTION, rand);
  const palettes = shuffle(allowed(PALETTES), rand);
  const signatures = shuffle(allowed(SIGNATURES), rand);

  return directions.map((d, i) => ({
    n: i + 1,
    direction: d,
    layout: layouts[i % layouts.length],
    motion: motions[i % motions.length],
    palette: palettes[i % palettes.length],
    signature: signatures[i % signatures.length],
    wildcard: !fits.includes(d),
  }));
}

// Which directions earlier rounds used, and how many rounds ago (1 = the latest).
export async function usedDirections(base) {
  const used = new Map();
  const runs = [];
  try {
    for (const f of await readdir(join(base, GEN_DIR))) if (/^\d+$/.test(f)) runs.push(Number(f));
  } catch {}
  runs.sort((a, b) => b - a);
  for (const [i, r] of runs.entries()) {
    const run = await readRun(base, r).catch(() => null);
    for (const b of run?.briefs || []) {
      const id = typeof b.direction === 'string' ? b.direction : b.direction?.id;
      // Only directions they actually saw count: a cancelled round's undesigned drafts don't.
      const file = b.theme ? join(base, 'themes', `${b.theme}.js`) : null;
      const seen = file && existsSync(file) && !isPendingSource(await readFile(file, 'utf8'));
      if (id && seen && !used.has(id)) used.set(id, i + 1);
    }
  }
  return used;
}

// ---- "More like this": siblings of a design the user liked ------------------------------------

const pickFrom = (list, rand, avoid = []) => {
  const options = list.filter((x) => !avoid.includes(x));
  return options[Math.floor(rand() * options.length)];
};

// What the user liked about the parent. That stays; everything else is open.
export const KEEPS = {
  vibe: "its overall mood and personality: the feeling someone gets in the first 5 seconds (not its specific fonts, colors or layout)",
  colors: 'its color palette and the way color is used',
  type: 'its typefaces and type scale',
  layout: 'its page structure and layout',
  signature: 'its signature interaction or moment',
};

// Axes a variation can change, grouped so one variation never spends both changes on the same thing.
export const AXES = [
  { id: 'palette', group: 'colors', label: 'New palette', detail: (r) => `New color system: ${pickFrom(PALETTES, r)}.` },
  { id: 'flip', group: 'colors', label: 'Scheme flip', detail: () => "Flip the designed-for scheme: light-first becomes dark-first or the reverse, with accents retuned for the new ground (keep a good opposite mode too)." },
  { id: 'type', group: 'type', label: 'New type', detail: (r) => { const d = pickFrom(DIRECTIONS, r); return `New type pairing: ${d.fonts.join(' + ')} (or something with that energy), with sizes and spacing retuned around it.`; } },
  { id: 'layout', group: 'layout', label: 'New layout', detail: (r) => `New page structure: ${pickFrom(LAYOUTS, r)}.` },
  { id: 'denser', group: 'layout', label: 'Denser', detail: () => 'Much denser first screen: work and experience visible immediately, small hero, tight rhythm.' },
  { id: 'motion', group: 'motion', label: 'New motion', detail: (r) => `New motion language: ${pickFrom(MOTION, r)}.` },
  { id: 'signature', group: 'signature', label: 'New signature', detail: (r) => `New signature moment: ${pickFrom(SIGNATURES, r)}.` },
  { id: 'bolder', group: 'energy', label: 'Bolder', detail: () => 'Louder: bigger type scale, stronger contrast, braver first screen.' },
  { id: 'calmer', group: 'energy', label: 'Calmer', detail: () => 'Quieter: more whitespace, sparing accent, little or no motion, simpler first screen.' },
];

// Each variation changes two axes from different groups, never touching what the user wants kept.
// One-change siblings looked identical at gallery size, so: two big changes each, and unless colors are
// kept, the set always includes a color change (the difference eyes notice first).
export function makeVariations(parent, { count = 3, seed = Date.now(), keep = 'vibe' } = {}) {
  const rand = rng(seed);
  const allowed = AXES.filter((a) => a.group !== keep);
  const groups = shuffle([...new Set(allowed.map((a) => a.group))], rand);
  if (groups.includes('colors')) groups.unshift(...groups.splice(groups.indexOf('colors'), 1));
  const used = new Set();
  const out = [];
  for (let i = 0; i < Math.min(count, 9); i++) {
    // Next group in rotation that still has an unused axis (fall back to plain rotation once all are used).
    const g1 = groups.slice(i % groups.length).concat(groups).find((g) => allowed.some((x) => x.group === g && !used.has(x.id))) ?? groups[i % groups.length];
    const pool1 = allowed.filter((a) => a.group === g1);
    const a = pool1.find((x) => !used.has(x.id)) ?? pool1[Math.floor(rand() * pool1.length)];
    const pool2 = shuffle(allowed.filter((x) => x.group !== g1 && !used.has(x.id)), rand);
    const b = pool2[0] ?? shuffle(allowed.filter((x) => x.group !== g1), rand)[0];
    used.add(a.id);
    used.add(b.id);
    out.push({ n: i + 1, move: `${a.id}-${b.id}`, label: `${a.label} + ${b.label.toLowerCase()}`, changes: [a.detail(rand), b.detail(rand)], keep, parent });
  }
  return out.map((v) => ({ ...v, detail: v.changes.join(' ') }));
}

export function variationMarkdown(p, run, b, total, cli, parentDescription = '', persona = null) {
  const name = themeNameFor(run, b);
  return `# Variation ${b.n}/${total}: ${b.label}

${p.name} liked the design **${b.parent}**${parentDescription ? ` (“${parentDescription}”)` : ''} and asked for more like it.
Your file starts as an **exact copy** of it. ${total} designers are each taking it somewhere different.
${personaSection(persona)}
## Keep (this is what they liked)
${KEEPS[b.keep] ?? KEEPS.vibe}.

## Change (both, and make them big)
1. ${b.changes[0]}
2. ${b.changes[1]}

Everything not under "Keep" is open. Put your version next to the original at thumbnail size: if a stranger can't tell them apart in one second, you changed too little. Related, not identical.

## Do this
1. Edit \`themes/${name}.js\` (currently a copy of ${b.parent}). Keep \`meta.name = '${name}'\` and rewrite \`meta.description\` in one line: what this variation is.
2. Same rules as always: nothing about the person hardcoded (their field, role or claims): only what's in folio.json or computed from it; every profile value through \`h.esc\` / \`h.inline\` / \`h.md\` / \`h.attrUrl\`; no external scripts; phones, dark and light, reduced motion, focus styles; \`h.ordered(p, sections)\`; works with JS off.
3. \`${cli} theme check ${name}\`: **0 errors required.**
4. \`${cli} shot --theme ${name} --scheme light --pure\`, then look at the \`-part1\` screens for desktop and mobile (sideways-scrolling designs also get \`-panelN\` screens, one per panel). Any \`page script error\` line means broken JS: fix it.
5. At most one more fix round. Reply with the theme name and one sentence on what this variation is.

Full rubric: skills/folio/DESIGN.md.
`;
}

// ---- Persona + sketch briefs ------------------------------------------------------------------

// Who the person is, from their persona card, so every designer starts from the same read of them.
export function personaSection(persona) {
  if (!persona) return '';
  // Before any persona is written, the three quick answers are all we know about their taste: use them.
  if (!persona.headline) {
    const a = persona.answers || {};
    const line = (k, label) => ((a[k] || []).length ? `- **${label}:** ${a[k].join(', ')}\n` : '');
    const body = line('feel', 'how people should feel') + line('show', 'what to show most') + line('taste', 'what they like visually');
    return body ? `\n## What they told us\n${body}` : '';
  }
  const traits = (persona.traits || []).map((t) => `- **${t.key}:** ${t.value}${t.quote ? ` (“${t.quote}”)` : ''}`).join('\n');
  const d = persona.dials || {};
  return `
## Who this is (their persona card, which they've seen and agreed with)
**${persona.headline}** ${persona.lede || ''}
${traits}
- **dials (0–10):** energy ${d.energy}, warmth ${d.warmth}, tech depth ${d.techDepth}, playfulness ${d.playfulness}, formality ${d.formality}
${(persona.implications || []).length ? `- **so the design should:** ${persona.implications.join('; ')}\n` : ''}${(persona.avoid || []).length ? `- **avoid:** ${persona.avoid.join('; ')}\n` : ''}`;
}

export function sketchBriefMarkdown(p, run, b, total, cli, persona) {
  const name = themeNameFor(run, b);
  const s = b.sketch;
  return `# Build ${b.n}/${total}: from the sketch "${s.title}"

${p.name} looked at quick first-screen sketches and **liked this one**. Build the full site in its language.
${personaSection(persona)}
## The sketch they liked (match it)
- **Layout of the first screen:** ${s.layout}${s.note ? ` (${s.note})` : ''}
- **Palette:** background ${s.palette.bg}, ink ${s.palette.ink}, accent ${s.palette.accent}, second accent ${s.palette.accent2}, muted ${s.palette.muted}
- **Type:** ${s.fonts.display} (display, weight ${s.fonts.weight}${s.fonts.italic ? ', italic' : ''}${s.fonts.upper ? ', uppercase' : ''}) with ${s.fonts.text} for text
- **Motif:** ${s.motif}
- **Mood:** ${s.mood || 'as the sketch'}
- See it rendered: \`${cli} sketch show ${s.id}\` prints the sketch's HTML; the Studio preview is /sketch/${s.id}

The first screen of your site should be recognizably this sketch (a person who liked it must recognize it instantly). Then design everything below it in the same language: sections, rhythm, hover states, phone layout, dark mode.

## Do this
1. Edit \`themes/${name}.js\`. Keep \`meta.name = '${name}'\` and write a one-line \`meta.description\`.
2. Rules: never hardcode anything about the person (field, role or claims): words about them come from folio.json or are computed from it. Every profile value through \`h.esc\` / \`h.inline\` / \`h.md\` / \`h.attrUrl\`; no external scripts; at most 2 font families; phones, dark and light, reduced motion, focus styles; \`h.ordered(p, sections)\`; works with JS off.
3. \`${cli} theme check ${name}\`: **0 errors required.**
4. \`${cli} shot --theme ${name} --scheme light --pure\`, look at the \`-part1\` and \`-part2\` screens for desktop and mobile (sideways-scrolling designs also get \`-panelN\` screens, one per panel); fix what's off. Any \`page script error\` means broken JS.
5. At most one more fix round. Reply with the theme name and one sentence on the result.

Full rubric: skills/folio/DESIGN.md.
`;
}

// ---- Mix: parts of several designs combined -------------------------------------------------

export function mixMarkdown(p, run, b, cli, persona) {
  const name = themeNameFor(run, b);
  const m = b.mix;
  const t = m.traits || {};
  const line = (aspect, id, extra) => `- **${aspect} from \`${id}\`**${extra ? `: ${extra}` : ''}. Read \`themes/${id}.js\` for it.`;
  return `# Mix: one design from the best parts of several

${p.name} compared designs and picked a part from each. Combine them into one coherent site.
${personaSection(persona)}
## The parts
${line('Layout and structure', m.layout, 'your file starts as an exact copy of it, so the structure is already there')}
${line('Colours', m.colors, t[m.colors]?.colors?.length ? `its palette is roughly ${t[m.colors].colors.join(', ')}` : '')}
${line('Typography', m.type, t[m.type]?.fonts?.length ? `it uses ${t[m.type].fonts.join(' + ')}` : '')}
${line('Signature moment', m.signature, 'the one interaction or detail people remember')}

It must read as one design, not a collage: retune spacing, contrast and accents so the parts belong together. Keep everything readable in light and dark.

## Do this
1. Edit \`themes/${name}.js\` (a copy of ${m.layout}). Keep \`meta.name = '${name}'\`; write a one-line \`meta.description\` naming what came from where.
2. Rules: nothing about the person hardcoded; every profile value through \`h.esc\` / \`h.inline\` / \`h.md\` / \`h.attrUrl\`; no external scripts; at most 2 font families; phones, dark and light, reduced motion, focus styles; \`h.ordered(p, sections)\`; works with JS off.
3. \`${cli} theme check ${name}\`: **0 errors required.**
4. \`${cli} shot --theme ${name} --scheme light --pure\` and look at the \`-part1\` screens (sideways-scrolling designs also get \`-panelN\` screens, one per panel); fix what's off.
5. Reply with the theme name and one sentence on the result.
`;
}

// ---- Runs on disk ----------------------------------------------------------------------------

export const GEN_DIR = '.folio/gen';

export async function nextRun(base) {
  const dir = join(base, GEN_DIR);
  if (!existsSync(dir)) return 1;
  const nums = (await readdir(dir)).map((d) => Number(d)).filter(Number.isInteger);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

export async function latestRun(base) {
  const n = (await nextRun(base)) - 1;
  return n > 0 ? n : null;
}

export const themeNameFor = (run, b) => `g${run}-${b.n}-${b.move ?? b.direction.id}`;

function contentShape(p) {
  const bits = [
    `${p.projects.length} project${p.projects.length === 1 ? '' : 's'} (${p.projects.filter((x) => x.featured).length} featured${p.projects.some((x) => x.image) ? ', some with screenshots' : ', no screenshots'})`,
    `${p.experience.length} role${p.experience.length === 1 ? '' : 's'}`,
    p.about ? `about: ${p.about.split(/\s+/).length} words` : 'no about text',
    p.avatar ? 'has a photo' : 'no photo',
    p.skills.length ? `${p.skills.reduce((n, g) => n + g.items.length, 0)} skills in ${p.skills.length} group(s)` : 'no skills listed',
    p.education.length ? `${p.education.length} education entr${p.education.length === 1 ? 'y' : 'ies'}` : '',
    p.awards.length ? `${p.awards.length} award(s)` : '',
    p.writing.length ? `${p.writing.length} writing link(s)` : '',
  ];
  return bits.filter(Boolean).join(' · ');
}

export function briefMarkdown(p, run, b, total, cli = 'npx -y folio-site@latest', persona = null) {
  const name = themeNameFor(run, b);
  return `# Design brief ${b.n}/${total}: ${b.direction.name}

You are designing **one** portfolio theme for ${p.name}${p.headline ? ` (“${p.headline}”)` : ''}.
${total} designers are working in parallel from different briefs. The point is **range**: commit hard to *this* brief, don't drift toward a safe middle.

## The brief
- **Direction:** ${b.direction.name}: ${b.direction.note}
- **Layout:** ${b.layout}
- **Motion:** ${b.motion}
- **Palette:** ${b.palette}
- **Type:** start from ${b.direction.fonts.join(' + ')} (Google Fonts). Swap if you find a better pairing; never Inter, Roboto, Arial, Poppins, Montserrat or Space Grotesk as the main face.
- **Signature moment:** ${b.signature}. One memorable idea, visible on the first screen or one scroll away.
${b.wildcard ? "- This is a **wildcard** brief: it doesn't obviously fit the person. Find the angle where it does.\n" : ''}${personaSection(persona)}
## Their content (design for what they actually have)
${contentShape(p)}

## Do this
1. Edit \`themes/${name}.js\`. It already renders every section safely (it's the starter). Rewrite it completely to match the brief. Keep \`meta.name = '${name}'\` and write a one-line \`meta.description\` of the look.
2. Rules: never hardcode anything about the person (their field, role or claims like "shipping data systems"): every word about them comes from folio.json or is computed from it, and the theme must stay true for a student, an illustrator or a CTO. Every profile value goes through \`h.esc\` / \`h.inline\` / \`h.md\` / \`h.attrUrl\`; no external \`<script src>\`; at most 2 font families; handle phones, dark *and* light, \`prefers-reduced-motion\`, \`:focus-visible\`; sort sections with \`h.ordered(p, sections)\`. The page must work with JS off.
3. \`${cli} theme check ${name}\`: **0 errors required.**
4. \`${cli} shot --theme ${name} --scheme light --pure\`, then look at the \`-part1\` and \`-part2\` screens (desktop and mobile) (sideways-scrolling designs also get \`-panelN\` screens, one per panel); each is exactly one real screen. Any \`page script error\` line means your JS is broken: fix it. Fix what looks off: the 5-second read, orphan gaps, cramped phones, generic look.
5. One more check → shot round if anything scored below 4/5. Then stop; don't polish forever.
6. Reply with: the theme name, two sentences on the idea, and anything you couldn't get right.

Full rubric and banned patterns: skills/folio/DESIGN.md.
`;
}

export async function createRun(base, p, { count = 6, seed, cli, like, keep = 'vibe', sketches = null, persona = null, mix = null } = {}) {
  const run = await nextRun(base);
  const usedSeed = seed ?? Number(createHash('sha1').update(`${Date.now()}${p.name}`).digest().readUInt32BE(0));
  let parentDescription = '';
  if (like) parentDescription = (await loadTheme(like, base)).meta.description || ''; // also validates `like`
  if (like && !KEEPS[keep]) throw new Error(`--keep must be one of: ${Object.keys(KEEPS).join(', ')}`);
  const briefs = mix
    ? [{ n: 1, mix, move: 'mix', label: `Mix of ${[...new Set([mix.layout, mix.colors, mix.type, mix.signature])].join(', ')}`, detail: '' }]
    : sketches
    ? sketches.map((sk, i) => ({ n: i + 1, sketch: sk, move: `from-${sk.layout}`, label: `From sketch: ${sk.title}`, detail: sk.mood }))
    : like ? makeVariations(like, { count, seed: usedSeed, keep }) : makeBriefs(p, { count, seed: usedSeed, persona, used: await usedDirections(base) });
  const dir = join(base, GEN_DIR, String(run));
  await mkdir(dir, { recursive: true });
  await mkdir(join(base, 'themes'), { recursive: true });

  const starter = await readFile(new URL('../themes/_starter.js', import.meta.url), 'utf8');
  const files = [];
  for (const b of briefs) {
    const name = themeNameFor(run, b);
    const brief = b.mix ? mixMarkdown(p, run, b, cli, persona) : b.sketch ? sketchBriefMarkdown(p, run, b, briefs.length, cli, persona) : like ? variationMarkdown(p, run, b, briefs.length, cli, parentDescription, persona) : briefMarkdown(p, run, b, briefs.length, cli, persona);
    await writeFile(join(dir, `brief-${b.n}.md`), brief);
    const themeFile = join(base, 'themes', `${name}.js`);
    if (!existsSync(themeFile)) {
      const pending = b.mix ? `PENDING: mix of ${b.label.slice(7)}` : b.sketch ? `PENDING: built from sketch ${b.sketch.title}` : like ? `PENDING: ${b.label} variation of ${like}` : `PENDING: ${b.direction.name} (not designed yet)`;
      const src = b.mix ? await themeSource(b.mix.layout, name, base) : like ? await themeSource(like, name, base) : starter.replace("name: '__NAME__'", `name: '${name}'`);
      await writeFile(themeFile, markPending(src, pending));
    }
    files.push({ name, brief: join(dir, `brief-${b.n}.md`), theme: themeFile, direction: b.mix || b.sketch ? b.label : like ? `${b.label}: ${b.detail}` : b.direction.name });
  }
  await writeFile(join(dir, 'run.json'), `${JSON.stringify({ run, seed: usedSeed, parent: like ?? null, keep: like ? keep : null, fromSketches: sketches ? sketches.map((k) => k.id) : null, mix: mix ? { layout: mix.layout, colors: mix.colors, type: mix.type, signature: mix.signature } : null, created: new Date().toISOString(), briefs: briefs.map((b) => ({ ...b, mix: undefined, sketch: b.sketch ? b.sketch.id : undefined, direction: b.direction?.id ?? null, theme: themeNameFor(run, b) })) }, null, 2)}\n`);

  // Generated drafts and screenshots don't belong in the user's git history by default.
  const gi = join(base, '.folio', '.gitignore');
  if (!existsSync(gi)) await writeFile(gi, '*\n');
  return { run, seed: usedSeed, dir, files };
}

export async function readRun(base, run) {
  const file = join(base, GEN_DIR, String(run), 'run.json');
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, 'utf8'));
}

// Swap the theme's meta.description for a PENDING marker (the designer replaces it when done).
function markPending(src, text) {
  const value = `description: '${text.replace(/'/g, "\\'")}'`;
  const re = /description:\s*(['"`])(?:\\.|(?!\1)[^\\])*\1/;
  if (re.test(src)) return src.replace(re, value);
  return src.replace(/(name:\s*'[^']+',?)/, `$1\n  ${value},`);
}

// A generated theme still carrying the PENDING description hasn't been designed yet.
export const isPendingSource = (source) => /description:\s*'PENDING:/.test(source);

export async function isPending(themeFile) {
  if (!existsSync(themeFile)) return true;
  return (await readFile(themeFile, 'utf8')).includes("description: 'PENDING:");
}
