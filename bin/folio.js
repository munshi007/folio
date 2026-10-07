#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { build, loadConfig, FolioError } from '../src/build.js';
import { validate } from '../src/schema.js';
import { fetchGitHub, mergeGitHub } from '../src/github.js';
import { serve } from '../src/serve.js';
import { deploy } from '../src/deploy.js';
import { themes } from '../themes/index.js';
import { listThemes, loadTheme } from '../src/themes.js';
import { checkTheme } from '../src/themecheck.js';
import { shoot } from '../src/shot.js';
import { createRun, readRun, latestRun, isPending } from '../src/generate.js';
import { normalize } from '../src/schema.js';
import { unlink } from 'node:fs/promises';

const HELPER_NAMES = 'esc, safeUrl, attrUrl, inline, md, fmtDate, dateRange, hostOf, initials, icon, linkKind';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const c = process.stdout.isTTY && !process.env.NO_COLOR
  ? { b: (s) => `\x1b[1m${s}\x1b[22m`, dim: (s) => `\x1b[2m${s}\x1b[22m`, g: (s) => `\x1b[32m${s}\x1b[39m`, y: (s) => `\x1b[33m${s}\x1b[39m`, r: (s) => `\x1b[31m${s}\x1b[39m`, m: (s) => `\x1b[35m${s}\x1b[39m` }
  : { b: String, dim: String, g: String, y: String, r: String, m: String };

