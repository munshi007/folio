import { esc, attrUrl, md, inline, dateRange, fmtDate, icon, linkKind, hostOf, ordered } from '../src/util.js';

export const meta = {
  name: 'terminal',
  description: 'Your portfolio as a shell session. Monospace, phosphor green, typed headline. Great for systems, backend, security, infra folks.',
};

const css = `
:root{--bg:#090c0a;--panel:#0e1310;--bar:#131a15;--ink:#d3e0d6;--dim:#6d8274;--line:rgba(120,255,170,.1);--accent:#4ade80;--amber:#fbbf24;--blue:#7dd3fc;--pink:#f9a8d4}
@media (prefers-color-scheme:light){:root{--bg:#ece9df;--panel:#fbfaf4;--bar:#f1eee4;--ink:#23271f;--dim:#7a7d70;--line:rgba(0,0,0,.09);--accent:#15803d;--amber:#b45309;--blue:#0369a1;--pink:#be185d}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font:400 15px/1.7 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-font-smoothing:antialiased;
  background-image:radial-gradient(ellipse at top,color-mix(in srgb,var(--accent) 9%,transparent),transparent 60%);background-attachment:fixed}
a{color:var(--blue);text-decoration:none;border-bottom:1px dotted currentColor}
a:hover{color:var(--accent)}
::selection{background:var(--accent);color:var(--bg)}
:focus-visible{outline:2px dashed var(--accent);outline-offset:3px}
.term{max-width:940px;margin:6vh auto;border:1px solid var(--line);border-radius:12px;background:var(--panel);box-shadow:0 30px 80px -20px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.2);overflow:hidden}
.bar{display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--bar);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}
.bar i{width:12px;height:12px;border-radius:50%;background:#ff5f57}.bar i:nth-child(2){background:#febc2e}.bar i:nth-child(3){background:#28c840}
.bar span{flex:1;text-align:center;color:var(--dim);font-size:13px;margin-right:52px}
.screen{padding:28px 34px 40px}
.cmd{margin:34px 0 12px;color:var(--dim)}
.cmd:first-child{margin-top:0}
.cmd b{color:var(--accent);font-weight:500}
.cmd .path{color:var(--blue)}
.cmd .arg{color:var(--ink)}
h1{font-size:clamp(2rem,6vw,3.6rem);line-height:1.05;margin:0;font-weight:800;letter-spacing:-.03em;color:var(--ink)}
h1 .cursor{display:inline-block;width:.55em;height:.9em;background:var(--accent);vertical-align:-.08em;margin-left:.12em;animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.typed{color:var(--accent);font-size:clamp(1rem,2.2vw,1.2rem);margin-top:12px;min-height:1.7em}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:2px 18px;margin-top:16px;color:var(--dim)}
.kv dt{color:var(--amber)}
.kv dd{margin:0;color:var(--ink)}
.kv a{display:inline-flex;gap:6px;align-items:center}
.status{color:var(--accent)}
.status::before{content:"●";margin-right:8px;animation:blink 2s steps(1) infinite}
.out p{margin:0 0 .9em;max-width:72ch}
.ls{display:grid;gap:4px}
.ls a,.ls div.it{display:grid;grid-template-columns:118px 1fr;gap:16px;padding:14px 12px;margin:0 -12px;border:0;border-radius:8px;color:var(--ink);transition:background .15s}
.ls a:hover{background:color-mix(in srgb,var(--accent) 8%,transparent)}
.ls .perm{color:var(--dim);font-size:13px;padding-top:2px}
.ls .nm{color:var(--blue);font-weight:700}
.ls .nm::after{content:"/";color:var(--dim)}
.ls .st{color:var(--amber);font-size:13px;margin-left:10px;font-weight:400}
.ls .ds{color:var(--ink);opacity:.85;margin-top:2px}
.ls .tg{color:var(--pink);font-size:13px;margin-top:6px}
.ls img{width:100%;border-radius:6px;border:1px solid var(--line);margin:10px 0 4px;aspect-ratio:16/9;object-fit:cover}
.ls ul,.log ul{margin:6px 0 0;padding-left:0;list-style:none}
.ls li::before,.log li::before{content:"+ ";color:var(--accent)}
.log .c{padding:4px 0 18px;border-left:2px solid var(--line);padding-left:18px;margin-left:4px;position:relative}
.log .c::before{content:"";position:absolute;left:-6px;top:10px;width:10px;height:10px;border-radius:50%;background:var(--panel);border:2px solid var(--accent)}
.log .h{color:var(--amber)}
.log .r{font-weight:700}
.log .o{color:var(--blue)}
.log .s{color:var(--ink);opacity:.85}
.json{white-space:pre-wrap;margin:0;font:inherit}
.json .k{color:var(--blue)}.json .v{color:var(--amber)}.json .p{color:var(--dim)}
.prompt-end{margin-top:36px;color:var(--dim)}
.prompt-end b{color:var(--accent);font-weight:500}
.prompt-end .cursor{display:inline-block;width:.6em;height:1.1em;background:var(--ink);vertical-align:-.2em;animation:blink 1.1s steps(1) infinite}
@media (prefers-reduced-motion:reduce){*{animation:none!important}html{scroll-behavior:auto}}
@media (max-width:700px){.term{margin:0;border-radius:0;border:0;min-height:100vh}.screen{padding:22px 16px 60px}.ls a,.ls div.it{grid-template-columns:1fr;gap:2px}.ls .perm{display:none}.kv{grid-template-columns:1fr;gap:0}.kv dt{margin-top:8px}}
`;

