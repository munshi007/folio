// Theme resolution: built-in themes ship with folio; local themes live in <project>/themes/*.js.
//
// Theme contract (annotated example: themes/_starter.js):
//   export const meta = { name, description }
//   export function render(profile, h) { return { css, body, fonts?, script?, bg?, bgDark? } }
// `h` is the helpers object from util.js (esc, attrUrl, inline, md, dateRange, icon, ...).

import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { themes as builtins } from '../themes/index.js';
import { helpers } from './util.js';
import { page } from './page.js';
import { FolioError } from './errors.js';

export class ThemeError extends FolioError {}

function isPathLike(name) {
  return name.startsWith('.') || name.startsWith('/') || name.endsWith('.js');
}

export function localThemePath(name, baseDir) {
  if (isPathLike(name)) return resolve(baseDir, name);
  return join(baseDir, 'themes', `${name}.js`);
}

async function importFresh(file) {
  // Bust the ESM cache with the mtime so `folio dev` picks up theme edits without restarting.
  const { mtimeMs } = await stat(file);
  return import(`${pathToFileURL(file).href}?v=${mtimeMs}`);
}

export async function loadTheme(name, baseDir = process.cwd()) {
  if (!isPathLike(name) && builtins[name]) return builtins[name];

  const file = localThemePath(name, baseDir);
  const rel = relative(baseDir, file);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new ThemeError(`Theme "${name}" is outside the project folder.`);
  if (!existsSync(file)) {
    const names = (await listThemes(baseDir)).map((t) => t.name).join(', ');
    throw new ThemeError(`Unknown theme "${name}". Available: ${names}`);
  }
  const mod = await importFresh(file);
  if (typeof mod.render !== 'function') throw new ThemeError(`${rel} doesn't export a render(profile, h) function.`);
  return { meta: { name: basename(file, '.js'), description: '', ...mod.meta }, render: mod.render };
}

export async function listThemes(baseDir = process.cwd()) {
  const list = Object.values(builtins).map((t) => ({ name: t.meta.name, description: t.meta.description, source: 'built-in' }));
  const dir = join(baseDir, 'themes');
  if (existsSync(dir)) {
    for (const f of (await readdir(dir)).filter((f) => f.endsWith('.js') && !f.startsWith('_')).sort()) {
      const name = basename(f, '.js');
      if (builtins[name] || name === 'index') continue; // built-ins win; a local file with the same name is ignored
      list.push({ name, description: '', source: 'local', path: join(dir, f) });
    }
  }
  return list;
}

export function renderWith(theme, profile) {
  const out = theme.render(profile, helpers);
  if (!out || typeof out.body !== 'string') {
    throw new ThemeError(`Theme "${theme.meta.name}" render() must return { css, body, ... } with body as a string.`);
  }
  return page(profile, { css: '', ...out });
}

// Standalone source for a copy of theme `from` named `name`: the starter, a built-in, or a local theme.
// Built-ins import helpers from the package; a local copy gets the same helpers from render()'s second
// argument instead, bound at module level so helper functions outside render() see them too.
export async function themeSource(from, name, baseDir = process.cwd()) {
  const helperNames = Object.keys(helpers).join(', ');
  const rename = (src) => src.replace(/name: '[^']+'/, `name: '${name}'`);
  if (from === '_starter') {
    return (await readFile(new URL('../themes/_starter.js', import.meta.url), 'utf8')).replace("name: '__NAME__'", `name: '${name}'`);
  }
  if (!isPathLike(from) && builtins[from]) {
    const src = await readFile(new URL(`../themes/${from}.js`, import.meta.url), 'utf8');
    if (!/export function render\(p\) \{/.test(src)) return rename(src); // already uses render(p, h)
    return rename(
      src
        .replace(/^import \{[^}]+\} from '\.\.\/src\/util\.js';\n/m, `// Helpers arrive as render()'s second argument (see themes/_starter.js for the list).\nlet ${helperNames};\n`)
        .replace(/export function render\(p\) \{/, `export function render(p, h) {\n  ({ ${helperNames} } = h);`),
    );
  }
  const file = localThemePath(from, baseDir);
  if (!existsSync(file)) throw new ThemeError(`Unknown theme "${from}".`);
  return rename(await readFile(file, 'utf8'));
}
