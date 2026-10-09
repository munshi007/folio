#!/usr/bin/env node
// Checked before anything else loads: older Node fails later with confusing errors (no global WebSocket).
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 4)) {
  console.error(`folio needs Node.js 22.4 or newer (you have ${process.versions.node}). Get it from https://nodejs.org`);
  process.exit(1);
}
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
import { listThemes, loadTheme, themeSource } from '../src/themes.js';
import { checkTheme } from '../src/themecheck.js';
import { shoot } from '../src/shot.js';
import { createRun, readRun, latestRun, isPending } from '../src/generate.js';
import { normalize } from '../src/schema.js';
import { unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { openStore } from '../src/store.js';
import { recordPublish } from '../src/library.js';
import { createJob, listJobs, claimNext, cancelJob, validJobId } from '../src/jobs.js';
import { readPersona, writePersona } from '../src/persona.js';
import { readRefs, addRefs } from '../src/references.js';
import { agentRound, autoRound, getSpec } from '../src/explore.js';
import { renderSketch } from '../src/sketch.js';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const c = process.stdout.isTTY && !process.env.NO_COLOR
  ? { b: (s) => `\x1b[1m${s}\x1b[22m`, dim: (s) => `\x1b[2m${s}\x1b[22m`, g: (s) => `\x1b[32m${s}\x1b[39m`, y: (s) => `\x1b[33m${s}\x1b[39m`, r: (s) => `\x1b[31m${s}\x1b[39m`, m: (s) => `\x1b[35m${s}\x1b[39m` }
  : { b: String, dim: String, g: String, y: String, r: String, m: String };

const HELP = `
${c.m('✦ folio')} ${c.dim(`v${pkg.version}`)} — six designers, one you: resume + GitHub → portfolio sites to pick from

${c.b('Usage')}
  folio init [--github <user>] [--theme <name>]   create folio.json (optionally from GitHub)
  folio github <user> [--limit 6]                 pull profile + top repos into folio.json
  folio studio [--port 4321]                      open Folio Studio: every design, version and round
  folio dev [--port 4321] [--theme <name>]        same server, without opening the browser
  folio build [--out dist] [--theme <name>]       render static site
  folio deploy [--yes]                            build + publish to GitHub Pages (gh-pages branch)
  folio validate                                  check folio.json
  folio themes                                    list built-in + your local themes

${c.b('Generate designs')}
  folio generate [--count 6] [--seed <n>]         brief N different designers; your agent designs them
  folio generate --like <theme> [--keep vibe]     siblings of a design you liked: keep vibe|colors|type|layout|signature,
                                                  change two big things each [--count 3]
  folio jobs [next [--json] | cancel <id>]        generation progress; agents claim the next design to make
  folio run [--model m] [--parallel n] [--max n]  do waiting jobs with your ANTHROPIC_API_KEY (no agent needed)
  folio kit [--theme t] [--out dir]               identity kit: link preview, LinkedIn/X banners, post, résumé PDF
  folio bench [--n 6] | --measure a,b,c           folio vs a plain prompt (API key), or measure how different designs are
  folio pick <theme> [--as <name>]                keep a design (optionally rename it), set it in folio.json
  ${c.dim('watch them land live: folio dev → http://localhost:4321/__folio/gallery')}

${c.b('Persona, references, sketches')} ${c.dim('(agents write these; you see and correct them in Studio)')}
  folio persona [write <file.json>] [--json]       how folio reads you; every version kept
  folio refs [add <file.json>]                    reference board: principles from your worlds, with credit
  folio sketch auto [--count 12]                  instant first-screen sketches from your persona + taste
  folio sketch add <file.json> | show <id>        add agent-invented sketch specs; print one as HTML

${c.b('Design your own theme')}
  folio theme new <name> [--from <theme>]         scaffold themes/<name>.js (from the starter or a built-in)
  folio theme check <name>                        safety + quality checks (escaping, mobile, dark mode, a11y, fonts)
  folio shot [--theme <name>] [--out folio-shots] full-page + per-screen shots: desktop + phone, light + dark
            [--device desktop|mobile] [--scheme light|dark] [--pure]   (--pure ignores your style overrides)

${c.b('For AI apps')}
  folio mcp                                       run as an MCP server (stdio) for Claude, Cursor, Codex, VS Code…

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
  // First run of `folio studio` in an empty folder: start a blank folio.json and open the Content screen,
  // where GitHub import and resume upload fill it in.
  let start = '/studio';
  if (args.open && !existsSync(config)) {
    await writeConfig(config, TEMPLATE);
    console.log(`${c.g('✓')} created ${relative(process.cwd(), config) || config} ${c.dim('· fill it in from Studio: import GitHub or upload your resume')}`);
    start = '/studio?view=content';
  }
  const { url } = await serve({ config, port, theme: args.theme });
  console.log(`${c.m('✦ folio')} studio at ${c.b(`${url}/studio`)}  ·  your site at ${c.b(url)}\n  ${c.dim('every design, version and round is in Studio · edits reload live · ctrl+c to stop')}`);
  if (args.open) {
    // Best effort: open Studio in the default browser.
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    execFile(opener, [`${url}${start}`], () => {});
  }
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
  const raw = await loadConfig(config);
  await recordPublish(openStore(dirname(config)), { design: raw.theme, host: 'github-pages', url });
  console.log(`${c.g('✓')} pushed to gh-pages ${c.dim('(recorded in Studio → publish history)')}`);
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
    const src = await themeSource(from, name, base);
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
  const like = typeof args.like === 'string' ? args.like : null;
  if (args.like === true) throw new FolioError('Usage: folio generate --like <theme> [--count 3]');
  const count = Math.min(Math.max(Number(args.count) || (like ? 3 : 6), 1), 12);
  const seed = args.seed != null ? Number(args.seed) : undefined;
  // Briefs tell each designer which command to run; use the exact folio that's running now.
  const cli = `node "${process.argv[1]}"`;
  const keep = typeof args.keep === 'string' ? args.keep : 'vibe';
  const base = dirname(config);
  const job = await createJob(openStore(base), base, normalize(raw), { count, seed, cli, like, keep });
  console.log(`${c.g('✓')} job ${c.b(job.id)} · round ${c.b(`#${job.run}`)}: ${job.files.length} ${like ? `variations of ${c.m(like)}, keeping its ${keep}` : 'briefs'} ${c.dim(`(seed ${job.seed}; same seed = same briefs)`)}\n`);
  for (const f of job.files) console.log(`  ${c.m(f.name.padEnd(24))} ${f.direction}  ${c.dim(relative(process.cwd(), f.brief))}`);
  console.log(`\n  Each theme file renders already (${like ? `as a copy of ${like}` : 'as the plain starter'}) and is marked PENDING until designed.`);
  if (args.run) return cmdRun(args, config);
  console.log(`  ${c.b('Agent:')} claim and design them with ${c.b('folio jobs next')} (in parallel if you can), following skills/folio/GENERATE.md.`);
  console.log(`  ${c.b('No agent?')} ${c.b('folio run')} builds them with your ANTHROPIC_API_KEY.`);
  console.log(`  ${c.b('You:')} ${c.b('folio studio')}. Progress and designs appear live.`);
}

// Read a JSON file an agent wrote (or "-" for stdin).
async function readJSONArg(file) {
  if (!file) throw new FolioError('expected a JSON file path (or - for stdin)');
  let text;
  if (file === '-') {
    text = '';
    for await (const chunk of process.stdin) text += chunk;
  } else {
    text = await readFile(resolve(file), 'utf8');
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FolioError(`${file} is not valid JSON: ${e.message}`);
  }
}

async function cmdPersona(args, config) {
  const store = openStore(dirname(config));
  const sub = args._[1];
  if (sub === 'write') {
    const p = await writePersona(store, await readJSONArg(args._[2]), typeof args.note === 'string' ? args.note : 'agent read');
    return console.log(`${c.g('✓')} persona v${p.n} saved: ${c.b(p.headline)} ${c.dim('(shown in Studio → Persona; every version kept)')}`);
  }
  const p = await readPersona(store);
  if (!p) return console.log(c.dim('  no persona yet · an agent writes one with folio persona write <file.json>'));
  if (args.json) return console.log(JSON.stringify(p, null, 2));
  console.log(`  ${c.b(p.headline)} ${c.dim(`v${p.n}`)}\n  ${p.lede}`);
  for (const t of p.traits) console.log(`  ${c.m(t.key.padEnd(10))} ${t.value}`);
  console.log(`  ${c.dim('dials')}      ${Object.entries(p.dials).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  if (p.corrections?.length) console.log(`  ${c.y('corrections')} ${p.corrections.map((x) => `"${x.text}"`).join(', ')}`);
}

async function cmdRefs(args, config) {
  const store = openStore(dirname(config));
  if (args._[1] === 'add') {
    const all = await addRefs(store, await readJSONArg(args._[2]));
    return console.log(`${c.g('✓')} ${all.length} reference(s) on the board ${c.dim('(principles + credit only; see Studio → Persona)')}`);
  }
  const refs = await readRefs(store);
  if (!refs.length) return console.log(c.dim('  no references yet · an agent adds them with folio refs add <file.json>'));
  for (const r of refs) console.log(`  ${r.pinned ? c.y('★') : ' '} ${c.b(r.id.padEnd(24))} ${r.world.padEnd(18)} ${r.hidden ? c.dim('(hidden) ') : ''}${r.principles[0] ?? ''}`);
}

async function cmdSketch(args, config) {
  const base = dirname(config);
  const store = openStore(base);
  const sub = args._[1];
  if (sub === 'add') {
    const r = await agentRound(store, await readJSONArg(args._[2]));
    return console.log(`${c.g('✓')} sketch round ${r.round}: ${r.specs.length} sketches ${c.dim('(Studio → Explore shows them now)')}`);
  }
  if (sub === 'auto') {
    const raw = await loadConfig(config);
    const r = await autoRound(store, { persona: await store.data.readJSON('persona.json', null), headline: normalize(raw).headline, count: Number(args.count) || 12 });
    return console.log(`${c.g('✓')} sketch round ${r.round}: ${r.specs.length} sketches from your persona and taste`);
  }
  if (sub === 'show') {
    const spec = await getSpec(store, args._[2]);
    if (!spec) throw new FolioError(`No sketch ${args._[2]}`);
    return console.log(renderSketch(spec, normalize(await loadConfig(config))));
  }
  throw new FolioError('Usage: folio sketch add <file.json> | folio sketch auto [--count 12] | folio sketch show <id>');
}

async function cmdRun(args, config) {
  const { runJobs, DEFAULT_MODEL } = await import('../src/runner.js');
  const base = dirname(config);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new FolioError('Set ANTHROPIC_API_KEY first (export ANTHROPIC_API_KEY=sk-ant-…). It is only sent to api.anthropic.com and never saved.');
  const model = typeof args.model === 'string' ? args.model : process.env.FOLIO_MODEL || DEFAULT_MODEL;
  console.log(`  ${c.b('folio run')} · ${model} · doing waiting jobs (Ctrl+C stops; claimed work is picked up again later)`);
  const r = await runJobs({ store: openStore(base), base, configPath: config, apiKey, model, max: Number(args.max) || Infinity, parallel: Number(args.parallel) || 2, log: (m) => console.log(`  ${m}`) });
  if (!r.designed && !r.failed) return console.log(c.dim('  nothing waiting · start a round with folio generate or from Studio'));
  console.log(`\n  ${c.g(`${r.designed} done`)}${r.failed ? c.r(` · ${r.failed} failed`) : ''} · see them in ${c.b('folio studio')}`);
  if (r.failed) process.exitCode = 1;
}

async function cmdJobs(args, config) {
  const base = dirname(config);
  const store = openStore(base);
  const sub = args._[1];
  if (!sub || sub === 'list') {
    const jobs = await listJobs(store, base);
    if (!jobs.length) return console.log(c.dim('  no jobs yet · start one with folio generate or from Studio'));
    for (const j of jobs) {
      const p = j.progress;
      console.log(`  ${c.b(j.id)} ${j.kind.padEnd(10)} round ${String(j.run).padEnd(3)} ${j.status.padEnd(9)} ${c.g(`${p.designed} designed`)} · ${p.working} working · ${p.waiting} waiting${p.failed ? c.r(` · ${p.failed} failed`) : ''}`);
    }
    return;
  }
  if (sub === 'next') {
    const next = await claimNext(store, base, typeof args.worker === 'string' ? args.worker : 'agent');
    if (args.json) return console.log(JSON.stringify(next));
    if (!next) return console.log(`${c.g('✓')} nothing waiting · every job is designed, working or cancelled`);
    console.log(`${c.g('✓')} claimed ${c.m(next.theme)} from job ${next.job} ${c.dim('(yours for 20 minutes)')}`);
    console.log(`  edit:  ${next.themePath}\n  brief: ${next.briefPath}\n`);
    console.log(next.brief);
    return;
  }
  if (sub === 'cancel') {
    const id = args._[2];
    if (!validJobId(id)) throw new FolioError('Usage: folio jobs cancel <job-id>');
    const j = await cancelJob(store, base, id);
    return console.log(`${c.g('✓')} cancelled ${id} · ${j.progress.designed} designed kept, undesigned drafts archived (restorable in Studio)`);
  }
  throw new FolioError('Usage: folio jobs [list] | folio jobs next [--json] | folio jobs cancel <job-id>');
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
    case 'studio':
      return cmdDev({ ...args, open: true }, config);
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
    case 'jobs':
      return cmdJobs(args, config);
    case 'run':
      return cmdRun(args, config);
    case 'bench': {
      const bench = await import('../src/bench.js');
      if (typeof args.measure === 'string') {
        const names = args.measure.split(',').map((x) => x.trim()).filter(Boolean);
        const designs = await bench.measureDesigns(config, names);
        const s = bench.summarize(designs);
        if (args.json) return console.log(JSON.stringify({ designs, summary: s }, null, 2));
        for (const d of designs) console.log(`  ${c.m(d.name.padEnd(24))} ${d.broken ? c.r(d.broken) : `${d.font.padEnd(22)} bg ${String(d.bg).padEnd(6)} hue ${String(d.accentHue ?? '–').padEnd(4)} ${d.errors ? c.r(`${d.errors} errors`) : c.g('checks ok')}${d.sideways ? c.r(' · phone scrolls sideways') : ''}`}`);
        console.log(`\n  difference: avg ${c.b(s.meanDistance)} · closest pair ${c.b(s.minDistance)} (${(s.closestPair || []).join(' ~ ')}) · ${s.fonts} fonts · ${s.nearDuplicates} near-duplicates`);
        return;
      }
      const { DEFAULT_MODEL } = await import('../src/runner.js');
      const r = await bench.runBench({ config, apiKey: process.env.ANTHROPIC_API_KEY, model: typeof args.model === 'string' ? args.model : process.env.FOLIO_MODEL || DEFAULT_MODEL, n: Math.min(12, Math.max(2, Number(args.n) || 6)), out: typeof args.out === 'string' ? args.out : undefined, log: (m) => console.log(`  ${m}`) });
      console.log(`\n${bench.report(r)}\n  Saved in ${r.outDir}`);
      return;
    }
    case 'kit': {
      const { makeKit } = await import('../src/kit.js');
      console.log(`  ${c.b('folio kit')} · your design on everything around your site`);
      const r = await makeKit({ config, out: typeof args.out === 'string' ? args.out : undefined, theme: typeof args.theme === 'string' ? args.theme : undefined, log: (f) => console.log(`  ${c.g('✓')} ${f}`) });
      const isDefault = r.outDir === join(dirname(config), 'folio-kit');
      console.log(`\n  Saved in ${c.b(isDefault ? relative(process.cwd(), r.outDir) || '.' : r.outDir)}.${isDefault ? c.dim(' folio build now uses og.png as your link preview (set "url" in folio.json).') : ''}`);
      return;
    }
    case 'persona':
      return cmdPersona(args, config);
    case 'mcp':
      return (await import('../src/mcp.js')).runMcp({ config });
    case 'refs':
    case 'references':
      return cmdRefs(args, config);
    case 'sketch':
    case 'sketches':
      return cmdSketch(args, config);
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
