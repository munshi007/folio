// Generation jobs. Studio (or the CLI) creates a job: a generation run whose designs need designing. Workers
// claim one design at a time, so several agents can work in parallel without colliding. Today the worker is
// your own agent (`folio jobs next`); an API-key worker can claim from the same queue later.
//
// Store layout (data namespace): jobs/<id>.json
//   { id, kind: 'generate'|'variations', status, createdAt, run, like, keep,
//     items: [ { theme, claimedAt, claimedBy } ] }
// Item state is derived, never trusted from the record alone:
//   designed  – the theme file no longer carries the PENDING marker and passes the checker
//   failed    – designed but the checker reports errors
//   working   – claimed less than CLAIM_TTL ago
//   waiting   – everything else
// A job is done when no item is waiting or working.

import { randomBytes } from 'node:crypto';
import { createRun, isPendingSource } from './generate.js';
import { loadTheme } from './themes.js';
import { checkTheme } from './themecheck.js';
import { setFlag, syncLibrary } from './library.js';
import { personaBrief } from './persona.js';
import { contentBrief } from './content.js';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

export const CLAIM_TTL_MS = 20 * 60 * 1000; // a claim older than this is assumed abandoned

const now = () => new Date().toISOString();
const JOB_ID_RE = /^j[0-9a-f]{10}$/;

export const validJobId = (id) => typeof id === 'string' && JOB_ID_RE.test(id);

async function readJob(store, id) {
  return validJobId(id) ? store.data.readJSON(`jobs/${id}.json`, null) : null;
}

async function writeJob(store, job) {
  await store.data.writeJSON(`jobs/${job.id}.json`, job);
}

async function itemState(store, base, item) {
  // A persona item is done once a newer persona version than the one it started from exists.
  // A content item is done once folio.json changed after the job started.
  if (item.kind === 'content') {
    try {
      if ((await stat(join(base, 'folio.json'))).mtimeMs > new Date(item.since).getTime()) return { state: 'designed' };
    } catch {}
    if (item.claimedAt && Date.now() - new Date(item.claimedAt).getTime() < CLAIM_TTL_MS) return { state: 'working' };
    return { state: 'waiting' };
  }
  // A sketches item is done once an agent-made sketch round newer than the job exists.
  if (item.kind === 'sketches') {
    for (const f of await store.data.list('sketches')) {
      const r = /^\d+\.json$/.test(f) ? await store.data.readJSON(`sketches/${f}`, null) : null;
      if (r && r.source === 'agent' && r.createdAt > item.since) return { state: 'designed' };
    }
    if (item.claimedAt && Date.now() - new Date(item.claimedAt).getTime() < CLAIM_TTL_MS) return { state: 'working' };
    return { state: 'waiting' };
  }
  if (item.kind === 'persona') {
    const cur = await store.data.readJSON('persona.json', null);
    if (cur && cur.n > (item.baseN ?? 0)) return { state: 'designed' };
    if (item.claimedAt && Date.now() - new Date(item.claimedAt).getTime() < CLAIM_TTL_MS) return { state: 'working' };
    return { state: 'waiting' };
  }
  const source = await store.themes.readText(`${item.theme}.js`);
  if (source != null && !isPendingSource(source)) {
    try {
      const { errors } = checkTheme(await loadTheme(item.theme, base));
      return errors.length ? { state: 'failed', errors } : { state: 'designed' };
    } catch (e) {
      return { state: 'failed', errors: [e.message] };
    }
  }
  if (item.claimedAt && Date.now() - new Date(item.claimedAt).getTime() < CLAIM_TTL_MS) return { state: 'working' };
  return { state: 'waiting' };
}

async function withProgress(store, base, job) {
  const items = [];
  for (const it of job.items) items.push({ ...it, ...(await itemState(store, base, it)) });
  const count = (s) => items.filter((i) => i.state === s).length;
  const progress = { designed: count('designed'), failed: count('failed'), working: count('working'), waiting: count('waiting'), total: items.length };
  let status = job.status;
  if (status === 'active' && !progress.waiting && !progress.working) status = 'done';
  return { ...job, status, items, progress };
}

