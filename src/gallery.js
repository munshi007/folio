// The /__folio/gallery page of `folio dev`: every design from a `folio generate` run, live, side by side.

import { join } from 'node:path';
import { esc } from './util.js';
import { readRun, latestRun, isPending, DIRECTIONS } from './generate.js';
import { loadTheme } from './themes.js';
import { checkTheme } from './themecheck.js';
import { liveReload } from './serve.js';

export async function galleryData(base, runParam) {
  const run = Number(runParam) || (await latestRun(base));
  if (!run) return null;
  const meta = await readRun(base, run);
  if (!meta) return null;
  const items = [];
  for (const b of meta.briefs) {
    const file = join(base, 'themes', `${b.theme}.js`);
    const pending = await isPending(file);
    let description = '';
    let errors = [];
    let warnings = [];
    try {
      const t = await loadTheme(b.theme, base);
      description = t.meta.description || '';
      if (!pending) ({ errors, warnings } = checkTheme(t));
    } catch (e) {
      errors = [e.message];
    }
    items.push({ ...b, pending, description, errors, warnings });
  }
  return { run, latest: await latestRun(base), seed: meta.seed, items };
}

export function galleryPage(data, { name, current }) {
  if (!data) {
    return `<!doctype html><meta charset="utf-8"><title>folio gallery</title>
<body style="font:15px/1.6 ui-sans-serif,system-ui;background:#0c0c0d;color:#ddd;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="max-width:480px;text-align:center"><h1 style="font-weight:600">No designs yet</h1>
<p>Run <code>folio generate</code> (or ask your agent to "generate designs for my portfolio"). This page fills in live as each design lands.</p></div>
<script>${liveReload()}</script></body>`;
  }
  const done = data.items.filter((i) => !i.pending).length;
  const first = esc(String(name).split(/\s+/)[0] || 'you');
  const cards = data.items
    .map((it) => {
      const status = it.pending
        ? '<span class="st pending"><i></i>designing…</span>'
        : it.errors.length
          ? `<span class="st bad" title="${esc(it.errors.join('\n'))}">${it.errors.length} error${it.errors.length > 1 ? 's' : ''}</span>`
          : `<span class="st ok" title="${esc(it.warnings.join('\n'))}">✓ checks pass${it.warnings.length ? ` · ${it.warnings.length} note${it.warnings.length > 1 ? 's' : ''}` : ''}</span>`;
      const src = `/?theme=${encodeURIComponent(it.theme)}&embed=1`;
      return `<article class="card${it.pending ? ' is-pending' : ''}${it.theme === current ? ' is-current' : ''}">
<div class="stage">
  <div class="desk"><iframe src="${src}" loading="lazy" tabindex="-1" title="${esc(it.theme)} desktop"></iframe></div>
  <div class="phone"><iframe src="${src}" loading="lazy" tabindex="-1" title="${esc(it.theme)} phone"></iframe></div>
  ${it.pending ? '<div class="veil"><div class="spin"></div><p>an agent is designing this one</p></div>' : ''}
</div>
<div class="info">
  <div class="top"><span class="n">${String(it.n).padStart(2, '0')}</span><h2>${esc(DIRNAME[it.direction] ?? it.direction)}</h2>${it.wildcard ? '<span class="wild">wildcard</span>' : ''}${status}</div>
  <p class="desc">${it.pending ? esc(`${it.layout}. ${it.signature}.`) : esc(it.description)}</p>
  <div class="actions">
    ${it.theme === current
      ? `<a class="cur" href="/">★ Your site · view →</a>`
      : `<button data-use="${esc(it.theme)}"${it.pending || it.errors.length ? ' disabled' : ''}>Make this my site</button>`}
    <a href="/?theme=${encodeURIComponent(it.theme)}" target="_blank" rel="noopener">Open ↗</a>
    <button class="ghost" data-copy="Remix ${esc(it.theme)}: keep its ___ but ___">Remix…</button>
    <code>${esc(it.theme)}</code>
  </div>
</div>
</article>`;
    })
    .join('\n');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${first} × ${data.items.length} · folio</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@400;500&family=Hanken+Grotesk:wght@400;500;600&display=swap">
<style>
:root{--bg:#0b0b0c;--panel:#141416;--line:rgba(255,255,255,.08);--ink:#f2f1ee;--mute:#8d8b86;--acc:#c8ff5a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 15px/1.55 "Hanken Grotesk",ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
header{padding:56px 40px 28px;display:flex;flex-wrap:wrap;gap:24px;align-items:end;justify-content:space-between;max-width:1680px;margin:0 auto}
h1{font:400 clamp(2.6rem,6vw,5.2rem)/.95 "Instrument Serif",Georgia,serif;letter-spacing:-.02em;margin:0}
h1 em{color:var(--acc)}
.sub{color:var(--mute);margin:12px 0 0;max-width:56ch}
.meta{font:400 12px/1.8 "Geist Mono",ui-monospace,monospace;color:var(--mute);text-align:right}
.meta b{color:var(--ink);font-weight:500}
.bar{height:2px;background:var(--line);border-radius:2px;overflow:hidden;margin-top:8px;width:220px;margin-left:auto}
.bar i{display:block;height:100%;background:var(--acc);width:${Math.round((done / data.items.length) * 100)}%;transition:width .6s}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:28px;padding:12px 40px 80px;max-width:1680px;margin:0 auto}
.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;overflow:hidden;opacity:0;transform:translateY(12px);animation:in .6s cubic-bezier(.2,.8,.2,1) forwards}
${data.items.map((_, i) => `.card:nth-child(${i + 1}){animation-delay:${i * 70}ms}`).join('')}
@keyframes in{to{opacity:1;transform:none}}
.card.is-current{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
.stage{position:relative;aspect-ratio:16/10;overflow:hidden;background:#1b1b1e;border-bottom:1px solid var(--line)}
.desk,.phone{position:absolute;overflow:hidden;pointer-events:none}
.desk{inset:0}
.desk iframe{width:1440px;height:900px;border:0;transform-origin:0 0;transform:scale(var(--s,.4))}
.phone{right:16px;bottom:-30%;width:22%;aspect-ratio:390/844;border-radius:16px;border:3px solid #050505;box-shadow:0 18px 50px rgba(0,0,0,.55);transition:bottom .4s cubic-bezier(.2,.8,.2,1);background:#fff}
.card:hover .phone{bottom:14px}
.phone iframe{width:390px;height:844px;border:0;transform-origin:0 0;transform:scale(var(--p,.3))}
.veil{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:14px;background:rgba(11,11,12,.72);backdrop-filter:blur(6px);color:var(--mute);font:400 13px "Geist Mono",monospace}
.veil p{margin:0}
.spin{width:28px;height:28px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--acc);animation:sp 1s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.info{padding:18px 20px 20px}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.n{font:500 12px "Geist Mono",monospace;color:var(--mute)}
h2{font:400 1.7rem/1 "Instrument Serif",Georgia,serif;margin:0}
.wild{font:500 10.5px "Geist Mono",monospace;letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:6px;background:rgba(200,255,90,.12);color:var(--acc)}
.st{margin-left:auto;font:400 12px "Geist Mono",monospace;color:var(--mute);display:inline-flex;gap:6px;align-items:center}
.st.ok{color:#9be37a}.st.bad{color:#ff8a7a}
.st.pending i{width:6px;height:6px;border-radius:50%;background:var(--acc);animation:bl 1.2s infinite}
@keyframes bl{50%{opacity:.2}}
.desc{color:var(--mute);margin:8px 0 14px;min-height:3.1em;font-size:14.5px}
.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.actions button,.actions a{all:unset;cursor:pointer;font:500 13.5px "Hanken Grotesk",sans-serif;padding:9px 14px;border-radius:10px;background:var(--ink);color:#111;transition:transform .15s}
.actions button:hover:not([disabled]),.actions a:hover{transform:translateY(-1px)}
.actions a,.actions .ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.actions a.cur{background:var(--acc);color:#111;box-shadow:none}
.actions button[disabled]{opacity:.35;cursor:not-allowed}
.actions :focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.actions code{margin-left:auto;font:400 12px "Geist Mono",monospace;color:var(--mute)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);opacity:0;background:var(--ink);color:#111;padding:10px 16px;border-radius:12px;font-weight:500;transition:all .3s;pointer-events:none}
.toast.on{opacity:1;transform:translateX(-50%)}
@media (max-width:700px){header{padding:36px 18px 18px}.meta{text-align:left}.bar{margin-left:0}main{padding:8px 14px 60px;gap:18px}}
@media (prefers-reduced-motion:reduce){.card{animation:none;opacity:1;transform:none}.spin,.st.pending i{animation:none}}
</style></head><body>
<header>
  <div><h1>${data.items.length} versions of <em>${first}</em></h1>
  <p class="sub">Same content, ${data.items.length} different designers. Hover a card to see it on a phone, open it to click around, then keep the one that feels like you.</p></div>
  <div class="meta">run <b>#${data.run}</b> · seed ${esc(String(data.seed))}<br><b>${done}</b> of ${data.items.length} designed${data.latest && data.latest !== data.run ? `<br><a href="?run=${data.latest}" style="color:var(--acc)">latest run →</a>` : ''}<div class="bar"><i></i></div></div>
</header>
<main>${cards}</main>
<div class="toast" role="status"></div>
<script>(()=>{
let leaving=false;
const fit=()=>document.querySelectorAll('.stage').forEach(s=>{const w=s.clientWidth;s.querySelector('.desk').style.setProperty('--s',w/1440);const ph=s.querySelector('.phone');ph.style.setProperty('--p',ph.clientWidth/390)});
fit();addEventListener('resize',fit);
const toast=(t)=>{const el=document.querySelector('.toast');el.textContent=t;el.classList.add('on');setTimeout(()=>el.classList.remove('on'),1800)};
document.querySelectorAll('[data-use]').forEach(b=>b.onclick=async()=>{
  b.textContent='Saving…';leaving=window.__folioLeaving=true;
  const r=await fetch('/__folio/style',{method:'POST',headers:{'Content-Type':'application/json','X-Folio':'1'},body:JSON.stringify({key:'adopt',value:b.dataset.use})});
  if(!r.ok){leaving=window.__folioLeaving=false;b.textContent='Make this my site';toast('Could not save: '+await r.text());return}
  // Go see it right away: your real site on this design, with the control bar to keep tweaking.
  // (Saving folio.json also fires the live-reload event; "leaving" stops it from yanking us back here.)
  location.href='/?adopted='+encodeURIComponent(b.dataset.use)});
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(b.dataset.copy);toast('Copied, paste it to your agent and fill the blanks')});
${liveReload('window.__folioLeaving')}
})()</script></body></html>`;
}

const DIRNAME = Object.fromEntries(DIRECTIONS.map((d) => [d.id, d.name]));
