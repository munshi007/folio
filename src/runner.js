// The runner: does folio's jobs with the person's own Anthropic API key, no coding agent needed.
// It claims work exactly like an agent would (`claimNext`), so a runner and agents can share a queue.
//
//   design   → the model writes the whole theme file; folio screens it, checks it, and sends the errors back
//              for up to two fixes
//   persona  → JSON persona card, validated by writePersona (errors sent back once)
//   sketches → JSON sketch specs, validated by agentRound
//   content  → reads an uploaded PDF / text resume into folio.json (never invents facts)
//
// The key is read from the environment and only ever sent to api.anthropic.com. It is never written to disk.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { claimNext } from './jobs.js';
import { loadTheme } from './themes.js';
import { checkTheme } from './themecheck.js';
import { isPendingSource } from './generate.js';
import { writePersona } from './persona.js';
import { agentRound } from './explore.js';
import { writeContent } from './content.js';
import { FolioError } from './errors.js';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
const API = 'https://api.anthropic.com/v1/messages';
const SKILLS = new URL('../skills/folio/', import.meta.url);

export class RunnerError extends FolioError {}

// ---- Model calls -------------------------------------------------------------------------------

export async function callModel({ apiKey, model = DEFAULT_MODEL, system, messages, maxTokens = 24000, fetchImpl = fetch, log = () => {} }) {
  if (!apiKey) throw new RunnerError('Set ANTHROPIC_API_KEY to run jobs without an agent.');
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * 2 ** attempt;
      log(`  model busy (${res.status}), retrying in ${Math.round(wait / 1000)}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      throw new RunnerError(res.status === 401 ? 'The API key was rejected (401). Check ANTHROPIC_API_KEY.' : `Model call failed: ${msg}`);
    }
    const text = (body.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (body.stop_reason === 'max_tokens') log('  (the reply hit the length limit; it may be cut off)');
    return text;
  }
}

export function extractBlock(text, lang) {
  const re = new RegExp('```' + lang + '\\s*\\n([\\s\\S]*?)\\n```', 'g');
  const blocks = [...text.matchAll(re)].map((m) => m[1]);
  if (!blocks.length) throw new RunnerError(`the reply had no \`\`\`${lang} block`);
  return blocks.sort((a, b) => b.length - a.length)[0];
}

// ---- Safety gate for generated theme code ------------------------------------------------------
// A theme's render() only needs its arguments and plain JS. Generated code that reaches for modules,
// the process, the network or code-from-strings is refused before it's ever written or imported.

