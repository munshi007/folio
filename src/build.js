import { readFile, writeFile, mkdir, copyFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join, relative, isAbsolute } from 'node:path';
import { validate, normalize } from './schema.js';
import { loadTheme, renderWith } from './themes.js';
import { FolioError } from './errors.js';

export { FolioError };

export async function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    throw new FolioError(`No ${configPath} found. Run \`folio init\` first.`);
  }
  let raw;
  try {
    raw = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (e) {
    throw new FolioError(`${configPath} is not valid JSON: ${e.message}`);
  }
  return raw;
}

// Local images (avatar, project screenshots) referenced by relative path get copied into the output.
function localAssets(p) {
  const paths = [p.avatar, ...p.projects.map((x) => x.image)].filter(Boolean);
  return [...new Set(paths.filter((u) => !/^[a-z][a-z0-9+.-]*:/i.test(u) && !u.startsWith('//')))];
}

export async function renderHtml(raw, { theme, baseDir = process.cwd(), pure = false } = {}) {
  const { errors, warnings } = validate(raw);
  if (errors.length) throw new FolioError(`folio.json has problems:\n  - ${errors.join('\n  - ')}`);
  const p = normalize(raw);
  if (theme) p.theme = theme;
  // pure: show the theme exactly as designed (gallery, design reviews), ignoring the user's mode/font overrides.
  if (pure) p.style = { ...p.style, mode: 'auto', font: 'theme' };
  const t = await loadTheme(p.theme, baseDir);
  return { html: renderWith(t, p), profile: p, warnings };
}

// The output folder is wiped on every build, so only ever wipe one folio created.
async function assertSafeOutDir(outDir, base) {
  const rel = relative(outDir, base);
  if (outDir === base || !rel.startsWith('..')) {
    throw new FolioError(`Output folder ${outDir} contains your project. Pick a dedicated folder like "dist".`);
  }
  if (!existsSync(outDir)) return;
  const entries = await readdir(outDir);
  if (!entries.length) return;
  const index = join(outDir, 'index.html');
  const ours = existsSync(index) && (await readFile(index, 'utf8')).includes('<meta name="generator" content="folio">');
  if (!ours) {
    throw new FolioError(`${outDir} already has files folio didn't create. Refusing to overwrite it — pick another --out folder.`);
  }
}

export async function build({ config = 'folio.json', out = 'dist', theme, pure = false } = {}) {
  const configPath = resolve(config);
  const outDir = resolve(out);
  const raw = await loadConfig(configPath);
  const { html, profile, warnings } = await renderHtml(raw, { theme, baseDir: dirname(configPath), pure });

  await assertSafeOutDir(outDir, dirname(configPath));
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), html);
  await writeFile(join(outDir, '.nojekyll'), '');

  const base = dirname(configPath);
  const missing = [];
  for (const asset of localAssets(profile)) {
    const clean = asset.replace(/^\.?\//, '').split(/[?#]/)[0];
    const src = resolve(base, clean);
    const dest = resolve(outDir, clean);
    // Never read or write outside the project / output folders.
    const rel = relative(outDir, dest);
    if (rel.startsWith('..') || isAbsolute(rel) || relative(base, src).startsWith('..')) {
      missing.push(`${asset} (outside project folder, skipped)`);
      continue;
    }
    if (!existsSync(src)) {
      missing.push(asset);
      continue;
    }
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
  }
  if (missing.length) warnings.push(...missing.map((m) => `image not found: ${m}`));

  return { outDir, profile, warnings, bytes: Buffer.byteLength(html) };
}
