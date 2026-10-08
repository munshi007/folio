// Explore: rounds of sketches, likes and skips, and the taste learned from them.

import { autoSpecs, validateSpec, normalizeSpec, fingerprint, learnTaste } from './sketch.js';

const now = () => new Date().toISOString();
const SPEC_ID = /^s\d{1,4}-\d{1,3}$/;
export const validSpecId = (id) => typeof id === 'string' && SPEC_ID.test(id);

export async function listRounds(store) {
  const rounds = [];
  for (const f of await store.data.list('sketches')) {
    if (!/^\d+\.json$/.test(f)) continue;
    const r = await store.data.readJSON(`sketches/${f}`, null);
    if (r) rounds.push(r);
  }
  return rounds.sort((a, b) => b.round - a.round);
}

export async function readPicks(store) {
  return store.data.readJSON('picks.json', { liked: {}, skipped: {} });
}

async function nextRoundNo(store) {
  const rounds = await listRounds(store);
  return rounds.length ? rounds[0].round + 1 : 1;
}

async function saveRound(store, specs, source) {
  return store.data.withLock('sketches', async () => {
    const round = await nextRoundNo(store);
    const rec = { round, createdAt: now(), source, specs: specs.map((s, i) => ({ ...normalizeSpec(s), id: `s${round}-${i + 1}`, wild: Boolean(s.wild) })) };
    await store.data.writeJSON(`sketches/${round}.json`, rec);
    return rec;
  });
}

export async function tasteFrom(store) {
  const rounds = await listRounds(store);
  return learnTaste(rounds.flatMap((r) => r.specs), await readPicks(store));
}

// An instant round, no agent: sampled from persona + answers + learned taste, never repeating a sketch.
export async function autoRound(store, { persona, headline = '', count = 12, seed } = {}) {
  const rounds = await listRounds(store);
  const seen = new Set(rounds.flatMap((r) => r.specs.map(fingerprint)));
  const specs = autoSpecs({ persona, taste: await tasteFrom(store), count, seed: seed ?? Date.now(), seen, headline });
  return saveRound(store, specs, 'auto');
}

// A round an agent invented (`folio sketch add specs.json`).
export async function agentRound(store, specs) {
  if (!Array.isArray(specs) || !specs.length || specs.length > 24) throw new Error('expected a JSON array of 1–24 sketch specs');
  const errors = specs.flatMap((s, i) => validateSpec(s, i));
  if (errors.length) throw new Error(`sketch specs have problems: ${errors.join('; ')}`);
  return saveRound(store, specs.map((s) => ({ ...s, source: 'agent' })), 'agent');
}

export async function getSpec(store, id) {
  if (!validSpecId(id)) return null;
  const round = Number(id.slice(1).split('-')[0]);
  const r = await store.data.readJSON(`sketches/${round}.json`, null);
  return r?.specs.find((s) => s.id === id) ?? null;
}

// value: 'like' | 'skip' | null (clear)
export async function pick(store, id, value) {
  if (!(await getSpec(store, id))) throw new Error(`no sketch ${id}`);
  if (![null, 'like', 'skip'].includes(value)) throw new Error('value must be like, skip or null');
  return store.data.withLock('picks', async () => {
    const p = await readPicks(store);
    delete p.liked[id];
    delete p.skipped[id];
    if (value === 'like') p.liked[id] = now();
    if (value === 'skip') p.skipped[id] = now();
    await store.data.writeJSON('picks.json', p);
    return p;
  });
}

// The few tags that best describe what the person likes and dislikes so far (for the taste meter).
export function tasteSummary(taste) {
  const entries = Object.entries(taste).filter(([k]) => !k.startsWith('motif:') && !['statement', 'split', 'poster', 'editorial', 'bento', 'index', 'stack', 'terminal'].includes(k));
  const likes = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
  const dislikes = entries.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k]) => k);
  return { likes, dislikes };
}
