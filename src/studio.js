// Folio Studio: the Library and Design screens. Talks to folio only through /api (see api.js).
// Design previews render in sandboxed iframes (scripts allowed, no same-origin), so generated theme code can't
// reach Studio, its cookies or its API. All text is inserted with textContent, never innerHTML.

const CSS = `
:root{--bg:#f6f6f3;--side:#fbfbf9;--card:#fff;--line:#e4e4de;--line2:#d8d8d2;--ink:#17171a;--mute:#6b6b70;--acc:#2f3fe0;--acc-ink:#fff;--lime:#c8ff5a;--ok:#18864b;--warn:#b45309}
@media (prefers-color-scheme:dark){:root{--bg:#111113;--side:#16161a;--card:#1b1b1f;--line:#2a2a30;--line2:#3a3a42;--ink:#f1f1ee;--mute:#a1a1a8;--acc:#7c8cff;--acc-ink:#0b0b0d;--ok:#4fbf7d;--warn:#f5b04a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 15px/1.5 "Geist",ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--acc)}
:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.app{display:flex;flex-wrap:wrap;min-height:100vh}
nav.side{flex:1 1 220px;max-width:248px;padding:24px 16px;border-right:1px solid var(--line);background:var(--side);display:flex;flex-direction:column;gap:22px}
.logo{display:flex;align-items:center;gap:8px;font-weight:600;font-size:17px;padding:0 8px}
.logo span{font:500 11px "Geist Mono",monospace;color:var(--mute);border:1px solid var(--line);border-radius:6px;padding:2px 6px}
.who{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.who .av{width:30px;height:30px;border-radius:9px;background:var(--lime);color:#111;display:grid;place-items:center;font-weight:600;flex:none}
.who small{display:block;color:var(--mute);font-size:12.5px}
.nav{display:flex;flex-direction:column;gap:2px}
.nav a,.nav span{display:flex;justify-content:space-between;padding:9px 10px;border-radius:10px;color:var(--ink);text-decoration:none}
.nav a[aria-current]{background:var(--ink);color:var(--bg);font-weight:500}
.nav span{color:var(--mute)}
.nav a:hover:not([aria-current]){background:var(--line)}
main{flex:999 1 560px;min-width:0;padding:36px 44px 72px;display:flex;flex-direction:column;gap:26px}
h1{margin:0;font:400 clamp(2.4rem,5vw,3.5rem)/1 "Instrument Serif",Georgia,serif;letter-spacing:-.01em}
h2{margin:0;font:400 30px/1.1 "Instrument Serif",Georgia,serif}
.sub{margin:8px 0 0;color:var(--mute)}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.between{justify-content:space-between}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 14px;border-radius:11px;border:1px solid var(--line2);background:var(--card);color:var(--ink);font:inherit;font-size:14px;text-decoration:none;cursor:pointer}
.btn:hover{border-color:var(--ink)}
.btn.pri{background:var(--acc);border-color:var(--acc);color:var(--acc-ink);font-weight:500}
.btn.dark{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.btn.lime{background:var(--lime);border-color:var(--lime);color:#111;font-weight:500}
.btn[disabled]{opacity:.4;cursor:not-allowed}
.chip{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line2);background:var(--card);color:var(--ink);font:inherit;font-size:14px;cursor:pointer}
.chip[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.live{display:flex;flex-wrap:wrap;align-items:center;gap:20px;padding:16px 18px;border-radius:16px;background:#17171a;color:#fff}
.live .k{font:500 12px "Geist Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--lime)}
.live .t{font-size:20px;font-weight:600}
.live .d{color:#b9b9be;font-size:14px}
.thumb{position:relative;width:100%;aspect-ratio:16/10;overflow:hidden;background:#ececE6;border-bottom:1px solid var(--line)}
.thumb iframe{position:absolute;left:0;top:0;width:1440px;height:900px;border:0;transform-origin:0 0;pointer-events:none}
.live .thumb{width:176px;border-radius:10px;border:0;flex:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.card.cur{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
.card.arch{opacity:.55}
.card .body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1}
.card .top{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.card b{font-weight:600}
.mono{font:500 12px "Geist Mono",monospace;color:var(--mute)}
.desc{font-size:13.5px;color:var(--mute);min-height:2.6em}
.badges{display:flex;flex-wrap:wrap;gap:6px}
.badge{font:500 11.5px "Geist Mono",monospace;padding:2px 8px;border-radius:999px;background:var(--line);color:var(--ink)}
.badge.mine{background:var(--lime);color:#111}
.badge.pend{background:#fff3db;color:#8a5a00}
.badge.wild{background:#ffe7e3;color:#b42318}
.acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:6px}
.acts .btn{min-height:36px;padding:0 10px;font-size:13.5px}
.star[aria-pressed=true]{color:#c98a00;border-color:#c98a00}
.section{display:flex;flex-direction:column;gap:14px}
.section .h{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px}
.empty{padding:28px;border:1px dashed var(--line2);border-radius:16px;color:var(--mute);text-align:center}
.split{display:flex;flex-wrap:wrap;gap:24px;align-items:start}
.stage{flex:999 1 620px;min-width:0;display:flex;flex-direction:column;gap:12px}
.frame{background:var(--line);border-radius:18px;padding:18px;display:flex;justify-content:center}
.frame .win{width:100%;max-width:1000px;border-radius:12px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.15);background:#fff;position:relative}
.frame.phone .win{max-width:390px}
.frame iframe{display:block;width:100%;height:640px;border:0}
.frame.phone iframe{height:780px}
aside.panel{flex:1 1 340px;min-width:0;max-width:440px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:16px}
.hist{list-style:none;margin:0;padding:0}
.hist li{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);font-size:14px}
.hist li[aria-current=true]{background:linear-gradient(90deg,transparent,rgba(47,63,224,.06))}
.hist button.v{all:unset;cursor:pointer;font:600 13px "Geist Mono",monospace}
.hist small{display:block;color:var(--mute);font-size:12.5px}
.seg{display:flex;gap:4px;background:var(--line);padding:4px;border-radius:12px}
.seg button{min-height:34px;padding:0 12px;border-radius:9px;border:0;background:transparent;color:var(--ink);font:inherit;font-size:14px;cursor:pointer}
.seg button[aria-pressed=true]{background:var(--card)}
.toast{position:fixed;left:0;right:0;margin:0 auto;width:max-content;max-width:calc(100vw - 32px);bottom:24px;background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:12px;font-weight:500;opacity:0;transform:translateY(16px);transition:all .25s;pointer-events:none}
.toast.on{opacity:1;transform:none}
@media (max-width:760px){main{padding:24px 16px 60px}nav.side{max-width:none;border-right:0;border-bottom:1px solid var(--line)}}
@media (prefers-reduced-motion:reduce){.toast{transition:none}}
`;

