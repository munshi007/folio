// folio as an MCP server (stdio): the same actions Studio and the CLI have, as tools any MCP client can call
// (Claude, Cursor, Codex, ChatGPT, VS Code…). Messages are newline-delimited JSON-RPC 2.0 on stdin/stdout;
// anything else must go to stderr, or it corrupts the protocol stream.

import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { loadConfig } from './build.js';
import { validate, normalize } from './schema.js';
import { openStore } from './store.js';
import { getLibrary } from './library.js';
import { readPersona, writePersona } from './persona.js';
import { addRefs, readRefs } from './references.js';
import { autoRound, agentRound } from './explore.js';
import { createJob, listJobs, claimNext } from './jobs.js';
import { loadTheme, listThemes } from './themes.js';
import { checkTheme } from './themecheck.js';
import { applyStyleChange, serve } from './serve.js';
import { writeFile } from 'node:fs/promises';
import { themes as builtins } from '../themes/index.js';

const PROTOCOL = '2025-06-18';
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const CLI = `node "${fileURLToPath(new URL('../bin/folio.js', import.meta.url))}"`;

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

const TOOLS = [
  { name: 'folio_open_studio', description: 'Start Folio Studio for this project (if not running) and return its URL. Give the URL to the user: their Library, persona, sketches and publish screen.', inputSchema: obj({ port: { type: 'integer', minimum: 1024, maximum: 65535 } }) },
  { name: 'folio_content', description: "Read the person's folio.json (their content) and any problems with it.", inputSchema: obj({}) },
  { name: 'folio_library', description: 'List every design: id, title, versions, whether it is the current site, pending/designed, archived.', inputSchema: obj({}) },
  { name: 'folio_persona_get', description: 'Read the persona card (how folio reads the person) and any one-line corrections they made.', inputSchema: obj({}) },
  { name: 'folio_persona_write', description: 'Save a persona card (validated; every save is a version). Quotes must be the person\'s real words. See skills/folio/PERSONA.md for the shape.', inputSchema: obj({ persona: { type: 'object' }, note: { type: 'string' } }, ['persona']) },
  { name: 'folio_references_add', description: 'Add references from the person\'s worlds: principles + credit link only (never images or copied text). Sources must be open archives, official APIs, or web pages read within the site\'s rules.', inputSchema: obj({ references: { type: 'array', items: { type: 'object' } } }, ['references']) },
  { name: 'folio_sketch_auto', description: 'Make an instant round of first-screen sketches from the persona and learned taste (no design work needed). The person likes/skips them in Studio → Explore.', inputSchema: obj({ count: { type: 'integer', minimum: 4, maximum: 24 } }) },
  { name: 'folio_sketch_add', description: 'Add a round of sketch specs you invented (validated). Aim for range: include low-probability directions.', inputSchema: obj({ specs: { type: 'array', items: { type: 'object' } } }, ['specs']) },
  { name: 'folio_generate', description: 'Start a generation job: N different design directions, or "more like" an existing design (keep: vibe|colors|type|layout|signature). Then claim designs with folio_jobs_next.', inputSchema: obj({ count: { type: 'integer', minimum: 1, maximum: 12 }, like: { type: 'string' }, keep: { type: 'string', enum: ['vibe', 'colors', 'type', 'layout', 'signature'] } }) },
  { name: 'folio_jobs_list', description: 'Progress of every job (designed / working / waiting / failed).', inputSchema: obj({}) },
  { name: 'folio_jobs_next', description: 'Claim the next waiting piece of work (a design to build, a persona to (re)read, or sketches to invent). Returns the brief and which file to edit. Claims last 20 minutes and never collide, so parallel agents are safe.', inputSchema: obj({ worker: { type: 'string' } }) },
  { name: 'folio_theme_check', description: 'Run safety and quality checks on a design (escaping, links, phones, dark mode, focus, hardcoded wording). 0 errors required before a design counts as done.', inputSchema: obj({ name: { type: 'string' } }, ['name']) },
  { name: 'folio_use_design', description: 'Make a design the person\'s site (as designed). Only do this when they ask.', inputSchema: obj({ id: { type: 'string' } }, ['id']) },
];

