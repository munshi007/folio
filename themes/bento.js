import { esc, attrUrl, md, inline, dateRange, fmtDate, icon, linkKind, initials, ordered } from '../src/util.js';

export const meta = {
  name: 'bento',
  description: 'Bento-grid of cards with a cursor spotlight. Bold, modern, product-y. Great for full-stack, mobile, product engineers and students.',
};

const css = `
:root{--bg:#efeee9;--card:#fff;--ink:#141414;--muted:#6b6b6b;--line:rgba(0,0,0,.07);--accent:#4f46e5;--r:26px}
@media (prefers-color-scheme:dark){:root{--bg:#09090b;--card:#141417;--ink:#f4f4f5;--muted:#a1a1aa;--line:rgba(255,255,255,.08);--accent:#818cf8}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 15.5px/1.6 "Hanken Grotesk",ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:8px}
::selection{background:var(--accent);color:#fff}
.grid{max-width:1180px;margin:0 auto;padding:40px 24px 90px;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-flow:dense;gap:16px}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:26px;overflow:hidden;
  transition:transform .45s cubic-bezier(.2,.8,.2,1.2),box-shadow .45s;box-shadow:0 1px 2px rgba(0,0,0,.04);
  opacity:0;animation:rise .7s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(var(--i,0) * 55ms)}
@keyframes rise{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
.card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s;
  background:radial-gradient(420px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--accent) 13%,transparent),transparent 60%)}
.card:hover::after{opacity:1}
a.card{text-decoration:none;display:block}
a.card:hover{transform:translateY(-4px);box-shadow:0 18px 40px -18px rgba(0,0,0,.25)}
.s2{grid-column:span 2}.r2{grid-row:span 2}.s4{grid-column:span 4}
.k{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 14px;display:flex;align-items:center;gap:8px}
h1,h2,h3{font-family:"Bricolage Grotesque",ui-sans-serif,sans-serif;letter-spacing:-.03em;margin:0}
.hero{display:flex;flex-direction:column;justify-content:space-between;min-height:340px}
.ava{width:72px;height:72px;border-radius:22px;object-fit:cover;border:1px solid var(--line)}
.ava.txt{display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 40%,#f472b6));color:#fff;font:700 26px "Bricolage Grotesque",sans-serif}
.hero h1{font-size:clamp(2.4rem,5vw,3.8rem);line-height:.98;margin-top:28px;font-weight:700}
.hero .hl{font-size:1.15rem;color:var(--muted);margin:14px 0 0;max-width:34ch;line-height:1.45}
.chip{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;padding:6px 12px;border-radius:999px;background:color-mix(in srgb,#16a34a 12%,transparent);color:#15803d;width:max-content}
@media (prefers-color-scheme:dark){.chip{color:#4ade80}}
.chip i{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 25%,transparent)}
.loc{display:flex;flex-direction:column;justify-content:flex-end;min-height:160px;color:#fff;border:0;
  background:radial-gradient(circle at 80% 10%,color-mix(in srgb,var(--accent) 70%,#fff) 0,transparent 45%),linear-gradient(160deg,var(--accent),color-mix(in srgb,var(--accent) 45%,#0f172a))}
.loc .k{color:rgba(255,255,255,.75)}
.loc h3{font-size:1.5rem;line-height:1.15}
.loc .time{opacity:.8;font-size:14px;margin-top:4px;font-variant-numeric:tabular-nums}
.links{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:10px;align-content:start}
.links a{aspect-ratio:1;display:grid;place-items:center;border-radius:16px;background:color-mix(in srgb,var(--ink) 5%,transparent);color:var(--ink);transition:all .25s}
.links a:hover{background:var(--accent);color:#fff;transform:scale(1.06)}
.about{font-size:1.05rem;line-height:1.65}
.about p{margin:0 0 .8em}.about p:last-child{margin:0}
.proj{display:flex;flex-direction:column;min-height:220px}
.proj .thumb{margin:-26px -26px 20px;aspect-ratio:16/9;overflow:hidden;border-bottom:1px solid var(--line)}
.proj .thumb img{width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.2,.8,.2,1)}
a.proj:hover .thumb img{transform:scale(1.04)}
.proj .art{margin:-26px -26px 20px;height:120px;background:var(--g);position:relative}
.proj .art span{position:absolute;left:24px;bottom:-18px;width:52px;height:52px;border-radius:16px;background:var(--card);border:1px solid var(--line);display:grid;place-items:center;font:700 18px "Bricolage Grotesque",sans-serif;color:var(--ink)}
.proj .art + h3{margin-top:14px}
.proj h3{font-size:1.35rem;display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.proj h3 svg{flex:none;color:var(--muted);transition:all .25s}
a.proj:hover h3 svg{color:var(--accent);transform:translate(2px,-2px)}
.proj p{color:var(--muted);margin:8px 0 0;flex:1}
.proj ul{color:var(--muted);margin:8px 0 0;padding-left:18px}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px;align-items:center}
.meta span{font-size:12px;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--ink) 5%,transparent);color:var(--muted)}
.meta .star{background:color-mix(in srgb,#f59e0b 14%,transparent);color:#b45309;display:inline-flex;gap:4px;align-items:center}
@media (prefers-color-scheme:dark){.meta .star{color:#fbbf24}}
.tl{list-style:none;margin:0;padding:0;display:grid;gap:22px}
.tl>li{display:grid;grid-template-columns:14px 1fr;gap:14px}
.tl.cols{display:block;columns:2;column-gap:48px}
.tl.cols>li{break-inside:avoid;margin-bottom:22px}
@media (max-width:980px){.tl.cols{columns:1}}
.tl .dot{width:10px;height:10px;border-radius:50%;margin-top:7px;background:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent)}
.tl h3{font-size:1.08rem}
.tl .org{color:var(--accent);font-weight:500}
.tl .org a{text-decoration:none}
.tl .when{font-size:13px;color:var(--muted)}
.tl p{margin:6px 0 0;color:var(--muted);font-size:14.5px}
.tl ul{margin:6px 0 0;padding-left:16px;color:var(--muted);font-size:14.5px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips span{font-size:13.5px;padding:6px 12px;border-radius:12px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink) 3%,transparent);transition:all .2s}
.chips span:hover{border-color:var(--accent);color:var(--accent)}
.sg+.sg{margin-top:16px}
.sg h4{margin:0 0 8px;font-size:12.5px;color:var(--muted);font-weight:500}
.edu h3{font-size:1.1rem}.edu p{margin:4px 0 0;color:var(--muted);font-size:14.5px}.edu+.edu{margin-top:16px}
.cta{background:var(--ink);color:var(--bg);display:flex;flex-direction:column;justify-content:space-between;gap:22px;min-height:200px;border:0}
.cta .k{color:color-mix(in srgb,var(--bg) 60%,transparent)}
.cta h2{font-size:clamp(1.8rem,3.4vw,2.6rem);line-height:1.05}
.cta .row{display:flex;flex-wrap:wrap;gap:10px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:14px;font-weight:600;font-size:14.5px;text-decoration:none;border:0;cursor:pointer;font-family:inherit;transition:transform .2s}
.btn:hover{transform:translateY(-2px)}
.btn.pri{background:var(--accent);color:#fff}
.btn.sec{background:color-mix(in srgb,var(--bg) 14%,transparent);color:var(--bg)}
.list a{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-top:1px solid var(--line);text-decoration:none}
.list a:first-child{border-top:0;padding-top:0}
.list small{color:var(--muted);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.card{animation:none;opacity:1}a.card:hover{transform:none}}
@media (max-width:980px){.grid{grid-template-columns:repeat(2,1fr)}.s4{grid-column:span 2}}
@media (max-width:620px){.grid{grid-template-columns:1fr;padding:16px 14px 80px;gap:12px}.s2,.s4{grid-column:span 1}.r2{grid-row:auto}.hero{min-height:0}.hero h1{margin-top:22px}}
@media print{.card{animation:none;opacity:1;break-inside:avoid}}
`;

