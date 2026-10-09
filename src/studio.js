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
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;display:flex;flex-direction:column}
.card>.thumb,.card>.waiting{border-radius:15px 15px 0 0}
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
.jobs{display:flex;flex-direction:column;gap:12px}
.job{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:10px}
.job .bar{display:flex;gap:4px;height:8px}
.job .bar i{flex:1;border-radius:4px;background:var(--line)}
.job .bar i.designed{background:var(--ok)}.job .bar i.working{background:var(--acc);animation:pulse 1.2s infinite}.job .bar i.failed{background:#d4462f}
@keyframes pulse{50%{opacity:.45}}
.agentbox{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--bg);font-size:14px}
.agentbox code{font:500 13px "Geist Mono",monospace;background:var(--card);border:1px solid var(--line);padding:4px 8px;border-radius:8px}
.newrun{background:var(--card);border:1px solid var(--acc);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.badge.work{background:#e9ecff;color:#1d2aa8}
.pcard{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:6px 20px 16px}
.trait{display:grid;grid-template-columns:120px minmax(0,1fr);gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}
.trait:last-child{border-bottom:0}
.trait .k{font:500 12px "Geist Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);padding-top:3px}
.trait .v{font-size:17px;font-weight:600}
.trait q{display:block;color:var(--mute);font-style:italic;font-size:14px}
.trait small{font:500 11.5px "Geist Mono",monospace;color:var(--mute)}
.dial{display:grid;grid-template-columns:110px minmax(0,1fr) 28px;gap:10px;align-items:center;font-size:14px}
.dial input{width:100%;accent-color:var(--acc)}
.box{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.cols{display:flex;flex-wrap:wrap;gap:20px;align-items:start}
.cols>*{flex:1 1 340px;min-width:0}
.cols>.wide{flex:3 1 460px}
.ref{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.ref.hid{opacity:.5}
.ref .sw{display:flex;height:56px}.ref .sw i{flex:1}
.ref .body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;font-size:14px}
.ref ul{margin:0;padding-left:18px;color:var(--mute)}
.sk .thumb{border-bottom:1px solid var(--line)}
.sk.liked{border-color:#9ad72a;box-shadow:0 0 0 1px #9ad72a}
.sk.skipped{opacity:.45}
.buildbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-radius:16px;background:#17171a;color:#fff}
.cmp{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px}
.swatches{display:flex;gap:6px}.swatches i{width:26px;height:26px;border-radius:7px;border:1px solid var(--line)}
.mixrow{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;align-items:center}
.cmpbar{position:sticky;bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:14px;background:var(--ink);color:var(--bg)}
.checks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.checks li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;font-size:14.5px}
.checks .ok{color:var(--ok)}.checks .warn{color:var(--warn)}.checks .error{color:#d4462f}
.field{display:flex;flex-direction:column;gap:4px;font-size:13.5px;color:var(--mute);min-width:0}
.field input,.field textarea{font:inherit;font-size:15px;color:var(--ink);background:var(--card);border:1px solid var(--line2);border-radius:10px;padding:8px 10px;min-height:40px;width:100%}
.field textarea{resize:vertical;min-height:80px}
.field input[type=checkbox]{width:20px;height:20px;min-height:0;padding:0;flex:none;accent-color:var(--ink)}
.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px}
.item{border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg)}
.item.compact{flex-direction:row;align-items:flex-end;flex-wrap:wrap}.item.compact>.fgrid{flex:1 1 320px}
.errs{border-radius:12px;padding:12px 14px;font-size:14px}
.errs.bad{background:#fde8e4;color:#8a1c0c}.errs.note{background:#fff6e0;color:#6b4a00}
.savebar{position:sticky;bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:14px;background:var(--ink);color:var(--bg)}
.kit{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:14px;align-items:end}
.kit a{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:var(--ink);font-size:13.5px}
.kit img{width:100%;height:auto;max-height:260px;object-fit:contain;object-position:left top;border-radius:10px;border:1px solid var(--line);background:var(--card)}
.kit .pdf{aspect-ratio:16/10;display:grid;place-items:center;border-radius:10px;border:1px solid var(--line);background:var(--card);font-weight:600}
.steps{display:flex;flex-direction:column;gap:2px}
.steps a{display:grid;grid-template-columns:26px minmax(0,1fr);gap:10px;align-items:center;padding:9px 10px;border-radius:10px;color:var(--ink);text-decoration:none}
.steps a i{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--line2);display:grid;place-items:center;font:600 12px "Geist Mono",monospace;font-style:normal;color:var(--mute)}
.steps a.done i{background:var(--ok);border-color:var(--ok);color:#fff}
.steps a[aria-current]{background:var(--ink);color:var(--bg)}.steps a[aria-current] i{border-color:var(--bg);color:var(--bg)}
.steps a[aria-current].done i{border-color:var(--ok)}
.steps a:hover:not([aria-current]){background:var(--line)}
.steps small{display:block;font-size:12px;color:var(--mute)}.steps a[aria-current] small{color:inherit;opacity:.7}
.sidefoot{margin-top:auto;display:flex;flex-direction:column;gap:4px}
.sidefoot a,.sidefoot button{all:unset;cursor:pointer;padding:7px 10px;border-radius:9px;font-size:14px;color:var(--mute)}
.sidefoot a:hover,.sidefoot button:hover{background:var(--line);color:var(--ink)}
.activity{border:1px solid var(--line);border-radius:12px;background:var(--card);font-size:13.5px}
.activity summary{cursor:pointer;padding:10px 12px;list-style:none;display:flex;gap:8px;align-items:center}
.activity summary::-webkit-details-marker{display:none}
.activity .dot{width:8px;height:8px;border-radius:50%;background:var(--acc);animation:pulse 1.2s infinite;flex:none}
.activity .inner{padding:0 12px 12px;display:flex;flex-direction:column;gap:10px}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line)}
.tabs a{padding:10px 14px;color:var(--mute);text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs a[aria-current]{color:var(--ink);border-color:var(--ink);font-weight:500}
.nextbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:16px 18px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
.card .thumb{cursor:pointer}
.card .waiting{display:grid;place-items:center;aspect-ratio:16/10;background:repeating-linear-gradient(-45deg,var(--bg) 0 12px,var(--card) 12px 24px);color:var(--mute);font-size:14px;border-bottom:1px solid var(--line)}
.desc.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.iconbtn{all:unset;cursor:pointer;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;border:1px solid var(--line2);font-size:16px}
.iconbtn:hover{border-color:var(--ink)}
.iconbtn[aria-pressed=true]{color:#c98a00;border-color:#c98a00}
.menu{position:relative}
.menu>summary{list-style:none}.menu>summary::-webkit-details-marker{display:none}
.menu .pop{position:absolute;right:0;bottom:44px;z-index:20;min-width:200px;background:var(--card);border:1px solid var(--line2);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.14);padding:6px;display:flex;flex-direction:column}
.menu .pop button,.menu .pop a{all:unset;cursor:pointer;padding:9px 10px;border-radius:8px;font-size:14px}
.menu .pop button:hover,.menu .pop a:hover{background:var(--bg)}
.menu .pop .danger{color:#c4321a}
.menu .pop [disabled]{opacity:.4;cursor:not-allowed}
details.round{border-top:1px solid var(--line);padding-top:14px}
details.round>summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between}
details.round>summary::-webkit-details-marker{display:none}
details.round>summary h2::before{content:"▸ ";font-size:18px;color:var(--mute)}
details.round[open]>summary h2::before{content:"▾ "}
details.round[open]>summary{margin-bottom:14px}
.linkbtn{all:unset;cursor:pointer;color:var(--mute);font-size:13.5px;text-decoration:underline;text-underline-offset:3px}
.linkbtn.danger{color:#c4321a}
dialog{border:0;border-radius:18px;padding:0;max-width:min(460px,calc(100vw - 32px));background:var(--card);color:var(--ink);box-shadow:0 30px 80px rgba(0,0,0,.3)}
dialog::backdrop{background:rgba(10,10,12,.45)}
dialog .dbody{padding:22px 22px 18px;display:flex;flex-direction:column;gap:12px}
dialog h3{margin:0;font-size:19px}
dialog p{margin:0;color:var(--mute)}
dialog .row{justify-content:flex-end}
.btn.danger{background:#c4321a;border-color:#c4321a;color:#fff;font-weight:500}
.cleanopt{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.cleanopt small{display:block;color:var(--mute)}
.toast{position:fixed;left:0;right:0;margin:0 auto;width:max-content;max-width:calc(100vw - 32px);bottom:24px;background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:12px;font-weight:500;opacity:0;transform:translateY(16px);transition:all .25s;pointer-events:none}
.toast.on{opacity:1;transform:none}
@media (max-width:760px){main{padding:24px 16px 60px}nav.side{max-width:none;border-right:0;border-bottom:1px solid var(--line);padding:14px 12px;gap:12px}
  .steps{flex-direction:row}.steps a{flex:1;grid-template-columns:1fr;justify-items:center;text-align:center;gap:4px;padding:8px 4px;font-size:13px}.steps small{display:none}
  .sidefoot{flex-direction:row;justify-content:space-between;margin-top:0}}
@media (prefers-reduced-motion:reduce){.toast{transition:none}.job .bar i.working{animation:none}}
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
// Like el.replaceChildren, but flattens arrays and skips null/false (the native one prints "null").
function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
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
// Live preview thumbnail: the real site, sandboxed, scaled down to fit. Thumbnails are kept between redraws
// (keyed by design + version), so a re-render moves the existing iframe instead of reloading it.
const thumbCache = new Map();
function thumb(id, v, key) {
  const k = 'd:' + id + '@' + (key ?? v ?? '');
  if (thumbCache.has(k)) return thumbCache.get(k);
  const box = h('div', { class: 'thumb' });
  thumbCache.set(k, box);
  const src = '/preview/' + encodeURIComponent(id) + (v ? '?v=' + v : '');
  const f = h('iframe', { src, sandbox: 'allow-scripts', loading: 'lazy', tabindex: '-1', title: id + ' preview', 'aria-hidden': 'true' });
  box.append(f);
  const fit = () => { f.style.transform = 'scale(' + (box.clientWidth / 1440) + ')'; };
  new ResizeObserver(fit).observe(box);
  return box;
}
const NOTE = { 'created': 'First version', 'edited outside Studio': 'Updated by your agent' };
const titleOf = (d) => d.label || (d.direction ? d.direction.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()) : d.id);
const ago = (iso) => { const s = (Date.now() - new Date(iso)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };

let state = { filter: 'all', jobs: [], itemState: {} };
const bare = !location.search;
const view = new URLSearchParams(location.search).get('view') || (new URLSearchParams(location.search).get('d') ? 'design' : 'library');
const STEP_OF = { content: 'you', persona: 'you', explore: 'explore', library: 'library', design: 'library', compare: 'library', publish: 'publish' };
for (const a of document.querySelectorAll('[data-view]')) if (a.dataset.view === STEP_OF[view]) a.setAttribute('aria-current', 'page');
const params = new URLSearchParams(location.search);

async function useDesign(id) {
  await api('/api/site/theme', { id });
  const d = state.lib && state.lib.designs.find((x) => x.id === id);
  toast('Your site is now ' + (d ? titleOf(d) : id));
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

// ---- Shared pieces: confirm dialog, step progress, activity, next-step footer ----------------------
const dlg = $('#dlg');
// Resolves true only when the person clicks the (red) action button. Esc / Cancel / backdrop = false.
function confirmDanger(title, text, action) {
  return new Promise((resolve) => {
    const done = (v) => { dlg.close(); resolve(v); };
    fill($('.dbody', dlg), h('h3', null, title), h('p', null, text),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => done(false) }, 'Cancel'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => done(true) }, action)));
    dlg.onclose = () => resolve(false);
    dlg.showModal();
    $('.btn', dlg).focus();
  });
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');

async function openCleanup() {
  const c = await api('/api/cleanup');
  const opt = (label, hint, n, what) => h('div', { class: 'cleanopt' }, h('span', null, label, h('small', null, hint)),
    h('button', { class: 'btn', type: 'button', disabled: !n, onclick: async () => {
      dlg.close();
      if (await confirmDanger('Delete ' + plural(n, 'design') + '?', 'This permanently deletes them and their history. Your site and anything an agent is working on are never touched.', 'Delete ' + n)) {
        try { const r = await api('/api/cleanup', { what }); toast('Deleted ' + plural(r.deleted, 'design')); refresh(); } catch (e) { toast(e.message); }
      }
    } }, n ? 'Delete ' + n : 'Nothing'));
  fill($('.dbody', dlg), h('h3', null, 'Clean up'), h('p', null, 'Remove designs you don\'t need. Each option asks once more before deleting.'),
    opt('Archived designs', 'everything you archived', c.archived, 'archived'),
    opt('Unfinished drafts', 'designs that were never built', c.drafts, 'drafts'),
    opt('Everything except favorites', 'keeps your starred designs and your site', c.keepFavorites, 'keep-favorites'),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Close')));
  dlg.showModal();
}
$('#cleanup').addEventListener('click', () => openCleanup().catch((e) => toast(e.message)));

function paintSteps(p) {
  // Step 1 is done with real content plus either a persona or the three quick answers (no builder needed).
  const done = { you: p.content && (p.persona || p.answers), explore: p.liked > 0, library: p.chosen, publish: p.published };
  for (const a of document.querySelectorAll('.steps a')) a.classList.toggle('done', !!done[a.dataset.view]);
  for (const a of document.querySelectorAll('.steps a.done i')) a.textContent = '✓';
}
// The one place that says what's being made, instead of a job panel on every screen.
function paintActivity() {
  const act = state.jobs.filter((j) => j.status === 'active');
  const box = $('#activity');
  if (!act.length) return fill(box);
  const total = act.reduce((n, j) => n + j.progress.total, 0), doneN = act.reduce((n, j) => n + j.progress.designed, 0);
  const waiting = act.some((j) => j.progress.waiting > 0);
  const open = box.querySelector('details') ? box.querySelector('details').open : false;
  const r = state.runner || {};
  fill(box, h('details', { class: 'activity', open: open || needsBuilder() || null },
    h('summary', null, h('span', { class: 'dot' }), h('span', null, 'Making ' + (total === 1 && act[0].kind === 'persona' ? 'your persona' : plural(total, 'thing')) + ' · ' + doneN + '/' + total)),
    h('div', { class: 'inner' },
      act.map((j) => h('div', { class: 'row between' }, h('span', null, jobTitle(j)),
        h('button', { class: 'linkbtn', type: 'button', onclick: async () => { if (!(await confirmDanger('Stop this?', 'Anything not made yet is dropped. Finished designs stay.', 'Stop'))) return; try { await api('/api/jobs/' + j.id + '/cancel', {}); toast('Stopped'); refresh(); } catch (e) { toast(e.message); } } }, 'stop'))),
      waiting ? (r.available
        ? h('button', { class: 'btn pri', type: 'button', disabled: r.running, onclick: startBuild }, r.running ? 'Building…' : 'Build now')
        : h('div', { class: 'row' }, h('button', { class: 'btn pri', type: 'button', onclick: askKey }, 'Add API key'), h('button', { class: 'linkbtn', type: 'button', onclick: howItWorks }, 'or use my AI agent'))) : null,
      r.keySource === 'studio' ? h('span', { class: 'mono' }, 'using the key you added') : null,
      r.running && r.log.length ? h('span', { class: 'mono' }, r.log[r.log.length - 1]) : null)));
}
// Nothing gets built until an AI agent or an API key picks the work up. Say so plainly, with both ways forward.
function waitingCount() {
  const act = state.jobs.filter((j) => j.status === 'active');
  return act.reduce((n, j) => n + j.progress.waiting, 0);
}
function needsBuilder() {
  const r = state.runner || {};
  const working = state.jobs.some((j) => j.status === 'active' && j.progress.working > 0);
  return waitingCount() > 0 && !r.running && !working;
}
function waitingBanner() {
  if (!needsBuilder()) return null;
  const r = state.runner || {};
  const n = waitingCount();
  return h('div', { class: 'nextbar', style: 'border-color:var(--acc)' },
    h('span', null, h('b', null, plural(n, 'thing') + ' waiting to be built. '), r.available ? 'Start building with your API key.' : 'folio needs a builder: your Anthropic API key, or your AI coding agent.'),
    h('span', { class: 'row' },
      r.available ? h('button', { class: 'btn pri', type: 'button', onclick: startBuild }, 'Build now')
        : h('button', { class: 'btn pri', type: 'button', onclick: askKey }, 'Add API key'),
      h('button', { class: 'btn', type: 'button', onclick: howItWorks }, 'Use my AI agent')));
}
async function startBuild() {
  try { state.runner = await api('/api/runner/start', {}); toast('Building'); refresh(); } catch (e) { toast(e.message); }
}
function askKey() {
  const input = h('input', { type: 'password', autocomplete: 'off', placeholder: 'sk-ant-…', 'aria-label': 'Anthropic API key', style: 'min-height:44px;border:1px solid var(--line2);border-radius:10px;padding:0 12px;font:inherit;background:var(--card);color:var(--ink);width:100%' });
  const msg = h('p', { role: 'status' });
  const save = async () => {
    msg.textContent = 'Checking the key…';
    try { state.runner = await api('/api/runner/key', { key: input.value }); dlg.close(); toast('Key added. Building now'); refresh(); } catch (e) { msg.textContent = e.message; }
  };
  fill($('.dbody', dlg), h('h3', null, 'Build with your Anthropic API key'),
    h('p', null, 'folio sends each design brief to Claude with your key. The key stays in memory only while Studio runs: it is never saved to disk and only ever sent to api.anthropic.com.'),
    h('form', { onsubmit: (e) => { e.preventDefault(); save(); } }, input),
    msg,
    h('p', null, 'Get a key at console.anthropic.com. Building a round of designs typically costs well under a dollar.'),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Cancel'), h('button', { class: 'btn pri', type: 'button', onclick: save }, 'Add key and build')));
  if (!dlg.open) dlg.showModal();
  input.focus();
}

function howItWorks() {
  fill($('.dbody', dlg), h('h3', null, 'Who makes the designs?'),
    h('p', null, 'folio writes a brief for each design. Your AI coding agent (Claude Code, Cursor, Codex…) or your Anthropic API key turns briefs into real sites.'),
    h('p', null, h('b', null, 'With an agent: '), 'tell it “work on my folio jobs”. ', h('button', { class: 'linkbtn', type: 'button', onclick: () => copy(AGENT_ASK, 'Copied. Paste it to your agent') }, 'Copy that')),
    h('p', null, h('b', null, 'With an API key: '), h('button', { class: 'linkbtn', type: 'button', onclick: askKey }, 'add your Anthropic API key'), ' and everything waiting builds right away.'),
    h('div', { class: 'row' }, h('button', { class: 'btn dark', type: 'button', onclick: () => dlg.close() }, 'Got it')));
  if (!dlg.open) dlg.showModal();
}
function nextBar(text, label, href) {
  return h('div', { class: 'nextbar' }, h('span', null, text), h('a', { class: 'btn pri', href }, label + ' →'));
}
function youTabs(active) {
  return h('nav', { class: 'tabs', 'aria-label': 'You' },
    h('a', { href: '/studio?view=content', 'aria-current': active === 'content' ? 'page' : null }, 'Your content'),
    h('a', { href: '/studio?view=persona', 'aria-current': active === 'persona' ? 'page' : null }, 'How we read you'));
}

const AGENT_ASK = 'Work on my folio jobs';
const cmpKey = 'folio-compare';
function cmpGet() { try { return JSON.parse(sessionStorage.getItem(cmpKey) || '[]'); } catch { return []; } }
function cmpToggle(id) { const c = cmpGet(); const n = c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-4); try { sessionStorage.setItem(cmpKey, JSON.stringify(n)); } catch {} refresh(); }
async function startJob(body) {
  try {
    const j = await api('/api/jobs', body);
    state.newRun = false;
    toast(plural(j.progress.total, 'new design') + ' on the way');
    if (params.get('d')) location.href = '/studio?view=library';
    else await refresh();
  } catch (e) { toast(e.message); }
}
function newRunPanel() {
  const pick = (n) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String((state.count || 6) === n), onclick: () => { state.count = n; refresh(); } }, String(n));
  return h('section', { class: 'newrun', 'aria-label': 'New round' },
    h('b', null, 'New designs'),
    h('p', { class: 'sub', style: 'margin:0' }, 'Each one is a different direction, chosen for you and never repeating what you have seen. Tip: liking looks in Explore first gives better results.'),
    h('div', { class: 'row' }, 'How many?', pick(3), pick(6), pick(9)),
    h('div', { class: 'row' },
      h('button', { class: 'btn pri', type: 'button', onclick: () => startJob({ count: state.count || 6 }) }, 'Make ' + (state.count || 6)),
      h('button', { class: 'btn', type: 'button', onclick: () => { state.newRun = false; refresh(); } }, 'Cancel')));
}
function jobTitle(j) {
  const p = j.progress;
  if (j.kind === 'persona') return j.correction ? 'Re-reading you' : 'Reading you';
  if (j.kind === 'sketches') return 'Inventing sketches';
  if (j.kind === 'content') return 'Reading your resume';
  if (j.kind === 'mix') return 'Your mix';
  if (j.kind === 'variations') return plural(p.total, 'variation');
  if (j.kind === 'from-sketches') return plural(p.total, 'liked sketch', 'liked sketches') + ' → sites';
  return plural(p.total, 'new design');
}
async function deleteDesign(d, after) {
  if (!(await confirmDanger('Delete “' + titleOf(d) + '”?', 'This permanently deletes the design and all its versions.', 'Delete'))) return;
  try { await api('/api/designs/' + encodeURIComponent(d.id) + '/delete', {}); toast('Deleted ' + titleOf(d)); after ? after() : refresh(); } catch (e) { toast(e.message); }
}
function menu(items) {
  const det = h('details', { class: 'menu' }, h('summary', { class: 'iconbtn', 'aria-label': 'More actions' }, '⋯'),
    h('div', { class: 'pop', role: 'menu' }, items.filter(Boolean).map(([label, fn, opts = {}]) =>
      h('button', { type: 'button', role: 'menuitem', class: opts.danger ? 'danger' : null, disabled: opts.disabled || null, onclick: () => { det.open = false; fn(); } }, label))));
  return det;
}
document.addEventListener('click', (e) => { for (const m of document.querySelectorAll('details.menu[open]')) if (!m.contains(e.target)) m.open = false; });

function card(d) {
  const open = '/studio?d=' + encodeURIComponent(d.id);
  const working = state.itemState[d.id] === 'working';
  const go = () => { location.href = open; };
  const picked = cmpGet().includes(d.id);
  let preview;
  if (d.pending || d.missing) preview = h('div', { class: 'waiting' }, d.missing ? 'File missing' : working ? 'Being designed…' : 'Waiting to be designed');
  else { preview = thumb(d.id, null, d.latest); preview.onclick = go; }
  return h('article', { class: 'card' + (d.current ? ' cur' : '') + (d.archived ? ' arch' : '') }, preview,
    h('div', { class: 'body' },
      h('div', { class: 'top' }, h('b', null, titleOf(d)), d.current ? h('span', { class: 'badge mine' }, 'your site') : d.wildcard ? h('span', { class: 'badge wild' }, 'surprise') : null),
      h('p', { class: 'desc clamp', style: 'margin:0' }, d.pending ? '' : (d.description || '')),
      h('div', { class: 'acts', style: 'align-items:center' },
        d.pending ? null : h('a', { class: 'btn dark', href: open }, 'Open'),
        d.pending || d.missing ? null : h('button', { class: 'iconbtn', type: 'button', 'aria-pressed': String(!!d.favorite), 'aria-label': d.favorite ? 'Unfavorite' : 'Favorite', onclick: () => flag(d.id, 'favorite', !d.favorite) }, d.favorite ? '★' : '☆'),
        picked ? h('span', { class: 'badge' }, 'comparing') : null,
        h('span', { style: 'margin-left:auto' }),
        menu([
          !d.current && !d.pending && !d.missing && ['Make this my site', () => useDesign(d.id).catch((e) => toast(e.message))],
          !d.pending && !d.missing && [picked ? 'Remove from compare' : 'Add to compare', () => cmpToggle(d.id)],
          [d.archived ? 'Unarchive' : 'Archive', () => flag(d.id, 'archived', !d.archived)],
          ['Delete…', () => deleteDesign(d), { danger: true, disabled: d.current || working }],
        ]))));
}

const roundTitle = (r, lib) => {
  const parent = r.parent ? lib.designs.find((d) => d.id === r.parent) : null;
  return 'Round ' + r.run + ' · ' + (r.parent ? 'More like ' + (parent ? titleOf(parent) : 'an earlier design') : plural(r.count, 'design'));
};
async function deleteRound(r, lib) {
  const n = (await api('/api/cleanup')).rounds[r.run] || 0;
  if (!n) return toast('Nothing to delete: favorites, your site and designs being made are kept');
  if (!(await confirmDanger('Delete ' + roundTitle(r, lib) + '?', 'Deletes ' + plural(n, 'design') + ' from this round, permanently. Favorites and your site stay.', 'Delete ' + n))) return;
  try { const res = await api('/api/cleanup', { what: 'round', run: r.run }); toast('Deleted ' + plural(res.deleted, 'design')); refresh(); } catch (e) { toast(e.message); }
}

function renderLibrary(lib) {
  state.lib = lib;
  const main = $('main');
  const visible = lib.designs.filter((d) => state.filter === 'archived' ? d.archived : state.filter === 'favorites' ? d.favorite && !d.archived : !d.archived);
  const counts = { all: lib.designs.filter((d) => !d.archived).length, favorites: lib.designs.filter((d) => d.favorite && !d.archived).length, archived: lib.designs.filter((d) => d.archived).length };
  const cur = lib.designs.find((d) => d.current) || null;
  const curBuiltin = !cur && lib.current ? lib.builtins.find((b) => b.id === lib.current) : null;
  // Open by default: the newest round, and the newest round with finished designs (often the same one).
  if (!state.openRounds) {
    const withBuilt = lib.runs.find((r) => lib.designs.some((d) => d.run === r.run && !d.pending && !d.archived));
    state.openRounds = new Set([lib.runs[0]?.run, withBuilt?.run].filter((x) => x != null));
  }
  const sel = cmpGet();

  const groups = lib.runs.map((r) => ({ r, items: visible.filter((d) => d.run === r.run) })).filter((g) => g.items.length);
  const own = visible.filter((d) => d.run == null);
  const roundSection = (g) => {
    const det = h('details', { class: 'round', open: state.filter !== 'all' || state.openRounds.has(g.r.run) || null },
      h('summary', null, h('h2', null, roundTitle(g.r, lib)),
        h('span', { class: 'row' }, h('span', { class: 'mono' }, plural(g.items.length, 'design') + (g.r.created ? ' · ' + ago(g.r.created) : '')),
          h('button', { class: 'linkbtn danger', type: 'button', onclick: (e) => { e.preventDefault(); deleteRound(g.r, lib); } }, 'delete round'))),
      h('div', { class: 'grid' }, g.items.map(card)));
    det.addEventListener('toggle', () => { det.open ? state.openRounds.add(g.r.run) : state.openRounds.delete(g.r.run); });
    return det;
  };

  fill(main,
    h('header', { class: 'row between' },
      h('div', null, h('h1', null, 'Your designs'),
        h('p', { class: 'sub' }, lib.designs.length ? plural(counts.all, 'design') + (counts.archived ? ' · ' + counts.archived + ' archived' : '') : 'Full sites built from the looks you liked.')),
      h('div', { class: 'row' }, h('button', { class: 'btn pri', type: 'button', onclick: () => { state.newRun = !state.newRun; refresh(); } }, 'New designs'))),
    waitingBanner(),
    state.newRun ? newRunPanel() : null,
    !cur && curBuiltin ? h('p', { class: 'sub', style: 'margin:0' }, 'Until you pick a design, your site uses the built-in “' + curBuiltin.id + '” theme.') : null,
    cur ? h('section', { class: 'live', 'aria-label': 'Your site' },
      thumb(cur.id, null, cur.latest),
      h('div', { style: 'flex:1 1 260px;min-width:0' },
        h('div', { class: 'k' }, lib.publishes.length ? '● live' : '● your site'),
        h('div', { class: 't' }, titleOf(cur)),
        h('div', { class: 'd' }, lib.publishes.length ? 'Published ' + ago(lib.publishes[0].at) : 'Not published yet')),
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, 'View ↗'),
        h('a', { class: 'btn lime', href: '/studio?view=publish' }, lib.publishes.length ? 'Publish again' : 'Publish'))) : null,
    lib.designs.length ? h('div', { class: 'row', role: 'group', 'aria-label': 'Filter' },
      [['all', 'All'], ['favorites', '★ Favorites'], counts.archived ? ['archived', 'Archived'] : null].filter(Boolean).map(([k, label]) =>
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.filter === k), onclick: () => { state.filter = k; renderLibrary(lib); } }, label + ' ' + counts[k]))) : null,
    !lib.designs.length ? h('div', { class: 'empty' }, 'No designs yet. Like a few looks in Explore and build them, or start a round with “New designs”.') : null,
    groups.map(roundSection),
    own.length ? h('section', { class: 'section' }, h('h2', null, 'Your own designs'), h('div', { class: 'grid' }, own.map(card))) : null,
    !visible.length && lib.designs.length ? h('div', { class: 'empty' }, state.filter === 'favorites' ? 'No favorites yet. Star a design to keep it close.' : 'Nothing archived.') : null,
    sel.length ? h('div', { class: 'cmpbar' }, h('span', null, 'Comparing ' + sel.length + (sel.length < 2 ? ' · add one more' : '')),
      h('span', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { try { sessionStorage.removeItem(cmpKey); } catch {} refresh(); } }, 'Clear'),
        sel.length >= 2 ? h('a', { class: 'btn lime', href: '/studio?view=compare&ids=' + sel.map(encodeURIComponent).join(',') }, 'Compare →') : null)) : null,
    h('details', { class: 'round' }, h('summary', null, h('h2', null, 'Built-in themes'), h('span', { class: 'mono' }, 'quick starting points')),
      h('div', { class: 'grid' }, lib.builtins.map((b) => h('article', { class: 'card' + (lib.current === b.id ? ' cur' : '') }, thumb(b.id),
        h('div', { class: 'body' }, h('b', null, b.id), h('p', { class: 'desc clamp', style: 'margin:0' }, b.description),
          h('div', { class: 'acts' }, lib.current === b.id ? h('span', { class: 'badge mine' }, 'your site') : h('button', { class: 'btn', type: 'button', onclick: () => useDesign(b.id).catch((e) => toast(e.message)) }, 'Make this my site'))))))),
    cur ? nextBar('Happy with ' + titleOf(cur) + '?', 'Publish it', '/studio?view=publish') : lib.designs.some((d) => !d.pending) ? h('div', { class: 'nextbar' }, h('span', null, 'Open a design and choose “Make this my site”, then publish it.')) : null);
}

