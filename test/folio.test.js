import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { esc, safeUrl, inline, md, fmtDate, dateRange } from '../src/util.js';
import { validate, normalize } from '../src/schema.js';
import { renderHtml, build, FolioError } from '../src/build.js';
import { mergeGitHub } from '../src/github.js';
import { parseGitHubRemote, pagesUrl } from '../src/deploy.js';
import { themes } from '../themes/index.js';
import { checkTheme } from '../src/themecheck.js';
import { loadTheme, listThemes } from '../src/themes.js';
import * as starter from '../themes/_starter.js';

const example = JSON.parse(readFileSync(new URL('../examples/folio.example.json', import.meta.url), 'utf8'));

test('esc and safeUrl block injection', () => {
  assert.equal(esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl(' JavaScript:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,hi'), '');
  assert.equal(safeUrl('https://a.com'), 'https://a.com');
  assert.equal(safeUrl('img/me.png'), 'img/me.png');
  assert.equal(safeUrl('mailto:a@b.co'), 'mailto:a@b.co');
});

test('inline markdown escapes first and drops unsafe links', () => {
  assert.equal(inline('**38%** faster'), '<strong>38%</strong> faster');
  assert.equal(inline('[x](javascript:alert(1))'), 'x)');
  assert.ok(!inline('<script>').includes('<script>'));
  assert.equal(inline('[site](https://a.com?x=1&y=2)'), '<a href="https://a.com?x=1&amp;y=2">site</a>');
  assert.equal(md('a\n\nb'), '<p>a</p>\n<p>b</p>');
});

test('dates', () => {
  assert.equal(fmtDate('2024-06'), 'Jun 2024');
  assert.equal(fmtDate('present'), 'Present');
  assert.equal(fmtDate('nowhere'), 'nowhere');
  assert.equal(dateRange('2024', 'present'), '2024 – Present');
});

test('validate catches structural errors and warns on weak content', () => {
  assert.deepEqual(validate({}).errors, ['name: required']);
  assert.ok(validate({ name: 'A', projects: {} }).errors.some((e) => e.startsWith('projects')));
  assert.ok(validate({ name: 'A', accent: 'red' }).errors.some((e) => e.startsWith('accent')));
  assert.ok(validate({ name: 'A', projects: [{ name: 'x' }] }).warnings.some((w) => w.includes('no description')));
  assert.deepEqual(validate(example).errors, []);
});

test('normalize: links object, email link, loose skills, auto-featured', () => {
  const p = normalize({
    name: 'A',
    email: 'a@b.co',
    links: { GitHub: 'https://github.com/a', Mail: 'x@y.co' },
    skills: ['Go', { group: 'Tools', items: ['Docker'] }],
    projects: [{ name: '1' }, { name: '2' }, { name: '3' }, { name: '4' }],
  });
  assert.equal(p.links[1].url, 'mailto:x@y.co');
  assert.ok(p.links.some((l) => l.url === 'mailto:a@b.co'));
  assert.deepEqual(p.skills[0], { group: '', items: ['Go'] });
  assert.deepEqual(p.projects.map((x) => x.featured), [true, true, true, false]);
  assert.equal(p.badge, true);
  assert.equal(normalize({ name: 'A', badge: false }).badge, false);
});

for (const name of Object.keys(themes)) {
  test(`theme ${name} renders the example and a minimal profile`, async () => {
    const { html } = await renderHtml(example, { theme: name });
    assert.match(html, /<!doctype html>/);
    assert.match(html, /Maya Okafor/);
    assert.match(html, /quickdiff/);
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /built with folio/);

    const min = (await renderHtml({ name: 'Solo' }, { theme: name })).html;
    assert.match(min, /Solo/);
    assert.ok(!/undefined|null|NaN/.test(min.replace(/<script[\s\S]*?<\/script>/g, '')), 'no leaked undefined/null');
  });

  test(`theme ${name} escapes hostile content`, async () => {
    const evil = '<script>alert(1)</script>';
    const { html } = await renderHtml(
      {
        name: evil,
        headline: evil,
        about: evil,
        links: [{ label: evil, url: 'javascript:alert(1)' }],
        projects: [{ name: evil, description: evil, url: 'javascript:alert(1)', tags: [evil] }],
        experience: [{ role: evil, org: evil, highlights: [evil] }],
      },
      { theme: name },
    );
    assert.ok(!html.includes('<script>alert(1)'), 'raw script injected');
    assert.ok(!/href="javascript:/i.test(html), 'javascript: href');
  });
}

test('unknown theme is a clear error', async () => {
  await assert.rejects(renderHtml({ name: 'A' }, { theme: 'nope' }), FolioError);
});

test('build copies local images and refuses to wipe foreign folders', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-test-'));
  mkdirSync(join(dir, 'img'));
  writeFileSync(join(dir, 'img', 'me.png'), 'png');
  writeFileSync(join(dir, 'folio.json'), JSON.stringify({ name: 'A', avatar: 'img/me.png' }));

  const res = await build({ config: join(dir, 'folio.json'), out: join(dir, 'dist') });
  assert.ok(existsSync(join(dir, 'dist', 'index.html')));
  assert.ok(existsSync(join(dir, 'dist', 'img', 'me.png')));
  assert.deepEqual(res.warnings.filter((w) => w.startsWith('image')), []);

  // Rebuilding over our own output is fine.
  await build({ config: join(dir, 'folio.json'), out: join(dir, 'dist') });

  // A folder with someone else's files, or the project folder itself, is never wiped.
  mkdirSync(join(dir, 'other'));
  writeFileSync(join(dir, 'other', 'keep.txt'), 'important');
  await assert.rejects(build({ config: join(dir, 'folio.json'), out: join(dir, 'other') }), FolioError);
  await assert.rejects(build({ config: join(dir, 'folio.json'), out: dir }), FolioError);
  assert.ok(existsSync(join(dir, 'other', 'keep.txt')));
  assert.ok(existsSync(join(dir, 'folio.json')));
});

test('mergeGitHub never clobbers user-written fields', () => {
  const { config, added } = mergeGitHub(
    { name: 'Mine', headline: '', projects: [{ name: 'quickdiff', description: 'my words' }] },
    {
      profile: { name: 'GH', headline: 'gh bio', links: [{ label: 'GitHub', url: 'https://github.com/x' }] },
      projects: [
        { name: 'QuickDiff', description: 'gh desc', repo: 'https://github.com/x/quickdiff', stars: 9 },
        { name: 'new', description: 'n', repo: 'https://github.com/x/new', stars: 1 },
      ],
    },
  );
  assert.equal(config.name, 'Mine');
  assert.equal(config.headline, 'gh bio');
  assert.equal(config.projects[0].description, 'my words');
  assert.equal(config.projects[0].stars, 9);
  assert.deepEqual(added, ['new']);
});

