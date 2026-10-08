// Publishing from Studio: a pre-flight checklist, then build + push to GitHub Pages (or just build files).
// The push is the only thing in Studio that reaches the internet, so the API requires an explicit
// confirmation flag from the page, and the checklist flags personal details before anything goes out.

import { execFileSync } from 'node:child_process';
import { build, loadConfig } from './build.js';
import { validate, normalize } from './schema.js';
import { loadTheme } from './themes.js';
import { checkTheme } from './themecheck.js';
import { deploy, parseGitHubRemote, pagesUrl } from './deploy.js';
import { recordPublish } from './library.js';

// A phone number: 9–15 digits in one run, allowing spaces, dots, dashes and brackets, and not a date.
function looksLikePhone(text) {
  for (const m of text.matchAll(/\+?\(?\d[\d\s().\-]{6,}\d/g)) {
    const run = m[0];
    const digits = run.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) continue;
    if (/\b(19|20)\d{2}[-./](0?[1-9]|1[0-2])\b/.test(run)) continue; // 2026-05, 2024.06
    if (/^\(?(19|20)\d{2}\)?([\s–-]+(19|20)\d{2})+$/.test(run.trim())) continue; // 2019 - 2026
    return true;
  }
  return false;
}
const STREET = /\b\d{1,5}\s+[A-Za-zÀ-ÿ.'-]+\s+(street|st\.|avenue|ave\.|road|rd\.|straße|strasse|str\.|lane|boulevard|blvd)\b/i;

function texts(obj, out = []) {
  if (typeof obj === 'string') out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => texts(v, out));
  else if (obj && typeof obj === 'object') Object.entries(obj).forEach(([k, v]) => k !== 'url' && k !== 'repo' && k !== 'avatar' && texts(v, out));
  return out;
}

export async function publishCheck({ configPath, base }) {
  const raw = await loadConfig(configPath);
  const { errors, warnings } = validate(raw);
  const p = errors.length ? null : normalize(raw);
  const items = [];
  const add = (level, text) => items.push({ level, text });

  if (errors.length) add('error', `folio.json has problems: ${errors.join('; ')}`);
  else add('ok', 'Content is valid');
  if (warnings.length) add('warn', `${warnings.length} content suggestion(s): ${warnings.slice(0, 2).join('; ')}${warnings.length > 2 ? '…' : ''}`);

  const theme = raw.theme || 'editorial';
  try {
    const t = await loadTheme(theme, base);
    const c = checkTheme(t);
    if (c.errors.length) add('error', `Design "${theme}" fails its checks: ${c.errors[0]}`);
    else add('ok', `Design "${theme}" passes its checks (phones, dark mode, safe links)`);
  } catch (e) {
    add('error', e.message);
  }

  const fields = texts(raw);
  const all = fields.join('\n');
  const emailLink = p?.links.find((l) => l.url.startsWith('mailto:'));
  if (emailLink) add('warn', `Your email (${emailLink.url.slice(7)}) will be public on the page`);
  if (fields.some(looksLikePhone)) add('error', 'Something that looks like a phone number is in your content. Remove it unless you really want it public.');
  if (STREET.test(all)) add('error', 'Something that looks like a street address is in your content. Remove it unless you really want it public.');
  if (!raw.url) add('warn', 'No "url" in folio.json, so link previews (LinkedIn, X, Slack) won’t show your photo');

  let remote = '';
  try {
    remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {}
  const gh = remote ? parseGitHubRemote(remote) : null;
  if (gh) add('ok', `Will publish to ${pagesUrl(gh)}`);
  else add('warn', remote ? 'Your git remote isn’t GitHub; use "Build files" and host them anywhere' : 'No GitHub repo connected here yet; use "Build files", or create a repo first (git init && gh repo create <name> --public --source=. --push)');

  return { theme, items, canPublish: !items.some((i) => i.level === 'error') && Boolean(gh), url: gh ? pagesUrl(gh) : null, remote: Boolean(remote) };
}

export async function publish({ configPath, base, store, host }) {
  if (host === 'files') {
    const { outDir, profile } = await build({ config: configPath, out: `${base}/dist` });
    return { host, outDir, theme: profile.theme };
  }
  if (host !== 'github-pages') throw new Error('host must be github-pages or files');
  const check = await publishCheck({ configPath, base });
  if (!check.canPublish) throw new Error(check.items.find((i) => i.level === 'error')?.text || 'connect a GitHub repo first');
  const { outDir, profile } = await build({ config: configPath, out: `${base}/dist` });
  const { url } = await deploy({ outDir, cwd: base });
  await recordPublish(store, { design: profile.theme, host, url });
  return { host, url, theme: profile.theme };
}
