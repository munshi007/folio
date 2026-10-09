// Benchmark: does folio give people genuinely different, good designs, compared with just asking a model?
//
// Two arms, same model, same person, same theme contract:
//   plain  N independent replies to "design a portfolio theme for this person"
//   folio  one folio round of N (directions, persona, briefs, checks, fix loop)
//
// Every design is measured in a real browser, without a model judging it:
//   look     display font, background lightness, accent hue, and a 16×10 "layout map" of the first screen
//            (background lightness + how much text sits in each cell, sampled with elementsFromPoint)
//   quality  theme-check errors/warnings, sideways scroll on a phone, body-text contrast
// Diversity is the average and the smallest distance between any two designs in an arm: a low minimum
// means near-duplicates.

import { mkdtemp, writeFile, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { loadConfig, renderHtml } from './build.js';
import { normalize } from './schema.js';
import { loadTheme } from './themes.js';
import { checkTheme } from './themecheck.js';
import { launch } from './cdp.js';
import { findChrome } from './shot.js';
import { openStore } from './store.js';
import { createJob } from './jobs.js';
import { runJobs, callModel, extractBlock, screenThemeSource, DEFAULT_MODEL } from './runner.js';
import { FolioError } from './errors.js';

const MEASURE = `(() => {
  const rgb = (c) => { const m = String(c).match(/[\\d.]+/g); return m && m.length >= 3 && !(m.length > 3 && Number(m[3]) === 0) ? m.slice(0, 3).map(Number) : null; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const v = rgb(getComputedStyle(e).backgroundColor); if (v) return v; } return [255, 255, 255]; };
  const hue = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.12) return null;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round(((h * 60) + 360) % 360); };
  document.querySelector('.folio-badge')?.remove();
  const W = innerWidth, H = innerHeight, cols = 16, rows = 10, map = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = (x + 0.5) * W / cols, py = (y + 0.5) * H / rows;
    const el = document.elementFromPoint(px, py);
    const text = el && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) ? 1 : 0;
    map.push(+lum(bgOf(el)).toFixed(3), text);
  }
  let big = null, size = 0, accents = new Map();
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (!r.width || r.top > H || r.bottom < 0) continue;
    const st = getComputedStyle(el);
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) { const fs = parseFloat(st.fontSize); if (fs > size) { size = fs; big = el; } }
    for (const c of [st.color, st.backgroundColor]) { const v = rgb(c); const hh = v && hue(v); if (hh != null) accents.set(hh, (accents.get(hh) || 0) + 1); }
  }
  const accent = [...accents.entries()].sort((a, b) => b[1] - a[1])[0];
  const body = getComputedStyle(document.body);
  const bodyBg = bgOf(document.querySelector('main p, p, main') || document.body);
  const ink = rgb(getComputedStyle(document.querySelector('main p, p') || document.body).color) || [0, 0, 0];
  const [a, b] = [lum(ink), lum(bodyBg)].sort((p, q) => q - p);
  return { font: big ? getComputedStyle(big).fontFamily.split(',')[0].replace(/["']/g, '').trim() : body.fontFamily.split(',')[0],
    nameSize: Math.round(size), bg: +lum(bgOf(document.body)).toFixed(3), accentHue: accent ? accent[0] : null, map,
    contrast: +((a + 0.05) / (b + 0.05)).toFixed(2) };
})()`;

export async function measureDesigns(configPath, names, { log = () => {} } = {}) {
  const bin = findChrome();
  if (!bin) throw new FolioError('The benchmark needs Chrome or Chromium.');
  const base = dirname(configPath);
  const raw = await loadConfig(configPath);
  const work = await mkdtemp(join(tmpdir(), 'folio-bench-'));
  const browser = await launch(bin);
  const out = [];
  try {
    for (const name of names) {
      let check;
      try {
        check = checkTheme(await loadTheme(name, base));
      } catch (e) {
        out.push({ name, broken: e.message });
        continue;
      }
      const { html } = await renderHtml(raw, { theme: name, baseDir: base, pure: true });
      const file = join(work, `${name}.html`);
      await writeFile(file, html);
      await browser.open(pathToFileURL(file).href, { width: 1440, height: 900, mobile: false, scheme: 'light' });
      const look = await browser.evaluate(MEASURE);
      await browser.open(pathToFileURL(file).href, { width: 390, height: 844, mobile: true, scale: 1, scheme: 'light' });
      const sideways = await browser.evaluate('document.documentElement.scrollWidth > innerWidth + 1');
      out.push({ name, ...look, errors: check.errors.length, warnings: check.warnings.length, sideways });
      log(`measured ${name}`);
    }
  } finally {
    await browser.close();
  }
  return out;
}

// 0 = identical, 1 = as different as it gets.
export function distance(a, b) {
  const font = a.font.toLowerCase() === b.font.toLowerCase() ? 0 : 1;
  const bg = Math.min(1, Math.abs(a.bg - b.bg) * 1.5);
  const hue = a.accentHue == null || b.accentHue == null ? (a.accentHue === b.accentHue ? 0 : 0.6) : Math.min(Math.abs(a.accentHue - b.accentHue), 360 - Math.abs(a.accentHue - b.accentHue)) / 180;
  let layout = 0;
  for (let i = 0; i < a.map.length; i++) layout += Math.abs(a.map[i] - b.map[i]);
  layout = Math.min(1, layout / (a.map.length * 0.35));
  return +(0.25 * font + 0.2 * bg + 0.2 * hue + 0.35 * layout).toFixed(3);
}

export function summarize(designs) {
  const ok = designs.filter((d) => !d.broken);
  const pairs = [];
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) pairs.push({ a: ok[i].name, b: ok[j].name, d: distance(ok[i], ok[j]) });
  const mean = pairs.length ? pairs.reduce((s, p) => s + p.d, 0) / pairs.length : 0;
  const closest = pairs.sort((x, y) => x.d - y.d)[0] ?? null;
  return {
    designs: designs.length,
    broken: designs.length - ok.length,
    meanDistance: +mean.toFixed(3),
    minDistance: closest ? closest.d : 0,
    closestPair: closest ? [closest.a, closest.b] : null,
    nearDuplicates: pairs.filter((p) => p.d < 0.15).length,
    fonts: new Set(ok.map((d) => d.font.toLowerCase())).size,
    darkBackgrounds: ok.filter((d) => d.bg < 0.2).length,
    passChecks: ok.filter((d) => d.errors === 0).length,
    phoneSideways: ok.filter((d) => d.sideways).length,
    lowContrast: ok.filter((d) => d.contrast < 4.5).length,
  };
}