test('deploy URL helpers', () => {
  assert.deepEqual(parseGitHubRemote('git@github.com:Ada/site.git'), { owner: 'Ada', repo: 'site' });
  assert.deepEqual(parseGitHubRemote('https://github.com/ada/ada.github.io'), { owner: 'ada', repo: 'ada.github.io' });
  assert.equal(parseGitHubRemote('https://gitlab.com/a/b'), null);
  assert.equal(pagesUrl({ owner: 'Ada', repo: 'ada.github.io' }), 'https://ada.github.io/');
  assert.equal(pagesUrl({ owner: 'Ada', repo: 'site' }), 'https://ada.github.io/site/');
});

for (const [name, theme] of [...Object.entries(themes), ['_starter', { meta: { ...starter.meta, name: 'starter' }, render: starter.render }]]) {
  test(`theme ${name} passes folio theme check with no errors or warnings`, () => {
    assert.deepEqual(checkTheme(theme), { errors: [], warnings: [] });
  });
}

test('theme check catches an unsafe theme', () => {
  const bad = { meta: { name: 'bad', description: 'x' }, render: (p) => ({ css: '', body: `<h1>${p.name}</h1><a href="${p.links[0]?.url ?? ''}">x</a>` }) };
  const { errors } = checkTheme(bad);
  assert.ok(errors.some((e) => e.startsWith('unescaped')));
  assert.ok(errors.some((e) => e.startsWith('unsafe URL')));
});

test('local themes load from <project>/themes, get helpers, and cannot escape the project', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-theme-'));
  mkdirSync(join(dir, 'themes'));
  writeFileSync(
    join(dir, 'themes', 'mine.js'),
    "export const meta = { name: 'mine', description: 'test' };\nexport function render(p, h) { return { css: '', body: `<h1>${h.esc(p.name)}</h1>` }; }\n",
  );
  const { html } = await renderHtml({ name: 'A <b>' }, { theme: 'mine', baseDir: dir });
  assert.match(html, /<h1>A &lt;b&gt;<\/h1>/);
  assert.ok((await listThemes(dir)).some((t) => t.name === 'mine' && t.source === 'local'));
  await assert.rejects(loadTheme('../../etc/evil.js', dir), FolioError);
  await assert.rejects(renderHtml({ name: 'A' }, { theme: 'missing', baseDir: dir }), FolioError);
});

for (const name of Object.keys(themes)) {
  test(`theme ${name}: folio.json accent overrides the theme's default`, async () => {
    const { html } = await renderHtml({ name: 'A', accent: '#ff0000' }, { theme: name });
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    const last = css.lastIndexOf('--accent:');
    assert.ok(last > 0, 'theme should use --accent');
    assert.equal(css.slice(last, last + 16), '--accent:#ff0000', 'user accent must be the last --accent declared');
  });
}

// ---- style settings -------------------------------------------------------------------------
import { applyMode, ordered as orderedFn, validateStyle } from '../src/style.js';
import { serve, applyStyleChange } from '../src/serve.js';

test('style.mode rewrites color-scheme blocks', () => {
  const css = 'a{c:1}@media (prefers-color-scheme:dark){:root{--x:dark}.y{z:1}}@media (prefers-color-scheme: light){:root{--x:light}}b{c:2}';
  assert.equal(applyMode(css, 'auto'), css);
  assert.equal(applyMode(css, 'dark'), 'a{c:1}:root{--x:dark}.y{z:1}b{c:2}');
  assert.equal(applyMode(css, 'light'), 'a{c:1}:root{--x:light}b{c:2}');
});

test('style validation and ordering', () => {
  assert.deepEqual(validateStyle({ mode: 'dark', font: 'serif', sections: ['skills'], hide: ['awards'] }), []);
  assert.equal(validateStyle({ mode: 'neon' }).length, 1);
  assert.equal(validateStyle({ sections: ['work'] }).length, 1);
  const items = [{ id: 'about' }, { id: 'projects', n: 1 }, { id: 'skills' }, { id: 'projects', n: 2 }];
  assert.equal(orderedFn({ sections: null }, items), items);
  assert.deepEqual(orderedFn({ sections: ['projects', 'skills', 'about'] }, items).map((x) => x.n ?? x.id), [1, 2, 'skills', 'about']);
});

for (const name of Object.keys(themes)) {
  test(`theme ${name}: style.hide, style.mode and style.font apply`, async () => {
    const { html } = await renderHtml({ ...example, style: { hide: ['experience'], mode: 'dark', font: 'mono' } }, { theme: name });
    assert.ok(!html.includes('Ledgerline'), 'hidden section still rendered');
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.ok(!/prefers-color-scheme/.test(css), 'mode=dark should remove scheme media queries');
    assert.match(html, /<meta name="color-scheme" content="dark">/);
    assert.match(html, /family=JetBrains\+Mono/);
  });
}

test('applyStyleChange only accepts known keys/values and keeps folio.json tidy', () => {
  const raw = { name: 'A', theme: 'bento' };
  assert.equal(applyStyleChange(raw, 'theme', 'blueprint', ['bento', 'blueprint']).theme, 'blueprint');
  assert.deepEqual(applyStyleChange(raw, 'mode', 'dark', []).style, { mode: 'dark' });
  assert.equal(applyStyleChange({ ...raw, style: { mode: 'dark' } }, 'mode', 'auto', []).style, undefined);
  assert.deepEqual(applyStyleChange(raw, 'sections', ['skills', 'about'], []).style, { sections: ['skills', 'about'] });
  assert.throws(() => applyStyleChange(raw, 'theme', '../evil', ['bento']));
  assert.throws(() => applyStyleChange(raw, 'name', 'Mallory', []));
  assert.throws(() => applyStyleChange(raw, 'hide', ['<script>'], []));
  assert.equal(raw.style, undefined, 'input must not be mutated');
});