async function renderDesign(id) {
  const [d, lib] = await Promise.all([api('/api/designs/' + encodeURIComponent(id)), api('/api/library')]);
  state.lib = lib;
  const info = lib.designs.find((x) => x.id === id) || {};
  const main = $('main');
  const sel = state.v && d.versions.some((v) => v.n === state.v) ? state.v : (d.versions[0] ? d.versions[0].n : null);
  const latest = d.versions[0] ? d.versions[0].n : null;
  const device = state.device || (innerWidth < 760 ? 'phone' : 'desk');
  fill(main, 
    h('header', { class: 'row between' },
      h('div', null,
        h('a', { href: '/studio?view=library' }, '← Designs'),
        h('h1', { style: 'margin-top:6px' }, titleOf(info.id ? info : d)),
        h('p', { class: 'sub' }, info.description || '')),
      h('div', { class: 'row' },
        info.current ? h('span', { class: 'badge mine' }, 'your site') : h('button', { class: 'btn pri', type: 'button', disabled: info.pending, onclick: () => useDesign(id).catch((e) => toast(e.message)) }, 'Make this my site'),
        h('button', { class: 'btn', type: 'button', 'aria-expanded': String(!!state.more), onclick: () => { state.more = !state.more; renderDesign(id); } }, 'More like this'),
        h('button', { class: 'iconbtn', type: 'button', 'aria-pressed': String(!!d.favorite), 'aria-label': d.favorite ? 'Unfavorite' : 'Favorite', onclick: () => flag(id, 'favorite', !d.favorite) }, d.favorite ? '★' : '☆'),
        h('a', { class: 'btn', href: '/preview/' + encodeURIComponent(id) + (sel && sel !== latest ? '?v=' + sel : ''), target: '_blank', rel: 'noopener' }, 'Open full ↗'),
        menu([
          lib.current && lib.current !== id && ['Compare with my site', () => { location.href = '/studio?view=compare&ids=' + encodeURIComponent(id) + ',' + encodeURIComponent(lib.current); }],
          [d.archived ? 'Unarchive' : 'Archive', () => flag(id, 'archived', !d.archived).then(() => renderDesign(id))],
          ['Delete design…', () => deleteDesign(info.id ? info : d, () => { location.href = '/studio?view=library'; }), { danger: true, disabled: info.current }],
        ]))),
    state.more ? h('section', { class: 'newrun', 'aria-label': 'More like this' },
      h('b', null, 'More like ' + titleOf(info.id ? info : d)),
      h('p', { class: 'sub', style: 'margin:0' }, 'What do you like about it? That stays. Each variation changes two big things.'),
      h('div', { class: 'row' }, [['vibe', 'Overall vibe'], ['colors', 'Colors'], ['type', 'Typography'], ['layout', 'Layout'], ['signature', 'Signature moment']].map(([k, label]) =>
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String((state.keep || 'vibe') === k), onclick: () => { state.keep = k; renderDesign(id); } }, label))),
      h('div', { class: 'row' },
        h('button', { class: 'btn pri', type: 'button', onclick: () => { state.more = false; startJob({ like: id, keep: state.keep || 'vibe', count: 3 }); } }, 'Make 3 variations'),
        h('button', { class: 'btn', type: 'button', onclick: () => { state.more = false; renderDesign(id); } }, 'Cancel'))) : null,
    h('div', { class: 'split' },
      h('section', { class: 'stage', 'aria-label': 'Preview' },
        h('div', { class: 'row between' },
          h('div', { class: 'seg', role: 'group', 'aria-label': 'Device' },
            h('button', { type: 'button', 'aria-pressed': String(device === 'desk'), onclick: () => { state.device = 'desk'; renderDesign(id); } }, 'Desktop'),
            h('button', { type: 'button', 'aria-pressed': String(device === 'phone'), onclick: () => { state.device = 'phone'; renderDesign(id); } }, 'Phone')),
          h('span', { class: 'mono' }, sel ? (sel === latest ? 'showing v' + sel + ' (latest)' : 'showing v' + sel + ' · not the latest') : 'no versions yet')),
        previewFrame('/preview/' + encodeURIComponent(id) + (sel && sel !== latest ? '?v=' + sel : ''), device, id)),
      h('aside', { class: 'panel', 'aria-label': 'History' },
        h('div', null, h('b', null, 'Versions'), h('p', { class: 'sub', style: 'margin:2px 0 0;font-size:13.5px' }, 'Click one to preview it. Restoring makes it the latest again.')),
        d.versions.length ? h('ol', { class: 'hist' }, d.versions.map((v) => h('li', { 'aria-current': String(v.n === sel) },
          h('button', { class: 'v', type: 'button', onclick: () => { state.v = v.n; renderDesign(id); }, 'aria-label': 'Preview version ' + v.n }, 'v' + v.n),
          h('span', null, NOTE[v.note] || v.note, h('small', null, ago(v.at))),
          v.n === latest ? h('span', { class: 'mono' }, 'latest') : h('span', { class: 'row', style: 'gap:6px' },
            h('button', { class: 'btn', type: 'button', onclick: async () => { try { await api('/api/designs/' + encodeURIComponent(id) + '/restore', { n: v.n }); state.v = null; toast('v' + v.n + ' is the latest again'); renderDesign(id); } catch (e) { toast(e.message); } } }, 'Restore'),
            h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Delete version ' + v.n, onclick: async () => { if (!(await confirmDanger('Delete v' + v.n + '?', 'This version is removed for good. The others stay.', 'Delete'))) return; try { await api('/api/designs/' + encodeURIComponent(id) + '/delete-version', { n: v.n }); if (state.v === v.n) state.v = null; toast('Deleted v' + v.n); renderDesign(id); } catch (e) { toast(e.message); } } }, '×'))))) : h('p', { class: 'sub' }, 'No versions yet: this design is still being made.'),
        d.versions.length > 2 ? h('button', { class: 'linkbtn danger', type: 'button', onclick: async () => {
          const older = d.versions.slice(1);
          if (!(await confirmDanger('Delete ' + plural(older.length, 'older version') + '?', 'Only the latest version (v' + latest + ') is kept.', 'Delete ' + older.length))) return;
          try { for (const v of older) await api('/api/designs/' + encodeURIComponent(id) + '/delete-version', { n: v.n }); state.v = null; toast('Kept only v' + latest); renderDesign(id); } catch (e) { toast(e.message); }
        } }, 'Delete older versions') : null,
        d.children.length ? h('div', null, h('b', null, 'Variations of this'), h('p', { class: 'sub', style: 'margin:4px 0 0' }, d.children.map((c, i) => { const cd = lib.designs.find((x) => x.id === c); return [i ? ', ' : '', h('a', { href: '/studio?d=' + encodeURIComponent(c) }, cd ? titleOf(cd) : c)]; }))) : null)));
}

async function renderPersona() {
  const [{ persona, questions, answers }, refs] = await Promise.all([api('/api/persona'), api('/api/references')]);
  const main = $('main');
  const ans = (persona ? persona.answers : answers) || {};
  const qBlock = h('div', { class: 'box' }, h('b', null, 'Three quick questions'),
    h('p', { class: 'sub', style: 'margin:0' }, 'A CV is written in your most formal voice. These show who you are, so designs don\'t come out too serious.'),
    Object.entries(questions).map(([k, q]) => h('fieldset', { style: 'border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:8px' },
      h('legend', { style: 'font-weight:500;padding:0;margin-bottom:6px' }, q.title),
      h('div', { class: 'row' }, q.options.map((o) => { const on = (ans[k] || []).includes(o); return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), onclick: async () => {
        const next = { ...ans, [k]: on ? (ans[k] || []).filter((x) => x !== o) : [...(ans[k] || []), o] };
        try { await api('/api/persona', { answers: next }); refresh(); } catch (e) { toast(e.message); } } }, o); })))));

  if (!persona) {
    fill(main, 
      youTabs('persona'),
      waitingBanner(),
      h('header', null, h('h1', null, 'How we read you'), h('p', { class: 'sub' }, 'Three quick questions are enough to start. For a fuller read, folio can study your resume and repos and write a persona card you can correct.')),
      h('div', { class: 'cols' }, qBlock,
        h('div', { class: 'box' }, h('b', null, 'Optional: a fuller read'), h('p', { class: 'sub', style: 'margin:0' }, 'folio studies your resume and repos and writes a persona card: your mood, voice and taste, quoted from your own words. Uses your API key or AI agent.'),
          h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: async () => { try { await api('/api/persona/read', {}); toast('Reading you'); refresh(); } catch (e) { toast(e.message); } } }, 'Read me')))),
      Object.values(ans).some((v) => v && v.length) ? nextBar('That\'s enough to start.', 'Next: explore looks', '/studio?view=explore') : null);
    return;
  }
  const dial = (k, label) => h('label', { class: 'dial' }, label,
    h('input', { type: 'range', min: '0', max: '10', value: String(persona.dials[k]), 'aria-label': label, onchange: async (e) => { try { await api('/api/persona', { dials: { [k]: Number(e.target.value) } }); toast(label + ' saved'); refresh(); } catch (err) { toast(err.message); } } }),
    h('span', { class: 'mono' }, String(persona.dials[k])));
  const fix = h('input', { id: 'fix', placeholder: 'e.g. warmer than that, or: I\'m funnier than this', style: 'flex:1 1 240px;min-height:44px;border:1px solid var(--line2);border-radius:10px;padding:0 12px;font:inherit;background:var(--card);color:var(--ink)' });
  const worldIn = h('input', { 'aria-label': 'Add a world', placeholder: 'add a world', style: 'min-height:36px;border:1px dashed var(--line2);border-radius:999px;padding:0 12px;font:inherit;font-size:14px;background:transparent;color:var(--ink);width:150px' });
  const saveWorlds = async (w) => { try { await api('/api/persona', { worlds: w }); refresh(); } catch (e) { toast(e.message); } };
  fill(main, 
    youTabs('persona'),
    waitingBanner(),
    h('header', null, h('h1', null, persona.headline), h('p', { class: 'sub' }, persona.lede)),
    h('div', { class: 'cols' },
      h('div', { class: 'wide', style: 'display:flex;flex-direction:column;gap:16px' },
        h('div', { class: 'pcard' }, persona.traits.map((t) => h('div', { class: 'trait' }, h('span', { class: 'k' }, t.key),
          h('div', null, h('div', { class: 'v' }, t.value), t.quote ? h('q', null, t.quote) : null, h('small', null, 'from ' + (t.source === 'you' ? 'you' : 'your ' + t.source)))))),
        h('div', { class: 'box' }, h('label', { for: 'fix', style: 'font-weight:500' }, 'Something off? One line is enough.'),
          h('div', { class: 'row' }, fix, h('button', { class: 'btn dark', type: 'button', onclick: async () => { if (!fix.value.trim()) return toast('Say what is off first'); try { await api('/api/persona/correct', { text: fix.value }); toast('Sent to your agent as a re-read'); refresh(); } catch (e) { toast(e.message); } } }, 'Re-read me'))),
        (persona.implications || []).length ? h('div', { class: 'box' }, h('b', null, 'So the design should'), h('ul', { style: 'margin:0;padding-left:18px' }, persona.implications.map((x) => h('li', null, x))),
          (persona.avoid || []).length ? h('p', { class: 'sub', style: 'margin:0' }, 'Avoid: ' + persona.avoid.join(' · ')) : null) : null),
      h('div', { style: 'display:flex;flex-direction:column;gap:16px' },
        h('div', { class: 'box' }, h('b', null, 'Dials'), dial('energy', 'Energy'), dial('warmth', 'Warmth'), dial('techDepth', 'Tech depth'), dial('playfulness', 'Playfulness'), dial('formality', 'Formality')),
        h('div', { class: 'box' }, h('b', null, 'Your worlds'), h('div', { class: 'row' },
          persona.worlds.map((w) => h('button', { class: 'chip', type: 'button', 'aria-label': 'Remove ' + w, onclick: () => saveWorlds(persona.worlds.filter((x) => x !== w)) }, w + ' ×')),
          h('form', { onsubmit: (e) => { e.preventDefault(); if (worldIn.value.trim()) saveWorlds([...persona.worlds, worldIn.value.trim()]); } }, worldIn))),
        persona.versions.length < 2 ? null : h('div', { class: 'box' }, h('b', null, 'Earlier reads'), h('ol', { class: 'hist' }, persona.versions.slice(0, 6).map((v, i) => h('li', null, h('b', { class: 'mono' }, 'v' + v.n), h('span', null, v.note, h('small', null, ago(v.at))),
          i === 0 ? h('span', { class: 'mono' }, 'current') : h('button', { class: 'btn', type: 'button', onclick: async () => { try { await api('/api/persona/restore', { n: v.n }); toast('Restored v' + v.n); refresh(); } catch (e) { toast(e.message); } } }, 'Restore'))))))),
    qBlock,
    h('section', { class: 'section' }, h('div', { class: 'h' }, h('h2', null, 'Reference board'), h('span', { class: 'mono' }, 'principles from your worlds · credited · nothing copied')),
      refs.length ? h('div', { class: 'grid' }, refs.map((r) => h('article', { class: 'ref' + (r.hidden ? ' hid' : '') },
        r.specimen && r.specimen.colors.length ? h('div', { class: 'sw' }, r.specimen.colors.map((c) => { const i = h('i'); i.style.background = c; return i; })) : null,
        h('div', { class: 'body' }, h('div', { class: 'row between' }, h('b', null, r.title), h('span', { class: 'mono' }, r.world)),
          r.why ? h('span', { class: 'sub', style: 'margin:0' }, r.why) : null,
          h('ul', null, r.principles.map((x) => h('li', null, x))),
          h('span', { class: 'mono' }, r.kind + (r.license ? ' · ' + r.license : '')),
          h('div', { class: 'acts' },
            r.url ? h('a', { class: 'btn', href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'Source ↗') : null,
            h('button', { class: 'btn star', type: 'button', 'aria-pressed': String(!!r.pinned), onclick: async () => { await api('/api/references/' + r.id + '/flag', { flag: 'pinned', value: !r.pinned }); refresh(); } }, r.pinned ? '★ Pinned' : '☆ Pin'),
            h('button', { class: 'btn', type: 'button', onclick: async () => { await api('/api/references/' + r.id + '/flag', { flag: 'hidden', value: !r.hidden }); refresh(); } }, r.hidden ? 'Show' : 'Hide')))))) :
        h('div', { class: 'empty' }, 'No references yet. Your agent adds them from open archives and web sources that allow it (folio refs add).')),
    nextBar('Feels like you?', 'Next: explore looks', '/studio?view=explore'));
}

