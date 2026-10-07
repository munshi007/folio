#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { build, loadConfig, FolioError } from '../src/build.js';
import { validate } from '../src/schema.js';
import { fetchGitHub, mergeGitHub } from '../src/github.js';
import { serve } from '../src/serve.js';
import { deploy } from '../src/deploy.js';
import { themes } from '../themes/index.js';

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
  folio themes                                    list themes

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
      for (const t of Object.values(themes)) console.log(`  ${c.m(t.meta.name.padEnd(10))} ${t.meta.description}`);
      return;
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
