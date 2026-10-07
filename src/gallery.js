// The /__folio/gallery page of `folio dev`: every design from a `folio generate` run, live, side by side.

import { join } from 'node:path';
import { esc } from './util.js';
import { readRun, latestRun, isPending, DIRECTIONS } from './generate.js';
import { loadTheme } from './themes.js';
import { checkTheme } from './themecheck.js';
import { liveReload } from './serve.js';

async function describe(base, theme) {
  try {
    const t = await loadTheme(theme, base);
    return { description: t.meta.description || '', theme: t };
  } catch (e) {
    return { description: '', error: e.message };
  }
}

async function runData(base, run) {
  const meta = await readRun(base, run);
  if (!meta) return null;
  const items = [];
  for (const b of meta.briefs) {
    const pending = await isPending(join(base, 'themes', `${b.theme}.js`));
    const { description, theme, error } = await describe(base, b.theme);
    const { errors, warnings } = error ? { errors: [error], warnings: [] } : pending ? { errors: [], warnings: [] } : checkTheme(theme);
    items.push({ ...b, pending, description, errors, warnings });
  }
  // Variation runs show the design they came from first, for comparison.
  if (meta.parent) {
    const { description, theme, error } = await describe(base, meta.parent);
    const { errors, warnings } = error ? { errors: [error], warnings: [] } : checkTheme(theme);
    items.unshift({ n: 0, theme: meta.parent, label: 'Original', original: true, pending: false, description, errors, warnings });
  }
  return { run, seed: meta.seed, parent: meta.parent ?? null, keep: meta.keep ?? null, items };
}

// Every run, newest first, so earlier rounds never disappear. `?run=n` narrows to one.
export async function galleryData(base, runParam) {
  const latest = await latestRun(base);
  if (!latest) return null;
  const only = Number(runParam) || null;
  const runs = [];
  for (let n = latest; n >= 1; n--) {
    if (only && n !== only) continue;
    const r = await runData(base, n);
    if (r) runs.push(r);
  }
  if (!runs.length) return null;
  const all = [];
  for (let n = latest; n >= 1; n--) {
    const meta = await readRun(base, n);
    if (meta) all.push({ run: n, parent: meta.parent ?? null, count: meta.briefs.length });
  }
  return { latest, only, runs, all };
}

