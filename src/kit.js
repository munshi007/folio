// Identity kit: the person's chosen design carried onto everything around the site.
//
//   og.png               1200×630   link preview (a real screenshot of their site's first screen)
//   linkedin-banner.png  1584×396   LinkedIn cover
//   x-header.png         1500×500   X / Twitter header
//   post.png             1080×1350  "new site" announcement post
//   resume.pdf           A4         a one-page résumé in the same type and colours
//
// Tokens (background, ink, accent, fonts) are read from the rendered site in a real browser, so the kit
// matches whatever the design actually looks like, including agent-made ones folio knows nothing about.

import { mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from './build.js';
import { launch } from './cdp.js';
import { findChrome } from './shot.js';
import { esc, hostOf, dateRange } from './util.js';
import { FolioError } from './errors.js';

export const KIT_FILES = ['og.png', 'linkedin-banner.png', 'x-header.png', 'post.png', 'resume.pdf'];

const READ_TOKENS = `(() => {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const clear = (c) => !c || c === 'transparent' || /rgba\\(.*,\\s*0\\)$/.test(c);
  const meta = document.querySelector('meta[name=theme-color][media*=light]') || document.querySelector('meta[name=theme-color]');
  let bg = cs(document.body).backgroundColor;
  if (clear(bg)) bg = cs(document.documentElement).backgroundColor;
  if (clear(bg)) bg = meta ? meta.content : '#ffffff';
  // The display face is whatever the biggest text on the first screen is set in (usually the name).
  let head = null, headSize = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.folio-badge') || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || r.top > innerHeight || r.bottom < 0) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs > headSize) { head = el; headSize = fs; }
  }
  const link = [...document.querySelectorAll('main a, section a, a')].find((a) => !a.closest('.folio-badge') && a.textContent.trim());
  const accentVar = cs(document.documentElement).getPropertyValue('--accent').trim();
  const fonts = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href).filter((h) => h.includes('fonts.googleapis.com'));
  const h = cs(head) || cs(document.body);
  // The accent is the most saturated colour the first screen actually paints (weighted by how often).
  const rgb = (c) => { const m = String(c).match(/[\\d.]+/g); return m && m.length >= 3 && !(m.length > 3 && Number(m[3]) === 0) ? m.slice(0, 3).map(Number) : null; };
  const sat = ([r, g, b]) => { const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
  const seen = new Map();
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0 || !r.width || el.closest('.folio-badge')) continue;
    const st = getComputedStyle(el);
    for (const c of [st.color, st.backgroundColor, st.borderTopColor]) {
      const v = rgb(c); if (!v || sat(v) < 0.35) continue;
      const lum = (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255; if (lum < 0.08 || lum > 0.97) continue;
      const k = v.join(','); seen.set(k, (seen.get(k) || 0) + 1);
    }
  }
  // Pseudo-elements and later sections aren't walked above, so the stylesheet's own colours are the fallback.
  if (!seen.size) {
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch { continue; }
      for (const rule of rules) for (const m of (rule.cssText || '').matchAll(/#[0-9a-f]{6}\\b|rgba?\\([^)]*\\)/gi)) {
        const c = m[0].startsWith('#') ? [1, 3, 5].map((i) => parseInt(m[0].slice(i, i + 2), 16)) : rgb(m[0]);
        if (!c || sat(c) < 0.35) continue;
        const k = c.join(','); seen.set(k, (seen.get(k) || 0) + 1);
      }
    }
  }
  const best = [...seen.entries()].sort((a, b) => b[1] * sat(b[0].split(',').map(Number)) - a[1] * sat(a[0].split(',').map(Number)))[0];
  const vAccent = rgb(accentVar);
  const accent = vAccent && sat(vAccent) >= 0.35 ? accentVar : best ? 'rgb(' + best[0] + ')' : (link ? cs(link).color : cs(document.body).color);
  return { bg, ink: cs(document.body).color, accent,
    display: h.fontFamily, displayWeight: h.fontWeight, displayStyle: h.fontStyle,
    // Tracking scales with size, so keep it in em (a 150px heading's -6px would crush a 28pt name).
    displaySpacing: h.letterSpacing === 'normal' ? 'normal' : (parseFloat(h.letterSpacing) / parseFloat(h.fontSize)).toFixed(3) + 'em', displayCase: h.textTransform,
    text: cs(document.body).fontFamily, fonts };
})()`;

const fontLinks = (t) => t.fonts.map((f) => `<link rel="stylesheet" href="${esc(f)}">`).join('');
const display = (t) => `font-family:${t.display};font-weight:${t.displayWeight};font-style:${t.displayStyle};text-transform:${t.displayCase};letter-spacing:${t.displaySpacing === 'normal' ? '-0.01em' : t.displaySpacing}`;

function lum(c) {
  const m = String(c).match(/[\d.]+/g);
  if (!m) return 0.5;
  const [r, g, b] = m.slice(0, 3).map((x) => { const v = Number(x) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Accent as text only where it's readable on the background (lime on cream isn't); otherwise ink.
const accentText = (t) => (contrast(t.accent, t.bg) >= 3 ? t.accent : t.ink);

function frame(t, w, h, inner, extraCss = '') {
  return `<!doctype html><html><head><meta charset="utf-8">${fontLinks(t)}<style>
*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden}
body{background:${t.bg};color:${t.ink};font-family:${t.text};-webkit-font-smoothing:antialiased}
.d{${display(t)};line-height:.95}.mute{opacity:.68}.acc{color:${accentText(t)}}
.mark{background:${t.accent};color:${contrast(t.accent, '#000') > contrast(t.accent, '#fff') ? '#000' : '#fff'};padding:.08em .32em}
${extraCss}</style></head><body>${inner}</body></html>`;
}

// Name size that fits a width: long names get smaller, never cropped.
// Inline markdown (**bold**, *em*, [text](url)) as plain text, for places that aren't HTML-rendered markdown.
const plain = (s) => String(s ?? '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__/g, (m, a, b, c) => a || b || c);

const fit = (name, width, max, min = 40) => Math.max(min, Math.min(max, Math.round(width / (Math.max(6, name.length) * 0.58))));

function cover(t, p, w, h) {
  // LinkedIn and X put the avatar over the lower left, so the words sit right of it.
  const left = Math.round(w * 0.3);
  const size = fit(p.name, w - left - 80, Math.round(h * 0.34));
  const site = p.url ? hostOf(p.url) + (new URL(p.url).pathname.replace(/\/$/, '') || '') : '';
  return frame(t, w, h, `
<div class="bar"></div>
<div class="txt">
  <div class="d" style="font-size:${size}px">${esc(p.name)}</div>
  ${p.headline ? `<div class="hl" style="font-size:${Math.round(size * 0.3)}px">${esc(p.headline)}</div>` : ''}
  ${site || p.location ? `<div class="meta mute">${esc([site, p.location].filter(Boolean).join('  ·  '))}</div>` : ''}
</div>`, `.bar{position:absolute;left:0;top:0;bottom:0;width:${Math.round(w * 0.012)}px;background:${t.accent}}
.txt{position:absolute;left:${left}px;right:72px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:${Math.round(h * 0.04)}px}
.hl{line-height:1.25;max-width:32em}.meta{font-size:${Math.round(h * 0.055)}px;letter-spacing:.02em}`);
}

function post(t, p, heroUrl) {
  const size = fit(p.name, 920, 132);
  const site = p.url ? hostOf(p.url) + (new URL(p.url).pathname.replace(/\/$/, '') || '') : '';
  return frame(t, 1080, 1350, `
<div class="top">
  <div class="eye"><span class="mark">New site</span></div>
  <div class="d" style="font-size:${size}px">${esc(p.name)}</div>
  ${p.headline ? `<div class="hl">${esc(p.headline)}</div>` : ''}
</div>
<div class="win"><div class="chrome"><i></i><i></i><i></i><span>${esc(site || p.name)}</span></div><img src="${esc(heroUrl)}" alt=""></div>
${site ? `<div class="url d">${esc(site)} <span class="acc">→</span></div>` : ''}`, `
body{padding:84px 80px;display:flex;flex-direction:column;justify-content:center;gap:56px}
.top{display:flex;flex-direction:column;gap:22px}.eye{font-size:26px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.hl{font-size:36px;line-height:1.25;opacity:.8;max-width:24em}
.win{border-radius:22px;overflow:hidden;border:2px solid color-mix(in srgb,${t.ink} 18%,transparent);box-shadow:0 30px 80px -30px color-mix(in srgb,${t.ink} 45%,transparent);background:${t.bg}}
.chrome{display:flex;align-items:center;gap:10px;padding:14px 18px;background:color-mix(in srgb,${t.ink} 7%,${t.bg});font-size:20px}
.chrome i{width:14px;height:14px;border-radius:50%;background:color-mix(in srgb,${t.ink} 25%,transparent)}.chrome span{margin-left:12px;opacity:.6}
.win img{display:block;width:100%}.url{font-size:44px}`);
}

function resume(t, p) {
  const contact = [p.email, p.url && hostOf(p.url), ...p.links.filter((l) => /^https?:/.test(l.url)).slice(0, 3).map((l) => hostOf(l.url) + new URL(l.url).pathname.replace(/\/$/, '')), p.location].filter(Boolean);
  const sec = (title, body) => (body ? `<section><h2 class="acc">${esc(title)}</h2>${body}</section>` : '');
  const exp = p.experience.map((e) => `<div class="it"><div class="row"><b>${esc(e.role)}${e.org ? ` · ${esc(e.org)}` : ''}</b><span class="mute">${esc(dateRange(e.start, e.end))}</span></div>${e.summary ? `<p>${esc(plain(e.summary))}</p>` : ''}${e.highlights.length ? `<ul>${e.highlights.slice(0, 4).map((x) => `<li>${esc(plain(x))}</li>`).join('')}</ul>` : ''}</div>`).join('');
  const proj = p.projects.slice(0, 4).map((x) => `<div class="it"><div class="row"><b>${esc(x.name)}</b><span class="mute">${esc([x.tags.slice(0, 3).join(', '), x.year].filter(Boolean).join(' · '))}</span></div>${x.description ? `<p>${esc(plain(x.description))}</p>` : ''}${x.highlights.length ? `<ul>${x.highlights.slice(0, 2).map((h) => `<li>${esc(plain(h))}</li>`).join('')}</ul>` : ''}</div>`).join('');
  const edu = p.education.map((e) => `<div class="it"><div class="row"><b>${esc(e.school)}</b><span class="mute">${esc(dateRange(e.start, e.end))}</span></div>${e.degree ? `<p>${esc(e.degree)}${e.details ? ` · ${esc(e.details)}` : ''}</p>` : ''}</div>`).join('');
  const skills = p.skills.map((s) => `<p><b>${esc(s.group)}:</b> ${esc(s.items.join(', '))}</p>`).join('');
  const about = plain(p.about).split(/\n\s*\n/)[0];
  return `<!doctype html><html><head><meta charset="utf-8">${fontLinks(t)}<style>
@page{size:A4;margin:16mm 16mm 14mm}*{box-sizing:border-box;margin:0}
body{font-family:${t.text};color:#1a1a1a;font-size:10pt;line-height:1.45;-webkit-print-color-adjust:exact}
header{border-bottom:2.5pt solid ${t.accent};padding-bottom:10pt;margin-bottom:12pt}
.d{${display(t)};font-size:28pt;line-height:1;color:#111}
.hl{font-size:12pt;margin-top:4pt}.contact{margin-top:6pt;font-size:9pt;color:#555;display:flex;flex-wrap:wrap;gap:4pt 12pt}
section{margin-top:11pt}h2{font-size:8.5pt;letter-spacing:.14em;text-transform:uppercase;margin-bottom:5pt}
.acc{color:${t.accent}}.mute{color:#666;font-size:9pt;white-space:nowrap}.it{margin-bottom:7pt;break-inside:avoid}
.row{display:flex;justify-content:space-between;gap:12pt;align-items:baseline}p{margin-top:2pt}ul{margin:3pt 0 0 13pt;padding:0}li{margin-top:1.5pt}
</style></head><body>
<header><div class="d">${esc(p.name)}</div>${p.headline ? `<div class="hl">${esc(p.headline)}</div>` : ''}<div class="contact">${contact.map((c) => `<span>${esc(c)}</span>`).join('')}</div></header>
${about ? `<p>${esc(about)}</p>` : ''}
${sec('Experience', exp)}${sec('Projects', proj)}${sec('Education', edu)}${sec('Skills', skills)}
</body></html>`;
}

// Accent colours that are too pale to read on white (e.g. lime) make a poor résumé rule; darken them for print.
function printableAccent(t) {
  const m = t.accent.match(/\d+(\.\d+)?/g);
  if (!m) return t;
  const [r, g, b] = m.map(Number);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.45 ? { ...t, accent: `rgb(${Math.round(r * 0.45)}, ${Math.round(g * 0.45)}, ${Math.round(b * 0.45)})` } : t;
}

export async function makeKit({ config = 'folio.json', out, theme, log = () => {} } = {}) {
  const configPath = resolve(config);
  const base = dirname(configPath);
  const outDir = resolve(out || join(base, 'folio-kit'));
  const bin = findChrome();
  if (!bin) throw new FolioError('The identity kit needs Chrome or Chromium (set CHROME_PATH if it is installed somewhere unusual).');

  const work = join(base, '.folio', 'kit');
  await rm(work, { recursive: true, force: true });
  const site = join(work, 'site');
  const { profile: p } = await build({ config: configPath, out: site, theme });
  await mkdir(outDir, { recursive: true });

  const browser = await launch(bin);
  try {
    const siteUrl = pathToFileURL(join(site, 'index.html')).href;
    await browser.open(siteUrl, { width: 1200, height: 630, mobile: false, scheme: 'light' });
    await browser.evaluate("document.querySelector('.folio-badge')?.remove()");
    await writeFile(join(outDir, 'og.png'), await browser.screen(0));
    log('og.png (link preview)');

    await browser.open(siteUrl, { width: 1440, height: 1000, mobile: false, scheme: 'light' });
    const tokens = await browser.evaluate(READ_TOKENS);
    await browser.evaluate("document.querySelector('.folio-badge')?.remove()");
    await writeFile(join(work, 'hero.png'), await browser.screen(0));

    const shots = [
      ['linkedin-banner.png', 1584, 396, cover(tokens, p, 1584, 396)],
      ['x-header.png', 1500, 500, cover(tokens, p, 1500, 500)],
      ['post.png', 1080, 1350, post(tokens, p, pathToFileURL(join(work, 'hero.png')).href)],
    ];
    for (const [name, w, h, html] of shots) {
      const file = join(work, name.replace('.png', '.html'));
      await writeFile(file, html);
      await browser.open(pathToFileURL(file).href, { width: w, height: h, mobile: false, scheme: 'light' });
      await writeFile(join(outDir, name), await browser.screen(0));
      log(name);
    }

    const rfile = join(work, 'resume.html');
    await writeFile(rfile, resume(printableAccent(tokens), p));
    await browser.open(pathToFileURL(rfile).href, { width: 794, height: 1123, mobile: false, scheme: 'light' });
    await writeFile(join(outDir, 'resume.pdf'), await browser.pdf());
    log('resume.pdf');
    return { outDir, files: KIT_FILES.filter((f) => existsSync(join(outDir, f))), tokens, errors: browser.errors };
  } finally {
    await browser.close();
  }
}

export async function listKit(base) {
  const dir = join(base, 'folio-kit');
  if (!existsSync(dir)) return [];
  const have = await readdir(dir);
  return KIT_FILES.filter((f) => have.includes(f));
}
