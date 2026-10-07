// folio generate: N deliberately different design briefs for one profile, plus a theme file per brief.
// The CLI is deterministic (same seed + profile = same briefs); the creative work is done by an agent
// following skills/folio/GENERATE.md, one brief at a time or in parallel.

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// ---- The design space -------------------------------------------------------------------------

export const DIRECTIONS = [
  { id: 'swiss', name: 'Swiss / International', fonts: ['Schibsted Grotesk', 'Familjen Grotesk'], note: 'strict grid, flush-left, black/white + one loud color, big numerals as structure', tags: ['engineer', 'design', 'minimal'] },
  { id: 'editorial', name: 'Editorial magazine', fonts: ['Newsreader', 'Instrument Sans'], note: 'warm paper, pull-quote about, drop cap, contents-page project list', tags: ['writer', 'research', 'product', 'design'] },
  { id: 'blueprint', name: 'Technical blueprint', fonts: ['IBM Plex Mono', 'IBM Plex Sans'], note: 'drafting grid, title block, FIG. labels, spec tables', tags: ['infra', 'data', 'ml', 'hardware', 'backend'] },
  { id: 'data', name: 'Data-native', fonts: ['JetBrains Mono', 'DM Sans'], note: 'numbers as the hero, small multiples, CSS/SVG charts drawn from their real data', tags: ['data', 'ml', 'analytics'] },
  { id: 'brutalist', name: 'Brutalist', fonts: ['Archivo Black', 'Space Mono'], note: 'raw borders, no rounding, system-blue links, hard shadows, dense blocks', tags: ['indie', 'creative', 'frontend'] },
  { id: 'archive', name: 'Archive / index', fonts: ['Instrument Serif', 'Geist Mono'], note: 'everything is a catalog row: № · title · year · type, filterable', tags: ['many-projects', 'design', 'research'] },
  { id: 'paper', name: 'Academic paper', fonts: ['Source Serif 4', 'Source Sans 3'], note: 'single column, abstract-style about, numbered references, small caps', tags: ['research', 'phd', 'ml'] },
  { id: 'soft', name: 'Soft / organic', fonts: ['Bricolage Grotesque', 'Figtree'], note: 'warm pastels, generous whitespace, rounded shapes, grain texture', tags: ['product', 'ux', 'student', 'education'] },
  { id: 'retro-os', name: 'Retro desktop OS', fonts: ['VT323', 'IBM Plex Mono'], note: 'windows with title bars, a dock or menu bar, projects as files/folders', tags: ['systems', 'security', 'frontend', 'creative'] },
  { id: 'zine', name: 'Zine / collage', fonts: ['Bagel Fat One', 'Young Serif'], note: '2–3 riso ink colors, overlapping blocks, rotated sticker labels', tags: ['creative', 'community', 'student'] },
  { id: 'cinematic', name: 'Cinematic dark', fonts: ['Syne', 'Hanken Grotesk'], note: 'near-black, huge cropped type, film-credit career, slow reveals', tags: ['frontend', 'creative', 'ml', 'product'] },
  { id: 'kinetic', name: 'Kinetic type', fonts: ['Unbounded', 'Manrope'], note: 'type is the image: oversized, stretched, marquee lines, scroll-driven weight', tags: ['frontend', 'design', 'creative'] },
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

export function makeBriefs(p, { count = 6, seed = Date.now() } = {}) {
  const rand = rng(seed);
  const tags = profileTags(p);
  // Directions that fit the person come first, but at least a third of the set is a wildcard.
  const scored = shuffle(DIRECTIONS, rand).map((d) => ({ d, fit: d.tags.filter((t) => tags.includes(t)).length + rand() * 0.9 }));
  const fits = scored.filter((x) => x.fit >= 1).sort((a, b) => b.fit - a.fit).map((x) => x.d);
  const wild = shuffle(scored.filter((x) => x.fit < 1).map((x) => x.d), rand);
  const nFit = Math.min(fits.length, Math.ceil(count * 0.66));
  const directions = [...fits.slice(0, nFit), ...wild, ...fits.slice(nFit)].slice(0, count);

  const layouts = shuffle(LAYOUTS, rand);
  const motions = shuffle(MOTION, rand);
  const palettes = shuffle(PALETTES, rand);
  const signatures = shuffle(SIGNATURES, rand);

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

export const themeNameFor = (run, b) => `g${run}-${b.n}-${b.direction.id}`;

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

export function briefMarkdown(p, run, b, total, cli = 'npx -y folio-site@latest') {
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
${b.wildcard ? "- This is a **wildcard** brief: it doesn't obviously fit the person. Find the angle where it does.\n" : ''}
## Their content (design for what they actually have)
${contentShape(p)}

## Do this
1. Edit \`themes/${name}.js\`. It already renders every section safely (it's the starter). Rewrite it completely to match the brief. Keep \`meta.name = '${name}'\` and write a one-line \`meta.description\` of the look.
2. Rules: every profile value goes through \`h.esc\` / \`h.inline\` / \`h.md\` / \`h.attrUrl\`; no external \`<script src>\`; at most 2 font families; handle phones, dark *and* light, \`prefers-reduced-motion\`, \`:focus-visible\`; sort sections with \`h.ordered(p, sections)\`. The page must work with JS off.
3. \`${cli} theme check ${name}\`: **0 errors required.**
4. \`${cli} shot --theme ${name} --scheme light --pure\`, then look at the \`-part1\` and \`-part2\` screens (desktop and mobile); each is exactly one real screen. Any \`page script error\` line means your JS is broken: fix it. Fix what looks off: the 5-second read, orphan gaps, cramped phones, generic look.
5. One more check → shot round if anything scored below 4/5. Then stop; don't polish forever.
6. Reply with: the theme name, two sentences on the idea, and anything you couldn't get right.

Full rubric and banned patterns: skills/folio/DESIGN.md.
`;
}

export async function createRun(base, p, { count = 6, seed, cli } = {}) {
  const run = await nextRun(base);
  const usedSeed = seed ?? Number(createHash('sha1').update(`${Date.now()}${p.name}`).digest().readUInt32BE(0));
  const briefs = makeBriefs(p, { count, seed: usedSeed });
  const dir = join(base, GEN_DIR, String(run));
  await mkdir(dir, { recursive: true });
  await mkdir(join(base, 'themes'), { recursive: true });

  const starter = await readFile(new URL('../themes/_starter.js', import.meta.url), 'utf8');
  const files = [];
  for (const b of briefs) {
    const name = themeNameFor(run, b);
    const brief = briefMarkdown(p, run, b, briefs.length, cli);
    await writeFile(join(dir, `brief-${b.n}.md`), brief);
    const themeFile = join(base, 'themes', `${name}.js`);
    if (!existsSync(themeFile)) {
      await writeFile(
        themeFile,
        starter
          .replace("name: '__NAME__'", `name: '${name}'`)
          .replace("description: 'Describe the look in one line: mood, type, who it suits.'", `description: 'PENDING: ${b.direction.name} (not designed yet)'`),
      );
    }
    files.push({ name, brief: join(dir, `brief-${b.n}.md`), theme: themeFile, direction: b.direction.name });
  }
  await writeFile(join(dir, 'run.json'), `${JSON.stringify({ run, seed: usedSeed, created: new Date().toISOString(), briefs: briefs.map((b) => ({ ...b, direction: b.direction.id, theme: themeNameFor(run, b) })) }, null, 2)}\n`);

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

// A generated theme still carrying the PENDING description hasn't been designed yet.
export async function isPending(themeFile) {
  if (!existsSync(themeFile)) return true;
  return (await readFile(themeFile, 'utf8')).includes("description: 'PENDING:");
}
