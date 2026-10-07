// Blueprint: the portfolio as an engineering drawing. Drafting grid, title block, figure labels, spec tables.
// The first theme made with the `folio design` loop (skills/folio/DESIGN.md), on a real profile, in 3 rounds.

export const meta = {
  name: 'blueprint',
  description: 'Engineering drawing: drafting grid, title block, FIG. labels, spec tables. For infra, data, ML and anyone whose work is about rigor.',
};

export function render(p, h) {
  const fonts = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap';

  const css = `
:root{--paper:#f3f6fa;--ink:#0d2a5c;--soft:#46608f;--faint:rgba(13,42,92,.075);--rule:rgba(13,42,92,.22);--accent:#d9480f;--card:rgba(255,255,255,.55);
  --mono:"IBM Plex Mono",ui-monospace,monospace;--sans:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root{--paper:#0b1d3a;--ink:#dce8ff;--soft:#93acd6;--faint:rgba(170,200,255,.07);--rule:rgba(170,200,255,.24);--accent:#ffb020;--card:rgba(10,30,62,.6)}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;color:var(--ink);font:400 16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;background-color:var(--paper);
  background-image:linear-gradient(var(--faint) 1px,transparent 1px),linear-gradient(90deg,var(--faint) 1px,transparent 1px),
    linear-gradient(var(--faint) 1px,transparent 1px),linear-gradient(90deg,var(--faint) 1px,transparent 1px);
  background-size:120px 120px,120px 120px,24px 24px,24px 24px;background-position:-1px -1px}
a{color:inherit;text-decoration:underline;text-decoration-color:var(--rule);text-underline-offset:3px}
a:hover{color:var(--accent);text-decoration-color:currentColor}
:focus-visible{outline:2px dashed var(--accent);outline-offset:3px}
::selection{background:var(--accent);color:var(--paper)}
.sheet{max-width:1120px;margin:28px auto 80px;border:1.5px solid var(--ink);position:relative;background:linear-gradient(var(--paper),var(--paper)) padding-box}
.sheet::before{content:"";position:absolute;inset:6px;border:1px solid var(--rule);pointer-events:none}
.mono{font-family:var(--mono)}
.label{font:500 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--soft)}
.strip{display:flex;justify-content:space-between;gap:16px;padding:14px 28px;border-bottom:1px solid var(--rule)}
.strip nav{display:flex;gap:20px}
.strip a{text-decoration:none}
.hero{display:grid;grid-template-columns:1fr 340px;border-bottom:1.5px solid var(--ink)}
.hero .main{padding:72px 28px 0;border-right:1px solid var(--rule);display:flex;flex-direction:column}
.dims{margin:auto -28px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));border-top:1px solid var(--rule);margin-top:auto}
.dims div{padding:18px 28px;border-right:1px solid var(--rule)}
.dims div:last-child{border-right:0}
.dims b{display:block;font:600 2rem/1 var(--sans);letter-spacing:-.02em}
.dims span{display:block;margin-top:8px}
.hero .lede{padding-bottom:48px}
h1,h2,h3,.hl{text-wrap:balance}
h1{font:700 clamp(3rem,7.4vw,6.4rem)/.92 var(--sans);letter-spacing:-.035em;margin:18px 0 0}
.dim{display:flex;align-items:center;gap:10px;margin:26px 0 0;color:var(--accent);font:500 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase}
.dim::before,.dim::after{content:"";height:1px;background:currentColor;flex:1;max-width:120px}
.dim::before{max-width:28px}
.hl{font:400 clamp(1.25rem,2.3vw,1.7rem)/1.35 var(--sans);margin:22px 0 0;max-width:30ch}
.block{display:grid;align-content:start}
.block .cell{padding:14px 22px;border-bottom:1px solid var(--rule)}
.block .cell:last-child{border-bottom:0}
.block .v{margin-top:6px;font-size:15px;word-break:break-word}
.block .v a{display:flex;align-items:center;gap:8px;text-decoration:none;padding:3px 0}
.block .v a:hover{color:var(--accent)}
.ava{width:100%;aspect-ratio:1;object-fit:cover;display:block;filter:grayscale(1) contrast(1.05);mix-blend-mode:multiply;border-bottom:1px solid var(--rule)}
@media (prefers-color-scheme:dark){.ava{mix-blend-mode:normal;filter:grayscale(1) contrast(1.05) brightness(.9)}}
section{border-bottom:1px solid var(--rule)}
.sec-head{display:flex;align-items:baseline;gap:18px;padding:22px 28px;border-bottom:1px solid var(--rule)}
.sec-head h2{font:600 13px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;margin:0}
.sec-head .n{color:var(--accent);font:600 13px/1 var(--mono)}
.sec-head .rule{flex:1;height:1px;background:repeating-linear-gradient(90deg,var(--rule) 0 6px,transparent 6px 10px)}
.about{padding:40px 28px;display:grid;grid-template-columns:200px 1fr;gap:28px}
.about .txt{font-size:1.2rem;line-height:1.6;max-width:64ch}
.about .txt p{margin:0 0 .9em}
.about .txt strong{background:linear-gradient(transparent 62%,color-mix(in srgb,var(--accent) 30%,transparent) 0)}
.figs{display:grid;grid-template-columns:repeat(2,1fr)}
.fig{position:relative;padding:30px 28px 28px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);text-decoration:none;display:block;transition:background .2s}
.figs .fig:nth-child(2n){border-right:0}
a.fig:hover{background:var(--card)}
.fig::before,.fig::after{content:"";position:absolute;width:14px;height:14px;border:0 solid var(--accent);opacity:0;transition:opacity .2s}
.fig::before{top:10px;left:10px;border-top-width:1.5px;border-left-width:1.5px}
.fig::after{bottom:10px;right:10px;border-bottom-width:1.5px;border-right-width:1.5px}
a.fig:hover::before,a.fig:hover::after{opacity:1}
.fig .top{display:flex;justify-content:space-between;gap:12px}
.fig h3{font:600 1.55rem/1.15 var(--sans);letter-spacing:-.015em;margin:12px 0 0;display:flex;gap:10px;align-items:baseline}
.fig h3 svg{flex:none;color:var(--soft);transition:transform .2s,color .2s}
a.fig:hover h3 svg{color:var(--accent);transform:translate(2px,-2px)}
.fig p{margin:10px 0 0;color:var(--soft)}
.fig ul{margin:12px 0 0;padding:0;list-style:none}
.fig li{position:relative;padding-left:22px;margin:6px 0;font-size:15px}
.fig li::before{content:"→";position:absolute;left:0;color:var(--accent);font-family:var(--mono)}
.fig img{width:100%;aspect-ratio:16/9;object-fit:cover;border:1px solid var(--rule);margin:14px 0 0}
.specs{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}
.specs span{font:500 11.5px/1 var(--mono);padding:6px 8px;border:1px solid var(--rule);color:var(--soft)}
.specs .hot{border-color:var(--accent);color:var(--accent)}
.fig.small h3{font-size:1.2rem}
.figs .fig:last-child:nth-child(odd){grid-column:1/-1;border-right:0}
table{width:100%;border-collapse:collapse}
th{font:500 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--soft);text-align:left;padding:12px 28px;border-bottom:1px solid var(--rule)}
td{padding:20px 28px;border-bottom:1px solid var(--rule);vertical-align:top}
tr:last-child td{border-bottom:0}
td.when{font:500 13px/1.5 var(--mono);color:var(--soft);white-space:nowrap;width:190px}
td .role{font-weight:600;font-size:1.06rem}
td .org{color:var(--accent);font-weight:500}
td .org a{text-decoration:none}
td .loc{font:400 12.5px/1.4 var(--mono);color:var(--soft);margin-top:4px}
td ul{margin:8px 0 0;padding-left:18px;color:var(--soft)}
td li{margin:4px 0}
td p{margin:8px 0 0;color:var(--soft)}
.kv{display:grid;grid-template-columns:200px 1fr}
.kv>div{padding:16px 28px;border-bottom:1px solid var(--rule)}
.kv>div:nth-last-child(-n+2){border-bottom:0}
.kv .k{font:500 12px/1.6 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--soft)}
.chips{display:flex;flex-wrap:wrap;gap:6px 14px}
.chips span::before{content:"▪ ";color:var(--accent)}
footer{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:end;padding:56px 28px 28px}
footer h2{font:700 clamp(2rem,4.4vw,3.4rem)/1 var(--sans);letter-spacing:-.03em;margin:10px 0 0}
footer h2 a{text-decoration:none;border-bottom:3px solid var(--accent)}
footer .fine{font:400 12px/1.6 var(--mono);color:var(--soft);text-align:right}
@media (max-width:860px){
  .dims{margin:28px -18px 0;grid-template-columns:1fr 1fr}.dims div{padding:14px 18px;border-bottom:1px solid var(--rule)}.dims div:nth-child(2n){border-right:0}.dims div:nth-last-child(-n+2):nth-child(odd),.dims div:last-child{border-bottom:0}.dims b{font-size:1.5rem}
  .block .ava{object-position:50% 25%}
  .sheet{margin:0;border-left:0;border-right:0}.sheet::before{display:none}
  .strip nav{display:none}
  .hero{grid-template-columns:1fr}.hero .main{border-right:0;border-bottom:1px solid var(--rule);padding:48px 18px 0}.hero .lede{padding-bottom:8px}
  .block{grid-template-columns:96px 1fr}.block .ava{grid-row:span 3;height:100%;aspect-ratio:auto;border-bottom:0;border-right:1px solid var(--rule)}
  .strip,.sec-head,.about,.fig,th,td,.kv>div,footer{padding-left:18px;padding-right:18px}
  .about{grid-template-columns:1fr;gap:10px}
  .figs{grid-template-columns:1fr}.fig{border-right:0}
  thead{display:none}tr{display:block;border-bottom:1px solid var(--rule)}tr:last-child{border-bottom:0}
  td{display:block;border:0;padding-top:4px;padding-bottom:4px}td.when{width:auto;padding-top:18px}tr td:last-child{padding-bottom:18px}
  .kv{grid-template-columns:1fr}.kv>div{border-bottom:0;padding-top:6px;padding-bottom:6px}.kv .k{padding-top:16px}
  footer{grid-template-columns:1fr}footer .fine{text-align:left}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}html{scroll-behavior:auto}}
@media print{body{background:#fff}.sheet{margin:0}}
`;

  const pad = (n) => String(n).padStart(2, '0');
  const ext = (url, label) => `<a href="${h.attrUrl(url)}" target="_blank" rel="noopener">${label}</a>`;

  // ---- Hero: name + title block ------------------------------------------------------------
  const mail = p.links.find((l) => l.url.startsWith('mailto:'));
  const now = new Date();
  const rev = `${now.getFullYear()}.${pad(now.getMonth() + 1)}`;

  const blockCells = [];
  if (p.avatar) blockCells.push(`<img class="ava" src="${h.attrUrl(p.avatar)}" alt="${h.esc(p.name)}">`);
  if (p.location) blockCells.push(`<div class="cell"><div class="label">Location</div><div class="v">${h.esc(p.location)}</div></div>`);
  if (p.status) blockCells.push(`<div class="cell"><div class="label">Status</div><div class="v">${h.esc(p.status)}</div></div>`);
  if (p.links.length) {
    blockCells.push(`<div class="cell"><div class="label">Links</div><div class="v">${p.links
      .map((l) => `<a href="${h.attrUrl(l.url)}" target="_blank" rel="me noopener">${h.icon(h.linkKind(l.url), 15)}${h.esc(l.label)}</a>`)
      .join('')}</div></div>`);
  }

  // "Dimensions": facts computed from the profile itself, never invented.
  const years = p.experience.map((e) => parseInt(e.start, 10)).filter((y) => y > 1950);
  const stars = p.projects.reduce((n, x) => n + (x.stars || 0), 0);
  const dims = [
    years.length ? [`${now.getFullYear() - Math.min(...years)}+`, 'years building'] : null,
    p.experience.length > 1 ? [p.experience.length, 'roles'] : null,
    p.projects.length ? [p.projects.length, p.projects.length === 1 ? 'project' : 'projects'] : null,
    stars ? [`★ ${stars.toLocaleString('en-US')}`, 'github stars'] : null,
  ].filter(Boolean);

  const sections = [];
  const sec = (id, title, html) => sections.push({ id, title, html });

  if (p.about) {
    sec('about', 'Abstract', `<div class="about"><div class="label">Summary</div><div class="txt">${h.md(p.about)}</div></div>`);
  }

  if (p.projects.length) {
    const featured = p.projects.filter((x) => x.featured);
    const rest = p.projects.filter((x) => !x.featured);
    let fig = 0;
    const card = (x, small) => {
      fig += 1;
      const href = x.url || x.repo;
      const tag = href ? 'a' : 'div';
      const attrs = href ? ` href="${h.attrUrl(href)}" target="_blank" rel="noopener"` : '';
      const specs = [
        x.stars != null ? `<span class="hot">★ ${x.stars.toLocaleString('en-US')}</span>` : '',
        x.year ? `<span>${h.esc(x.year)}</span>` : '',
        ...x.tags.slice(0, small ? 3 : 5).map((t) => `<span>${h.esc(t)}</span>`),
      ].join('');
      return `<${tag} class="fig${small ? ' small' : ''}"${attrs}>
<div class="top"><span class="label">Fig. ${pad(fig)}</span>${href ? `<span class="label">${h.esc(h.hostOf(href))}</span>` : ''}</div>
<h3>${h.esc(x.name)}${href ? h.icon('arrow', 18) : ''}</h3>
${!small && x.image ? `<img src="${h.attrUrl(x.image)}" alt="${h.esc(x.name)} screenshot" loading="lazy">` : ''}
${x.description ? `<p>${h.inline(x.description)}</p>` : ''}
${!small && x.highlights.length ? `<ul>${x.highlights.map((t) => `<li>${h.inline(t)}</li>`).join('')}</ul>` : ''}
${specs ? `<div class="specs">${specs}</div>` : ''}
</${tag}>`;
    };
    // Keep the 2-column grid even: a lone featured card pulls the first small one up beside it.
    sec('projects', 'Figures', `<div class="figs">${featured.map((x) => card(x, false)).join('')}${rest.map((x) => card(x, true)).join('')}</div>`);
  }

  if (p.experience.length) {
    sec(
      'experience',
      'Record',
      `<table><thead><tr><th>Period</th><th>Role</th></tr></thead><tbody>${p.experience
        .map(
          (e) => `<tr><td class="when">${h.esc(h.dateRange(e.start, e.end))}</td><td>
<div class="role">${h.esc(e.role)}</div>
${e.org ? `<div class="org">${e.url ? ext(e.url, h.esc(e.org)) : h.esc(e.org)}</div>` : ''}
${e.location ? `<div class="loc">${h.esc(e.location)}</div>` : ''}
${e.summary ? `<p>${h.inline(e.summary)}</p>` : ''}
${e.highlights.length ? `<ul>${e.highlights.map((t) => `<li>${h.inline(t)}</li>`).join('')}</ul>` : ''}
</td></tr>`,
        )
        .join('')}</tbody></table>`,
    );
  }

  if (p.skills.length) {
    sec(
      'skills',
      'Specification',
      `<div class="kv">${p.skills
        .map((g) => `<div class="k">${h.esc(g.group || 'Stack')}</div><div class="chips">${g.items.map((i) => `<span>${h.esc(i)}</span>`).join('')}</div>`)
        .join('')}</div>`,
    );
  }

  if (p.education.length) {
    sec(
      'education',
      'Education',
      `<table><tbody>${p.education
        .map(
          (e) => `<tr><td class="when">${h.esc(h.dateRange(e.start, e.end)) || '—'}</td><td><div class="role">${h.esc(e.school)}</div>${e.degree ? `<div class="org">${h.esc(e.degree)}</div>` : ''}${e.details ? `<p>${h.inline(e.details)}</p>` : ''}</td></tr>`,
        )
        .join('')}</tbody></table>`,
    );
  }

  if (p.awards.length) {
    sec(
      'awards',
      'Awards',
      `<table><tbody>${p.awards
        .map((a) => `<tr><td class="when">${h.esc(h.fmtDate(a.date)) || '—'}</td><td><div class="role">${a.url ? ext(a.url, h.esc(a.title)) : h.esc(a.title)}</div>${a.org ? `<div class="org">${h.esc(a.org)}</div>` : ''}</td></tr>`)
        .join('')}</tbody></table>`,
    );
  }

  if (p.writing.length) {
    sec(
      'writing',
      'References',
      `<table><tbody>${p.writing
        .map((w) => `<tr><td class="when">${h.esc(h.fmtDate(w.date)) || '—'}</td><td><div class="role">${ext(w.url, h.esc(w.title))}</div><div class="loc">${h.esc(w.venue || h.hostOf(w.url))}</div></td></tr>`)
        .join('')}</tbody></table>`,
    );
  }

  const sorted = h.ordered(p, sections);
  const nav = sorted.filter((s) => ['projects', 'experience', 'skills'].includes(s.id));

  const body = `<div class="sheet">
<div class="strip"><span class="label">Portfolio · Sheet 01 · Rev ${h.esc(rev)}</span><nav>${nav.map((s) => `<a class="label" href="#${s.id}">${h.esc(s.title)}</a>`).join('')}${mail ? `<a class="label" href="#contact">Contact</a>` : ''}</nav></div>
<header class="hero"><div class="main"><div class="lede">
<div class="label">Drawing of</div>
<h1>${h.esc(p.name)}</h1>
${p.headline ? `<div class="dim">Scope</div><p class="hl">${h.inline(p.headline)}</p>` : ''}
</div>${dims.length ? `<div class="dims">${dims.map(([v, l]) => `<div><b>${h.esc(v)}</b><span class="label">${h.esc(l)}</span></div>`).join('')}</div>` : ''}</div><aside class="block">${blockCells.join('')}</aside></header>
${sorted
  .map((s, i) => `<section id="${s.id}"><div class="sec-head"><span class="n">${pad(i + 1)}</span><h2>${h.esc(s.title)}</h2><span class="rule"></span></div>${s.html}</section>`)
  .join('\n')}
<footer id="contact"><div><div class="label">Correspondence</div><h2>${mail ? `<a href="${h.attrUrl(mail.url)}">${h.esc(mail.url.slice(7))}</a>` : h.esc(p.name)}</h2></div>
<div class="fine">${h.esc(p.name)}<br>Rev ${h.esc(rev)} · © ${now.getFullYear()}</div></footer>
</div>`;

  return { fonts, css, body, bg: '#f3f6fa', bgDark: '#0b1d3a' };
}