export function galleryPage(data, { name, current }) {
  if (!data) {
    return `<!doctype html><meta charset="utf-8"><title>folio gallery</title>
<body style="font:15px/1.6 ui-sans-serif,system-ui;background:#0c0c0d;color:#ddd;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="max-width:480px;text-align:center"><h1 style="font-weight:600">No designs yet</h1>
<p>Run <code>folio generate</code> (or ask your agent to "generate designs for my portfolio"). This page fills in live as each design lands.</p></div>
<script>${liveReload()}</script></body>`;
  }
  const first = esc(String(name).split(/\s+/)[0] || 'you');
  const card = (it, i) => {
    const status = it.pending
      ? '<span class="st pending"><i></i>designing…</span>'
      : it.errors.length
        ? `<span class="st bad" title="${esc(it.errors.join('\n'))}">${it.errors.length} error${it.errors.length > 1 ? 's' : ''}</span>`
        : `<span class="st ok" title="${esc(it.warnings.join('\n'))}">✓ checks pass${it.warnings.length ? ` · ${it.warnings.length} note${it.warnings.length > 1 ? 's' : ''}` : ''}</span>`;
    const src = `/?theme=${encodeURIComponent(it.theme)}&embed=1`;
    return `<article class="card${it.pending ? ' is-pending' : ''}${it.original ? ' is-original' : ''}${it.theme === current ? ' is-current' : ''}" style="--d:${i * 70}ms">
<div class="stage">
  <div class="desk"><iframe src="${src}" loading="lazy" tabindex="-1" title="${esc(it.theme)} desktop"></iframe></div>
  <div class="phone"><iframe src="${src}" loading="lazy" tabindex="-1" title="${esc(it.theme)} phone"></iframe></div>
  ${it.pending ? '<div class="veil"><div class="spin"></div><p>an agent is designing this one</p></div>' : ''}
</div>
<div class="info">
  <div class="top"><span class="n">${it.original ? 'OG' : String(it.n).padStart(2, '0')}</span><h3>${esc(it.label ?? DIRNAME[it.direction] ?? it.direction)}</h3>${it.wildcard ? '<span class="wild">wildcard</span>' : ''}${it.original ? '<span class="wild">you liked this</span>' : ''}${status}</div>
  <p class="desc">${it.pending ? esc(it.detail ?? `${it.layout}. ${it.signature}.`) : esc(it.description)}</p>
  <div class="actions">
    ${it.theme === current
      ? `<a class="cur" href="/">★ Your site · view →</a>`
      : `<button data-use="${esc(it.theme)}"${it.pending || it.errors.length ? ' disabled' : ''}>Make this my site</button>`}
    <a href="/?theme=${encodeURIComponent(it.theme)}" target="_blank" rel="noopener">Open ↗</a>
    <details class="more"><summary>More like this ▾</summary><div class="menu"><p>What do you like about it? That stays; the rest changes.</p>${KEEP_CHOICES.map(([k, label]) => `<button data-copy="More like ${esc(it.theme)}, keep the ${esc(label)}" data-hint="Copied. Paste it to your agent (it runs: folio generate --like ${esc(it.theme)} --keep ${k})">${esc(label)}</button>`).join('')}</div></details>
    <button class="ghost" data-copy="Remix ${esc(it.theme)}: keep its ___ but ___">Remix…</button>
    <code>${esc(it.theme)}</code>
  </div>
</div>
</article>`;
  };

  const runTitle = (r) => (r.parent ? `More like <em>${esc(r.parent)}</em>` : `${r.items.length} directions`);
  const runShort = (r) => (r.parent ? `More like ${esc(r.parent)}` : `${r.count} directions`);
  const sections = data.runs
    .map((r) => {
      const designs = r.items.filter((i) => !i.original);
      const done = designs.filter((i) => !i.pending).length;
      const sub = r.parent
        ? r.keep
          ? `The original first, then ${designs.length} siblings that keep its ${esc(r.keep)} and change two big things each.`
          : `The original first, then ${designs.length} siblings, each changing one thing (an older run, made before variations changed two things).`
        : `Same content, ${designs.length} different designers. Hover a card to see it on a phone.`;
      return `<section class="run" id="run-${r.run}">
<div class="rh"><div><span class="rn">Round ${r.run}</span><h2>${runTitle(r)}</h2><p class="sub">${sub}</p></div>
<div class="meta">seed ${esc(String(r.seed))}<br><b>${done}</b> of ${designs.length} designed<div class="bar"><i style="width:${Math.round((done / Math.max(designs.length, 1)) * 100)}%"></i></div></div></div>
<div class="grid">${r.items.map(card).join('\n')}</div>
</section>`;
    })
    .join('\n');
  const total = data.all.reduce((n, r) => n + r.count, 0);
  const nav = data.all.length > 1 || data.only
    ? `<nav class="runs">${data.only ? '<a href="/__folio/gallery">All rounds</a>' : ''}${data.all
        .map((r) => `<a href="${data.only ? `?run=${r.run}` : `#run-${r.run}`}"${data.only === r.run ? ' aria-current="true"' : ''}><b>${r.run}</b> ${runShort(r)}</a>`)
        .join('')}</nav>`
    : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${first}'s designs · folio</title>
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
.bar i{display:block;height:100%;background:var(--acc);transition:width .6s}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:28px}
main{padding:0 40px 80px;max-width:1680px;margin:0 auto}
.run{padding-top:28px;margin-top:28px;border-top:1px solid var(--line);scroll-margin-top:12px}
.run:first-child{border-top:0;margin-top:0}
.rh{display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:end;margin-bottom:20px}
.rn{font:500 12px "Geist Mono",monospace;color:var(--acc);letter-spacing:.08em;text-transform:uppercase}
h2{font:400 clamp(1.8rem,3.4vw,2.8rem)/1 "Instrument Serif",Georgia,serif;margin:6px 0 0}
h2 em{color:var(--acc)}
.runs{display:flex;flex-wrap:wrap;gap:8px;align-self:end}
.runs a{color:var(--ink);text-decoration:none;font:500 13px "Hanken Grotesk",sans-serif;padding:8px 12px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--line)}
.runs a b{font:500 12px "Geist Mono",monospace;color:var(--acc);margin-right:4px}
.runs a:hover,.runs a[aria-current]{background:#1d1d20}
.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;overflow:hidden;opacity:0;transform:translateY(12px);animation:in .6s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--d,0ms)}
.card.is-original{border-style:dashed}
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
h3{font:400 1.7rem/1 "Instrument Serif",Georgia,serif;margin:0}
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
.more{position:relative}
.more summary{list-style:none;cursor:pointer;font:500 13.5px "Hanken Grotesk",sans-serif;padding:9px 14px;border-radius:10px;box-shadow:inset 0 0 0 1px var(--line)}
.more summary::-webkit-details-marker{display:none}
.more[open] summary{background:var(--ink);color:#111}
.more .menu{position:absolute;bottom:calc(100% + 8px);left:0;z-index:5;width:260px;background:#1d1d20;border:1px solid var(--line);border-radius:14px;padding:8px;display:grid;gap:2px;box-shadow:0 18px 50px rgba(0,0,0,.5)}
.more .menu p{margin:4px 8px 8px;color:var(--mute);font-size:12.5px}
.more .menu button{all:unset;cursor:pointer;padding:9px 10px;border-radius:8px;color:var(--ink);font-size:14px}
.more .menu button:hover,.more .menu button:focus-visible{background:#2a2a2e}
.actions button[disabled]{opacity:.35;cursor:not-allowed}
.actions :focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.actions code{margin-left:auto;font:400 12px "Geist Mono",monospace;color:var(--mute)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);opacity:0;background:var(--ink);color:#111;padding:10px 16px;border-radius:12px;font-weight:500;transition:all .3s;pointer-events:none}
.toast.on{opacity:1;transform:translateX(-50%)}
@media (max-width:700px){header{padding:36px 18px 18px}.meta{text-align:left}.bar{margin-left:0}main{padding:0 14px 60px}.grid{gap:18px}}
@media (prefers-reduced-motion:reduce){.card{animation:none;opacity:1;transform:none}.spin,.st.pending i{animation:none}}
</style></head><body>
<header>
  <div><h1>${total} versions of <em>${first}</em></h1>
  <p class="sub">Every design from every round, newest first. Nothing gets thrown away: keep exploring, or come back to an earlier one.</p></div>
  ${nav}
</header>
<main>${sections}</main>
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
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{const d=b.closest('details');if(d)d.open=false;navigator.clipboard&&navigator.clipboard.writeText(b.dataset.copy);toast(b.dataset.hint||'Copied, paste it to your agent and fill the blanks')});
${liveReload('window.__folioLeaving')}
})()</script></body></html>`;
}

const DIRNAME = Object.fromEntries(DIRECTIONS.map((d) => [d.id, d.name]));
const KEEP_CHOICES = [['vibe', 'overall vibe'], ['colors', 'colors'], ['type', 'typography'], ['layout', 'layout'], ['signature', 'signature moment']];
