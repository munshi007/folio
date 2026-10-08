// Studio's JSON API. The Studio UI talks to folio only through these routes (never the filesystem), so the
// same UI can later sit in front of a hosted backend.
//
//   GET  /api/library                      every design, run and publish
//   GET  /api/designs/:id                  one design: record, versions (newest first), children
//   POST /api/designs/:id/restore {n}      restore version n (adds a new version)
//   POST /api/designs/:id/flag {flag,value} favorite | archived
//   POST /api/site/theme {id}              make a design the site's design (as designed: look overrides dropped)
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
  if (!path.startsWith('/api/') && !path.startsWith('/preview/')) return false;
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

    if (req.method === 'GET' && path === '/api/library') {
      const raw = await loadConfig(configPath);
      const builtinList = Object.values(builtins).map((t) => ({ id: t.meta.name, description: t.meta.description }));
      const lib = await getLibrary(store, { current: raw.theme ?? null, builtins: builtinList });
      const p = normalize(raw);
      lib.profile = { name: p.name, headline: p.headline, projects: p.projects.length, roles: p.experience.length, url: p.url || null };
      return send(res, 200, lib), true;
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