export async function runMcp({ config = 'folio.json' } = {}) {
  const configPath = resolve(config);
  const base = dirname(configPath);
  const store = openStore(base);
  let studio = null;

  const text = (t) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });

  async function call(name, args = {}) {
    switch (name) {
      case 'folio_open_studio': {
        if (!studio) {
          const port = args.port || 4321;
          studio = await serve({ config: configPath, port });
        }
        return text(`Folio Studio is running: ${studio.url}/studio (the person's site preview: ${studio.url})`);
      }
      case 'folio_content': {
        const raw = await loadConfig(configPath);
        return text({ folio: raw, ...validate(raw) });
      }
      case 'folio_library': {
        const raw = await loadConfig(configPath);
        const lib = await getLibrary(store, { current: raw.theme ?? null, builtins: Object.keys(builtins) });
        return text(lib.designs.map((d) => ({ id: d.id, title: d.label || d.direction || d.id, versions: d.versions, current: d.current, pending: d.pending, archived: d.archived, run: d.run, description: d.description })));
      }
      case 'folio_persona_get':
        return text((await readPersona(store)) ?? 'No persona yet. Read the person and save one with folio_persona_write.');
      case 'folio_persona_write': {
        const p = await writePersona(store, args.persona, args.note || 'agent read');
        return text(`Saved persona v${p.n}: ${p.headline}. Ask the person to look at Studio → Persona and correct anything in a line.`);
      }
      case 'folio_references_add':
        return text(`Reference board now has ${(await addRefs(store, args.references)).length} references.`);
      case 'folio_sketch_auto': {
        const raw = await loadConfig(configPath);
        const r = await autoRound(store, { persona: await store.data.readJSON('persona.json', null), headline: normalize(raw).headline, count: args.count || 12 });
        return text(`Sketch round ${r.round}: ${r.specs.length} sketches. The person picks in Studio → Explore.`);
      }
      case 'folio_sketch_add': {
        const r = await agentRound(store, args.specs);
        return text(`Sketch round ${r.round}: ${r.specs.length} sketches added.`);
      }
      case 'folio_generate': {
        const raw = await loadConfig(configPath);
        const { errors } = validate(raw);
        if (errors.length) throw new Error(`fix folio.json first: ${errors.join('; ')}`);
        if (args.like && !(await listThemes(base)).some((t) => t.name === args.like)) throw new Error(`unknown design ${args.like}`);
        const j = await createJob(store, base, normalize(raw), { count: args.count, like: args.like ?? null, keep: args.keep || 'vibe', cli: CLI });
        return text(`Job ${j.id} (round ${j.run}): ${j.progress.total} designs waiting. Claim them with folio_jobs_next (parallel agents are safe).`);
      }
      case 'folio_jobs_list':
        return text((await listJobs(store, base)).map((j) => ({ id: j.id, kind: j.kind, status: j.status, run: j.run, progress: j.progress })));
      case 'folio_jobs_next':
        return text((await claimNext(store, base, args.worker || 'mcp')) ?? 'Nothing waiting: every job is designed, being worked on, or cancelled.');
      case 'folio_theme_check':
        return text(checkTheme(await loadTheme(args.name, base)));
      case 'folio_use_design': {
        const names = (await listThemes(base)).map((t) => t.name);
        const next = applyStyleChange(await loadConfig(configPath), 'adopt', args.id, names);
        await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`);
        return text(`The site now uses ${args.id}.`);
      }
      default:
        throw Object.assign(new Error(`unknown tool ${name}`), { code: -32602 });
    }
  }

  const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
      continue;
    }
    const { id, method, params } = msg;
    if (id === undefined) continue; // notifications (e.g. notifications/initialized) need no reply
    try {
      if (method === 'initialize') {
        send({ jsonrpc: '2.0', id, result: { protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'folio', version: pkg.version },
          instructions: 'folio turns a resume + GitHub into several genuinely different portfolio sites. Start with folio_open_studio and give the person the link. Read skills/folio/SKILL.md for the full workflow.' } });
      } else if (method === 'ping') {
        send({ jsonrpc: '2.0', id, result: {} });
      } else if (method === 'tools/list') {
        send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      } else if (method === 'tools/call') {
        try {
          send({ jsonrpc: '2.0', id, result: await call(params?.name, params?.arguments || {}) });
        } catch (e) {
          if (e.code === -32602) throw e;
          // Tool failures are results the model can read and fix, not protocol errors.
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true } });
        }
      } else {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
      }
    } catch (e) {
      send({ jsonrpc: '2.0', id, error: { code: e.code || -32603, message: e.message } });
    }
  }
  if (studio) studio.close();
}