const HELP = `
${c.m('✦ folio')} ${c.dim(`v${pkg.version}`)} — your resume + GitHub → a portfolio people remember

${c.b('Usage')}
  folio init [--github <user>] [--theme <name>]   create folio.json (optionally from GitHub)
  folio github <user> [--limit 6]                 pull profile + top repos into folio.json
  folio dev [--port 4321] [--theme <name>]        live preview with theme switcher
  folio build [--out dist] [--theme <name>]       render static site
  folio deploy [--yes]                            build + publish to GitHub Pages (gh-pages branch)
  folio validate                                  check folio.json
  folio themes                                    list built-in + your local themes

${c.b('Generate designs')}
  folio generate [--count 6] [--seed <n>]         brief N different designers; your agent designs them
  folio pick <theme> [--as <name>]                keep a design (optionally rename it), set it in folio.json
  ${c.dim('watch them land live: folio dev → http://localhost:4321/__folio/gallery')}

${c.b('Design your own theme')}
  folio theme new <name> [--from <theme>]         scaffold themes/<name>.js (from the starter or a built-in)
  folio theme check <name>                        safety + quality checks (escaping, mobile, dark mode, a11y, fonts)
  folio shot [--theme <name>] [--out folio-shots] full-page + per-screen shots: desktop + phone, light + dark
            [--device desktop|mobile] [--scheme light|dark] [--pure]   (--pure ignores your style overrides)

${c.b('Options')}
  --config <path>   folio.json location (default: ./folio.json)

${c.b('With an AI agent')}
  npx skills add munshi007/folio   then ask: "make my portfolio from resume.pdf"
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) args[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[k] = argv[++i];
      else args[k] = true;
    } else if (a === '-h') args.help = true;
    else if (a === '-v') args.version = true;
    else args._.push(a);
  }
  return args;
}

function printWarnings(warnings) {
  for (const w of warnings) console.log(`  ${c.y('!')} ${w}`);
}

async function writeConfig(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

const TEMPLATE = {
  theme: 'bento',
  name: 'Your Name',
  headline: 'What you build, in one line',
  location: '',
  status: '',
  about: '',
  links: [],
  projects: [],
  experience: [],
  education: [],
  skills: [],
};

async function cmdInit(args, config) {
  if (existsSync(config)) throw new FolioError(`${config} already exists. Edit it, or delete it to start over.`);
  if (args.theme && !themes[args.theme]) throw new FolioError(`Unknown theme "${args.theme}".`);
  let data = { ...TEMPLATE, theme: args.theme || TEMPLATE.theme };
  if (args.github) {
    data = { ...data, name: '', headline: '' };
    const gh = await fetchGitHub(args.github, { limit: Number(args.limit) || 6 });
    data = mergeGitHub(data, gh).config;
    console.log(`${c.g('✓')} pulled ${c.b(data.name)} + ${gh.projects.length} repos from GitHub`);
  }
  await writeConfig(config, data);
  console.log(`${c.g('✓')} created ${config}\n\n  next: ${c.b('folio dev')}  ${c.dim('→ live preview, edit folio.json and watch it update')}`);
}

async function cmdGitHub(args, config) {
  const user = args._[1] || args.user;
  if (!user) throw new FolioError('Usage: folio github <username>');
  const current = existsSync(config) ? await loadConfig(config) : { ...TEMPLATE, name: '', headline: '' };
  const gh = await fetchGitHub(user, { limit: Number(args.limit) || 6 });
  const { config: merged, added } = mergeGitHub(current, gh);
  await writeConfig(config, merged);
  console.log(`${c.g('✓')} merged GitHub profile for ${c.b(user)}`);
  console.log(added.length ? `  added projects: ${added.join(', ')}` : '  no new projects (existing ones kept as-is)');
}

async function cmdBuild(args, config) {
  const t0 = Date.now();
  const { outDir, profile, warnings, bytes } = await build({ config, out: args.out || 'dist', theme: args.theme });
  console.log(`${c.g('✓')} built ${c.b(profile.name)} with ${c.m(profile.theme)} → ${outDir} ${c.dim(`(${(bytes / 1024).toFixed(1)} KB, ${Date.now() - t0}ms)`)}`);
  printWarnings(warnings);
  return outDir;
}

async function cmdDev(args, config) {
  const port = Number(args.port) || 4321;
  const { url } = await serve({ config, port, theme: args.theme });
  console.log(`${c.m('✦ folio')} preview at ${c.b(url)}\n  ${c.dim('editing folio.json reloads the page · switch themes from the bar at the bottom · ctrl+c to stop')}`);
  if (existsSync(config)) printWarnings(validate(await loadConfig(config)).warnings);
}

async function cmdValidate(config) {
  const { errors, warnings } = validate(await loadConfig(config));
  if (errors.length) {
    for (const e of errors) console.log(`  ${c.r('✗')} ${e}`);
    process.exitCode = 1;
  }
  printWarnings(warnings);
  if (!errors.length) console.log(`${c.g('✓')} ${config} is valid${warnings.length ? ` ${c.dim(`(${warnings.length} suggestion${warnings.length > 1 ? 's' : ''})`)}` : ''}`);
}

async function confirm(question) {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function cmdDeploy(args, config) {
  const outDir = await cmdBuild(args, config);
  if (!args.yes) {
    const ok = await confirm(`\nPublish to the ${c.b('gh-pages')} branch of origin? This replaces whatever is on that branch. [y/N] `);
    if (!ok) {
      console.log(c.dim('cancelled (pass --yes to skip this prompt)'));
      return;
    }
  }
  const { url, pagesEnabled } = await deploy({ outDir });
  console.log(`${c.g('✓')} pushed to gh-pages`);
  if (url) {
    console.log(`  live in ~1 min at ${c.b(url)}`);
    if (!pagesEnabled) console.log(c.dim('  if it 404s: repo Settings → Pages → Source: "Deploy from a branch", branch gh-pages'));
  }
}

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

async function cmdTheme(args, config) {
  const sub = args._[1];
  const base = dirname(config);
  if (sub === 'new') {
    const name = args._[2];
    if (!name || !NAME_RE.test(name)) throw new FolioError('Usage: folio theme new <name>  (lowercase letters, digits, dashes)');
    if (themes[name]) throw new FolioError(`"${name}" is a built-in theme name. Pick another.`);
    const dest = join(base, 'themes', `${name}.js`);
    if (existsSync(dest)) throw new FolioError(`${relative(process.cwd(), dest)} already exists.`);
    const from = args.from || '_starter';
    if (from !== '_starter' && !themes[from]) throw new FolioError(`--from must be a built-in theme: ${Object.keys(themes).join(', ')}`);
    let src = await readFile(new URL(`../themes/${from}.js`, import.meta.url), 'utf8');
    if (from === '_starter') {
      src = src.replace("name: '__NAME__'", `name: '${name}'`);
    } else {
      // Built-ins import helpers from the package; a local copy gets the same helpers from render()'s second argument.
      // Module-level bindings so helper functions outside render() see them too.
      src = src
        .replace(/^import \{([^}]+)\} from '\.\.\/src\/util\.js';\n/m, `// Helpers arrive as render()'s second argument (see themes/_starter.js for the list).\nlet ${HELPER_NAMES};\n`)
        .replace(/export function render\(p\) \{/, `export function render(p, h) {\n  ({ ${HELPER_NAMES} } = h);`)
        .replace(/name: '[^']+'/, `name: '${name}'`);
    }
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, src);
    console.log(`${c.g('✓')} created ${relative(process.cwd(), dest)}${from !== '_starter' ? c.dim(` (copy of ${from})`) : ''}`);
    console.log(`  preview: ${c.b(`folio dev --theme ${name}`)}   check: ${c.b(`folio theme check ${name}`)}   screenshots: ${c.b(`folio shot --theme ${name}`)}`);
    return;
  }
  if (sub === 'check') {
    const name = args._[2] || (existsSync(config) ? (await loadConfig(config)).theme : null);
    if (!name) throw new FolioError('Usage: folio theme check <name>');
    const theme = await loadTheme(name, base);
    const { errors, warnings } = checkTheme(theme);
    for (const e of errors) console.log(`  ${c.r('✗')} ${e}`);
    for (const w of warnings) console.log(`  ${c.y('!')} ${w}`);
    if (errors.length) process.exitCode = 1;
    console.log(errors.length ? `${c.r('✗')} ${name}: ${errors.length} error(s)` : `${c.g('✓')} ${name} passes${warnings.length ? c.dim(` with ${warnings.length} suggestion(s)`) : ' cleanly'}`);
    return;
  }
  throw new FolioError('Usage: folio theme new <name> | folio theme check <name>');
}