function sketchThumb(id) {
  if (thumbCache.has('s:' + id)) return thumbCache.get('s:' + id);
  const box = h('div', { class: 'thumb' });
  thumbCache.set('s:' + id, box);
  const f = h('iframe', { src: '/sketch/' + encodeURIComponent(id), sandbox: 'allow-scripts', loading: 'lazy', tabindex: '-1', title: 'sketch ' + id, 'aria-hidden': 'true' });
  box.append(f);
  new ResizeObserver(() => { f.style.transform = 'scale(' + (box.clientWidth / 1440) + ')'; }).observe(box);
  return box;
}

async function renderExplore() {
  const data = await api('/api/sketches');
  const main = $('main');
  const built = new Set(data.built || []);
  // Only likes that haven't become full sites yet are offered for building.
  const liked = Object.keys(data.picks.liked).filter((id) => !built.has(id));
  const pickIt = async (id, value) => { try { await api('/api/sketches/' + id + '/pick', { value }); refresh(); } catch (e) { toast(e.message); } };
  const newRound = async (agent) => { try { const r = await api('/api/sketches', agent ? { count: 12, agent: true } : { count: 12 }); toast(agent ? 'Your AI agent will invent 12 looks' : r.specs.length + ' new looks'); refresh(); } catch (e) { toast(e.message); } };
  fill(main, 
    h('header', { class: 'row between' },
      h('div', null, h('h1', null, 'Which of these feel like you?'),
        h('p', { class: 'sub' }, 'Like the looks that click. Only those become full sites.')),
      h('div', { class: 'box', style: 'min-width:260px' }, h('b', null, 'Your taste so far'),
        data.taste.likes.length || data.taste.dislikes.length
          ? [h('span', null, 'Leaning ', h('b', null, data.taste.likes.join(', ') || '…')), data.taste.dislikes.length ? h('span', { class: 'sub', style: 'margin:0' }, 'Less ' + data.taste.dislikes.join(', ')) : null]
          : h('span', { class: 'sub', style: 'margin:0' }, 'Like or skip a few sketches and folio learns.'))),
    waitingBanner(),
    state.progress && !state.progress.persona && !state.progress.answers ? h('div', { class: 'nextbar' }, h('span', null, 'Looks fit much better once we know you. Answer three quick questions first?'), h('a', { class: 'btn', href: '/studio?view=persona' }, 'Three questions →')) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn pri', type: 'button', onclick: () => newRound(false) }, data.rounds.length ? 'Show me 12 more' : 'Show me 12 looks'),
      h('button', { class: 'linkbtn', type: 'button', onclick: () => newRound(true) }, 'or ask my AI agent to invent 12')),
    liked.length ? h('div', { class: 'buildbar' }, h('span', null, h('b', null, plural(liked.length, 'look') + ' liked'), liked.length > 6 ? ' · the first 6 get built' : ''),
      h('button', { class: 'btn lime', type: 'button', onclick: async () => { try { const j = await api('/api/sketches/build', { ids: liked.slice(0, 6) }); toast('Building ' + plural(j.progress.total, 'full site')); location.href = '/studio?view=library'; } catch (e) { toast(e.message); } } }, 'Build ' + (Math.min(liked.length, 6) === 1 ? 'it' : 'them') + ' as full sites →')) : null,
    data.rounds.length ? data.rounds.map((r, ri) => h('details', { class: 'round', open: ri === 0 || null },
      h('summary', null, h('h2', null, 'Looks ' + r.round), h('span', { class: 'row' }, h('span', { class: 'mono' }, (r.source === 'agent' ? 'invented by your agent · ' : '') + ago(r.createdAt)),
        h('button', { class: 'linkbtn danger', type: 'button', onclick: async (e) => { e.preventDefault(); if (!(await confirmDanger('Delete these ' + r.specs.length + ' looks?', 'Your likes and skips on them go too.', 'Delete'))) return; try { await api('/api/sketches/round/' + r.round + '/delete', {}); toast('Deleted'); refresh(); } catch (err) { toast(err.message); } } }, 'delete'))),
      h('div', { class: 'grid' }, r.specs.map((sp) => {
        const on = !!data.picks.liked[sp.id], off = !!data.picks.skipped[sp.id];
        return h('article', { class: 'card sk' + (on ? ' liked' : '') + (off ? ' skipped' : '') }, sketchThumb(sp.id),
          h('div', { class: 'body' }, h('div', { class: 'top' }, h('b', null, sp.title), built.has(sp.id) ? h('a', { class: 'badge mine', href: '/studio?view=library', style: 'text-decoration:none' }, 'built ✓') : sp.wild ? h('span', { class: 'badge wild' }, 'surprise') : null),
            h('span', { class: 'desc', style: 'min-height:0' }, sp.note || sp.mood),
            h('div', { class: 'acts' },
              h('button', { class: 'btn' + (on ? ' lime' : ''), type: 'button', 'aria-pressed': String(on), onclick: () => pickIt(sp.id, on ? null : 'like') }, on ? '♥ Liked' : '♡ Like'),
              h('button', { class: 'btn', type: 'button', 'aria-label': (off ? 'Unskip ' : 'Skip ') + sp.title, onclick: () => pickIt(sp.id, off ? null : 'skip') }, off ? '↺' : '×'))));
      })))) : h('div', { class: 'empty' }, 'Quick first screens in different styles, made from how we read you. Like the ones that feel like you; only those become full sites.'));
}

