// Reference board: what a person's own worlds look like, kept as principles with credit, never as copies.
// An agent gathers them from open archives, standards and normal web search that respects each site's rules,
// then writes them with `folio refs add <file.json>`. People pin the ones they like (they weigh more in the
// next round) or hide ones that miss.
//
// Deliberately no image or text storage: a reference holds principles, design moves, an optional colour and
// font specimen, and a link to the source. That keeps folio on the right side of copyright and site terms.

const KINDS = ['archive', 'standard', 'web', 'own'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,59}$/;

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, n, max) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function safeUrl(u) {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

export function validateRefs(input) {
  const errors = [];
  if (!Array.isArray(input) || !input.length) return ['expected a non-empty JSON array of references'];
  input.forEach((r, i) => {
    if (!str(r?.title, 120)) errors.push(`[${i}].title: required`);
    if (!KINDS.includes(r?.kind)) errors.push(`[${i}].kind: one of ${KINDS.join(', ')}`);
    if (r?.kind !== 'own' && !safeUrl(r?.url)) errors.push(`[${i}].url: an http(s) link to the source (credit)`);
    if (!list(r?.principles, 6, 200).length) errors.push(`[${i}].principles: at least one design principle you took from it`);
    if (r?.specimen?.colors && !(Array.isArray(r.specimen.colors) && r.specimen.colors.every((c) => HEX.test(c)))) errors.push(`[${i}].specimen.colors: #rrggbb values`);
    if (r?.image || r?.html || r?.text) errors.push(`[${i}]: don't store images or copied text, only principles and a link`);
  });
  return errors;
}

function normalizeRef(r) {
  const title = str(r.title, 120);
  return {
    id: ID.test(r.id ?? '') ? r.id : slug(title) || 'ref',
    title,
    world: str(r.world, 60),
    kind: r.kind,
    url: r.kind === 'own' && !r.url ? '' : safeUrl(r.url),
    credit: str(r.credit, 160),
    license: str(r.license, 60),
    why: str(r.why, 300),
    principles: list(r.principles, 6, 200),
    moves: list(r.moves, 4, 200),
    specimen: r.specimen ? { colors: (r.specimen.colors || []).filter((c) => HEX.test(c)).slice(0, 6), font: str(r.specimen.font, 60) } : null,
  };
}

export async function readRefs(store) {
  return store.data.readJSON('references.json', []);
}

// Add or update references (matched by id). Flags the person set (pinned, hidden) survive an update.
export async function addRefs(store, input) {
  const errors = validateRefs(input);
  if (errors.length) throw new Error(`references have problems: ${errors.join('; ')}`);
  return store.data.withLock('references', async () => {
    const cur = await readRefs(store);
    const byId = new Map(cur.map((r) => [r.id, r]));
    for (const raw of input) {
      const r = normalizeRef(raw);
      let id = r.id;
      if (byId.has(id) && byId.get(id).title !== r.title) for (let i = 2; byId.has(id); i++) id = `${r.id}-${i}`;
      const prev = byId.get(id);
      byId.set(id, { ...r, id, pinned: prev?.pinned ?? false, hidden: prev?.hidden ?? false, addedAt: prev?.addedAt ?? new Date().toISOString() });
    }
    const out = [...byId.values()];
    await store.data.writeJSON('references.json', out);
    return out;
  });
}

export async function setRefFlag(store, id, flag, value) {
  if (!['pinned', 'hidden'].includes(flag)) throw new Error(`unknown flag ${flag}`);
  return store.data.withLock('references', async () => {
    const cur = await readRefs(store);
    const r = cur.find((x) => x.id === id);
    if (!r) throw new Error(`no reference ${id}`);
    r[flag] = Boolean(value);
    await store.data.writeJSON('references.json', cur);
    return r;
  });
}
