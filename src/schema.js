// folio.json shape, validation and normalization. Themes only ever see normalized profiles.

export const SECTIONS = ['experience', 'projects', 'education', 'skills', 'awards', 'writing'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (v == null ? '' : String(v).trim());

export function validate(raw) {
  const errors = [];
  const warnings = [];
  if (!isObj(raw)) return { errors: ['folio.json must be a JSON object'], warnings };

  if (!str(raw.name)) errors.push('name: required');
  if (raw.accent && !/^#[0-9a-f]{3,8}$/i.test(raw.accent)) errors.push('accent: must be a hex color like "#4f46e5"');

  for (const key of SECTIONS) {
    if (raw[key] != null && !Array.isArray(raw[key])) errors.push(`${key}: must be an array`);
  }
  if (raw.links != null && !Array.isArray(raw.links) && !isObj(raw.links)) {
    errors.push('links: must be an array of {label, url} or an object of label -> url');
  }

  (Array.isArray(raw.experience) ? raw.experience : []).forEach((e, i) => {
    if (!isObj(e)) return errors.push(`experience[${i}]: must be an object`);
    if (!str(e.role) && !str(e.org)) errors.push(`experience[${i}]: needs role or org`);
  });
  (Array.isArray(raw.projects) ? raw.projects : []).forEach((p, i) => {
    if (!isObj(p)) return errors.push(`projects[${i}]: must be an object`);
    if (!str(p.name)) errors.push(`projects[${i}].name: required`);
    if (!str(p.description)) warnings.push(`projects[${i}] (${p.name ?? '?'}): no description — recruiters skip these`);
  });
  (Array.isArray(raw.education) ? raw.education : []).forEach((e, i) => {
    if (!isObj(e) || !str(e.school)) errors.push(`education[${i}].school: required`);
  });

  if (!str(raw.headline)) warnings.push('headline: missing — this is the first line people read');
  if (!str(raw.about)) warnings.push('about: missing');
  if (!(raw.projects ?? []).length) warnings.push('projects: none — the strongest portfolios lead with work');

  return { errors, warnings };
}

function normLinks(links) {
  if (!links) return [];
  const list = Array.isArray(links)
    ? links
    : Object.entries(links).map(([label, url]) => ({ label, url }));
  return list
    .filter((l) => isObj(l) && str(l.url))
    .map((l) => {
      let url = str(l.url);
      if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(url)) url = `mailto:${url}`;
      return { label: str(l.label) || url.replace(/^mailto:/, ''), url };
    });
}

function normSkills(skills) {
  if (!Array.isArray(skills)) return [];
  // Accept ["TS", "Go"] or [{group, items}] or a mix.
  const loose = skills.filter((s) => typeof s === 'string').map(str).filter(Boolean);
  const groups = skills
    .filter(isObj)
    .map((g) => ({ group: str(g.group), items: (g.items ?? []).map(str).filter(Boolean) }))
    .filter((g) => g.items.length);
  if (loose.length) groups.unshift({ group: '', items: loose });
  return groups;
}

const list = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

export function normalize(raw) {
  const p = {
    theme: str(raw.theme) || 'editorial',
    accent: str(raw.accent),
    name: str(raw.name),
    headline: str(raw.headline),
    location: str(raw.location),
    status: str(raw.status),
    avatar: str(raw.avatar),
    email: str(raw.email),
    about: str(raw.about),
    url: str(raw.url),
    badge: raw.badge !== false,
    links: normLinks(raw.links),
    experience: (raw.experience ?? []).filter(isObj).map((e) => ({
      role: str(e.role),
      org: str(e.org),
      url: str(e.url),
      location: str(e.location),
      start: str(e.start),
      end: str(e.end),
      summary: str(e.summary),
      highlights: list(e.highlights),
    })),
    projects: (raw.projects ?? []).filter(isObj).map((x) => ({
      name: str(x.name),
      description: str(x.description),
      url: str(x.url),
      repo: str(x.repo),
      image: str(x.image),
      tags: list(x.tags),
      stars: Number.isFinite(Number(x.stars)) && x.stars !== '' && x.stars != null ? Number(x.stars) : null,
      year: str(x.year),
      featured: Boolean(x.featured),
      highlights: list(x.highlights),
    })),
    education: (raw.education ?? []).filter(isObj).map((e) => ({
      school: str(e.school),
      degree: str(e.degree),
      start: str(e.start),
      end: str(e.end),
      details: str(e.details),
    })),
    skills: normSkills(raw.skills),
    awards: (raw.awards ?? []).filter(isObj).map((a) => ({
      title: str(a.title),
      org: str(a.org),
      date: str(a.date),
      url: str(a.url),
    })),
    writing: (raw.writing ?? []).filter(isObj).map((w) => ({
      title: str(w.title),
      url: str(w.url),
      date: str(w.date),
      venue: str(w.venue),
    })),
  };

  if (p.email && !p.links.some((l) => l.url === `mailto:${p.email}`)) {
    p.links.push({ label: 'Email', url: `mailto:${p.email}` });
  }
  // Featured projects first; if none flagged, the first three are featured.
  if (!p.projects.some((x) => x.featured)) p.projects.slice(0, 3).forEach((x) => (x.featured = true));
  p.projects.sort((a, b) => Number(b.featured) - Number(a.featured));
  return p;
}
