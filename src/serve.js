import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch, existsSync } from 'node:fs';
import { dirname, resolve, extname, relative, isAbsolute, basename, join } from 'node:path';
import { loadConfig, renderHtml } from './build.js';
import { listThemes } from './themes.js';
import { esc } from './util.js';
import { SECTION_IDS, MODES, FONTS } from './style.js';
import { galleryData, galleryPage } from './gallery.js';
import { writeFile } from 'node:fs/promises';

// Changes every time the server starts. Pages compare it on (re)connect and reload when it differs,
// so a tab left open across a restart never keeps running stale code.
export const BOOT = Date.now().toString(36);

// Live-reload snippet shared by every page the dev server makes. `guard` is an optional JS condition that
// blocks the reload (e.g. while the gallery is navigating away).
export function liveReload(guard = 'false') {
  // pageshow.persisted = restored by Back/Forward from the browser's cache, frozen mid-click: reload it fresh.
  return `(()=>{addEventListener('pageshow',e=>{if(e.persisted)location.reload()});const es=new EventSource('/__folio/events');es.addEventListener('boot',e=>{if(e.data!=='${BOOT}'&&!(${guard}))location.reload()});es.onmessage=()=>{if(!(${guard}))location.reload()}})();`;
}

const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.css': 'text/css', '.js': 'text/javascript',
};

function themeOptions(names, current) {
  const generated = names.filter((n) => /^g\d+-\d+-/.test(n));
  const others = names.filter((n) => !generated.includes(n));
  const opt = (n) => `<option value="${esc(n)}"${n === current ? ' selected' : ''}>${esc(n)}</option>`;
  return `<optgroup label="Themes">${others.map(opt).join('')}</optgroup>${generated.length ? `<optgroup label="Generated">${generated.map(opt).join('')}</optgroup>` : ''}`;
}

