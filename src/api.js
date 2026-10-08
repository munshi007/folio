// Studio's JSON API. The Studio UI talks to folio only through these routes (never the filesystem), so the
// same UI can later sit in front of a hosted backend.
//
//   GET  /api/library                      every design, run and publish
//   GET  /api/designs/:id                  one design: record, versions (newest first), children
//   POST /api/designs/:id/restore {n}      restore version n (adds a new version)
//   POST /api/designs/:id/flag {flag,value} favorite | archived
//   POST /api/site/theme {id}              make a design the site's design (as designed: look overrides dropped)
//   GET  /api/jobs                         generation jobs with live progress
//   POST /api/jobs {count, like?, keep?}   start a generation (or "more like this") job
//   POST /api/jobs/:id/cancel              stop a job; never-designed drafts get archived
//   GET  /preview/:id[?v=n]                the site rendered with a design (or an old version of it), no overlay
//
// Writes require same-origin JSON with an X-Folio header; every route requires a localhost Host header.

import { writeFile } from 'node:fs/promises';
import { loadConfig, renderHtml } from './build.js';
import { listThemes, renderWith } from './themes.js';
import { normalize, validate } from './schema.js';
import { themes as builtins } from '../themes/index.js';
import { getLibrary, getDesign, getVersionSource, restoreVersion, setFlag, validId } from './library.js';
import { applyStyleChange } from './serve.js';
import { createJob, listJobs, cancelJob, validJobId, createPersonaJob, createSketchJob } from './jobs.js';
import { readPersona, patchPersona, restorePersona, addCorrection, QUESTIONS } from './persona.js';
import { readRefs, setRefFlag } from './references.js';
import { listRounds, readPicks, autoRound, pick, getSpec, tasteFrom, tasteSummary, validSpecId } from './explore.js';
import { renderSketch } from './sketch.js';
import { designTraits } from './traits.js';
import { publishCheck, publish } from './publish.js';
import { readContent, writeContent, restoreContent, importGitHub, saveUpload, contentVersions, MAX_UPLOAD } from './content.js';
import { createContentJob } from './jobs.js';
import { KEEPS } from './generate.js';
import { fileURLToPath } from 'node:url';

// The exact folio that's running, so briefs tell agents a command that works on this machine.
const CLI = `node "${fileURLToPath(new URL('../bin/folio.js', import.meta.url))}"`;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// DNS-rebinding guard: a page on evil.example that resolves to 127.0.0.1 still sends Host: evil.example.
export function localHost(req) {
  const host = String(req.headers.host || '').replace(/:\d+$/, '');
  return LOCAL_HOSTS.has(host);
}

export function writeAllowed(req, port) {
  const origin = req.headers.origin;
  const ours = !origin || origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
  return req.method === 'POST' && req.headers['x-folio'] === '1' && String(req.headers['content-type']).startsWith('application/json') && ours;
}

async function readJSONBody(req, limit = 10_000) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Error('request too large');
  }
  return body ? JSON.parse(body) : {};
}

const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};

// Render a theme straight from source (an old version) without writing it anywhere: import it as a data: URL.
async function themeFromSource(id, source) {
  const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  if (typeof mod.render !== 'function') throw new Error(`version of ${id} has no render()`);
  return { meta: { name: id, ...mod.meta }, render: mod.render };
}