// Stable gradient per project name so cards without screenshots still look designed.
function gradient(name) {
  // FNV-1a, then the golden angle so similar names still land on distant hues.
  let x = 2166136261;
  for (const c of name) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
  const h = Math.round((x % 1000) * 137.508) % 360;
  return `linear-gradient(135deg,hsl(${h} 85% 62%),hsl(${(h + 48) % 360} 80% 56%) 55%,hsl(${(h + 100) % 360} 75% 50%))`;
}

function project(x, i) {
  const href = x.url || x.repo;
  const tag = href ? 'a' : 'div';
  const hrefAttr = href ? ` href="${attrUrl(href)}" target="_blank" rel="noopener"` : '';
  const size = x.featured ? "s2" : "";
  const visual = x.image
    ? `<div class="thumb"><img src="${attrUrl(x.image)}" alt="${esc(x.name)} screenshot" loading="lazy"></div>`
    : `<div class="art" style="--g:${gradient(x.name)}"><span>${esc(initials(x.name) || '•')}</span></div>`;
  return `<${tag} class="card proj ${size}"${hrefAttr}>
${visual}
<h3>${esc(x.name)}${href ? icon('arrow', 20) : ''}</h3>
${x.description ? `<p>${inline(x.description)}</p>` : ''}
${x.featured && x.highlights.length ? `<ul>${x.highlights.map((h) => `<li>${inline(h)}</li>`).join('')}</ul>` : ''}
<div class="meta">${x.stars != null ? `<span class="star">${icon('star', 12)}${x.stars.toLocaleString('en-US')}</span>` : ''}${x.year ? `<span>${esc(x.year)}</span>` : ''}${x.tags.slice(0, 4).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
</${tag}>`;
}

