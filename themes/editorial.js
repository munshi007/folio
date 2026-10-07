import { esc, attrUrl, md, inline, dateRange, fmtDate, icon, linkKind, hostOf } from '../src/util.js';

export const meta = {
  name: 'editorial',
  description: 'Magazine-style serif layout. Warm paper, big type, numbered sections. Great for designers, writers, researchers.',
};

const css = `
:root{--bg:#f5f1ea;--ink:#1b1814;--muted:#6f675e;--rule:rgba(27,24,20,.14);--card:#fffdf9;--accent:#c2410c}
@media (prefers-color-scheme:dark){:root{--bg:#121110;--ink:#efe9e0;--muted:#9d958b;--rule:rgba(239,233,224,.14);--card:#1a1917;--accent:#fb923c}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.65 Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit;text-decoration-color:var(--rule);text-underline-offset:3px;transition:color .2s,text-decoration-color .2s}
a:hover{color:var(--accent);text-decoration-color:currentColor}
::selection{background:var(--accent);color:var(--bg)}
.wrap{max-width:1080px;margin:0 auto;padding:0 28px}
.serif{font-family:Fraunces,"Iowan Old Style",Georgia,serif;font-optical-sizing:auto}
nav.top{display:flex;justify-content:space-between;align-items:center;padding:22px 0;font-size:14px;color:var(--muted)}
nav.top .mark{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:18px;color:var(--ink);text-decoration:none;letter-spacing:-.01em}
nav.top ul{display:flex;gap:22px;list-style:none;margin:0;padding:0}
nav.top ul a{text-decoration:none}
.hero{padding:9vh 0 7vh;border-bottom:1px solid var(--rule)}
.status{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);border:1px solid var(--rule);border-radius:999px;padding:5px 12px 5px 10px;margin-bottom:28px}
.status i{width:8px;height:8px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 0 rgba(22,163,74,.5);animation:pulse 2.4s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.45)}70%{box-shadow:0 0 0 8px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
.hero-grid{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:end}
h1.name{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:clamp(3.2rem,9vw,7.4rem);line-height:.92;letter-spacing:-.035em;margin:0}
.headline{font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:300;font-size:clamp(1.35rem,2.6vw,2rem);line-height:1.3;color:var(--muted);margin:22px 0 0;max-width:30ch}
.avatar{width:148px;height:148px;border-radius:50%;object-fit:cover;filter:grayscale(.15) contrast(1.02);border:1px solid var(--rule)}
.meta-row{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;margin-top:34px;font-size:15px;color:var(--muted)}
.meta-row a{display:inline-flex;align-items:center;gap:7px;text-decoration:none}
section.sec{display:grid;grid-template-columns:200px 1fr;gap:40px;padding:72px 0;border-bottom:1px solid var(--rule)}
.label{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);position:sticky;top:24px;align-self:start}
.label b{display:block;font-family:Fraunces,Georgia,serif;font-weight:400;font-size:44px;letter-spacing:-.02em;color:var(--accent);line-height:1;margin-bottom:6px;text-transform:none}
.about{font-family:Fraunces,Georgia,serif;font-size:clamp(1.25rem,2vw,1.6rem);line-height:1.45;font-weight:350;max-width:36ch}
.about p{margin:0 0 .8em}
.proj{display:block;padding:30px 0;border-top:1px solid var(--rule);text-decoration:none;position:relative}
.proj:first-child{border-top:0;padding-top:0}
.proj img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;border:1px solid var(--rule);margin-bottom:20px;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.proj:hover img{transform:scale(1.012)}
.proj-head{display:flex;justify-content:space-between;align-items:baseline;gap:20px}
.proj h3{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:clamp(1.6rem,3vw,2.3rem);letter-spacing:-.02em;margin:0;line-height:1.1}
.proj h3 svg{vertical-align:middle;opacity:0;transform:translate(-6px,6px);transition:all .25s}
.proj:hover h3 svg{opacity:1;transform:none;color:var(--accent)}
.proj .side{font-size:14px;color:var(--muted);white-space:nowrap;display:flex;gap:14px;align-items:center}
.proj .side span{display:inline-flex;gap:4px;align-items:center}
.proj p{margin:10px 0 0;color:var(--muted);max-width:62ch}
.proj ul{margin:10px 0 0;padding-left:18px;color:var(--muted)}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.tags span{font-size:12.5px;padding:3px 10px;border:1px solid var(--rule);border-radius:999px;color:var(--muted)}
.more{margin-top:34px}
.more h4{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:500;margin:0 0 6px}
.more a{display:grid;grid-template-columns:1fr auto;gap:16px;padding:12px 0;border-top:1px dashed var(--rule);text-decoration:none}
.more a small{color:var(--muted);font-size:14px}
.row{display:grid;grid-template-columns:160px 1fr;gap:24px;padding:22px 0;border-top:1px solid var(--rule)}
.row:first-child{border-top:0;padding-top:0}
.row .when{font-size:14px;color:var(--muted);padding-top:4px;font-variant-numeric:tabular-nums}
.row h3{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:1.4rem;margin:0;letter-spacing:-.01em;line-height:1.25}
.row h3 .at{color:var(--muted);font-weight:400;font-style:italic}
.row p{margin:8px 0 0;color:var(--muted)}
.row ul{margin:10px 0 0;padding-left:18px}
.row li{margin:4px 0}
.row li::marker{color:var(--accent)}
.skills{display:grid;gap:22px}
.skills h4{margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:500}
.skills p{margin:0;font-family:Fraunces,Georgia,serif;font-size:1.25rem;line-height:1.5}
.skills p span+span::before{content:" · ";color:var(--accent)}
footer.contact{padding:110px 0 120px;text-align:center}
footer.contact h2{font-family:Fraunces,Georgia,serif;font-weight:400;font-size:clamp(2.6rem,7vw,5.6rem);letter-spacing:-.03em;line-height:1;margin:0}
footer.contact h2 em{color:var(--accent)}
footer.contact a.big{display:inline-block;margin-top:26px;font-size:clamp(1.1rem,2.2vw,1.5rem);font-family:Fraunces,Georgia,serif}
footer.contact .meta-row{justify-content:center}
footer.contact .fine{margin-top:60px;font-size:13px;color:var(--muted)}
.reveal{opacity:0;transform:translateY(14px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
.reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}.status i{animation:none}html{scroll-behavior:auto}}
@media (max-width:760px){
  .wrap{padding:0 18px}
  nav.top ul{display:none}
  .hero-grid{grid-template-columns:1fr}
  .avatar{width:96px;height:96px;order:-1}
  section.sec{grid-template-columns:1fr;gap:18px;padding:52px 0}
  .label{position:static}
  .label b{font-size:32px}
  .row{grid-template-columns:1fr;gap:4px}
  .proj-head{flex-direction:column;gap:6px}
}
@media print{.reveal{opacity:1;transform:none}nav.top{display:none}section.sec{break-inside:avoid}}
`;