test('dev server style endpoint rejects cross-site and malformed writes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-serve-'));
  const cfg = join(dir, 'folio.json');
  writeFileSync(cfg, JSON.stringify({ name: 'A', theme: 'bento' }));
  const port = 4800 + Math.floor(Math.random() * 500);
  const srv = await serve({ config: cfg, port });
  const post = (headers, body) =>
    fetch(`http://127.0.0.1:${port}/__folio/style`, { method: 'POST', headers, body: JSON.stringify(body) }).then((r) => r.status);
  try {
    const json = { 'Content-Type': 'application/json' };
    assert.equal(await post(json, { key: 'mode', value: 'dark' }), 403, 'missing X-Folio header');
    assert.equal(await post({ ...json, 'X-Folio': '1', Origin: 'https://evil.example' }, { key: 'mode', value: 'dark' }), 403, 'foreign origin');
    assert.equal(await post({ 'Content-Type': 'text/plain', 'X-Folio': '1' }, { key: 'mode', value: 'dark' }), 403, 'non-JSON');
    assert.equal(await post({ ...json, 'X-Folio': '1' }, { key: 'name', value: 'Mallory' }), 400, 'unknown key');
    assert.equal(JSON.parse(readFileSync(cfg, 'utf8')).style, undefined, 'nothing written yet');
    assert.equal(await post({ ...json, 'X-Folio': '1', Origin: `http://localhost:${port}` }, { key: 'mode', value: 'dark' }), 204);
    assert.deepEqual(JSON.parse(readFileSync(cfg, 'utf8')).style, { mode: 'dark' });
  } finally {
    srv.close();
  }
});

// ---- generate ---------------------------------------------------------------------------------
import { makeBriefs, createRun, readRun, isPending, profileTags } from '../src/generate.js';
import { galleryData, galleryPage } from '../src/gallery.js';

test('makeBriefs: reproducible, all directions distinct, fits weighted in', () => {
  const p = normalize(example);
  const a = makeBriefs(p, { count: 6, seed: 42 });
  const b = makeBriefs(p, { count: 6, seed: 42 });
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((x) => x.direction.id)).size, 6);
  assert.equal(new Set(a.map((x) => x.layout)).size, 6);
  assert.ok(a.some((x) => x.wildcard), 'needs at least one wildcard');
  assert.notDeepEqual(makeBriefs(p, { count: 6, seed: 7 }).map((x) => x.direction.id), a.map((x) => x.direction.id));
  assert.ok(profileTags(p).includes('student'));
});

test('createRun writes briefs + renderable pending themes; gallery reads them', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-gen-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  const { run, files } = await createRun(dir, normalize(example), { count: 3, seed: 1, cli: 'folio' });
  assert.equal(run, 1);
  assert.equal(files.length, 3);
  for (const f of files) {
    assert.ok(existsSync(f.brief) && existsSync(f.theme));
    assert.ok(await isPending(f.theme));
    assert.match(readFileSync(f.brief, 'utf8'), new RegExp(`folio theme check ${f.name}`));
    const { html } = await renderHtml(example, { theme: f.name, baseDir: dir });
    assert.match(html, /Maya Okafor/);
  }
  assert.equal((await readRun(dir, 1)).briefs.length, 3);
  assert.equal((await createRun(dir, normalize(example), { count: 2, seed: 2 })).run, 2, 'runs number upward');
  assert.equal(readFileSync(join(dir, '.folio', '.gitignore'), 'utf8'), '*\n');

  const one = await galleryData(dir, 1);
  assert.equal(one.runs.length, 1);
  assert.equal(one.runs[0].items.length, 3);
  assert.ok(one.runs[0].items.every((i) => i.pending));
  const all = await galleryData(dir);
  assert.deepEqual(all.runs.map((r) => r.run), [2, 1], 'every run, newest first');
  const html = galleryPage(all, { name: 'Maya <x>', current: 'bento' });
  assert.match(html, /5 versions of <em>Maya<\/em>/);
  assert.match(html, /id="run-1"/);
  assert.match(html, /id="run-2"/);
  assert.ok(!html.includes('<x>'), 'name must be escaped');
});

test('adopting from the gallery sets the theme and drops look overrides, keeps content choices', () => {
  const raw = { name: 'A', theme: 'bento', style: { font: 'serif', mode: 'dark', hide: ['awards'] } };
  const next = applyStyleChange(raw, 'adopt', 'blueprint', ['bento', 'blueprint']);
  assert.equal(next.theme, 'blueprint');
  assert.deepEqual(next.style, { hide: ['awards'] });
  assert.equal(applyStyleChange(raw, 'theme', 'blueprint', ['bento', 'blueprint']).style.font, 'serif', 'plain theme switch keeps overrides');
});

// ---- more like this -------------------------------------------------------------------------
import { makeVariations } from '../src/generate.js';

test('every built-in theme copies into a standalone theme that passes checks', async () => {
  for (const name of Object.keys(themes)) {
    const dir = mkdtempSync(join(tmpdir(), 'folio-copy-'));
    mkdirSync(join(dir, 'themes'));
    writeFileSync(join(dir, 'themes', `my-${name}.js`), await themeSource(name, `my-${name}`, dir));
    const t = await loadTheme(`my-${name}`, dir);
    assert.equal(t.meta.name, `my-${name}`);
    assert.deepEqual(checkTheme(t).errors, [], `copy of ${name}`);
  }
});

test('makeVariations: two big changes each, a color change in the set, never touches what is kept', () => {
  const v = makeVariations('bento', { count: 3, seed: 9 });
  assert.deepEqual(v, makeVariations('bento', { count: 3, seed: 9 }), 'reproducible');
  assert.ok(v.every((x) => x.changes.length === 2 && x.parent === 'bento' && x.keep === 'vibe'));
  const ids = v.flatMap((x) => x.move.split('-'));
  assert.equal(new Set(ids).size, ids.length, 'no axis repeats within 3 variations');
  assert.ok(ids.some((id) => id === 'palette' || id === 'flip'), 'set includes a color change');
  for (const keep of ['colors', 'type', 'layout', 'signature']) {
    const groups = { colors: ['palette', 'flip'], type: ['type'], layout: ['layout', 'denser'], signature: ['signature'] }[keep];
    for (const seed of [1, 2, 3, 4, 5]) {
      const moved = makeVariations('bento', { count: 3, seed, keep }).flatMap((x) => x.move.split('-'));
      assert.ok(!moved.some((id) => groups.includes(id)), `keep=${keep} must not change ${groups}`);
    }
  }
});

test('generate --like copies the parent, marks pending, and the gallery shows the original first', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-like-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  const { files } = await createRun(dir, normalize(example), { count: 3, seed: 3, cli: 'folio', like: 'blueprint', keep: 'colors' });
  assert.equal(files.length, 3);
  for (const f of files) {
    const src = readFileSync(f.theme, 'utf8');
    assert.match(src, /PENDING: .+ variation of blueprint/);
    assert.match(src, /Drafting grid|drafting grid/, 'starts as a copy of the parent');
    assert.match(readFileSync(f.brief, 'utf8'), /exact copy/);
    assert.match(readFileSync(f.brief, 'utf8'), /## Keep \(this is what they liked\)\nits color palette/);
    assert.deepEqual(checkTheme(await loadTheme(f.name, dir)).errors, []);
  }
  const data = await galleryData(dir, 1);
  assert.equal(data.runs[0].parent, 'blueprint');
  assert.equal(data.runs[0].items[0].original, true);
  assert.equal(data.runs[0].items.length, 4);
  assert.match(galleryPage(data, { name: 'Maya', current: 'blueprint' }), /More like <em>blueprint<\/em>/);
  await assert.rejects(createRun(dir, normalize(example), { count: 2, like: 'nope' }));
  await assert.rejects(createRun(dir, normalize(example), { count: 2, like: 'blueprint', keep: 'everything' }));
});

