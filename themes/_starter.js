// A folio theme. `folio theme new <name>` copies this file into your project's themes/ folder.
//
// Contract:
//   export const meta = { name, description }
//   export function render(p, h) -> { css, body, fonts?, script?, bg?, bgDark? }
//
// `p` is the normalized profile: every field exists (strings default to '', lists to []).
// `h` is the helper kit. Rule of thumb: every profile value goes through one of these:
//   h.esc(text)        plain text            h.attrUrl(url)   any href/src (blocks javascript: etc.)
//   h.inline(text)     text with **bold**, *em*, [links](url)
//   h.md(text)         paragraphs (blank line = new <p>), same inline syntax
//   h.dateRange(a, b)  "Jun 2024 – Present"  h.fmtDate(d)     "Jun 2024"
//   h.icon(kind, size) inline SVG: github | linkedin | x | mail | link | arrow | star
//   h.linkKind(url)    which icon fits a URL  h.hostOf(url)    "example.com"   h.initials(name)
//
// Check your work: `folio theme check <name>` (safety + quality), `folio shot --theme <name>` (screenshots).

export const meta = {
  name: '__NAME__',
  description: 'Describe the look in one line: mood, type, who it suits.',
};

export function render(p, h) {
  // ---- Design tokens. Change these first: type, color, rhythm. ------------------------------
  const fonts = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&display=swap';

  const css = `
:root{--bg:#fbfaf7;--ink:#191816;--muted:#6d6a63;--line:rgba(25,24,22,.12);--accent:#2f54eb;
  --display:"Instrument Serif",Georgia,serif;--text:"Instrument Sans",ui-sans-serif,system-ui,sans-serif;--max:960px}
@media (prefers-color-scheme:dark){:root{--bg:#121211;--ink:#f1efe9;--muted:#a19d94;--line:rgba(241,239,233,.13);--accent:#85a5ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 16.5px/1.65 var(--text);-webkit-font-smoothing:antialiased}
a{color:inherit;text-underline-offset:3px;text-decoration-color:var(--line)}
a:hover{color:var(--accent);text-decoration-color:currentColor}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
main{max-width:var(--max);margin:0 auto;padding:12vh 24px 120px}
.hero h1{font:400 clamp(3rem,8vw,6rem)/1 var(--display);letter-spacing:-.02em;margin:0}
.hero .hl{font:italic 400 clamp(1.3rem,2.4vw,1.8rem)/1.35 var(--display);color:var(--muted);margin:16px 0 0;max-width:32ch}
.status{display:inline-block;margin-bottom:24px;font-size:13px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:4px 12px}
.links{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:28px;font-size:15px;color:var(--muted)}
.links a{display:inline-flex;gap:6px;align-items:center;text-decoration:none}
section{margin-top:96px}
h2{font:400 2rem/1.1 var(--display);margin:0 0 28px}
.about{font-size:1.15rem;max-width:62ch}
.item{padding:20px 0;border-top:1px solid var(--line)}
.item h3{font-size:1.1rem;font-weight:600;margin:0}
.item .sub{color:var(--muted);font-size:14.5px}
.item p,.item ul{margin:8px 0 0;color:var(--muted)}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.tags span{font-size:12.5px;border:1px solid var(--line);border-radius:999px;padding:2px 10px;color:var(--muted)}
.proj img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;border:1px solid var(--line);margin-bottom:14px}
footer{margin-top:120px;font-size:14px;color:var(--muted)}
@media (max-width:640px){main{padding:56px 18px 96px}section{margin-top:64px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

  // ---- Small building blocks ------------------------------------------------------------------
  const link = (url, label) => `<a href="${h.attrUrl(url)}" target="_blank" rel="noopener">${label}</a>`;
  const list = (items) => (items.length ? `<ul>${items.map((x) => `<li>${h.inline(x)}</li>`).join('')}</ul>` : '');
  const tags = (items) => (items.length ? `<div class="tags">${items.map((t) => `<span>${h.esc(t)}</span>`).join('')}</div>` : '');
  const section = (id, title, html) => ({ id, html: `<section id="${id}"><h2>${h.esc(title)}</h2>${html}</section>` });

  // ---- Sections. Restyle freely; keep every field escaped. Ids: about, projects, experience,
  // education, skills, awards, writing. h.ordered() applies the user's style.sections order. ---
  const parts = [];
  const blocks = [];

  parts.push(`<header class="hero">
${p.status ? `<div class="status">${h.esc(p.status)}</div>` : ''}
<h1>${h.esc(p.name)}</h1>
${p.headline ? `<p class="hl">${h.inline(p.headline)}</p>` : ''}
<nav class="links">${p.location ? `<span>${h.esc(p.location)}</span>` : ''}${p.links
    .map((l) => `<a href="${h.attrUrl(l.url)}" rel="me noopener" target="_blank">${h.icon(h.linkKind(l.url), 15)}${h.esc(l.label)}</a>`)
    .join('')}</nav>
</header>`);

  if (p.about) blocks.push(section('about', 'About', `<div class="about">${h.md(p.about)}</div>`));

  if (p.projects.length) {
    blocks.push(
      section(
        'projects',
        'Work',
        p.projects
          .map((x) => {
            const href = x.url || x.repo;
            const title = href ? link(href, h.esc(x.name)) : h.esc(x.name);
            const meta = [x.stars != null ? `★ ${x.stars.toLocaleString('en-US')}` : '', x.year].filter(Boolean).join(' · ');
            return `<div class="item proj">
${x.featured && x.image ? `<img src="${h.attrUrl(x.image)}" alt="${h.esc(x.name)} screenshot" loading="lazy">` : ''}
<h3>${title}</h3>${meta ? `<div class="sub">${h.esc(meta)}</div>` : ''}
${x.description ? `<p>${h.inline(x.description)}</p>` : ''}
${x.featured ? list(x.highlights) : ''}${tags(x.tags)}
</div>`;
          })
          .join(''),
      ),
    );
  }

  if (p.experience.length) {
    blocks.push(
      section(
        'experience',
        'Experience',
        p.experience
          .map(
            (e) => `<div class="item">
<h3>${h.esc(e.role)}${e.org ? ` · ${e.url ? link(e.url, h.esc(e.org)) : h.esc(e.org)}` : ''}</h3>
<div class="sub">${h.esc(h.dateRange(e.start, e.end))}${e.location ? ` · ${h.esc(e.location)}` : ''}</div>
${e.summary ? `<p>${h.inline(e.summary)}</p>` : ''}${list(e.highlights)}
</div>`,
          )
          .join(''),
      ),
    );
  }

  if (p.education.length) {
    blocks.push(
      section(
        'education',
        'Education',
        p.education
          .map(
            (e) => `<div class="item"><h3>${h.esc(e.school)}</h3>
<div class="sub">${[e.degree, h.dateRange(e.start, e.end)].filter(Boolean).map(h.esc).join(' · ')}</div>
${e.details ? `<p>${h.inline(e.details)}</p>` : ''}</div>`,
          )
          .join(''),
      ),
    );
  }

  if (p.skills.length) {
    blocks.push(
      section(
        'skills',
        'Skills',
        p.skills.map((g) => `<div class="item">${g.group ? `<h3>${h.esc(g.group)}</h3>` : ''}${tags(g.items)}</div>`).join(''),
      ),
    );
  }

  if (p.awards.length) {
    blocks.push(
      section(
        'awards',
        'Awards',
        p.awards
          .map((a) => `<div class="item"><h3>${a.url ? link(a.url, h.esc(a.title)) : h.esc(a.title)}</h3><div class="sub">${[a.org, h.fmtDate(a.date)].filter(Boolean).map(h.esc).join(' · ')}</div></div>`)
          .join(''),
      ),
    );
  }

  if (p.writing.length) {
    blocks.push(
      section(
        'writing',
        'Writing',
        p.writing
          .map((w) => `<div class="item"><h3>${link(w.url, h.esc(w.title))}</h3><div class="sub">${[w.venue || h.hostOf(w.url), h.fmtDate(w.date)].filter(Boolean).map(h.esc).join(' · ')}</div></div>`)
          .join(''),
      ),
    );
  }

  parts.push(...h.ordered(p, blocks).map((b) => b.html));

  const mail = p.links.find((l) => l.url.startsWith('mailto:'));
  parts.push(`<footer>${mail ? `<a href="${h.attrUrl(mail.url)}">${h.esc(mail.url.slice(7))}</a> · ` : ''}© ${new Date().getFullYear()} ${h.esc(p.name)}</footer>`);

  return { fonts, css, body: `<main>${parts.join('\n')}</main>`, bg: '#fbfaf7', bgDark: '#121211' };
}