const script = `
(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver'in window)){document.querySelectorAll('.reveal').forEach(e=>e.classList.add('in'));return}
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.reveal').forEach(e=>io.observe(e))})();
`;

function links(p) {
  return p.links
    .map((l) => `<a href="${attrUrl(l.url)}" rel="me noopener" target="_blank">${icon(linkKind(l.url), 16)}${esc(l.label)}</a>`)
    .join('');
}

function project(x) {
  const href = x.url || x.repo;
  const tag = href ? 'a' : 'div';
  const hrefAttr = href ? ` href="${attrUrl(href)}" target="_blank" rel="noopener"` : '';
  const side = [
    x.stars != null ? `<span>${icon('star', 13)}${x.stars.toLocaleString('en-US')}</span>` : '',
    x.year ? `<span>${esc(x.year)}</span>` : '',
  ].join('');
  return `<${tag} class="proj reveal"${hrefAttr}>
${x.image ? `<img src="${attrUrl(x.image)}" alt="${esc(x.name)} screenshot" loading="lazy">` : ''}
<div class="proj-head"><h3>${esc(x.name)} ${href ? icon('arrow', 22) : ''}</h3>${side ? `<div class="side">${side}</div>` : ''}</div>
${x.description ? `<p>${inline(x.description)}</p>` : ''}
${x.highlights.length ? `<ul>${x.highlights.map((h) => `<li>${inline(h)}</li>`).join('')}</ul>` : ''}
${x.tags.length ? `<div class="tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
</${tag}>`;
}

function moreProject(x) {
  const href = x.url || x.repo;
  const right = x.stars != null ? `★ ${x.stars.toLocaleString('en-US')}` : esc(x.tags.slice(0, 2).join(' · '));
  return `<a href="${attrUrl(href)}" target="_blank" rel="noopener"><span>${esc(x.name)}${x.description ? ` <small>— ${esc(x.description)}</small>` : ''}</span><small>${right}</small></a>`;
}

export function render(p) {
  const sections = [];
  const add = (id, label, html) => sections.push({ id, label, html });

  if (p.about) add('about', 'About', `<div class="about reveal">${md(p.about)}</div>`);

  if (p.projects.length) {
    const featured = p.projects.filter((x) => x.featured);
    const rest = p.projects.filter((x) => !x.featured && (x.url || x.repo));
    add(
      'work',
      'Selected work',
      `${featured.map(project).join('\n')}
${rest.length ? `<div class="more reveal"><h4>More projects</h4>${rest.map(moreProject).join('')}</div>` : ''}`,
    );
  }

  if (p.experience.length) {
    add(
      'experience',
      'Experience',
      p.experience
        .map(
          (e) => `<div class="row reveal"><div class="when">${esc(dateRange(e.start, e.end))}</div><div>
<h3>${esc(e.role)}${e.org ? ` <span class="at">at ${e.url ? `<a href="${attrUrl(e.url)}" target="_blank" rel="noopener">${esc(e.org)}</a>` : esc(e.org)}</span>` : ''}</h3>
${e.summary ? `<p>${inline(e.summary)}</p>` : ''}
${e.highlights.length ? `<ul>${e.highlights.map((h) => `<li>${inline(h)}</li>`).join('')}</ul>` : ''}
</div></div>`,
        )
        .join('\n'),
    );
  }

  if (p.education.length) {
    add(
      'education',
      'Education',
      p.education
        .map(
          (e) => `<div class="row reveal"><div class="when">${esc(dateRange(e.start, e.end))}</div><div>
<h3>${esc(e.school)}</h3>${e.degree ? `<p>${esc(e.degree)}</p>` : ''}${e.details ? `<p>${inline(e.details)}</p>` : ''}</div></div>`,
        )
        .join('\n'),
    );
  }

  if (p.skills.length) {
    add(
      'skills',
      'Toolkit',
      `<div class="skills reveal">${p.skills
        .map((g) => `<div>${g.group ? `<h4>${esc(g.group)}</h4>` : ''}<p>${g.items.map((i) => `<span>${esc(i)}</span>`).join('')}</p></div>`)
        .join('')}</div>`,
    );
  }

  if (p.awards.length) {
    add(
      'awards',
      'Recognition',
      p.awards
        .map(
          (a) => `<div class="row reveal"><div class="when">${esc(fmtDate(a.date))}</div><div><h3>${a.url ? `<a href="${attrUrl(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>` : esc(a.title)}${a.org ? ` <span class="at">${esc(a.org)}</span>` : ''}</h3></div></div>`,
        )
        .join('\n'),
    );
  }

  if (p.writing.length) {
    add(
      'writing',
      'Writing',
      p.writing
        .map(
          (w) => `<div class="row reveal"><div class="when">${esc(fmtDate(w.date))}</div><div><h3><a href="${attrUrl(w.url)}" target="_blank" rel="noopener">${esc(w.title)}</a></h3>${w.venue || w.url ? `<p>${esc(w.venue || hostOf(w.url))}</p>` : ''}</div></div>`,
        )
        .join('\n'),
    );
  }

  const navItems = sections.filter((s) => ['work', 'experience', 'writing'].includes(s.id));
  const mail = p.links.find((l) => l.url.startsWith('mailto:'));
  const year = new Date().getFullYear();

  const body = `<div class="wrap">
<nav class="top"><a class="mark" href="#">${esc(p.name)}</a><ul>${navItems.map((s) => `<li><a href="#${s.id}">${esc(s.label)}</a></li>`).join('')}<li><a href="#contact">Contact</a></li></ul></nav>
<header class="hero">
${p.status ? `<div class="status"><i></i>${esc(p.status)}</div>` : ''}
<div class="hero-grid"><div>
<h1 class="name">${esc(p.name)}</h1>
${p.headline ? `<p class="headline">${inline(p.headline)}</p>` : ''}
</div>${p.avatar ? `<img class="avatar" src="${attrUrl(p.avatar)}" alt="${esc(p.name)}">` : ''}</div>
<div class="meta-row">${p.location ? `<span>${esc(p.location)}</span>` : ''}${links(p)}</div>
</header>
${sections
  .map((s, i) => `<section class="sec" id="${s.id}"><div class="label"><b>${String(i + 1).padStart(2, '0')}</b>${esc(s.label)}</div><div>${s.html}</div></section>`)
  .join('\n')}
<footer class="contact" id="contact">
<h2>Let’s make something <em>good</em>.</h2>
${mail ? `<a class="big" href="${attrUrl(mail.url)}">${esc(mail.url.replace(/^mailto:/, ''))}</a>` : ''}
<div class="meta-row">${links(p)}</div>
<p class="fine">© ${year} ${esc(p.name)}</p>
</footer>
</div>`;

  return {
    fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..500&family=Inter:wght@400;500&display=swap',
    css,
    body,
    script,
    bg: '#f5f1ea',
    bgDark: '#121110',
  };
}
