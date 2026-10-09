// The Library: every design a person has, every version of it, and where it came from. Archive hides and
// restore brings back; deleting is the person's explicit choice (designs, versions, whole rounds, clean-ups)
// and is permanent. Restoring an old version adds a new version on top.
//
// Records live in the store's data namespace:
//   library.json            { v, designs: { id: record }, publishes: [...] }
//   versions/<id>.json      [ { n, at, hash, note } ]  (newest last)
//   versions/<id>/<n>.js    the theme source at that version
// Design ids are theme names, which are unique within a project.

import { createHash } from 'node:crypto';

const EMPTY = () => ({ v: 1, designs: {}, publishes: [] });
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const hash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 16);
const now = () => new Date().toISOString();
const MERGE_MS = 15 * 60 * 1000;

export function validId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

function describe(source) {
  const m = source.match(/description:\s*(['"`])((?:\\.|(?!\1).)*)\1/);
  return m ? m[2].replace(/\\(.)/g, '$1') : '';
}

const isPendingSource = (source) => /description:\s*'PENDING:/.test(source);

async function readLibrary(store) {
  const lib = await store.data.readJSON('library.json', null);
  return lib && lib.v === 1 ? lib : EMPTY();
}

async function writeLibrary(store, lib) {
  await store.data.writeJSON('library.json', lib);
}

async function readVersions(store, id) {
  return store.data.readJSON(`versions/${id}.json`, []);
}

async function addVersion(store, id, source, note) {
  const versions = await readVersions(store, id);
  const n = versions.length ? versions[versions.length - 1].n + 1 : 1;
  await store.data.writeText(`versions/${id}/${n}.js`, source);
  versions.push({ n, at: now(), hash: hash(source), note });
  await store.data.writeJSON(`versions/${id}.json`, versions);
  return n;
}

async function replaceVersion(store, id, source) {
  const versions = await readVersions(store, id);
  const last = versions[versions.length - 1];
  await store.data.writeText(`versions/${id}/${last.n}.js`, source);
  Object.assign(last, { at: now(), hash: hash(source) });
  await store.data.writeJSON(`versions/${id}.json`, versions);
  return last.n;
}

// Generation runs say where a design came from: which round, which brief, which parent.
async function readRuns(store) {
  const runs = [];
  for (const name of await store.data.list('gen')) {
    if (!/^\d+$/.test(name)) continue;
    const meta = await store.data.readJSON(`gen/${name}/run.json`, null);
    if (meta) runs.push(meta);
  }
  return runs.sort((a, b) => a.run - b.run);
}

function originFromRuns(runs) {
  const map = {};
  for (const r of runs) {
    for (const b of r.briefs || []) {
      map[b.theme] = { run: r.run, brief: b.n, parent: r.parent ?? null, label: b.label ?? null, direction: b.direction ?? null, wildcard: !!b.wildcard };
    }
  }
  return map;
}

// Bring the library up to date with the theme files on disk. Called on every read, so edits made by an
// agent (or by hand) outside Studio still become versions.
export async function syncLibrary(store) {
  const lib = await readLibrary(store);
  const runs = await readRuns(store);
  const origins = originFromRuns(runs);
  let changed = false;
  const seen = new Set();

  for (const file of await store.themes.list('')) {
    if (!file.endsWith('.js') || file.startsWith('_') || file === 'index.js') continue;
    const id = file.slice(0, -3);
    if (!validId(id)) continue;
    seen.add(id);
    const source = (await store.themes.readText(file)) ?? '';
    const origin = origins[id] ?? null;
    if (!lib.designs[id]) {
      lib.designs[id] = {
        id,
        createdAt: now(),
        origin: origin ? (origin.parent ? 'variation' : 'generated') : 'local',
        run: origin?.run ?? null,
        brief: origin?.brief ?? null,
        parent: origin?.parent ?? null,
        favorite: false,
        archived: false,
      };
      changed = true;
    }
    if (lib.designs[id].missing) {
      delete lib.designs[id].missing;
      changed = true;
    }
    if (isPendingSource(source)) continue; // not designed yet: no version until it is
    const versions = await readVersions(store, id);
    const last = versions[versions.length - 1];
    if (!last || last.hash !== hash(source)) {
      // A designer saving every few minutes isn't making versions anyone wants to scroll through: an edit
      // shortly after an unpublished outside edit replaces it instead of stacking up.
      const quick = last && (last.note === 'created' || last.note === 'edited outside Studio') && Date.now() - new Date(last.at).getTime() < MERGE_MS && !lib.publishes.some((p) => p.design === id && p.version === last.n);
      if (quick) await replaceVersion(store, id, source);
      else await addVersion(store, id, source, last ? 'edited outside Studio' : 'created');
    }
  }
  // A theme file that disappeared keeps its record and history; it can be restored.
  for (const id of Object.keys(lib.designs)) {
    if (!seen.has(id) && !lib.designs[id].missing) {
      lib.designs[id].missing = true;
      changed = true;
    }
  }
  if (changed) await writeLibrary(store, lib);
  return { lib, runs, origins };
}

export async function getLibrary(store, { current = null, builtins = [] } = {}) {
  const { lib, runs, origins } = await syncLibrary(store);
  const designs = [];
  for (const rec of Object.values(lib.designs)) {
    const source = rec.missing ? '' : ((await store.themes.readText(`${rec.id}.js`)) ?? '');
    const versions = await readVersions(store, rec.id);
    const latest = versions[versions.length - 1] ?? null;
    const origin = origins[rec.id] ?? null;
    designs.push({
      ...rec,
      label: origin?.label ?? null,
      direction: origin?.direction ?? null,
      wildcard: origin?.wildcard ?? false,
      description: rec.missing && latest ? describe((await store.data.readText(`versions/${rec.id}/${latest.n}.js`)) ?? '') : describe(source),
      pending: !rec.missing && isPendingSource(source),
      versions: versions.length,
      latest: latest?.n ?? null,
      updatedAt: latest?.at ?? rec.createdAt,
      current: rec.id === current,
      live: lib.publishes.length ? lib.publishes[lib.publishes.length - 1].design === rec.id : false,
    });
  }
  designs.sort((a, b) => (b.run ?? 0) - (a.run ?? 0) || (a.brief ?? 99) - (b.brief ?? 99) || a.id.localeCompare(b.id));
  return {
    current,
    designs,
    runs: runs.map((r) => ({ run: r.run, parent: r.parent ?? null, keep: r.keep ?? null, created: r.created ?? null, count: (r.briefs || []).length })).reverse(),
    builtins,
    publishes: lib.publishes.slice(-20).reverse(),
  };
}

export async function getDesign(store, id) {
  if (!validId(id)) return null;
  const { lib } = await syncLibrary(store);
  const rec = lib.designs[id];
  if (!rec) return null;
  const versions = (await readVersions(store, id)).slice().reverse();
  const children = Object.values(lib.designs).filter((d) => d.parent === id).map((d) => d.id);
  return { ...rec, versions, children };
}

export async function getVersionSource(store, id, n) {
  if (!validId(id) || !Number.isInteger(n) || n < 1) return null;
  return store.data.readText(`versions/${id}/${n}.js`);
}

// Restoring writes the old source back to the theme file and records it as a NEW version, so the
// version you restored away from is still there.
export async function restoreVersion(store, id, n) {
  const source = await getVersionSource(store, id, n);
  if (source == null) throw new Error(`no version ${n} of ${id}`);
  await store.themes.writeText(`${id}.js`, source);
  const lib = await readLibrary(store);
  if (lib.designs[id]?.missing) {
    delete lib.designs[id].missing;
    await writeLibrary(store, lib);
  }
  return addVersion(store, id, source, `restored v${n}`);
}

export async function setFlag(store, id, flag, value) {
  if (!['favorite', 'archived'].includes(flag)) throw new Error(`unknown flag ${flag}`);
  const { lib } = await syncLibrary(store);
  if (!lib.designs[id]) throw new Error(`unknown design ${id}`);
  lib.designs[id][flag] = Boolean(value);
  await writeLibrary(store, lib);
  return lib.designs[id];
}

export async function recordPublish(store, { design, host, url }) {
  const lib = await readLibrary(store);
  const versions = await readVersions(store, design);
  lib.publishes.push({ at: now(), design, version: versions[versions.length - 1]?.n ?? null, host, url: url ?? null });
  await writeLibrary(store, lib);
}

// ---- Deleting (permanent, always the person's explicit choice) --------------------------------------

async function removeDesignFiles(store, id) {
  await store.themes.remove(`${id}.js`);
  await store.data.remove(`versions/${id}`, { recursive: true });
  await store.data.remove(`versions/${id}.json`);
}

// Delete designs and everything about them. The live site's design can't be deleted (switch first).
export async function deleteDesigns(store, ids, { current = null } = {}) {
  const { lib } = await syncLibrary(store);
  const gone = [];
  for (const id of ids) {
    if (!validId(id) || !lib.designs[id]) continue;
    if (id === current) throw new Error(`"${id}" is your site right now. Make another design your site first.`);
    await removeDesignFiles(store, id);
    delete lib.designs[id];
    gone.push(id);
  }
  // Variations of a deleted design keep working; they just lose the family link.
  for (const d of Object.values(lib.designs)) if (gone.includes(d.parent)) d.parent = null;
  await writeLibrary(store, lib);
  return gone;
}

export async function deleteVersion(store, id, n) {
  const versions = await readVersions(store, id);
  const i = versions.findIndex((v) => v.n === n);
  if (i < 0) throw new Error(`no version ${n} of ${id}`);
  if (i === versions.length - 1) throw new Error('That is the current version. Restore another one first, then delete this.');
  versions.splice(i, 1);
  await store.data.remove(`versions/${id}/${n}.js`);
  await store.data.writeJSON(`versions/${id}.json`, versions);
  return versions.slice().reverse();
}

// What each clean-up would remove, so the confirm dialog can say exactly that.
export async function cleanupPlan(store, { current = null, busy = new Set() } = {}) {
  const { lib } = await syncLibrary(store);
  const designs = Object.values(lib.designs).filter((d) => d.id !== current);
  const pending = new Set();
  for (const d of designs) if (isPendingSource((await store.themes.readText(`${d.id}.js`)) ?? '')) pending.add(d.id);
  return {
    archived: designs.filter((d) => d.archived).map((d) => d.id),
    drafts: designs.filter((d) => pending.has(d.id) && !busy.has(d.id)).map((d) => d.id),
    keepFavorites: designs.filter((d) => !d.favorite && !busy.has(d.id)).map((d) => d.id),
    round: (run) => designs.filter((d) => d.run === run && !d.favorite && !busy.has(d.id)).map((d) => d.id),
  };
}