export async function handleApi(req, res, url, ctx) {
  const { store, configPath, base, port } = ctx;
  const path = url.pathname;
  if (!path.startsWith('/api/') && !path.startsWith('/preview/') && !path.startsWith('/sketch/')) return false;
  if (!localHost(req)) {
    send(res, 403, { error: 'forbidden host' });
    return true;
  }

  try {
    if (path.startsWith('/preview/')) {
      const id = decodeURIComponent(path.slice('/preview/'.length));
      const raw = await loadConfig(configPath);
      const v = url.searchParams.get('v');
      let html;
      if (v) {
        const source = await getVersionSource(store, id, Number(v));
        if (source == null) return send(res, 404, { error: 'no such version' }), true;
        const { errors } = validate(raw);
        if (errors.length) throw new Error(errors.join('; '));
        const p = normalize(raw);
        p.style = { ...p.style, mode: 'auto', font: 'theme' };
        html = renderWith(await themeFromSource(id, source), p);
      } else {
        const names = (await listThemes(base)).map((t) => t.name);
        if (!names.includes(id)) return send(res, 404, { error: 'no such design' }), true;
        ({ html } = await renderHtml(raw, { theme: id, baseDir: base, pure: true }));
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return true;
    }

    // Sketch preview: the first screen a spec describes, with the person's real content.
    if (path.startsWith('/sketch/')) {
      const id = decodeURIComponent(path.slice('/sketch/'.length));
      const spec = validSpecId(id) ? await getSpec(store, id) : null;
      if (!spec) return send(res, 404, { error: 'no such sketch' }), true;
      const raw = await loadConfig(configPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(renderSketch(spec, normalize(raw)));
      return true;
    }

    // ---- persona ----
    if (path === '/api/persona') {
      if (req.method === 'GET') {
        const persona = await readPersona(store);
        return send(res, 200, { persona, questions: QUESTIONS, answers: persona?.answers ?? (await store.data.readJSON('answers.json', null)) }), true;
      }
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      const persona = await store.data.readJSON('persona.json', null);
      if (!persona) {
        // Before the first read, answers are kept on their own and handed to the agent that reads the person.
        if (!body.answers) return send(res, 400, { error: 'no persona yet: start a read first' }), true;
        const clean = Object.fromEntries(Object.entries(QUESTIONS).map(([k, q]) => [k, (body.answers[k] || []).filter((a) => q.options.includes(a))]));
        await store.data.writeJSON('answers.json', clean);
        return send(res, 200, { ok: true, answers: clean }), true;
      }
      return send(res, 200, await patchPersona(store, body)), true;
    }
    if (path === '/api/persona/restore' || path === '/api/persona/correct' || path === '/api/persona/read') {
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      if (path.endsWith('restore')) return send(res, 200, await restorePersona(store, Number(body.n))), true;
      if (path.endsWith('correct')) {
        await addCorrection(store, body.text);
        return send(res, 200, await createPersonaJob(store, base, { correction: String(body.text).slice(0, 300), cli: CLI })), true;
      }
      return send(res, 200, await createPersonaJob(store, base, { cli: CLI })), true;
    }

    // ---- references ----
    if (path === '/api/references' && req.method === 'GET') return send(res, 200, await readRefs(store)), true;
    const rm = path.match(/^\/api\/references\/([a-z0-9-]{1,60})\/flag$/);
    if (rm) {
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      return send(res, 200, await setRefFlag(store, rm[1], body.flag, body.value)), true;
    }

    // ---- sketches ----
    if (path === '/api/sketches') {
      if (req.method === 'GET') {
        const [rounds, picks, taste] = await Promise.all([listRounds(store), readPicks(store), tasteFrom(store)]);
        return send(res, 200, { rounds, picks, taste: tasteSummary(taste) }), true;
      }
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      const count = body.count == null ? 12 : Number(body.count);
      if (!(Number.isInteger(count) && count >= 4 && count <= 24)) return send(res, 400, { error: 'count must be 4–24' }), true;
      if (body.agent) return send(res, 200, await createSketchJob(store, base, { count, cli: CLI })), true;
      const raw = await loadConfig(configPath);
      const persona = await store.data.readJSON('persona.json', null);
      const answers = persona ? null : await store.data.readJSON('answers.json', null);
      return send(res, 200, await autoRound(store, { persona: persona ?? (answers ? { answers } : null), headline: normalize(raw).headline, count })), true;
    }
    if (path === '/api/sketches/build') {
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.filter(validSpecId).slice(0, 6) : [];
      if (!ids.length) return send(res, 400, { error: 'pick 1–6 sketches to build' }), true;
      const specs = [];
      for (const id of ids) {
        const sp = await getSpec(store, id);
        if (!sp) return send(res, 400, { error: `no sketch ${id}` }), true;
        specs.push(sp);
      }
      const raw = await loadConfig(configPath);
      const { errors } = validate(raw);
      if (errors.length) return send(res, 400, { error: `fix folio.json first: ${errors.join('; ')}` }), true;
      return send(res, 200, await createJob(store, base, normalize(raw), { sketches: specs, cli: CLI })), true;
    }
    const sm = path.match(/^\/api\/sketches\/([^/]+)\/pick$/);
    if (sm) {
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      if (!validSpecId(sm[1])) return send(res, 400, { error: 'bad sketch id' }), true;
      const body = await readJSONBody(req);
      return send(res, 200, await pick(store, sm[1], body.value ?? null)), true;
    }

    if (req.method === 'GET' && path === '/api/library') {
      const raw = await loadConfig(configPath);
      const builtinList = Object.values(builtins).map((t) => ({ id: t.meta.name, description: t.meta.description }));
      const lib = await getLibrary(store, { current: raw.theme ?? null, builtins: builtinList });
      const p = normalize(raw);
      lib.profile = { name: p.name, headline: p.headline, projects: p.projects.length, roles: p.experience.length, url: p.url || null };
      return send(res, 200, lib), true;
    }

    const tm = path.match(/^\/api\/designs\/([^/]+)\/traits$/);
    if (tm && req.method === 'GET') {
      const id = decodeURIComponent(tm[1]);
      const names = (await listThemes(base)).map((t) => t.name);
      if (!names.includes(id)) return send(res, 404, { error: 'no such design' }), true;
      const { html } = await renderHtml(await loadConfig(configPath), { theme: id, baseDir: base, pure: true });
      return send(res, 200, designTraits(html)), true;
    }

    const m = path.match(/^\/api\/designs\/([^/]+)(\/(restore|flag))?$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (!validId(id)) return send(res, 400, { error: 'bad design id' }), true;
      if (!m[3] && req.method === 'GET') {
        const d = await getDesign(store, id);
        return d ? send(res, 200, d) : send(res, 404, { error: 'no such design' }), true;
      }
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      if (m[3] === 'restore') {
        const n = Number(body.n);
        if (!Number.isInteger(n) || n < 1) return send(res, 400, { error: 'n must be a version number' }), true;
        const added = await restoreVersion(store, id, n);
        return send(res, 200, { ok: true, version: added }), true;
      }
      if (m[3] === 'flag') {
        const rec = await setFlag(store, id, body.flag, body.value);
        return send(res, 200, { ok: true, design: rec }), true;
      }
    }

    if (path === '/api/jobs') {
      if (req.method === 'GET') return send(res, 200, await listJobs(store, base)), true;
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      const raw = await loadConfig(configPath);
      const { errors } = validate(raw);
      if (errors.length) return send(res, 400, { error: `fix folio.json first: ${errors.join('; ')}` }), true;
      if (body.mix) {
        const names = (await listThemes(base)).map((t) => t.name);
        const mix = {};
        for (const k of ['layout', 'colors', 'type', 'signature']) {
          if (!names.includes(body.mix[k])) return send(res, 400, { error: `mix.${k}: pick one of your designs` }), true;
          mix[k] = body.mix[k];
        }
        mix.traits = {};
        for (const id of new Set(Object.values(mix).filter((v) => typeof v === 'string'))) {
          const { html } = await renderHtml(raw, { theme: id, baseDir: base, pure: true });
          mix.traits[id] = designTraits(html);
        }
        return send(res, 200, await createJob(store, base, normalize(raw), { mix, cli: CLI })), true;
      }
      const like = body.like == null ? null : String(body.like);
      if (like != null && !(await listThemes(base)).some((t) => t.name === like)) return send(res, 400, { error: `unknown design "${like}"` }), true;
      const keep = body.keep == null ? 'vibe' : String(body.keep);
      if (!KEEPS[keep]) return send(res, 400, { error: `keep must be one of ${Object.keys(KEEPS).join(', ')}` }), true;
      const count = body.count == null ? undefined : Number(body.count);
      if (count !== undefined && !(Number.isInteger(count) && count >= 1 && count <= 12)) return send(res, 400, { error: 'count must be 1–12' }), true;
      const job = await createJob(store, base, normalize(raw), { like, keep, count, cli: CLI });
      return send(res, 200, job), true;
    }

    const jm = path.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
    if (jm) {
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      if (!validJobId(jm[1])) return send(res, 400, { error: 'bad job id' }), true;
      return send(res, 200, await cancelJob(store, base, jm[1])), true;
    }

    // ---- content ----
    if (path === '/api/content') {
      if (req.method === 'GET') return send(res, 200, { ...(await readContent(configPath)), versions: await contentVersions(store) }), true;
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req, 200_000);
      return send(res, 200, await writeContent(store, configPath, body.content)), true;
    }
    if (path === '/api/content/restore' || path === '/api/content/github' || path === '/api/content/read') {
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      if (path.endsWith('restore')) return send(res, 200, await restoreContent(store, configPath, body.n)), true;
      if (path.endsWith('github')) return send(res, 200, await importGitHub(store, configPath, body.user)), true;
      const files = (Array.isArray(body.files) ? body.files : []).filter((f) => /^\.folio\/inputs\/[a-z0-9-]{1,40}\.(pdf|docx|txt|md|zip)$/.test(f));
      if (!files.length) return send(res, 400, { error: 'upload a file first' }), true;
      return send(res, 200, await createContentJob(store, base, { files, cli: CLI })), true;
    }
    if (path === '/api/content/upload') {
      // Raw file body (not JSON), so the same-origin + X-Folio rules are checked here by hand.
      const origin = req.headers.origin;
      const ours = !origin || origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
      if (req.method !== 'POST' || req.headers['x-folio'] !== '1' || !ours) return send(res, 403, { error: 'forbidden' }), true;
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > MAX_UPLOAD) return send(res, 413, { error: 'file is over 10 MB' }), true;
        chunks.push(c);
      }
      return send(res, 200, await saveUpload(store, { name: url.searchParams.get('name'), type: req.headers['content-type'], body: Buffer.concat(chunks) })), true;
    }

    // ---- publish ----
    if (path === '/api/publish/check' && req.method === 'GET') return send(res, 200, await publishCheck({ configPath, base })), true;
    if (path === '/api/publish') {
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      // Pushing to the internet needs an explicit yes from the page, not just a click that happens to POST here.
      if (body.host === 'github-pages' && body.confirm !== true) return send(res, 400, { error: 'confirm publishing first' }), true;
      return send(res, 200, await publish({ configPath, base, store, host: body.host })), true;
    }

    if (path === '/api/site/theme') {
      if (!writeAllowed(req, port)) return send(res, 403, { error: 'forbidden' }), true;
      const body = await readJSONBody(req);
      const names = (await listThemes(base)).map((t) => t.name);
      const next = applyStyleChange(await loadConfig(configPath), 'adopt', body.id, names);
      await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`);
      return send(res, 200, { ok: true, theme: next.theme }), true;
    }

    send(res, 404, { error: 'unknown route' });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
  return true;
}