// Dev-only control bar: theme, color mode, font, section order/visibility. Every click is saved to folio.json.
function devOverlay(p, names) {
  const state = {
    theme: p.theme,
    mode: p.style.mode,
    font: p.style.font,
    order: p.sections ?? SECTION_IDS,
    hidden: p.style.hide,
    custom: Boolean(p.sections),
  };
  const group = (key, label, values, current) =>
    `<div class="g"><span>${label}</span>${values
      .map((v) => `<button data-k="${key}" data-v="${esc(v)}"${v === current ? ' aria-pressed="true"' : ''}>${esc(v)}</button>`)
      .join('')}</div>`;
  return `<div id="folio-dev" role="toolbar" aria-label="folio preview controls">
<div class="g"><span>design</span><select data-sel="theme" aria-label="Design">${themeOptions(names, state.theme)}</select></div>
${group('mode', 'mode', MODES, state.mode)}
${group('font', 'font', FONTS, state.font)}
<div class="g"><button data-panel aria-expanded="false">sections ▾</button><a class="gal" href="/__folio/gallery">gallery ↗</a><button data-min title="Minimize" aria-label="Minimize controls">–</button></div>
<div class="panel" hidden></div>
<button class="pill" data-max aria-label="Show folio controls">✦ folio</button>
</div>
<style>
#folio-dev{position:fixed;left:0;right:0;margin:0 auto;width:max-content;bottom:14px;z-index:2147483000;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;align-items:center;max-width:calc(100vw - 24px);padding:6px;border-radius:16px;background:rgba(17,17,17,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font:500 12.5px/1 ui-sans-serif,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3);color:#ddd}
#folio-dev .g{display:flex;align-items:center;gap:2px;padding:0 4px 0 0;border-right:1px solid #333}
#folio-dev .g:last-of-type{border-right:0}
#folio-dev span{color:#888;padding:0 6px 0 8px}
#folio-dev button{all:unset;cursor:pointer;color:#ddd;padding:7px 10px;border-radius:10px}
#folio-dev button:hover,#folio-dev a.gal:hover{background:#333}
#folio-dev a.gal{color:#c8ff5a;text-decoration:none;padding:7px 10px;border-radius:10px}
#folio-dev button:focus-visible{outline:2px solid #8ab4ff}
#folio-dev button[aria-pressed=true]{background:#fff;color:#111}
#folio-dev .panel{position:absolute;bottom:calc(100% + 8px);right:0;min-width:240px;background:#151515;border-radius:14px;padding:8px;box-shadow:0 10px 40px rgba(0,0,0,.35)}
#folio-dev .row{display:flex;align-items:center;gap:4px;padding:2px 4px}
#folio-dev .row b{flex:1;font-weight:500;padding:6px}
#folio-dev .row.off b{color:#666;text-decoration:line-through}
#folio-dev .panel .hint{color:#777;padding:6px 8px 4px;font-size:11.5px;line-height:1.4}
#folio-dev .busy{opacity:.5;pointer-events:none}
#folio-dev select{all:unset;cursor:pointer;color:#fff;background:#2a2a2a;padding:7px 26px 7px 10px;border-radius:10px;max-width:190px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;background-image:linear-gradient(45deg,transparent 50%,#aaa 50%),linear-gradient(135deg,#aaa 50%,transparent 50%);background-position:calc(100% - 13px) 50%,calc(100% - 9px) 50%;background-size:4px 4px;background-repeat:no-repeat}
#folio-dev select:focus-visible{outline:2px solid #8ab4ff}
#folio-dev select option{color:#111;background:#fff}
#folio-dev.min{padding:4px;border-radius:999px;left:auto;right:14px;margin:0;bottom:54px}
#folio-dev.min>*:not(.pill){display:none}
#folio-dev .pill{display:none}
#folio-dev.min .pill{display:inline-block}
.hello{position:fixed;left:0;right:0;margin:0 auto;bottom:76px;z-index:2147483000;width:min(440px,calc(100vw - 24px));background:#c8ff5a;color:#111;border-radius:16px;padding:16px 18px;font:400 14px/1.5 ui-sans-serif,system-ui,sans-serif;box-shadow:0 14px 50px rgba(0,0,0,.3)}
.hello ul{margin:8px 0 12px;padding-left:18px}.hello code{background:rgba(0,0,0,.08);padding:1px 5px;border-radius:5px}
.hello button{all:unset;cursor:pointer;background:#111;color:#fff;padding:7px 14px;border-radius:10px;font-weight:600}
</style>
<script>(()=>{
const S=${JSON.stringify(state).replace(/</g, '\\u003c')};
const bar=document.getElementById('folio-dev'),panel=bar.querySelector('.panel'),btn=bar.querySelector('[data-panel]');
async function save(key,value){bar.classList.add('busy');
  const r=await fetch('/__folio/style',{method:'POST',headers:{'Content-Type':'application/json','X-Folio':'1'},body:JSON.stringify({key,value})});
  if(!r.ok){bar.classList.remove('busy');alert('folio: '+await r.text());return}
  sessionStorage.setItem('folio-panel',panel.hidden?'':'1');location.href=location.pathname}
bar.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>save(b.dataset.k,b.dataset.v));
bar.querySelector('[data-sel=theme]').onchange=e=>save('theme',e.target.value);
const setMin=m=>{bar.classList.toggle('min',m);try{localStorage.setItem('folio-min',m?'1':'')}catch{}};
bar.querySelector('[data-min]').onclick=()=>setMin(true);bar.querySelector('[data-max]').onclick=()=>setMin(false);
try{if(localStorage.getItem('folio-min'))setMin(true)}catch{}
function draw(){panel.innerHTML='<div class="hint">Order and visibility of sections. Saved to folio.json → style.</div>'+S.order.map((id,i)=>{const off=S.hidden.includes(id);
  return '<div class="row'+(off?' off':'')+'"><b>'+id+'</b><button data-up="'+i+'" title="Move up">↑</button><button data-dn="'+i+'" title="Move down">↓</button><button data-eye="'+id+'" title="'+(off?'Show':'Hide')+'">'+(off?'show':'hide')+'</button></div>'}).join('')+
  (S.custom?'<div class="row"><button data-reset>reset to theme order</button></div>':'');
  panel.querySelectorAll('[data-up],[data-dn]').forEach(b=>b.onclick=()=>{const i=+(b.dataset.up??b.dataset.dn),j=b.dataset.up!=null?i-1:i+1;if(j<0||j>=S.order.length)return;
    const o=S.order.slice();[o[i],o[j]]=[o[j],o[i]];save('sections',o)});
  panel.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>{const id=b.dataset.eye;save('hide',S.hidden.includes(id)?S.hidden.filter(x=>x!==id):[...S.hidden,id])});
  const r=panel.querySelector('[data-reset]');if(r)r.onclick=()=>save('sections',null)}
btn.onclick=()=>{panel.hidden=!panel.hidden;btn.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)draw()};
if(sessionStorage.getItem('folio-panel')){sessionStorage.removeItem('folio-panel');panel.hidden=false;btn.setAttribute('aria-expanded','true');draw()}
const adopted=new URLSearchParams(location.search).get('adopted');
if(adopted){const n=document.createElement('div');n.className='hello';n.setAttribute('role','status');
  n.innerHTML='<b>✓ This is your site now.</b> Saved to folio.json.<ul><li>Quick tweaks: the bar below (mode, font, section order)</li><li>Bigger changes: tell your agent, e.g. <i>“make the name bigger, less blue”</i></li><li>Publish: <code>folio deploy</code></li></ul><button>Got it</button>';
  n.querySelector('b').append(' ');n.querySelector('button').onclick=()=>{n.remove();history.replaceState(null,'',location.pathname)};bar.before(n)}
${liveReload()}
})()</script>`;
}

