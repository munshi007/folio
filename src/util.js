// Shared helpers for themes and the build. Everything that reaches HTML goes through esc() or md().

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

// Allow http(s), mailto, tel, anchors and relative paths. Drop anything else (javascript:, data:, ...).
export function safeUrl(u) {
  if (!u) return '';
  const s = String(u).trim();
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
  return s;
}

export const attrUrl = (u) => esc(safeUrl(u));

// Inline markdown subset: **bold**, *em*, `code`, [text](url). Input is escaped first.
export function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const href = safeUrl(url.replace(/&amp;/g, '&'));
      return href ? `<a href="${esc(href)}">${label}</a>` : label;
    });
}

// Paragraphs separated by blank lines.
export function md(text) {
  if (!text) return '';
  return String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2023-06" -> "Jun 2023", "2023" -> "2023", "present" -> "Present". Anything else passes through.
export function fmtDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  if (/^(present|now|current)$/i.test(s)) return 'Present';
  const m = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (m) return `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim();
  return s;
}

export function dateRange(start, end) {
  const a = fmtDate(start);
  const b = fmtDate(end);
  if (a && b) return `${a} – ${b}`;
  return a || b;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

const ICONS = {
  github:
    '<path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/>',
  linkedin:
    '<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/>',
  x: '<path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41Z"/>',
  mail: '<path fill="none" stroke="currentColor" stroke-width="2" d="M3 5h18v14H3z"/><path fill="none" stroke="currentColor" stroke-width="2" d="m3 6 9 7 9-7"/>',
  link: '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M2.5 12h19M12 2.5c2.6 2.6 4 6 4 9.5s-1.4 6.9-4 9.5c-2.6-2.6-4-6-4-9.5s1.4-6.9 4-9.5Z"/>',
  arrow: '<path fill="none" stroke="currentColor" stroke-width="2" d="M7 17 17 7M8 7h9v9"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z"/>',
};

export function icon(name, size = 18) {
  const body = ICONS[name] ?? ICONS.link;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;
}

export function linkKind(url) {
  const s = String(url ?? '');
  if (s.startsWith('mailto:')) return 'mail';
  const h = hostOf(s);
  if (h === 'github.com') return 'github';
  if (h.endsWith('linkedin.com')) return 'linkedin';
  if (h === 'x.com' || h === 'twitter.com') return 'x';
  return 'link';
}

// Passed to every theme's render(profile, h) so themes outside this package need no imports.
export const helpers = Object.freeze({ esc, safeUrl, attrUrl, inline, md, fmtDate, dateRange, hostOf, initials, icon, linkKind });