test('theme check flags wording hardcoded into a theme instead of coming from folio.json', () => {
  const baked = {
    meta: { name: 'baked', description: 'x' },
    render: (p, h) => ({ css: '', body: `<h1>${h.esc(p.name)}</h1><p>7 yrs shipping data systems</p><p>${h.esc(p.headline)}</p>` }),
  };
  assert.ok(checkTheme(baked).warnings.some((w) => w.includes('hardcoded wording') && w.includes('data systems')));
  const derived = {
    meta: { name: 'derived', description: 'x' },
    render: (p, h) => ({ css: '', body: `<h1>${h.esc(p.name)}</h1><p>${p.experience.length} roles since first role</p>` }),
  };
  assert.ok(!checkTheme(derived).warnings.some((w) => w.includes('hardcoded wording')));
});

// ---- store + library + api ------------------------------------------------------------------
import { openStore } from '../src/store.js';
import { request as httpRequest } from 'node:http';
import { syncLibrary, getLibrary, getDesign, restoreVersion, setFlag } from '../src/library.js';

test('store refuses keys that escape its folders', async () => {
  const s = openStore(mkdtempSync(join(tmpdir(), 'folio-store-')));
  for (const bad of ['../x', 'a/../../b', '/etc/passwd', '', 'a//b', '.']) {
    await assert.rejects(s.data.writeText(bad, 'x'), /invalid store key|escapes/);
  }
  await s.data.writeJSON('a/b.json', { ok: 1 });
  assert.deepEqual(await s.data.readJSON('a/b.json'), { ok: 1 });
});

test('library versions every change, restores without losing history, never deletes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-lib-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  mkdirSync(join(dir, 'themes'));
  const src = (n) => `export const meta = { name: 'mine', description: 'take ${n}' };\nexport function render(p, h) { return { css: '', body: '<h1>${n}</h1>' + h.esc(p.name) }; }\n`;
  const store = openStore(dir);
  writeFileSync(join(dir, 'themes', 'mine.js'), src(1));
  await syncLibrary(store);
  writeFileSync(join(dir, 'themes', 'mine.js'), src(2)); // an agent edits the file directly
  let d = await getDesign(store, 'mine');
  assert.deepEqual(d.versions.map((v) => [v.n, v.note]), [[2, 'edited outside Studio'], [1, 'created']]);
  const n = await restoreVersion(store, 'mine', 1);
  assert.equal(n, 3);
  assert.match(readFileSync(join(dir, 'themes', 'mine.js'), 'utf8'), /take 1/);
  d = await getDesign(store, 'mine');
  assert.equal(d.versions.length, 3, 'restoring added a version, kept the others');
  await setFlag(store, 'mine', 'archived', true);
  const lib = await getLibrary(store, { current: 'mine' });
  assert.equal(lib.designs[0].archived, true);
  assert.equal(lib.designs[0].current, true);
  // A deleted file keeps its record and history, and can be restored.
  rmSync(join(dir, 'themes', 'mine.js'));
  assert.equal((await getLibrary(store)).designs[0].missing, true);
  await restoreVersion(store, 'mine', 2);
  assert.match(readFileSync(join(dir, 'themes', 'mine.js'), 'utf8'), /take 2/);
  assert.ok(!(await getLibrary(store)).designs[0].missing);
  await assert.rejects(setFlag(store, 'mine', 'deleted', true));
});

