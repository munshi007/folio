import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