async function cmdGenerate(args, config) {
  const raw = await loadConfig(config);
  const { errors } = validate(raw);
  if (errors.length) throw new FolioError(`Fix folio.json first:\n  - ${errors.join('\n  - ')}`);
  const count = Math.min(Math.max(Number(args.count) || 6, 1), 12);
  const seed = args.seed != null ? Number(args.seed) : undefined;
  // Briefs tell each designer which command to run; use the exact folio that's running now.
  const cli = `node "${process.argv[1]}"`;
  const { run, seed: used, files } = await createRun(dirname(config), normalize(raw), { count, seed, cli });
  console.log(`${c.g('✓')} run ${c.b(`#${run}`)}: ${files.length} briefs ${c.dim(`(seed ${used}; same seed = same briefs)`)}\n`);
  for (const f of files) console.log(`  ${c.m(f.name.padEnd(24))} ${f.direction}  ${c.dim(relative(process.cwd(), f.brief))}`);
  console.log(`\n  Each theme file renders already (as the plain starter) and is marked PENDING until designed.`);
  console.log(`  ${c.b('Agent:')} design each brief (in parallel if you can), following skills/folio/GENERATE.md.`);
  console.log(`  ${c.b('You:')} ${c.b('folio dev')} and open ${c.b('http://localhost:4321/__folio/gallery')}. Designs appear as they land.`);
}

async function cmdPick(args, config) {
  const base = dirname(config);
  const name = args._[1];
  if (!name) throw new FolioError('Usage: folio pick <theme> [--as <new-name>]');
  await loadTheme(name, base); // throws a clear error if it doesn't exist
  let final = name;
  if (args.as) {
    if (!NAME_RE.test(args.as) || themes[args.as]) throw new FolioError(`--as must be a new lowercase name (letters, digits, dashes), not a built-in.`);
    const from = join(base, 'themes', `${name}.js`);
    const to = join(base, 'themes', `${args.as}.js`);
    if (!existsSync(from)) throw new FolioError(`Only local themes can be renamed (${name} is built-in).`);
    if (existsSync(to)) throw new FolioError(`${relative(process.cwd(), to)} already exists.`);
    const src = (await readFile(from, 'utf8')).replace(/name: '[^']+'/, `name: '${args.as}'`);
    await writeFile(to, src);
    await unlink(from);
    final = args.as;
  }
  if (await isPending(join(base, 'themes', `${final}.js`)) && !themes[final]) {
    console.log(`  ${c.y('!')} ${final} hasn't been designed yet (still the starter).`);
  }
  const raw = await loadConfig(config);
  raw.theme = final;
  await writeFile(config, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`${c.g('✓')} folio.json now uses ${c.m(final)}${args.as ? c.dim(` (renamed from ${name})`) : ''}`);
}

async function cmdShot(args, config) {
  const t0 = Date.now();
  const { files, theme, errors = [] } = await shoot({
    config,
    theme: args.theme,
    out: args.out || 'folio-shots',
    devices: args.device ? [args.device] : undefined,
    schemes: args.scheme ? [args.scheme] : undefined,
    pure: Boolean(args.pure),
  });
  console.log(`${c.g('✓')} ${files.length} screenshot(s) of ${c.m(theme)} ${c.dim(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`)}`);
  for (const f of files) console.log(`  ${relative(process.cwd(), f.file)} ${c.dim(f.part ? `slice ${f.part}` : `${f.device} · ${f.scheme} · ${f.height}px${f.truncated ? ' · truncated' : ''}`)}`);
  for (const e of errors) console.log(`  ${c.r('✗ page script error:')} ${e}`);
  if (errors.length) process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const config = resolve(args.config || 'folio.json');

  if (args.version) return console.log(pkg.version);
  if (args.help || !cmd || cmd === 'help') return console.log(HELP);

  switch (cmd) {
    case 'init':
      return cmdInit(args, config);
    case 'github':
      return cmdGitHub(args, config);
    case 'build':
      return void (await cmdBuild(args, config));
    case 'dev':
    case 'preview':
      return cmdDev(args, config);
    case 'validate':
      return cmdValidate(config);
    case 'deploy':
      return cmdDeploy(args, config);
    case 'themes':
      for (const t of await listThemes(dirname(config))) {
        console.log(`  ${c.m(t.name.padEnd(12))} ${t.source === 'local' ? c.dim(`local · ${relative(process.cwd(), t.path)}`) : t.description}`);
      }
      return;
    case 'theme':
      return cmdTheme(args, config);
    case 'generate':
      return cmdGenerate(args, config);
    case 'pick':
      return cmdPick(args, config);
    case 'shot':
    case 'screenshot':
      return cmdShot(args, config);
    default:
      throw new FolioError(`Unknown command "${cmd}". Run folio --help.`);
  }
}

main().catch((e) => {
  if (e instanceof FolioError || e.code === 'EADDRINUSE' || /GitHub/.test(e.message)) {
    console.error(`${c.r('✗')} ${e.code === 'EADDRINUSE' ? 'Port in use — try --port 4322' : e.message}`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