async function renderCompare() {
  const ids = (new URLSearchParams(location.search).get('ids') || '').split(',').filter(Boolean).slice(0, 4);
  const main = $('main');
  if (ids.length < 2) { fill(main, h('div', { class: 'empty' }, 'Pick two to four designs in Designs (⋯ → Add to compare).')); return; }
  const [lib, ...traits] = await Promise.all([api('/api/library'), ...ids.map((id) => api('/api/designs/' + encodeURIComponent(id) + '/traits').catch(() => ({ fonts: [], colors: [] })))]);
  const info = (id) => lib.designs.find((d) => d.id === id) || { id };
  state.mix = state.mix || { layout: ids[0], colors: ids[1] || ids[0], type: ids[0], signature: ids[ids.length - 1] };
  for (const k of Object.keys(state.mix)) if (!ids.includes(state.mix[k])) state.mix[k] = ids[0];
  const aspects = [['layout', 'Layout & structure'], ['colors', 'Colors'], ['type', 'Typography'], ['signature', 'Signature moment']];
  fill(main,
    h('header', null, h('a', { href: '/studio?view=library' }, '← Designs'), h('h1', { style: 'margin-top:6px' }, 'Compare, then mix'),
      h('p', { class: 'sub' }, 'Pick one, or take the best part of each. A mix becomes a new design; the originals stay as they are.')),
    h('div', { class: 'cmp' }, ids.map((id, i) => {
      const d = info(id), t = traits[i];
      return h('article', { class: 'card' + (d.current ? ' cur' : '') }, thumb(id),
        h('div', { class: 'body' }, h('div', { class: 'top' }, h('b', null, titleOf(d)), h('span', { class: 'mono' }, d.latest ? 'v' + d.latest : '')),
          h('p', { class: 'desc', style: 'margin:0' }, d.description || ''),
          h('span', { class: 'mono' }, 'Type: ' + (t.fonts.join(' + ') || 'system')),
          h('div', { class: 'swatches', 'aria-label': 'Main colors' }, t.colors.map((c) => { const sw = h('i', { title: c }); sw.style.background = c; return sw; })),
          h('div', { class: 'acts' }, d.current ? h('span', { class: 'badge mine' }, '★ your site') : h('button', { class: 'btn dark', type: 'button', onclick: () => useDesign(id).catch((e) => toast(e.message)) }, 'Use this one'),
            h('a', { class: 'btn', href: '/studio?d=' + encodeURIComponent(id) }, 'Open'))));
    })),
    h('section', { class: 'box', 'aria-label': 'Mix' }, h('h2', null, 'Mix the best parts'),
      aspects.map(([k, label]) => h('div', { class: 'mixrow', role: 'radiogroup', 'aria-label': label + ' from' }, h('b', null, label),
        h('div', { class: 'row' }, ids.map((id) => h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(state.mix[k] === id), 'aria-pressed': String(state.mix[k] === id), onclick: () => { state.mix[k] = id; renderCompare(); } }, titleOf(info(id))))))),
      h('div', { class: 'row between' }, h('span', { class: 'sub', style: 'margin:0' }, 'New design: layout from ' + titleOf(info(state.mix.layout)) + ', colors from ' + titleOf(info(state.mix.colors)) + ', type from ' + titleOf(info(state.mix.type)) + ', signature from ' + titleOf(info(state.mix.signature)) + '.'),
        h('button', { class: 'btn pri', type: 'button', onclick: async () => { try { const j = await api('/api/jobs', { mix: state.mix }); toast('Your mix is on the way'); location.href = '/studio?view=library'; } catch (e) { toast(e.message); } } }, 'Build this mix'))));
}

