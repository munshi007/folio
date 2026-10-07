import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch, existsSync } from 'node:fs';
import { dirname, resolve, extname, relative, isAbsolute, basename, join } from 'node:path';
import { loadConfig, renderHtml } from './build.js';
import { listThemes } from './themes.js';
import { esc } from './util.js';

const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.css': 'text/css', '.js': 'text/javascript',
};

// Dev-only overlay: theme switcher + live reload over SSE.
function devOverlay(current, names) {
  const opts = names
    .map((t) => `<a href="?theme=${encodeURIComponent(t)}"${t === current ? ' aria-current="true"' : ''}>${esc(t)}</a>`)
    .join('');
  return `<div id="folio-dev"><span>theme</span>${opts}</div>
<style>#folio-dev{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:99;display:flex;gap:4px;align-items:center;padding:5px;border-radius:999px;background:rgba(17,17,17,.88);backdrop-filter:blur(10px);font:500 12.5px/1 ui-sans-serif,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25)}
#folio-dev span{color:#888;padding:0 8px 0 10px}#folio-dev a{color:#ddd;text-decoration:none;padding:7px 12px;border-radius:999px;border:0}#folio-dev a:hover{background:#333}#folio-dev a[aria-current]{background:#fff;color:#111}</style>
<script>new EventSource('/__folio/events').onmessage=()=>location.reload()</script>`;
}

function errorPage(message) {
  return `<!doctype html><meta charset="utf-8"><title>folio — error</title>
<body style="font:15px/1.6 ui-monospace,monospace;background:#1a0f0f;color:#fecaca;padding:40px">
<h1 style="font-size:18px;color:#f87171">folio couldn't render your site</h1><pre style="white-space:pre-wrap">${esc(message)}</pre>
<p style="color:#a8a29e">Fix folio.json and save — this page reloads automatically.</p>
<script>new EventSource('/__folio/events').onmessage=()=>location.reload()</script></body>`;
}

export async function serve({ config = 'folio.json', port = 4321, theme } = {}) {
  const configPath = resolve(config);
  const base = dirname(configPath);
  const clients = new Set();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/__folio/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const chosen = url.searchParams.get('theme') || theme;
      try {
        const raw = await loadConfig(configPath);
        // The URL can only pick a listed theme by name, never an arbitrary file path.
        const names = (await listThemes(base)).map((t) => t.name);
        if (url.searchParams.has('theme') && !names.includes(chosen)) throw new Error(`Unknown theme "${chosen}". Available: ${names.join(', ')}`);
        const { html, profile } = await renderHtml(raw, { theme: chosen, baseDir: base });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html.replace('</body>', `${devOverlay(profile.theme, names)}\n</body>`));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(errorPage(e.message));
      }
      return;
    }

    // Static assets from the project folder only (avatar, screenshots). No dotfiles, no traversal.
    const file = resolve(base, decodeURIComponent(url.pathname).replace(/^\/+/, ''));
    const rel = relative(base, file);
    if (rel.startsWith('..') || isAbsolute(rel) || rel.split(/[\\/]/).some((s) => s.startsWith('.')) || !TYPES[extname(file).toLowerCase()]) {
      res.writeHead(404).end('not found');
      return;
    }
    try {
      if (!(await stat(file)).isFile()) throw new Error();
      res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end('not found');
    }
  });

  let timer;
  const notify = () => {
    clearTimeout(timer);
    timer = setTimeout(() => clients.forEach((c) => c.write('data: reload\n\n')), 80);
  };
  // Watch the folder, not the file: editors often replace files atomically, which kills a file watcher.
  watch(base, (_, name) => {
    if (!name || name === basename(configPath) || TYPES[extname(String(name)).toLowerCase()]) notify();
  });
  const themeDir = join(base, 'themes');
  if (existsSync(themeDir)) watch(themeDir, notify);

  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', ok);
  });
  return { url: `http://localhost:${port}`, close: () => server.close() };
}