test('studio API: reads, guarded writes, version preview, host check', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-api-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify({ ...example, theme: 'bento' }));
  mkdirSync(join(dir, 'themes'));
  writeFileSync(join(dir, 'themes', 'mine.js'), `export const meta = { name: 'mine', description: 'first' };\nexport function render(p, h) { return { css: '', body: '<h1>FIRST ' + h.esc(p.name) + '</h1>' }; }\n`);
  const port = 5400 + Math.floor(Math.random() * 400);
  const srv = await serve({ config: join(dir, 'folio.json'), port });
  const base = `http://127.0.0.1:${port}`;
  const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Folio': '1', ...headers }, body: JSON.stringify(body) });
  try {
    const lib = await (await fetch(base + '/api/library')).json();
    assert.equal(lib.designs[0].id, 'mine');
    assert.equal(lib.current, 'bento');
    assert.ok(lib.builtins.some((b) => b.id === 'blueprint'));
    writeFileSync(join(dir, 'themes', 'mine.js'), `export const meta = { name: 'mine', description: 'second' };\nexport function render(p, h) { return { css: '', body: '<h1>SECOND</h1>' }; }\n`);
    const d = await (await fetch(base + '/api/designs/mine')).json();
    assert.equal(d.versions.length, 2);
    assert.match(await (await fetch(base + '/preview/mine?v=1')).text(), /FIRST Maya/);
    assert.match(await (await fetch(base + '/preview/mine')).text(), /SECOND/);
    assert.equal((await post('/api/designs/mine/flag', { flag: 'favorite', value: true }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await fetch(base + '/api/designs/mine/flag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await post('/api/designs/mine/flag', { flag: 'favorite', value: true })).status, 200);
    assert.equal((await post('/api/designs/mine/restore', { n: 1 })).status, 200);
    assert.match(readFileSync(join(dir, 'themes', 'mine.js'), 'utf8'), /FIRST/);
    assert.equal((await post('/api/site/theme', { id: 'mine' })).status, 200);
    assert.equal(JSON.parse(readFileSync(join(dir, 'folio.json'), 'utf8')).theme, 'mine');
    assert.equal((await post('/api/site/theme', { id: '../../etc' })).status, 400);
    assert.equal((await fetch(base + '/api/designs/..%2F..%2Fx')).status, 400);
    const studio = await (await fetch(base + '/studio')).text();
    assert.match(studio, /Folio Studio/);
    // fetch() won't send a forged Host header, so use a raw request like a rebinding attack would.
    const rebound = await new Promise((ok, fail) => {
      const r = httpRequest({ host: '127.0.0.1', port, path: '/api/library', headers: { Host: 'evil.example' } }, (res) => { res.resume(); ok(res.statusCode); });
      r.on('error', fail);
      r.end();
    });
    assert.equal(rebound, 403, 'DNS-rebinding guard');
  } finally {
    srv.close();
  }
});

// ---- jobs -------------------------------------------------------------------------------------
import { createJob, listJobs, claimNext, cancelJob } from '../src/jobs.js';

test('jobs: parallel claims never collide, finished designs are detected, cancel archives', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-jobs-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  const store = openStore(dir);
  const job = await createJob(store, dir, normalize(example), { count: 3, seed: 4, cli: 'folio' });
  assert.equal(job.progress.waiting, 3);
  const [a, b, c] = await Promise.all([claimNext(store, dir, 'a'), claimNext(store, dir, 'b'), claimNext(store, dir, 'c')]);
  assert.equal(new Set([a.theme, b.theme, c.theme]).size, 3, 'three parallel claims, three different designs');
  assert.equal(await claimNext(store, dir, 'd'), null, 'nothing left to claim while all are being worked on');
  assert.match(a.brief, /Design brief/);
  // Finish one design: drop the PENDING marker.
  const f = join(dir, 'themes', `${c.theme}.js`);
  writeFileSync(f, readFileSync(f, 'utf8').replace(/description: 'PENDING:[^']*'/, "description: 'done'"));
  let [j] = await listJobs(store, dir);
  assert.equal(j.progress.designed, 1);
  assert.equal(j.status, 'active');
  j = await cancelJob(store, dir, job.id);
  assert.equal(j.status, 'cancelled');
  const lib = await getLibrary(store);
  assert.equal(lib.designs.filter((d) => d.archived).length, 2, 'undesigned drafts archived, not deleted');
  assert.equal(await claimNext(store, dir), null, 'cancelled jobs hand out nothing');
});

test('jobs API validates input', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-jobsapi-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  const port = 5800 + Math.floor(Math.random() * 300);
  const srv = await serve({ config: join(dir, 'folio.json'), port });
  const post = (body) => fetch(`http://127.0.0.1:${port}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Folio': '1' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({ count: 99 })).status, 400);
    assert.equal((await post({ like: 'nope' })).status, 400);
    assert.equal((await post({ like: 'bento', keep: 'everything' })).status, 400);
    const ok = await post({ count: 2 });
    assert.equal(ok.status, 200);
    const j = await ok.json();
    assert.equal(j.progress.total, 2);
    assert.match(readFileSync(join(dir, '.folio', 'gen', '1', 'brief-1.md'), 'utf8'), /bin\/folio\.js" theme check/, 'briefs name a working CLI');
    const list = await (await fetch(`http://127.0.0.1:${port}/api/jobs`)).json();
    assert.equal(list.length, 1);
  } finally {
    srv.close();
  }
});

test('jobs: claims from separate processes never collide', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-jobs-proc-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  await createJob(openStore(dir), dir, normalize(example), { count: 4, seed: 6, cli: 'folio' });
  const bin = (await import('node:url')).fileURLToPath(new URL('../bin/folio.js', import.meta.url));
  const { execFile } = await import('node:child_process');
  const runOne = () => new Promise((ok, fail) => execFile(process.execPath, [bin, 'jobs', 'next', '--json', '--config', join(dir, 'folio.json')], (e, out) => (e ? fail(e) : ok(JSON.parse(out)))));
  const got = await Promise.all([runOne(), runOne(), runOne(), runOne()]);
  assert.equal(new Set(got.map((g) => g.theme)).size, 4, 'four processes, four different designs');
});

// ---- persona, references, sketches -------------------------------------------------------------
import { writePersona, readPersona, patchPersona, restorePersona, validatePersona } from '../src/persona.js';
import { addRefs, readRefs, setRefFlag, validateRefs } from '../src/references.js';
import { renderSketch, validateSpec, autoSpecs, fingerprint, normalizeSpec, LAYOUTS } from '../src/sketch.js';
import { autoRound, agentRound, pick as pickSketch, tasteFrom, listRounds } from '../src/explore.js';

const PERSONA = {
  headline: 'Makes slow things fast',
  lede: 'A builder.',
  traits: [{ key: 'mood', value: 'Energized, warm', quote: 'I like making slow things fast', source: 'resume' }],
  dials: { energy: 8, warmth: 7, techDepth: 7, playfulness: 6, formality: 3 },
  worlds: ['developer tools', 'transit'],
  answers: { feel: ['Energized'], show: [], taste: ['Light & airy', 'Colorful & bold'] },
};

test('persona: validated, versioned, patchable, restorable', async () => {
  const store = openStore(mkdtempSync(join(tmpdir(), 'folio-persona-')));
  assert.ok(validatePersona({}).length >= 2);
  assert.ok(validatePersona({ ...PERSONA, dials: { energy: 11 } }).some((e) => e.startsWith('dials.energy')));
  assert.ok(validatePersona({ ...PERSONA, answers: { feel: ['Grumpy'] } }).some((e) => e.startsWith('answers.feel')));
  await writePersona(store, PERSONA, 'agent read');
  await patchPersona(store, { dials: { warmth: 9 } });
  let p = await readPersona(store);
  assert.equal(p.n, 2);
  assert.equal(p.dials.warmth, 9);
  assert.equal(p.dials.energy, 8, 'other dials kept');
  await restorePersona(store, 1);
  p = await readPersona(store);
  assert.equal(p.n, 3);
  assert.equal(p.dials.warmth, 7);
  assert.equal(p.versions.length, 3);
});

test('references: principles + credit only, never copies; flags survive updates', async () => {
  const store = openStore(mkdtempSync(join(tmpdir(), 'folio-refs-')));
  const ok = { title: 'Transit maps', kind: 'web', url: 'https://example.com/map', world: 'transit', principles: ['thick colored lines'], specimen: { colors: ['#da251d'] } };
  assert.ok(validateRefs([{ ...ok, image: 'data:...' }]).some((e) => e.includes("don't store images")));
  assert.ok(validateRefs([{ ...ok, url: 'javascript:alert(1)' }]).some((e) => e.includes('.url')));
  assert.ok(validateRefs([{ ...ok, principles: [] }]).some((e) => e.includes('principles')));
  await addRefs(store, [ok]);
  await setRefFlag(store, 'transit-maps', 'pinned', true);
  await addRefs(store, [{ ...ok, principles: ['thick colored lines', 'round stations'] }]);
  const refs = await readRefs(store);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].pinned, true);
  assert.equal(refs[0].principles.length, 2);
});