// ---- The full A/B run (needs an API key) -------------------------------------------------------

const PLAIN_SYSTEM = `Write a personal portfolio website as one JavaScript ES module:
  export const meta = { name, description }
  export function render(p, h) { return { css, body, fonts?, script? } }
p is the person's profile (the JSON below); h has helpers h.esc (escape text), h.attrUrl (safe href), h.inline and h.md (markdown). Escape every profile value. Use only the two arguments: no imports or external scripts. Reply with the file in one \`\`\`js block.`;

export async function runBench({ config = 'folio.json', apiKey, model = DEFAULT_MODEL, n = 6, out, log = console.log, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new FolioError('The A/B benchmark calls a model: set ANTHROPIC_API_KEY.');
  const configPath = resolve(config);
  const raw = await loadConfig(configPath);
  const outDir = resolve(out || join(dirname(configPath), 'folio-bench'));
  // A throwaway project so the benchmark never touches the person's own designs or jobs.
  const proj = await mkdtemp(join(tmpdir(), 'folio-bench-proj-'));
  await writeFile(join(proj, 'folio.json'), JSON.stringify({ ...raw, theme: 'editorial' }, null, 2));
  const assets = join(dirname(configPath), 'assets');
  if (existsSync(assets)) await cp(assets, join(proj, 'assets'), { recursive: true });
  await mkdir(join(proj, 'themes'), { recursive: true });
  const store = openStore(proj);
  // folio's arm gets what folio would have: the person's persona and taste answers, if they have them.
  for (const f of ['persona.json', 'answers.json']) {
    const src = join(dirname(configPath), '.folio', f);
    if (existsSync(src)) await cp(src, join(proj, '.folio', f));
  }

  log(`plain prompt × ${n}`);
  const plain = [];
  await Promise.all(Array.from({ length: n }, async (_, i) => {
    const name = `plain-${i + 1}`;
    try {
      const reply = await callModel({ apiKey, model, fetchImpl, system: PLAIN_SYSTEM, messages: [{ role: 'user', content: `Design a portfolio site for this person.\n\n\`\`\`json\n${JSON.stringify(raw, null, 2)}\n\`\`\`` }] });
      const src = extractBlock(reply, 'js');
      const problems = screenThemeSource(src);
      if (problems.length) throw new Error(`refused: ${problems.join(', ')}`);
      await store.themes.writeText(`${name}.js`, src.replace(/name:\s*['"][^'"]*['"]/, `name: '${name}'`));
      plain.push(name);
    } catch (e) {
      log(`  ${name}: ${e.message}`);
    }
  }));

  log(`folio round × ${n}`);
  const job = await createJob(store, proj, normalize(raw), { count: n, cli: 'folio' });
  await runJobs({ store, base: proj, configPath: join(proj, 'folio.json'), apiKey, model, parallel: 3, fetchImpl, log: (m) => log(`  ${m}`) });
  const folioNames = job.items.map((i) => i.theme);

  const cfg = join(proj, 'folio.json');
  const results = {
    model,
    at: new Date().toISOString(),
    plain: await measureDesigns(cfg, [...plain].sort()),
    folio: await measureDesigns(cfg, folioNames),
  };
  results.summary = { plain: summarize(results.plain), folio: summarize(results.folio) };
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  await writeFile(join(outDir, 'REPORT.md'), report(results));
  await cp(join(proj, 'themes'), join(outDir, 'themes'), { recursive: true });
  return { outDir, ...results };
}

export function report(r) {
  const rows = [
    ['Designs that rendered', (s) => `${s.designs - s.broken} / ${s.designs}`],
    ['Average difference between designs (0–1)', (s) => s.meanDistance],
    ['Most similar pair (0 = identical)', (s) => s.minDistance],
    ['Near-duplicate pairs', (s) => s.nearDuplicates],
    ['Different display fonts', (s) => s.fonts],
    ['Dark backgrounds', (s) => s.darkBackgrounds],
    ['Pass folio’s checks (0 errors)', (s) => s.passChecks],
    ['Sideways scroll on a phone', (s) => s.phoneSideways],
    ['Body text below 4.5:1 contrast', (s) => s.lowContrast],
  ];
  const { plain, folio } = r.summary;
  return `# folio benchmark

Model: \`${r.model}\` · ${r.at.slice(0, 10)}

Same person, same model, same theme contract. **Plain** = ${plain.designs} independent replies to "design a portfolio site for this person". **folio** = one folio round of ${folio.designs}.
Every number is measured in a real browser; no model grades anything.

| | Plain prompt | folio |
|---|---|---|
${rows.map(([label, f]) => `| ${label} | ${f(plain)} | ${f(folio)} |`).join('\n')}

Fonts: plain ${[...new Set(r.plain.filter((d) => !d.broken).map((d) => d.font))].join(', ') || '–'} · folio ${[...new Set(r.folio.filter((d) => !d.broken).map((d) => d.font))].join(', ') || '–'}

How "difference" is measured: display font (25%), background lightness (20%), accent hue (20%) and a 16×10 map of the first screen's background and text placement (35%).
`;
}