// Client code: plain DOM building, no innerHTML for data.
const JS = String.raw`
const $ = (sel, el = document) => el.querySelector(sel);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const toastEl = $('.toast');
function toast(t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 2000); }
async function api(path, body) {
  const opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Folio': '1' }, body: JSON.stringify(body) } : {};
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}
// Live preview thumbnail: the real site, sandboxed, scaled down to fit.
function thumb(id, v) {
  const box = h('div', { class: 'thumb' });
  const src = '/preview/' + encodeURIComponent(id) + (v ? '?v=' + v : '');
  const f = h('iframe', { src, sandbox: 'allow-scripts', loading: 'lazy', tabindex: '-1', title: id + ' preview', 'aria-hidden': 'true' });
  box.append(f);
  const fit = () => { f.style.transform = 'scale(' + (box.clientWidth / 1440) + ')'; };
  new ResizeObserver(fit).observe(box);
  return box;
}
const titleOf = (d) => d.label || (d.direction ? d.direction.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()) : d.id);
const ago = (iso) => { const s = (Date.now() - new Date(iso)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };

let state = { filter: 'all' };
const params = new URLSearchParams(location.search);

async function useDesign(id) {
  await api('/api/site/theme', { id });
  toast('Your site now uses ' + id);
  await refresh();
}
async function flag(id, f, value) {
  await api('/api/designs/' + encodeURIComponent(id) + '/flag', { flag: f, value });
  toast(f === 'favorite' ? (value ? 'Added to favorites' : 'Removed from favorites') : (value ? 'Archived. Find it under Archived' : 'Restored to the library'));
  await refresh();
}
function copy(text, hint) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(hint), () => toast(text));
}

function card(d) {
  const open = '/studio?d=' + encodeURIComponent(d.id);
  return h('article', { class: 'card' + (d.current ? ' cur' : '') + (d.archived ? ' arch' : '') },
    d.missing ? h('div', { class: 'thumb' }) : thumb(d.id),
    h('div', { class: 'body' },
      h('div', { class: 'top' }, h('b', null, titleOf(d)), h('span', { class: 'mono' }, d.latest ? 'v' + d.latest : '')),
      h('div', { class: 'badges' },
        d.current && h('span', { class: 'badge mine' }, '★ your site'),
        d.pending && h('span', { class: 'badge pend' }, 'designing…'),
        d.wildcard && h('span', { class: 'badge wild' }, 'wildcard'),
        d.missing && h('span', { class: 'badge pend' }, 'file missing · restorable'),
        d.versions > 1 && h('span', { class: 'badge' }, d.versions + ' versions')),
      h('p', { class: 'desc', style: 'margin:0' }, d.pending ? 'An agent is designing this one.' : (d.description || 'No description yet.')),
      h('div', { class: 'acts' },
        h('a', { class: 'btn dark', href: open }, 'Open'),
        !d.current && h('button', { class: 'btn', type: 'button', disabled: d.pending || d.missing, onclick: () => useDesign(d.id).catch((e) => toast(e.message)) }, 'Make my site'),
        h('button', { class: 'btn star', type: 'button', 'aria-pressed': String(!!d.favorite), 'aria-label': (d.favorite ? 'Unfavorite ' : 'Favorite ') + d.id, onclick: () => flag(d.id, 'favorite', !d.favorite) }, d.favorite ? '★' : '☆'),
        h('button', { class: 'btn', type: 'button', onclick: () => flag(d.id, 'archived', !d.archived) }, d.archived ? 'Unarchive' : 'Archive'))));
}

function renderLibrary(lib) {
  const main = $('main');
  main.replaceChildren();
  const first = (lib.profile.name || 'Your').split(/\s+/)[0];
  const visible = lib.designs.filter((d) => state.filter === 'archived' ? d.archived : state.filter === 'favorites' ? d.favorite && !d.archived : !d.archived);
  const built = lib.designs.filter((d) => !d.pending && !d.archived).length;
  main.append(
    h('header', { class: 'row between' },
      h('div', null, h('h1', null, first + "'s designs"),
        h('p', { class: 'sub' }, lib.designs.length + ' designs · ' + built + ' ready · ' + lib.runs.length + ' rounds · nothing is ever deleted')),
      h('div', { class: 'row' },
        h('button', { class: 'btn pri', type: 'button', onclick: () => copy('generate designs for my portfolio', 'Copied. Paste it to your agent (it runs: folio generate)') }, 'Explore new designs'))));

  const cur = lib.designs.find((d) => d.current) || null;
  const curBuiltin = !cur && lib.current ? lib.builtins.find((b) => b.id === lib.current) : null;
  if (cur || curBuiltin) {
    const id = cur ? cur.id : curBuiltin.id;
    main.append(h('section', { class: 'live', 'aria-label': 'Your site' },
      thumb(id),
      h('div', { style: 'flex:1 1 260px;min-width:0' },
        h('div', { class: 'k' }, lib.publishes.length ? '● live' : '● your site'),
        h('div', { class: 't' }, (lib.profile.url ? lib.profile.url.replace(/^https?:\/\//, '') + ' · ' : '') + (cur ? titleOf(cur) + (cur.latest ? ' v' + cur.latest : '') : id + ' (built-in)')),
        h('div', { class: 'd' }, lib.publishes.length ? 'Last published ' + ago(lib.publishes[0].at) : 'Not published yet · run folio deploy when you are ready')),
      h('div', { class: 'row' },
        cur && h('a', { class: 'btn', href: '/studio?d=' + encodeURIComponent(id) }, 'Open design'),
        h('a', { class: 'btn lime', href: '/', target: '_blank', rel: 'noopener' }, 'View site ↗'))));
  }

  const counts = { all: lib.designs.filter((d) => !d.archived).length, favorites: lib.designs.filter((d) => d.favorite && !d.archived).length, archived: lib.designs.filter((d) => d.archived).length };
  main.append(h('div', { class: 'row', role: 'group', 'aria-label': 'Filter' },
    [['all', 'All'], ['favorites', '★ Favorites'], ['archived', 'Archived']].map(([k, label]) =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.filter === k), onclick: () => { state.filter = k; renderLibrary(lib); } }, label + ' ' + counts[k]))));

  if (!lib.designs.length) {
    main.append(h('div', { class: 'empty' }, 'No designs yet. Ask your agent to "generate designs for my portfolio", or run folio generate. They appear here live as they land.'));
  }
  const groups = [];
  for (const r of lib.runs) groups.push({ title: r.parent ? 'Round ' + r.run + ' · More like ' + r.parent : 'Round ' + r.run + ' · ' + r.count + ' directions', note: r.keep ? 'kept: ' + r.keep : '', items: visible.filter((d) => d.run === r.run) });
  groups.push({ title: 'Your own designs', note: 'made with folio theme new or by hand', items: visible.filter((d) => d.run == null) });
  for (const g of groups) {
    if (!g.items.length) continue;
    main.append(h('section', { class: 'section' }, h('div', { class: 'h' }, h('h2', null, g.title), h('span', { class: 'mono' }, g.note)), h('div', { class: 'grid' }, g.items.map(card))));
  }
  if (!visible.length && lib.designs.length) main.append(h('div', { class: 'empty' }, state.filter === 'favorites' ? 'No favorites yet. Star a design to keep it close.' : 'Nothing archived.'));

  main.append(h('section', { class: 'section' }, h('div', { class: 'h' }, h('h2', null, 'Built-in themes'), h('span', { class: 'mono' }, 'starting points')),
    h('div', { class: 'grid' }, lib.builtins.map((b) => h('article', { class: 'card' + (lib.current === b.id ? ' cur' : '') }, thumb(b.id),
      h('div', { class: 'body' }, h('b', null, b.id), h('p', { class: 'desc', style: 'margin:0' }, b.description),
        h('div', { class: 'acts' }, lib.current === b.id ? h('span', { class: 'badge mine' }, '★ your site') : h('button', { class: 'btn', type: 'button', onclick: () => useDesign(b.id).catch((e) => toast(e.message)) }, 'Make my site'))))))));
}

async function renderDesign(id) {
  const [d, lib] = await Promise.all([api('/api/designs/' + encodeURIComponent(id)), api('/api/library')]);
  const info = lib.designs.find((x) => x.id === id) || {};
  const main = $('main');
  const sel = state.v && d.versions.some((v) => v.n === state.v) ? state.v : (d.versions[0] ? d.versions[0].n : null);
  const latest = d.versions[0] ? d.versions[0].n : null;
  const device = state.device || 'desk';
  main.replaceChildren(
    h('header', { class: 'row between' },
      h('div', null,
        h('a', { href: '/studio' }, '← Library'),
        h('h1', { style: 'margin-top:6px' }, titleOf(info.id ? info : d)),
        h('p', { class: 'sub' }, (info.description || '') + (d.parent ? ' · branched from ' + d.parent : ''))),
      h('div', { class: 'row' },
        info.current ? h('span', { class: 'badge mine' }, '★ your site') : h('button', { class: 'btn pri', type: 'button', disabled: info.pending, onclick: () => useDesign(id).catch((e) => toast(e.message)) }, 'Make my site'),
        h('button', { class: 'btn', type: 'button', onclick: () => copy('More like ' + id + ', keep the overall vibe', 'Copied. Paste it to your agent (it runs: folio generate --like ' + id + ')') }, 'More like this'),
        h('button', { class: 'btn star', type: 'button', 'aria-pressed': String(!!d.favorite), onclick: () => flag(id, 'favorite', !d.favorite) }, d.favorite ? '★ Favorite' : '☆ Favorite'),
        h('a', { class: 'btn', href: '/preview/' + encodeURIComponent(id) + (sel && sel !== latest ? '?v=' + sel : ''), target: '_blank', rel: 'noopener' }, 'Open full ↗'))),
    h('div', { class: 'split' },
      h('section', { class: 'stage', 'aria-label': 'Preview' },
        h('div', { class: 'row between' },
          h('div', { class: 'seg', role: 'group', 'aria-label': 'Device' },
            h('button', { type: 'button', 'aria-pressed': String(device === 'desk'), onclick: () => { state.device = 'desk'; renderDesign(id); } }, 'Desktop'),
            h('button', { type: 'button', 'aria-pressed': String(device === 'phone'), onclick: () => { state.device = 'phone'; renderDesign(id); } }, 'Phone')),
          h('span', { class: 'mono' }, sel ? (sel === latest ? 'showing v' + sel + ' (latest)' : 'showing v' + sel + ' · not the latest') : 'no versions yet')),
        h('div', { class: 'frame' + (device === 'phone' ? ' phone' : '') },
          h('div', { class: 'win' }, h('iframe', { src: '/preview/' + encodeURIComponent(id) + (sel && sel !== latest ? '?v=' + sel : ''), sandbox: 'allow-scripts', title: id + ' preview' })))),
      h('aside', { class: 'panel', 'aria-label': 'History' },
        h('div', null, h('b', null, 'History'), h('p', { class: 'sub', style: 'margin:2px 0 0;font-size:13.5px' }, 'Every change is a version. Restoring adds a new version on top, so nothing is lost.')),
        d.versions.length ? h('ol', { class: 'hist' }, d.versions.map((v) => h('li', { 'aria-current': String(v.n === sel) },
          h('button', { class: 'v', type: 'button', onclick: () => { state.v = v.n; renderDesign(id); }, 'aria-label': 'Preview version ' + v.n }, 'v' + v.n),
          h('span', null, v.note, h('small', null, ago(v.at))),
          v.n === latest ? h('span', { class: 'mono' }, 'latest') : h('button', { class: 'btn', type: 'button', onclick: async () => { try { const r = await api('/api/designs/' + encodeURIComponent(id) + '/restore', { n: v.n }); state.v = null; toast('Restored v' + v.n + ' as v' + r.version); renderDesign(id); } catch (e) { toast(e.message); } } }, 'Restore')))) : h('p', { class: 'sub' }, 'No versions yet: this design is still being made.'),
        d.children.length ? h('div', null, h('b', null, 'Branches'), h('p', { class: 'sub', style: 'margin:4px 0 0' }, d.children.map((c, i) => [i ? ', ' : '', h('a', { href: '/studio?d=' + encodeURIComponent(c) }, c)]))) : null,
        h('button', { class: 'btn', type: 'button', onclick: () => flag(id, 'archived', !d.archived).then(() => renderDesign(id)) }, d.archived ? 'Unarchive' : 'Archive'))));
}

async function refresh() {
  try {
    if (params.get('d')) await renderDesign(params.get('d'));
    else renderLibrary(await api('/api/library'));
  } catch (e) { $('main').replaceChildren(h('div', { class: 'empty' }, 'Could not load: ' + e.message)); }
}
refresh();
// Designs landing from agents refresh the view in place (no full reload, so filters and selection stay).
const es = new EventSource('/__folio/events');
es.addEventListener('boot', (e) => { if (e.data !== window.__boot) location.reload(); });
es.onmessage = () => refresh();
addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });
`;

export function studioPage({ boot }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Folio Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<style>${CSS}</style></head><body>
<div class="app">
  <nav class="side" aria-label="Folio">
    <div class="logo">✦ folio <span>studio</span></div>
    <div class="nav">
      <a href="/studio" aria-current="page">Library</a>
      <a href="/" target="_blank" rel="noopener">My site ↗</a>
      <a href="/__folio/gallery">Gallery</a>
      <span>Explore <small>soon</small></span>
      <span>Publish <small>soon</small></span>
    </div>
  </nav>
  <main></main>
</div>
<div class="toast" role="status" aria-live="polite"></div>
<script>window.__boot=${JSON.stringify(boot)};${JS}</script>
</body></html>`;
}