test('sketches: render safely, every layout works, auto rounds never repeat, taste moves toward likes', async () => {
  const profile = normalize({ ...example, name: 'Maya <img src=x onerror=alert(1)>' });
  for (const layout of LAYOUTS) {
    const spec = { title: 'T', layout, motif: 'dots', palette: { bg: '#ffffff', ink: '#111111', accent: '#2f3fe0' }, fonts: { display: layout === 'terminal' ? 'JetBrains Mono' : 'Fraunces', text: 'Figtree' } };
    assert.deepEqual(validateSpec(spec), [], layout);
    const html = renderSketch(spec, profile);
    assert.ok(!html.includes('<img src=x'), `${layout}: name escaped`);
    assert.match(html, /quickdiff|StudyBuddy/, `${layout}: shows real projects`);
  }
  assert.ok(validateSpec({ title: 'x', layout: 'statement', palette: { bg: 'red;}', ink: '#000000', accent: '#000000' }, fonts: { display: 'Fraunces', text: 'Figtree' } }).some((e) => e.includes('palette.bg')));
  assert.ok(validateSpec({ title: 'x', layout: 'statement', palette: { bg: '#ffffff', ink: '#000000', accent: '#000000' }, fonts: { display: "x');}", text: 'Figtree' } }).some((e) => e.includes('fonts.display')));
  assert.ok(validateSpec({ title: 'x', layout: 'statement', palette: { bg: '#ffffff', ink: '#000000', accent: '#000000' }, fonts: { display: 'Inter', text: 'Figtree' } }).some((e) => e.includes('generic')));

  // Someone who wants light and said to avoid dark gets mostly light sketches (wildcards may still be dark).
  const lightFan = { ...PERSONA, avoid: ['all-dark monochrome'] };
  const lit = autoSpecs({ persona: lightFan, count: 12, seed: 11 });
  assert.ok(lit.filter((x) => !x.wild && x.tags.includes('dark')).length <= 1, 'non-wildcard sketches respect "avoid dark"');
  const specs = autoSpecs({ persona: PERSONA, count: 12, seed: 3 });
  assert.equal(specs.length, 12);
  assert.equal(new Set(specs.slice(0, 8).map((s) => s.layout)).size, 8, 'the first 8 sketches use all 8 layouts');
  assert.ok(specs.some((s) => s.wild), 'includes wildcards');
  for (const s of specs) assert.deepEqual(validateSpec(s), []);

  const store = openStore(mkdtempSync(join(tmpdir(), 'folio-explore-')));
  const r1 = await autoRound(store, { persona: PERSONA, count: 12, seed: 5 });
  const r2 = await autoRound(store, { persona: PERSONA, count: 12, seed: 5 });
  const fp = (r) => r.specs.map((s) => fingerprint(s));
  assert.equal(new Set([...fp(r1), ...fp(r2)]).size, 24, 'no sketch repeats across rounds, even with the same seed');
  // Like every light sketch, skip every dark one: taste must lean light.
  for (const s of r1.specs) await pickSketch(store, s.id, s.tags.includes('light') ? 'like' : 'skip');
  const taste = await tasteFrom(store);
  assert.ok((taste.light || 0) > 0 && (taste.dark || 0) < 0);
  await assert.rejects(agentRound(store, [{ title: 'bad', layout: 'nope' }]));
  const ar = await agentRound(store, [{ title: 'Agent idea', layout: 'poster', motif: 'shapes', palette: { bg: '#f4f1ea', ink: '#111111', accent: '#e2361f' }, fonts: { display: 'Jost', text: 'Jost' } }]);
  assert.equal(ar.specs[0].source, 'agent');
  assert.equal((await listRounds(store)).length, 3);
});

test('studio API: persona answers before a read, sketches round + build job', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-front-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  const port = 6100 + Math.floor(Math.random() * 300);
  const srv = await serve({ config: join(dir, 'folio.json'), port });
  const base = `http://127.0.0.1:${port}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Folio': '1' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/api/persona', { answers: { taste: ['Light & airy', 'Nope'] } })).status, 200);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, '.folio', 'answers.json'), 'utf8')).taste, ['Light & airy']);
    const job = await (await post('/api/persona/read', {})).json();
    assert.equal(job.kind, 'persona');
    assert.match(readFileSync(join(dir, '.folio', 'jobs', `${job.id}-brief.md`), 'utf8'), /Light & airy/, 'the agent gets their answers');
    const round = await (await post('/api/sketches', { count: 8 })).json();
    assert.equal(round.specs.length, 8);
    assert.match(await (await fetch(`${base}/sketch/${round.specs[0].id}`)).text(), /Maya(<br>| )Okafor/);
    assert.equal((await fetch(`${base}/sketch/..%2Fx`)).status, 404);
    assert.equal((await post(`/api/sketches/${round.specs[0].id}/pick`, { value: 'like' })).status, 200);
    const built = await (await post('/api/sketches/build', { ids: [round.specs[0].id] })).json();
    assert.equal(built.kind, 'from-sketches');
    assert.match(readFileSync(join(dir, '.folio', 'gen', String(built.run), 'brief-1.md'), 'utf8'), /liked this one/);
    assert.equal((await post('/api/sketches', { count: 99 })).status, 400);
  } finally {
    srv.close();
  }
});

// ---- compare/mix + publish -------------------------------------------------------------------
import { designTraits } from '../src/traits.js';
import { publishCheck } from '../src/publish.js';

test('traits come from what a design renders', async () => {
  const { html } = await renderHtml(example, { theme: 'blueprint' });
  const t = designTraits(html);
  assert.ok(t.fonts.includes('IBM Plex Mono'));
  assert.ok(t.colors.length >= 3 && t.colors.every((c) => /^#[0-9a-f]{6}$/.test(c)));
});

test('mix job copies the layout design and briefs the other parts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-mix-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  const port = 6500 + Math.floor(Math.random() * 300);
  const srv = await serve({ config: join(dir, 'folio.json'), port });
  const post = (path, body) => fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Folio': '1' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/api/jobs', { mix: { layout: 'bento', colors: 'nope', type: 'editorial', signature: 'terminal' } })).status, 400);
    const j = await (await post('/api/jobs', { mix: { layout: 'bento', colors: 'blueprint', type: 'editorial', signature: 'terminal' } })).json();
    assert.equal(j.kind, 'mix');
    const theme = readFileSync(join(dir, 'themes', `${j.items[0].theme}.js`), 'utf8');
    assert.match(theme, /Bento-grid|bento/i, 'starts as a copy of the layout design');
    const brief = readFileSync(join(dir, '.folio', 'gen', String(j.run), 'brief-1.md'), 'utf8');
    assert.match(brief, /Colours from `blueprint`/);
    assert.match(brief, /Typography from `editorial`.*Instrument Sans|Typography from `editorial`.*Fraunces/s);
    const tr = await (await fetch(`http://127.0.0.1:${port}/api/designs/bento/traits`)).json();
    assert.ok(tr.fonts.length);
  } finally {
    srv.close();
  }
});