export function render(p) {
  const cards = [];

  cards.push(`<section class="card hero s2 r2">
<div>${p.avatar ? `<img class="ava" src="${attrUrl(p.avatar)}" alt="${esc(p.name)}">` : `<div class="ava txt">${esc(initials(p.name))}</div>`}</div>
<div>${p.status ? `<span class="chip"><i></i>${esc(p.status)}</span>` : ''}
<h1>${esc(p.name)}</h1>${p.headline ? `<p class="hl">${inline(p.headline)}</p>` : ''}</div>
</section>`);

  if (p.location) {
    cards.push(`<section class="card loc"><p class="k">Based in</p><h3>${esc(p.location)}</h3></section>`);
  }
  if (p.links.length) {
    cards.push(`<section class="card"><p class="k">Find me</p><nav class="links">${p.links
      .map((l) => `<a href="${attrUrl(l.url)}" target="_blank" rel="me noopener" title="${esc(l.label)}" aria-label="${esc(l.label)}">${icon(linkKind(l.url), 22)}</a>`)
      .join('')}</nav></section>`);
  }
  // Section tiles are collected with ids so style.sections can reorder them (stable: featured stay before the rest).
  const tiles = [];
  const tile = (id, html) => tiles.push({ id, html });

  if (p.about) tile('about', `<section class="card s2"><p class="k">About</p><div class="about">${md(p.about)}</div></section>`);

  const featured = p.projects.filter((x) => x.featured);
  const rest = p.projects.filter((x) => !x.featured);
  featured.forEach((x, i) => tile('projects', project(x, i)));

  if (p.experience.length) {
    // Long careers go full-width in two columns so one tall card can't leave holes in the grid;
    // roles past the fourth stay compact.
    const long = p.experience.length > 3;
    tile('experience', `<section class="card ${long ? 's4' : 's2'}"><p class="k">Experience</p><ul class="tl${long ? ' cols' : ''}">${p.experience
      .map(
        (e, i) => `<li><span class="dot"></span><div><h3>${esc(e.role)}</h3>
${e.org ? `<div class="org">${e.url ? `<a href="${attrUrl(e.url)}" target="_blank" rel="noopener">${esc(e.org)}</a>` : esc(e.org)}</div>` : ''}
<div class="when">${esc(dateRange(e.start, e.end))}${e.location ? ` · ${esc(e.location)}` : ''}</div>
${i < 4 && e.summary ? `<p>${inline(e.summary)}</p>` : ''}
${i < 4 && e.highlights.length ? `<ul>${e.highlights.map((h) => `<li>${inline(h)}</li>`).join('')}</ul>` : ''}</div></li>`,
      )
      .join('')}</ul></section>`);
  }

  rest.forEach((x, i) => tile('projects', project(x, i + featured.length)));

  if (p.skills.length) {
    tile('skills', `<section class="card s2"><p class="k">Toolkit</p>${p.skills
      .map((g) => `<div class="sg">${g.group ? `<h4>${esc(g.group)}</h4>` : ''}<div class="chips">${g.items.map((i) => `<span>${esc(i)}</span>`).join('')}</div></div>`)
      .join('')}</section>`);
  }
  if (p.education.length) {
    tile('education', `<section class="card s2"><p class="k">Education</p>${p.education
      .map((e) => `<div class="edu"><h3>${esc(e.school)}</h3>${e.degree ? `<p>${esc(e.degree)}</p>` : ''}<p>${esc(dateRange(e.start, e.end))}</p>${e.details ? `<p>${inline(e.details)}</p>` : ''}</div>`)
      .join('')}</section>`);
  }
  if (p.awards.length) {
    tile('awards', `<section class="card s2"><p class="k">Recognition</p><div class="list">${p.awards
      .map((a) => `<a ${a.url ? `href="${attrUrl(a.url)}" target="_blank" rel="noopener"` : ''}><span>${esc(a.title)}${a.org ? ` · <span style="color:var(--muted)">${esc(a.org)}</span>` : ''}</span><small>${esc(fmtDate(a.date))}</small></a>`)
      .join('')}</div></section>`);
  }
  if (p.writing.length) {
    tile('writing', `<section class="card s2"><p class="k">Writing</p><div class="list">${p.writing
      .map((w) => `<a href="${attrUrl(w.url)}" target="_blank" rel="noopener"><span>${esc(w.title)}</span><small>${esc(fmtDate(w.date))}</small></a>`)
      .join('')}</div></section>`);
  }

  cards.push(...ordered(p, tiles).map((t) => t.html));

  const mail = p.links.find((l) => l.url.startsWith('mailto:'));
  const primary = mail ?? p.links[0];
  if (primary) {
    const addr = mail ? mail.url.replace(/^mailto:/, '') : '';
    cards.push(`<section class="card cta s4"><p class="k">Contact</p><h2>Have something in mind?<br>Let’s build it together.</h2>
<div class="row"><a class="btn pri" href="${attrUrl(primary.url)}">${icon(linkKind(primary.url), 18)}${mail ? 'Email me' : esc(primary.label)}</a>
${addr ? `<button class="btn sec" data-copy="${esc(addr)}">Copy address</button>` : ''}</div></section>`);
  }

  const body = `<main class="grid">${cards.map((c, i) => c.replace('class="card', `style="--i:${i}" class="card`)).join('\n')}</main>`;

  const script = `(()=>{
document.querySelectorAll('.card').forEach(c=>c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')}));
const b=document.querySelector('[data-copy]');if(b)b.addEventListener('click',()=>{navigator.clipboard&&navigator.clipboard.writeText(b.dataset.copy).then(()=>{const t=b.textContent;b.textContent='Copied ✓';setTimeout(()=>b.textContent=t,1600)})});
})();`;

  return {
    fonts: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Hanken+Grotesk:wght@400;500;600&display=swap',
    css,
    body,
    script,
    bg: '#efeee9',
    bgDark: '#09090b',
  };
}
