// Sketches: cheap first screens. A sketch is a small spec (palette, type, layout, motif, headline) that folio
// renders instantly with the person's real content. Explore shows many; only liked ones get built into full
// sites by an agent. Specs come from two places:
//   auto  – folio samples them from the persona, the person's answers and what they liked before (no agent)
//   agent – an agent invents them from the persona and reference board (`folio sketch add <file.json>`)
//
// Store layout (data namespace):
//   sketches/<round>.json  { round, createdAt, source, specs: [spec] }
//   picks.json             { liked: { specId: iso }, skipped: { specId: iso } }

import { createHash } from 'node:crypto';
import { esc, inline } from './util.js';

export const LAYOUTS = ['statement', 'split', 'poster', 'editorial', 'bento', 'index', 'stack', 'terminal'];
export const MOTIFS = ['none', 'shapes', 'grid', 'lines', 'dots', 'tape', 'notebook'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const FONT = /^[A-Za-z0-9 ]{2,40}$/;
const GENERIC = ['Inter', 'Roboto', 'Arial', 'Poppins', 'Montserrat', 'Space Grotesk', 'Open Sans', 'Lato'];

// ---- Curated building blocks for auto sketches ------------------------------------------------
// Palettes: bg, ink, accent, accent2, muted. Tags drive matching against the persona and learned taste.
export const PALETTES = [
  { id: 'paper-cobalt', c: ['#f6f4ee', '#15161a', '#2f3fe0', '#ff6a2b', '#6b6b70'], tags: ['light', 'bold', 'cool'] },
  { id: 'white-primary', c: ['#ffffff', '#111111', '#e2361f', '#1f4fbf', '#f2b705'], tags: ['light', 'bold', 'colorful'] },
  { id: 'cream-plum', c: ['#f4eee6', '#2b2033', '#7a3e8e', '#d0663b', '#7d6f80'], tags: ['light', 'warm', 'soft'] },
  { id: 'mint-ink', c: ['#eef7f1', '#10241b', '#11865a', '#ffcf3f', '#5d7468'], tags: ['light', 'fresh', 'soft'] },
  { id: 'sky-coral', c: ['#eef4ff', '#14213d', '#ff5a5f', '#3a86ff', '#5b6b88'], tags: ['light', 'bold', 'colorful'] },
  { id: 'butter-blue', c: ['#fff6d8', '#1c1b17', '#2563eb', '#ef4444', '#6f6a58'], tags: ['light', 'warm', 'colorful'] },
  { id: 'gray-lime', c: ['#f2f2ef', '#131313', '#9ad72a', '#131313', '#707070'], tags: ['light', 'bold', 'cool'] },
  { id: 'blush-forest', c: ['#fbefec', '#1f2a24', '#245c45', '#e46f5a', '#74675f'], tags: ['light', 'warm', 'soft'] },
  { id: 'cobalt-lime', c: ['#2a3dff', '#ffffff', '#d4ff4a', '#ffffff', '#c7ccff'], tags: ['dark', 'bold', 'colorful'] },
  { id: 'night-amber', c: ['#101114', '#efeee8', '#ffb020', '#6c9be6', '#9a9ea5'], tags: ['dark', 'warm', 'bold'] },
  { id: 'forest-cream', c: ['#16261f', '#f2ecd9', '#e8b04a', '#8fc9a2', '#a8b3a8'], tags: ['dark', 'warm', 'soft'] },
  { id: 'ink-tomato', c: ['#1a1a1f', '#f5f2ea', '#ff5533', '#f5f2ea', '#8d8b86'], tags: ['dark', 'bold', 'warm'] },
  { id: 'lilac-black', c: ['#e9e3ff', '#17121f', '#5b2ee8', '#ff7ab6', '#6b6280'], tags: ['light', 'bold', 'playful'] },
  { id: 'sand-teal', c: ['#efe7da', '#1d2626', '#0f766e', '#c2410c', '#6e6a62'], tags: ['light', 'warm', 'calm'] },
  { id: 'snow-graphite', c: ['#fafafa', '#18181b', '#18181b', '#a1a1aa', '#71717a'], tags: ['light', 'calm', 'cool', 'sleek'] },
  { id: 'peach-violet', c: ['#ffe8d9', '#24142e', '#6d28d9', '#f97316', '#7c6a74'], tags: ['light', 'playful', 'warm', 'colorful'] },
];

// Font pairs: display + text (all Google Fonts, none of the generic AI defaults).
export const FONT_PAIRS = [
  { id: 'bricolage-figtree', d: 'Bricolage Grotesque', t: 'Figtree', w: 800, tags: ['sans', 'bold', 'warm'] },
  { id: 'fraunces-instrument', d: 'Fraunces', t: 'Instrument Sans', w: 600, tags: ['serif', 'warm', 'editorial'] },
  { id: 'instrument-serif', d: 'Instrument Serif', t: 'Instrument Sans', w: 400, tags: ['serif', 'calm', 'editorial', 'sleek'] },
  { id: 'syne-hanken', d: 'Syne', t: 'Hanken Grotesk', w: 800, tags: ['sans', 'bold', 'playful'] },
  { id: 'unbounded-manrope', d: 'Unbounded', t: 'Manrope', w: 800, tags: ['sans', 'bold', 'sleek'] },
  { id: 'jost', d: 'Jost', t: 'Jost', w: 700, tags: ['sans', 'geometric', 'calm'] },
  { id: 'jetbrains-dmsans', d: 'JetBrains Mono', t: 'DM Sans', w: 800, tags: ['mono', 'tech'] },
  { id: 'plex', d: 'IBM Plex Sans Condensed', t: 'IBM Plex Sans', w: 700, tags: ['sans', 'tech', 'calm'] },
  { id: 'archivo', d: 'Archivo', t: 'Archivo', w: 900, tags: ['sans', 'bold', 'sleek'] },
  { id: 'newsreader-geist', d: 'Newsreader', t: 'Geist', w: 500, tags: ['serif', 'editorial', 'calm'] },
  { id: 'young-serif', d: 'Young Serif', t: 'Figtree', w: 400, tags: ['serif', 'warm', 'playful'] },
  { id: 'caveat-figtree', d: 'Caveat', t: 'Figtree', w: 700, tags: ['hand', 'warm', 'playful', 'crafted'] },
  { id: 'schibsted', d: 'Schibsted Grotesk', t: 'Schibsted Grotesk', w: 800, tags: ['sans', 'calm', 'sleek'] },
  { id: 'dela-gothic', d: 'Dela Gothic One', t: 'Hanken Grotesk', w: 400, tags: ['display', 'bold', 'playful'] },
];

// ---- Spec validation ---------------------------------------------------------------------------

export function validateSpec(s, i = 0) {
  const e = [];
  const at = `[${i}]`;
  if (!s || typeof s !== 'object') return [`${at}: must be an object`];
  if (!String(s.title || '').trim()) e.push(`${at}.title: required`);
  if (!LAYOUTS.includes(s.layout)) e.push(`${at}.layout: one of ${LAYOUTS.join(', ')}`);
  if (s.motif != null && !MOTIFS.includes(s.motif)) e.push(`${at}.motif: one of ${MOTIFS.join(', ')}`);
  for (const k of ['bg', 'ink', 'accent']) if (!HEX.test(s.palette?.[k] || '')) e.push(`${at}.palette.${k}: #rrggbb`);
  for (const k of ['accent2', 'muted']) if (s.palette?.[k] != null && !HEX.test(s.palette[k])) e.push(`${at}.palette.${k}: #rrggbb`);
  for (const k of ['display', 'text']) {
    const f = s.fonts?.[k];
    if (!FONT.test(f || '')) e.push(`${at}.fonts.${k}: a Google Fonts family name`);
    else if (GENERIC.includes(f) && k === 'display') e.push(`${at}.fonts.display: ${f} is a generic default; pick something with character`);
  }
  if (s.layout === 'terminal' && !/Mono|Code|Plex Mono|VT323/i.test(s.fonts?.display || '')) e.push(`${at}: the terminal layout needs a monospace display font`);
  return e;
}

export function normalizeSpec(s) {
  const p = s.palette;
  return {
    id: s.id,
    title: String(s.title).trim().slice(0, 60),
    mood: String(s.mood || '').trim().slice(0, 80),
    note: String(s.note || '').trim().slice(0, 240),
    layout: s.layout,
    motif: MOTIFS.includes(s.motif) ? s.motif : 'none',
    palette: { bg: p.bg, ink: p.ink, accent: p.accent, accent2: HEX.test(p.accent2 || '') ? p.accent2 : p.accent, muted: HEX.test(p.muted || '') ? p.muted : p.ink },
    fonts: { display: s.fonts.display, text: s.fonts.text, weight: Number.isInteger(s.fonts.weight) ? Math.min(900, Math.max(100, s.fonts.weight)) : 700, italic: Boolean(s.fonts.italic), upper: Boolean(s.fonts.upper) },
    headline: String(s.headline || '').trim().slice(0, 140),
    refs: Array.isArray(s.refs) ? s.refs.filter((r) => typeof r === 'string').slice(0, 4) : [],
    source: s.source === 'agent' ? 'agent' : 'auto',
    tags: Array.isArray(s.tags) ? s.tags.slice(0, 8) : [],
  };
}

// ---- Rendering a first screen -------------------------------------------------------------------

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onColor = (hex) => (lum(hex) > 0.55 ? '#111111' : '#ffffff');

function motifCss(m, p) {
  switch (m) {
    case 'grid': return `background-image:linear-gradient(${p.muted}22 1px,transparent 1px),linear-gradient(90deg,${p.muted}22 1px,transparent 1px);background-size:48px 48px`;
    case 'dots': return `background-image:radial-gradient(${p.muted}44 1.6px,transparent 1.8px);background-size:26px 26px`;
    case 'notebook': return `background-image:repeating-linear-gradient(transparent 0 31px,${p.muted}33 31px 32px)`;
    case 'lines': return `background-image:linear-gradient(transparent 0 72%,${p.accent} 72% 74%,transparent 74% 79%,${p.accent2} 79% 81%,transparent 81%)`;
    case 'tape': return `background-image:repeating-linear-gradient(-45deg,${p.ink} 0 22px,${p.accent2} 22px 44px);background-size:100% 46px;background-repeat:no-repeat;background-position:bottom`;
    default: return '';
  }
}

function shapes(p) {
  return `<span class="sh c" style="background:${p.accent2}"></span><span class="sh q" style="background:${p.accent}"></span><span class="sh t" style="border-bottom-color:${p.ink}"></span>`;
}

function fontsUrl(f) {
  const fam = (name, w) => `family=${encodeURIComponent(name).replace(/%20/g, '+')}:${f.italic ? 'ital,' : ''}wght@${f.italic ? `1,${w}` : w}`;
  const parts = [fam(f.display, f.weight)];
  if (f.text !== f.display) parts.push(`family=${encodeURIComponent(f.text).replace(/%20/g, '+')}:wght@400;600`);
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

export function renderSketch(rawSpec, profile) {
  const s = normalizeSpec(rawSpec);
  const p = s.palette;
  const f = s.fonts;
  const name = esc(profile.name || 'Your Name');
  const headline = inline(s.headline || profile.headline || '');
  const projects = (profile.projects || []).filter((x) => x.featured).slice(0, 3);
  const proj = projects.length ? projects : (profile.projects || []).slice(0, 3);
  const stat = (x) => (x.stars != null ? `★ ${x.stars.toLocaleString('en-US')}` : x.year || '');
  const where = esc(profile.location || '');
  const disp = `font-family:'${f.display}',serif;font-weight:${f.weight};${f.italic ? 'font-style:italic;' : ''}${f.upper ? 'text-transform:uppercase;' : ''}`;
  const len = Math.max(6, (profile.name || '').length);
  const fit = (width, max, min = 48) => Math.max(min, Math.min(max, Math.round(width / (len * 0.62))));
  const big = fit(1100, 150);

  let body = '';
  switch (s.layout) {
    case 'statement':
      body = `<div class="pad col"><div class="top"><b>${name}</b><span>${where}</span></div>
<h1 style="${disp}font-size:84px;line-height:.95;max-width:1100px;margin:70px 0 0">${headline || name}</h1>
<div class="row3">${proj.map((x, i) => { const bg = [p.accent, p.accent2, p.ink][i]; return `<div class="tile" style="background:${bg};color:${onColor(bg)}"><b style="${disp}font-size:44px">${esc(stat(x)) || '·'}</b><span>${esc(x.name)}</span><small>${esc(x.description).slice(0, 90)}</small></div>`; }).join('')}</div></div>`;
      break;
    case 'split':
      body = `<div class="split"><div class="lft" style="background:${p.accent};color:${onColor(p.accent)}"><h1 style="${disp}font-size:${fit(440, 120)}px;line-height:.9">${name.replace(' ', '<br>')}</h1><p>${headline}</p></div>
<div class="rgt"><span class="k">Selected work</span>${proj.map((x, i) => `<div class="li"><b>0${i + 1}</b><div><b style="${disp}font-size:30px">${esc(x.name)}</b><p>${esc(x.description).slice(0, 110)}</p></div><span>${esc(stat(x))}</span></div>`).join('')}</div></div>`;
      break;
    case 'poster':
      body = `<div class="pad poster">${shapes(p)}<h1 style="${disp}font-size:${fit(860, 170)}px;line-height:.88;position:relative;max-width:900px">${name}</h1><p class="hl">${headline}</p><div class="foot">${proj.map((x) => `<span>${esc(x.name)}</span>`).join('')}</div></div>`;
      break;
    case 'editorial':
      body = `<div class="pad ed"><div><span class="k">${where}</span><h1 style="${disp}font-size:96px;line-height:1">${name}</h1><p class="hl" style="${disp}font-size:34px;font-weight:400;font-style:italic">${headline}</p></div>
<ol class="toc">${proj.map((x, i) => `<li><span style="color:${p.accent}">${i + 1}</span><div><b>${esc(x.name)}</b><p>${esc(x.description).slice(0, 120)}</p></div></li>`).join('')}</ol></div>`;
      break;
    case 'bento':
      body = `<div class="bento"><div class="b1" style="background:${p.ink};color:${p.bg}"><span class="k" style="color:${p.accent}">${where}</span><h1 style="${disp}font-size:${fit(560, 110)}px;line-height:.92">${name}</h1><p>${headline}</p></div>
${proj.map((x, i) => { const bg = [p.accent, p.accent2, p.muted][i]; return `<div class="b${i + 2}" style="background:${bg};color:${onColor(bg)}"><b style="${disp}font-size:28px">${esc(x.name)}</b><span>${esc(stat(x))}</span></div>`; }).join('')}</div>`;
      break;
    case 'index':
      body = `<div class="pad"><div class="top"><h1 style="${disp}font-size:72px;line-height:1">${name}</h1><span>${headline}</span></div>
<table class="ix"><tr><th>№</th><th>Work</th><th>What</th><th>Signal</th></tr>${proj.map((x, i) => `<tr><td>${String(i + 1).padStart(3, '0')}</td><td style="${disp}font-size:26px">${esc(x.name)}</td><td>${esc(x.description).slice(0, 80)}</td><td style="color:${p.accent}">${esc(stat(x))}</td></tr>`).join('')}</table></div>`;
      break;
    case 'stack':
      body = `<div class="pad stack"><h1 style="${disp}font-size:${fit(480, 96, 40)}px;line-height:1;max-width:520px">${name}</h1><p class="hl" style="max-width:480px">${headline}</p>
${proj.map((x, i) => `<div class="card c${i}"><b style="${disp}font-size:24px">${esc(x.name)}</b><p>${esc(x.description).slice(0, 100)}</p><span class="tag" style="background:${[p.accent, p.accent2, p.ink][i]};color:${onColor([p.accent, p.accent2, p.ink][i])}">${esc(stat(x)) || 'project'}</span></div>`).join('')}</div>`;
      break;
    case 'terminal':
      body = `<div class="pad"><div class="term" style="border-color:${p.ink}"><div class="bar" style="background:${p.ink};color:${p.bg}">~/${esc((profile.name || 'me').split(' ')[0].toLowerCase())}</div><div class="scr">
<p><span style="color:${p.accent}">$</span> whoami</p><h1 style="${disp}font-size:80px;line-height:1">${name}</h1><p>${headline}</p>
<p><span style="color:${p.accent}">$</span> ls projects</p>${proj.map((x) => `<p><b style="color:${p.accent2}">${esc(x.name)}/</b> ${esc(stat(x))}</p>`).join('')}</div></div></div>`;
      break;
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(s.title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(fontsUrl(f))}">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:${p.bg};color:${p.ink};font:400 19px/1.45 '${f.text}',system-ui,sans-serif;overflow:hidden;${motifCss(s.motif, p)}}
h1,p{margin:0}h1{text-wrap:balance}
.pad{padding:56px 72px;height:100%;position:relative}
.col{display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;gap:20px;align-items:baseline}
.top span{color:${p.muted}}
.k{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${p.muted}}
.row3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:auto}
.tile{border-radius:22px;padding:22px 24px;display:flex;flex-direction:column;gap:6px;min-height:210px}
.tile small{opacity:.85;font-size:15px}
.split{display:grid;grid-template-columns:5fr 7fr;height:100%}
.lft{padding:72px;display:flex;flex-direction:column;justify-content:space-between}
.lft p{font-size:24px;max-width:28ch}
.rgt{padding:72px;display:flex;flex-direction:column;gap:26px;justify-content:center}
.li{display:grid;grid-template-columns:56px 1fr auto;gap:18px;padding-bottom:22px;border-bottom:1px solid ${p.muted}55}
.li p{color:${p.muted};font-size:17px;margin-top:4px}
.poster .hl{font-size:28px;max-width:30ch;margin-top:30px;position:relative}
.poster .foot{position:absolute;left:72px;bottom:56px;display:flex;gap:28px;text-transform:uppercase;letter-spacing:.1em;font-size:14px}
.sh{position:absolute;display:block}
.sh.c{width:420px;height:420px;border-radius:50%;right:-60px;top:-90px}
.sh.q{width:300px;height:300px;right:260px;bottom:-70px}
.sh.t{width:0;height:0;right:50px;bottom:70px;border-left:130px solid transparent;border-right:130px solid transparent;border-bottom:225px solid}
.ed{display:grid;grid-template-columns:7fr 5fr;gap:70px;align-items:center}
.ed .hl{margin-top:22px;color:${p.muted};max-width:24ch}
.toc{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:22px}
.toc li{display:grid;grid-template-columns:40px 1fr;gap:14px;border-top:1px solid ${p.muted}55;padding-top:16px;font-size:18px}
.toc li span{font-size:34px;line-height:1}
.toc p{color:${p.muted};font-size:16px}
.bento{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr);gap:16px;padding:40px;height:100%}
.bento>div{border-radius:26px;padding:28px;display:flex;flex-direction:column;justify-content:space-between}
.b1{grid-column:span 2;grid-row:span 2}.b1 p{font-size:22px;opacity:.85;max-width:26ch}
.b2{grid-column:span 2}.b3,.b4{grid-column:span 1}
.ix{width:100%;border-collapse:collapse;margin-top:60px}
.ix th{text-align:left;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:${p.muted};padding:10px 0;border-bottom:2px solid ${p.ink}}
.ix td{padding:22px 16px 22px 0;border-bottom:1px solid ${p.muted}55;vertical-align:top;font-size:17px}
.stack .hl{font-size:24px;max-width:34ch;margin-top:14px}
.card{position:absolute;width:330px;background:#fffdf8;color:#222;border-radius:12px;padding:20px 22px;box-shadow:0 10px 26px rgba(0,0,0,.16);font-size:15px}
.card p{margin:8px 0 12px}
.card .tag{display:inline-block;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:600}
.c0{left:640px;top:90px;transform:rotate(3deg)}.c1{left:900px;top:360px;transform:rotate(-4deg)}.c2{left:500px;top:470px;transform:rotate(-2deg)}
.term{border:3px solid;border-radius:14px;overflow:hidden;max-width:1100px}
.term .bar{padding:10px 16px;font:500 15px ui-monospace,monospace}
.term .scr{padding:28px 32px;display:flex;flex-direction:column;gap:10px;font-family:'${f.display}',ui-monospace,monospace}
</style></head><body>${body}</body></html>`;
}

// ---- Auto specs: sampled from the persona, answers and learned taste ---------------------------

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

// How much the person seems to want each tag, from their answers and dials.
export function personaWeights(persona) {
  const w = {};
  const add = (tag, v) => (w[tag] = (w[tag] || 0) + v);
  const a = persona?.answers || {};
  const has = (k, opt) => (a[k] || []).includes(opt);
  if (has('taste', 'Light & airy')) add('light', 2), add('soft', 1), add('dark', -2.5);
  if (has('taste', 'Colorful & bold')) add('colorful', 2), add('bold', 2);
  if (has('taste', 'Crafted & tactile')) add('crafted', 2), add('warm', 1), add('hand', 1);
  if (has('taste', 'Sleek product-like')) add('sleek', 2), add('sans', 1);
  if (has('feel', 'Energized')) add('bold', 1.5);
  if (has('feel', 'Warm & curious')) add('warm', 1.5);
  if (has('feel', 'Playful')) add('playful', 2);
  if (has('feel', 'Calm & impressed')) add('calm', 1.5), add('editorial', 1);
  // Things they said to avoid push matching tags down ("all-dark monochrome" → dark).
  const avoid = (persona?.avoid || []).join(' ').toLowerCase();
  if (/dark|black|night/.test(avoid)) add('dark', -3);
  if (/serif|old.?fashioned|formal/.test(avoid)) add('serif', -2), add('editorial', -1.5);
  if (/mono|terminal|code/.test(avoid)) add('mono', -2), add('tech', -1);
  if (/playful|cute|childish/.test(avoid)) add('playful', -2);
  const d = persona?.dials || {};
  if (d.energy != null) add('bold', (d.energy - 5) / 3);
  if (d.warmth != null) add('warm', (d.warmth - 5) / 3);
  if (d.playfulness != null) add('playful', (d.playfulness - 5) / 3);
  if (d.formality != null) add('editorial', (d.formality - 5) / 3), add('serif', (d.formality - 5) / 4);
  if (d.techDepth != null) add('tech', (d.techDepth - 6) / 3), add('mono', (d.techDepth - 6) / 4);
  return w;
}

const LAYOUT_TAGS = { statement: ['bold', 'sleek'], split: ['bold', 'calm'], poster: ['bold', 'playful', 'colorful'], editorial: ['editorial', 'calm', 'serif'], bento: ['sleek', 'colorful', 'playful'], index: ['calm', 'editorial', 'tech'], stack: ['crafted', 'warm', 'playful'], terminal: ['tech', 'mono'] };
const MOTIF_TAGS = { none: ['sleek', 'calm'], shapes: ['colorful', 'playful', 'bold'], grid: ['tech', 'calm'], lines: ['bold', 'colorful'], dots: ['crafted', 'warm'], tape: ['bold', 'playful'], notebook: ['crafted', 'warm', 'hand'] };

export function fingerprint(spec) {
  return createHash('sha1').update([spec.layout, spec.motif, spec.palette.bg, spec.palette.accent, spec.fonts.display].join('|')).digest('hex').slice(0, 12);
}

export function autoSpecs({ persona, taste = {}, count = 12, seed = Date.now(), seen = new Set(), headline = '' }) {
  const rand = rng(seed);
  const prefs = personaWeights(persona);
  for (const [k, v] of Object.entries(taste)) prefs[k] = (prefs[k] || 0) + v; // learned from likes/skips
  const score = (tags) => tags.reduce((n, t) => n + (prefs[t] || 0), 0);
  const pick = (items, tagsOf, temp, avoid) => {
    const ws = items.map((x) => (avoid.has(x.id ?? x) ? 0.05 : 1) * Math.exp(score(tagsOf(x)) / temp));
    let r = rand() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) if ((r -= ws[i]) <= 0) return items[i];
    return items[items.length - 1];
  };
  // Wildcards explore, but never into what the person ruled out: a strongly disliked mood ("avoid all-dark")
  // or a layout they named ("no fake terminals") is off the table for every sketch.
  const vetoed = (tags) => tags.some((t) => (prefs[t] || 0) <= -4);
  const avoidText = (persona?.avoid || []).join(' ').toLowerCase();
  const layoutsOk = LAYOUTS.filter((l) => !vetoed(LAYOUT_TAGS[l]) && !(l === 'terminal' && /terminal|console|hacker|matrix/.test(avoidText)));
  const palettesOk = PALETTES.filter((p) => !vetoed(p.tags));
  const LAYOUT_POOL = layoutsOk.length >= 3 ? layoutsOk : LAYOUTS;
  const PALETTE_POOL = palettesOk.length >= 4 ? palettesOk : PALETTES;
  const used = { layout: new Set(), palette: new Set(), font: new Set() };
  const out = [];
  const wildEvery = 4; // every 4th sketch ignores taste entirely, so exploration never stops
  for (let i = 0, tries = 0; out.length < count && tries < count * 20; tries++) {
    const wild = (i + 1) % wildEvery === 0;
    const temp = wild ? 1e6 : 2.2;
    // Every layout appears once before any repeats: range is the point of a round.
    const layout = pick(LAYOUT_POOL.filter((l) => !used.layout.has(l)), (l) => LAYOUT_TAGS[l], temp, new Set());
    const fontsPool = layout === 'terminal' ? FONT_PAIRS.filter((f) => f.tags.includes('mono')) : FONT_PAIRS.filter((f) => !f.tags.includes('mono') || rand() < 0.3);
    const font = pick(fontsPool, (f) => f.tags, temp, used.font);
    const pal = pick(PALETTE_POOL, (p) => p.tags, temp, used.palette);
    const motifs = layout === 'poster' ? ['shapes'] : layout === 'bento' || layout === 'split' ? ['none', 'grid', 'dots'] : MOTIFS.filter((m) => m !== 'shapes');
    const motif = pick(motifs, (m) => MOTIF_TAGS[m], temp, new Set());
    const [bg, ink, accent, accent2, muted] = pal.c;
    const spec = {
      title: `${pal.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')} ${layout}`,
      mood: [...new Set([...pal.tags, ...LAYOUT_TAGS[layout]])].slice(0, 3).join(' · '),
      layout, motif,
      palette: { bg, ink, accent, accent2, muted },
      fonts: { display: font.d, text: font.t, weight: font.w, upper: layout === 'poster' ? false : rand() < 0.2 && font.tags.includes('sans') },
      headline,
      tags: [...new Set([...pal.tags, ...font.tags, ...LAYOUT_TAGS[layout], ...MOTIF_TAGS[motif], layout, `motif:${motif}`])],
      source: 'auto',
      wild,
    };
    const fp = fingerprint(normalizeSpec(spec));
    if (seen.has(fp)) continue; // never show the exact same sketch twice, in this round or any earlier one
    if (out.some((o) => o.title === spec.title)) continue; // two "Snow Graphite split"s in one round read as a bug
    seen.add(fp);
    used.layout.add(layout);
    used.palette.add(pal.id);
    used.font.add(font.id);
    if (used.layout.size === LAYOUT_POOL.length) used.layout.clear();
    out.push(spec);
    i++;
  }
  return out;
}

// Learned taste: tags of liked sketches count up, skipped count down. Small, readable, explainable.
export function learnTaste(specs, picks) {
  const t = {};
  for (const s of specs) {
    const v = picks.liked?.[s.id] ? 0.8 : picks.skipped?.[s.id] ? -0.5 : 0;
    if (!v) continue;
    for (const tag of s.tags || []) t[tag] = (t[tag] || 0) + v;
  }
  return t;
}