test('publish: checklist flags personal details, needs confirmation, can just build files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-pub-'));
  const cfg = join(dir, 'folio.json');
  writeFileSync(cfg, JSON.stringify(example));
  let c = await publishCheck({ configPath: cfg, base: dir });
  assert.ok(!c.items.some((i) => i.level === 'error'), `clean profile has no errors: ${JSON.stringify(c.items)}`);
  assert.ok(c.items.some((i) => /email .* public/i.test(i.text)));
  assert.equal(c.canPublish, false, 'no GitHub remote yet');
  writeFileSync(cfg, JSON.stringify({ ...example, about: 'Call me on +49 1525 784 5837. I live at 12 Main Street.' }));
  c = await publishCheck({ configPath: cfg, base: dir });
  assert.ok(c.items.some((i) => i.level === 'error' && /phone/.test(i.text)));
  assert.ok(c.items.some((i) => i.level === 'error' && /street address/.test(i.text)));
  writeFileSync(cfg, JSON.stringify(example));
  const port = 6800 + Math.floor(Math.random() * 300);
  const srv = await serve({ config: cfg, port });
  const post = (body) => fetch(`http://127.0.0.1:${port}/api/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Folio': '1' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({ host: 'github-pages' })).status, 400, 'needs confirm');
    const r = await (await post({ host: 'files' })).json();
    assert.ok(existsSync(join(r.outDir, 'index.html')));
  } finally {
    srv.close();
  }
});

test('mcp server speaks JSON-RPC over stdio and reports tool errors as results', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-mcp-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  const { spawn } = await import('node:child_process');
  const bin = (await import('node:url')).fileURLToPath(new URL('../bin/folio.js', import.meta.url));
  const child = spawn(process.execPath, [bin, 'mcp', '--config', join(dir, 'folio.json')]);
  const lines = [];
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const msgs = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'folio_generate', arguments: { count: 2 } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'folio_jobs_next', arguments: {} } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'folio_persona_write', arguments: { persona: { headline: '' } } } },
    { jsonrpc: '2.0', id: 6, method: 'nope' },
  ];
  for (const m of msgs) child.stdin.write(`${JSON.stringify(m)}\n`);
  child.stdin.end();
  await new Promise((r) => child.on('close', r));
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  assert.equal(byId[1].result.serverInfo.name, 'folio');
  assert.ok(byId[2].result.tools.length >= 10);
  assert.match(byId[3].result.content[0].text, /2 designs waiting/);
  assert.match(byId[4].result.content[0].text, /"theme": "g1-1-/);
  assert.equal(byId[5].result.isError, true, 'invalid persona is a readable tool error');
  assert.equal(byId[6].error.code, -32601);
  assert.equal(lines.length, 6, 'no reply to the notification, nothing else on stdout');
});

test('content: Studio edits validate, keep the design, version, restore; uploads become a content job', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-content-'));
  const cfg = join(dir, 'folio.json');
  writeFileSync(cfg, JSON.stringify({ ...example, theme: 'terminal' }));
  const port = 7100 + Math.floor(Math.random() * 300);
  const srv = await serve({ config: cfg, port });
  const u = `http://127.0.0.1:${port}`;
  const post = (path, body) => fetch(u + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Folio': '1' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/api/content', { content: { ...example, name: '' } })).status, 400, 'invalid content refused');
    const r = await (await post('/api/content', { content: { ...example, headline: 'New headline', theme: 'bento' } })).json();
    assert.equal(r.version, 2, 'v1 is the snapshot before the first edit');
    const saved = JSON.parse(readFileSync(cfg, 'utf8'));
    assert.equal(saved.headline, 'New headline');
    assert.equal(saved.theme, 'terminal', 'content edits never change the design');
    await post('/api/content/restore', { n: 1 });
    assert.equal(JSON.parse(readFileSync(cfg, 'utf8')).headline, example.headline);
    const got = await (await fetch(u + '/api/content')).json();
    assert.equal(got.versions[0].note, 'restored v1');

    const up = (headers) => fetch(u + '/api/content/upload?name=My%20CV.pdf', { method: 'POST', headers, body: Buffer.from('%PDF-1.4 fake') });
    assert.equal((await up({ 'Content-Type': 'application/pdf' })).status, 403, 'needs X-Folio');
    assert.equal((await up({ 'Content-Type': 'image/png', 'X-Folio': '1' })).status, 400, 'only resume-like files');
    const f = await (await up({ 'Content-Type': 'application/pdf', 'X-Folio': '1' })).json();
    assert.equal(f.path, '.folio/inputs/my-cv.pdf');
    assert.equal(readFileSync(join(dir, f.path), 'utf8'), '%PDF-1.4 fake');
    assert.equal((await post('/api/content/read', { files: ['../../etc/passwd'] })).status, 400);
    const j = await (await post('/api/content/read', { files: [f.path] })).json();
    assert.equal(j.kind, 'content');
    const next = await claimNext(openStore(dir), dir, 't');
    assert.match(next.brief, /my-cv\.pdf/);
    assert.match(next.brief, /Never invent facts/);
  } finally {
    srv.close();
  }
});

// ---- API-key runner (fake model, no network) ----------------------------------------------------
import { runJobs, screenThemeSource, extractBlock } from '../src/runner.js';
import { themeSource } from '../src/themes.js';

test('runner screens generated theme code', () => {
  const ok = "export const meta = { name: 'x', description: 'd' };\nexport function render(p, h) { return { css: '', body: h.esc(p.name) }; }";
  assert.deepEqual(screenThemeSource(ok), []);
  for (const bad of ["import fs from 'fs';", 'process.exit()', "globalThis.x", "h.esc.constructor.constructor('x')()", "fetch('https://x')", '<script src="https://x.js">', "require('fs')"]) {
    assert.ok(screenThemeSource(ok + '\n' + bad).length, bad);
  }
  assert.equal(extractBlock('hi\n```js\nshort\n```\n```js\nthe longer one\n```', 'js'), 'the longer one');
});

