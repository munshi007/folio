// Pull a public GitHub profile + best repos into folio.json shape. Uses GITHUB_TOKEN if set (higher rate limit).

const API = 'https://api.github.com';

async function gh(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'folio-site' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`${API}${path}`, { headers });
  if (res.status === 404) throw new Error(`GitHub user not found (${path})`);
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub rate limit hit. Set GITHUB_TOKEN or try again in an hour.');
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
}

// Rank: stars dominate, recent activity breaks ties, empty/fork/archived repos drop out.
function score(r) {
  const ageDays = (Date.now() - new Date(r.pushed_at).getTime()) / 864e5;
  return r.stargazers_count * 10 + r.forks_count * 3 + Math.max(0, 365 - ageDays) / 30 + (r.description ? 2 : 0) + (r.homepage ? 2 : 0);
}

export async function fetchGitHub(username, { limit = 6 } = {}) {
  const user = await gh(`/users/${encodeURIComponent(username)}`);
  const repos = await gh(`/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed&type=owner`);

  const picked = repos
    .filter((r) => !r.fork && !r.archived && r.size > 0 && r.name.toLowerCase() !== username.toLowerCase())
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);

  const profile = {
    name: user.name || user.login,
    headline: (user.bio || '').replace(/\s+/g, ' ').trim(),
    location: user.location || '',
    avatar: user.avatar_url ? `${user.avatar_url}${user.avatar_url.includes('?') ? '&' : '?'}s=400` : '',
    email: user.email || '',
    links: [{ label: 'GitHub', url: user.html_url }],
  };
  if (user.blog) profile.links.push({ label: 'Website', url: /^https?:/.test(user.blog) ? user.blog : `https://${user.blog}` });
  if (user.twitter_username) profile.links.push({ label: 'X', url: `https://x.com/${user.twitter_username}` });

  const projects = picked.map((r) => ({
    name: r.name,
    description: (r.description || '').replace(/\s+/g, ' ').trim(),
    repo: r.html_url,
    url: r.homepage || '',
    tags: [r.language, ...(r.topics ?? []).slice(0, 3)].filter(Boolean),
    stars: r.stargazers_count || undefined, // a "★ 0" badge hurts more than it helps
    year: String(new Date(r.created_at).getFullYear()),
    source: 'github',
  }));

  return { profile, projects };
}

// Merge without clobbering anything the user (or their agent) already wrote.
export function mergeGitHub(config, { profile, projects }) {
  const out = { ...config };
  for (const key of ['name', 'headline', 'location', 'avatar', 'email']) {
    if (!out[key] && profile[key]) out[key] = profile[key];
  }
  const links = Array.isArray(out.links) ? [...out.links] : [];
  for (const l of profile.links) if (!links.some((x) => x.url === l.url)) links.push(l);
  out.links = links;

  const existing = Array.isArray(out.projects) ? [...out.projects] : [];
  const added = [];
  for (const p of projects) {
    const match = existing.find((x) => x.repo === p.repo || (x.name && x.name.toLowerCase() === p.name.toLowerCase()));
    if (match) {
      if (match.stars == null) match.stars = p.stars;
      if (!match.repo) match.repo = p.repo;
    } else {
      existing.push(p);
      added.push(p.name);
    }
  }
  out.projects = existing;
  return { config: out, added };
}