async function renderPublish() {
  const [check, lib, kit] = await Promise.all([api('/api/publish/check'), api('/api/library'), api('/api/kit').catch(() => ({ files: [], chrome: false }))]);
  const main = $('main');
  const cur = lib.designs.find((d) => d.current);
  const icon = { ok: '✓', warn: '!', error: '✗' };
  const agree = h('input', { type: 'checkbox', id: 'agree' });
  const out = h('p', { class: 'sub', role: 'status', style: 'margin:0' });
  const go = async (host) => {
    if (host === 'github-pages' && !agree.checked) return toast('Tick the box first: publishing makes your site public');
    out.textContent = host === 'files' ? 'Building…' : 'Publishing…';
    try {
      const r = await api('/api/publish', { host, confirm: host === 'github-pages' ? true : undefined });
      out.textContent = host === 'files' ? 'Built: your site is in ' + r.outDir + '. Upload that folder to any static host.' : r.warning ? 'Uploaded, not live yet. ' + r.warning : 'Published. Live at ' + r.url + ' in about a minute.';
      toast(host === 'files' ? 'Files built' : r.warning ? 'Uploaded: one step left' : 'Published');
      if (host !== 'files') refresh();
    } catch (e) { out.textContent = 'Not published: ' + e.message; }
  };
  fill(main,
    h('header', null, h('h1', null, 'Publish your site'), h('p', { class: 'sub' }, 'Check, then go live. You can change design and publish again any time.')),
    h('div', { class: 'cols' },
      h('div', { class: 'wide', style: 'display:flex;flex-direction:column;gap:16px' },
        h('section', { class: 'box', 'aria-label': 'Design' }, h('b', null, 'Design'),
          h('div', { class: 'row' }, thumbBox(check.theme), h('div', null, h('div', { style: 'font-size:20px;font-weight:600' }, cur ? titleOf(cur) + (cur.latest ? ' · v' + cur.latest : '') : check.theme), h('a', { href: '/studio?view=library' }, 'Change design')))),
        h('section', { class: 'box', 'aria-label': 'Before it goes live' }, h('b', null, 'Before it goes live'),
          h('ul', { class: 'checks' }, check.items.map((i) => h('li', null, h('span', { class: i.level, 'aria-label': i.level }, icon[i.level]), h('span', null, i.text))))),
        h('section', { class: 'box', 'aria-label': 'Publish' }, h('b', null, check.url ? 'Publish to ' + check.url : 'Publish'),
          check.canPublish ? h('label', { for: 'agree', class: 'row', style: 'gap:8px' }, agree, 'I understand this makes my site public at ' + check.url) : h('p', { class: 'sub', style: 'margin:0' }, check.items.some((i) => i.level === 'error') ? 'Fix the ✗ items above to publish from here.' : 'Connect a GitHub repo to publish from here, or build the files and host them anywhere.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn pri', type: 'button', disabled: !check.canPublish, onclick: () => go('github-pages') }, 'Publish to GitHub Pages'),
            h('button', { class: 'btn', type: 'button', onclick: () => go('files') }, 'Build files instead')),
          out)),
      h('div', { style: 'display:flex;flex-direction:column;gap:16px' },
      kitBox(kit),
      h('section', { class: 'box', 'aria-label': 'History' }, h('b', null, 'Publish history'),
        lib.publishes.length ? h('ol', { class: 'hist' }, lib.publishes.map((pb, i) => h('li', null, h('b', { class: 'mono' }, pb.version ? 'v' + pb.version : '·'),
          h('span', null, pb.design, h('small', null, ago(pb.at) + (pb.url ? ' · ' + pb.url : ''))),
          i === 0 ? h('span', { class: 'mono' }, 'live') : h('button', { class: 'btn', type: 'button', onclick: () => useDesign(pb.design).then(() => toast('Your site uses ' + pb.design + ' again. Publish to make it live')) }, 'Use again')))) :
          h('p', { class: 'sub', style: 'margin:0' }, 'Nothing published yet.')))));
}
const KIT_LABELS = { 'og.png': 'Link preview', 'linkedin-banner.png': 'LinkedIn banner', 'x-header.png': 'X header', 'post.png': 'Announcement post', 'resume.pdf': 'Résumé (PDF)' };
function kitBox(kit) {
  const stamp = Date.now();
  const make = async (btn) => {
    btn.disabled = true; btn.textContent = 'Making your kit…';
    try { await api('/api/kit', {}); toast('Kit ready, in your design'); refresh(); } catch (e) { toast(e.message); btn.disabled = false; btn.textContent = 'Try again'; }
  };
  return h('section', { class: 'box', 'aria-label': 'Identity kit' }, h('b', null, 'Identity kit'),
    h('p', { class: 'sub', style: 'margin:0' }, 'Your design on everything around your site: link preview, LinkedIn and X banners, a post, a one-page résumé. Remake it after you change designs.'),
    kit.files.length ? h('div', { class: 'kit' }, kit.files.map((f) => h('a', { href: '/kit/' + f, target: '_blank', rel: 'noopener', download: f },
      f.endsWith('.pdf') ? h('span', { class: 'pdf' }, 'PDF') : h('img', { src: '/kit/' + f + '?t=' + stamp, alt: KIT_LABELS[f] }), KIT_LABELS[f]))) : null,
    kit.chrome ? h('button', { class: 'btn' + (kit.files.length ? '' : ' pri'), type: 'button', disabled: kit.making, onclick: (e) => make(e.currentTarget) }, kit.files.length ? 'Remake kit' : 'Make my kit')
      : h('p', { class: 'sub', style: 'margin:0' }, 'Needs Chrome or Chromium installed.'));
}
// The design preview. Desktop renders at a real 1440px width (the layout visitors get) scaled to fit;
// a narrower live iframe would show the tablet layout instead and make designs look broken.
function previewFrame(src, device, id) {
  const iframe = h('iframe', { src, sandbox: 'allow-scripts', title: id + ' preview' });
  const win = h('div', { class: 'win' }, iframe);
  const frame = h('div', { class: 'frame' + (device === 'phone' ? ' phone' : '') }, win);
  if (device !== 'phone') {
    const H = 900;
    iframe.style.cssText = 'width:1440px;height:' + H + 'px;transform-origin:0 0';
    const fit = () => { const k = win.clientWidth / 1440; iframe.style.transform = 'scale(' + k + ')'; win.style.height = Math.round(H * k) + 'px'; };
    new ResizeObserver(fit).observe(win);
  }
  return frame;
}
function thumbBox(id) { const t = thumb(id); t.style.width = '220px'; t.style.borderRadius = '10px'; t.style.border = '1px solid var(--line)'; return t; }