// Apply one control-bar change to the raw folio.json object. Only known keys and values get through.
export function applyStyleChange(raw, key, value, themeNames) {
  const next = structuredClone(raw);
  const style = { ...(next.style ?? {}) };
  if (key === 'theme' || key === 'adopt') {
    if (!themeNames.includes(value)) throw new Error(`unknown theme "${value}"`);
    next.theme = value;
    // "adopt" = picked from the gallery: the user wants it as designed, so drop look overrides
    // (content choices like section order and hidden sections stay).
    if (key === 'adopt') {
      delete style.mode;
      delete style.font;
    }
  } else if (key === 'mode' || key === 'font') {
    const allowed = key === 'mode' ? MODES : FONTS;
    if (!allowed.includes(value)) throw new Error(`style.${key} must be one of ${allowed.join(', ')}`);
    style[key] = value;
  } else if (key === 'sections' || key === 'hide') {
    if (value === null) delete style[key];
    else if (!Array.isArray(value) || value.some((v) => !SECTION_IDS.includes(v))) throw new Error(`style.${key} must list sections from ${SECTION_IDS.join(', ')}`);
    else style[key] = [...new Set(value)];
  } else {
    throw new Error(`can't change "${key}" from the preview`);
  }
  // Keep folio.json tidy: drop defaults instead of writing them out.
  if (style.mode === 'auto') delete style.mode;
  if (style.font === 'theme') delete style.font;
  if (Array.isArray(style.hide) && !style.hide.length) delete style.hide;
  if (Object.keys(style).length) next.style = style;
  else delete next.style;
  return next;
}

async function readBody(req, limit = 10_000) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Error('request too large');
  }
  return body;
}

function errorPage(message) {
  return `<!doctype html><meta charset="utf-8"><title>folio — error</title>
<body style="font:15px/1.6 ui-monospace,monospace;background:#1a0f0f;color:#fecaca;padding:40px">
<h1 style="font-size:18px;color:#f87171">folio couldn't render your site</h1><pre style="white-space:pre-wrap">${esc(message)}</pre>
<p style="color:#a8a29e">Fix folio.json and save — this page reloads automatically.</p>
<script>${liveReload()}</script></body>`;
}

export async function serve({ config = 'folio.json', port = 4321, theme } = {}) {
  const configPath = resolve(config);
  const base = dirname(configPath);
  const clients = new Set();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/__folio/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`event: boot\ndata: ${BOOT}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (url.pathname === '/__folio/style') {
      // Writes to the user's folio.json, so only accept same-origin requests from the control bar:
      // POST + JSON + a custom header forces a CORS preflight no other site can pass, and Origin must be us.
      const origin = req.headers.origin;
      const ours = !origin || origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
      if (req.method !== 'POST' || req.headers['x-folio'] !== '1' || !String(req.headers['content-type']).startsWith('application/json') || !ours) {
        res.writeHead(403, { 'Content-Type': 'text/plain' }).end('forbidden');
        return;
      }
      try {
        const { key, value } = JSON.parse(await readBody(req));
        const names = (await listThemes(base)).map((t) => t.name);
        const next = applyStyleChange(await loadConfig(configPath), key, value, names);
        await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`);
        res.writeHead(204).end();
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' }).end(e.message);
      }
      return;
    }

    if (url.pathname === '/__folio/gallery') {
      try {
        const raw = await loadConfig(configPath);
        const data = await galleryData(base, url.searchParams.get('run'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(galleryPage(data, { name: raw.name ?? '', current: raw.theme }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(errorPage(e.message));
      }
      return;
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const chosen = url.searchParams.get('theme') || theme;
      try {
        const raw = await loadConfig(configPath);
        // The URL can only pick a listed theme by name, never an arbitrary file path.
        const names = (await listThemes(base)).map((t) => t.name);
        if (url.searchParams.has('theme') && !names.includes(chosen)) throw new Error(`Unknown theme "${chosen}". Available: ${names.join(', ')}`);
        const embed = url.searchParams.get('embed') === '1';
        const { html, profile } = await renderHtml(raw, { theme: chosen, baseDir: base, pure: embed });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        // ?embed=1 is the gallery's iframes: the bare site as designed, no control bar.
        res.end(embed ? html : html.replace(/<\/body>\s*<\/html>\s*$/, `${devOverlay(profile, names)}\n</body>\n</html>\n`));
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
  const watchers = [
    watch(base, (_, name) => {
      if (!name || name === basename(configPath) || TYPES[extname(String(name)).toLowerCase()]) notify();
    }),
  ];
  const themeDir = join(base, 'themes');
  if (existsSync(themeDir)) watchers.push(watch(themeDir, notify));

  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', ok);
  });
  const close = () => {
    clearTimeout(timer);
    watchers.forEach((w) => w.close());
    clients.forEach((c) => c.end());
    server.close();
  };
  return { url: `http://localhost:${port}`, close };
}
