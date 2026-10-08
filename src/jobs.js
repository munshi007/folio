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

export async function createJob(store, base, profile, { like = null, keep = 'vibe', count, cli, seed }) {
  const { run, files, seed: usedSeed } = await createRun(base, profile, { count: count ?? (like ? 3 : 6), like, keep, cli, seed });
  const job = {
    id: `j${randomBytes(5).toString('hex')}`,
    kind: like ? 'variations' : 'generate',
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
    return { job: j.id, run: j.run, theme: next.theme, briefPath: `.folio/${next.brief}`, themePath: `themes/${next.theme}.js`, brief };
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
  for (const it of job.items) if (it.state === 'waiting' || it.state === 'working') await setFlag(store, it.theme, 'archived', true).catch(() => {});
  return job;
}