// ---- Content: folio.json as a form --------------------------------------------------------------
const SECTIONS = {
  links: { title: 'Links', blank: { label: '', url: '' }, fields: [['label', 'Label'], ['url', 'URL']] },
  projects: { title: 'Projects', blank: { name: '', description: '' }, fields: [['name', 'Name'], ['description', 'One-line pitch', 'textarea'], ['url', 'Live link'], ['repo', 'Source link'], ['tags', 'Tags (comma separated)', 'csv'], ['year', 'Year'], ['highlights', 'Highlights (one per line)', 'lines'], ['featured', 'Featured', 'check']] },
  experience: { title: 'Experience', blank: { role: '', org: '' }, fields: [['role', 'Role'], ['org', 'Organization'], ['start', 'Start (YYYY-MM)'], ['end', 'End (YYYY-MM or present)'], ['location', 'Location'], ['summary', 'One-line summary'], ['highlights', 'Highlights (one per line, outcome first)', 'lines']] },
  education: { title: 'Education', blank: { school: '' }, fields: [['school', 'School'], ['degree', 'Degree'], ['start', 'Start'], ['end', 'End'], ['details', 'Details']] },
  skills: { title: 'Skills', blank: { group: '', items: [] }, fields: [['group', 'Group'], ['items', 'Skills (comma separated)', 'csv']] },
};
function inputFor(obj, k, label, type, onchange) {
  const v = obj[k];
  if (type === 'check') { const c = h('input', { type: 'checkbox', checked: !!v }); c.addEventListener('change', () => onchange(c.checked)); return h('label', { class: 'field', style: 'flex-direction:row;align-items:center;gap:8px' }, c, label); }
  const val = type === 'csv' ? (v || []).join(', ') : type === 'lines' ? (v || []).join('\n') : v ?? '';
  const el = h(type === 'textarea' || type === 'lines' ? 'textarea' : 'input', { 'aria-label': label });
  el.value = val;
  el.addEventListener('input', () => onchange(type === 'csv' ? el.value.split(',').map((x) => x.trim()).filter(Boolean) : type === 'lines' ? el.value.split('\n').map((x) => x.trim()).filter(Boolean) : el.value));
  return h('label', { class: 'field' }, label, el);
}