export async function createJob(store, base, profile, { like = null, keep = 'vibe', count, cli, seed, sketches = null, mix = null }) {
  const persona = await store.data.readJSON('persona.json', null);
  const { run, files, seed: usedSeed } = await createRun(base, profile, { count: sketches ? sketches.length : count ?? (like ? 3 : 6), like, keep, cli, seed, sketches, persona, mix });
  const job = {
    id: `j${randomBytes(5).toString('hex')}`,
    kind: mix ? 'mix' : sketches ? 'from-sketches' : like ? 'variations' : 'generate',
    status: 'active',
    createdAt: now(),
    run,
    like,
    keep: like ? keep : null,
    items: files.map((f) => ({ theme: f.name, brief: `gen/${run}/brief-${f.name.split('-')[1]}.md`, claimedAt: null, claimedBy: null })),
  };
  await writeJob(store, job);
  await syncLibrary(store);
  return { ...(await withProgress(store, base, job)), seed: usedSeed, files };
}

export async function listJobs(store, base) {
  const jobs = [];
  for (const f of await store.data.list('jobs')) {
    if (!f.endsWith('.json')) continue;
    const job = await readJob(store, f.slice(0, -5));
    if (job) jobs.push(await withProgress(store, base, job));
  }
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getJob(store, base, id) {
  const job = await readJob(store, id);
  return job ? withProgress(store, base, job) : null;
}

// A persona read or re-read (with the person's one-line correction) as a single-item job.
export async function createPersonaJob(store, base, { correction = null, cli }) {
  const current = await store.data.readJSON('persona.json', null);
  const id = `j${randomBytes(5).toString('hex')}`;
  const briefKey = `jobs/${id}-brief.md`;
  const answers = current?.answers ?? (await store.data.readJSON('answers.json', null));
  await store.data.writeText(briefKey, personaBrief({ correction, cli, current, answers }));
  const job = {
    id, kind: 'persona', status: 'active', createdAt: now(), run: null, like: null, keep: null,
    correction,
    items: [{ kind: 'persona', theme: null, brief: briefKey, baseN: current?.n ?? 0, claimedAt: null, claimedBy: null }],
  };
  await store.data.withLock('jobs', () => writeJob(store, job));
  return withProgress(store, base, job);
}

// Ask an agent to read uploaded files (resume, LinkedIn export) into folio.json.
export async function createContentJob(store, base, { files, cli }) {
  const id = `j${randomBytes(5).toString('hex')}`;
  const briefKey = `jobs/${id}-brief.md`;
  await store.data.writeText(briefKey, contentBrief({ files, cli }));
  const job = { id, kind: 'content', status: 'active', createdAt: now(), run: null, like: null, keep: null,
    items: [{ kind: 'content', theme: null, brief: briefKey, since: now(), claimedAt: null, claimedBy: null }] };
  await store.data.withLock('jobs', () => writeJob(store, job));
  return withProgress(store, base, job);
}

// Ask an agent for a round of inventive sketch specs (from persona + references), as a single-item job.
export async function createSketchJob(store, base, { count = 12, cli }) {
  const persona = await store.data.readJSON('persona.json', null);
  const refs = (await store.data.readJSON('references.json', [])).filter((r) => !r.hidden);
  const id = `j${randomBytes(5).toString('hex')}`;
  const briefKey = `jobs/${id}-brief.md`;
  await store.data.writeText(briefKey, sketchesBrief({ count, cli, persona, refs }));
  const job = { id, kind: 'sketches', status: 'active', createdAt: now(), run: null, like: null, keep: null,
    items: [{ kind: 'sketches', theme: null, brief: briefKey, since: now(), claimedAt: null, claimedBy: null }] };
  await store.data.withLock('jobs', () => writeJob(store, job));
  return withProgress(store, base, job);
}

function sketchesBrief({ count, cli, persona, refs }) {
  const pinned = refs.filter((r) => r.pinned);
  return `# Invent ${count} sketches

Write ${count} sketch specs: quick first screens the person will like or skip. folio renders them instantly; only liked ones get built.
${persona ? `\nPersona: **${persona.headline}** ${persona.lede || ''}\nWorlds: ${(persona.worlds || []).join(', ')}\nDials: ${JSON.stringify(persona.dials)}\nAvoid: ${(persona.avoid || []).join('; ')}\n` : '\n(No persona yet: read folio.json.)\n'}
${refs.length ? `References (principles from their worlds${pinned.length ? '; pinned ones matter most' : ''}):\n${refs.slice(0, 12).map((r) => `- ${r.pinned ? '★ ' : ''}${r.title} (${r.world}): ${r.principles.join('; ')}`).join('\n')}\n` : ''}
## Range first (this is the whole point)
Language models collapse to the typical answer. Fight it: first list ~20 candidate directions with a rough probability that a generic designer would propose each, then pick ${count} that span the space, including several with LOW probability. Vary all of: light vs dark, quiet vs loud, serif vs sans vs mono vs hand, layout, motif. At most two may share a layout.

## Spec shape (JSON array, save with \`${cli} sketch add <file.json>\`; it validates)
\`\`\`json
[{ "title": "short name", "mood": "three words", "note": "the idea in one line",
   "layout": "statement|split|poster|editorial|bento|index|stack|terminal",
   "motif": "none|shapes|grid|lines|dots|tape|notebook",
   "palette": { "bg": "#rrggbb", "ink": "#rrggbb", "accent": "#rrggbb", "accent2": "#rrggbb", "muted": "#rrggbb" },
   "fonts": { "display": "Google Fonts family", "text": "Google Fonts family", "weight": 400-900, "italic": false, "upper": false },
   "refs": ["reference ids that inspired it"] }]
\`\`\`
Never Inter, Roboto, Arial, Poppins, Montserrat or Space Grotesk for display. The terminal layout needs a mono display font. Keep text readable: ink must contrast with bg.
`;
}

// Claim the next waiting design across all active jobs (oldest job first). Returns null when nothing waits.
export async function claimNext(store, base, worker = 'agent') {
  return store.data.withLock('jobs', () => claimNextUnlocked(store, base, worker));
}

async function claimNextUnlocked(store, base, worker) {
  const jobs = (await listJobs(store, base)).filter((j) => j.status === 'active').reverse();
  for (const j of jobs) {
    const next = j.items.find((i) => i.state === 'waiting');
    if (!next) continue;
    const raw = await readJob(store, j.id);
    const rec = raw.items.find((i) => i.theme === next.theme);
    rec.claimedAt = now();
    rec.claimedBy = worker;
    await writeJob(store, raw);
    const brief = await store.data.readText(next.brief);
    if (next.kind === 'persona' || next.kind === 'sketches' || next.kind === 'content') return { job: j.id, kind: next.kind, briefPath: `.folio/${next.brief}`, brief };
    return { job: j.id, kind: 'design', run: j.run, theme: next.theme, briefPath: `.folio/${next.brief}`, themePath: `themes/${next.theme}.js`, brief };
  }
  return null;
}

// Cancel: stop handing out work and archive designs that were never designed (they stay restorable).
export async function cancelJob(store, base, id) {
  return store.data.withLock('jobs', () => cancelJobUnlocked(store, base, id));
}

async function cancelJobUnlocked(store, base, id) {
  const raw = await readJob(store, id);
  if (!raw) throw new Error(`no job ${id}`);
  raw.status = 'cancelled';
  raw.cancelledAt = now();
  await writeJob(store, raw);
  const job = await withProgress(store, base, raw);
  for (const it of job.items) if (it.theme && (it.state === 'waiting' || it.state === 'working')) await setFlag(store, it.theme, 'archived', true).catch(() => {});
  return job;
}

// Designs an agent is working on right now: never deleted underneath it.
export async function busyThemes(store, base) {
  const busy = new Set();
  for (const j of await listJobs(store, base)) for (const it of j.items) if (it.theme && it.state === 'working') busy.add(it.theme);
  return busy;
}

// Deleted designs leave their jobs, so no agent claims (and quietly re-creates) them. A job left with
// nothing to do is removed.
export async function forgetThemes(store, themes) {
  const gone = new Set(themes);
  return store.data.withLock('jobs', async () => {
    for (const f of await store.data.list('jobs')) {
      if (!/^j[0-9a-f]{10}\.json$/.test(f)) continue;
      const job = await store.data.readJSON(`jobs/${f}`, null);
      if (!job) continue;
      const items = job.items.filter((it) => !gone.has(it.theme));
      if (items.length === job.items.length) continue;
      if (!items.length) await store.data.remove(`jobs/${f}`);
      else await writeJob(store, { ...job, items });
    }
  });
}