function cmd(c, arg = '') {
  return `<div class="cmd"><b>➜</b> <span class="path">~</span> ${esc(c)} <span class="arg">${esc(arg)}</span></div>`;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fmtStars(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

function project(x) {
  const href = x.url || x.repo;
  const inner = `<div class="perm">drwxr-xr-x</div><div>
<div><span class="nm">${esc(slug(x.name) || x.name)}</span>${x.stars != null ? `<span class="st">★ ${fmtStars(x.stars)}</span>` : ''}${x.year ? `<span class="st">${esc(x.year)}</span>` : ''}</div>
${x.featured && x.image ? `<img src="${attrUrl(x.image)}" alt="${esc(x.name)} screenshot" loading="lazy">` : ''}
${x.description ? `<div class="ds">${inline(x.description)}</div>` : ''}
${x.featured && x.highlights.length ? `<ul>${x.highlights.map((h) => `<li>${inline(h)}</li>`).join('')}</ul>` : ''}
${x.tags.length ? `<div class="tg">${x.tags.map((t) => `#${esc(t)}`).join(' ')}</div>` : ''}
</div>`;
  return href
    ? `<a href="${attrUrl(href)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="it">${inner}</div>`;
}

function skillsJson(groups) {
  const lines = ['<span class="p">{</span>'];
  groups.forEach((g, gi) => {
    const key = g.group || 'stack';
    const vals = g.items.map((i) => `<span class="v">"${esc(i)}"</span>`).join('<span class="p">, </span>');
    lines.push(`  <span class="k">"${esc(key.toLowerCase())}"</span><span class="p">: [</span>${vals}<span class="p">]${gi < groups.length - 1 ? ',' : ''}</span>`);
  });
  lines.push('<span class="p">}</span>');
  return `<pre class="json">${lines.join('\n')}</pre>`;
}

export function render(p) {
  const first = (p.name.split(/\s+/)[0] || 'me').toLowerCase();
  const parts = [];

  parts.push(cmd('whoami'));
  parts.push(`<h1>${esc(p.name)}<span class="cursor"></span></h1>`);
  if (p.headline) parts.push(`<div class="typed" data-text="${esc(p.headline)}">${esc(p.headline)}</div>`);
  parts.push(`<dl class="kv">
${p.status ? `<dt>status</dt><dd class="status">${esc(p.status)}</dd>` : ''}
${p.location ? `<dt>location</dt><dd>${esc(p.location)}</dd>` : ''}
${p.links.map((l) => `<dt>${esc(l.label.toLowerCase())}</dt><dd><a href="${attrUrl(l.url)}" target="_blank" rel="me noopener">${icon(linkKind(l.url), 14)}${esc(l.url.replace(/^mailto:/, '').replace(/^https?:\/\/(www\.)?/, ''))}</a></dd>`).join('\n')}
</dl>`);

  // Sections are blocks so style.sections can reorder them.
  const blocks = [];
  const block = (id, ...html) => blocks.push({ id, html: html.join('\n') });

  if (p.about) block('about', cmd('cat', 'about.md'), `<div class="out">${md(p.about)}</div>`);

  if (p.projects.length) {
    block('projects', cmd('ls -l', '~/projects'), `<div class="ls">${p.projects.map(project).join('\n')}</div>`);
  }

  if (p.experience.length) {
    block('experience',
      cmd('git log', '--career'),
      `<div class="log">${p.experience
        .map(
          (e) => `<div class="c"><div class="h">${esc(dateRange(e.start, e.end))}${e.location ? ` · ${esc(e.location)}` : ''}</div>
<div><span class="r">${esc(e.role)}</span>${e.org ? ` @ <span class="o">${e.url ? `<a href="${attrUrl(e.url)}" target="_blank" rel="noopener">${esc(e.org)}</a>` : esc(e.org)}</span>` : ''}</div>
${e.summary ? `<div class="s">${inline(e.summary)}</div>` : ''}
${e.highlights.length ? `<ul>${e.highlights.map((h) => `<li>${inline(h)}</li>`).join('')}</ul>` : ''}</div>`,
        )
        .join('\n')}</div>`,
    );
  }

  if (p.education.length) {
    block('education',
      cmd('cat', 'education.log'),
      `<div class="log">${p.education
        .map(
          (e) => `<div class="c"><div class="h">${esc(dateRange(e.start, e.end))}</div><div><span class="r">${esc(e.school)}</span></div>${e.degree ? `<div class="s">${esc(e.degree)}</div>` : ''}${e.details ? `<div class="s">${inline(e.details)}</div>` : ''}</div>`,
        )
        .join('\n')}</div>`,
    );
  }

  if (p.skills.length) block('skills', cmd('cat', 'stack.json'), skillsJson(p.skills));

  if (p.awards.length) {
    block('awards',
      cmd('grep -r', '"award" ~/'),
      `<div class="log">${p.awards
        .map((a) => `<div class="c"><div class="h">${esc(fmtDate(a.date))}</div><div><span class="r">${a.url ? `<a href="${attrUrl(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>` : esc(a.title)}</span>${a.org ? ` <span class="o">${esc(a.org)}</span>` : ''}</div></div>`)
        .join('\n')}</div>`,
    );
  }

  if (p.writing.length) {
    block('writing',
      cmd('ls', '~/writing'),
      `<div class="ls">${p.writing
        .map((w) => `<a href="${attrUrl(w.url)}" target="_blank" rel="noopener"><div class="perm">${esc(fmtDate(w.date)) || '-rw-r--r--'}</div><div><div class="ds">${esc(w.title)}</div><div class="tg">${esc(w.venue || hostOf(w.url))}</div></div></a>`)
        .join('\n')}</div>`,
    );
  }

  parts.push(...ordered(p, blocks).map((b) => b.html));

  const mail = p.links.find((l) => l.url.startsWith('mailto:'));
  if (mail) {
    parts.push(cmd('ping', mail.url.replace(/^mailto:/, '')), `<div class="out"><p>Inbox open. <a href="${attrUrl(mail.url)}">Say hello →</a></p></div>`);
  }

  parts.push(`<div class="prompt-end"><b>➜</b> ~ <span class="cursor"></span></div>`);

  const body = `<main class="term"><div class="bar"><i></i><i></i><i></i><span>${esc(first)}@portfolio: ~ — zsh</span></div><div class="screen">
${parts.join('\n')}
</div></main>`;

  // Type the headline once; full text is already in the DOM for no-JS, SEO and reduced motion.
  const script = `(()=>{const el=document.querySelector('.typed');if(!el||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const t=el.dataset.text;el.textContent='';let i=0;const tick=()=>{el.textContent=t.slice(0,++i);if(i<t.length)setTimeout(tick,22+Math.random()*40)};setTimeout(tick,450)})();`;

  return {
    fonts: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap',
    css,
    body,
    script,
    bg: '#ece9df',
    bgDark: '#090c0a',
  };
}