window.addEventListener('beforeunload', (e) => { if (state.dirty) e.preventDefault(); });
async function renderContent() {
  const data = state.contentData || (state.contentData = await api('/api/content'));
  const draft = state.draft || (state.draft = JSON.parse(JSON.stringify(data.content)));
  const main = $('main');
  const mark = () => { state.dirty = true; $('.savebar b') && ($('.savebar b').textContent = 'Unsaved changes'); };
  const set = (k) => (v) => { if (v === '' || (Array.isArray(v) && !v.length)) delete draft[k]; else draft[k] = v; mark(); };
  const basics = [['name', 'Name'], ['headline', 'Headline (10 words or fewer)'], ['location', 'Location'], ['status', 'Status (e.g. Open to internships)'], ['email', 'Email (public on your site)'], ['url', 'Your site URL (for link previews)']];
  const ghIn = h('input', { 'aria-label': 'GitHub username', placeholder: 'GitHub username', style: 'min-height:40px;border:1px solid var(--line2);border-radius:10px;padding:0 10px;font:inherit;background:var(--card);color:var(--ink)' });
  const fileIn = h('input', { type: 'file', accept: '.pdf,.docx,.txt,.md,.zip', 'aria-label': 'Resume or LinkedIn export' });
  const status = h('span', { class: 'mono', role: 'status' });
  fill(main,
    youTabs('content'),
    waitingBanner(),
    h('header', null, h('h1', null, 'Your content'), h('p', { class: 'sub' }, 'Everything your site says about you. Changing designs never changes this.')),
    h('div', { class: 'cols' },
      h('section', { class: 'box', 'aria-label': 'Import from GitHub' }, h('b', null, 'Import from GitHub'), h('p', { class: 'sub', style: 'margin:0' }, 'Adds your name, photo, bio and best repos. Never overwrites what you wrote.'),
        h('form', { class: 'row', onsubmit: async (e) => { e.preventDefault(); status.textContent = 'Importing…'; try { const r = await api('/api/content/github', { user: ghIn.value.trim() }); state.contentData = null; state.draft = null; toast('Imported ' + (r.added.length ? r.added.length + ' projects' : 'your profile')); refresh(); } catch (err) { status.textContent = err.message; } } }, ghIn, h('button', { class: 'btn', type: 'submit' }, 'Import'))),
      h('section', { class: 'box', 'aria-label': 'Resume' }, h('b', null, 'Your resume or LinkedIn export'), h('p', { class: 'sub', style: 'margin:0' }, 'Kept on this computer. folio reads it and fills the form below (uses your API key or AI agent), and never invents facts.'),
        h('div', { class: 'row' }, fileIn, h('button', { class: 'btn pri', type: 'button', onclick: async () => {
          const f = fileIn.files[0]; if (!f) return toast('Choose a file first');
          status.textContent = 'Uploading…';
          try {
            const r = await fetch('/api/content/upload?name=' + encodeURIComponent(f.name), { method: 'POST', headers: { 'X-Folio': '1', 'Content-Type': f.type || 'application/octet-stream' }, body: f });
            const up = await r.json(); if (!r.ok) throw new Error(up.error);
            await api('/api/content/read', { files: [up.path] });
            status.textContent = ''; toast('Uploaded. Your agent will read it'); refresh();
          } catch (err) { status.textContent = err.message; } } }, 'Upload')), status)),
    data.errors.length ? h('div', { class: 'errs bad' }, h('b', null, 'Problems: '), data.errors.join(' · ')) : null,
    data.warnings.length ? h('div', { class: 'errs note' }, h('b', null, 'Suggestions: '), data.warnings.join(' · ')) : null,
    h('section', { class: 'box', 'aria-label': 'Basics' }, h('h2', null, 'Basics'),
      h('div', { class: 'fgrid' }, basics.map(([k, label]) => inputFor(draft, k, label, 'text', set(k)))),
      inputFor(draft, 'about', 'About (2–3 sentences; **bold** and [links](https://…) work)', 'textarea', set('about'))),
    Object.entries(SECTIONS).map(([key, sec]) => {
      const rows = Array.isArray(draft[key]) ? draft[key] : (draft[key] = []);
      return h('section', { class: 'box', 'aria-label': sec.title }, h('div', { class: 'row between' }, h('h2', null, sec.title), h('button', { class: 'btn', type: 'button', onclick: () => { rows.push(JSON.parse(JSON.stringify(sec.blank))); mark(); renderContent(); } }, '+ Add')),
        rows.length ? rows.map((row, i) => h('div', { class: sec.fields.length <= 2 ? 'item compact' : 'item' },
          h('div', { class: 'fgrid' }, sec.fields.map(([k, label, type]) => inputFor(row, k, label, type || 'text', (v) => { if (v === '' || v === false || (Array.isArray(v) && !v.length)) delete row[k]; else row[k] = v; mark(); }))),
          h('div', { class: 'row between' }, row.stars != null ? h('span', { class: 'mono' }, '★ ' + row.stars + ' (from GitHub)') : h('span'),
            h('div', { class: 'row' },
              i > 0 ? h('button', { class: 'btn', type: 'button', 'aria-label': 'Move up', onclick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; mark(); renderContent(); } }, '↑') : null,
              h('button', { class: 'btn', type: 'button', onclick: () => { rows.splice(i, 1); mark(); renderContent(); } }, 'Remove'))))) : h('p', { class: 'sub', style: 'margin:0' }, 'Nothing here yet.'));
    }),
    h('section', { class: 'box', 'aria-label': 'Versions' }, h('b', null, 'Versions'), data.versions.length ? h('ol', { class: 'hist' }, data.versions.slice(0, 8).map((v, i) => h('li', null, h('b', { class: 'mono' }, 'v' + v.n), h('span', null, v.note, h('small', null, ago(v.at))),
      i === 0 ? h('span', { class: 'mono' }, 'current') : h('button', { class: 'btn', type: 'button', onclick: async () => { try { await api('/api/content/restore', { n: v.n }); state.contentData = null; state.draft = null; toast('Restored v' + v.n); refresh(); } catch (e) { toast(e.message); } } }, 'Restore')))) : h('p', { class: 'sub', style: 'margin:0' }, 'Your first save starts the history.')),
    state.dirty ? null : nextBar('Content looks right?', 'Next: how we read you', '/studio?view=persona'),
    h('div', { class: 'savebar' }, h('b', null, state.dirty ? 'Unsaved changes' : 'All saved'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => { state.draft = null; state.dirty = false; renderContent(); } }, 'Discard'),
        h('button', { class: 'btn lime', type: 'button', onclick: async () => { try { const r = await api('/api/content', { content: draft }); state.contentData = null; state.draft = null; state.dirty = false; toast(r.unchanged ? 'No changes to save' : 'Saved'); refresh(); } catch (e) { toast(e.message); } } }, 'Save'))));
}