test('runner builds designs and a persona with a model, feeding errors back', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-run-'));
  const cfg = join(dir, 'folio.json');
  writeFileSync(cfg, JSON.stringify(example));
  const store = openStore(dir);
  const job = await createJob(store, dir, normalize(example), { count: 1, cli: 'folio' });
  const name = job.items[0].theme;
  const good = (await themeSource('editorial', name, dir)).replace(/description: '[^']*'/, "description: 'Editorial test design'");
  const calls = [];
  const replies = [
    '```js\n' + good.replace('export function render', 'const leak = process.env;\nexport function render') + '\n```',
    '```js\n' + good + '\n```\nDone.',
  ];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, key: init.headers['x-api-key'], body });
    const text = body.system.startsWith('You work inside folio')
      ? '```json\n' + JSON.stringify({ headline: 'Makes slow things fast', traits: [{ key: 'voice', value: 'plain', quote: 'confusing things obvious', source: 'resume' }], dials: { energy: 6 } }) + '\n```'
      : replies.shift();
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200 });
  };
  const { createPersonaJob } = await import('../src/jobs.js');
  await createPersonaJob(store, dir, { cli: 'folio' });
  const logs = [];
  const r = await runJobs({ store, base: dir, configPath: cfg, apiKey: 'sk-test', parallel: 1, fetchImpl, log: (m) => logs.push(m) });
  assert.equal(r.failed, 0, logs.join('\n'));
  assert.equal(r.designed, 2);
  assert.ok(calls.every((c) => c.url === 'https://api.anthropic.com/v1/messages' && c.key === 'sk-test'));
  const designCalls = calls.filter((c) => !c.body.system.startsWith('You work inside folio'));
  assert.equal(designCalls.length, 2, 'one retry after the screened reply');
  assert.match(designCalls[1].body.messages.at(-1).content, /process/);
  assert.match(readFileSync(join(dir, 'themes', `${name}.js`), 'utf8'), /Editorial test design/);
  assert.equal((await listJobs(store, dir)).find((j) => j.id === job.id).progress.designed, 1);
  assert.equal((await readPersona(store)).headline, 'Makes slow things fast');
  await assert.rejects(runJobs({ store, base: dir, configPath: cfg, apiKey: '' }), /ANTHROPIC_API_KEY/);
});

// ---- identity kit ----------------------------------------------------------------------------
import { makeKit } from '../src/kit.js';
import { findChrome } from '../src/shot.js';

test('kit og.png becomes the link preview only when the site url is known', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-og-'));
  mkdirSync(join(dir, 'folio-kit'));
  writeFileSync(join(dir, 'folio-kit', 'og.png'), 'png');
  writeFileSync(join(dir, 'folio.json'), JSON.stringify({ ...example, url: 'https://maya.dev/site' }));
  let r = await build({ config: join(dir, 'folio.json'), out: join(dir, 'dist') });
  let html = readFileSync(join(r.outDir, 'index.html'), 'utf8');
  assert.match(html, /og:image" content="https:\/\/maya\.dev\/site\/og\.png"/);
  assert.match(html, /summary_large_image/);
  assert.ok(existsSync(join(r.outDir, 'og.png')));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  r = await build({ config: join(dir, 'folio.json'), out: join(dir, 'dist') });
  html = readFileSync(join(r.outDir, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /og\.png|summary_large_image/);
});

test('kit renders banners, post and résumé from the live design', { skip: !findChrome() && 'no Chrome' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-kit-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify({ ...example, theme: 'blueprint', name: 'Maya <b>Okafor</b>' }));
  const r = await makeKit({ config: join(dir, 'folio.json') });
  assert.deepEqual(r.files, ['og.png', 'linkedin-banner.png', 'x-header.png', 'post.png', 'resume.pdf']);
  assert.match(r.tokens.display, /IBM Plex/);
  const [cr, cg, cb] = r.tokens.accent.match(/\d+/g).map(Number);
  assert.ok(Math.max(cr, cg, cb) - Math.min(cr, cg, cb) > 60, `accent is a real colour, not ink: ${r.tokens.accent}`);
  assert.equal(readFileSync(join(r.outDir, 'resume.pdf')).subarray(0, 4).toString(), '%PDF');
  const banner = readFileSync(join(dir, '.folio', 'kit', 'linkedin-banner.html'), 'utf8');
  assert.match(banner, /Maya &lt;b&gt;Okafor&lt;\/b&gt;/, 'names are escaped');
  const png = readFileSync(join(r.outDir, 'linkedin-banner.png'));
  assert.equal(png.readUInt32BE(16), 1584);
  assert.equal(png.readUInt32BE(20), 396);
});

// ---- benchmark ---------------------------------------------------------------------------------
import { distance, summarize, runBench } from '../src/bench.js';

test('bench distance: identical is 0, near-duplicates are counted', () => {
  const map = Array.from({ length: 320 }, (_, i) => (i % 2 ? 1 : 0.9));
  const a = { name: 'a', font: 'Inter', bg: 0.9, accentHue: 220, map, errors: 0, contrast: 7 };
  assert.equal(distance(a, { ...a }), 0);
  const far = { name: 'c', font: 'VT323', bg: 0.05, accentHue: 40, map: map.map((v, i) => (i % 2 ? 0 : 0.05)), errors: 0, contrast: 7 };
  assert.ok(distance(a, far) > 0.8);
  const s = summarize([a, { ...a, name: 'b' }, far]);
  assert.equal(s.nearDuplicates, 1);
  assert.deepEqual(s.closestPair, ['a', 'b']);
  assert.equal(s.fonts, 2);
});

test('bench A/B runs both arms in a throwaway project and writes a report', { skip: !findChrome() && 'no Chrome' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'folio-bench-'));
  writeFileSync(join(dir, 'folio.json'), JSON.stringify(example));
  const sources = ['bento', 'terminal', 'blueprint'];
  let k = 0;
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const plain = body.system.startsWith('Write a personal portfolio');
    const from = plain ? 'editorial' : sources[k++ % sources.length];
    const name = plain ? 'x' : body.messages[0].content.match(/themes\/(g\d+-\d+-[a-z-]+)\.js/)[1];
    const src = (await themeSource(from, name, dir)).replace(/description: '[^']*'/, `description: 'from ${from}'`);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '```js\n' + src + '\n```' }] }), { status: 200 });
  };
  const r = await runBench({ config: join(dir, 'folio.json'), apiKey: 'sk-test', n: 3, fetchImpl, log: () => {} });
  assert.equal(r.summary.plain.designs, 3);
  assert.equal(r.summary.plain.nearDuplicates, 3, 'three copies of the same design');
  assert.equal(r.summary.folio.nearDuplicates, 0);
  assert.ok(r.summary.folio.meanDistance > r.summary.plain.meanDistance);
  assert.match(readFileSync(join(r.outDir, 'REPORT.md'), 'utf8'), /\| Near-duplicate pairs \| 3 \| 0 \|/);
  assert.ok(!existsSync(join(dir, 'themes')), "the person's project is untouched");
});