const FORBIDDEN = [
  [/\bimport\b/, 'import'],
  [/\brequire\s*\(/, 'require()'],
  [/\bprocess\b/, 'process'],
  [/\bglobalThis\b/, 'globalThis'],
  [/\beval\s*\(/, 'eval()'],
  [/\bFunction\s*\(/, 'Function()'],
  [/\bconstructor\b/, 'constructor'],
  [/__proto__/, '__proto__'],
  [/\bchild_process\b|\bnode:/, 'Node modules'],
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/, 'network calls'],
  [/<script[^>]*\bsrc\s*=/i, 'external scripts'],
];

export function screenThemeSource(src) {
  const problems = FORBIDDEN.filter(([re]) => re.test(src)).map(([, what]) => what);
  if (!/export\s+function\s+render\s*\(\s*p\s*,\s*h\s*\)/.test(src)) problems.push('missing `export function render(p, h)`');
  if (!/export\s+const\s+meta\s*=/.test(src)) problems.push('missing `export const meta`');
  return problems;
}

// ---- Prompts -----------------------------------------------------------------------------------

async function skill(name) {
  return readFile(new URL(name, SKILLS), 'utf8');
}

const DESIGN_SYSTEM = (guide) => `You are a top web designer and front-end engineer building one person's portfolio theme for folio.

A folio theme is one JavaScript ES module:
  export const meta = { name, description }
  export function render(p, h) { return { css, body, fonts?, script?, bg?, bgDark? } }
\`p\` is the person's normalized profile, \`h\` is the helper kit (h.esc, h.attrUrl, h.inline, h.md, h.dateRange, h.fmtDate, h.icon, h.linkKind, h.hostOf, h.initials, h.ordered). The theme must use only its two arguments and plain JavaScript: no import, require, process, globalThis, eval, Function, constructor, network calls or external scripts (folio refuses files that use them).

The designer's guide:

${guide}

Reply with the complete theme file in ONE \`\`\`js block, then one sentence on the result. Nothing else.`;

// ---- Work per kind -----------------------------------------------------------------------------

async function designItem(ctx, task) {
  const { store, base, log } = ctx;
  const current = await store.themes.readText(`${task.theme}.js`);
  const profile = await readFile(ctx.configPath, 'utf8');
  const system = DESIGN_SYSTEM(await skill('DESIGN.md'));
  const messages = [{ role: 'user', content: `${task.brief}\n\n---\n\nThe person's folio.json:\n\`\`\`json\n${profile}\n\`\`\`\n\nThe current file \`themes/${task.theme}.js\` (rewrite it completely; keep meta.name = '${task.theme}' and replace the PENDING description):\n\`\`\`js\n${current}\n\`\`\`\n\nYou can't run the commands in the brief: folio runs the checks for you and will send back any errors.` }];

  for (let round = 1; round <= 3; round++) {
    const reply = await callModel({ ...ctx, system, messages });
    messages.push({ role: 'assistant', content: reply });
    let problems;
    let src;
    try {
      src = extractBlock(reply, 'js');
      problems = screenThemeSource(src);
      if (isPendingSource(src)) problems.push('meta.description still starts with PENDING: write a real one-line description');
    } catch (e) {
      problems = [e.message];
    }
    if (!problems.length) {
      await store.themes.writeText(`${task.theme}.js`, `${src.trim()}\n`);
      try {
        const { errors, warnings } = checkTheme(await loadTheme(task.theme, base));
        problems = errors;
        if (!errors.length) {
          log(`  ✓ ${task.theme} designed${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}`);
          return { ok: true };
        }
      } catch (e) {
        problems = [e.message];
      }
    }
    log(`  ${task.theme}: round ${round} has ${problems.length} problem(s): ${problems[0]}`);
    if (round < 3) messages.push({ role: 'user', content: `folio found these problems:\n${problems.map((p) => `- ${p}`).join('\n')}\n\nFix them and reply with the complete file again in one \`\`\`js block.` });
    else return { ok: false, error: problems.join('; ') };
  }
}

async function jsonItem(ctx, { brief, extra = '', content = null, save }) {
  const system = 'You work inside folio, a portfolio generator. Do exactly what the brief asks. You cannot run commands: instead of saving with the CLI, reply with the JSON in ONE ```json block, then one sentence. Never invent facts about the person.';
  const first = content ? [...content, { type: 'text', text: `${brief}${extra}` }] : `${brief}${extra}`;
  const messages = [{ role: 'user', content: first }];
  for (let round = 1; round <= 2; round++) {
    const reply = await callModel({ ...ctx, system, messages });
    messages.push({ role: 'assistant', content: reply });
    try {
      return await save(JSON.parse(extractBlock(reply, 'json')));
    } catch (e) {
      if (round === 2) throw e;
      ctx.log(`  retrying: ${e.message}`);
      messages.push({ role: 'user', content: `That didn't save: ${e.message}\nFix it and reply with the JSON again in one \`\`\`json block.` });
    }
  }
}

async function personaItem(ctx, task) {
  const profile = await readFile(ctx.configPath, 'utf8');
  const answers = await ctx.store.data.readJSON('answers.json', null);
  const p = await jsonItem(ctx, {
    brief: task.brief,
    extra: `\n\nThe person's folio.json:\n\`\`\`json\n${profile}\n\`\`\`${answers ? `\nTheir answers to the taste questions: ${JSON.stringify(answers)}` : ''}\n\n${await skill('PERSONA.md')}`,
    save: (json) => writePersona(ctx.store, json, 'read by the runner'),
  });
  ctx.log(`  ✓ persona v${p.n}: ${p.headline}`);
}

async function sketchesItem(ctx, task) {
  const persona = await ctx.store.data.readJSON('persona.json', null);
  const r = await jsonItem(ctx, {
    brief: task.brief,
    extra: persona ? `\n\nTheir persona:\n\`\`\`json\n${JSON.stringify(persona, null, 2)}\n\`\`\`` : '',
    save: (json) => agentRound(ctx.store, Array.isArray(json) ? json : json.specs),
  });
  ctx.log(`  ✓ sketch round ${r.round}: ${r.specs.length} sketches`);
}

async function contentItem(ctx, task) {
  const files = [...task.brief.matchAll(/`(\.folio\/inputs\/[a-z0-9-]+\.(pdf|txt|md|docx|zip))`/g)].map((m) => m[1]);
  const content = [];
  for (const f of files) {
    const ext = f.split('.').pop();
    const buf = await readFile(join(ctx.base, f));
    if (ext === 'pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } });
    else if (ext === 'txt' || ext === 'md') content.push({ type: 'text', text: `${f}:\n\n${buf.toString('utf8')}` });
    else throw new RunnerError(`${f}: the runner reads PDF and text files; ask your coding agent to read .${ext} files`);
  }
  const cur = await readFile(ctx.configPath, 'utf8');
  const example = await readFile(new URL('../examples/folio.example.json', import.meta.url), 'utf8');
  const saved = await jsonItem(ctx, {
    brief: task.brief,
    content,
    extra: `\n\nThe current folio.json:\n\`\`\`json\n${cur}\n\`\`\`\nThe shape to follow (an example person, not them):\n\`\`\`json\n${example}\n\`\`\`\n\nReply with the complete new folio.json.`,
    save: (json) => writeContent(ctx.store, ctx.configPath, json, 'read from your upload by the runner'),
  });
  ctx.log(`  ✓ content saved as v${saved.version}${saved.warnings.length ? ` (${saved.warnings.length} suggestions)` : ''}`);
}

// ---- The loop ----------------------------------------------------------------------------------

// Claims and does jobs until the queue is empty (or `max` items), `parallel` at a time.
export async function runJobs({ store, base, configPath, apiKey, model = DEFAULT_MODEL, max = Infinity, parallel = 2, log = console.log, fetchImpl = fetch, signal } = {}) {
  if (!apiKey) throw new RunnerError('Set ANTHROPIC_API_KEY to run jobs without an agent.');
  const ctx = { store, base, configPath, apiKey, model, log, fetchImpl };
  const done = { designed: 0, failed: 0, errors: [] };
  let claimed = 0;
  const worker = async (n) => {
    while (claimed < max && !signal?.aborted) {
      const task = await claimNext(store, base, `runner-${n}`);
      if (!task) return;
      claimed++;
      log(`→ ${task.kind}${task.theme ? ` ${task.theme}` : ''}`);
      try {
        if (task.kind === 'design') {
          const r = await designItem(ctx, task);
          if (!r.ok) throw new RunnerError(r.error);
        } else if (task.kind === 'persona') await personaItem(ctx, task);
        else if (task.kind === 'sketches') await sketchesItem(ctx, task);
        else if (task.kind === 'content') await contentItem(ctx, task);
        done.designed++;
      } catch (e) {
        done.failed++;
        done.errors.push(`${task.theme || task.kind}: ${e.message}`);
        log(`  ✗ ${task.theme || task.kind}: ${e.message}`);
        if (e instanceof RunnerError && /API key|ANTHROPIC_API_KEY/.test(e.message)) return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, 6)) }, (_, i) => worker(i + 1)));
  return done;
}