async function refresh(background) {
  if (!background) state.sig = undefined;
  // A background update never redraws under an open menu, dialog or unsaved form: it waits for the next tick.
  const busy = dlg.open || document.querySelector('details.menu[open]');
  if (!(background && busy)) {
    try {
      const [jobs, runner, progress] = await Promise.all([api('/api/jobs'), api('/api/runner').catch(() => null), api('/api/progress').catch(() => null)]);
      state.jobs = jobs; state.runner = runner;
      state.itemState = {};
      for (const j of state.jobs) if (j.status === 'active') for (const i of j.items) state.itemState[i.theme] = i.state;
      if (progress) paintSteps(progress);
      state.progress = progress;
      // Plain /studio opens where the person is in the flow: the first unfinished step.
      if (bare && progress && !refresh.routed) {
        refresh.routed = true;
        const to = !progress.content ? 'content' : !progress.persona && !progress.answers ? 'persona' : !progress.liked && !progress.designs ? 'explore' : null;
        if (to) { location.replace('/studio?view=' + to); return; }
      }
      paintActivity();
      // Background ticks redraw the page only when what it shows has changed.
      if (background) {
        const sig = await viewSignature();
        if (sig === state.sig) return schedule();
        state.sig = sig;
      }
      if (view === 'content') { if (!state.dirty) { state.contentData = null; state.draft = null; await renderContent(); } else if (!$('main').childElementCount) await renderContent(); }
      else if (view === 'persona') await renderPersona();
      else if (view === 'explore') await renderExplore();
      else if (view === 'compare') await renderCompare();
      else if (view === 'publish') await renderPublish();
      else if (params.get('d')) await renderDesign(params.get('d'));
      else renderLibrary(await api('/api/library'));
      if (!background) state.sig = await viewSignature().catch(() => undefined);
    } catch (e) { fill($('main'), h('div', { class: 'empty' }, 'Could not load: ' + e.message)); }
  }
  schedule();
}
// Claims don't touch watched files, so poll gently while something is being made.
function schedule() {
  clearTimeout(refresh.t);
  if (state.jobs.some((j) => j.status === 'active') || state.runner?.running) refresh.t = setTimeout(() => refresh(true), state.runner?.running ? 2500 : 5000);
}
// A cheap fingerprint of what the current view shows.
async function viewSignature() {
  const items = JSON.stringify(state.itemState);
  if (view === 'library' || view === 'compare') { const l = await api('/api/library'); return items + JSON.stringify(l.designs.map((d) => [d.id, d.pending, d.latest, d.favorite, d.archived, d.current, d.missing])) + l.current + l.publishes.length; }
  if (view === 'design') { const d = await api('/api/designs/' + encodeURIComponent(params.get('d'))).catch(() => ({})); return items + JSON.stringify((d.versions || []).map((v) => v.n)) + d.favorite + d.archived; }
  if (view === 'explore') { const x = await api('/api/sketches'); return JSON.stringify(x.rounds.map((r) => r.round)) + JSON.stringify(x.picks); }
  if (view === 'persona') { const x = await api('/api/persona'); return JSON.stringify(x.persona && [x.persona.n, x.persona.corrections?.length]); }
  if (view === 'content') return state.dirty ? 'dirty' : String(state.sig); // content redraws only on explicit saves
  return 'static';
}
refresh();
// Designs landing from agents refresh the view in place (no full reload, so filters and selection stay).
const es = new EventSource('/__folio/events');
es.addEventListener('boot', (e) => { if (e.data !== window.__boot) location.reload(); });
es.onmessage = () => refresh(true);
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
    <div class="steps">
      <a href="/studio?view=content" data-view="you"><i>1</i><span>You<small>content · how we read you</small></span></a>
      <a href="/studio?view=explore" data-view="explore"><i>2</i><span>Explore<small>like the looks that fit</small></span></a>
      <a href="/studio?view=library" data-view="library"><i>3</i><span>Designs<small>full sites · pick one</small></span></a>
      <a href="/studio?view=publish" data-view="publish"><i>4</i><span>Publish<small>go live · identity kit</small></span></a>
    </div>
    <div id="activity"></div>
    <div class="sidefoot">
      <a href="/" target="_blank" rel="noopener">View my site ↗</a>
      <button type="button" id="cleanup">Clean up…</button>
    </div>
  </nav>
  <main></main>
</div>
<div class="toast" role="status" aria-live="polite"></div>
<dialog id="dlg"><div class="dbody"></div></dialog>
<script>window.__boot=${JSON.stringify(boot)};${JS}</script>
</body></html>`;
}

